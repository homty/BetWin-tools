from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from django.core.files.uploadedfile import SimpleUploadedFile

from .clone_service import (
    clone_environment,
    existing_repository_matches,
    normalize_repository_url,
    validate_repository_url,
)
from .models import Product, SetupJob


class RepositoryUrlTests(SimpleTestCase):
    def test_accepts_github_https_and_ssh_urls(self):
        valid_urls = [
            'https://github.com/homty/AniSlot-Invoke-Workflow.git',
            'git@github.com:homty/AniSlot-Invoke-Workflow.git',
            'git@github-anislot:homty/AniSlot-Invoke-Workflow.git',
            'ssh://git@github.com/homty/AniSlot-Invoke-Workflow.git',
            'ssh://git@github-anislot/homty/AniSlot-Invoke-Workflow.git',
        ]

        for repository_url in valid_urls:
            with self.subTest(repository_url=repository_url):
                self.assertTrue(validate_repository_url(repository_url))

    def test_rejects_non_github_and_malformed_urls(self):
        invalid_urls = [
            'git@example.com:homty/AniSlot-Invoke-Workflow.git',
            'https://example.com/homty/AniSlot-Invoke-Workflow.git',
            'https://github.com/homty',
            'file:///tmp/repository',
            'not-a-url',
        ]

        for repository_url in invalid_urls:
            with self.subTest(repository_url=repository_url):
                self.assertFalse(validate_repository_url(repository_url))

    def test_normalizes_https_and_ssh_as_the_same_repository(self):
        expected = 'github.com/homty/anislot-invoke-workflow'

        self.assertEqual(
            normalize_repository_url('https://github.com/homty/AniSlot-Invoke-Workflow.git'),
            expected,
        )
        self.assertEqual(
            normalize_repository_url('git@github-anislot:homty/AniSlot-Invoke-Workflow.git'),
            expected,
        )

    @patch('api_gateway.clone_service.Path.is_file', return_value=True)
    @patch('api_gateway.clone_service.Path.home', return_value=Path('C:/Users/test'))
    def test_ssh_clone_uses_anislot_deploy_key(self, _home, _is_file):
        environment = clone_environment(
            'git@github.com:homty/AniSlot-Invoke-Workflow.git'
        )

        self.assertIn(
            'ssh -i "C:/Users/test/.ssh/anislot_deploy" -o IdentitiesOnly=yes',
            environment['GIT_SSH_COMMAND'],
        )

    def test_https_clone_does_not_override_git_environment(self):
        self.assertIsNone(clone_environment(
            'https://github.com/homty/AniSlot-Invoke-Workflow.git'
        ))

    @patch('api_gateway.clone_service.Path.is_dir', return_value=True)
    @patch('api_gateway.clone_service.subprocess.run')
    def test_existing_repository_matches_across_url_formats(self, run, _is_dir):
        run.return_value.returncode = 0
        run.return_value.stdout = 'git@github-anislot:homty/AniSlot-Invoke-Workflow.git\n'

        self.assertTrue(existing_repository_matches(
            Path('C:/repositories/anislot'),
            'https://github.com/homty/AniSlot-Invoke-Workflow.git',
        ))


class RepositorySetupTests(TestCase):
    def setUp(self):
        self.product = Product.objects.create(name='AniSlot')
        self.repository_url = 'git@github.com:homty/AniSlot-Invoke-Workflow.git'

    @patch('api_gateway.views.clone_repository')
    def test_setup_stores_repository_on_product_without_creating_job(self, clone):
        clone.return_value = Path('D:/workspaces/anislot')

        response = self.client.post(
            '/api/setup/',
            data={
                'productId': self.product.id,
                'repositoryUrl': self.repository_url,
            },
            content_type='application/json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertNotIn('localPath', response.json())
        self.product.refresh_from_db()
        self.assertEqual(self.product.github_url, self.repository_url)
        self.assertEqual(SetupJob.objects.count(), 0)

    @patch('api_gateway.views.existing_repository_matches', return_value=True)
    def test_setup_status_reads_product_without_creating_job(self, _matches):
        self.product.github_url = self.repository_url
        self.product.save(update_fields=['github_url'])

        response = self.client.get(
            '/api/setup/status/',
            {'productId': self.product.id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['configured'])
        self.assertNotIn('localPath', response.json())
        self.assertEqual(SetupJob.objects.count(), 0)


class AniSlotGenerateTests(TestCase):
    def test_requires_an_image(self):
        response = self.client.post('/api/anislot/generate/', data={})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['error'], 'An image file is required.')

    @patch('api_gateway.views.AniSlotWorkflowBuilder')
    @patch('api_gateway.views.InvokeClient')
    def test_uploads_builds_and_queues_a_job(self, client_class, builder_class):
        client = client_class.return_value
        client.upload_image.return_value = {'image_name': 'uploaded.png'}
        client.enqueue_graph.return_value = {'item_ids': ['queue-item-1']}
        builder_class.return_value.build.return_value = {'id': 'graph-1', 'nodes': {}, 'edges': []}

        response = self.client.post('/api/anislot/generate/', data={
            'image': SimpleUploadedFile('source.png', b'fake-image', content_type='image/png'),
            'positivePrompt': 'polished anime symbol',
            'seed': '42',
            'width': '768',
        })

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json(), {'status': 'queued', 'itemId': 'queue-item-1'})
        client.upload_image.assert_called_once()
        builder_class.return_value.build.assert_called_once_with(
            image_name='uploaded.png',
            positive_prompt='polished anime symbol',
            negative_prompt=None,
            seed=42,
            width=768,
        )

    @patch('api_gateway.views.InvokeClient')
    def test_completed_job_returns_a_django_image_url(self, client_class):
        client_class.image_names_from_results.return_value = ['generated.png']
        client_class.return_value.queue_item.return_value = {
            'status': 'completed',
            'session': {
                'results': {
                    'output-node': {
                        'type': 'image_output',
                        'image': {'image_name': 'generated.png'},
                    },
                },
            },
        }

        response = self.client.get('/api/anislot/jobs/queue-item-1/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'itemId': 'queue-item-1',
            'status': 'completed',
            'imageName': 'generated.png',
            'imageUrl': '/api/anislot/images/generated.png/',
        })
