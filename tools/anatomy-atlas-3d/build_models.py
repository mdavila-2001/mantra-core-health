#!/usr/bin/env python3
"""Arma los GLB del atlas 3D a partir de las STL de BodyParts3D 3.0.

## Qué hace

1. Lee las 934 STL (1,3 GB, ~27 M triángulos) y las reparte en capas por el
   sistema que les declara `conventional_part_of.txt` de BodyParts3D.
2. Reduce cada malla con `fast-simplification` a un presupuesto proporcional,
   para que el cuerpo entero quepa en unos pocos megas.
3. Escribe un GLB por capa en `public/anatomy-atlas-3d/models/`, con un nodo por
   pieza cuyo nombre es el id de BodyParts3D (`FMA24474`, `BP24`): el visor
   resuelve la ficha por ese nombre, nunca por posición.

El sistema tegumentario queda fuera: la piel (`FMA7163`) mezcla superficies
internas y externas (lo advierte el README de la copia de BodyParts3D) y el
pelo cubre el cráneo y la pelvis, así que se tocaría antes que lo que tapa.

## Licencia

Las mallas son obra derivada de BodyParts3D, (c) The Database Center for Life
Science, CC-BY-SA 2.1 JP. Los GLB heredan esa licencia y la llevan en
`asset.copyright` y en el manifiesto.

Uso (con un venv que tenga trimesh, numpy y fast-simplification):
    python -I tools/anatomy-atlas-3d/build_models.py --bp3d /ruta/BodyParts3D_data
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import struct

import fast_simplification
import numpy as np
import trimesh

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = RAIZ / "public" / "anatomy-atlas-3d" / "models"
PIEZAS = RAIZ / "data" / "anatomy-ontology" / "bodyparts3d-parts.json"

# Sistema de BodyParts3D → capa del visor, en orden de prioridad: una pieza
# que cuelga de dos sistemas cae en la primera que aparezca acá.
CAPAS = [
    ("FMA23881", "skeleton"),
    ("FMA72954", "muscles"),
    ("FMA7161", "vessels"),
    ("FMA7157", "nervous"),
    ("FMA7160", "organs"),
    ("FMA7158", "organs"),
    ("FMA7152", "organs"),
    ("FMA7159", "organs"),
    ("FMA9668", "organs"),
    ("FMA74594", "organs"),
    ("FMA78499", "organs"),
]
GENITAL = "FMA7160"
EXCLUIDAS = {"FMA7163"}
TRIANGULOS_TOTALES = 320_000
MINIMO, MAXIMO = 240, 9_000
COPYRIGHT = (
    "BodyParts3D, (c) The Database Center for Life Science, CC-BY-SA 2.1 JP "
    "(https://creativecommons.org/licenses/by-sa/2.1/jp/). Mallas reducidas para Mantra Core Health."
)


def ancestros(padres: dict[str, list[str]], ident: str) -> set[str]:
    vistos: set[str] = set()
    pila = [ident]
    while pila:
        for p in padres.get(pila.pop(), []):
            if p not in vistos:
                vistos.add(p)
                pila.append(p)
    return vistos


def escribir_glb(destino: Path, piezas: list[tuple[str, trimesh.Trimesh]]) -> None:
    """Un GLB con un nodo por pieza y posiciones cuantizadas (KHR_mesh_quantization).

    Cada malla guarda sus vértices como int16 normalizados dentro de su propia
    caja; el nodo lleva la traslación y la escala que los devuelven a metros
    (un int16 normalizado se lee como [-1, 1], así que la escala es la media caja).
    Es la mitad de bytes que float32 y el `GLTFLoader` de three.js lo lee sin
    decodificador aparte. No hay normales: el visor las calcula al cargar.
    """
    binario = bytearray()
    vistas, accesores, mallas, nodos = [], [], [], []

    def agregar(datos: bytes, objetivo: int) -> int:
        while len(binario) % 4:
            binario.append(0)
        vistas.append({"buffer": 0, "byteOffset": len(binario), "byteLength": len(datos), "target": objetivo})
        binario.extend(datos)
        return len(vistas) - 1

    for ident, malla in piezas:
        v = malla.vertices
        minimo, maximo = v.min(axis=0), v.max(axis=0)
        centro = (minimo + maximo) / 2
        mitad = np.maximum((maximo - minimo) / 2, 1e-6)
        q = np.round((v - centro) / mitad * 32767).astype(np.int16)
        q4 = np.zeros((len(q), 4), dtype=np.int16)
        q4[:, :3] = q
        vista_v = agregar(q4.tobytes(), 34962)
        vistas[vista_v]["byteStride"] = 8
        accesores.append({
            "bufferView": vista_v, "componentType": 5122, "normalized": True, "count": len(q), "type": "VEC3",
            "min": [int(x) for x in q.min(axis=0)], "max": [int(x) for x in q.max(axis=0)],
        })
        pos = len(accesores) - 1
        indices = malla.faces.astype(np.uint16 if len(v) < 65535 else np.uint32).ravel()
        accesores.append({
            "bufferView": agregar(indices.tobytes(), 34963),
            "componentType": 5123 if indices.dtype == np.uint16 else 5125, "count": int(indices.size), "type": "SCALAR",
        })
        # La malla va sin nombre: el `GLTFLoader` de three.js hace únicos los
        # nombres, y una malla y un nodo llamados igual dejarían al nodo como
        # «FMA24474_1», que ya no es el id de la pieza.
        mallas.append({"primitives": [{"attributes": {"POSITION": pos}, "indices": len(accesores) - 1}]})
        nodos.append({
            "name": ident, "mesh": len(mallas) - 1,
            "translation": [float(x) for x in centro], "scale": [float(x) for x in mitad],
        })

    while len(binario) % 4:
        binario.append(0)
    gltf = {
        "asset": {"version": "2.0", "generator": "mantra build_models.py", "copyright": COPYRIGHT},
        "extensionsUsed": ["KHR_mesh_quantization"], "extensionsRequired": ["KHR_mesh_quantization"],
        "scene": 0, "scenes": [{"nodes": list(range(len(nodos)))}], "nodes": nodos, "meshes": mallas,
        "accessors": accesores, "bufferViews": vistas, "buffers": [{"byteLength": len(binario)}],
    }
    texto = json.dumps(gltf, separators=(",", ":")).encode()
    texto += b" " * (-len(texto) % 4)
    largo = 12 + 8 + len(texto) + 8 + len(binario)
    with destino.open("wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, largo))
        f.write(struct.pack("<II", len(texto), 0x4E4F534A) + texto)
        f.write(struct.pack("<II", len(binario), 0x004E4942) + bytes(binario))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--bp3d", type=Path, required=True)
    args = ap.parse_args()

    padres: dict[str, list[str]] = defaultdict(list)
    with (args.bp3d / "conventional_part_of.txt").open(encoding="utf-8") as f:
        next(f)
        for linea in f:
            todo, _, parte, *_ = linea.rstrip("\n").split("\t")
            padres[parte].append(todo)

    piezas = {p["meshId"]: p for p in json.loads(PIEZAS.read_text(encoding="utf-8"))}
    asignadas: dict[str, list[str]] = defaultdict(list)
    sexo: dict[str, str] = {}
    for ident in sorted(piezas):
        if ident in EXCLUIDAS:
            continue
        anc = ancestros(padres, ident)
        capa = next((c for s, c in CAPAS if s in anc), None)
        if capa is None:
            continue
        asignadas[capa].append(ident)
        # BodyParts3D es un único cuerpo masculino: todo lo que cuelga del
        # sistema genital es exclusivo de ese sexo. Lo demás es la referencia
        # compartida, con la forma (pelvis, proporciones) de ese mismo cuerpo.
        sexo[ident] = "male" if GENITAL in anc else "shared"

    mallas = {}
    for capa, ids in asignadas.items():
        for ident in ids:
            malla = trimesh.load(args.bp3d / "stl" / f"{ident}.stl", force="mesh")
            malla.merge_vertices()
            mallas[ident] = malla
    caras = {i: len(m.faces) for i, m in mallas.items()}
    raiz_total = sum(np.sqrt(c) for c in caras.values())

    manifiesto = {"license": COPYRIGHT, "layers": {}, "parts": {}}
    SALIDA.mkdir(parents=True, exist_ok=True)
    for capa, ids in sorted(asignadas.items()):
        lote = []
        for ident in ids:
            malla = mallas[ident]
            objetivo = int(np.clip(TRIANGULOS_TOTALES * np.sqrt(caras[ident]) / raiz_total, MINIMO, MAXIMO))
            if caras[ident] > objetivo:
                v, f = fast_simplification.simplify(
                    malla.vertices.astype(np.float32), malla.faces, target_reduction=1 - objetivo / caras[ident]
                )
                malla = trimesh.Trimesh(v, f, process=True)
            # BodyParts3D está en milímetros con Z hacia arriba; el visor usa
            # metros con Y hacia arriba.
            malla.apply_scale(0.001)
            malla.apply_transform(trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0]))
            lote.append((ident, malla))
            manifiesto["parts"][ident] = {
                "layer": capa,
                "sex": sexo[ident],
                "triangles": int(len(malla.faces)),
                "sourceTriangles": caras[ident],
            }
        escribir_glb(SALIDA / f"{capa}.glb", lote)
        manifiesto["layers"][capa] = {"file": f"{capa}.glb", "parts": len(ids)}
        print(f"{capa}: {len(ids)} piezas")

    (SALIDA / "parts-manifest.json").write_text(json.dumps(manifiesto, indent=1) + "\n", encoding="utf-8")
    total = sum(p["triangles"] for p in manifiesto["parts"].values())
    print(f"{len(manifiesto['parts'])} piezas, {total} triángulos")


if __name__ == "__main__":
    main()
