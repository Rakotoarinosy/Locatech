from rest_framework.routers import DefaultRouter
from django.urls import include, path
from .views import MaterielViewSet

router = DefaultRouter()
router.register(r'materiels', MaterielViewSet, basename='materiel')

urlpatterns = [
    path('', include(router.urls)),
]
