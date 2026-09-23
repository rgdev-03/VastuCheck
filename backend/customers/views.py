from rest_framework import generics

from .models import CustomerProperty
from .serializers import CustomerPropertySerializer


class CustomerPropertyListCreateView(generics.ListCreateAPIView):
    queryset = CustomerProperty.objects.all()
    serializer_class = CustomerPropertySerializer

