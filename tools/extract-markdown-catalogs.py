#!/usr/bin/env python3
"""Destila los catálogos de `markdown_convertidos/` a `data/`.

## Por qué existe

`tools/extract-bolivia-institutions.py` descartó las versiones `.md` de las
planillas del propietario porque las que había entonces estaban en UTF-16 mal
convertido. Las de `markdown_convertidos/` **sí se leen**, y con ellas quedaron
afuera de la maqueta cuatro listas que el propietario pidió ver:

- **La red médica de Alianza Seguros** (`Alianza_Medicos_Habilitados.md`) y la
  de **Nacional Seguros** (`Nacional_Seguros_Red_Medica_Bolivia.md`): los
  médicos que cada aseguradora publica como habilitados, con su consultorio.
  El directorio de la maqueta, mientras tanto, mostraba 45 médicos inventados.
- **El arancel de honorarios médicos de Santa Cruz 2025** (Colegio Médico,
  en UMA) y **el arancel odontológico 2026** (en dólares). El nomenclador de
  la maqueta eran veinte prestaciones inventadas en bolivianos.

## Lo que NO hace

- **No corrige el texto.** El arancel médico viene de un PDF escaneado con
  OCR (su propia hoja «Referencia» lo advierte). Una fila dañada viaja como
  está y marcada `ocrSuspect`; corregirla a ojo sería inventar el nombre de
  una prestación.
- **No copia datos personales sensibles.** De `USUARIO_MEDICOS_1.md` y
  `USUARIO_PACIENTES_1.md` entran **todas las personas**, pero no su cédula,
  fecha de nacimiento, celular, correo ni domicilio: son personas reales —hay
  menores— y el repositorio del front es **público**.
- **No inventa puntos.** Cada punto sale de una clínica ya geolocalizada que la
  dirección nombra, de Nominatim (con caché versionada en `geocache.json`) o
  del centro de la localidad, y viaja con su `precision`.

Uso:
    python3 tools/extract-markdown-catalogs.py <carpeta markdown_convertidos>
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path
from typing import Any

NETWORK_DIR = Path("data") / "insurer-networks"
FEE_DIR = Path("data") / "fee-schedules"
INSTITUTIONS_DIR = Path("data") / "bolivia-instituciones"

ALIANZA_FILE = "Alianza_Medicos_Habilitados.md"
NACIONAL_FILE = "Nacional_Seguros_Red_Medica_Bolivia.md"
MEDICAL_FEE_FILE = "Arancel_Honorarios_Medicos_Santa_Cruz_2025_3_columnas.md"
DENTAL_FEE_FILE = "LISTADO_ARANCEL_ODONTOLOGICO_2026_1.md"

INSTITUTIONS_OUT_DIR = Path("data") / "markdown-institutions"
PEOPLE_DIR = Path("data") / "registered-people"
GEOCACHE = Path("data") / "markdown-institutions" / "geocache.json"

PHARMACY_FILE = "LISTA_DE_FARMACIAS__LABORATORIOS_Y_ANALISIS_MEDICOS.md"
PRACTITIONER_USERS_FILE = "USUARIO_MEDICOS_1.md"
PATIENT_USERS_FILE = "USUARIO_PACIENTES_1.md"
PRIMARY_CARE_FILE = "LISTA_DE_HOSPITAL_DE_PRIMER_NIVEL_SANTA_CRUZ_1.md"

# El centro de Santa Cruz de la Sierra: la plaza 24 de Septiembre.
CITY_CENTER = {"lat": -17.7834, "lng": -63.1821}

# Cada localidad que declara la red, con el municipio al que pertenece.
# Arroyo Concepción es una localidad de Puerto Quijarro y Yacuses una de Puerto
# Suárez; el consultorio conserva el nombre de la localidad y se ubica en ella.
KNOWN_TOWNS = {
    "SANTA CRUZ": ("Santa Cruz de la Sierra", "Santa Cruz de la Sierra"),
    "SANTA CRUZ - MONTERO": ("Montero", "Montero"),
    "SANTA CRUZ - PUERTO QUIJARRO": ("Puerto Quijarro", "Puerto Quijarro"),
    "SANTA CRUZ - PUERTO SUAREZ": ("Puerto Suárez", "Puerto Suárez"),
    "SANTA CRUZ - ARROYO CONCEPCION": ("Arroyo Concepción", "Puerto Quijarro"),
    "SANTA CRUZ - YACUSES": ("Yacuses", "Puerto Suárez"),
}

# ---- geocodificación, con caché versionada ----------------------------------
# Nominatim es el mismo proveedor que ya usan los mapas del producto. Cada
# respuesta se guarda en `geocache.json`, que se versiona: regenerar no depende
# de la red y da siempre los mismos puntos.

_geocache: dict[str, dict | None] | None = None


def _cache() -> dict[str, dict | None]:
    global _geocache
    if _geocache is None:
        loaded: dict[str, dict | None] = (
            json.loads(GEOCACHE.read_text(encoding="utf-8")) if GEOCACHE.exists() else {}
        )
        _geocache = loaded
        return loaded
    return _geocache


def geocode(query: str) -> dict | None:
    """El punto de `query` según Nominatim, o `None` si no lo reconoce."""
    cache = _cache()
    if query in cache:
        return cache[query]
    import subprocess
    import time
    import urllib.parse

    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": query, "format": "json", "limit": 1, "countrycodes": "bo"}
    )
    time.sleep(1.1)  # la política de uso de Nominatim: una consulta por segundo
    # `curl` y no `urllib`: el Python de python.org en macOS no trae los
    # certificados raíz y la consulta muere en CERTIFICATE_VERIFY_FAILED.
    body = subprocess.run(
        ["curl", "-sS", "-m", "20", "-A", "alovida-mockup-catalogs/1.0", url],
        check=True, capture_output=True, text=True,
    ).stdout
    found = json.loads(body)
    cache[query] = {"lat": float(found[0]["lat"]), "lng": float(found[0]["lon"])} if found else None
    GEOCACHE.parent.mkdir(parents=True, exist_ok=True)
    GEOCACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return cache[query]


def town_point(town: str) -> dict:
    """El centro de una localidad de Santa Cruz. Falla si no se encuentra."""
    point = geocode(f"{town}, Santa Cruz, Bolivia")
    if point is None:
        raise SystemExit(f"Nominatim no reconoce la localidad «{town}»")
    return point

# Palabras que no distinguen a una institución de otra.
GENERIC_WORDS = {
    "CLINICA", "HOSPITAL", "INSTITUTO", "CENTRO", "MEDICO", "MEDICA", "DE", "DEL",
    "LA", "LAS", "LOS", "EL", "Y", "S", "A", "SA", "SRL", "DR", "DRA",
}


def ascii_upper(text: str) -> str:
    plain = unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode()
    return " ".join(plain.upper().split())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def split_row(line: str) -> list[str]:
    """Parte una fila de tabla markdown respetando los `\\|` escapados."""
    inner = line.strip().strip("|")
    cells = re.split(r"(?<!\\)\|", inner)
    return [cell.strip().replace("\\|", "|") for cell in cells]


def table_rows(path: Path, stop_at_heading: str | None = None) -> list[list[str]]:
    rows: list[list[str]] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if stop_at_heading is not None and line.startswith("## ") and stop_at_heading in line:
            break
        if line.startswith("|") and not line.startswith("| ---"):
            rows.append(split_row(line))
    return rows


def title_case(text: str) -> str:
    lower_words = {"de", "del", "la", "las", "los", "y", "e"}
    words = text.lower().split()
    return " ".join(
        w if i > 0 and w in lower_words else w[:1].upper() + w[1:]
        for i, w in enumerate(words)
    )


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", ascii_upper(text).lower()).strip("-")


# ---- red médica de las aseguradoras ---------------------------------------


def clean_specialty(raw: str) -> str:
    """`FISIOTERAPIA Y REHABILITACIONVACA` → `FISIOTERAPIA Y REHABILITACION`.

    Es un defecto de la conversión: el primer apellido quedó pegado a la
    especialidad. El nombre completo sigue entero en su columna.
    """
    return re.sub(r"^(FISIOTERAPIA Y REHABILITACION)[A-Z]+$", r"\1", ascii_upper(raw))


def split_phones(raw: str) -> list[str]:
    return [p for p in re.split(r"[\s/,;-]+", raw) if re.fullmatch(r"\d{7,9}", p)]


def split_name(raw: str) -> dict:
    """Separa apellidos de nombres.

    Alianza escribe `APELLIDOS, NOMBRES`: la coma decide. Nacional escribe todo
    seguido, y ahí la división es una convención —dos apellidos y el resto
    nombres— que se declara en `nameSplit` para que nadie la tome por dato.
    """
    if "," in raw:
        surnames, given = (part.strip() for part in raw.split(",", 1))
        return {"surnames": title_case(surnames), "givenNames": title_case(given), "nameSplit": "source"}
    tokens = raw.split()
    joined: list[str] = []
    particle = ""
    for token in tokens:
        if token.upper() in {"DE", "DEL", "LA", "LAS", "LOS"}:
            particle += token + " "
            continue
        joined.append(particle + token)
        particle = ""
    surname_count = 1 if len(joined) <= 2 else 2
    return {
        "surnames": title_case(" ".join(joined[:surname_count])),
        "givenNames": title_case(" ".join(joined[surname_count:])),
        "nameSplit": "heuristic",
    }


def institution_points() -> list[dict]:
    """Las clínicas y hospitales ya geolocalizados, con sus palabras distintivas."""
    locations = json.loads((INSTITUTIONS_DIR / "locations.json").read_text(encoding="utf-8"))
    points = []
    for name in ("clinics", "hospitals"):
        for item in json.loads((INSTITUTIONS_DIR / f"{name}.json").read_text(encoding="utf-8")):
            where = locations.get(item["id"])
            if where is None or where["precision"] == "ciudad":
                continue
            words = {w for w in re.findall(r"[A-Z]+", ascii_upper(item["name"])) if w not in GENERIC_WORDS}
            if words:
                points.append({"id": item["id"], "name": item["name"], "words": words, **where})
    return points


def locate(address: str, points: list[dict], town: str = "Santa Cruz de la Sierra") -> dict:
    """El punto de la institución que la dirección nombra, si la nombra."""
    words = set(re.findall(r"[A-Z]+", ascii_upper(address)))
    names_an_institution = bool(words & {"CLINICA", "HOSPITAL", "INSTITUTO"})
    if names_an_institution:
        for point in sorted(points, key=lambda p: -len(p["words"])):
            if point["words"] <= words:
                return {"lat": point["lat"], "lng": point["lng"], "precision": "establecimiento", "institutionId": point["id"]}
    center = CITY_CENTER if town == "Santa Cruz de la Sierra" else town_point(town)
    return {**center, "precision": "ciudad", "institutionId": None}


def read_network(path: Path, insurer: str, columns: dict[str, Any], points: list[dict]) -> tuple[list[dict], int]:
    offices: list[dict] = []
    skipped = 0
    for row in table_rows(path)[1:]:
        town = ascii_upper(row[columns["city"]])
        if town not in KNOWN_TOWNS:
            raise SystemExit(f"Localidad nueva en {path.name}: «{row[columns['city']]}». Agregala a KNOWN_TOWNS.")
        city, municipality = KNOWN_TOWNS[town]
        address = row[columns["address"]]
        phones = [p for key in columns["phones"] for p in split_phones(row[key])]
        offices.append({
            "name": ascii_upper(row[columns["name"]]).replace(",", ", ").replace(" ,", ","),
            "rawName": row[columns["name"]],
            "specialty": clean_specialty(row[columns["specialty"]]),
            "plans": [p.strip() for p in row[columns["plans"]].split(",") if p.strip()],
            "insurer": insurer,
            "address": address,
            "city": city,
            "municipality": municipality,
            "phones": phones,
            "sourcePage": row[columns["page"]],
            **locate(address, points, city),
        })
    return offices, skipped


def merge_practitioners(offices: list[dict]) -> list[dict]:
    """Un médico por nombre, con todos sus consultorios, redes y especialidades."""
    by_key: dict[str, dict] = {}
    for office in offices:
        key = office["name"].replace(",", "").replace("  ", " ")
        entry = by_key.get(key)
        if entry is None:
            entry = by_key[key] = {
                "id": f"red-{slugify(key)}",
                **split_name(office["rawName"]),
                "specialties": [],
                "networks": {},
                "offices": [],
            }
        elif entry["nameSplit"] == "heuristic" and "," in office["rawName"]:
            entry.update(split_name(office["rawName"]))
        if office["specialty"] not in entry["specialties"]:
            entry["specialties"].append(office["specialty"])
        plans = entry["networks"].setdefault(office["insurer"], [])
        plans.extend(p for p in office["plans"] if p not in plans)
        same_place = next((o for o in entry["offices"] if ascii_upper(o["address"]) == ascii_upper(office["address"])), None)
        if same_place is None:
            entry["offices"].append({k: office[k] for k in ("address", "city", "municipality", "phones", "lat", "lng", "precision", "institutionId")})
        else:
            same_place["phones"].extend(p for p in office["phones"] if p not in same_place["phones"])
    practitioners = sorted(by_key.values(), key=lambda p: p["id"])
    for p in practitioners:
        p["networks"] = [{"insurer": k, "plans": v} for k, v in sorted(p["networks"].items())]
    return practitioners


# ---- aranceles ------------------------------------------------------------

UMA_PATTERN = re.compile(r"\d+(?:[.,]\d+)?")
# Las huellas que deja el OCR del escaneo: rayas y guiones bajos sueltos,
# comillas tipográficas, barras, «cién» por «ción», dígitos dentro de palabras.
OCR_DAMAGE = re.compile(r"[—_\\“”‘’\[\]|~{}]|ci[eé6]n\b|[a-záéíóúñ]\d|\d[a-záéíóúñ]{2}", re.IGNORECASE)


_fee_counters: dict[str, int] = {}


def fee_code(prefix: str, specialty: str, _number: int = 0) -> str:
    """`SCZ25-TO-0001`: prefijo, iniciales de la especialidad y correlativo.

    El correlativo cuenta por **prefijo e iniciales**, no por especialidad:
    Cardiología y Cirugía General comparten la «C» y, contando por
    especialidad, 542 códigos salían repetidos.
    """
    initials = "".join(w[0] for w in re.findall(r"[A-Z]+", ascii_upper(specialty)) if w not in GENERIC_WORDS)[:4]
    key = f"{prefix}-{initials or 'GEN'}"
    _fee_counters[key] = _fee_counters.get(key, 0) + 1
    return f"{key}-{_fee_counters[key]:04d}"


def read_medical_fees(path: Path) -> list[dict]:
    """Todas las filas de la hoja «Base de datos», sin excepción.

    Una fila sana tiene tres celdas —especialidad, procedimiento, UMA—. El OCR
    partió algunas en más celdas o dejó la UMA vacía: esas **también entran**,
    con el texto unido tal como vino, la UMA si la última celda es un número y
    `ocrSuspect` en verdadero, para que la pantalla avise antes de importarla.
    """
    items = []
    counters: dict[str, int] = {}
    for row in table_rows(path, stop_at_heading="Referencia")[1:]:
        specialty = row[0]
        last = row[-1] if len(row) > 2 else ""
        has_uma = bool(UMA_PATTERN.fullmatch(last))
        middle = row[1:-1] if len(row) > 2 else row[1:]
        display = " | ".join(cell for cell in middle if cell)
        if not has_uma and last and len(row) > 2:
            display = f"{display} | {last}" if display else last
        clean = len(row) == 3 and has_uma
        counters[specialty] = counters.get(specialty, 0) + 1
        items.append({
            "code": fee_code("SCZ25", specialty, counters[specialty]),
            "display": display,
            "specialty": specialty,
            "referencePrice": last.replace(",", ".") if has_uma else None,
            "priceUnit": "UMA" if has_uma else None,
            "ocrSuspect": not clean or len(display) < 6 or bool(OCR_DAMAGE.search(display)),
        })
    return items


DENTAL_SECTIONS = {
    "DIAGNOSTICO": "Diagnóstico",
    "RADIOLOGIA": "Radiología",
    "PREVENCION": "Prevención",
    "ODONTOPEDIATRIA": "Odontopediatría",
    "DENTISTICA OPERATORIA": "Dentística operatoria",
    "ENDODONCIA": "Endodoncia",
    "PERIODONCIA": "Periodoncia",
    "PROTESIS Y/O REHABILITACION ORAL": "Prótesis y rehabilitación oral",
    "CIRUGIA": "Cirugía",
    "ARMONIZACION OROFACIAL": "Armonización orofacial",
}

ITEM_START = re.compile(r"^(\d+|[a-z])\)\s*")


def read_dental_fees(path: Path) -> tuple[list[dict], list[dict]]:
    """Las prestaciones y las observaciones de cada sección."""
    section = None
    raw: list[dict] = []
    notes: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            section = DENTAL_SECTIONS[ascii_upper(line[3:])]
            continue
        text = line.strip()
        if section is not None and text and not text.startswith("|") and not text.startswith("#"):
            # «*Observ. …*» y el renglón que la continúa: notas de la sección.
            plain = text.strip("*").strip()
            if text.startswith("*") or not notes or notes[-1]["section"] != section:
                notes.append({"section": f"Odontología · {section}", "text": plain})
            else:
                notes[-1]["text"] += " " + plain
            continue
        if section is None or not line.startswith("|") or line.startswith("| ---"):
            continue
        concept, price = split_row(line)[:2]
        if concept == "Concepto":
            continue
        if not ITEM_START.match(concept) and raw:
            # La fila siguiente continúa la anterior: la tabla partió una frase.
            raw[-1]["display"] += " " + concept
            raw[-1]["price"] = raw[-1]["price"] or price
            continue
        raw.append({"section": section, "display": concept, "price": price, "letter": bool(re.match(r"^[a-z]\)", concept))})
    items = []
    counters: dict[str, int] = {}
    group: str | None = None
    for i, entry in enumerate(raw):
        next_is_sub_item = i + 1 < len(raw) and raw[i + 1]["letter"] and not entry["letter"]
        if next_is_sub_item:
            # «1) Examen clínico.» no es una prestación: es el título de a), b),
            # c)… y viaja como su grupo.
            group = ITEM_START.sub("", entry["display"]).rstrip(".").strip()
            continue
        if not entry["letter"]:
            group = None
        counters[entry["section"]] = counters.get(entry["section"], 0) + 1
        items.append({
            "code": fee_code("ODO26", entry["section"], counters[entry["section"]]),
            "display": ITEM_START.sub("", entry["display"]).rstrip(" 0").strip(),
            "specialty": f"Odontología · {entry['section']}",
            "group": group,
            # Sin precio en la planilla es `null`: «no publicado», nunca cero.
            "referencePrice": entry["price"] or None,
            "priceUnit": "USD" if entry["price"] else None,
            "ocrSuspect": False,
        })
    return items, notes


# ---- farmacias, laboratorios y centros de análisis --------------------------

# La planilla trae tres tablas bajo tres títulos `#`. El tipo sale del título,
# no del nombre del negocio.
PHARMACY_SECTIONS = {
    "LISTA DE FARMACIAS": "PHARMACY",
    "LISTA DE LABORATORIOS DE SANGRE": "LABORATORY",
    "LISTA DE ANALISIS CLINICOS": "DIAGNOSTIC_CENTER",
}


def point_for_address(address: str | None, town: str = "Santa Cruz de la Sierra") -> dict:
    """El punto de una dirección; si Nominatim no la reconoce, el de la ciudad."""
    if address:
        found = geocode(f"{address}, {town}, Bolivia")
        if found is None:
            # Segundo intento con la calle y el número, sin las aclaraciones
            # entre paréntesis ni las esquinas, que Nominatim no entiende.
            street = re.sub(r"\(.*?\)", "", address).split(",")[0]
            street = re.sub(r"\s+", " ", street.replace("N°", "").replace("#", "")).strip(" .")
            found = geocode(f"{street}, {town}, Bolivia")
        if found is not None:
            return {**found, "precision": "direccion"}
    center = CITY_CENTER if town == "Santa Cruz de la Sierra" else town_point(town)
    return {**center, "precision": "ciudad"}


def read_pharmacies_and_labs(path: Path) -> list[dict]:
    kind = None
    items: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("# "):
            kind = PHARMACY_SECTIONS[ascii_upper(line[2:])]
            continue
        if kind is None or not line.startswith("|") or line.startswith("| ---"):
            continue
        name, legal_name, tax_id, phone, address = (split_row(line) + [""] * 5)[:5]
        if name == "NOMBRE COMERCIAL":
            continue
        items.append({
            "id": f"{kind.lower()}-{slugify(name)}",
            "kind": kind,
            "name": name,
            "legalName": legal_name or None,
            "taxId": tax_id or None,
            "phone": phone or None,
            "address": address or None,
            "city": "Santa Cruz de la Sierra",
            **point_for_address(address or None),
        })
    return items


# ---- centros de salud de primer nivel --------------------------------------


def read_primary_care(path: Path) -> list[dict]:
    """Los 464 centros, ubicados en el centro de su municipio.

    La planilla trae dirección rural («COMUNIDAD DE SAN ANDRES»), que Nominatim
    no resuelve; el municipio sí. El punto dice que es el del municipio.
    """
    items = []
    for row in table_rows(path)[1:]:
        department, municipality, name, address = (row + [""] * 4)[:4]
        town = title_case(municipality)
        center = town_point(re.sub(r"\(.*?\)", "", town).strip())
        items.append({
            "id": f"pn-{slugify(municipality)}-{slugify(name)}",
            "name": title_case(name),
            "address": address or None,
            "municipality": town,
            "department": title_case(department),
            **center,
            "precision": "municipio",
        })
    return items


# ---- los usuarios del propietario ------------------------------------------
# Las planillas traen cédula, fecha de nacimiento, celular, correo y domicilio
# de personas reales —hay menores de edad—, y este repositorio es público. De
# esas columnas no se copia nada: se cuentan, para que se sepa que existen.

WITHHELD_COLUMNS = {
    "FECHA NACIMIENTO", "CEDULA IDENTIDAD", "EMITIDO", "NUMERO CELULAR",
    "CORREO ELECTRONICO", "DIRECCION",
}


def read_people(path: Path) -> tuple[list[dict], dict[str, int]]:
    rows = table_rows(path)
    header, body = rows[0], rows[1:]
    people, withheld = [], {c: 0 for c in header if c in WITHHELD_COLUMNS}
    for row in body:
        record = dict(zip(header, row))
        if not (record.get("NOMBRE") or record.get("APELLIDO PATERNO")):
            continue  # fila vacía de la plantilla
        for column in withheld:
            if record.get(column):
                withheld[column] += 1
        person = {
            key: record.get(column) or None
            for key, column in PERSON_COLUMNS.items()
            if column in header
        }
        for key in [k for k in person if k.endswith("Date")]:
            person[key] = excel_date(person[key])
        # Algunas matrículas son la cédula con una letra delante («A-6252345»):
        # publicarlas sería publicar la cédula. Se retienen como ella.
        national_id = re.sub(r"\D", "", record.get("CEDULA IDENTIDAD") or "")
        license_digits = re.sub(r"\D", "", person.get("healthMinistryLicense") or "")
        if national_id and license_digits == national_id:
            person["healthMinistryLicense"] = None
            withheld["MATRICULA (contiene la cédula)"] = withheld.get("MATRICULA (contiene la cédula)", 0) + 1
        people.append({"sourceRow": int(record["NUMERO"]), **person})
    return people, withheld


def excel_date(value: str | None) -> str | None:
    """`40476` → `2010-10-25`: Excel guardó algunas fechas como número de serie."""
    if value is None or not re.fullmatch(r"\d{5}", value):
        return value
    from datetime import timedelta

    return (date(1899, 12, 30) + timedelta(days=int(value))).isoformat()


PERSON_COLUMNS = {
    "givenName": "NOMBRE",
    "middleName": "NOMBRE 2",
    "surname": "APELLIDO PATERNO",
    "motherSurname": "APELLIDO MATERNO",
    "occupation": "OCUPACION",
    "specialty": "ESPECIALIDAD",
    "healthMinistryLicense": "MATRICULA MINISTERIO DE SALUD Y DEPORTES",
    "healthMinistryLicenseDate": "FECHA INSCRIPCION MATRICULA",
    "dentalCollegeRegistration": "REGISTRO COLEGIO ODONTOLOGOS",
    "sedesRegistration": "SEDES GOBERNACION SANTA CRUZ",
    "sedesRegistrationDate": "FECHA INSCRIPCION SEDES",
    "municipality": "MUNICIPIO",
    "department": "DEPARTAMENTO",
}


def write(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source = Path(sys.argv[1])
    points = institution_points()

    alianza, alianza_skipped = read_network(
        source / ALIANZA_FILE, "Alianza Seguros",
        {"city": 0, "specialty": 1, "name": 2, "plans": 3, "address": 4, "phones": [5, 6], "page": 7}, points,
    )
    nacional, nacional_skipped = read_network(
        source / NACIONAL_FILE, "Nacional Seguros",
        {"city": 0, "specialty": 1, "name": 2, "address": 3, "phones": [4], "plans": 5, "page": 6}, points,
    )
    practitioners = merge_practitioners(alianza + nacional)
    medical = read_medical_fees(source / MEDICAL_FEE_FILE)
    dental, dental_notes = read_dental_fees(source / DENTAL_FEE_FILE)

    extracted_on = date.today().isoformat()
    write(NETWORK_DIR / "practitioners.json", practitioners)
    write(NETWORK_DIR / "manifest.json", {
        "package": "insurer-medical-networks",
        "extractedOn": extracted_on,
        "scope": "Médicos habilitados que Alianza Seguros y Nacional Seguros publican en Santa Cruz.",
        "sources": [
            {"file": ALIANZA_FILE, "sha256": sha256(source / ALIANZA_FILE), "rows": len(alianza) + alianza_skipped},
            {"file": NACIONAL_FILE, "sha256": sha256(source / NACIONAL_FILE), "rows": len(nacional) + nacional_skipped},
        ],
        "counts": {
            "practitioners": len(practitioners),
            "offices": sum(len(p["offices"]) for p in practitioners),
            "locatedAtInstitution": sum(1 for p in practitioners for o in p["offices"] if o["precision"] == "establecimiento"),
            "skippedOutsideKnownTowns": alianza_skipped + nacional_skipped,
        },
        "warnings": [
            "Los nombres de Nacional Seguros no separan apellidos de nombres; la división es convencional (nameSplit=heuristic).",
            "Sin coordenadas en la fuente: el punto es el de la clínica nombrada en la dirección o el centro de la ciudad.",
        ],
    })
    write(FEE_DIR / "medical-santa-cruz-2025.json", medical)
    write(FEE_DIR / "dental-2026.json", dental)
    write(FEE_DIR / "dental-2026-notes.json", dental_notes)
    write(FEE_DIR / "manifest.json", {
        "package": "fee-schedules",
        "extractedOn": extracted_on,
        "sources": [
            {
                "file": MEDICAL_FEE_FILE,
                "sha256": sha256(source / MEDICAL_FEE_FILE),
                "issuer": "Colegio Médico de Santa Cruz — Comité Científico Departamental",
                "edition": "Aranceles de Honorarios Médicos, julio 2025",
                "unit": "UMA",
                "items": len(medical),
                "ocrSuspect": sum(1 for i in medical if i["ocrSuspect"]),
            },
            {
                "file": DENTAL_FEE_FILE,
                "sha256": sha256(source / DENTAL_FEE_FILE),
                "edition": "Listado arancel odontológico 2026",
                "unit": "USD",
                "items": len(dental),
                "withoutPrice": sum(1 for i in dental if i["referencePrice"] is None),
            },
        ],
        "warnings": [
            "El arancel médico es OCR de un PDF escaneado: el texto no se corrige, se marca ocrSuspect.",
            "Los códigos no son del Colegio: la fuente de 3 columnas no los trae. Son la posición en la planilla.",
        ],
    })

    pharmacies_and_labs = read_pharmacies_and_labs(source / PHARMACY_FILE)
    primary_care = read_primary_care(source / PRIMARY_CARE_FILE)
    practitioner_users, practitioner_withheld = read_people(source / PRACTITIONER_USERS_FILE)
    patient_users, patient_withheld = read_people(source / PATIENT_USERS_FILE)
    write(INSTITUTIONS_OUT_DIR / "pharmacies-and-labs.json", pharmacies_and_labs)
    write(INSTITUTIONS_OUT_DIR / "primary-care.json", primary_care)
    write(INSTITUTIONS_OUT_DIR / "manifest.json", {
        "package": "markdown-institutions",
        "extractedOn": extracted_on,
        "sources": [
            {"file": PHARMACY_FILE, "sha256": sha256(source / PHARMACY_FILE), "rows": len(pharmacies_and_labs)},
            {"file": PRIMARY_CARE_FILE, "sha256": sha256(source / PRIMARY_CARE_FILE), "rows": len(primary_care)},
        ],
        "warnings": [
            "Sin coordenadas en la fuente. Farmacias y laboratorios: Nominatim sobre la dirección (precision=direccion) o el centro de la ciudad (precision=ciudad).",
            "Primer nivel: el centro del municipio (precision=municipio); las direcciones rurales no se resuelven.",
        ],
    })
    write(PEOPLE_DIR / "practitioners.json", practitioner_users)
    write(PEOPLE_DIR / "patients.json", patient_users)
    write(PEOPLE_DIR / "manifest.json", {
        "package": "registered-people",
        "extractedOn": extracted_on,
        "sources": [
            {"file": PRACTITIONER_USERS_FILE, "sha256": sha256(source / PRACTITIONER_USERS_FILE), "people": len(practitioner_users), "withheldValues": practitioner_withheld},
            {"file": PATIENT_USERS_FILE, "sha256": sha256(source / PATIENT_USERS_FILE), "people": len(patient_users), "withheldValues": patient_withheld},
        ],
        "warnings": [
            "Repositorio público: cédula, emisión, fecha de nacimiento, celular, correo y domicilio NO se copian. withheldValues cuenta cuántos valores quedaron afuera por columna.",
        ],
    })
    print(f"farmacias/laboratorios/centros: {len(pharmacies_and_labs)} · primer nivel: {len(primary_care)} · médicos usuarios: {len(practitioner_users)} · pacientes usuarios: {len(patient_users)}")
    print(f"red médica: {len(practitioners)} médicos · arancel médico: {len(medical)} · odontológico: {len(dental)}")


if __name__ == "__main__":
    main()
