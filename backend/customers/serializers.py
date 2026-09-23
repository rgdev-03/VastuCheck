from rest_framework import serializers

from .models import CustomerProperty


class CustomerPropertySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerProperty
        fields = [
            "id", "name", "email", "phone_number", "property_name", "address",
            "state", "country", "latitude", "longitude", "created_at",
        ]
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {
            field: {"required": True, "allow_blank": False}
            for field in (
                "name", "email", "phone_number", "property_name", "address", "state", "country",
            )
        }

    def validate_phone_number(self, value):
        value = value.strip()
        allowed = set("+0123456789-() .")
        if any(character not in allowed for character in value):
            raise serializers.ValidationError("Enter a valid phone number.")
        digits = sum(character.isdigit() for character in value)
        if digits < 7 or digits > 15:
            raise serializers.ValidationError("Phone number must contain 7 to 15 digits.")
        return value

