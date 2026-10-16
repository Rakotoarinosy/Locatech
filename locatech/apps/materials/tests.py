from django.test import TestCase
from rest_framework.test import APIClient

from .models import Categorie, Materiel


class PublicCatalogueTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.category = Categorie.objects.create(nom='Mobilier')
        Materiel.objects.create(
            nom='Chaise disponible',
            categorie=self.category,
            prix_journalier=3000,
            quantite=10,
            statut='disponible',
        )
        Materiel.objects.create(
            nom='Chaise louée',
            categorie=self.category,
            prix_journalier=3000,
            quantite=10,
            statut='loue',
        )
        Materiel.objects.create(
            nom='Chaise en maintenance',
            categorie=self.category,
            prix_journalier=3000,
            quantite=10,
            statut='maintenance',
        )
        Materiel.objects.create(
            nom='Chaise épuisée',
            categorie=self.category,
            prix_journalier=3000,
            quantite=0,
            statut='disponible',
        )

    def test_catalogue_is_public_and_only_shows_rentable_stock(self):
        response = self.client.get('/materiels/materiels/catalogue/')

        self.assertEqual(response.status_code, 200)
        # Loué sur d'autres dates = toujours réservable ; le stock est vérifié par période à la réservation
        self.assertEqual(sorted(item['nom'] for item in response.data), ['Chaise disponible', 'Chaise louée'])
        self.assertNotIn('quantite', response.data[0])

    def test_management_endpoint_still_requires_authentication(self):
        response = self.client.get('/materiels/materiels/')

        self.assertEqual(response.status_code, 401)
