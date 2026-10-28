#!/usr/bin/env python3
"""Corrige las letras del OCR en `data/fee-schedules/` con el MISMO corrector de la API.

El arancel médico de Santa Cruz 2025 es OCR de un PDF escaneado. La API lo corrige
con `tools/bolivia-datasets/ocr_es.py` (léxico oficial en castellano: CIE-10-ES,
MedlinePlus, fichas técnicas de CIMA). Este guion aplica ese mismo módulo —no una
copia— a los JSON del front, para que la maqueta y la API digan lo mismo:

- cambia SÓLO `display` (letras); `code`, `referencePrice` y `priceUnit` quedan;
- guarda el texto anterior en `originalDisplay` la primera vez;
- recalcula `ocrSuspect` sobre el texto corregido, con el patrón de la API.

Idempotente: sobre un archivo ya corregido no cambia nada.

Uso: python3 scripts/fix-fee-schedule-ocr.py [<ruta a mantra-core-health-api>]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
API = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ.parent / "mantra-core-health-api"
sys.path.insert(0, str(API / "tools" / "bolivia-datasets"))

from ocr_es import LEXICO_VERSIONADO, Lexico, corregir_texto  # noqa: E402

# El mismo patrón que `extract_datasets.py` (PATRON_OCR): daño evidente que queda.
PATRON_OCR = re.compile(r"[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]\d|\d[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2,}|[|©®~¢£¥§¤@]")


def main() -> None:
    lexico = Lexico.leer(API / "tools" / "bolivia-datasets" / LEXICO_VERSIONADO)
    for nombre in ("medical-santa-cruz-2025.json", "dental-2026.json"):
        ruta = RAIZ / "data" / "fee-schedules" / nombre
        filas = json.loads(ruta.read_text(encoding="utf-8"))
        lista = filas["items"] if isinstance(filas, dict) else filas
        cambiadas = 0
        for fila in lista:
            original = fila.get("originalDisplay", fila["display"])
            corregido, cambios, _ = corregir_texto(original, lexico)
            if cambios:
                fila["originalDisplay"] = original
            fila["display"] = corregido
            fila["ocrSuspect"] = bool(PATRON_OCR.search(corregido))
            cambiadas += bool(cambios)
        ruta.write_text(json.dumps(filas, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        sospechosas = sum(1 for f in lista if f["ocrSuspect"])
        print(f"{nombre}: {len(lista)} filas · {cambiadas} con letras corregidas · {sospechosas} siguen marcadas")


if __name__ == "__main__":
    main()
