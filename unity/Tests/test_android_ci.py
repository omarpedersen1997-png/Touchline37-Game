"""Offline security/configuration checks; these do NOT execute Unity or install an APK.

Run: python -m unittest discover -s unity/Tests -p test_android_ci.py -v
Requires PyYAML (tested with 6.0.3); actionlint independently checks Actions syntax.
"""
import ast
from pathlib import Path
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = ROOT / '.github/workflows/unity-android-build.yml'
CONFIG = yaml.load(WORKFLOW.read_text(), Loader=yaml.BaseLoader)
REPOSITORY = 'omarpedersen1997-png/Touchline37-Game'
BRANCH = 'refs/heads/codex/unity-66-foundation'


def job_enabled(job, repository, branch, mode):
    expression = CONFIG['jobs'][job]['if']
    for name, value in [('github.repository', repository), ('github.ref', branch),
                        ('vars.UNITY_BUILD_RUNNER', mode)]:
        expression = expression.replace(name, repr(value))
    tree = ast.parse(expression.replace('&&', ' and '), mode='eval')
    allowed = (ast.Expression, ast.BoolOp, ast.And, ast.Compare, ast.Eq, ast.NotEq, ast.Constant)
    if any(not isinstance(node, allowed) for node in ast.walk(tree)):
        raise ValueError('Unexpected expression in branch guard')
    return eval(compile(tree, '<branch-guard>', 'eval'), {'__builtins__': {}}, {})


class AndroidCiTests(unittest.TestCase):
    def test_push_has_one_branch_and_no_other_automatic_triggers(self):
        self.assertEqual(set(CONFIG['on']), {'push', 'workflow_dispatch'})
        self.assertEqual(CONFIG['on']['push']['branches'], ['codex/unity-66-foundation'])

    def test_main_tags_other_branches_and_forks_cannot_run_either_builder(self):
        for job in CONFIG['jobs']:
            for mode in ['', 'windows-personal']:
                for branch in ['refs/heads/main', 'refs/heads/other', 'refs/tags/codex/unity-66-foundation']:
                    with self.subTest(job=job, mode=mode, branch=branch):
                        self.assertFalse(job_enabled(job, REPOSITORY, branch, mode))
                self.assertFalse(job_enabled(job, 'someone/fork', BRANCH, mode))

    def test_one_and_only_one_builder_is_selected(self):
        for mode, expected in [('', 'android-gameci'), ('windows-personal', 'android-personal-windows')]:
            actual = [job for job in CONFIG['jobs'] if job_enabled(job, REPOSITORY, BRANCH, mode)]
            self.assertEqual(actual, [expected])

    def test_checkout_has_no_persistent_write_credentials_and_token_is_read_only(self):
        self.assertEqual(CONFIG['permissions'], {'contents': 'read'})
        for job in CONFIG['jobs'].values():
            checkout = next(step for step in job['steps'] if step.get('uses', '').startswith('actions/checkout@'))
            self.assertEqual(checkout['with']['persist-credentials'], 'false')
            self.assertNotIn('ref', checkout['with'])  # current event SHA, never a hard-coded main

    def test_only_allowlisted_artifact_stage_is_uploaded(self):
        for job in CONFIG['jobs'].values():
            upload = next(step for step in job['steps'] if step.get('uses', '').startswith('actions/upload-artifact@'))
            self.assertEqual(upload['with']['path'], '${{ runner.temp }}/touchline-unity-artifact/')
            self.assertEqual(upload['with']['if-no-files-found'], 'error')
            self.assertNotIn('if', upload)  # no artifact when build/verification fails
        publisher = (ROOT / 'unity/ci/Publish-AndroidArtifact.ps1').read_text()
        self.assertNotIn('-Recurse', publisher)
        self.assertIn('verify --verbose --print-certs', publisher)
        self.assertIn("'certificate.txt'", publisher)
        self.assertIn("'SHA256SUMS.txt'", publisher)

    def test_cloud_uses_pinned_exact_editor_and_dedicated_key(self):
        steps = CONFIG['jobs']['android-gameci']['steps']
        builder = next(step for step in steps if step.get('uses', '').startswith('game-ci/unity-builder@'))
        self.assertEqual(builder['with']['unityVersion'], '6000.6.10f1')
        self.assertEqual(builder['with']['targetPlatform'], 'Android')
        self.assertRegex(builder['with']['customImage'], r'6000\.6\.10f1-android-4\.0\.0@sha256:[a-f0-9]{64}$')
        self.assertEqual(builder['with']['androidKeystoreBase64'], '${{ steps.signing.outputs.keystore_base64 }}')
        signing = next(step for step in steps if step.get('id') == 'signing')
        self.assertEqual(signing['env']['UNITY_ANDROID_DEBUG_KEYSTORE_BASE64'], '${{ secrets.UNITY_ANDROID_DEBUG_KEYSTORE_BASE64 }}')
        preflight = next(step for step in steps if 'for name in UNITY_LICENSE' in step.get('run',''))
        self.assertNotIn('UNITY_ANDROID_DEBUG_KEYSTORE_BASE64', preflight['run'])
        for job in CONFIG['jobs'].values():
            for step in job['steps']:
                if 'uses' in step:
                    self.assertRegex(step['uses'], r'@[a-f0-9]{40}$')

    def test_no_release_deploy_or_license_activation_is_added(self):
        text = WORKFLOW.read_text().lower()
        for forbidden in ['pull_request:', 'repository_dispatch:', 'contents: write', 'gh release',
                          'git push', 'wrangler deploy', 'unity_serial:', '-createManualActivationFile'.lower()]:
            self.assertNotIn(forbidden, text)


if __name__ == '__main__':
    unittest.main()
