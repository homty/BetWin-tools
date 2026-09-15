from unittest.mock import patch

from django.test import TestCase


class AniSlotRoutingTests(TestCase):
    @patch('pages.dashboard.views.anislot_is_configured', return_value=True)
    def test_setup_page_redirects_to_core_when_configured(self, _configured):
        response = self.client.get('/anislot/')

        self.assertRedirects(response, '/anislot/core/')

    @patch('pages.dashboard.views.anislot_is_configured', return_value=False)
    def test_core_redirects_to_setup_when_not_configured(self, _configured):
        response = self.client.get('/anislot/core/')

        self.assertRedirects(response, '/anislot/')

    @patch('pages.dashboard.views.anislot_is_configured', return_value=True)
    def test_core_renders_when_configured(self, _configured):
        response = self.client.get('/anislot/core/')

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'AniSlot Core')
