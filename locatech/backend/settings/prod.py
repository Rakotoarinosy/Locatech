import os
from pathlib import Path
from dotenv import load_dotenv

# 1. On définit BASE_DIR ici temporairement pour trouver le chemin du .env.dev avant l'import global
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / '..' / '.env')
from .base import *

DEBUG = False

from django.core.exceptions import ImproperlyConfigured

if not os.getenv("SECRET_KEY"):
    # Les jetons JWT sont signés avec cette clé : elle ne doit jamais être celle du dépôt
    raise ImproperlyConfigured("SECRET_KEY doit être défini dans le .env de production.")

ALLOWED_HOSTS = os.getenv(
    "DJANGO_ALLOWED_HOSTS",
    "api.locatech-mada.com"
).split(",")

CORS_ALLOW_ALL_ORIGINS = False

CORS_ALLOWED_ORIGINS = [
    origin.strip() for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

CSRF_TRUSTED_ORIGINS = [
    origin.strip() for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
]

USE_X_FORWARDED_HOST = True

SECURE_PROXY_SSL_HEADER = (
    "HTTP_X_FORWARDED_PROTO",
    "https"
)

SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME"),
        "USER": os.getenv("DB_USER"),
        "PASSWORD": os.getenv("DB_PASSWORD"),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")