from collections import defaultdict
import json

from google import genai
from django.conf import settings
from apps.materials.models import Materiel

client = genai.Client(api_key=settings.GEMINI_API_KEY)


def ask_gemini(question):

    materiels = Materiel.objects.select_related("categorie").all()

    groupes = defaultdict(list)

    for m in materiels:
        groupes[m.categorie.nom].append(m)

    catalogue = ""

    for categorie, items in groupes.items():

        catalogue += f"\n## {categorie}\n"

        for m in items:

            catalogue += f"""
ID : {m.id}
Nom : {m.nom}
Catégorie : {m.categorie.nom}
Prix : {m.prix_journalier}
Stock : {m.quantite}
"""

    prompt = f"""
Tu es LocaTech AI.

Tu es un expert de la location de matériel événementiel.

Tu travailles exclusivement avec le catalogue ci-dessous.

===========================
CATALOGUE
===========================

{catalogue}

===========================
RÈGLES
===========================

Tu dois utiliser UNIQUEMENT les matériels présents dans le catalogue.

Tu n'as PAS le droit :

- d'inventer un matériel
- d'inventer un prix
- d'inventer un stock
- d'utiliser un ID qui n'existe pas

Si un matériel n'existe pas, indique-le dans le résumé.

Ne dépasse jamais le stock disponible.

Les prix sont des prix journaliers.

Estime les quantités selon le nombre de personnes.

Calcule le coût total.

Explique brièvement chaque choix.

===========================
FORMAT DE SORTIE
===========================

Tu dois répondre UNIQUEMENT avec un JSON valide.

Aucun texte avant.

Aucun texte après.

Aucun markdown.

Le JSON doit respecter EXACTEMENT ce format :

{{
    "resume": "résumé de la proposition",

    "cout_total": 0,

    "materiels": [

        {{
            "id": 1,
            "nom": "",
            "categorie": "",
            "quantite": 0,
            "prix_unitaire": 0,
            "prix_total": 0,
            "raison": ""
        }}

    ],

    "conseils": [
        "",
        "",
        ""
    ]
}}

===========================
QUESTION
===========================

{question}
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    try:
        return json.loads(response.text)

    except Exception:

        return {
            "resume": response.text,
            "cout_total": 0,
            "materiels": [],
            "conseils": []
        }