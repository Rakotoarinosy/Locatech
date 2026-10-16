from django.test import TestCase
from rest_framework.test import APIClient

from .models import ContactRequest


class PublicContactRequestTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_contact_request_is_saved_without_authentication(self):
        response = self.client.post(
            '/notifications/contact/',
            {
                'name': 'Jean Ralambo',
                'email': 'jean@example.mg',
                'message': 'Je souhaite une démonstration.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(ContactRequest.objects.count(), 1)
        self.assertEqual(ContactRequest.objects.get().nom, 'Jean Ralambo')

    def test_contact_request_rejects_invalid_email(self):
        response = self.client.post(
            '/notifications/contact/',
            {
                'name': 'Jean Ralambo',
                'email': 'not-an-email',
                'message': 'Je souhaite une démonstration.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(ContactRequest.objects.count(), 0)
