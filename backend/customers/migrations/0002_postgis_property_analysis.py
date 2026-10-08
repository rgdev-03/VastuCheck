from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point
from django.contrib.postgres.operations import CreateExtension
from django.db import migrations, models
import django.db.models.deletion


def populate_locations(apps, schema_editor):
    Property = apps.get_model("customers", "Property")
    for item in Property.objects.all().iterator():
        item.location = Point(float(item.longitude), float(item.latitude), srid=4326)
        item.save(update_fields=["location"])


class Migration(migrations.Migration):
    dependencies = [("customers", "0001_initial")]

    operations = [
        CreateExtension("postgis"),
        CreateExtension("postgis_raster"),
        migrations.RenameModel(old_name="CustomerProperty", new_name="Property"),
        migrations.AddField(
            model_name="property",
            name="location",
            field=gis_models.PointField(geography=True, null=True, srid=4326),
        ),
        migrations.AddField(
            model_name="property",
            name="boundary",
            field=gis_models.PolygonField(blank=True, geography=True, null=True, srid=4326),
        ),
        migrations.RunPython(populate_locations, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="property",
            name="location",
            field=gis_models.PointField(geography=True, srid=4326),
        ),
        migrations.RemoveField(model_name="property", name="latitude"),
        migrations.RemoveField(model_name="property", name="longitude"),
        migrations.CreateModel(
            name="GISFeature",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source", models.CharField(max_length=40)),
                ("source_id", models.CharField(max_length=160)),
                ("feature_type", models.CharField(db_index=True, max_length=40)),
                ("name", models.CharField(blank=True, max_length=250)),
                ("geometry", gis_models.GeometryField(srid=32643)),
                ("properties", models.JSONField(blank=True, default=dict)),
            ],
            options={"constraints": [models.UniqueConstraint(fields=("source", "source_id"), name="unique_gis_source_feature")]},
        ),
        migrations.CreateModel(
            name="GISRaster",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("dataset_type", models.CharField(choices=[("land_cover", "Land cover"), ("elevation", "Elevation")], db_index=True, max_length=20)),
                ("source", models.CharField(max_length=80)),
                ("version", models.CharField(max_length=80)),
                ("tile_id", models.CharField(max_length=160)),
                ("raster", gis_models.RasterField(srid=4326)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("imported_at", models.DateTimeField(auto_now=True)),
            ],
            options={"constraints": [models.UniqueConstraint(fields=("dataset_type", "source", "tile_id"), name="unique_gis_raster_tile")]},
        ),
        migrations.CreateModel(
            name="PropertyAnalysis",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("analysis_version", models.CharField(default="1.0", max_length=20)),
                ("radius_m", models.PositiveIntegerField()),
                ("source_versions", models.JSONField(default=dict)),
                ("status", models.CharField(choices=[("complete", "Complete"), ("failed", "Failed")], max_length=20)),
                ("failure_detail", models.TextField(blank=True)),
                ("result", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("property", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="analyses", to="customers.property")),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
    ]
