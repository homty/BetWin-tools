from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api_gateway', '0002_setupjob'),
    ]

    operations = [
        migrations.AlterField(
            model_name='product',
            name='github_url',
            field=models.CharField(blank=True, max_length=500),
        ),
    ]
