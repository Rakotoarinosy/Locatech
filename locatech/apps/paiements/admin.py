from django.contrib import admin

from .models import PaiementCarte


@admin.register(PaiementCarte)
class PaiementCarteAdmin(admin.ModelAdmin):
    list_display = ('intent_id', 'reservation', 'montant', 'statut', 'created_at')
    list_filter = ('statut',)
    search_fields = ('intent_id', 'reservation__client__nom', 'reservation__client__email')
