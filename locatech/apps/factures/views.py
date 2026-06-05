import os
from decimal import Decimal
from datetime import date
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import FileResponse
from django.conf import settings
from .models import Facture
from .serializers import FactureSerializer
from apps.reservations.models import Reservation


def _generate_pdf(facture):
    """Génère un PDF simple pour la facture et le sauvegarde dans media/factures/."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        import io
        from django.core.files.base import ContentFile

        r = facture.reservation
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)
        styles = getSampleStyleSheet()
        elements = []

        # En-tête
        elements.append(Paragraph("<b>LOCATECH</b> — Facture de location", styles['Title']))
        elements.append(Spacer(1, 0.5*cm))

        # Tableau des infos
        data = [
            ["Facture N°", str(facture.id)],
            ["Date", str(facture.created_at.strftime('%d/%m/%Y') if facture.created_at else date.today())],
            ["Client", r.client.nom],
            ["Email", r.client.email],
            ["Téléphone", r.client.telephone],
            ["Matériel", r.materiel.nom],
            ["Catégorie", r.materiel.categorie],
            ["Prix journalier", f"{r.materiel.prix_journalier} Ar"],
            ["Période", f"{r.date_debut} → {r.date_fin}"],
            ["Durée", f"{(r.date_fin - r.date_debut).days} jour(s)"],
            ["Statut réservation", r.statut.upper()],
        ]
        if r.retard_jours > 0:
            data.append(["Retard", f"{r.retard_jours} jour(s)"])

        table = Table(data, colWidths=[6*cm, 10*cm])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (0, -1), colors.lightgrey),
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('PADDING', (0, 0), (-1, -1), 6),
        ]))
        elements.append(table)
        elements.append(Spacer(1, 1*cm))

        # Total
        total_text = f"<b>TOTAL À PAYER : {facture.montant} Ar</b>"
        elements.append(Paragraph(total_text, styles['Heading2']))

        doc.build(elements)
        buffer.seek(0)

        filename = f"facture_{facture.id}.pdf"
        facture.pdf.save(filename, ContentFile(buffer.read()), save=True)
        return True

    except ImportError:
        # reportlab non installé — on crée un fichier texte de substitution
        from django.core.files.base import ContentFile
        r = facture.reservation
        content = f"""LOCATECH — FACTURE N°{facture.id}
{'='*40}
Client      : {r.client.nom}
Email       : {r.client.email}
Matériel    : {r.materiel.nom}
Période     : {r.date_debut} → {r.date_fin}
Durée       : {(r.date_fin - r.date_debut).days} jour(s)
Prix/jour   : {r.materiel.prix_journalier} Ar
{'='*40}
TOTAL       : {facture.montant} Ar
"""
        filename = f"facture_{facture.id}.txt"
        facture.pdf.save(filename, ContentFile(content.encode()), save=True)
        return True


class FactureViewSet(viewsets.ModelViewSet):
    queryset = Facture.objects.all().order_by('-created_at')
    serializer_class = FactureSerializer
    permission_classes = (IsAuthenticated,)
    filter_backends = [filters.SearchFilter]
    search_fields = ['reservation__client__nom', 'reservation__materiel__nom']
    http_method_names = ['get', 'post', 'delete', 'head', 'options']  # pas de PUT/PATCH

    def perform_create(self, serializer):
        reservation = serializer.validated_data['reservation']
        # Calcul du montant (prix_total + pénalités retard si applicable)
        montant = reservation.prix_total
        if reservation.retard_jours > 0:
            penalite = reservation.materiel.prix_journalier * Decimal(reservation.retard_jours) * Decimal('1.5')
            montant += penalite
        facture = serializer.save(montant=montant)
        _generate_pdf(facture)

    @action(detail=True, methods=['get'], url_path='download')
    def download(self, request, pk=None):
        """Télécharger le PDF de la facture."""
        facture = self.get_object()
        if not facture.pdf:
            return Response({'error': 'PDF non disponible.'}, status=status.HTTP_404_NOT_FOUND)
        file_path = os.path.join(settings.MEDIA_ROOT, str(facture.pdf))
        if not os.path.exists(file_path):
            return Response({'error': 'Fichier introuvable.'}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(open(file_path, 'rb'), as_attachment=True,
                            filename=os.path.basename(file_path))

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        from django.db.models import Sum, Count
        total_factures = Facture.objects.count()
        total_revenus = Facture.objects.aggregate(total=Sum('montant'))['total'] or 0
        return Response({
            'total_factures': total_factures,
            'total_revenus': str(total_revenus),
        })

    @action(detail=False, methods=['post'], url_path='generer-depuis-reservation')
    def generer_depuis_reservation(self, request):
        """Raccourci : générer une facture directement depuis un reservation_id."""
        reservation_id = request.data.get('reservation_id')
        if not reservation_id:
            return Response({'error': 'reservation_id requis.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            reservation = Reservation.objects.get(pk=reservation_id)
        except Reservation.DoesNotExist:
            return Response({'error': 'Réservation introuvable.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = FactureSerializer(data={'reservation': reservation.id}, context={'request': request})
        if serializer.is_valid():
            montant = reservation.prix_total
            if reservation.retard_jours > 0:
                penalite = reservation.materiel.prix_journalier * Decimal(reservation.retard_jours) * Decimal('1.5')
                montant += penalite
            facture = serializer.save(montant=montant)
            _generate_pdf(facture)
            return Response(FactureSerializer(facture).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
