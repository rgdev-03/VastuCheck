from django.urls import path

from .views import (
    LegacyCustomerPropertyListCreateView,
    PropertyAnalysisCreateView,
    PropertyDetailView,
    PropertyListCreateView,
    PropertySurroundingsView,
)


urlpatterns = [
    path("properties/", PropertyListCreateView.as_view(), name="property-list-create"),
    path("properties/<int:pk>/", PropertyDetailView.as_view(), name="property-detail"),
    path("properties/<int:pk>/analyses/", PropertyAnalysisCreateView.as_view(), name="property-analysis-create"),
    path("properties/<int:pk>/surroundings/", PropertySurroundingsView.as_view(), name="property-surroundings"),
    path("customers/", LegacyCustomerPropertyListCreateView.as_view(), name="customer-list-create"),
]

