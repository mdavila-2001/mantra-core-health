#!/usr/bin/env python3
"""Elige la muestra del 5 % de fichas para la auditoría frase por frase.

La muestra es aleatoria pero reproducible (semilla fija, impresa en la salida):
quien quiera repetir la auditoría obtiene las mismas fichas. Cada ficha va con
su fuente al lado —el texto de UBERON tal cual, las relaciones declaradas y el
cruce con Netter— para que quien audita compare contra la fuente y no contra
lo que recuerda.

    python3 -I tools/anatomy-atlas-3d/sample_audit.py --seed 20261024 --out DIR --chunks 6
"""

from __future__ import annotations

import argparse
import glob
import json
import math
import random
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--chunks", type=int, default=6)
    ap.add_argument("--fraction", type=float, default=0.05)
    args = ap.parse_args()

    fichas = {}
    for archivo in sorted(glob.glob(str(RAIZ / "public/anatomy-atlas-3d/catalog/structures-*.json"))):
        fichas.update(json.loads(Path(archivo).read_text(encoding="utf-8")))
    fuente = {t["id"]: t for t in json.loads((RAIZ / "data/anatomy-ontology/uberon-human.json").read_text(encoding="utf-8"))}

    ids = sorted(fichas)
    n = math.ceil(len(ids) * args.fraction)
    muestra = sorted(random.Random(args.seed).sample(ids, n))

    args.out.mkdir(parents=True, exist_ok=True)
    elementos = []
    for i in muestra:
        f = fichas[i]
        u = fuente.get(i)
        elementos.append({
            "id": i,
            "published": {
                "labelEn": f["labelEn"],
                "labelEs": f["labelEs"],
                "definitionEn": (f["definition"] or {}).get("en"),
                "definitionEs": (f["definition"] or {}).get("es"),
                "relations": [{"type": r["type"], "target": r["target"], "labelEn": r["labelEn"]} for r in f["relations"]],
                "netter": f["netter"],
                "meshes": f["meshes"],
            },
            "source": None if u is None else {
                "label": u["label"],
                "definition": u["definition"],
                "relations": u["relations"],
            },
        })
    tam = math.ceil(len(elementos) / args.chunks)
    for k in range(args.chunks):
        (args.out / f"chunk-{k + 1}.json").write_text(
            json.dumps(elementos[k * tam:(k + 1) * tam], ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
        )
    (args.out / "sample.json").write_text(
        json.dumps({"seed": args.seed, "fraction": args.fraction, "population": len(ids), "size": n, "ids": muestra}, indent=1) + "\n",
        encoding="utf-8",
    )
    print(f"semilla {args.seed}: {n} de {len(ids)} fichas en {args.chunks} lotes")


if __name__ == "__main__":
    main()
