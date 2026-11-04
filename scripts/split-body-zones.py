"""Subdivide the coarse body-map zones into fine, lateralised ones.

Usage:  python scripts/split-body-zones.py [--overlay <folder>]   (shapely; pillow)

Input:  `scripts/body-map-base/zonas-gruesas.ts.txt`, the coarse zones written by
        `scripts/gen-body-zones.py` (and accented by `accent-body-sex.py`).
Output: `src/app/shared/components/organisms/body-map/body-zones.generated.ts`;
        with `--overlay`, the fine zones over each render (the fit check).

## Why (2026-11-03)

Paired zones ("hombros" = both shoulders, "piernas" = four pieces) could not
tell the right knee from the left one, nor the elbow from the arm. Each coarse
zone is cut here into the parts a patient points at:

- **Laterality** from the patient's point of view: in the front and face views
  the patient's right is the viewer's left; in the back view it is the
  viewer's right.
- **Limbs** are cut perpendicular to their own principal axis (A-pose arms are
  slanted): arm / elbow / forearm, wrist / hand.
- **Trunk** cells split into bands: sternum and chest sides, the nine
  abdominal regions, spine and both sides of the back.

Every fine zone keeps `madre`, the coarse id it came from: the AI reading and
the symptom table still speak in coarse ids, and the map lights every child.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

from body_zones_geom import (
    BIG,
    along_axis,
    bands_x,
    by_side,
    centres,
    face,
    halves,
    jaw_box,
    num,
    parse_d,
    polygons,
    rows_y,
    to_d,
)
from shapely.geometry import MultiPolygon, box

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "scripts/body-map-base/zonas-gruesas.ts.txt"
TARGET = ROOT / "src/app/shared/components/organisms/body-map/body-zones.generated.ts"
SOURCE_NAMES = {"neutro": "VISTAS_DEL_CUERPO", "masculino": "VISTAS_DEL_CUERPO_MASCULINA", "femenino": "VISTAS_DEL_CUERPO_FEMENINA"}
EXPORTS = {"neutro": "BODY_VIEWS", "masculino": "BODY_VIEWS_MALE", "femenino": "BODY_VIEWS_FEMALE"}


# ─── The recipe ────────────────────────────────────────────────────────────


def split_view(view_id: str, zones: dict, cx: float):
    """Fine zones of one view: list of (id, madre, geometry)."""
    vl, vr = ("der", "izq") if view_id in ("frente", "cara") else ("izq", "der")
    out = []

    def add(zid, madre, geom):
        if geom is not None and not geom.is_empty and geom.area >= 1.5:
            out.append((zid, madre, geom))

    def sided(prefix, madre, pair):
        [add(f"{prefix}-{side}", madre, g) for side, g in zip((vl, vr), pair)]

    def three(madre, geom, centre_id, side_prefix, frac):
        left, mid, right = bands_x(geom, cx, frac)
        sided(side_prefix, madre, (left, right))
        add(centre_id, madre, mid)

    bajo_costillas = {}  # side → lower chest handed to the hypochondrium

    def inner_outer(part):
        """(medial, lateral) halves of one side's part, cut at its own centroid."""
        a, b = halves(part, part.centroid.x)
        return (a, b) if part.centroid.x > cx else (b, a)

    def per_side(geom):
        return [(side, part) for side, part in zip((vl, vr), by_side(geom, cx)) if part]

    for zid, geom in zones.items():
        if zid == "abdomen":
            continue  # cut together with "estomago"
        if zid == "cabeza" and view_id == "cara":
            face(geom, zones, cx, add, sided)
        elif zid in ("ojos", "oidos", "boca") and view_id == "cara":
            continue  # cut with the face: orbit, earlobe and lips included
        elif zid in ("cabeza", "nariz", "boca", "intima"):
            add(zid, zid, geom)
        elif zid in ("garganta", "nuca"):
            if view_id == "cara":  # the jaw line hangs into the face view's neck cell
                geom = geom.difference(box(-BIG, -BIG, BIG, jaw_box(zones).bounds[3]))
            left, mid, right = bands_x(geom, cx, 0.3)
            sided("cuello", "garganta", (left, right))  # one parent in every view
            add(zid, zid, mid)
        elif zid in ("hombros", "ojos", "oidos"):
            sided({"hombros": "hombro", "ojos": "ojo", "oidos": "oido"}[zid], zid, halves(geom, cx))
        elif zid == "caderas":  # the groin is the inner half, next to the intimate zone
            for side, part in per_side(geom):
                ingle, cadera = inner_outer(part)
                add(f"ingle-{side}", zid, ingle)
                add(f"cadera-{side}", zid, cadera)
        elif zid == "pecho":
            left, mid, right = bands_x(geom, cx, 0.2)
            add("esternon", zid, mid)
            for side, part in zip((vl, vr), (left, right)):
                clav, rest = rows_y(part, [0.2])
                x0, _, x1, _ = rest.bounds  # the armpit: outer third of the upper half
                upper = rows_y(rest, [0.5])[0]
                axila = upper.intersection(box(x1 - (x1 - x0) / 3, -BIG, BIG, BIG) if x0 > cx else box(-BIG, -BIG, x0 + (x1 - x0) / 3, BIG))
                add(f"clavicula-{side}", zid, clav)
                add(f"axila-{side}", zid, axila)
                # Below the costal arch's apex is the hypochondrium, not the chest:
                # otherwise «bajo las costillas» is a thin crescent under the arch.
                costal = box(-BIG, zones["estomago"].bounds[1], BIG, BIG)
                bajo_costillas[side] = rest.intersection(costal).difference(axila)
                add(f"pecho-{side}", zid, rest.difference(axila).difference(costal))
        elif zid == "estomago":
            # Nine regions: three even rows over stomach + belly (stomach alone is twice as tall).
            upper, middle, lower = rows_y(geom.union(zones["abdomen"]), [1 / 3, 2 / 3])
            left, mid, right = bands_x(upper, cx, 0.34)
            add("epigastrio", zid, mid)
            for side, part in zip((vl, vr), (left, right)):
                add(f"hipocondrio-{side}", zid, part.union(bajo_costillas.get(side, part)))
            three("abdomen", middle, "periumbilical", "flanco", 0.34)
            three("abdomen", lower, "hipogastrio", "fosa-iliaca", 0.34)
        elif zid == "espalda":
            top, bottom = rows_y(geom, [0.5])
            three(zid, top, "columna-alta", "omoplato", 0.2)
            three(zid, bottom, "columna-media", "espalda-media", 0.2)
        elif zid == "rinones":
            three(zid, geom, "columna-lumbar", "lumbar", 0.2)
        elif zid == "gluteos":
            left, mid, right = bands_x(geom, cx, 0.14)
            coxis, low = rows_y(mid, [0.5])
            low_l, low_r = halves(low, cx)
            sided("gluteo", zid, (left.union(low_l), right.union(low_r)))
            add("coxis", zid, coxis)
        elif zid == "manos":  # the wrist is the arm's last band; here back/palm and fingers
            for side, part in per_side(geom):
                mano, dedos = rows_y(part, [0.45])
                add(f"mano-{side}", zid, mano)
                add(f"dedos-{side}", zid, dedos)
        elif zid == "brazos":
            names = ("brazo", "codo", "antebrazo", "muneca")
            for side, part in zip((vl, vr), by_side(geom, cx)):
                for name, piece in zip(names, along_axis(part.geoms[0], [0.38, 0.6, 0.8]) if part else []):
                    add(f"{name}-{side}", "manos" if name == "muneca" else zid, piece)
        elif zid == "piernas":
            knee_y = zones["rodillas"].centroid.y
            thigh = MultiPolygon([p for p in polygons(geom) if p.centroid.y < knee_y])
            shin = MultiPolygon([p for p in polygons(geom) if p.centroid.y >= knee_y])
            for side, part in per_side(thigh):
                if view_id == "frente":
                    interno, externo = inner_outer(part)
                    add(f"muslo-interno-{side}", zid, interno)
                    add(f"muslo-{side}", zid, externo)
                else:
                    add(f"muslo-posterior-{side}", zid, part)
            sided("canilla" if view_id == "frente" else "pantorrilla", zid, by_side(shin, cx))
        elif zid == "rodillas":
            sided("rodilla" if view_id == "frente" else "corva", zid, by_side(geom, cx))
        elif zid == "pies":  # front: ankle, instep, toes; back: ankle, heel
            names = ("tobillo", "pie", "dedos-pie") if view_id == "frente" else ("tobillo", "talon")
            for name, row in zip(names, rows_y(geom, [0.4, 0.72] if view_id == "frente" else [0.45])):
                sided(name, zid, halves(row, cx))
        else:
            raise SystemExit(f"zona gruesa sin receta: {zid}")
    return out


def build():
    src = SOURCE.read_text(encoding="utf-8")
    profiles = {}
    for key, name in SOURCE_NAMES.items():
        block = src.split(f"export const {name}: readonly VistaDelCuerpo[] = [")[1].split("\n];")[0]
        built = []
        for vb in block.split("\n  {\n")[1:]:
            v = {k: re.search(rf"    {k}: '([^']*)'", vb).group(1) for k in ("id", "nombre", "viewBox", "image")}
            zones = {m[1]: parse_d(m[2]) for m in re.finditer(r"\{ id: '([a-z]+)',.*?d: '([^']*)' \}", vb)}
            built.append({**v, "fine": split_view(v["id"], zones, float(v["viewBox"].split()[2]) / 2)})
        profiles[key] = built
    return profiles


def ts(profiles):
    lines = [HEADER]
    for key in ("neutro", "masculino", "femenino"):
        lines.append(f"export const {EXPORTS[key]}: readonly VistaDelCuerpo[] = [")
        for v in profiles[key]:
            head = ", ".join(f"{k}: '{v[k]}'" for k in ("id", "nombre", "viewBox", "image"))
            lines.append(f"  {{ {head}, zonas: [")
            # Tab order: top to bottom by centroid, then left to right.
            for zid, madre, geom in sorted(v["fine"], key=lambda z: (round(z[2].centroid.y / 6), z[2].centroid.x)):
                if not (d := to_d(geom)):
                    continue
                zoom = " acercaA: 'cara'," if (v["id"], zid) == ("frente", "cabeza") else ""
                pts = ", ".join(f"[{num(x)}, {num(y)}]" for x, y in centres(geom))
                lines.append(f"    {{ id: '{zid}', madre: '{madre}',{zoom} centros: [{pts}], d: '{d}' }},")
            lines.append("  ] },")
        lines += ["];", ""]
    return "\n".join(lines).rstrip("\n") + "\n"


HEADER = """/* ============================================================================
    The body-map zones, fine and lateralised (2026-11-03).

    **GENERATED FILE** by `scripts/split-body-zones.py` from the coarse zones
    of `scripts/gen-body-zones.py`. Do not edit by hand: change the scripts and
    run them again. Rationale: `body-zones.geometry.ts`.
    ========================================================================== */

import type { VistaDelCuerpo } from './body-zones.types';
"""


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--overlay", type=Path, default=None)
    args = p.parse_args()
    built = build()
    TARGET.write_text(ts(built), encoding="utf-8", newline="\n")
    if args.overlay:
        from body_zones_overlay import overlay

        overlay(built, args.overlay, polygons, centres, ROOT)
    for key, views in built.items():
        print(key, [(v["id"], len(v["fine"])) for v in views])
