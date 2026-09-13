from django.test import TestCase
from django.urls import reverse


class NavigationTests(TestCase):
    def test_public_pages_are_available(self):
        for route_name in ("dashboard:landing", "dashboard:home", "anislot:home", "prediction_market:home"):
            with self.subTest(route_name=route_name):
                response = self.client.get(reverse(route_name))
                self.assertEqual(response.status_code, 200)

    def test_landing_page_links_to_dashboard(self):
        response = self.client.get(reverse("dashboard:landing"))
        self.assertContains(response, reverse("dashboard:home"))
