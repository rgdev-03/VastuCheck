from django.contrib import admin

from .models import Property, PropertyAnalysis


@admin.register(Property)
class PropertyAdmin(admin.ModelAdmin):
    list_display = ("name", "property_name", "email", "state", "country", "created_at")
    search_fields = ("name", "email", "property_name", "address")


admin.site.register(PropertyAnalysis)

