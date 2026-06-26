from django.urls import path
from .views import AssistantAPIView, AssistantHistoryAPIView

urlpatterns = [
    path(
        '',
        AssistantAPIView.as_view()
    ),
    path('history/', AssistantHistoryAPIView.as_view(), name='assistant_history'),
]