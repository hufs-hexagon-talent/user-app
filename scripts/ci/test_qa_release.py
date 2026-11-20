import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
from uuid import uuid4

from deploy_web import DeploymentError
import qa_release


def settings():
    return {"GITHUB_REPOSITORY": qa_release.REPOSITORY, "GITHUB_REF_NAME": "qa",
            "GITHUB_REF": "refs/heads/qa", "GITHUB_EVENT_NAME": "push", "GITHUB_SHA": "a" * 40,
            "GITHUB_RUN_ID": "12345", "GITHUB_RUN_ATTEMPT": "2", "GITHUB_RUN_NUMBER": "403",
            "WEB_RELEASE_IMAGE": qa_release.IMAGE_REPOSITORY + "@sha256:" + "d" * 64,
            "GITHUB_TOKEN": str(uuid4())}


class QaReleaseTest(unittest.TestCase):
    def setUp(self):
        self.environ = settings()
        self.tree = "c" * 40
        self.manifest = qa_release.make_manifest(self.environ, self.tree)
        self.run = {"id": 12345, "event": "push", "head_branch": "qa", "path": qa_release.WORKFLOW,
                    "status": "completed", "conclusion": "success", "head_sha": "a" * 40,
                    "run_attempt": 2, "run_number": 403, "repository": {"full_name": qa_release.REPOSITORY}}
        self.commit = {"sha": "a" * 40, "tree": {"sha": self.tree}}

    def test_manifest_binds_digest_source_run_attempt_and_tree_without_credentials(self):
        self.assertEqual(qa_release.verify_run(self.run, 12345), qa_release.SERVICE + "-qa-release-" + "a" * 40 + "-2")
        self.assertEqual(qa_release.verify_manifest(self.manifest, self.run, self.tree, self.commit), {
            "image": self.manifest["image"], "revision": "a" * 40, "verified": "true"})
        self.assertNotIn(self.environ["GITHUB_TOKEN"], json.dumps(self.manifest))

    def test_main_commit_can_differ_but_its_entire_tree_must_match_qa(self):
        with self.assertRaisesRegex(DeploymentError, "source tree differs"):
            qa_release.verify_manifest(self.manifest, self.run, "e" * 40, self.commit)

    def test_failed_wrong_branch_wrong_workflow_and_foreign_runs_cannot_promote(self):
        for changes in ({"id": 3}, {"event": "pull_request"}, {"head_branch": "main"},
                        {"path": ".github/workflows/another.yml"}, {"status": "in_progress"},
                        {"conclusion": "failure"}, {"head_sha": "invalid"},
                        {"repository": {"full_name": "another/api"}}, {"run_attempt": 0}):
            with self.subTest(changes=changes), self.assertRaises(DeploymentError):
                qa_release.verify_run({**self.run, **changes}, 12345)

    def test_tampered_manifest_metadata_and_mutable_or_foreign_images_fail_closed(self):
        changes = [{"version": True}, {"service": "other-service"}, {"environment": "production"},
                   {"repository": "another/api"}, {"run_id": 12346}, {"run_attempt": 1},
                   {"sequence": True}, {"revision": "b" * 40}, {"tree": "b" * 40},
                   {"image": qa_release.IMAGE_REPOSITORY + ":qa"},
                   {"image": "ghcr.io/another/api@sha256:" + "d" * 64}, {"unexpected": "value"}]
        for change in changes:
            with self.subTest(change=change), self.assertRaises(DeploymentError):
                qa_release.verify_manifest({**self.manifest, **change}, self.run, self.tree, self.commit)

    def test_tree_is_verified_against_independent_github_commit_metadata(self):
        for commit in ({"sha": "b" * 40, "tree": {"sha": self.tree}},
                       {"sha": "a" * 40, "tree": {"sha": "f" * 40}}, {}):
            with self.subTest(commit=commit), self.assertRaises(DeploymentError):
                qa_release.verify_manifest(self.manifest, self.run, self.tree, commit)

    def test_writer_rejects_fork_main_pull_request_and_invalid_workflow_values(self):
        for changes in ({"GITHUB_REPOSITORY": "another/api"}, {"GITHUB_REF_NAME": "main"},
                        {"GITHUB_REF": "refs/pull/1/merge"}, {"GITHUB_EVENT_NAME": "pull_request"},
                        {"GITHUB_RUN_ID": "123\nimage=unexpected"}, {"GITHUB_SHA": "$(inert)"}):
            with self.subTest(changes=changes), self.assertRaises(DeploymentError):
                qa_release.make_manifest({**self.environ, **changes}, self.tree)

    def test_token_is_sent_only_to_fixed_github_origin_and_redirects_are_disabled(self):
        opener = Mock()
        opener.open.return_value.__enter__ = Mock(return_value=Mock(read=Mock(return_value=b'{}')))
        opener.open.return_value.__exit__ = Mock(return_value=False)
        with patch("qa_release.urllib.request.build_opener", return_value=opener) as build:
            qa_release.fetch("/actions/runs/12345", self.environ)
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.github.com/repos/" + qa_release.REPOSITORY + "/actions/runs/12345")
        self.assertNotIn(self.environ["GITHUB_TOKEN"], request.full_url)
        self.assertIsInstance(build.call_args.args[0], qa_release.NoRedirects)

    def test_verification_cli_emits_only_verified_image_revision_and_flag(self):
        with tempfile.TemporaryDirectory() as directory:
            manifest = Path(directory) / "release.json"
            manifest.write_text(json.dumps(self.manifest))
            target = Path(directory) / "outputs"
            environ = {**self.environ, "GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_REF_NAME": "main",
                       "GITHUB_REF": "refs/heads/main", "GITHUB_SHA": "b" * 40,
                       "QA_RUN_ID": "12345", "GITHUB_OUTPUT": str(target)}
            with patch.dict("qa_release.os.environ", environ, clear=True), \
                    patch("qa_release.sys.argv", ["qa_release.py", "verify", "--file", str(manifest)]), \
                    patch("qa_release.fetch", side_effect=[self.run, self.commit]), \
                    patch("qa_release.git_tree", return_value=self.tree), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(qa_release.main(), 0)
            self.assertEqual(target.read_text().splitlines(), ["image=" + self.manifest["image"],
                                                              "revision=" + "a" * 40, "verified=true"])


if __name__ == "__main__":
    unittest.main()
