#!/usr/bin/env python3
"""Destila el corpus «Taxonomía Anatómica Netter v2 AUDITADA» a `data/netter-anatomia/`.

## Por qué existe

El paquete auditado pesa 103 MiB: 3 977 archivos Markdown, de los cuales 94 MiB
son un dataset de entrenamiento para IA que la maqueta no usa. Versionar eso
sería meter cien megas en el repositorio para mostrar un glosario.

Este script se queda con lo que la pantalla necesita —la taxonomía, las láminas,
las entidades del índice y la procedencia— y lo escribe como JSON, ~600 KB. Se
corre **una vez por versión del paquete**, no en cada build; lo que se versiona
es su salida, igual que `data/bolivia-salud-eje-central/`.

## El truco que hace que entre

Las 3 161 definiciones largas del corpus pesan 5,7 MB, pero no son 3 161 textos:
son **27**. La definición de cada entidad se arma con una prosa por tipo
—«El cartílago es tejido conectivo especializado que…»— y el nombre de la
entidad encima. Verificado: los 27 tipos tienen exactamente una prosa distinta
cada uno. Así que se guardan los 27 textos verbatim y cada entidad apunta al
suyo. Nada se reescribe ni se resume.

## Lo que NO se trae, y por qué

- `11_raw_ocr/` y `12_dataset_entrenamiento_gold/`: material de auditoría y de
  entrenamiento. No se muestra en pantalla.
- Las definiciones largas por entidad: son las 27 prosas de arriba.
- Cualquier cosa del Atlas que no sea índice o tabla de contenidos. Netter es
  obra con derechos: acá hay taxonomía y términos, ni una ilustración.

Uso:
    python3 tools/extract-netter-corpus.py <ruta al .zip o al directorio extraído>
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import tempfile
import zipfile
from pathlib import Path

PAQUETE = "Taxonomia_Anatomica_Netter_IA_v2_AUDITADA"
DESTINO = Path("data") / "netter-anatomia"

MARCA_TIPO = "se modela en esta taxonomía como "

_FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)
_TITULO = re.compile(r"^#\s+(.+)$", re.MULTILINE)
_TITULO_LAMINA = re.compile(r"^#\s*L[áa]mina\s+(\d+):\s*(.+)$", re.MULTILINE)
_RANGO = re.compile(r"(\d+)\s*-\s*(\d+)")


def frontmatter(texto: str) -> tuple[dict[str, str], str]:
    m = _FRONTMATTER.match(texto)
    if not m:
        return {}, texto
    campos = {}
    for linea in m.group(1).splitlines():
        if ":" in linea:
            clave, _, valor = linea.partition(":")
            campos[clave.strip()] = valor.strip()
    return campos, texto[m.end():]


def secciones(cuerpo: str) -> dict[str, str]:
    encontradas, titulo, buffer = {}, None, []
    for linea in cuerpo.splitlines():
        if linea.startswith("## "):
            if titulo is not None:
                encontradas[titulo] = "\n".join(buffer).strip()
            titulo, buffer = linea[3:].strip(), []
        else:
            buffer.append(linea)
    if titulo is not None:
        encontradas[titulo] = "\n".join(buffer).strip()
    return encontradas


def vinetas(cuerpo: str) -> dict[str, str]:
    campos = {}
    for linea in cuerpo.splitlines():
        s = linea.strip()
        if s.startswith("- ") and ":" in s:
            clave, _, valor = s[2:].partition(":")
            campos[clave.replace("**", "").strip()] = (
                valor.replace("**", "").replace("`", "").strip()
            )
    return campos


def laminas_de(valor: str | None) -> list[int]:
    if not valor:
        return []
    vistas: list[int] = []
    for bruto in re.findall(r"\d+", valor):
        n = int(bruto)
        if n not in vistas:
            vistas.append(n)
    return vistas


def rango(valor: str) -> tuple[int, int]:
    m = _RANGO.search(valor)
    if m:
        return int(m.group(1)), int(m.group(2))
    uno = re.search(r"\d+", valor)
    if not uno:
        raise ValueError(f"rango ilegible: {valor!r}")
    return int(uno.group()), int(uno.group())


def prosa_del_tipo(definicion: str) -> str | None:
    """La parte de la definición que describe el TIPO, no la entidad."""
    corte = definicion.find(MARCA_TIPO)
    if corte == -1:
        return None
    resto = definicion[corte + len(MARCA_TIPO):]
    punto = resto.find(". ")
    return (resto[punto + 2:] if punto != -1 else resto).strip()


def extraer(raiz: Path, archivo_origen: Path | None) -> dict[str, object]:
    # ── taxonomía ──────────────────────────────────────────────────────────
    regiones = []
    for ruta in sorted((raiz / "03_regiones").glob("R*.md")):
        texto = ruta.read_text(encoding="utf-8")
        campos, titulo = vinetas(texto), _TITULO.search(texto)
        desde, hasta = rango(campos["Láminas Netter"])
        regiones.append({
            "id": campos["ID"],
            "name": titulo.group(1).strip() if titulo else ruta.stem,
            "plateFrom": desde,
            "plateTo": hasta,
            "definition": secciones(texto).get("Definición ampliada", ""),
        })

    subregiones = []
    for ruta in sorted((raiz / "03_regiones" / "subregiones").glob("*.md")):
        texto = ruta.read_text(encoding="utf-8")
        campos, titulo = vinetas(texto), _TITULO.search(texto)
        desde, hasta = rango(campos["Láminas"])
        subregiones.append({
            "id": campos["ID"],
            "regionId": campos["ID"].split("S")[0],
            "name": titulo.group(1).strip() if titulo else ruta.stem,
            "plateFrom": desde,
            "plateTo": hasta,
            "definition": secciones(texto).get("Definición ampliada", ""),
        })

    # ── láminas ────────────────────────────────────────────────────────────
    laminas = []
    for ruta in sorted((raiz / "04_laminas_definiciones_largas").glob("*.md")):
        campos, cuerpo = frontmatter(ruta.read_text(encoding="utf-8"))
        titulo = _TITULO_LAMINA.search(cuerpo)
        laminas.append({
            "plate": int(campos["lamina"]),
            "title": titulo.group(2).strip() if titulo else campos["id"],
            "regionId": campos.get("region_id") or None,
            "subregionId": campos.get("subregion_id") or None,
            "titleConfidence": campos.get("confianza_titulo"),
        })

    # ── entidades y las 27 prosas por tipo ─────────────────────────────────
    entidades, prosas = [], {}
    for ruta in sorted((raiz / "05_entidades_definiciones_largas").rglob("*.md")):
        campos, cuerpo = frontmatter(ruta.read_text(encoding="utf-8"))
        titulo = _TITULO.search(cuerpo)
        tipo = campos["tipo"]
        definicion = secciones(cuerpo).get("Definición ampliada", "")
        prosa = prosa_del_tipo(definicion.split("\n\n")[0])
        if prosa and tipo not in prosas:
            prosas[tipo] = prosa
        entidades.append({
            "id": campos["id"],
            "name": titulo.group(1).strip() if titulo else campos["id"],
            "type": tipo,
            "confidence": campos["confianza"],
            "region": campos.get("region_predominante") or None,
            "subregion": campos.get("subregion_predominante") or None,
            "plates": laminas_de(campos.get("laminas")),
        })

    # ── clínica explícita ──────────────────────────────────────────────────
    clinica = []
    for ruta in sorted((raiz / "08_clinica_explicita").glob("*.md")):
        texto = ruta.read_text(encoding="utf-8")
        campos, partes = vinetas(texto), secciones(texto)
        titulo = _TITULO.search(texto)
        numeros = laminas_de(campos.get("Lámina"))
        tratamiento = partes.get("Tratamiento actual, separado de la fuente anatómica", "")
        fuente = re.search(r"\*\*Fuente de verificación:\*\*\s*(.+)", tratamiento)
        clinica.append({
            "plate": numeros[0] if numeros else int(ruta.stem.split("_")[1]),
            "title": titulo.group(1).strip() if titulo else ruta.stem,
            "definition": partes.get("Definición clínica ampliada", ""),
            "treatment": re.sub(r"\n*\*\*Fuente de verificación:\*\*.*", "", tratamiento).strip(),
            "verificationSource": fuente.group(1).strip() if fuente else None,
            "guardrail": partes.get("Guardrail", ""),
        })

    digest = None
    if archivo_origen and archivo_origen.is_file():
        h = hashlib.sha256()
        with archivo_origen.open("rb") as f:
            for bloque in iter(lambda: f.read(1 << 20), b""):
                h.update(bloque)
        digest = h.hexdigest()

    return {
        "manifest": {
            "package": PAQUETE,
            "schemaVersion": "2.0.0",
            "sourceArchive": archivo_origen.name if archivo_origen else None,
            "sourceSha256": digest,
            "primarySource": (raiz / "10_fuentes" / "Netter.md").read_text(encoding="utf-8").strip(),
            "normalizationSource": (raiz / "10_fuentes" / "FIPAT.md").read_text(encoding="utf-8").strip(),
            "counts": {
                "regions": len(regiones),
                "subregions": len(subregiones),
                "plates": len(laminas),
                "entities": len(entidades),
                "types": len(prosas),
                "clinicalNotes": len(clinica),
            },
            "warnings": [
                "`consensus_high` no equivale a validación humana término por término.",
                "No inferir origen/inserción, inervación, territorio vascular, diagnóstico "
                "ni tratamiento desde estas entradas.",
                "La forma del término es la del índice del Atlas, sin corregir.",
                "La clínica no se atribuye al Atlas y no es prescripción.",
            ],
            "notIncluded": [
                "11_raw_ocr/ y los datasets de entrenamiento: no se muestran en pantalla.",
                "Ilustraciones y texto corrido del Atlas: obra con derechos.",
            ],
        },
        "regions": regiones,
        "subregions": subregiones,
        "plates": laminas,
        "types": [{"type": t, "definition": p} for t, p in sorted(prosas.items())],
        "entities": entidades,
        "clinicalNotes": clinica,
    }


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__, file=sys.stderr)
        return 2
    origen = Path(sys.argv[1])
    temporal = None
    archivo_origen = None

    if origen.is_file() and origen.suffix == ".zip":
        archivo_origen = origen
        temporal = tempfile.TemporaryDirectory()
        print(f"  extrayendo {origen.name} ...")
        with zipfile.ZipFile(origen) as z:
            z.extractall(temporal.name)
        raiz = Path(temporal.name) / PAQUETE
    else:
        raiz = origen if origen.name == PAQUETE else origen / PAQUETE

    if not raiz.is_dir():
        print(f"! No encuentro {PAQUETE}/ en {origen}", file=sys.stderr)
        return 2

    print(f"  leyendo {raiz} ...")
    datos = extraer(raiz, archivo_origen)

    DESTINO.mkdir(parents=True, exist_ok=True)
    total = 0
    for nombre, contenido in datos.items():
        ruta = DESTINO / f"{nombre}.json"
        ruta.write_text(
            json.dumps(contenido, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
        )
        total += ruta.stat().st_size
        print(f"    {ruta}  {ruta.stat().st_size / 1024:,.0f} KB")
    print(f"\n  {total / 1024:,.0f} KB en {len(datos)} archivos.")
    for clave, valor in datos["manifest"]["counts"].items():
        print(f"    {clave:16} {valor:>6,}")
    if temporal:
        temporal.cleanup()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
