from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('apps.users.urls')),
    path('clients/', include('apps.clients.urls')),
    path('materiels/', include('apps.materials.urls')),
    path('reservations/', include('apps.reservations.urls')),
    path('factures/', include('apps.factures.urls')),
    path('analytics/', include('apps.analytics.urls')),
    path('assistant/', include('apps.ai.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )

    urlpatterns += static(
        settings.STATIC_URL,
        document_root=settings.STATIC_ROOT
    )
