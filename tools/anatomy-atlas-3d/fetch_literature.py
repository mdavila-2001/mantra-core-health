#!/usr/bin/env python3
"""Junta, por estructura, los artículos con los que se redacta su descripción extendida.

Para cada ficha prioritaria (con pieza 3D o con entrada de Netter cruzada) pide:

- a **PubMed E-utilities**: `"<nombre>"[tiab] AND "anatomy and histology"[sh]`
  con resumen, por relevancia (hasta 4), y
- a **Europe PMC**: el nombre en título o resumen junto a `anatomy`, los más
  citados con resumen (hasta 3),

y guarda PMID, DOI, título, revista, año y resumen. OpenAlex no se usa: en la
corrida de 2026-10-24 devolvió 429 (cupo diario agotado en la IP compartida,
`network-probe-4.txt`).

Los resúmenes **no se publican ni se commitean**: van a la carpeta de trabajo
que se le pase (`--out`), son el material que leen quienes redactan y quien
audita. Al repositorio llegan sólo las citas usadas.

    python3 -I tools/anatomy-atlas-3d/fetch_literature.py --out <carpeta>
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import threading
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CATALOGO = RAIZ / "public" / "anatomy-atlas-3d" / "catalog"
AGENTE = "mantra-core-health-anatomy-atlas/1.0 (open-source health platform; literature for anatomy descriptions)"
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
EPMC = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"

# Lotes de trabajo: las siete regiones del catálogo y R08, lo sistémico (sin región).
LOTES = ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08"]


def pedir(url: str, intentos: int = 4) -> bytes:
    for i in range(intentos):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": AGENTE})
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read()
        except Exception as error:  # noqa: BLE001 — se reintenta y, al final, se informa
            if i == intentos - 1:
                raise RuntimeError(f"{url}: {error}") from error
            time.sleep(2 ** (i + 1))
    raise AssertionError


def fichas_prioritarias() -> list[dict]:
    fichas: dict[str, dict] = {}
    for p in sorted(CATALOGO.glob("structures-*.json")):
        fichas.update(json.loads(p.read_text(encoding="utf-8")))
    salida = []
    for f in fichas.values():
        if not f["meshes"] and not f["netter"]:
            continue
        lote = f["regions"][0] if f["regions"] else "R08"
        salida.append({"id": f["id"], "label": f["labelEn"], "batch": lote, "hasMesh": bool(f["meshes"]), "netter": bool(f["netter"])})
    return sorted(salida, key=lambda f: f["id"])


def nombre_de_busqueda(label: str) -> str:
    """Sin lateralidad ni paréntesis: «Right femur» → «femur», «head of left X» → «head of X»."""
    texto = re.sub(r"\([^)]*\)", " ", label)
    texto = re.sub(r"\b(of\s+)?(right|left)\s+side\b", " ", texto, flags=re.I)
    texto = re.sub(r"\b(right|left)\b", " ", texto, flags=re.I)
    return " ".join(texto.replace('"', " ").split())


class Ritmo:
    """Separa los pedidos a un mismo servicio (E-utilities: 3/s sin clave)."""

    def __init__(self, por_segundo: float) -> None:
        self.intervalo = 1 / por_segundo
        self.ultimo = 0.0
        self.cerrojo = threading.Lock()

    def esperar(self) -> None:
        with self.cerrojo:
            ahora = time.monotonic()
            if ahora - self.ultimo < self.intervalo:
                time.sleep(self.intervalo - (ahora - self.ultimo))
            self.ultimo = time.monotonic()


RITMO_NCBI = Ritmo(2.5)


ANATOMICO = '("anatomy and histology"[sh] OR anatomy[ti] OR anatomical[ti] OR cadaver*[tiab] OR morpholog*[ti])'


def pubmed_ids(nombre: str) -> list[str]:
    """Primero el nombre en el título; si no alcanza, en título o resumen."""
    ids: list[str] = []
    for campo in ("ti", "tiab"):
        termino = f'"{nombre}"[{campo}] AND {ANATOMICO} AND humans[mh] AND hasabstract'
        url = f"{EUTILS}/esearch.fcgi?db=pubmed&retmode=json&retmax=5&sort=relevance&term={urllib.parse.quote(termino)}"
        for intento in range(5):
            RITMO_NCBI.esperar()
            datos = json.loads(pedir(url))
            # Con el cupo superado, E-utilities responde 200 con {"error": ...} y sin lista.
            if "idlist" in datos.get("esearchresult", {}):
                break
            time.sleep(2 ** (intento + 1))
        else:
            raise RuntimeError(f"esearch sin resultado: {json.dumps(datos)[:200]}")
        ids += [i for i in datos["esearchresult"]["idlist"] if i not in ids]
        if len(ids) >= 3:
            break
    return ids[:5]


def pubmed_registros(pmids: list[str]) -> dict[str, dict]:
    salida: dict[str, dict] = {}
    for i in range(0, len(pmids), 150):
        lote = pmids[i : i + 150]
        RITMO_NCBI.esperar()
        raiz = ET.fromstring(pedir(f"{EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&id={','.join(lote)}"))
        for art in raiz.iter("PubmedArticle"):
            pmid = art.findtext(".//MedlineCitation/PMID")
            resumen = " ".join("".join(t.itertext()).strip() for t in art.iter("AbstractText")).strip()
            doi = next((e.text for e in art.iter("ArticleId") if e.get("IdType") == "doi"), None)
            salida[pmid] = {
                "pmid": pmid,
                "doi": doi,
                "title": "".join(art.find(".//ArticleTitle").itertext()).strip() if art.find(".//ArticleTitle") is not None else "",
                "journal": art.findtext(".//Journal/ISOAbbreviation") or art.findtext(".//Journal/Title"),
                "year": art.findtext(".//JournalIssue/PubDate/Year") or (art.findtext(".//JournalIssue/PubDate/MedlineDate") or "")[:4],
                "abstract": resumen,
                "via": "pubmed",
            }
    return salida


def europepmc(nombre: str) -> list[dict]:
    consulta = f'TITLE:"{nombre}" AND (anatomy OR anatomical OR cadaver OR morphology) AND HAS_ABSTRACT:y AND SRC:MED'
    url = f"{EPMC}?format=json&resultType=core&pageSize=3&sort={urllib.parse.quote('CITED desc')}&query={urllib.parse.quote(consulta)}"
    datos = json.loads(pedir(url))
    salida = []
    for r in datos.get("resultList", {}).get("result", []):
        if not r.get("pmid") or not r.get("abstractText"):
            continue
        salida.append(
            {
                "pmid": r["pmid"],
                "doi": r.get("doi"),
                "title": re.sub(r"<[^>]+>", "", r.get("title", "")),
                "journal": r.get("journalInfo", {}).get("journal", {}).get("isoabbreviation"),
                "year": r.get("pubYear"),
                "abstract": re.sub(r"<[^>]+>", " ", r["abstractText"]).strip(),
                "citedBy": r.get("citedByCount"),
                "via": "europepmc",
            }
        )
    return salida


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    fichas = fichas_prioritarias()[: args.limit]
    print(f"fichas prioritarias: {len(fichas)}", file=sys.stderr)

    errores: list[dict] = []

    def buscar(f: dict) -> dict:
        nombre = nombre_de_busqueda(f["label"])
        try:
            ids = pubmed_ids(nombre)
        except RuntimeError as e:
            ids = []
            errores.append({"id": f["id"], "service": "pubmed", "error": str(e)})
        try:
            epmc = europepmc(nombre)
        except RuntimeError as e:
            epmc = []
            errores.append({"id": f["id"], "service": "europepmc", "error": str(e)})
        return {**f, "query": nombre, "pubmedIds": ids, "europepmc": epmc}

    with ThreadPoolExecutor(max_workers=4) as pool:
        resultados = list(pool.map(buscar, fichas))

    registros = pubmed_registros(sorted({i for r in resultados for i in r["pubmedIds"]}))
    por_lote: dict[str, list[dict]] = {l: [] for l in LOTES}
    for r in resultados:
        articulos: dict[str, dict] = {}
        for i in r["pubmedIds"]:
            if i in registros and registros[i]["abstract"]:
                articulos[i] = registros[i]
        for a in r["europepmc"]:
            articulos.setdefault(a["pmid"], a)
        por_lote[r["batch"]].append(
            {"id": r["id"], "label": r["label"], "query": r["query"], "hasMesh": r["hasMesh"], "netter": r["netter"], "articles": list(articulos.values())}
        )
    for lote, lista in por_lote.items():
        (args.out / f"{lote}.json").write_text(json.dumps(lista, ensure_ascii=False, indent=1), encoding="utf-8")
    resumen = {
        "fichas": len(resultados),
        "conArticulos": sum(1 for l in por_lote.values() for r in l if r["articles"]),
        "porLote": {l: {"fichas": len(v), "conArticulos": sum(1 for r in v if r["articles"])} for l, v in por_lote.items()},
        "articulosDistintos": len({a["pmid"] for l in por_lote.values() for r in l for a in r["articles"]}),
        "errores": errores,
    }
    (args.out / "summary.json").write_text(json.dumps(resumen, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps({k: v for k, v in resumen.items() if k != "errores"} | {"errores": len(errores)}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
