from django.contrib import admin

from .models import CustomerProperty


@admin.register(CustomerProperty)
class CustomerPropertyAdmin(admin.ModelAdmin):
    list_display = ("name", "property_name", "email", "state", "country", "created_at")
    search_fields = ("name", "email", "property_name", "address")

