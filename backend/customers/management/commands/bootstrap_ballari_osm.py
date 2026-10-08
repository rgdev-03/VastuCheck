from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = "Retired: the Ballari bootstrap was replaced by Mapbox Tilequery."

    def handle(self, *args, **options):
        raise CommandError(
            "This command is retired. Configure MAPBOX_ACCESS_TOKEN for on-demand coverage."
        )
