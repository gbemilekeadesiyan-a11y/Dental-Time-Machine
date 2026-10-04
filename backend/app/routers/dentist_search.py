"""Find dentists near a ZIP code with the CMS NPI Registry (feature/filters).

- Who and where (name, practice address, specialty) is real NPI Registry data.
- Distance is approximate: from the center of the user's ZIP to the center of the
  practice's ZIP (US Census 2024 ZCTA gazetteer, data/zip_centroids.csv.gz).
- Network status, languages, new patients, openings and referral rules are not in
  the NPI Registry. They are demo data, derived from the NPI number so they stay
  the same between searches, and the UI labels them "Demo".

Privacy: the ZIP is sent to the NPI Registry only as a 4-digit prefix and is never
logged. Every call has an 8 second timeout; if the registry can't be reached the
search returns an empty list with a plain note, never an error.
"""

from __future__ import annotations

import gzip
import hashlib
import math
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any

import httpx

from app.routers.filter_models import FILTER_LANGUAGES, DentistResult, DentistSearchResponse, Specialty

NPI_URL = "https://npiregistry.cms.hhs.gov/api/"
TIMEOUT_SECONDS = 8
NPI_PAGE = 200  # The registry's largest page.
MAX_PREFIXES = 16  # 4-digit ZIP prefixes queried per search.
MAX_RESULTS = 400
MAX_PAGES = 2  # A busy prefix gets a second page.
CACHE_SECONDS = 10 * 60
EARTH_RADIUS_MILES = 3958.8

UNAVAILABLE_NOTE = "We couldn't reach the dentist directory right now. Please try again in a moment."
PARTIAL_NOTE = "Part of the dentist directory didn't answer, so some nearby dentists may be missing."

CENTROIDS_FILE = Path(__file__).parent / "data" / "zip_centroids.csv.gz"

# NPI taxonomy descriptions to our specialties. Checked in order; "Dentist" alone is general practice.
_TAXONOMY: list[tuple[str, Specialty, str]] = [
    ("pediatric", "pediatric", "Pediatric dentist"),
    ("endodontics", "endodontics", "Endodontist"),
    ("periodontics", "periodontics", "Periodontist"),
    ("orthodontics", "orthodontics", "Orthodontist"),
    ("oral and maxillofacial surgery", "oral_surgery", "Oral surgeon"),
    ("prosthodontics", "prosthodontics", "Prosthodontist"),
    ("general practice", "general", "General dentist"),
]
# Taxonomies that aren't hands-on patient care (public health, radiology, anesthesia and so on).
_SKIP_WORDS = ("public health", "radiology", "pathology", "anesthesiolog", "residency", "oral medicine", "orofacial")

_SMALL_WORDS = {"of", "and", "the", "at", "for", "in", "on"}
_KEEP_UPPER = {"DDS", "DMD", "MS", "MSD", "PA", "PC", "PLLC", "LLC", "II", "III", "IV", "NE", "NW", "SE", "SW", "PO"}


class SearchError(ValueError):
    """Bad input the user can fix (unknown ZIP). The route turns it into a plain 422."""


# ---------- ZIP centroids and distance ----------


@lru_cache(maxsize=1)
def zip_centroids() -> dict[str, tuple[float, float]]:
    with gzip.open(CENTROIDS_FILE, "rt") as f:
        next(f)
        rows = (line.rstrip("\n").split(",") for line in f)
        return {z: (float(lat), float(lon)) for z, lat, lon in rows}


def miles_between(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Great-circle distance in miles (haversine)."""
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * math.asin(math.sqrt(h))


def prefixes_within(zip_code: str, radius_miles: float) -> list[str]:
    """4-digit ZIP prefixes with any ZIP inside the radius, nearest first, capped."""
    centroids = zip_centroids()
    origin = centroids.get(zip_code)
    if origin is None:
        raise SearchError("We couldn't find that ZIP code. Check the five digits and try again.")
    nearest: dict[str, float] = {}
    for z, point in centroids.items():
        d = miles_between(origin, point)
        if d <= radius_miles:
            prefix = z[:4]
            nearest[prefix] = min(d, nearest.get(prefix, d))
    nearest.setdefault(zip_code[:4], 0.0)
    return sorted(nearest, key=lambda p: (nearest[p], p))[:MAX_PREFIXES]


# ---------- NPI Registry ----------

_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}


def _fetch_prefix(prefix: str) -> list[dict[str, Any]]:
    """Dentists whose practice location ZIP starts with this prefix. Cached for 10 minutes."""
    cached = _cache.get(prefix)
    if cached and time.monotonic() - cached[0] < CACHE_SECONDS:
        return cached[1]
    results: list[dict[str, Any]] = []
    for page in range(MAX_PAGES):
        response = httpx.get(
            NPI_URL,
            params={
                "version": "2.1",
                "postal_code": f"{prefix}*",
                "address_purpose": "LOCATION",
                "taxonomy_description": "dentist",
                "limit": NPI_PAGE,
                "skip": page * NPI_PAGE,
            },
            timeout=TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        batch = response.json().get("results") or []
        results.extend(batch)
        if len(batch) < NPI_PAGE:
            break
    _cache[prefix] = (time.monotonic(), results)
    return results


def _title(text: str) -> str:
    words = []
    for word in text.split():
        if word.upper().replace(".", "").strip(",") in _KEEP_UPPER:
            words.append(word.upper())
        elif word.lower() in _SMALL_WORDS and words:
            words.append(word.lower())
        else:
            words.append(word.capitalize())
    return " ".join(words)


def _specialty(record: dict[str, Any]) -> tuple[Specialty, str] | None:
    taxonomies = [t for t in record.get("taxonomies") or [] if "dentist" in str(t.get("desc", "")).lower()]
    taxonomies.sort(key=lambda t: not t.get("primary"))
    for t in taxonomies:
        desc = str(t.get("desc", "")).lower()
        if any(word in desc for word in _SKIP_WORDS):
            continue
        for needle, specialty, label in _TAXONOMY:
            if needle in desc:
                return specialty, label
        if desc.strip() == "dentist":
            return "general", "General dentist"
    return None


def _name(record: dict[str, Any]) -> str | None:
    basic = record.get("basic") or {}
    if record.get("enumeration_type") == "NPI-2":
        name = basic.get("organization_name")
        return _title(name) if name else None
    first, last = basic.get("first_name"), basic.get("last_name")
    if not (first and last):
        return None
    name = f"{_title(first)} {_title(last)}"
    credential = str(basic.get("credential") or "").replace(".", "").upper().strip()
    return f"{name}, {credential}" if credential in {"DDS", "DMD"} else f"Dr. {name}"


def _location(record: dict[str, Any]) -> dict[str, Any] | None:
    for address in record.get("addresses") or []:
        if address.get("address_purpose") == "LOCATION":
            return address
    return None


def _demo_number(npi: str, salt: str) -> int:
    """A stable number from the NPI, so demo fields don't change between searches."""
    return int(hashlib.sha256(f"{salt}:{npi}".encode()).hexdigest()[:8], 16)


def _demo_fields(npi: str, specialty: Specialty, today: date) -> dict[str, Any]:
    languages = ["English"]
    extra = _demo_number(npi, "lang") % 10
    if extra < len(FILTER_LANGUAGES) - 1:
        languages.append(FILTER_LANGUAGES[1 + extra])  # About 1 in 2 speak a second language.
    # General and pediatric dentists don't usually need a referral; specialists vary by plan.
    no_referral = specialty in ("general", "pediatric") or _demo_number(npi, "ref") % 3 == 0
    return {
        "in_network": _demo_number(npi, "net") % 10 < 6,
        "languages": languages,
        "accepting_new": _demo_number(npi, "new") % 4 != 0,
        "next_available": (today + timedelta(days=_demo_number(npi, "open") % 15)).isoformat(),
        "no_referral_required": no_referral,
    }


def to_dentist(record: dict[str, Any], origin: tuple[float, float], today: date) -> DentistResult | None:
    """One NPI record as a DentistResult, or None when it isn't a usable dentist listing."""
    npi = str(record.get("number") or "")
    specialty = _specialty(record)
    name = _name(record)
    location = _location(record)
    if not (len(npi) == 10 and npi.isdigit() and specialty and name and location):
        return None
    zip5 = str(location.get("postal_code") or "")[:5]
    point = zip_centroids().get(zip5)
    if point is None:
        return None
    street = _title(str(location.get("address_1") or ""))
    city = _title(str(location.get("city") or ""))
    address = f"{street}, {city}, {location.get('state', '')} {zip5}".strip(", ")
    return DentistResult(
        npi=npi,
        name=name[:200],
        address=address[:200],
        distance_miles=round(miles_between(origin, point), 1),
        specialty=specialty[0],
        specialty_label=specialty[1],
        **_demo_fields(npi, specialty[0], today),
    )


def search_dentists(zip_code: str, radius_miles: float, today: date | None = None) -> DentistSearchResponse:
    """Dentists within radius_miles of zip_code, nearest first."""
    prefixes = prefixes_within(zip_code, radius_miles)
    origin = zip_centroids()[zip_code]
    today = today or date.today()

    records: list[dict[str, Any]] = []
    failed = 0
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = [pool.submit(_fetch_prefix, p) for p in prefixes]
        for future in futures:
            try:
                records.extend(future.result())
            except (httpx.HTTPError, ValueError):
                failed += 1

    if failed == len(prefixes):
        return DentistSearchResponse(dentists=[], source="unavailable", note=UNAVAILABLE_NOTE)

    seen: set[str] = set()
    dentists: list[DentistResult] = []
    for record in records:
        dentist = to_dentist(record, origin, today)
        if dentist is None or dentist.npi in seen or dentist.distance_miles > radius_miles:
            continue
        seen.add(dentist.npi)
        dentists.append(dentist)
    dentists.sort(key=lambda d: (d.distance_miles, d.name))
    return DentistSearchResponse(
        dentists=dentists[:MAX_RESULTS],
        source="npi",
        note=PARTIAL_NOTE if failed else None,
    )
