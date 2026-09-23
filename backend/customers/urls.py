from django.urls import path

from .views import CustomerPropertyListCreateView


urlpatterns = [
    path("customers/", CustomerPropertyListCreateView.as_view(), name="customer-list-create"),
]

