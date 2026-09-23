from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import CustomerProperty


def payload(**overrides):
    data = {
        "name": "Asha Rao",
        "email": "asha@example.com",
        "phone_number": "+91 98765 43210",
        "property_name": "Lake House",
        "address": "1 Main Street, Bengaluru",
        "state": "Karnataka",
        "country": "India",
        "latitude": "12.971599",
        "longitude": "77.594566",
    }
    data.update(overrides)
    return data


class CustomerPropertyApiTests(APITestCase):
    url = reverse("customer-list-create")

    def test_create_customer_property(self):
        response = self.client.post(self.url, payload(), format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        record = CustomerProperty.objects.get()
        self.assertEqual(record.latitude, Decimal("12.971599"))
        self.assertEqual(response.data["longitude"], "77.594566")

    def test_all_business_fields_are_required(self):
        for field in payload():
            invalid = payload()
            invalid.pop(field)
            response = self.client.post(self.url, invalid, format="json")
            self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST, field)
            self.assertIn(field, response.data)

    def test_rejects_invalid_email_and_coordinates(self):
        response = self.client.post(
            self.url,
            payload(email="not-an-email", latitude="90.000001", longitude="-180.000001"),
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(set(response.data), {"email", "latitude", "longitude"})

    def test_allows_same_email_for_multiple_properties(self):
        first = self.client.post(self.url, payload(), format="json")
        second = self.client.post(
            self.url,
            payload(property_name="City Flat", address="2 Market Road"),
            format="json",
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(CustomerProperty.objects.count(), 2)

    def test_list_returns_newest_first(self):
        first = self.client.post(self.url, payload(property_name="First"), format="json")
        second = self.client.post(self.url, payload(property_name="Second"), format="json")
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [second.data["id"], first.data["id"]])
