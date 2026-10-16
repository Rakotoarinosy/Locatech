from django.contrib import admin
from .models import ContactRequest


@admin.register(ContactRequest)
class ContactRequestAdmin(admin.ModelAdmin):
    list_display = ('nom', 'email', 'created_at', 'traite')
    list_filter = ('traite', 'created_at')
    search_fields = ('nom', 'email', 'message')
    readonly_fields = ('created_at',)
