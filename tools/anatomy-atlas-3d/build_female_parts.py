#!/usr/bin/env python3
"""Agrega al atlas 3D las piezas femeninas del Human Reference Atlas de HuBMAP.

## Por qué

BodyParts3D es un único cuerpo masculino. Para la vista «Mujer» hacen falta
mallas femeninas, y el HuBMAP Human Reference Atlas (HRA) publica órganos de
referencia 3D segmentados del Visible Human Female (NLM), con licencia CC BY
4.0 y una tabla de cruce nodo → UBERON/FMA por órgano (`crosswalk.csv`).

## Qué hace

1. Baja los GLB y los `crosswalk.csv` de los órganos de `ORGANOS` (versiones
   fijas; se guardan en `--cache` con su SHA-256).
2. Alinea el cuerpo femenino al de referencia del visor, sin deformarlo: una
   similitud (escala uniforme, giro y traslación) por ICP de la pelvis ósea
   femenina contra los coxales y el sacro de `skeleton.glb`. El útero, las
   trompas y los ovarios viajan con esa misma transformación. Las mamas usan
   el mismo giro y escala, pero la traslación sale del esternón: el tronco del
   Visible Human Female es proporcionalmente más largo que el de BodyParts3D,
   y anclarlas a la pelvis las dejaba 9 cm por debajo del pecho.
3. Reduce cada malla con `fast-simplification` a un presupuesto proporcional.
4. Reescribe `skeleton.glb` y `organs.glb` con los nodos de siempre más los
   nodos `VH_F_*` (antes quita los `VH_F_*` de una corrida anterior: es
   idempotente). Los nodos de siempre se decodifican y se vuelven a cuantizar
   con la misma caja, así que no cambian.
5. Escribe en `parts-manifest.json` las piezas nuevas con `sex: "female"`, y
   marca `sex: "male"` a la pelvis de referencia (coxales y sacro): en «Mujer»
   la reemplaza la femenina.
6. Escribe `data/anatomy-ontology/hra-female-parts.json`, que el generador del
   catálogo (`yarn mock:anatomy-ontology`) lee junto a `bodyparts3d-parts.json`.

Hay que correrlo DESPUÉS de `build_models.py`, que reescribe los GLB desde las
STL de BodyParts3D y no sabe de estas piezas.

## Lo que HRA no trae

Vagina y vulva: HRA no las publica. Quedan como fichas sin pieza 3D.
Músculos, vasos y nervios femeninos: tampoco; la vista «Mujer» usa los de
referencia.

## Licencia

Las mallas femeninas son obra derivada de los órganos de referencia 3D del
HuBMAP CCF (CC BY 4.0, https://creativecommons.org/licenses/by/4.0/). Los GLB
mezclan esas mallas con las de BodyParts3D, así que se distribuyen bajo
CC BY-SA 2.1 JP, compatible con CC BY.

Uso (con el venv de `build_models.py` más scipy):
    python -I tools/anatomy-atlas-3d/build_female_parts.py --cache /ruta/cache-hra
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import json
import struct
import urllib.request
from pathlib import Path

import fast_simplification
import numpy as np
import trimesh
from scipy.spatial import cKDTree

RAIZ = Path(__file__).resolve().parents[2]
MODELOS = RAIZ / "public" / "anatomy-atlas-3d" / "models"
DATOS = RAIZ / "data" / "anatomy-ontology"
PIEZAS_FEMENINAS = DATOS / "hra-female-parts.json"
CDN = "https://cdn.humanatlas.io/digital-objects/ref-organ"

# Órgano de HRA → (versión, archivo GLB, capa del visor, ancla de alineación).
ORGANOS = {
    "pelvis-female": ("v1.3", "3d-vh-f-pelvis.glb", "skeleton", "pelvis"),
    "uterus-female": ("v1.2", "3d-vh-f-uterus.glb", "organs", "pelvis"),
    "fallopian-tube-female-left": ("v1.2", "3d-vh-f-fallopian-tube-l.glb", "organs", "pelvis"),
    "fallopian-tube-female-right": ("v1.2", "3d-vh-f-fallopian-tube-r.glb", "organs", "pelvis"),
    "ovary-female-left": ("v1.3", "3d-vh-f-ovary-l.glb", "organs", "pelvis"),
    "ovary-female-right": ("v1.3", "3d-vh-f-ovary-r.glb", "organs", "pelvis"),
    "mammary-gland-female-left": ("v1.1", "3d-vh-f-mammary-gland-l.glb", "organs", "torax"),
    "mammary-gland-female-right": ("v1.1", "3d-vh-f-mammary-gland-r.glb", "organs", "torax"),
    # Sólo anclas: no se dibujan.
    "sternum-female": ("v1.0", "3d-vh-f-sternum.glb", None, None),
    "manubrium-female": ("v1.0", "3d-vh-f-manubrium.glb", None, None),
}

# El hueso esponjoso es interior: dentro del compacto no se ve ni se toca.
EXCLUIDOS = {n for h in ("ilium", "ischium", "pubis") for lado in "LR" for n in [f"VH_F_{h}_spongy_bone_{lado}"]}

# La pelvis de HRA cruza el hueso compacto con «compact bone tissue», que no
# es lo que se toca: se cruza con el hueso, como en BodyParts3D.
HUESO_DE_NODO = {
    f"VH_F_{h}_compact_bone_{lado}": (uberon, f"{'left' if lado == 'L' else 'right'} {h}")
    for h, uberon in (("ilium", "UBERON:0001273"), ("ischium", "UBERON:0001274"), ("pubis", "UBERON:0001275"))
    for lado in "LR"
}

# Coxales y sacro de BodyParts3D: la pelvis masculina, reemplazada en «Mujer».
PELVIS_DE_REFERENCIA = ["FMA16586", "FMA16587", "FMA16202"]
ESTERNON_DE_REFERENCIA = ["FMA7486", "FMA7487"]

TRIANGULOS_TOTALES = 60_000
MINIMO, MAXIMO = 150, 6_000

ATRIBUCION_HRA = (
    "HuBMAP CCF 3D Reference Object Library (Browne K, Schlehlein H, Herr BW II, Quardokus E, "
    "Bueckle A, Börner K. 2024), del Visible Human Project female (NLM), CC BY 4.0 "
    "(https://creativecommons.org/licenses/by/4.0/)"
)


def cargar_build_models():
    """`escribir_glb` y la licencia de `build_models.py`: un solo escritor de GLB."""
    spec = importlib.util.spec_from_file_location("build_models", Path(__file__).with_name("build_models.py"))
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def bajar(cache: Path, organo: str) -> tuple[Path, Path]:
    version, archivo, _, _ = ORGANOS[organo]
    base = f"{CDN}/{organo}/{version}/assets"
    destino = cache / organo / version
    destino.mkdir(parents=True, exist_ok=True)
    rutas = []
    for nombre in (archivo, "crosswalk.csv"):
        ruta = destino / nombre
        if not ruta.exists():
            urllib.request.urlretrieve(f"{base}/{nombre}", ruta)
        rutas.append(ruta)
    return rutas[0], rutas[1]


def sha256(ruta: Path) -> str:
    return hashlib.sha256(ruta.read_bytes()).hexdigest()


def nodos_hra(ruta: Path) -> dict[str, trimesh.Trimesh]:
    """Cada nodo con malla, en el marco del cuerpo de HRA (metros, Y arriba, Z adelante)."""
    escena = trimesh.load(ruta)
    salida = {}
    for nombre in escena.graph.nodes_geometry:
        transformacion, geometria = escena.graph[nombre]
        malla = escena.geometry[geometria].copy()
        malla.apply_transform(transformacion)
        malla.merge_vertices()
        salida[nombre] = malla
    return salida


def leer_glb(ruta: Path) -> list[tuple[str, np.ndarray, np.ndarray]]:
    """Los nodos de un GLB de `build_models.py`: nombre, vértices en metros y caras."""
    datos = ruta.read_bytes()
    largo_json = struct.unpack("<I", datos[12:16])[0]
    gltf = json.loads(datos[20 : 20 + largo_json])
    inicio = 20 + largo_json
    binario = datos[inicio + 8 : inicio + 8 + struct.unpack("<I", datos[inicio : inicio + 4])[0]]
    nodos = []
    for nodo in gltf["nodes"]:
        primitiva = gltf["meshes"][nodo["mesh"]]["primitives"][0]
        pos = gltf["accessors"][primitiva["attributes"]["POSITION"]]
        vista = gltf["bufferViews"][pos["bufferView"]]
        q = np.frombuffer(binario, np.int16, pos["count"] * 4, vista["byteOffset"]).reshape(-1, 4)[:, :3]
        vertices = q.astype(np.float64) / 32767 * np.array(nodo["scale"]) + np.array(nodo["translation"])
        ind = gltf["accessors"][primitiva["indices"]]
        tipo = np.uint16 if ind["componentType"] == 5123 else np.uint32
        caras = np.frombuffer(binario, tipo, ind["count"], gltf["bufferViews"][ind["bufferView"]]["byteOffset"])
        nodos.append((nodo["name"], vertices, caras.reshape(-1, 3).astype(np.int64)))
    return nodos


def muestrear(mallas: list[trimesh.Trimesh], por_malla: int) -> np.ndarray:
    return np.vstack([trimesh.sample.sample_surface(m, por_malla, seed=7)[0] for m in mallas])


def similitud(a: np.ndarray, b: np.ndarray) -> tuple[float, np.ndarray, np.ndarray]:
    """Umeyama: la escala, el giro y la traslación que mejor llevan `a` sobre `b`."""
    media_a, media_b = a.mean(0), b.mean(0)
    u, s, vt = np.linalg.svd((b - media_b).T @ (a - media_a) / len(a))
    d = np.eye(3)
    if np.linalg.det(u @ vt) < 0:
        d[2, 2] = -1
    giro = u @ d @ vt
    escala = float((s * np.diag(d)).sum() / (a - media_a).var(0).sum())
    return escala, giro, media_b - escala * giro @ media_a


def icp(origen: np.ndarray, destino: np.ndarray, vueltas: int = 60) -> tuple[float, np.ndarray, np.ndarray, float]:
    arbol = cKDTree(destino)
    escala = float(np.cbrt(np.prod(np.ptp(destino, 0)) / np.prod(np.ptp(origen, 0))))
    giro = np.eye(3)
    traslacion = destino.mean(0) - escala * origen.mean(0)
    for _ in range(vueltas):
        puesto = escala * origen @ giro.T + traslacion
        distancia, cercano = arbol.query(puesto)
        # Lo que no tiene par (el cóccix, que BodyParts3D no dibuja) no tira.
        usar = distancia < np.percentile(distancia, 90)
        escala, giro, traslacion = similitud(origen[usar], destino[cercano[usar]])
    error = float(arbol.query(escala * origen @ giro.T + traslacion)[0].mean())
    return escala, giro, traslacion, error


def ontologia() -> tuple[set[str], dict[str, str]]:
    uberon = json.loads((DATOS / "uberon-human.json").read_text(encoding="utf-8"))
    por_fma: dict[str, str] = {}
    for termino in uberon:
        for fma in termino["fma"]:
            por_fma.setdefault(fma, termino["id"])
    return {t["id"] for t in uberon}, por_fma


def resolver(ontologia_id: str, ids: set[str], por_fma: dict[str, str]) -> tuple[str, str | None, list[str], str]:
    """Un id del cruce de HRA → (id de la ficha, FMA, UBERON del catálogo, cómo se cruzó)."""
    fma = ontologia_id.removeprefix("FMA:") if ontologia_id.startswith("FMA:") else None
    if ontologia_id in ids:
        return ontologia_id, fma, [ontologia_id], "hra_exact"
    if fma is not None and fma in por_fma:
        return por_fma[fma], fma, [por_fma[fma]], "hra_fma"
    # Un UBERON que el catálogo no trae (sin xref FMA) o un FMA sin UBERON:
    # ficha mínima con el nombre de la tabla, como las piezas sólo-FMA.
    return ontologia_id, fma, [], "hra_only"


def con_lado(nodo: str, rotulo: str) -> str:
    rotulo = rotulo[0].lower() + rotulo[1:]
    lado = nodo.rsplit("_", 1)[-1]
    if lado in ("L", "R") and not any(p in rotulo for p in ("left", "right")):
        rotulo = f"{'left' if lado == 'L' else 'right'} {rotulo}"
    return rotulo


def cruzar(nodo: str, cruce: dict[str, tuple[str, str]], raiz: str, ids: set[str], por_fma: dict[str, str]) -> dict:
    """La pieza de un nodo: la forma de `bodyparts3d-parts.json` más su ficha y su órgano.

    `structureId` es la ficha que abre la pieza; `hraPartOf`, el órgano entero
    del cruce (`VH_F_uterus`), que el generador arma como estructura compuesta
    de todas sus piezas: elegir «útero» resalta el útero entero.
    """
    raiz_id, _, _, _ = resolver(cruce[raiz][0], ids, por_fma)
    organo = {"hraPartOf": raiz_id, "hraPartOfLabel": con_lado(raiz, cruce[raiz][1])}
    if nodo in HUESO_DE_NODO:
        uberon, rotulo = HUESO_DE_NODO[nodo]
        return {"structureId": uberon, "label": rotulo, "fmaLabel": None, "fma": None, "uberon": [uberon],
                "uberonMatch": "hra_exact", **organo}
    if nodo not in cruce:
        # El nodo no figura en el cruce (`cornua`, `cervicovaginal_junction`):
        # no tiene id propio. Ficha mínima con el nombre del nodo y su órgano.
        rotulo = f"{nodo.removeprefix('VH_F_').replace('_', ' ')} ({cruce[raiz][1]})"
        return {"structureId": f"HRA:{nodo}", "label": con_lado(nodo, rotulo), "fmaLabel": None, "fma": None,
                "uberon": [], "uberonMatch": "hra_only", **organo}
    ontologia_id, nombre = cruce[nodo]
    ficha, fma, uberon, coincidencia = resolver(ontologia_id, ids, por_fma)
    # `label` lleva el lado (el visor lo usa al pasar el puntero); el nombre de
    # la ficha no, porque la misma ficha puede tener piezas de los dos lados.
    return {"structureId": ficha, "label": con_lado(nodo, nombre),
            "fmaLabel": nombre[0].lower() + nombre[1:] if not uberon else None, "fma": fma,
            "uberon": uberon, "uberonMatch": coincidencia, **organo}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", type=Path, required=True)
    args = ap.parse_args()
    bm = cargar_build_models()
    ids, por_fma = ontologia()

    archivos, nodos, cruces = {}, {}, {}
    for organo in ORGANOS:
        glb, csv_ruta = bajar(args.cache, organo)
        archivos[organo] = {"glb": glb, "csv": csv_ruta}
        nodos[organo] = nodos_hra(glb)
        with csv_ruta.open(encoding="utf-8") as f:
            cruces[organo] = {fila["node_name"]: (fila["OntologyID"], fila["label"]) for fila in csv.DictReader(f)}

    # ---- alineación --------------------------------------------------------
    esqueleto = {nombre: (v, c) for nombre, v, c in leer_glb(MODELOS / "skeleton.glb")}
    destino = muestrear([trimesh.Trimesh(*esqueleto[i], process=False) for i in PELVIS_DE_REFERENCIA], 4000)
    pelvis = [m for n, m in nodos["pelvis-female"].items() if n not in EXCLUIDOS]
    escala, giro, traslacion, error = icp(muestrear(pelvis, 3000), destino)
    esternon_ref = np.vstack([esqueleto[i][0] for i in ESTERNON_DE_REFERENCIA])
    esternon_hra = np.vstack([m.vertices for o in ("sternum-female", "manubrium-female") for m in nodos[o].values()])
    traslacion_torax = esternon_ref.mean(0) - (escala * esternon_hra @ giro.T).mean(0)
    print(f"pelvis: escala {escala:.4f}, giro {np.degrees(np.arccos((np.trace(giro) - 1) / 2)):.2f}°, "
          f"error medio {error * 1000:.2f} mm")
    print(f"tórax: traslación {np.round(traslacion_torax, 4).tolist()} (pelvis: {np.round(traslacion, 4).tolist()})")

    # ---- piezas ------------------------------------------------------------
    nuevas: dict[str, list[tuple[str, trimesh.Trimesh]]] = {"skeleton": [], "organs": []}
    piezas, manifiesto_nuevas = [], {}
    candidatas = []
    for organo, (_, _, capa, ancla) in ORGANOS.items():
        if capa is None:
            continue
        # La primera fila del cruce es el órgano entero (`VH_F_uterus`).
        raiz = next(iter(cruces[organo]))
        t = traslacion if ancla == "pelvis" else traslacion_torax
        for nombre, malla in sorted(nodos[organo].items()):
            if nombre in EXCLUIDOS:
                continue
            puesta = trimesh.Trimesh(escala * malla.vertices @ giro.T + t, malla.faces, process=True)
            candidatas.append((organo, capa, raiz, nombre, puesta))
    raiz_total = sum(np.sqrt(len(m.faces)) for *_, m in candidatas)
    for organo, capa, raiz, nombre, malla in candidatas:
        origen = len(malla.faces)
        objetivo = int(np.clip(TRIANGULOS_TOTALES * np.sqrt(origen) / raiz_total, MINIMO, MAXIMO))
        if origen > objetivo:
            v, f = fast_simplification.simplify(
                malla.vertices.astype(np.float32), malla.faces, target_reduction=1 - objetivo / origen
            )
            malla = trimesh.Trimesh(v, f, process=True)
        nuevas[capa].append((nombre, malla))
        manifiesto_nuevas[nombre] = {
            "layer": capa, "sex": "female", "triangles": int(len(malla.faces)), "sourceTriangles": origen,
            "source": f"HRA {organo} {ORGANOS[organo][0]}",
        }
        piezas.append({"meshId": nombre, **cruzar(nombre, cruces[organo], raiz, ids, por_fma),
                       "conventionalPartOf": [], "source": f"HRA {organo} {ORGANOS[organo][0]}"})

    # ---- escritura ---------------------------------------------------------
    bm.COPYRIGHT = f"{bm.COPYRIGHT} Piezas VH_F_*: {ATRIBUCION_HRA}."
    for capa, lote in nuevas.items():
        previas = [(n, trimesh.Trimesh(v, c, process=False)) for n, v, c in leer_glb(MODELOS / f"{capa}.glb")
                   if not n.startswith("VH_F_")]
        bm.escribir_glb(MODELOS / f"{capa}.glb", previas + lote)
        print(f"{capa}.glb: {len(previas)} de referencia + {len(lote)} femeninas")

    ruta_manifiesto = MODELOS / "parts-manifest.json"
    manifiesto = json.loads(ruta_manifiesto.read_text(encoding="utf-8"))
    manifiesto["parts"] = {k: v for k, v in manifiesto["parts"].items() if not k.startswith("VH_F_")}
    for ident in PELVIS_DE_REFERENCIA:
        manifiesto["parts"][ident]["sex"] = "male"
    manifiesto["parts"].update(manifiesto_nuevas)
    for capa in manifiesto["layers"]:
        manifiesto["layers"][capa]["parts"] = sum(1 for p in manifiesto["parts"].values() if p["layer"] == capa)
    manifiesto["license"] = bm.COPYRIGHT
    ruta_manifiesto.write_text(json.dumps(manifiesto, indent=1) + "\n", encoding="utf-8")

    PIEZAS_FEMENINAS.write_text(json.dumps(piezas, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")

    procedencia_ruta = DATOS / "provenance.json"
    procedencia = json.loads(procedencia_ruta.read_text(encoding="utf-8"))
    procedencia["hra"] = {
        "name": "HuBMAP Human Reference Atlas — 3D Reference Object Library",
        "repository": CDN,
        "license": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "attribution": ATRIBUCION_HRA,
        "citation": "Browne K, Schlehlein H, Herr BW II, Quardokus E, Bueckle A, Börner K. HuBMAP CCF 3D Reference "
                    "Object Library. 2024. https://humanatlas.io/3d-reference-library",
        "citationDoi": "10.48539/HBM627.VTKD.892",
        "alignment": {
            "method": "ICP de similitud (escala uniforme) de la pelvis ósea femenina contra coxales y sacro de BodyParts3D; "
                      "mamas trasladadas por el esternón",
            "scale": round(escala, 6),
            "meanErrorMm": round(error * 1000, 2),
        },
        "files": {o: {"version": ORGANOS[o][0], "glbSha256": sha256(a["glb"]), "crosswalkSha256": sha256(a["csv"])}
                  for o, a in archivos.items()},
        "partsWithMesh": len(piezas),
    }
    procedencia_ruta.write_text(json.dumps(procedencia, indent=1) + "\n", encoding="utf-8")
    print(f"{len(piezas)} piezas femeninas, {sum(p['triangles'] for p in manifiesto_nuevas.values())} triángulos")


if __name__ == "__main__":
    main()
