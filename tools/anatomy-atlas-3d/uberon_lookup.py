#!/usr/bin/env python3
"""Busca clases humanas de UBERON por nombre o sinónimo, sin red.

Es la herramienta con la que se cruza una entrada del índice de Netter con
UBERON: quien mapea propone el nombre inglés o latino y esto devuelve las
clases cuyo `label` o sinónimo EXACTO coincide (sin mayúsculas, tildes ni
guiones). Sólo una coincidencia de este tipo cuenta como mapeo; el resto se
muestra como pista (`--fuzzy`) y no se acepta.

    python3 -I tools/anatomy-atlas-3d/uberon_lookup.py "jejunal artery" "arteria jejunalis"
    python3 -I tools/anatomy-atlas-3d/uberon_lookup.py --fuzzy "ureter artery"
"""

from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

DATOS = Path(__file__).resolve().parents[2] / "data" / "anatomy-ontology" / "uberon-human.json"


def normalizar(texto: str) -> str:
    texto = unicodedata.normalize("NFD", texto.lower())
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    return " ".join(texto.replace("-", " ").replace(",", " ").split())


def indice():
    exacto: dict[str, list[tuple[str, str, str]]] = {}
    terminos = json.loads(DATOS.read_text(encoding="utf-8"))
    for t in terminos:
        exacto.setdefault(normalizar(t["label"]), []).append((t["id"], t["label"], "label"))
        for s in t["exactSynonyms"]:
            exacto.setdefault(normalizar(s), []).append((t["id"], t["label"], "exact_synonym"))
    return terminos, exacto


def main() -> None:
    args = sys.argv[1:]
    difuso = "--fuzzy" in args
    args = [a for a in args if a != "--fuzzy"]
    terminos, exacto = indice()
    for consulta in args:
        clave = normalizar(consulta)
        aciertos = exacto.get(clave, [])
        print(json.dumps({"query": consulta, "matches": [{"id": i, "label": l, "via": v} for i, l, v in aciertos]}, ensure_ascii=False))
        if difuso and not aciertos:
            palabras = set(clave.split())
            pistas = []
            for t in terminos:
                nombres = [t["label"], *t["exactSynonyms"], *t["otherSynonyms"]]
                mejor = max(len(palabras & set(normalizar(n).split())) / max(len(palabras), 1) for n in nombres)
                if mejor >= 0.6:
                    pistas.append((mejor, t["id"], t["label"]))
            pistas.sort(reverse=True)
            print(json.dumps({"query": consulta, "hints_not_accepted": [{"id": i, "label": l} for _, i, l in pistas[:8]]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
