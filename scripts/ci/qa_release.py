"""Record a deployed QA image, then verify its immutable promotion to main.

Production uses the QA digest and source revision. The main trigger commit is
checked separately, and its complete Git tree must match the tested QA tree.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.error
import urllib.request

from deploy_web import SERVICE, DeploymentError, IMAGE_REPOSITORY, NoRedirects, SHA_PATTERN, matches, required

REPOSITORY = "hufs-hexagon-talent/user-app"
WORKFLOW = ".github/workflows/deploy.yml"
MANIFEST_KEYS = {"version", "service", "environment", "repository", "run_id", "run_attempt",
                 "sequence", "revision", "tree", "image"}


def positive(value, setting):
    return int(matches(str(value), r"[1-9][0-9]{0,18}", setting))


def image(value):
    if not isinstance(value, str):
        raise DeploymentError("QA image must be an immutable image reference.")
    return matches(value, re.escape(IMAGE_REPOSITORY) + r"@sha256:[0-9a-f]{64}", "QA image")


def context(environ, branch, event):
    if (environ.get("GITHUB_REPOSITORY") != REPOSITORY or environ.get("GITHUB_REF_NAME") != branch
            or environ.get("GITHUB_REF") != "refs/heads/" + branch or environ.get("GITHUB_EVENT_NAME") != event):
        raise DeploymentError("QA release command is not running in its bound repository/event/branch.")
    return matches(required(environ, "GITHUB_SHA"), SHA_PATTERN, "GITHUB_SHA")


def fetch(endpoint, environ):
    request = urllib.request.Request("https://api.github.com/repos/" + REPOSITORY + endpoint,
                                     headers={"Authorization": "Bearer " + required(environ, "GITHUB_TOKEN"),
                                              "Accept": "application/vnd.github+json",
                                              "X-GitHub-Api-Version": "2026-03-10", "Cache-Control": "no-cache"})
    try:
        with urllib.request.build_opener(NoRedirects()).open(request, timeout=30) as response:
            data = response.read(262145)
        if len(data) > 262144:
            raise DeploymentError("QA verification response is oversized.")
        return json.loads(data)
    except (OSError, urllib.error.URLError, ValueError):
        raise DeploymentError("QA verification request failed; no deployment was started.") from None


def verify_run(run, run_id):
    if (not isinstance(run, dict) or type(run.get("id")) is not int or run.get("id") != run_id or run.get("event") != "push"
            or run.get("head_branch") != "qa" or run.get("path") != WORKFLOW
            or run.get("status") != "completed" or run.get("conclusion") != "success"
            or not isinstance(run.get("repository"), dict) or run["repository"].get("full_name") != REPOSITORY
            or type(run.get("run_attempt")) is not int or type(run.get("run_number")) is not int):
        raise DeploymentError("Production requires a successful push run of the QA workflow.")
    revision = matches(str(run.get("head_sha", "")), SHA_PATTERN, "QA revision")
    attempt = positive(run.get("run_attempt"), "QA run attempt")
    positive(run.get("run_number"), "QA sequence")
    return SERVICE + "-qa-release-" + revision + "-" + str(attempt)


def make_manifest(environ, tree):
    revision = context(environ, "qa", "push")
    return {"version": 1, "service": SERVICE, "environment": "qa", "repository": REPOSITORY,
            "run_id": positive(required(environ, "GITHUB_RUN_ID"), "QA run id"),
            "run_attempt": positive(required(environ, "GITHUB_RUN_ATTEMPT"), "QA run attempt"),
            "sequence": positive(required(environ, "GITHUB_RUN_NUMBER"), "QA sequence"),
            "revision": revision, "tree": matches(tree, SHA_PATTERN, "QA tree"),
            "image": image(required(environ, "WEB_RELEASE_IMAGE"))}


def verify_manifest(manifest, run, main_tree, commit):
    if not isinstance(manifest, dict) or set(manifest) != MANIFEST_KEYS:
        raise DeploymentError("QA release manifest has an invalid schema.")
    if (type(manifest["version"]) is not int or manifest["version"] != 1 or manifest["service"] != SERVICE
            or manifest["environment"] != "qa" or manifest["repository"] != REPOSITORY):
        raise DeploymentError("QA release manifest belongs to a different service or environment.")
    for field, expected in (("run_id", run["id"]), ("run_attempt", run["run_attempt"]),
                            ("sequence", run["run_number"])):
        if type(manifest[field]) is not int or manifest[field] != expected:
            raise DeploymentError("QA release manifest does not match the successful workflow run.")
    if not isinstance(manifest["revision"], str) or not isinstance(manifest["tree"], str):
        raise DeploymentError("QA revision and tree must be commit identifiers.")
    revision = matches(manifest["revision"], SHA_PATTERN, "QA revision")
    tree = matches(manifest["tree"], SHA_PATTERN, "QA tree")
    if (revision != run["head_sha"] or not isinstance(commit, dict) or commit.get("sha") != revision
            or not isinstance(commit.get("tree"), dict) or commit["tree"].get("sha") != tree or tree != main_tree):
        raise DeploymentError("QA source tree differs from main; rebuild and verify QA before promotion.")
    return {"image": image(manifest["image"]), "revision": revision, "verified": "true"}


def outputs(values, environ):
    with open(required(environ, "GITHUB_OUTPUT"), "a", encoding="utf-8") as stream:
        for key, value in values.items():
            stream.write(key + "=" + value + "\n")


def git_tree(revision):
    return subprocess.check_output(["git", "rev-parse", "--verify", revision + "^{tree}"], text=True).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["write", "inspect-run", "verify"])
    parser.add_argument("--file", type=Path)
    args = parser.parse_args()
    if args.command != "inspect-run" and args.file is None:
        parser.error("--file is required for write/verify")
    environ = os.environ
    try:
        if args.command == "write":
            manifest = make_manifest(environ, git_tree(context(environ, "qa", "push")))
            args.file.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            args.file.write_text(json.dumps(manifest, indent=2) + "\n")
            args.file.chmod(0o600)
        else:
            trigger = context(environ, "main", "workflow_dispatch")
            run_id = positive(required(environ, "QA_RUN_ID"), "QA run id")
            run = fetch("/actions/runs/" + str(run_id), environ)
            artifact_name = verify_run(run, run_id)
            if args.command == "inspect-run":
                outputs({"artifact_name": artifact_name}, environ)
            else:
                with args.file.open("rb") as source:
                    data = source.read(65537)
                if len(data) > 65536:
                    raise DeploymentError("QA release manifest is oversized.")
                manifest = json.loads(data)
                revision = matches(str(manifest.get("revision", "")), SHA_PATTERN, "QA revision")
                commit = fetch("/git/commits/" + revision, environ)
                outputs(verify_manifest(manifest, run, git_tree(trigger), commit), environ)
        print("QA release evidence " + ("recorded." if args.command == "write" else "verified."))
    except (DeploymentError, OSError, ValueError, TypeError, KeyError, subprocess.SubprocessError, AttributeError) as error:
        message = str(error) if isinstance(error, DeploymentError) else type(error).__name__
        print("::error::QA release validation failed: " + message, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
