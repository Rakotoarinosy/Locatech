from rest_framework.routers import DefaultRouter
from django.urls import include, path
from .views import FactureViewSet

router = DefaultRouter()
router.register(r'factures', FactureViewSet, basename='facture')

urlpatterns = [
    path('', include(router.urls)),
]
