#!/usr/bin/env python3
"""Destila las planillas de instituciones de salud a `data/bolivia-instituciones/`.

## Por qué existe

El directorio de clínicas de la maqueta mostraba **«Clínica Los Olivos»,
«Hospital San Lucas» y «Clínica Nueva Esperanza»**: tres nombres inventados, en
un producto que se enseña a clínicas y aseguradoras bolivianas de verdad. La
regla 00 §8 lo prohíbe explícitamente.

El propietario tiene las listas reales en `RealDataSeeds/`, en planillas de
Excel. Este script las lee y las escribe como JSON con la misma forma que el
resto de los corpus, para que `scripts/gen-institutions-fixture.mjs` las porte.

Las versiones `.md` de esas planillas están en UTF-16 mal convertido y son
ilegibles; se leen **los `.xlsx`**, que son el original.

## Lo que NO hace

- **No inventa lo que falta.** Cuatro clínicas no declaran razón social ni NIT y
  quedan en `null`. Los centros de primer nivel no traen teléfono. Un campo
  vacío viaja vacío.
- **No geocodifica.** Hay dirección, no coordenadas. Ponerlas es otro trabajo,
  con su fuente y su precisión declarada, como se hizo con el corpus boliviano.
- **No completa el país.** Los centros de primer nivel son **sólo de Santa
  Cruz**, y el JSON lo dice en su `scope` para que ninguna pantalla los presente
  como el padrón nacional.

Uso:
    python3 tools/extract-bolivia-institutions.py <carpeta RealDataSeeds>
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

import openpyxl

DESTINO = Path("data") / "bolivia-instituciones"

PLANILLAS = {
    "clinicas": "LISTA DE CLINICAS PRIVADAS.xlsx",
    "hospitales": "LISTA DE HOSPITAL DE TERCER, SEGUNDO NIVEL Y CAJAS.xlsx",
    "primer_nivel": "LISTA DE HOSPITAL DE PRIMER NIVEL SANTA CRUZ.xlsx",
    "aseguradoras": "LISTADO DE ASEGURADORAS.xlsx",
}

# Encabezados de sección del archivo de hospitales públicos, y qué tipo declaran.
SECCIONES_HOSPITAL = {
    "HOSPITALES DE TERCER NIVEL": ("hospital_tercer_nivel", 3),
    "HOSPITAL SEGUNDO NIVEL": ("hospital_segundo_nivel", 2),
    "CAJAS NACIONALES": ("caja_de_salud", None),
}


def limpio(valor) -> str | None:
    """Un texto de celda, o `None` si no hay nada que decir."""
    if valor is None:
        return None
    texto = re.sub(r"\s+", " ", str(valor)).strip()
    return texto or None


def titulo(texto: str | None) -> str | None:
    """«CLINICA LAS AMERICAS» → «Clínica Las Americas», sin tocar siglas."""
    if texto is None:
        return None
    if texto != texto.upper():
        return texto  # ya viene con mayúsculas y minúsculas: se respeta
    palabras = []
    for palabra in texto.split(" "):
        if len(palabra) <= 3 and palabra.isalpha() and palabra not in {"DEL", "LOS", "LAS", "SAN"}:
            palabras.append(palabra)  # siglas cortas: SRL, S.A., UCB
        else:
            palabras.append(palabra.capitalize())
    return " ".join(palabras)


def slug(texto: str) -> str:
    base = unicodedata.normalize("NFD", texto)
    base = "".join(c for c in base if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"(^-+|-+$)", "", re.sub(r"[^a-z0-9]+", "-", base))


def filas_de(ruta: Path) -> list[list[str | None]]:
    libro = openpyxl.load_workbook(ruta, read_only=True, data_only=True)
    hoja = libro.active
    filas = [[limpio(c) for c in fila] for fila in hoja.iter_rows(values_only=True)]
    libro.close()
    return [f for f in filas if any(f)]


def sha256_de(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as archivo:
        for bloque in iter(lambda: archivo.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def leer_clinicas(raiz: Path) -> list[dict]:
    salida, ids = [], set()
    for fila in filas_de(raiz / PLANILLAS["clinicas"]):
        nombre, razon, nit, direccion, telefono = (fila + [None] * 5)[:5]
        if nombre is None or nombre.upper() in {"LISTA DE CLINICAS PRIVADAS",
                                                "CLINICAS PRIVADAS", "ESTABLECIMIENTO"}:
            continue
        clave = slug(nombre)
        if clave in ids:
            continue
        ids.add(clave)
        salida.append({
            "id": f"cli-{clave}",
            "name": titulo(nombre),
            "legalName": razon,
            "taxId": nit,
            "address": direccion,
            "phone": telefono,
            "kind": "clinica_privada",
            "sector": "privado",
            "city": "Santa Cruz de la Sierra",
            "department": "Santa Cruz",
        })
    return salida


def leer_hospitales(raiz: Path) -> list[dict]:
    salida, ids = [], set()
    tipo, nivel = None, None
    for fila in filas_de(raiz / PLANILLAS["hospitales"]):
        primera = (fila[0] or "").upper()
        if primera in SECCIONES_HOSPITAL:
            tipo, nivel = SECCIONES_HOSPITAL[primera]
            continue
        if tipo is None or primera in {"ESTABLECIMIENTO", "LISTA DE HOSPITALES PUBLICOS"}:
            continue
        nombre, direccion, telefono, red = (fila + [None] * 4)[:4]
        if nombre is None:
            continue
        clave = slug(nombre)
        if clave in ids:
            continue
        ids.add(clave)
        salida.append({
            "id": f"hos-{clave}",
            "name": titulo(nombre),
            "address": direccion,
            "phone": telefono,
            "healthNetwork": red,
            "kind": tipo,
            "level": nivel,
            "sector": "seguridad_social" if tipo == "caja_de_salud" else "publico",
            "city": "Santa Cruz de la Sierra",
            "department": "Santa Cruz",
        })
    return salida


def leer_primer_nivel(raiz: Path) -> list[dict]:
    salida, ids = [], set()
    for fila in filas_de(raiz / PLANILLAS["primer_nivel"]):
        departamento, municipio, nombre, direccion = (fila + [None] * 4)[:4]
        if departamento is None or departamento.upper() == "DEPARTAMENTO":
            continue
        if nombre is None or municipio is None:
            continue
        clave = f"{slug(municipio)}-{slug(nombre)}"
        if clave in ids:
            continue
        ids.add(clave)
        salida.append({
            "id": f"pn-{clave}",
            "name": titulo(nombre),
            "address": direccion,
            "municipality": titulo(municipio),
            "department": titulo(departamento),
            "kind": "centro_de_salud_primer_nivel",
            "level": 1,
            "sector": "publico",
        })
    return salida


# La planilla de aseguradoras trae DOS secciones, y la diferencia importa: una
# compañía de seguros generales y fianzas no cubre salud. Mezclarlas pondría a
# «Seguros Illimani» en el directorio de seguros médicos, que sería falso.
SECCIONES_ASEGURADORA = {
    "PRINCIPALES ASEGURADORAS DE PERSONAS": ("personas", True),
    "PRINCIPALES ASEGURADORAS GENERALES Y FIANZAS": ("generales_y_fianzas", False),
}


def leer_aseguradoras(raiz: Path) -> list[dict]:
    salida, ids = [], set()
    ramo, cubre_salud = None, None
    for fila in filas_de(raiz / PLANILLAS["aseguradoras"]):
        primera = (fila[0] or "").upper()
        if primera in SECCIONES_ASEGURADORA:
            ramo, cubre_salud = SECCIONES_ASEGURADORA[primera]
            continue
        if ramo is None or primera == "NOMBRE EMPRESA":
            continue
        nombre, sigla, nit, direccion = (fila + [None] * 4)[:4]
        if nombre is None:
            continue
        # Una misma compañía puede estar en los dos ramos con NIT distinto
        # (Crediseguro), así que la clave es el ramo más el nombre.
        clave = f"{ramo}-{slug(nombre)}"
        if clave in ids:
            continue
        ids.add(clave)
        salida.append({
            "id": f"ase-{clave}",
            "name": nombre,
            "shortName": sigla,
            "taxId": nit,
            "address": direccion,
            "branch": ramo,
            # Lo declara la sección de la planilla, no una inferencia nuestra.
            "coversHealth": cubre_salud,
            "kind": "aseguradora",
        })
    return salida


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    raiz = Path(sys.argv[1])
    faltan = [n for n in PLANILLAS.values() if not (raiz / n).is_file()]
    if faltan:
        print(f"! No encuentro en {raiz}: {', '.join(faltan)}", file=sys.stderr)
        return 2

    clinicas = leer_clinicas(raiz)
    hospitales = leer_hospitales(raiz)
    primer_nivel = leer_primer_nivel(raiz)
    aseguradoras = leer_aseguradoras(raiz)

    manifiesto = {
        "package": "bolivia-instituciones-de-salud",
        "schemaVersion": "1.0.0",
        "extractedOn": date.today().isoformat(),
        "sources": [
            {"file": nombre, "sha256": sha256_de(raiz / nombre)}
            for nombre in PLANILLAS.values()
        ],
        "counts": {
            "clinics": len(clinicas),
            "hospitals": len(hospitales),
            "primaryCare": len(primer_nivel),
            "insurers": len(aseguradoras),
        },
        "scope": (
            "Clínicas privadas, hospitales públicos y cajas: Santa Cruz de la Sierra. "
            "Centros de primer nivel: departamento de Santa Cruz, no el padrón nacional. "
            "Aseguradoras: de alcance nacional, con domicilio legal declarado."
        ),
        "warnings": [
            "Sin coordenadas: las planillas traen dirección, no geolocalización.",
            "Cuatro clínicas no declaran razón social ni NIT; viajan en null.",
            "Los centros de primer nivel no traen teléfono.",
            "No es un padrón oficial completo ni un registro de habilitación vigente.",
        ],
    }

    DESTINO.mkdir(parents=True, exist_ok=True)
    salidas = {
        "manifest": manifiesto,
        "clinics": clinicas,
        "hospitals": hospitales,
        "primary-care": primer_nivel,
        "insurers": aseguradoras,
    }
    total = 0
    for nombre, contenido in salidas.items():
        ruta = DESTINO / f"{nombre}.json"
        ruta.write_text(json.dumps(contenido, ensure_ascii=False, indent=1) + "\n",
                        encoding="utf-8")
        total += ruta.stat().st_size
        print(f"    {ruta}  {ruta.stat().st_size / 1024:,.0f} KB")
    print(f"\n  {total / 1024:,.0f} KB")
    for clave, valor in manifiesto["counts"].items():
        print(f"    {clave:14} {valor:>5,}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
