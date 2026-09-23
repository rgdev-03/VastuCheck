from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class CustomerProperty(models.Model):
    name = models.CharField(max_length=150)
    email = models.EmailField(max_length=254)
    phone_number = models.CharField(max_length=32)
    property_name = models.CharField(max_length=150)
    address = models.TextField()
    state = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    latitude = models.DecimalField(
        max_digits=9,
        decimal_places=6,
        validators=[MinValueValidator(-90), MaxValueValidator(90)],
    )
    longitude = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        validators=[MinValueValidator(-180), MaxValueValidator(180)],
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.name} — {self.property_name}"

