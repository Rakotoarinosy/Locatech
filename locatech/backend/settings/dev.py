import os
from pathlib import Path
from dotenv import load_dotenv

# 1. On définit BASE_DIR ici temporairement pour trouver le chemin du .env.dev avant l'import global
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / '..' / '.env.dev')

# 2. Maintenant qu'os.environ est peuplé, on charge la configuration de base
from .base import *


DEBUG = True

ALLOWED_HOSTS = ["*"]

CORS_ALLOW_ALL_ORIGINS = True

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:4200",
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / '..' / 'db.sqlite3',
    }
}
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")