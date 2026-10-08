from django.contrib.gis.db import models
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("customers", "0002_postgis_property_analysis")]
    operations = [
        migrations.AlterField(
            model_name="gisfeature",
            name="geometry",
            field=models.GeometryField(geography=True, srid=4326),
        ),
    ]
