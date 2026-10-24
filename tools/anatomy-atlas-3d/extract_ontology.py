#!/usr/bin/env python3
"""Destila UBERON (y el FMA que distribuye BodyParts3D) a `data/anatomy-ontology/`.

## Por qué existe

El atlas 3D necesita, por cada pieza del cuerpo, una ficha con su definición,
sus partes y sus relaciones. Todo eso tiene que salir de una fuente abierta y
citable, no de lo que alguien recuerde. Las fuentes son:

- **UBERON** (CC-BY 3.0), la release que se le pase por `--uberon`. Se queda
  con las clases humanas: las que declaran un `xref` a FMA. UBERON es
  multiespecie; el FMA es la ontología de anatomía humana, así que el cruce es
  el criterio de «esto existe en el cuerpo humano» que no depende de nadie.
- **FMA** (CC-BY 3.0, Universidad de Washington), en la copia que acompaña a
  BodyParts3D (`FMA.csv`, `parts_list_e.txt`, `conventional_part_of.txt`).

## La regla

Nada que la fuente no diga se completa. Una relación entra sólo si UBERON la
declara con una de las propiedades de `RELACIONES`; una definición entra sólo
si UBERON la trae, con las referencias que la propia UBERON le pone. Lo que no
está queda vacío, y el generador lo rotula como vacío.

Se corre una vez por release; lo que se versiona es la salida (y el SHA-256 de
la entrada, para que cualquiera pueda comprobar de qué release salió).

Uso:
    python3 -I tools/anatomy-atlas-3d/extract_ontology.py \
        --uberon /ruta/uberon.obo --bp3d /ruta/BodyParts3D_data --stl-list /ruta/stl.txt
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = RAIZ / "data" / "anatomy-ontology"

# Las propiedades de relación que el atlas publica, con su nombre en castellano.
# Cualquier otra que UBERON declare (desarrollo, taxón, etc.) no entra.
RELACIONES = {
    "part_of": "forma parte de",
    "has_part": "tiene como parte",
    "innervated_by": "inervado por",
    "innervates": "inerva",
    "vessel_supplies_blood_to": "irriga",
    "indirectly_supplies": "irriga indirectamente",
    "vessel_drains_blood_from": "drena sangre de",
    "tributary_of": "tributaria de",
    "branching_part_of": "rama de",
    "connecting_branch_of": "rama comunicante de",
    "has_muscle_origin": "origen muscular en",
    "has_muscle_insertion": "inserción muscular en",
    "connected_to": "conectado con",
    "attaches_to": "se fija a",
    "adjacent_to": "adyacente a",
}

# Regiones del atlas (las de Netter) y las clases UBERON que las anclan. Una
# estructura cae en una región si alcanza alguna raíz por `part_of`/`is_a`.
REGIONES = {
    "R01": ["UBERON:0000033", "UBERON:0000974"],  # head, neck
    "R02": ["UBERON:0001137", "UBERON:0001130", "UBERON:0002240"],  # dorsum, vertebral column, spinal cord
    "R03": ["UBERON:0000915", "UBERON:0001443"],  # thoracic segment of trunk, chest
    "R04": ["UBERON:0000916"],  # abdomen
    "R05": ["UBERON:0002355", "UBERON:0001270", "UBERON:0002356"],  # pelvic region, bony pelvis, perineum
    "R06": ["UBERON:0002102", "UBERON:0001460"],  # forelimb, arm
    "R07": ["UBERON:0002103", "UBERON:0000978"],  # hindlimb, leg
}

RE_DEF = re.compile(r'^def: "((?:[^"\\]|\\.)*)"\s*\[(.*)\]', re.M)
RE_SYN = re.compile(r'^synonym: "((?:[^"\\]|\\.)*)" (EXACT|RELATED|NARROW|BROAD)', re.M)


def sha256(ruta: Path) -> str:
    h = hashlib.sha256()
    with ruta.open("rb") as f:
        for bloque in iter(lambda: f.read(1 << 20), b""):
            h.update(bloque)
    return h.hexdigest()


def desescapar(texto: str) -> str:
    return texto.replace('\\"', '"').replace("\\\\", "\\")


def leer_obo(ruta: Path):
    texto = ruta.read_text(encoding="utf-8")
    version = re.search(r"^data-version: (.+)$", texto, re.M)
    terminos = {}
    for bloque in texto.split("\n[Term]\n")[1:]:
        bloque = bloque.split("\n[")[0]
        ident = re.search(r"^id: (\S+)", bloque, re.M).group(1)
        if not ident.startswith("UBERON:"):
            continue
        nombre = re.search(r"^name: (.+)$", bloque, re.M)
        obsoleto = "\nis_obsolete: true" in "\n" + bloque
        defin = RE_DEF.search(bloque)
        # UBERON marca algunas clases con un texto de relleno («Missing
        # definition for term … Please replace it …»): eso dice que NO hay
        # definición, y se trata como tal.
        if defin and defin.group(1).startswith("Missing definition"):
            defin = None
        refs = []
        if defin:
            refs = [r.strip() for r in re.split(r",\s*(?=[A-Za-z_]+:)", defin.group(2)) if r.strip()]
            refs = [re.sub(r"\s*\{.*\}$", "", r) for r in refs]
        relaciones = []
        for linea in re.findall(r"^relationship: (\S+) (UBERON:\d+)", bloque, re.M):
            relaciones.append(linea)
        terminos[ident] = {
            "id": ident,
            "label": nombre.group(1).strip() if nombre else None,
            "obsolete": obsoleto,
            "definition": desescapar(defin.group(1)) if defin else None,
            "definitionRefs": refs,
            "exactSynonyms": sorted({desescapar(s) for s, t in RE_SYN.findall(bloque) if t == "EXACT"}),
            "otherSynonyms": sorted({desescapar(s) for s, t in RE_SYN.findall(bloque) if t != "EXACT"}),
            "fma": sorted(set(re.findall(r"^xref: FMA:(\d+)", bloque, re.M)), key=int),
            "isA": re.findall(r"^is_a: (UBERON:\d+)", bloque, re.M),
            "relations": relaciones,
        }
    return (version.group(1) if version else None), terminos


def regiones_de(terminos):
    """Cierre de `is_a` ∪ `part_of` hacia las raíces de cada región."""
    padres = defaultdict(set)
    for t in terminos.values():
        padres[t["id"]].update(t["isA"])
        padres[t["id"]].update(o for p, o in t["relations"] if p == "part_of")
    raiz_a_region = {r: reg for reg, raices in REGIONES.items() for r in raices}
    memo: dict[str, frozenset] = {}

    def subir(ident: str, pila: frozenset) -> frozenset:
        if ident in memo:
            return memo[ident]
        encontradas = set()
        if ident in raiz_a_region:
            encontradas.add(raiz_a_region[ident])
        for p in padres.get(ident, ()):
            if p not in pila:
                encontradas |= subir(p, pila | {ident})
        resultado = frozenset(encontradas)
        memo[ident] = resultado
        return resultado

    return {i: sorted(subir(i, frozenset())) for i in terminos}


def sin_lado(etiqueta: str | None) -> str:
    """«Interosseous membrane of right forearm» → «interosseous membrane of forearm»."""
    texto = re.sub(r"\b(right|left)\s+", "", (etiqueta or "").lower())
    return re.sub(r"\s+", " ", texto).strip()


def leer_bp3d(carpeta: Path, stl_lista: Path):
    etiquetas = {}
    with (carpeta / "FMA.csv").open(encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            etiquetas[fila["FMAID"]] = (fila["Preferred Label"], fila["Parent FMAID"])
    partes = {}
    with (carpeta / "parts_list_e.txt").open(encoding="utf-8") as f:
        next(f)
        for linea in f:
            ident, _, nombre = linea.rstrip("\n").partition("\t")
            partes[ident.strip('"')] = nombre
    parte_de = defaultdict(list)
    with (carpeta / "conventional_part_of.txt").open(encoding="utf-8") as f:
        next(f)
        for linea in f:
            todo, _, _, parte, _ = (linea.rstrip("\n").split("\t") + [""] * 5)[:5]
            parte_de[parte].append(todo)
    stl = {Path(l.strip()).stem for l in stl_lista.read_text().splitlines() if l.strip().endswith(".stl")}
    return etiquetas, partes, parte_de, stl


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--uberon", type=Path, required=True)
    ap.add_argument("--bp3d", type=Path, required=True)
    ap.add_argument("--stl-list", type=Path, required=True)
    args = ap.parse_args()

    version, terminos = leer_obo(args.uberon)
    humanos = {i: t for i, t in terminos.items() if not t["obsolete"] and t["fma"]}
    regiones = regiones_de({i: t for i, t in terminos.items() if not t["obsolete"]})

    def etiqueta(ident: str):
        t = terminos.get(ident)
        return t["label"] if t else None

    salida = []
    for ident in sorted(humanos, key=lambda x: int(x.split(":")[1])):
        t = humanos[ident]
        rels = [
            {"type": p, "target": o, "targetLabel": etiqueta(o), "inSubset": o in humanos}
            for p, o in t["relations"]
            if p in RELACIONES
        ]
        salida.append(
            {
                "id": ident,
                "label": t["label"],
                "fma": t["fma"],
                "definition": t["definition"],
                "definitionRefs": t["definitionRefs"],
                "exactSynonyms": t["exactSynonyms"],
                "otherSynonyms": t["otherSynonyms"],
                "isA": [{"target": o, "targetLabel": etiqueta(o), "inSubset": o in humanos} for o in t["isA"]],
                "relations": rels,
                "regions": regiones.get(ident, []),
            }
        )

    etiquetas, partes, parte_de, stl = leer_bp3d(args.bp3d, args.stl_list)
    fma_a_uberon = defaultdict(list)
    for t in salida:
        for f in t["fma"]:
            fma_a_uberon[f].append(t["id"])
    piezas = []
    for ident, nombre in partes.items():
        if ident not in stl:
            continue
        num = re.match(r"FMA(\d+)", ident)
        # Las piezas de BodyParts3D son lateralizadas («right femur»); UBERON
        # nombra la clase sin lado. Se sube UN paso por el padre que declara el
        # FMA, y sólo si ese padre es la misma estructura sin el lado («Right
        # femur» → «Femur»). Cualquier otro salto (a «Set of arteries», a «Deep
        # muscle of…») cambiaría de qué se habla, y queda sin cruzar.
        cadena = []
        uberon = []
        actual = num.group(1) if num else None
        if actual:
            cadena.append({"fma": actual, "label": etiquetas.get(actual, (None, None))[0]})
            uberon = fma_a_uberon.get(actual, [])
            padre = etiquetas.get(actual, (None, None))[1]
            if not uberon and padre and sin_lado(cadena[0]["label"]) == (etiquetas.get(padre, ("",))[0] or "").lower():
                cadena.append({"fma": padre, "label": etiquetas[padre][0]})
                uberon = fma_a_uberon.get(padre, [])
        piezas.append(
            {
                "meshId": ident,
                "fma": num.group(1) if num else None,
                "label": nombre,
                "fmaLabel": etiquetas.get(num.group(1), (None, None))[0] if num else None,
                "conventionalPartOf": parte_de.get(ident, []),
                "uberon": uberon,
                "uberonMatch": None if not uberon else ("fma_exact" if len(cadena) == 1 else "fma_parent"),
                "fmaChain": cadena,
            }
        )

    SALIDA.mkdir(parents=True, exist_ok=True)
    (SALIDA / "uberon-human.json").write_text(
        json.dumps(salida, ensure_ascii=False, indent=0, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    (SALIDA / "bodyparts3d-parts.json").write_text(
        json.dumps(piezas, ensure_ascii=False, indent=0, separators=(",", ":")) + "\n", encoding="utf-8"
    )
    procedencia = {
        "uberon": {
            "release": version,
            "url": "https://github.com/obophenotype/uberon/releases/download/v"
            + (version or "").replace("releases/", "")
            + "/uberon.obo",
            "sha256": sha256(args.uberon),
            "license": "CC-BY 3.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/3.0/",
            "citation": "Mungall CJ, Torniai C, Gkoutos GV, Lewis SE, Haendel MA. Uberon, an integrative multi-species anatomy ontology. Genome Biol. 2012;13(1):R5.",
            "citationDoi": "10.1186/gb-2012-13-1-r5",
            "termsInRelease": len(terminos),
            "humanTermsKept": len(salida),
            "criterion": "clase UBERON no obsoleta con al menos un xref FMA",
        },
        "fma": {
            "source": "FMA.csv distribuido con BodyParts3D 3.0 (copia en github.com/Kevin-Mattheus-Moerman/BodyParts3D)",
            "sha256": sha256(args.bp3d / "FMA.csv"),
            "license": "CC-BY 3.0",
            "licenseUrl": "https://creativecommons.org/licenses/by/3.0/",
            "citation": "Rosse C, Mejino JLV. A reference ontology for biomedical informatics: the Foundational Model of Anatomy. J Biomed Inform. 2003;36(6):478-500.",
            "citationDoi": "10.1016/j.jbi.2003.11.007",
            "classes": len(etiquetas),
        },
        "bodyparts3d": {
            "version": "3.0 (20110915)",
            "repository": "https://github.com/Kevin-Mattheus-Moerman/BodyParts3D",
            "license": "CC-BY-SA 2.1 JP",
            "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.1/jp/",
            "attribution": "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan",
            "citation": "Mitsuhashi N, Fujieda K, Tamura T, Kawamoto S, Takagi T, Okubo K. BodyParts3D: 3D structure database for anatomical concepts. Nucleic Acids Res. 2009;37(Database issue):D782-5.",
            "citationDoi": "10.1093/nar/gkn613",
            "partsWithMesh": len(piezas),
        },
        "relationsPublished": RELACIONES,
        "regionRoots": REGIONES,
    }
    (SALIDA / "provenance.json").write_text(json.dumps(procedencia, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"UBERON {version}: {len(terminos)} clases, {len(salida)} humanas (xref FMA); {len(piezas)} piezas con malla")


if __name__ == "__main__":
    main()
