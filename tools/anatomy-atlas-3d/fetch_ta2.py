#!/usr/bin/env python3
"""Cruza las fichas del atlas con la Terminologia Anatomica 2 (TA2, FIPAT).

## De dónde sale cada cosa

- **El vocabulario TA2** (código, término latino e inglés): el que publica el
  visor oficial de FIPAT, https://ta2viewer.openanatomy.org/, que lo trae
  embebido en su bundle (`vocab` 2.07). Se guarda el SHA-256 del bundle leído.
- **El puente TA2 ↔ FMA**: Wikidata (CC0), propiedades P7173 (TA2 ID) y P1402
  (FMA ID), por SPARQL. Es la misma fuente que consulta el visor de FIPAT para
  enlazar cada término.

## Criterio (no se fuerza nada)

Una ficha recibe un código TA2 si alguno de sus FMA aparece en Wikidata con
exactamente **un** TA2 ID y ese ID existe en el vocabulario del visor. Si un
FMA lleva a varios TA2, o el TA2 no está en el vocabulario, la ficha queda en
la lista de no mapeadas con su motivo. No se cruza por nombre.

Salida: `data/anatomy-ontology/ta2.json`.

    python3 -I tools/anatomy-atlas-3d/fetch_ta2.py [--wikidata-json respuesta.json]
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CATALOGO = RAIZ / "public" / "anatomy-atlas-3d" / "catalog"
SALIDA = RAIZ / "data" / "anatomy-ontology" / "ta2.json"
VISOR = "https://ta2viewer.openanatomy.org/"
WIKIDATA = "https://query.wikidata.org/sparql"
AGENTE = "mantra-core-health-anatomy-atlas/1.0 (open-source health platform; TA2 crosswalk)"
CONSULTA = "SELECT ?item ?ta2 ?fma WHERE { ?item wdt:P7173 ?ta2 . ?item wdt:P1402 ?fma . }"


def pedir(url: str, cabeceras: dict[str, str] | None = None) -> bytes:
    """Con reintentos ante 429: el servicio SPARQL de Wikidata llega a limitar a 1 pedido por minuto."""
    for intento in range(6):
        req = urllib.request.Request(url, headers={"User-Agent": AGENTE, **(cabeceras or {})})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as error:
            if error.code != 429 or intento == 5:
                raise
            time.sleep(int(error.headers.get("Retry-After") or 0) or 65)
    raise AssertionError


def cadena_js(literal: str) -> str:
    """El contenido de un literal JS entre comillas simples, sin evaluarlo."""
    escapes = {"n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f", "v": "\v", "0": "\0"}

    def reemplazar(m: re.Match[str]) -> str:
        e = m.group(1)
        if e[0] == "u":
            return chr(int(e[1:], 16))
        if e[0] == "x":
            return chr(int(e[1:], 16))
        return escapes.get(e, e)

    return re.sub(r"\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)", reemplazar, literal, flags=re.S)


def vocabulario() -> tuple[dict, dict[str, dict], str, str]:
    indice = pedir(VISOR).decode("utf-8")
    trozo = next(m for m in re.findall(r'src="(/static/js/main\.[^"]+\.js)"', indice))
    bundle = pedir(urllib.parse.urljoin(VISOR, trozo))
    sha = hashlib.sha256(bundle).hexdigest()
    texto = bundle.decode("utf-8")
    literales = [json.loads(cadena_js(m)) for m in re.findall(r"JSON\.parse\('((?:[^'\\]|\\.)*)'\)", texto)]
    version = next(v for v in literales if isinstance(v, dict) and "vocab" in v)
    terminos = max((v for v in literales if isinstance(v, list) and v and isinstance(v[0], dict) and "term" in v[0]), key=len)
    return version, {str(t["id"]): t for t in terminos}, urllib.parse.urljoin(VISOR, trozo), sha


def puente_wikidata(guardado: Path | None) -> dict[str, list[dict]]:
    """El puente TA2 ↔ FMA: de Wikidata en el momento o de una respuesta SPARQL guardada (`--wikidata-json`)."""
    if guardado is not None:
        datos = json.loads(guardado.read_text(encoding="utf-8"))
    else:
        datos = json.loads(
            pedir(f"{WIKIDATA}?query={urllib.parse.quote(CONSULTA)}", {"Accept": "application/sparql-results+json"})
        )
    por_fma: dict[str, list[dict]] = {}
    for b in datos["results"]["bindings"]:
        if "fma" not in b:
            continue
        fma = b["fma"]["value"].strip()
        entrada = {"ta2": b["ta2"]["value"].strip(), "wikidata": b["item"]["value"].rsplit("/", 1)[-1]}
        lista = por_fma.setdefault(fma, [])
        if entrada not in lista:
            lista.append(entrada)
    return por_fma


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wikidata-json", type=Path, default=None, help="respuesta SPARQL ya bajada (el servicio limita a 1 pedido por minuto)")
    args = ap.parse_args()
    version, terminos, url_bundle, sha = vocabulario()
    por_fma = puente_wikidata(args.wikidata_json)
    obtenido = (
        datetime.fromtimestamp(args.wikidata_json.stat().st_mtime, timezone.utc) if args.wikidata_json else datetime.now(timezone.utc)
    ).isoformat(timespec="seconds")
    fichas: dict[str, dict] = {}
    for p in sorted(CATALOGO.glob("structures-*.json")):
        fichas.update(json.loads(p.read_text(encoding="utf-8")))

    mapeadas: dict[str, dict] = {}
    no_mapeadas: list[dict] = []
    for f in sorted(fichas.values(), key=lambda f: f["id"]):
        candidatos = {}
        for fma in f["fma"]:
            for e in por_fma.get(str(fma), []):
                candidatos.setdefault(e["ta2"], {**e, "fma": str(fma)})
        if not f["fma"]:
            no_mapeadas.append({"id": f["id"], "reason": "la ficha no tiene FMA"})
        elif not candidatos:
            no_mapeadas.append({"id": f["id"], "reason": "ningún FMA de la ficha figura en Wikidata con TA2 ID"})
        elif len(candidatos) > 1:
            no_mapeadas.append({"id": f["id"], "reason": f"ambiguo: varios TA2 ({', '.join(sorted(candidatos))})"})
        else:
            (codigo, e), = candidatos.items()
            t = terminos.get(codigo)
            if t is None:
                no_mapeadas.append({"id": f["id"], "reason": f"TA2 {codigo} de Wikidata no está en el vocabulario {version['vocab']}"})
                continue
            mapeadas[f["id"]] = {
                "code": codigo,
                "la": t["term"].get("la"),
                "en": t["term"].get("en"),
                "fma": e["fma"],
                "wikidata": e["wikidata"],
            }

    SALIDA.write_text(
        json.dumps(
            {
                "source": {
                    "vocabulary": f"TA2 (FIPAT), vocab {version['vocab']}, visor {version['viewer']}",
                    "vocabularyUrl": url_bundle,
                    "vocabularySha256": sha,
                    "vocabularyTerms": len(terminos),
                    "crosswalk": "Wikidata P7173 (TA2 ID) + P1402 (FMA ID), CC0",
                    "crosswalkQuery": CONSULTA,
                    "crosswalkFmaIds": len(por_fma),
                    "crosswalkRetrievedAt": obtenido,
                    "vocabularyRetrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "criterion": "un FMA de la ficha con exactamente un TA2 ID en Wikidata, presente en el vocabulario del visor",
                },
                "mapped": mapeadas,
                "unmapped": no_mapeadas,
            },
            ensure_ascii=False,
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )
    motivos: dict[str, int] = {}
    for n in no_mapeadas:
        clave = n["reason"].split(":")[0] if n["reason"].startswith("ambiguo") else re.sub(r"\bTA2 \d+", "TA2 N", n["reason"])
        motivos[clave] = motivos.get(clave, 0) + 1
    print(json.dumps({"fichas": len(fichas), "mapeadas": len(mapeadas), "noMapeadas": len(no_mapeadas), "motivos": motivos}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
