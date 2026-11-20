#!/usr/bin/env python3
"""Invoke the reviewed, server-installed web deployer using an immutable image.

Only this invocation crosses SSH. Infrastructure code and credentials are never
uploaded or fetched by this helper. The server deployer owns locking, sequence
validation, readiness checks and rollback.
"""

import ipaddress
import json
import os
import re
import shlex
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path


IMAGE_REPOSITORY = "ghcr.io/hufs-hexagon-talent/study-room-reservation-user-app"
SERVICE = 'user-app'
SOURCE_REPOSITORY = 'hufs-hexagon-talent/user-app'
SHA_PATTERN = r"[0-9a-f]{40}"


class DeploymentError(Exception):
    """A diagnostic deliberately containing no input values or credentials."""


@dataclass(frozen=True)
class Deployment:
    environment: str
    host: str
    user: str
    port: int
    stack_dir: str
    image: str
    revision: str
    sequence: str
    repository: str
    branch: str
    trigger_revision: str
    private_key: str = field(repr=False)
    known_hosts: str = field(repr=False)
    github_token: str = field(repr=False)


def required(environ, name):
    value = environ.get(name, "")
    if not value or not value.strip():
        raise DeploymentError(f"Missing required deployment setting: {name}.")
    return value


def matches(value, pattern, setting):
    if not re.fullmatch(pattern, value):
        raise DeploymentError(f"Invalid deployment setting: {setting}.")
    return value


def load_deployment(environ):
    if environ.get("WEB_DEPLOY_ENABLED") != "true":
        raise DeploymentError("WEB_DEPLOY_ENABLED must be 'true' before deployment.")
    branch = required(environ, "GITHUB_REF_NAME")
    environment = required(environ, "WEB_DEPLOY_ENVIRONMENT")
    if {"main": "production", "qa": "qa"}.get(branch) != environment:
        raise DeploymentError("Deployment environment does not match the main/qa branch.")
    if environ.get("GITHUB_REF") != f"refs/heads/{branch}":
        raise DeploymentError("web deployment requires a matching branch ref.")
    event = environ.get("GITHUB_EVENT_NAME")
    if (branch == "qa" and event != "push") or (branch == "main" and event != "workflow_dispatch"):
        raise DeploymentError("QA requires a push; production requires a verified QA promotion.")
    if branch == "main" and environ.get("WEB_QA_RELEASE_VERIFIED") != "true":
        raise DeploymentError("WEB_QA_RELEASE_VERIFIED must confirm the QA release manifest.")

    host = required(environ, "WEB_DEPLOY_SSH_HOST")
    if "%" in host:
        raise DeploymentError("WEB_DEPLOY_SSH_HOST must not contain an IPv6 scope identifier.")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        if len(host) > 253 or any(not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?", label)
                                  for label in host.split(".")):
            raise DeploymentError("Invalid deployment setting: WEB_DEPLOY_SSH_HOST.") from None
    user = matches(required(environ, "WEB_DEPLOY_SSH_USER"), r"[a-z_][a-z0-9_-]{0,31}", "WEB_DEPLOY_SSH_USER")
    port_value = matches(environ.get("WEB_DEPLOY_SSH_PORT") or "22", r"[0-9]{1,5}", "WEB_DEPLOY_SSH_PORT")
    port = int(port_value)
    if not 1 <= port <= 65535:
        raise DeploymentError("WEB_DEPLOY_SSH_PORT must be between 1 and 65535.")

    stack_dir = matches(required(environ, "WEB_DEPLOY_PATH"), r"/[A-Za-z0-9_./-]+", "WEB_DEPLOY_PATH")
    if stack_dir.endswith("/") or any(part in ("", ".", "..") for part in stack_dir.split("/")[1:]):
        raise DeploymentError("WEB_DEPLOY_PATH must be an absolute, non-root path without dot segments.")
    image = matches(required(environ, "WEB_DEPLOY_IMAGE"),
                    re.escape(IMAGE_REPOSITORY) + r"@sha256:[0-9a-f]{64}", "WEB_DEPLOY_IMAGE")
    trigger_revision = matches(required(environ, "GITHUB_SHA"), SHA_PATTERN, "GITHUB_SHA")
    revision = matches(required(environ, "WEB_DEPLOY_REVISION") if branch == "main" else trigger_revision,
                       SHA_PATTERN, "WEB_DEPLOY_REVISION")
    if branch == "qa" and environ.get("WEB_DEPLOY_REVISION", trigger_revision) != trigger_revision:
        raise DeploymentError("QA image revision must match the push revision.")
    sequence = matches(required(environ, "GITHUB_RUN_NUMBER"), r"[1-9][0-9]{0,18}", "GITHUB_RUN_NUMBER")
    repository = matches(required(environ, "GITHUB_REPOSITORY"),
                         r"[A-Za-z0-9_-]+/[A-Za-z0-9_.-]+", "GITHUB_REPOSITORY")

    if repository != SOURCE_REPOSITORY:
        raise DeploymentError("Deployment belongs to a different source repository.")

    return Deployment(environment, host, user, port, stack_dir, image, revision, sequence, repository, branch, trigger_revision,
                      required(environ, "WEB_DEPLOY_SSH_KEY"), required(environ, "WEB_DEPLOY_SSH_KNOWN_HOSTS"),
                      required(environ, "GITHUB_TOKEN"))


class NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        # Keep GITHUB_TOKEN on the fixed api.github.com origin, including renamed repositories.
        return None


def branch_is_current(deployment):
    request = urllib.request.Request(
        f"https://api.github.com/repos/{deployment.repository}/git/ref/heads/{deployment.branch}",
        headers={"Authorization": f"Bearer {deployment.github_token}",
                 "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2026-03-10",
                 "Cache-Control": "no-cache"},
    )
    try:
        with urllib.request.build_opener(NoRedirects()).open(request, timeout=30) as response:
            data = response.read(65_537)
        if len(data) > 65_536:
            raise DeploymentError("GitHub branch verification returned an oversized response.")
        ref = json.loads(data)
    except urllib.error.HTTPError as error:
        status = error.code
        error.close()
        raise DeploymentError(f"GitHub branch verification failed (HTTP {status}).") from None
    except (OSError, urllib.error.URLError, ValueError):
        raise DeploymentError("GitHub branch verification failed; no deployment was started.") from None
    if (not isinstance(ref, dict) or ref.get("ref") != f"refs/heads/{deployment.branch}"
            or not isinstance(ref.get("object"), dict) or ref["object"].get("type") != "commit"
            or not re.fullmatch(SHA_PATTERN, str(ref["object"].get("sha", "")))):
        raise DeploymentError("GitHub branch verification returned an invalid reference.")
    return ref["object"]["sha"] == deployment.trigger_revision


def prepare_ssh_files(deployment, directory):
    key_path = Path(directory) / "identity"
    hosts_path = Path(directory) / "known_hosts"
    for path, value in ((key_path, deployment.private_key), (hosts_path, deployment.known_hosts)):
        with open(path, "x", encoding="utf-8", opener=lambda name, flags: os.open(name, flags, 0o600)) as output:
            output.write(value.rstrip("\n") + "\n")
    validation = subprocess.run(["ssh-keygen", "-y", "-P", "", "-f", str(key_path)],
                                capture_output=True, timeout=15, check=False)
    if validation.returncode != 0:
        raise DeploymentError("WEB_DEPLOY_SSH_KEY must contain an unencrypted SSH private key.")
    host_entry = deployment.host if deployment.port == 22 else f"[{deployment.host}]:{deployment.port}"
    validation = subprocess.run(["ssh-keygen", "-F", host_entry, "-f", str(hosts_path)],
                                capture_output=True, timeout=15, check=False)
    if validation.returncode != 0:
        raise DeploymentError("WEB_DEPLOY_SSH_KNOWN_HOSTS has no matching host/port entry.")
    return key_path, hosts_path


def ssh_command(deployment, key_path, hosts_path):
    # OpenSSH sends the remote command through the remote user's shell, so quote
    # every argument even after validating the values. No local shell is used.
    remote = shlex.join([
        "python3", f"{deployment.stack_dir}/deploy/web_deploy.py", "--stack-dir", deployment.stack_dir,
        "--environment", deployment.environment, "--service", SERVICE, "deploy", "--image", deployment.image, "--revision", deployment.revision, "--sequence", deployment.sequence,
    ])
    return ["ssh", "-F", "/dev/null", "-n", "-T", "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes",
            "-o", "StrictHostKeyChecking=yes", "-o", f"UserKnownHostsFile={hosts_path}",
            "-o", "GlobalKnownHostsFile=/dev/null", "-o", "UpdateHostKeys=no", "-o", "ForwardAgent=no",
            "-o", "ConnectTimeout=15", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=4",
            "-o", "LogLevel=ERROR", "-i", str(key_path), "-p", str(deployment.port), "-l", deployment.user,
            "--", deployment.host, remote]


def confirm_receipt(output, deployment):
    """Exit zero can mean a stale sequence was skipped; require the actual release."""
    if not isinstance(output, str) or len(output) > 65536:
        raise DeploymentError("Remote deployment receipt is missing or oversized.")
    records = [line.removeprefix("deployment_receipt=") for line in output.splitlines()
               if line.startswith("deployment_receipt=")]
    if len(records) != 1:
        raise DeploymentError("Remote deployment did not return exactly one release receipt.")
    try:
        receipt = json.loads(records[0])
        keys = {"version", "service", "environment", "phase", "sequence", "image", "revision"}
        if (not isinstance(receipt, dict) or set(receipt) != keys or type(receipt["version"]) is not int
                or receipt["version"] != 1 or receipt["service"] != SERVICE
                or receipt["environment"] != deployment.environment or receipt["phase"] != "stable"
                or type(receipt["sequence"]) is not int
                or not 0 <= receipt["sequence"] < 10**19):
            raise ValueError()
        matches(receipt["image"], re.escape(IMAGE_REPOSITORY) + r"@sha256:[0-9a-f]{64}", "receipt image")
        matches(receipt["revision"], SHA_PATTERN, "receipt revision")
    except (ValueError, KeyError, TypeError, DeploymentError):
        raise DeploymentError("Remote deployment returned an invalid release receipt.") from None
    return (receipt["image"] == deployment.image and receipt["revision"] == deployment.revision
            and receipt["sequence"] == int(deployment.sequence))


def deploy(deployment):
    with tempfile.TemporaryDirectory(prefix="web-deploy-") as directory:
        key_path, hosts_path = prepare_ssh_files(deployment, directory)
        # Check after credential preparation, immediately before SSH. The server
        # also rejects an older sequence while holding its deployment lock.
        if not branch_is_current(deployment):
            print("::notice::Skipping web deployment because the branch HEAD has changed.")
            return False
        print(f"event=web_deploy_started environment={deployment.environment} "
              f"revision={deployment.revision} sequence={deployment.sequence}", flush=True)
        result = subprocess.run(ssh_command(deployment, key_path, hosts_path), check=False, timeout=20 * 60,
                                capture_output=True, text=True)
        if result.returncode != 0:
            raise DeploymentError(f"Remote web deployment failed (exit {result.returncode}).")
        if not confirm_receipt(result.stdout, deployment):
            print("::notice::Requested web release was not applied; no QA release evidence was recorded.")
            return False
        print(f"event=web_deploy_completed environment={deployment.environment} revision={deployment.revision}")
        return True


def main():
    try:
        deployed = deploy(load_deployment(os.environ))
        if os.environ.get("GITHUB_OUTPUT"):
            with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
                output.write("deployed=" + ("true" if deployed else "false") + "\n")
    except DeploymentError as error:
        print(f"::error::{error}", file=sys.stderr)
        return 1
    except (OSError, subprocess.SubprocessError) as error:
        # Subprocess/URL exception strings may contain arguments or secret material.
        print(f"::error::web deployment helper failed ({type(error).__name__}).", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
