from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("customers", "0003_gisfeature_geography")]

    operations = [
        migrations.DeleteModel(name="GISFeature"),
        migrations.DeleteModel(name="GISRaster"),
        migrations.AlterField(
            model_name="propertyanalysis",
            name="status",
            field=models.CharField(
                choices=[("complete", "Complete"), ("partial", "Partial"), ("failed", "Failed")],
                max_length=20,
            ),
        ),
    ]
