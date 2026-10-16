from datetime import date
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.clients.models import Client
from apps.reservations.models import Reservation

User = get_user_model()

GOOGLE_INFO = {
    'sub': 'google-123',
    'email': 'Rasoa@Gmail.com',
    'email_verified': True,
    'given_name': 'Rasoa',
    'family_name': 'Rakoto',
}


class BackOfficeAccessTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.staff = User.objects.create_user('staff', 'staff@locatech.mg', 'motdepasse', role='staff')
        self.client_user = User.objects.create_user('client', 'client@gmail.com', 'motdepasse', role='client')

    def test_client_account_cannot_read_back_office(self):
        self.api.force_authenticate(self.client_user)
        for url in ['/clients/clients/', '/reservations/reservations/', '/reservations/reservations/calendar/']:
            self.assertEqual(self.api.get(url).status_code, 403, url)

    def test_staff_can_read_back_office(self):
        self.api.force_authenticate(self.staff)
        self.assertEqual(self.api.get('/reservations/reservations/').status_code, 200)

    def test_public_catalogue_stays_open(self):
        self.assertEqual(self.api.get('/materiels/materiels/catalogue/').status_code, 200)

    def test_register_is_admin_only(self):
        payload = {'username': 'pirate', 'password': 'motdepasse', 'role': 'admin'}
        self.assertIn(self.api.post('/register/', payload).status_code, (401, 403))
        self.api.force_authenticate(self.staff)
        self.assertEqual(self.api.post('/register/', payload).status_code, 403)
        self.assertFalse(User.objects.filter(username='pirate').exists())


@override_settings(GOOGLE_CLIENT_ID='test-client-id')
class GoogleLoginTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def login(self, info=GOOGLE_INFO):
        with patch('apps.users.views.id_token.verify_oauth2_token', return_value=dict(info)):
            return self.api.post('/auth/google/', {'credential': 'jeton'}, format='json')

    def test_creates_client_account(self):
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertIn('access', response.data)
        user = User.objects.get(google_sub='google-123')
        self.assertEqual(user.role, 'client')
        self.assertEqual(user.email, 'rasoa@gmail.com')
        self.assertFalse(user.has_usable_password())

    def test_second_login_reuses_account(self):
        self.login()
        self.login()
        self.assertEqual(User.objects.filter(google_sub='google-123').count(), 1)

    def test_rejects_unverified_email(self):
        response = self.login({**GOOGLE_INFO, 'email_verified': False})
        self.assertEqual(response.status_code, 401)

    def test_rejects_invalid_token(self):
        with patch('apps.users.views.id_token.verify_oauth2_token', side_effect=ValueError('bad')):
            response = self.api.post('/auth/google/', {'credential': 'faux'}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_staff_email_cannot_log_in_with_google(self):
        User.objects.create_user('staff', 'rasoa@gmail.com', 'motdepasse', role='admin')
        response = self.login()
        self.assertEqual(response.status_code, 403)
        self.assertFalse(User.objects.filter(google_sub='google-123').exists())

    @override_settings(GOOGLE_CLIENT_ID='')
    def test_not_configured(self):
        self.assertEqual(self.login().status_code, 503)


class MesReservationsTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.user = User.objects.create_user('rasoa', 'rasoa@gmail.com', role='client')
        mien = Client.objects.create(nom='Rasoa', email='RASOA@gmail.com', telephone='034', adresse='Tana')
        autre = Client.objects.create(nom='Autre', email='autre@gmail.com', telephone='034', adresse='Tana')
        jour = date(2026, 11, 1)
        self.par_email = Reservation.objects.create(client=mien, date_debut=jour, date_fin=jour)
        self.par_compte = Reservation.objects.create(client=autre, date_debut=jour, date_fin=jour, cree_par=self.user)
        self.etrangere = Reservation.objects.create(client=autre, date_debut=jour, date_fin=jour)

    def test_requires_login(self):
        self.assertEqual(self.api.get('/reservations/reservations/mes-reservations/').status_code, 401)

    def test_lists_only_own_reservations(self):
        self.api.force_authenticate(self.user)
        response = self.api.get('/reservations/reservations/mes-reservations/')
        self.assertEqual(response.status_code, 200)
        ids = {r['id'] for r in response.data}
        self.assertEqual(ids, {self.par_email.id, self.par_compte.id})
        self.assertNotIn('notes', response.data[0])
