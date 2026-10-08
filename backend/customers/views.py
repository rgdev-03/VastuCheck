from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Property, PropertyAnalysis
from .serializers import LegacyCustomerPropertySerializer, PropertySerializer
from .services import AnalysisError, analyze_property


class PropertyListCreateView(generics.ListCreateAPIView):
    queryset = Property.objects.all()
    serializer_class = PropertySerializer


class PropertyDetailView(generics.RetrieveUpdateAPIView):
    queryset = Property.objects.all()
    serializer_class = PropertySerializer
    http_method_names = ["get", "patch", "head", "options"]


class LegacyCustomerPropertyListCreateView(generics.ListCreateAPIView):
    queryset = Property.objects.all()
    serializer_class = LegacyCustomerPropertySerializer


class PropertyAnalysisCreateView(APIView):
    def post(self, request, pk):
        property_record = get_object_or_404(Property, pk=pk)
        try:
            radius_m = int(request.data.get("radius_m", 500))
        except (TypeError, ValueError):
            return Response({"radius_m": ["Enter a whole number."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = analyze_property(property_record, radius_m)
        except AnalysisError as error:
            PropertyAnalysis.objects.create(
                property=property_record, radius_m=radius_m, source_versions={}, status="failed",
                failure_detail=str(error), result={},
            )
            return Response({"detail": str(error)}, status=error.status_code)
        analysis = PropertyAnalysis.objects.create(
            property=property_record, radius_m=radius_m, source_versions=result["sources"],
            analysis_version=result["analysis_version"], status=result["status"], result=result,
        )
        return Response(_analysis_response(analysis), status=status.HTTP_201_CREATED)


class PropertySurroundingsView(APIView):
    def get(self, request, pk):
        property_record = get_object_or_404(Property, pk=pk)
        try:
            radius_m = int(request.query_params.get("radius_m", 500))
        except (TypeError, ValueError):
            return Response({"radius_m": ["Enter a whole number."]}, status=status.HTTP_400_BAD_REQUEST)
        analysis = property_record.analyses.filter(status__in=("complete", "partial"), radius_m=radius_m).first()
        if not analysis:
            return Response(
                {"detail": "No analysis exists for this property and radius."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_analysis_response(analysis))


def _analysis_response(analysis):
    response = dict(analysis.result)
    response.update({"analysis_id": analysis.id, "generated_at": analysis.created_at.isoformat()})
    return response
