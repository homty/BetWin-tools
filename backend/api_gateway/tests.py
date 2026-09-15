from pathlib import Path
from unittest.mock import patch

from django.test import SimpleTestCase, TestCase
from django.core.files.uploadedfile import SimpleUploadedFile

from .services.repository import (
    clone_environment,
    existing_repository_matches,
    normalize_repository_url,
    validate_repository_url,
)
from .models import Product, SetupJob
from .workflows.anislot import AniSlotWorkflowBuilder


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

    @patch('api_gateway.services.repository.Path.is_file', return_value=True)
    @patch('api_gateway.services.repository.Path.home', return_value=Path('C:/Users/test'))
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

    @patch('api_gateway.services.repository.Path.is_dir', return_value=True)
    @patch('api_gateway.services.repository.subprocess.run')
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
        self.assertEqual(response.json(), {
            'status': 'queued',
            'itemId': 'queue-item-1',
            'itemIds': ['queue-item-1'],
        })
        client.upload_image.assert_called_once()
        builder_class.return_value.build.assert_called_once_with(
            image_name='uploaded.png',
            slot_concept_image_name=None,
            slot_concept_prompt=None,
            positive_prompt='polished anime symbol',
            negative_prompt=None,
            seed=42,
            width=768,
        )
        client.enqueue_graph.assert_called_once_with(
            builder_class.return_value.build.return_value,
            runs=1,
        )

    @patch('api_gateway.views.AniSlotWorkflowBuilder')
    @patch('api_gateway.views.InvokeClient')
    def test_uploads_optional_slot_concept(self, client_class, builder_class):
        client = client_class.return_value
        client.upload_image.side_effect = [
            {'image_name': 'source.png'},
            {'image_name': 'concept.png'},
        ]
        client.enqueue_graph.return_value = {'item_ids': ['queue-item-1']}
        builder_class.return_value.build.return_value = {'id': 'graph-1', 'nodes': {}, 'edges': []}

        response = self.client.post('/api/anislot/generate/', data={
            'image': SimpleUploadedFile('source.png', b'source', content_type='image/png'),
            'slotConceptImage': SimpleUploadedFile('concept.png', b'concept', content_type='image/png'),
            'slotConceptPrompt': 'icy Norse mythology with blue crystal light',
        })

        self.assertEqual(response.status_code, 202)
        self.assertEqual(client.upload_image.call_count, 2)
        builder_class.return_value.build.assert_called_once_with(
            image_name='source.png',
            slot_concept_image_name='concept.png',
            slot_concept_prompt='icy Norse mythology with blue crystal light',
            positive_prompt=None,
            negative_prompt=None,
            seed=None,
            width=None,
        )

    @patch('api_gateway.views.AniSlotResultStore')
    @patch('api_gateway.views.InvokeClient')
    def test_completed_job_returns_a_saved_result_url(self, client_class, store_class):
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
        client_class.return_value.download_image.return_value = (b'generated-image', 'image/png')

        response = self.client.get('/api/anislot/jobs/queue-item-1/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'itemId': 'queue-item-1',
            'status': 'completed',
            'imageName': 'generated.png',
            'imageUrl': '/api/anislot/results/queue-item-1/',
        })
        store_class.return_value.save.assert_called_once_with(
            'queue-item-1',
            'generated.png',
            b'generated-image',
        )


class AniSlotWorkflowBuilderTests(SimpleTestCase):
    def test_omitting_slot_concept_keeps_original_reference_graph(self):
        builder = AniSlotWorkflowBuilder()

        graph = builder.build(image_name='source.png')

        self.assertNotIn(builder.SLOT_CONCEPT_IMAGE_NODE, graph['nodes'])
        self.assertNotIn(builder.SLOT_CONCEPT_COLLECTION_NODE, graph['nodes'])
        self.assertTrue(any(
            edge['source'] == {'node_id': builder.REFERENCE_IMAGES_NODE, 'field': 'collection'}
            and edge['destination'] == {
                'node_id': builder.POSITIVE_TEXT_ENCODER_NODE,
                'field': 'reference_images',
            }
            for edge in graph['edges']
        ))

    def test_slot_concept_adds_second_reference_and_prompt_guidance(self):
        builder = AniSlotWorkflowBuilder()

        graph = builder.build(
            image_name='source.png',
            slot_concept_image_name='concept.png',
            slot_concept_prompt='icy Norse mythology',
        )

        self.assertEqual(
            graph['nodes'][builder.SLOT_CONCEPT_IMAGE_NODE]['image'],
            {'image_name': 'concept.png'},
        )
        prompt = graph['nodes'][builder.POSITIVE_PROMPT_NODE]['value']
        self.assertIn('Reference image 1 is the source symbol', prompt)
        self.assertIn('Reference image 2 is the slot concept', prompt)
        self.assertIn('Slot concept direction: icy Norse mythology', prompt)
        self.assertTrue(any(
            edge['source'] == {
                'node_id': builder.SLOT_CONCEPT_COLLECTION_NODE,
                'field': 'collection',
            }
            and edge['destination'] == {
                'node_id': builder.POSITIVE_TEXT_ENCODER_NODE,
                'field': 'reference_images',
            }
            for edge in graph['edges']
        ))

    def test_slot_concept_prompt_works_without_an_image(self):
        builder = AniSlotWorkflowBuilder()

        graph = builder.build(
            image_name='source.png',
            slot_concept_prompt='warm Egyptian treasure chamber',
        )

        self.assertNotIn(builder.SLOT_CONCEPT_IMAGE_NODE, graph['nodes'])
        self.assertIn(
            'Slot concept direction: warm Egyptian treasure chamber',
            graph['nodes'][builder.POSITIVE_PROMPT_NODE]['value'],
        )
