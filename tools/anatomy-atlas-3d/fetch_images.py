#!/usr/bin/env python3
"""Asigna a cada ficha las imágenes de Wikimedia Commons que Wikidata le declara, con autor y licencia leídos de Commons.

## De dónde sale cada cosa

- **Qué imagen**: Wikidata, propiedad P18 (imagen) de los ítems que declaran
  un FMA ID (P1402) igual a uno de la ficha. No se busca por nombre: la imagen
  es la que la comunidad de Wikidata asoció a esa estructura (muchas son
  láminas de la Anatomía de Gray de 1918, de dominio público).
- **Autor, licencia, miniatura**: la API de Commons
  (`action=query&prop=imageinfo&iiprop=url|size|extmetadata`), de a 50
  archivos. Se guarda el URL exacto del que se leyó cada dato.

## Criterio

Se publica una imagen sólo si `LicenseShortName` es dominio público, CC0,
CC BY o CC BY-SA (sin NC ni ND), tiene autor (`Artist` o `Credit`), nada en
su autoría o descripción menciona a Netter o Elsevier, y consta que es
anatomía **humana**: una lámina de la Anatomía de Gray (archivo `GrayNNN`),
una animación hecha con BodyParts3D, o una descripción o categoría de Commons
que dice «human». Wikidata asocia a veces la foto de otra especie (el párpado
de un ñandú) y eso no se publica. Hasta 2 por ficha, primero las de Gray.
Lo descartado se lista con su motivo en `data/anatomy-ontology/images-report.json`.

    python3 -I tools/anatomy-atlas-3d/fetch_images.py --wikidata-json data/anatomy-ontology/images-wikidata-sparql.json
"""

from __future__ import annotations

import argparse
import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
CATALOGO = RAIZ / "public" / "anatomy-atlas-3d" / "catalog"
SALIDA = RAIZ / "data" / "anatomy-ontology" / "images" / "commons.json"
INFORME = RAIZ / "data" / "anatomy-ontology" / "images-report.json"
ES = RAIZ / "data" / "anatomy-ontology" / "es"
AGENTE = "mantra-core-health-anatomy-atlas/1.0 (https://github.com/mdavila-2001/mantra-core-health; open-source health platform)"
API = "https://commons.wikimedia.org/w/api.php"
CONSULTA = "SELECT ?item ?fma ?img WHERE { ?item wdt:P1402 ?fma . ?item wdt:P18 ?img . }"
POR_FICHA = 2
LIBRE = re.compile(r"^(public domain|pd\b|pd-|cc0|cc[ -]by(-sa)?[ -]?\d|cc[ -]by(-sa)?$)", re.I)
PROHIBIDO = re.compile(r"netter|elsevier", re.I)
HUMANO = re.compile(r"\bhuman\b|\bhomo sapiens\b|\bhumano\b|\bmensch", re.I)


def procedencia(archivo: str, ext: dict) -> str | None:
    """De dónde consta que la imagen es anatomía humana, o `None`."""
    if re.match(r"File:Gray\d+", archivo):
        return "gray"
    todo = " ".join(texto(ext.get(k, {}).get("value")) for k in ("Artist", "Credit", "ImageDescription", "ObjectName", "Categories"))
    if re.search(r"bodyparts3d", todo, re.I):
        return "bodyparts3d"
    if HUMANO.search(todo):
        return "commons_human"
    return None


TIPO = {
    "gray": "lámina de la Anatomía de Gray (1918, dominio público)",
    "bodyparts3d": "animación hecha con BodyParts3D",
    "commons_human": "imagen de anatomía humana",
}


def pedir(url: str) -> bytes:
    for intento in range(6):
        req = urllib.request.Request(url, headers={"User-Agent": AGENTE})
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as error:
            if error.code != 429 or intento == 5:
                raise
            time.sleep(int(error.headers.get("Retry-After") or 0) or 60 * (intento + 1))
    raise AssertionError


def texto(valor: str | None) -> str:
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", valor or "")).split())


# Upload.wikimedia.org sólo sirve miniaturas en anchos estándar (120, 250, 330,
# 500, 960…): 480 devuelve 400. 500 llena el panel de la ficha sin verse borrosa.
ANCHO = 500


def miniatura_de(info: dict) -> tuple[str, int, int]:
    """La miniatura de 500 px que sirve upload.wikimedia.org (el original si es más chico).

    Es la ruta estándar de MediaWiki: `/thumb/<h>/<hh>/<archivo>/500px-<archivo>`,
    con `.png` agregado a los SVG.
    """
    # La API agrega parámetros de seguimiento (`?utm_source=…`) al URL del original.
    url, ancho, alto = info["url"].split("?", 1)[0], int(info.get("width") or 0), int(info.get("height") or 0)
    if ancho and ancho <= ANCHO and not url.lower().endswith(".svg"):
        return url, ancho, alto
    ruta = url.split("/wikipedia/commons/", 1)[1]
    nombre = ruta.rsplit("/", 1)[1]
    sufijo = ".png" if nombre.lower().endswith(".svg") else ""
    escala = ANCHO / ancho if ancho else 1
    return (
        f"https://upload.wikimedia.org/wikipedia/commons/thumb/{ruta}/{ANCHO}px-{nombre}{sufijo}",
        ANCHO,
        round(alto * escala) if alto else ANCHO,
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wikidata-json", type=Path, required=True)
    args = ap.parse_args()
    fichas: dict[str, dict] = {}
    for p in sorted(CATALOGO.glob("structures-*.json")):
        fichas.update(json.loads(p.read_text(encoding="utf-8")))
    nombres: dict[str, str] = {}
    for p in ES.glob("*.json"):
        for k, v in json.loads(p.read_text(encoding="utf-8")).items():
            if v.get("labelEs"):
                nombres[k] = v["labelEs"]

    por_fma: dict[str, list[str]] = {}
    for b in json.loads(args.wikidata_json.read_text(encoding="utf-8"))["results"]["bindings"]:
        archivo = "File:" + urllib.parse.unquote(b["img"]["value"].rsplit("/", 1)[-1]).replace("_", " ")
        lista = por_fma.setdefault(b["fma"]["value"].strip(), [])
        if archivo not in lista:
            lista.append(archivo)

    pedidos: dict[str, list[str]] = {}
    for f in fichas.values():
        archivos: list[str] = []
        for fma in f["fma"]:
            for a in por_fma.get(str(fma), []):
                if a not in archivos:
                    archivos.append(a)
        if archivos:
            pedidos[f["id"]] = archivos

    titulos = sorted({a for l in pedidos.values() for a in l})
    meta: dict[str, dict] = {}
    for i in range(0, len(titulos), 50):
        lote = titulos[i : i + 50]
        base = f"{API}?action=query&format=json&prop=imageinfo&iiprop=url|size|extmetadata&redirects=1&titles={urllib.parse.quote('|'.join(lote))}"
        renombre: dict[str, str] = {}
        paginas: dict[str, dict] = {}
        seguir: dict[str, str] = {}
        # La API reparte `imageinfo` de un lote en varias respuestas (`continue`): se piden todas.
        while True:
            datos = json.loads(pedir(base + "".join(f"&{k}={urllib.parse.quote(v)}" for k, v in seguir.items())))
            q = datos.get("query", {})
            renombre.update({n["from"]: n["to"] for n in q.get("normalized", []) + q.get("redirects", [])})
            for pg in q.get("pages", {}).values():
                previa = paginas.get(pg["title"])
                if previa is None or ("imageinfo" in pg and "imageinfo" not in previa):
                    paginas[pg["title"]] = pg
            if "continue" not in datos:
                break
            seguir = {k: str(v) for k, v in datos["continue"].items()}
            time.sleep(1)
        for t in lote:
            final = renombre.get(renombre.get(t, t), renombre.get(t, t))
            meta[t] = {"page": paginas.get(final), "title": final, "metadataUrl": f"{API}?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles={urllib.parse.quote(final)}"}
        time.sleep(1)

    salida: dict[str, list[dict]] = {}
    descartes: list[dict] = []
    for ident, archivos in sorted(pedidos.items()):
        for a in archivos:
            m = meta.get(a, {})
            pagina = m.get("page")
            info = (pagina or {}).get("imageinfo", [{}])[0] if pagina else {}
            ext = info.get("extmetadata", {})
            licencia = texto(ext.get("LicenseShortName", {}).get("value"))
            autor = texto(ext.get("Artist", {}).get("value")) or texto(ext.get("Credit", {}).get("value"))
            todo = " ".join(texto(ext.get(k, {}).get("value")) for k in ("Artist", "Credit", "ImageDescription", "ObjectName"))
            motivo = None
            if not pagina or "missing" in pagina or not info:
                motivo = "el archivo no existe en Commons"
            elif not LIBRE.search(licencia) or re.search(r"\bNC\b|\bND\b|non-?commercial|no derivatives", licencia, re.I):
                motivo = f"licencia no admitida: {licencia or 'sin licencia'}"
            elif not autor:
                motivo = "sin autor declarado"
            elif PROHIBIDO.search(todo):
                motivo = "menciona a Netter o Elsevier"
            elif not info.get("url", "").startswith("https://upload.wikimedia.org/wikipedia/commons/"):
                motivo = "sin archivo en upload.wikimedia.org"
            elif procedencia(m["title"], ext) is None:
                motivo = "no consta que sea anatomía humana"
            if motivo:
                descartes.append({"id": ident, "file": a, "reason": motivo})
                continue
            tipo = procedencia(m["title"], ext)
            nombre = nombres.get(ident) or fichas[ident]["labelEn"]
            miniatura, ancho, alto = miniatura_de(info)
            salida.setdefault(ident, []).append(
                {
                    "file": m["title"],
                    "thumbUrl": miniatura,
                    "pageUrl": (info.get("descriptionurl") or "").split("?", 1)[0],
                    "author": autor[:300],
                    "license": licencia,
                    "licenseUrl": texto(ext.get("LicenseUrl", {}).get("value")) or None,
                    "width": ancho,
                    "height": alto,
                    "altEs": f"{nombre[:1].upper()}{nombre[1:]}: {TIPO[tipo]} que Wikidata asocia a esta estructura",
                    "kind": tipo,
                    "metadataUrl": m["metadataUrl"],
                }
            )

    # Hasta POR_FICHA por ficha, primero las láminas de Gray.
    orden = {"gray": 0, "bodyparts3d": 1, "commons_human": 2}
    salida = {k: sorted(v, key=lambda i: orden[i["kind"]])[:POR_FICHA] for k, v in salida.items()}
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(json.dumps(salida, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    motivos: dict[str, int] = {}
    for d in descartes:
        clave = d["reason"].split(":")[0]
        motivos[clave] = motivos.get(clave, 0) + 1
    INFORME.write_text(
        json.dumps(
            {
                "wikidataQuery": CONSULTA,
                "structuresWithCandidates": len(pedidos),
                "filesQueried": len(titulos),
                "structuresWithImages": len(salida),
                "imagesPublished": sum(len(v) for v in salida.values()),
                "discarded": descartes,
                "discardedByReason": motivos,
            },
            ensure_ascii=False,
            indent=1,
        )
        + "\n",
        encoding="utf-8",
    )
    print(json.dumps({"conCandidatas": len(pedidos), "archivos": len(titulos), "fichasConImagen": len(salida), "imagenes": sum(len(v) for v in salida.values()), "descartes": motivos}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
