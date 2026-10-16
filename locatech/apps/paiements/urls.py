from django.urls import path

from . import views

urlpatterns = [
    path('config/', views.ConfigView.as_view(), name='paiements-config'),
    path('statut/', views.StatutView.as_view(), name='paiements-statut'),
    path('carte/', views.PayerCarteView.as_view(), name='paiements-carte'),
    path('webhook/', views.WebhookView.as_view(), name='paiements-webhook'),
]
