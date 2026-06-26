from django.contrib import admin
from .models import Materiel, Categorie

@admin.register(Materiel)
class MaterielAdmin(admin.ModelAdmin):
    list_display = (
        'nom',
        'categorie',
        'statut',
        'prix_journalier'
    )

    search_fields = (
        'nom',
        'categorie'
    )

    list_filter = (
        'statut',
        'categorie'
    )
    

admin.site.register(Categorie)
    