#!/usr/bin/env python3
"""Comprueba, sin red, un archivo de descripciones extendidas contra el material del que salió.

Para cada frase de `data/anatomy-ontology/literature/<lote>.json`:

- el aspecto es uno de los siete admitidos y el texto no está vacío;
- tiene al menos una cita `PMID:<n>`, y cada PMID está entre los artículos que
  la búsqueda devolvió **para esa misma estructura** (el paquete del lote);
- no repite 6 o más palabras seguidas del título o del resumen citado. Como
  las frases están en castellano y los resúmenes en inglés, esto atrapa sólo
  el calco literal (nombres, cifras y frases copiadas sin traducir); que una
  frase no sea una traducción palabra por palabra lo coteja la auditoría.

Sale con 1 ante el primer lote con errores y los lista.

    python3 -I tools/anatomy-atlas-3d/check_literature.py --packs <carpeta de paquetes> <lote>.json [...]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path

ASPECTOS = {"situation", "parts", "relations", "irrigation", "innervation", "function", "clinical"}
N = 6


def palabras(texto: str) -> list[str]:
    texto = unicodedata.normalize("NFD", texto.lower())
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return re.findall(r"[a-z0-9]+", texto)


def ngramas(lista: list[str], n: int) -> set[tuple[str, ...]]:
    return {tuple(lista[i : i + n]) for i in range(len(lista) - n + 1)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--packs", type=Path, required=True)
    ap.add_argument("archivos", nargs="+", type=Path)
    args = ap.parse_args()
    paquetes: dict[str, dict] = {}
    for p in args.packs.glob("*.json"):
        datos = json.loads(p.read_text(encoding="utf-8"))
        if isinstance(datos, list):
            for r in datos:
                paquetes[r["id"]] = {a["pmid"]: a for a in r["articles"]}
    errores: list[str] = []
    frases = 0
    for archivo in args.archivos:
        datos = json.loads(archivo.read_text(encoding="utf-8"))
        for ident, d in datos.items():
            if ident not in paquetes:
                errores.append(f"{archivo.name} {ident}: la estructura no está en los paquetes")
                continue
            for i, f in enumerate(d.get("sentences", [])):
                frases += 1
                donde = f"{archivo.name} {ident} frase {i + 1}"
                if f.get("aspect") not in ASPECTOS:
                    errores.append(f"{donde}: aspecto inválido {f.get('aspect')!r}")
                if not str(f.get("es", "")).strip():
                    errores.append(f"{donde}: texto vacío")
                citas = f.get("cites") or []
                if not citas:
                    errores.append(f"{donde}: sin cita")
                propias = ngramas(palabras(f.get("es", "")), N)
                for c in citas:
                    m = re.fullmatch(r"PMID:(\d+)", c)
                    if not m:
                        errores.append(f"{donde}: cita mal formada {c!r}")
                        continue
                    articulo = paquetes[ident].get(m.group(1))
                    if articulo is None:
                        errores.append(f"{donde}: {c} no está entre los artículos hallados para esta estructura")
                        continue
                    calco = propias & ngramas(palabras(articulo["title"] + " " + articulo["abstract"]), N)
                    if calco:
                        errores.append(f"{donde}: repite {N}+ palabras seguidas de {c}: «{' '.join(next(iter(calco)))}»")
    print(json.dumps({"archivos": len(args.archivos), "frases": frases, "errores": len(errores)}, ensure_ascii=False))
    for e in errores:
        print(e)
    sys.exit(1 if errores else 0)


if __name__ == "__main__":
    main()
