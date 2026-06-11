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
    """Génère un PDF professionnel pour la facture et le sauvegarde dans media/factures/."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        import io
        from django.core.files.base import ContentFile
        from django.conf import settings

        r = facture.reservation
        buffer = io.BytesIO()
        
        # Marges de la page A4 (2 cm partout)
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
        
        styles = getSampleStyleSheet()
        
        # Styles de texte personnalisés
        # ─── MODIFICATION STYLES DE TEXTE POUR LE LOGO ───
        # On passe la taille à 22 et on enlève la couleur globale car elle sera gérée par mot
        style_company_name = ParagraphStyle(
            'CompName', 
            parent=styles['Normal'], 
            fontName='Helvetica-Bold', 
            fontSize=22, 
            leading=26
        )
        style_company_details = ParagraphStyle('CompDet', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=colors.HexColor('#64748b'))
        
        style_invoice_title = ParagraphStyle('InvTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=24, leading=28, textColor=colors.HexColor('#0f172a'), alignment=2)
        style_invoice_meta = ParagraphStyle('InvMeta', parent=styles['Normal'], fontName='Helvetica', fontSize=10, leading=14, textColor=colors.HexColor('#334155'), alignment=2)
        
        style_section_heading = ParagraphStyle('SecHead', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=12, leading=16, textColor=colors.HexColor('#1e293b'))
        style_body = ParagraphStyle('BodyTextCustom', parent=styles['Normal'], fontName='Helvetica', fontSize=10, leading=14, textColor=colors.HexColor('#334155'))
        style_body_bold = ParagraphStyle('BodyTextBold', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, leading=14, textColor=colors.HexColor('#0f172a'))
        
        style_table_header = ParagraphStyle('TabHead', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=10, leading=12, textColor=colors.white)
        style_total_label = ParagraphStyle('TotLabel', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=12, leading=16, textColor=colors.HexColor('#0f172a'), alignment=2)
        style_total_val = ParagraphStyle('TotVal', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=14, leading=16, textColor=colors.HexColor('#2563eb'), alignment=2)

        elements = []

        # ─── EN-TÊTE DU DOCUMENT CORRIGÉ AVEC LOGO-DOT ───
        # Chaîne formatée : Point bleu (#2563eb) -> Loca en Slate 900 (#0f172a) -> Tech en bleu (#2563eb)
        logo_html = '<font color="#2563eb">\u25CF</font> <font color="#0f172a">Loca</font><font color="#2563eb">Tech</font>'

        company_info = [
            Paragraph(logo_html, style_company_name),
            Spacer(1, 0.2*cm),
            Paragraph("Gestion intelligente de location de matériels", style_company_details),
            Paragraph("Antananarivo, Madagascar", style_company_details),
            Paragraph("Contact : locatech-mada@rakotoarinosy.com", style_company_details),
        ]
        
        # Colonne Droite : Métadonnées de la facture
        date_facture = facture.created_at.strftime('%d/%m/%Y') if facture.created_at else date.today().strftime('%d/%m/%Y')
        invoice_info = [
            Paragraph("FACTURE", style_invoice_title),
            Spacer(1, 0.2*cm),
            Paragraph(f"<b>N° :</b> {facture.numero}", style_invoice_meta),
            Paragraph(f"<b>Date :</b> {date_facture}", style_invoice_meta),
            Paragraph(f"<b>Statut :</b> {facture.get_statut_display().upper()}", style_invoice_meta),
        ]
        
        header_table = Table([[company_info, invoice_info]], colWidths=[9.5*cm, 7.5*cm])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0),
        ]))
        elements.append(header_table)
        
        # Ligne de séparation colorée (Bleu primaire LocaTech)
        elements.append(Spacer(1, 0.6*cm))
        separator = Table([[""]], colWidths=[17*cm], rowHeights=[2])
        separator.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#2563eb'))]))
        elements.append(separator)
        elements.append(Spacer(1, 0.6*cm))

        # ─── INFORMATIONS DU CLIENT ───
        client_data = [
            [Paragraph("<b>Facturé à :</b>", style_section_heading)],
            [Paragraph(r.client.nom, style_body_bold)],
            [Paragraph(f"Email : {r.client.email}", style_body)],
            [Paragraph(f"Téléphone : {r.client.telephone}", style_body)],
        ]
        client_table = Table(client_data, colWidths=[17*cm])
        client_table.setStyle(TableStyle([
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 2),
            ('TOPPADDING', (0,0), (-1,-1), 2),
        ]))
        elements.append(client_table)
        elements.append(Spacer(1, 0.8*cm))

        # ─── TABLEAU DES ARTICLES / PRESTATIONS ───
        # En-têtes du tableau
        table_content = [
            [
                Paragraph("Description du matériel", style_table_header), 
                Paragraph("Période de location", style_table_header), 
                Paragraph("Qté", style_table_header), 
                Paragraph("Prix Unitaire", style_table_header), 
                Paragraph("Total", style_table_header)
            ]
        ]
        
        # Ligne de l'article principal
        duree_jours = (r.date_fin - r.date_debut).days
        duree_label = f"{duree_jours} jour(s)" if duree_jours > 0 else "1 jour"
        
        desc_materiel = f"<b>{r.materiel.nom}</b><br/><font color='#64748b' size='9'>Catégorie : {r.materiel.categorie}</font>"
        periode_text = f"{r.date_debut.strftime('%d/%m/%Y')} au {r.date_fin.strftime('%d/%m/%Y')}<br/><font color='#64748b' size='9'>Durée : {duree_label}</font>"
        px_unit = f"{IntlFormat(r.materiel.prix_journalier)} Ar"
        total_ligne = f"{IntlFormat(r.prix_total)} Ar"
        
        table_content.append([
            Paragraph(desc_materiel, style_body),
            Paragraph(periode_text, style_body),
            Paragraph(str(r.quantite), style_body),
            Paragraph(px_unit, style_body),
            Paragraph(total_ligne, style_body)
        ])
        
        # Ajout d'une ligne pour les pénalités de retard si applicable
        if r.retard_jours > 0:
            penalite = r.materiel.prix_journalier * Decimal(r.retard_jours) * Decimal('1.5')
            desc_retard = f"<b>Pénalités de retard</b><br/><font color='#dc2626' size='9'>Retard constaté de {r.retard_jours} jour(s) (Tarif majoré à 150%)</font>"
            table_content.append([
                Paragraph(desc_retard, style_body),
                Paragraph("-", style_body),
                Paragraph("1", style_body),
                Paragraph(f"{IntlFormat(penalite)} Ar", style_body),
                Paragraph(f"{IntlFormat(penalite)} Ar", style_body)
            ])

        # Largeurs de colonnes calculées pour tenir sur les 17cm de zone imprimable
        item_table = Table(table_content, colWidths=[5.5*cm, 4.5*cm, 1.2*cm, 2.8*cm, 3.0*cm])
        
        # Style du tableau de facturation
        item_table_style = [
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')), # En-tête bleu ardoise foncé
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 10),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
            ('LEFTPADDING', (0,0), (-1,-1), 8),
            ('RIGHTPADDING', (0,0), (-1,-1), 8),
            ('LINEBELOW', (0,1), (-1,-1), 0.5, colors.HexColor('#e2e8f0')), # Lignes de séparation fines grises
        ]
        item_table.setStyle(TableStyle(item_table_style))
        elements.append(item_table)
        elements.append(Spacer(1, 0.6*cm))

        # ─── BLOC TOTAL (ALIGNÉ À DROITE) ───
        total_data = [
            [Paragraph("Montant Total H.T. :", style_total_label), Paragraph(f"{IntlFormat(facture.montant)} Ar", style_body_bold)],
            [Paragraph("T.V.A. (0%) :", style_total_label), Paragraph("0.00 Ar", style_body)],
            [Paragraph("TOTAL À PAYER :", style_total_label), Paragraph(f"{IntlFormat(facture.montant)} Ar", style_total_val)],
        ]
        total_table = Table(total_data, colWidths=[12*cm, 5*cm])
        total_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            ('RIGHTPADDING', (1,0), (1,-1), 0),
        ]))
        elements.append(total_table)
        
        # Mentions légales de bas de page
        elements.append(Spacer(1, 2*cm))
        style_footer = ParagraphStyle('Footer', parent=styles['Normal'], fontName='Helvetica-Oblique', fontSize=8, leading=11, textColor=colors.HexColor('#94a3b8'), alignment=1)
        elements.append(Paragraph("Merci de votre confiance. Pour toute question concernant cette facture, veuillez contacter notre support.", style_footer))
        elements.append(Paragraph("LocaTech Madagascar — Logiciel de gestion de parc et réservations de matériels.", style_footer))

        # Génération finale
        doc.build(elements)
        buffer.seek(0)

        filename = f"facture_{facture.numero}.pdf"
        facture.pdf.save(filename, ContentFile(buffer.read()), save=True)
        return True

    except Exception as e:
        print(f"Erreur de génération PDF : {str(e)}")
        # Remplacement de secours en cas de crash
        from django.core.files.base import ContentFile
        r = facture.reservation
        content = f"LOCATECH — FACTURE N°{facture.numero}\nTotal: {facture.montant} Ar"
        facture.pdf.save(f"facture_{facture.numero}.txt", ContentFile(content.encode()), save=True)
        return True

def IntlFormat(value):
    """Formate les prix avec un séparateur d'espace pour Madagascar (ex: 10 000)"""
    try:
        return "{:,}".format(int(value)).replace(",", " ")
    except (ValueError, TypeError):
        return str(value)

class FactureViewSet(viewsets.ModelViewSet):
    queryset = Facture.objects.all().order_by('-created_at')
    serializer_class = FactureSerializer
    permission_classes = (IsAuthenticated,)
    filter_backends = [filters.SearchFilter]
    search_fields = ['reservation__client__nom', 'reservation__materiel__nom']
    http_method_names = ['get', 'post', 'delete', 'head', 'options', "patch"]

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
        total_factures = self.get_queryset().count()
        # Calcul de la somme des factures payées
        total_revenus = self.get_queryset().filter(statut='payee').aggregate(Sum('montant'))['montant__sum'] or 0
        
        return Response({
            'total_factures': total_factures,
            'total_revenus': total_revenus
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
    
    @action(detail=True, methods=['patch'])
    def payer(self, request, pk=None):

        facture = self.get_object()

        if facture.statut == 'payee':
            return Response(
                {'error': 'Cette facture est déjà payée.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        facture.statut = 'payee'
        facture.save()
        
        reservation = facture.reservation
        reservation.statut = 'confirmee'
        reservation.save()

        return Response(
            FactureSerializer(facture).data
        )
        
    @action(detail=True, methods=['patch'])
    def annuler(self, request, pk=None):

        facture = self.get_object()

        if facture.statut == 'payee':
            return Response(
                {'error': 'Une facture payée ne peut plus être annulée.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        facture.statut = 'annulee'
        facture.save()

        return Response(
            FactureSerializer(facture).data
        )
