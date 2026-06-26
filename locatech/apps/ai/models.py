from django.db import models
from django.conf import settings

# Create your models here.
class MessageHistory(models.Model):
    SENDER_CHOICES = [
        ('user', 'Utilisateur'),
        ('ai', 'Assistant IA'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name="chat_history"
    )
    sender = models.CharField(max_length=10, choices=SENDER_CHOICES)
    text = models.TextField()
    # On stocke le JSON complet de la recommandation si le sender est 'ai'
    recommendation = models.JSONField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.user.username} - {self.sender} ({self.timestamp.strftime('%Y-%m-%d %H:%M')})"