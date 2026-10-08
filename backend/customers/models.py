from django.contrib.gis.db import models


class Property(models.Model):
    name = models.CharField(max_length=150)
    email = models.EmailField(max_length=254)
    phone_number = models.CharField(max_length=32)
    property_name = models.CharField(max_length=150)
    address = models.TextField()
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    location = models.PointField(geography=True, srid=4326)
    boundary = models.PolygonField(geography=True, srid=4326, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.name} — {self.property_name}"


class PropertyAnalysis(models.Model):
    STATUS_CHOICES = [("complete", "Complete"), ("partial", "Partial"), ("failed", "Failed")]

    property = models.ForeignKey(Property, related_name="analyses", on_delete=models.CASCADE)
    analysis_version = models.CharField(max_length=20, default="1.0")
    radius_m = models.PositiveIntegerField()
    source_versions = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)
    failure_detail = models.TextField(blank=True)
    result = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

