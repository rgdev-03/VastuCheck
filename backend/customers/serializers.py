import json

from django.contrib.gis.geos import GEOSGeometry
from django.contrib.gis.db.models.functions import Area, Perimeter
from rest_framework import serializers

from .models import Property


class GeoJSONGeometryField(serializers.JSONField):
    def __init__(self, *args, geometry_type=None, **kwargs):
        self.geometry_type = geometry_type
        super().__init__(*args, **kwargs)

    def to_internal_value(self, data):
        if data in (None, "") and self.allow_null:
            return None
        try:
            geometry = GEOSGeometry(json.dumps(super().to_internal_value(data)), srid=4326)
        except (TypeError, ValueError) as error:
            raise serializers.ValidationError("Enter valid GeoJSON geometry.") from error
        if geometry.geom_type != self.geometry_type:
            raise serializers.ValidationError(f"Geometry must be a {self.geometry_type}.")
        geometry.srid = 4326
        return geometry

    def to_representation(self, value):
        if value is None:
            return None

        def lists(item):
            return [lists(value) for value in item] if isinstance(item, (list, tuple)) else item

        return {"type": value.geom_type, "coordinates": lists(value.coords)}


class PropertySerializer(serializers.ModelSerializer):
    location = GeoJSONGeometryField(geometry_type="Point")
    boundary = GeoJSONGeometryField(geometry_type="Polygon", allow_null=True, required=True)
    area_sqm = serializers.SerializerMethodField()
    perimeter_m = serializers.SerializerMethodField()
    centroid = serializers.SerializerMethodField()
    bounding_box = serializers.SerializerMethodField()

    class Meta:
        model = Property
        fields = [
            "id", "name", "email", "phone_number", "property_name", "address", "state", "country",
            "location", "boundary", "area_sqm", "perimeter_m", "centroid", "bounding_box", "created_at",
        ]
        read_only_fields = ["id", "area_sqm", "perimeter_m", "centroid", "bounding_box", "created_at"]
        extra_kwargs = {
            field: {"required": True, "allow_blank": False}
            for field in ("name", "email", "phone_number", "property_name", "address", "state", "country")
        }

    def validate_phone_number(self, value):
        value = value.strip()
        if any(character not in set("+0123456789-() .") for character in value):
            raise serializers.ValidationError("Enter a valid phone number.")
        digits = sum(character.isdigit() for character in value)
        if digits < 7 or digits > 15:
            raise serializers.ValidationError("Phone number must contain 7 to 15 digits.")
        return value

    def validate(self, attrs):
        location = attrs.get("location", getattr(self.instance, "location", None))
        boundary = attrs.get("boundary", getattr(self.instance, "boundary", None))
        if boundary is None:
            raise serializers.ValidationError({"boundary": "Draw a property boundary before saving."})
        ring = boundary.exterior_ring
        if ring.num_coords < 4 or len(set(ring.coords[:-1])) < 3:
            raise serializers.ValidationError({"boundary": "Boundary requires at least three unique vertices."})
        if not boundary.valid or boundary.empty or boundary.area <= 0:
            raise serializers.ValidationError({"boundary": "Boundary must be a valid, non-self-intersecting polygon."})
        if location and not boundary.covers(location):
            raise serializers.ValidationError({"boundary": "Boundary must contain the selected property point."})
        return attrs

    def get_area_sqm(self, obj):
        if not obj.boundary:
            return None
        value = Property.objects.filter(pk=obj.pk).annotate(metric=Area("boundary")).values_list("metric", flat=True).first()
        return round(value.sq_m, 2) if value else None

    def get_perimeter_m(self, obj):
        if not obj.boundary:
            return None
        value = Property.objects.filter(pk=obj.pk).annotate(metric=Perimeter("boundary")).values_list("metric", flat=True).first()
        return round(value.m, 2) if value else None

    def get_centroid(self, obj):
        if not obj.boundary:
            return None
        centroid = obj.boundary.centroid
        return {"type": "Point", "coordinates": [round(centroid.x, 7), round(centroid.y, 7)]}

    def get_bounding_box(self, obj):
        if not obj.boundary:
            return None
        xmin, ymin, xmax, ymax = obj.boundary.extent
        return {"west": xmin, "south": ymin, "east": xmax, "north": ymax}


class LegacyCustomerPropertySerializer(serializers.ModelSerializer):
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, write_only=True)
    longitude = serializers.DecimalField(max_digits=10, decimal_places=6, write_only=True)

    class Meta:
        model = Property
        fields = [
            "id", "name", "email", "phone_number", "property_name", "address", "state", "country",
            "latitude", "longitude", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        latitude = validated_data.pop("latitude")
        longitude = validated_data.pop("longitude")
        return Property.objects.create(
            **validated_data,
            location=GEOSGeometry(f"POINT ({longitude} {latitude})", srid=4326),
        )

    def to_representation(self, instance):
        result = super().to_representation(instance)
        result["latitude"] = f"{instance.location.y:.6f}"
        result["longitude"] = f"{instance.location.x:.6f}"
        return result

    def validate_phone_number(self, value):
        return PropertySerializer().validate_phone_number(value)
