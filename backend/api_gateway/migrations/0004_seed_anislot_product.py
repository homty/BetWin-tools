from django.db import migrations


def seed_anislot_product(apps, schema_editor):
    Product = apps.get_model('api_gateway', 'Product')
    Product.objects.get_or_create(
        name='AniSlot',
        defaults={
            'description': 'Slots in anime design',
            'github_url': '',
        },
    )


class Migration(migrations.Migration):

    dependencies = [
        ('api_gateway', '0003_alter_product_github_url'),
    ]

    operations = [
        migrations.RunPython(seed_anislot_product, migrations.RunPython.noop),
    ]
