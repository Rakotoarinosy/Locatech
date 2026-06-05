from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('materials', '0002_materiel_created_at_alter_materiel_statut'),
    ]

    operations = [
        migrations.RunSQL(
            sql="UPDATE materials_materiel SET statut = 'maintenance' WHERE statut = 'maintenace';",
            reverse_sql="UPDATE materials_materiel SET statut = 'maintenace' WHERE statut = 'maintenance';"
        ),
    ]
