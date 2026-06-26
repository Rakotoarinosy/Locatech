from rest_framework.routers import DefaultRouter
from django.urls import include, path
from .views import CategorieViewSet, MaterielViewSet

router = DefaultRouter()
router.register(r'materiels', MaterielViewSet, basename='materiel')
router.register(r'categories', CategorieViewSet, basename='categorie')

urlpatterns = [
    path('', include(router.urls)),
]
