from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Retired: local GIS imports were replaced by on-demand provider APIs."

    def handle(self, *args, **options):
        raise CommandError(
            "This command is retired. Configure Mapbox and Copernicus Data Space credentials instead."
        )
