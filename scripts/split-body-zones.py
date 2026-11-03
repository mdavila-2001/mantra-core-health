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
import math
import re
from itertools import pairwise
from pathlib import Path

from shapely import affinity
from shapely.geometry import MultiPolygon, Polygon, box
from shapely.ops import polylabel

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "scripts/body-map-base/zonas-gruesas.ts.txt"
TARGET = ROOT / "src/app/shared/components/organisms/body-map/body-zones.generated.ts"
EXPORTS = {
    "neutro": "VISTAS_DEL_CUERPO",
    "masculino": "VISTAS_DEL_CUERPO_MASCULINA",
    "femenino": "VISTAS_DEL_CUERPO_FEMENINA",
}
BIG = 1000.0


# ─── Path <-> geometry ─────────────────────────────────────────────────────


def parse_d(d: str):
    """`M x y x y …Z` rings, combined with even-odd (holes are XOR)."""
    geom = None
    for chunk in d.split("Z"):
        nums = [float(n) for n in chunk.replace("M", " ").split()]
        if len(nums) < 6:
            continue
        ring = Polygon(list(zip(nums[::2], nums[1::2]))).buffer(0)
        geom = ring if geom is None else geom.symmetric_difference(ring)
    return geom


def polygons(geom):
    if geom is None or geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    return [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)]


def num(v):
    s = f"{v:.1f}"
    return s.removesuffix(".0")


def ring_d(coords):
    pts = []
    for p in ((round(x, 1), round(y, 1)) for x, y in coords):
        pts += [p] if not pts or p != pts[-1] else []
    if pts[0] == pts[-1]:
        pts.pop()
    return "M" + " ".join(f"{num(x)} {num(y)}" for x, y in pts) + "Z"


def to_d(geom):
    out = []
    # Straight cuts leave bare edges: a vertex every 10 units lets a per-height warp bend them.
    for pol in polygons(geom.simplify(0.15, preserve_topology=True).segmentize(10)):
        if pol.area < 1.5:  # slivers left by the cuts
            continue
        out.append(ring_d(pol.exterior.coords))
        out.extend(ring_d(i.coords) for i in pol.interiors)
    return "".join(out)


def centres(geom):
    """One point inside each part (pole of inaccessibility): where the pin goes."""
    return [(round((p := polylabel(pol, 0.2)).x, 1), round(p.y, 1)) for pol in polygons(geom) if pol.area >= 1.5]


# ─── Cuts ──────────────────────────────────────────────────────────────────


def halves(geom, cx):
    """(viewer-left, viewer-right) halves of a geometry."""
    return geom.intersection(box(-BIG, -BIG, cx, BIG)), geom.intersection(box(cx, -BIG, BIG, BIG))


def bands_x(geom, cx, centre_frac):
    """(viewer-left, centre, viewer-right) with a centre band around `cx`."""
    minx, _, maxx, _ = geom.bounds
    half = (maxx - minx) * centre_frac / 2
    left = geom.intersection(box(-BIG, -BIG, cx - half, BIG))
    mid = geom.intersection(box(cx - half, -BIG, cx + half, BIG))
    right = geom.intersection(box(cx + half, -BIG, BIG, BIG))
    return left, mid, right


def rows_y(geom, fracs):
    """Horizontal slices at fractions of the bounding-box height."""
    _, miny, _, maxy = geom.bounds
    cuts = [miny - 1] + [miny + f * (maxy - miny) for f in fracs] + [maxy + 1]
    return [geom.intersection(box(-BIG, a, BIG, b)) for a, b in pairwise(cuts)]


def along_axis(part: Polygon, fracs):
    """Slices perpendicular to the part's principal axis, top to bottom."""
    xs, ys = zip(*part.exterior.coords)
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    angle = 0.5 * math.degrees(math.atan2(2 * sxy, sxx - syy))  # major axis vs x
    turn = 90 - angle  # rotate so the major axis is vertical
    upright = affinity.rotate(part, turn, origin=(mx, my))
    pieces = [affinity.rotate(s, -turn, origin=(mx, my)) for s in rows_y(upright, fracs)]
    # The rotation may flip the part: the proximal end is the highest one.
    return pieces if pieces[0].centroid.y <= pieces[-1].centroid.y else pieces[::-1]


def by_side(geom, cx):
    """Each part to the side of its centroid: (viewer-left, viewer-right)."""
    left = [p for p in polygons(geom) if p.centroid.x < cx]
    right = [p for p in polygons(geom) if p.centroid.x >= cx]
    return MultiPolygon(left) if left else None, MultiPolygon(right) if right else None


# ─── The recipe ────────────────────────────────────────────────────────────


def split_view(view_id: str, zones: dict, cx: float):
    """Fine zones of one view: list of (id, madre, geometry)."""
    vl, vr = ("der", "izq") if view_id in ("frente", "cara") else ("izq", "der")
    out = []

    def add(zid, madre, geom):
        if geom is not None and not geom.is_empty and geom.area >= 1.5:
            out.append((zid, madre, geom))

    def sided(prefix, madre, pair):
        add(f"{prefix}-{vl}", madre, pair[0])
        add(f"{prefix}-{vr}", madre, pair[1])

    def three(madre, geom, centre_id, side_prefix, frac):
        left, mid, right = bands_x(geom, cx, frac)
        sided(side_prefix, madre, (left, right))
        add(centre_id, madre, mid)

    for zid, geom in zones.items():
        if zid in ("cabeza", "nariz", "boca", "intima"):
            add(zid, zid, geom)
        elif zid in ("garganta", "nuca"):
            three(zid, geom, zid, "cuello", 0.3)
        elif zid in ("hombros", "caderas", "ojos", "oidos"):
            sided({"hombros": "hombro", "caderas": "cadera", "ojos": "ojo", "oidos": "oido"}[zid], zid, halves(geom, cx))
        elif zid == "pecho":
            three(zid, geom, "esternon", "pecho", 0.2)
        elif zid == "estomago":
            three(zid, geom, "epigastrio", "hipocondrio", 0.34)
        elif zid == "abdomen":
            top, bottom = rows_y(geom, [0.5])
            three(zid, top, "periumbilical", "flanco", 0.34)
            three(zid, bottom, "hipogastrio", "fosa-iliaca", 0.34)
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
        elif zid in ("brazos", "manos"):
            names = ("brazo", "codo", "antebrazo") if zid == "brazos" else ("muneca", "mano")
            fracs = [0.45, 0.6] if zid == "brazos" else [0.3]
            for side, part in zip((vl, vr), by_side(geom, cx)):
                # Hands hang almost vertical and the thumb skews their axis: cut by height.
                cut = along_axis if zid == "brazos" else (lambda g, f: rows_y(g, f))
                for name, piece in zip(names, cut(part.geoms[0], fracs) if part else []):
                    add(f"{name}-{side}", zid, piece)
        elif zid == "piernas":
            knee_y = zones["rodillas"].centroid.y
            parts = polygons(geom)
            thigh = [p for p in parts if p.centroid.y < knee_y]
            shin = [p for p in parts if p.centroid.y >= knee_y]
            lower = "canilla" if view_id == "frente" else "pantorrilla"
            sided("muslo", zid, by_side(MultiPolygon(thigh), cx))
            sided(lower, zid, by_side(MultiPolygon(shin), cx))
        elif zid == "rodillas":
            sided("rodilla" if view_id == "frente" else "corva", zid, by_side(geom, cx))
        elif zid == "pies":
            ankle, foot = rows_y(geom, [0.4])
            sided("tobillo", zid, halves(ankle, cx))
            sided("pie" if view_id == "frente" else "talon", zid, halves(foot, cx))
        else:
            raise SystemExit(f"zona gruesa sin receta: {zid}")
    return out


def build():
    src = SOURCE.read_text(encoding="utf-8")
    profiles = {}
    for key, name in EXPORTS.items():
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


def overlay(profiles, folder: Path):
    from PIL import Image, ImageDraw

    folder.mkdir(parents=True, exist_ok=True)
    palette = [(230, 57, 70), (42, 157, 143), (233, 196, 106), (69, 123, 157), (244, 162, 97), (131, 56, 236)]
    for key, views in profiles.items():
        for v in views:
            img = Image.open(ROOT / "public" / v["image"].lstrip("/")).convert("RGBA")
            s = img.width / float(v["viewBox"].split()[2])
            layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
            draw = ImageDraw.Draw(layer)
            for i, (zid, _m, geom) in enumerate(v["fine"]):
                c = palette[i % len(palette)]
                for pol in polygons(geom):
                    draw.polygon([(x * s, y * s) for x, y in pol.exterior.coords], fill=c + (110,), outline=(0, 0, 0, 255))
                for x, y in centres(geom):
                    draw.text((x * s - 20, y * s - 6), zid, fill=(0, 0, 0, 255))
            Image.alpha_composite(img, layer).save(folder / f"{key}-{v['id']}.png")


HEADER = """/* ============================================================================
    The body-map zones, fine and lateralised (2026-11-03).

    **GENERATED FILE** by `scripts/split-body-zones.py` from the coarse zones
    of `scripts/gen-body-zones.py`. Do not edit by hand: change the scripts and
    run them again. Types and rationale: `body-zones.geometry.ts`.
    ========================================================================== */

import type { VistaDelCuerpo } from './body-zones.geometry';
"""


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--overlay", type=Path, default=None)
    args = p.parse_args()
    built = build()
    TARGET.write_text(ts(built), encoding="utf-8", newline="\n")
    if args.overlay:
        overlay(built, args.overlay)
    for key, views in built.items():
        print(key, [(v["id"], len(v["fine"])) for v in views])
