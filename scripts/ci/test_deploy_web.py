import contextlib
import io
import json
import shlex
import subprocess
import tempfile
import unittest
import urllib.error
from dataclasses import replace
from pathlib import Path
from unittest.mock import Mock, patch
from uuid import uuid4

import deploy_web


def settings():
    return {
        "WEB_DEPLOY_ENABLED": "true",
        "WEB_DEPLOY_ENVIRONMENT": "production",
        "WEB_DEPLOY_SSH_HOST": "deploy.example.test",
        "WEB_DEPLOY_SSH_USER": "deployer",
        "WEB_DEPLOY_PATH": "/srv/studyroom-prod",
        "WEB_DEPLOY_IMAGE": deploy_web.IMAGE_REPOSITORY + "@sha256:" + "a" * 64,
        "WEB_DEPLOY_REVISION": "a" * 40,
        "WEB_QA_RELEASE_VERIFIED": "true",
        "WEB_DEPLOY_SSH_KEY": str(uuid4()),
        "WEB_DEPLOY_SSH_KNOWN_HOSTS": str(uuid4()),
        "GITHUB_EVENT_NAME": "workflow_dispatch",
        "GITHUB_REF": "refs/heads/main",
        "GITHUB_REF_NAME": "main",
        "GITHUB_SHA": "b" * 40,
        "GITHUB_RUN_NUMBER": "101",
        "GITHUB_REPOSITORY": "hufs-hexagon-talent/user-app",
        "GITHUB_TOKEN": str(uuid4()),
    }


class DeploymentConfigTest(unittest.TestCase):
    def test_production_defaults_to_port_22(self):
        deployment = deploy_web.load_deployment(settings())
        self.assertEqual(deployment.port, 22)
        self.assertEqual(deployment.environment, "production")

    def test_qa_uses_explicit_nondefault_port(self):
        environ = settings()
        environ.update(WEB_DEPLOY_ENVIRONMENT="qa", GITHUB_REF_NAME="qa", GITHUB_REF="refs/heads/qa",
                       GITHUB_EVENT_NAME="push", WEB_DEPLOY_REVISION=environ["GITHUB_SHA"],
                       WEB_DEPLOY_SSH_PORT="2222", WEB_DEPLOY_PATH="/srv/studyroom-qa")
        self.assertEqual(deploy_web.load_deployment(environ).port, 2222)

    def test_required_settings_fail_without_echoing_values(self):
        for name in ("WEB_DEPLOY_PATH", "WEB_DEPLOY_SSH_HOST", "WEB_DEPLOY_SSH_USER", "WEB_DEPLOY_IMAGE",
                     "WEB_DEPLOY_SSH_KEY", "WEB_DEPLOY_SSH_KNOWN_HOSTS", "GITHUB_TOKEN"):
            with self.subTest(name=name):
                environ = settings()
                environ[name] = ""
                with self.assertRaisesRegex(deploy_web.DeploymentError, name):
                    deploy_web.load_deployment(environ)

    def test_disabled_or_pull_request_cannot_deploy(self):
        for name, value in (("WEB_DEPLOY_ENABLED", "false"), ("WEB_DEPLOY_ENABLED", ""),
                            ("GITHUB_EVENT_NAME", "pull_request"), ("WEB_DEPLOY_ENVIRONMENT", "qa"),
                            ("GITHUB_REF", "refs/pull/1/merge"), ("GITHUB_REF_NAME", "unapproved")):
            with self.subTest(name=name, value=value):
                environ = settings()
                environ[name] = value
                with self.assertRaises(deploy_web.DeploymentError):
                    deploy_web.load_deployment(environ)

    def test_tag_images_and_foreign_repositories_cannot_deploy(self):
        for image in (deploy_web.IMAGE_REPOSITORY + ":latest", deploy_web.IMAGE_REPOSITORY + ":qa",
                      "ghcr.io/another/repository@sha256:" + "a" * 64,
                      deploy_web.IMAGE_REPOSITORY + "@sha256:short"):
            with self.subTest(image=image):
                environ = settings()
                environ["WEB_DEPLOY_IMAGE"] = image
                with self.assertRaisesRegex(deploy_web.DeploymentError, "WEB_DEPLOY_IMAGE"):
                    deploy_web.load_deployment(environ)

    def test_remote_command_inputs_reject_shell_syntax_and_bad_paths(self):
        malicious = "$(touch /tmp/unexpected)"
        for name in ("WEB_DEPLOY_PATH", "WEB_DEPLOY_SSH_HOST", "WEB_DEPLOY_SSH_USER", "WEB_DEPLOY_SSH_PORT",
                     "WEB_DEPLOY_IMAGE", "GITHUB_SHA", "GITHUB_RUN_NUMBER", "GITHUB_REPOSITORY"):
            with self.subTest(name=name):
                environ = settings()
                environ[name] = malicious
                with self.assertRaises(deploy_web.DeploymentError) as raised:
                    deploy_web.load_deployment(environ)
                self.assertNotIn(malicious, str(raised.exception))
        for path in ("/", "/srv/../api", "/srv/./api", "/srv//api", "/srv/api/", "~/api", "/srv/api\ncommand"):
            with self.subTest(path=path):
                environ = settings()
                environ["WEB_DEPLOY_PATH"] = path
                with self.assertRaises(deploy_web.DeploymentError):
                    deploy_web.load_deployment(environ)

    def test_sequence_revision_and_port_are_validated(self):
        for name, value in (("GITHUB_SHA", "b" * 39), ("GITHUB_RUN_NUMBER", "0"),
                            ("GITHUB_RUN_NUMBER", "-1"), ("WEB_DEPLOY_SSH_PORT", "0"),
                            ("WEB_DEPLOY_SSH_PORT", "65536")):
            with self.subTest(name=name, value=value):
                environ = settings()
                environ[name] = value
                with self.assertRaises(deploy_web.DeploymentError):
                    deploy_web.load_deployment(environ)

    def test_debug_repr_never_contains_credentials(self):
        deployment = deploy_web.load_deployment(settings())
        for value in (deployment.private_key, deployment.known_hosts, deployment.github_token):
            self.assertNotIn(value, repr(deployment))

    def test_main_push_and_unverified_production_release_cannot_deploy(self):
        for changes in ({"GITHUB_EVENT_NAME": "push"}, {"WEB_QA_RELEASE_VERIFIED": "false"},
                        {"WEB_DEPLOY_REVISION": ""}, {"WEB_DEPLOY_REVISION": "invalid"}):
            with self.subTest(changes=changes), self.assertRaises(deploy_web.DeploymentError):
                deploy_web.load_deployment({**settings(), **changes})

    def test_production_preserves_the_qa_image_revision_and_main_trigger_separately(self):
        deployment = deploy_web.load_deployment(settings())
        self.assertEqual(deployment.revision, "a" * 40)
        self.assertEqual(deployment.trigger_revision, "b" * 40)


    def test_valid_foreign_source_repository_cannot_use_this_service_key(self):
        environ = settings()
        environ["GITHUB_REPOSITORY"] = "another/project"
        with self.assertRaises(deploy_web.DeploymentError):
            deploy_web.load_deployment(environ)


class BranchVerificationTest(unittest.TestCase):
    def setUp(self):
        self.deployment = deploy_web.load_deployment(settings())

    def response(self, payload):
        opener = Mock()
        opener.open.return_value.__enter__ = Mock(return_value=Mock(read=Mock(return_value=json.dumps(payload).encode())))
        opener.open.return_value.__exit__ = Mock(return_value=False)
        return opener

    def reference(self, sha=None):
        return {"ref": "refs/heads/main", "object": {"type": "commit", "sha": sha or self.deployment.trigger_revision}}

    def test_current_branch_is_verified_on_github_without_query_credentials(self):
        opener = self.response(self.reference())
        with patch("deploy_web.urllib.request.build_opener", return_value=opener):
            self.assertTrue(deploy_web.branch_is_current(self.deployment))
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.github.com/repos/hufs-hexagon-talent/user-app/git/ref/heads/main")
        self.assertNotIn(self.deployment.github_token, request.full_url)
        self.assertEqual(request.get_header("Authorization"), "Bearer " + self.deployment.github_token)

    def test_stale_revision_is_not_current(self):
        with patch("deploy_web.urllib.request.build_opener", return_value=self.response(self.reference("c" * 40))):
            self.assertFalse(deploy_web.branch_is_current(self.deployment))

    def test_wrong_ref_or_invalid_response_fails_closed(self):
        for payload in ({}, [], {"ref": "refs/heads/qa", "object": {"type": "commit", "sha": "b" * 40}},
                        {"ref": "refs/heads/main", "object": {"type": "tag", "sha": "b" * 40}},
                        {"ref": "refs/heads/main", "object": {"type": "commit", "sha": "invalid"}}):
            with self.subTest(payload=payload):
                with patch("deploy_web.urllib.request.build_opener", return_value=self.response(payload)):
                    with self.assertRaises(deploy_web.DeploymentError):
                        deploy_web.branch_is_current(self.deployment)

    def test_http_failure_does_not_expose_credentials(self):
        opener = Mock()
        opener.open.side_effect = urllib.error.HTTPError("https://api.github.com", 403,
                                                        self.deployment.github_token, None, None)
        with patch("deploy_web.urllib.request.build_opener", return_value=opener):
            with self.assertRaisesRegex(deploy_web.DeploymentError, "HTTP 403") as raised:
                deploy_web.branch_is_current(self.deployment)
        self.assertNotIn(self.deployment.github_token, str(raised.exception))

    def test_redirects_never_forward_github_token(self):
        self.assertIsNone(deploy_web.NoRedirects().redirect_request(None, None, 302, "moved", {},
                                                                  "https://another.example.test"))


class SshInvocationTest(unittest.TestCase):
    def setUp(self):
        self.deployment = deploy_web.load_deployment(settings())

    def test_ssh_uses_pinned_host_key_and_exact_server_installed_cli(self):
        command = deploy_web.ssh_command(self.deployment, Path("/tmp/identity"), Path("/tmp/known_hosts"))
        self.assertIn("StrictHostKeyChecking=yes", command)
        self.assertIn("IdentitiesOnly=yes", command)
        self.assertIn("BatchMode=yes", command)
        self.assertIn("GlobalKnownHostsFile=/dev/null", command)
        self.assertIn("UserKnownHostsFile=/tmp/known_hosts", command)
        self.assertEqual(command[-3:-1], ["--", self.deployment.host])
        self.assertEqual(shlex.split(command[-1]), [
            "python3", "/srv/studyroom-prod/deploy/web_deploy.py", "--stack-dir", "/srv/studyroom-prod", "--environment", self.deployment.environment, "--service", deploy_web.SERVICE, "deploy",
            "--image", self.deployment.image, "--revision", self.deployment.revision,
            "--sequence", self.deployment.sequence,
        ])
        for value in (self.deployment.private_key, self.deployment.known_hosts, self.deployment.github_token):
            self.assertNotIn(value, " ".join(command))

    def test_remote_arguments_remain_quoted_even_after_validation(self):
        deployment = replace(self.deployment, stack_dir="/srv/api ' $(inert)")
        command = deploy_web.ssh_command(deployment, Path("/tmp/key"), Path("/tmp/known_hosts"))
        self.assertEqual(shlex.split(command[-1])[1], "/srv/api ' $(inert)/deploy/web_deploy.py")
        self.assertEqual(shlex.split(command[-1])[3], deployment.stack_dir)

    def test_real_generated_key_and_nondefault_known_host_entry_validate_locally(self):
        with tempfile.TemporaryDirectory(prefix="api-deploy-key-test-") as directory:
            source_key = Path(directory) / "source"
            subprocess.run(["ssh-keygen", "-q", "-t", "ed25519", "-N", "", "-f", str(source_key)],
                           capture_output=True, check=True)
            key = source_key.read_text()
            public_key = source_key.with_suffix(".pub").read_text().split()
            deployment = replace(self.deployment, port=2222, private_key=key,
                                 known_hosts=f"[deploy.example.test]:2222 {public_key[0]} {public_key[1]}\n")
            target = Path(directory) / "credentials"
            target.mkdir(mode=0o700)
            key_path, hosts_path = deploy_web.prepare_ssh_files(deployment, target)
            self.assertEqual(key_path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(hosts_path.stat().st_mode & 0o777, 0o600)

    def test_bad_private_key_fails_before_ssh(self):
        with tempfile.TemporaryDirectory(prefix="api-deploy-invalid-test-") as directory:
            with self.assertRaisesRegex(deploy_web.DeploymentError, "WEB_DEPLOY_SSH_KEY"):
                deploy_web.prepare_ssh_files(self.deployment, directory)

    def test_missing_known_host_is_rejected(self):
        with tempfile.TemporaryDirectory(prefix="api-deploy-host-test-") as directory:
            with patch("deploy_web.subprocess.run", side_effect=[Mock(returncode=0), Mock(returncode=1)]):
                with self.assertRaisesRegex(deploy_web.DeploymentError, "WEB_DEPLOY_SSH_KNOWN_HOSTS"):
                    deploy_web.prepare_ssh_files(self.deployment, directory)

    def test_stale_revision_never_starts_ssh_and_cleans_credentials(self):
        directories = []

        def prepared(deployment, directory):
            directories.append(directory)
            return Path(directory) / "identity", Path(directory) / "known_hosts"

        with patch("deploy_web.prepare_ssh_files", side_effect=prepared), \
                patch("deploy_web.branch_is_current", return_value=False), \
                patch("deploy_web.subprocess.run") as run, contextlib.redirect_stdout(io.StringIO()) as output:
            deploy_web.deploy(self.deployment)
        run.assert_not_called()
        self.assertIn("branch HEAD has changed", output.getvalue())
        self.assertFalse(Path(directories[0]).exists())

    def test_remote_failure_propagates_without_printing_secret_arguments(self):
        with patch("deploy_web.prepare_ssh_files", return_value=(Path("/tmp/key"), Path("/tmp/hosts"))), \
                patch("deploy_web.branch_is_current", return_value=True), \
                patch("deploy_web.subprocess.run", return_value=Mock(returncode=9)) as run, \
                contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(deploy_web.DeploymentError, "exit 9"):
                deploy_web.deploy(self.deployment)
        self.assertNotIn("shell", run.call_args.kwargs)
        self.assertEqual(run.call_args.args[0][0], "ssh")

    def test_main_error_output_does_not_print_exception_arguments(self):
        with patch.dict("deploy_web.os.environ", settings(), clear=True), \
                patch("deploy_web.deploy", side_effect=subprocess.TimeoutExpired([self.deployment.private_key], 1)), \
                contextlib.redirect_stderr(io.StringIO()) as output:
            self.assertEqual(deploy_web.main(), 1)
        self.assertIn("TimeoutExpired", output.getvalue())
        self.assertNotIn(self.deployment.private_key, output.getvalue())


class ReceiptTest(unittest.TestCase):
    def setUp(self):
        self.deployment = deploy_web.load_deployment(settings())
        self.receipt = {"version": 1, "service": deploy_web.SERVICE, "environment": self.deployment.environment,
                        "phase": "stable", "sequence": int(self.deployment.sequence),
                        "image": self.deployment.image, "revision": self.deployment.revision}

    def output(self, receipt=None):
        return "deployment_complete\ndeployment_receipt=" + json.dumps(receipt or self.receipt) + "\n"

    def test_exact_receipt_confirms_the_qa_source_revision_not_the_main_merge_sha(self):
        self.assertTrue(deploy_web.confirm_receipt(self.output(), self.deployment))

    def test_stale_sequence_success_does_not_confirm_the_requested_release(self):
        for changes in ({"sequence": 102}, {"image": deploy_web.IMAGE_REPOSITORY + "@sha256:" + "c" * 64},
                        {"revision": "c" * 40}):
            self.assertFalse(deploy_web.confirm_receipt(self.output({**self.receipt, **changes}), self.deployment))

    def test_missing_duplicate_cross_stack_and_nonstable_receipts_fail_closed(self):
        for output in ("deployment_complete", self.output() + self.output(),
                       self.output({**self.receipt, "environment": "qa"}),
                       self.output({**self.receipt, "phase": "draining"}),
                       self.output({**self.receipt, "service": "other-service"}),
                       self.output({**self.receipt, "sequence": True}),
                       "deployment_receipt={malformed}"):
            with self.subTest(output=output), self.assertRaises(deploy_web.DeploymentError):
                deploy_web.confirm_receipt(output, self.deployment)

    def test_exit_zero_without_receipt_is_not_a_successful_deployment(self):
        with patch("deploy_web.prepare_ssh_files", return_value=(Path("/tmp/key"), Path("/tmp/hosts"))), \
                patch("deploy_web.branch_is_current", return_value=True), \
                patch("deploy_web.subprocess.run", return_value=Mock(returncode=0, stdout="deployment_skipped")), \
                contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaises(deploy_web.DeploymentError):
                deploy_web.deploy(self.deployment)

    def test_no_qa_evidence_is_recorded_when_the_server_skips_a_stale_request(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "outputs"
            env = {**settings(), "GITHUB_OUTPUT": str(target)}
            with patch.dict("deploy_web.os.environ", env, clear=True), \
                    patch("deploy_web.deploy", return_value=False):
                self.assertEqual(deploy_web.main(), 0)
            self.assertEqual(target.read_text(), "deployed=false\n")


if __name__ == "__main__":
    unittest.main()
