from django.urls import path
from .views import (
    DashboardStatsView,
    RevenusParMoisView,
    MaterielsStatsView,
    ReservationsParMoisView,
    TopClientsView,
)

urlpatterns = [
    path('dashboard/', DashboardStatsView.as_view(), name='analytics-dashboard'),
    path('revenus-par-mois/', RevenusParMoisView.as_view(), name='analytics-revenus'),
    path('materiels/', MaterielsStatsView.as_view(), name='analytics-materiels'),
    path('reservations-par-mois/', ReservationsParMoisView.as_view(), name='analytics-reservations'),
    path('top-clients/', TopClientsView.as_view(), name='analytics-top-clients'),
]
