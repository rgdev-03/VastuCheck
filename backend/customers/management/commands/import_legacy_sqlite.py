import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from customers.models import Property


class Command(BaseCommand):
    help = "Import legacy customer properties from the former SQLite database into PostGIS."

    def add_arguments(self, parser):
        parser.add_argument("sqlite_path", type=Path)
        parser.add_argument("--backup", action="store_true", help="Create a timestamp-free .backup copy before reading.")

    def handle(self, *args, **options):
        path = options["sqlite_path"].resolve()
        if not path.is_file():
            raise CommandError(f"SQLite database does not exist: {path}")
        if options["backup"]:
            backup = path.with_suffix(path.suffix + ".backup")
            if backup.exists():
                raise CommandError(f"Backup already exists: {backup}")
            shutil.copy2(path, backup)
            self.stdout.write(f"Created backup: {backup}")

        source = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
        source.row_factory = sqlite3.Row
        try:
            rows = source.execute(
                "SELECT id, name, email, phone_number, property_name, address, state, country, "
                "latitude, longitude, created_at FROM customers_customerproperty ORDER BY id"
            ).fetchall()
        except sqlite3.DatabaseError as error:
            raise CommandError(f"Could not read the legacy property table: {error}") from error
        finally:
            source.close()

        imported = 0
        for row in rows:
            defaults = {
                "name": row["name"], "email": row["email"], "phone_number": row["phone_number"],
                "property_name": row["property_name"], "address": row["address"], "state": row["state"],
                "country": row["country"],
                "location": Point(float(row["longitude"]), float(row["latitude"]), srid=4326),
            }
            record, created = Property.objects.update_or_create(id=row["id"], defaults=defaults)
            created_at = datetime.fromisoformat(row["created_at"])
            if timezone.is_naive(created_at):
                created_at = timezone.make_aware(created_at, timezone.get_current_timezone())
            Property.objects.filter(pk=record.pk).update(created_at=created_at)
            imported += int(created)

        self.stdout.write(self.style.SUCCESS(
            f"Verified {len(rows)} legacy rows; created {imported}; target total is {Property.objects.count()}."
        ))
