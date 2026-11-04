"""Geometry helpers for `split-body-zones.py`: SVG paths <-> shapely, and the cuts."""

from __future__ import annotations

import math
from itertools import pairwise

from shapely import affinity
from shapely.geometry import MultiPolygon, Polygon, box
from shapely.ops import polylabel

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
    simple = geom.simplify(0.15, preserve_topology=True)
    denso = simple.segmentize(10)
    # shapely's segmentize can collapse an odd ring to nothing: keep the plain shape then.
    for pol in polygons(denso if denso.area > 0.99 * simple.area else simple):
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
    # The rotation may flip the part: then cut from the other end, so the
    # fractions always start at the proximal (highest) end.
    if affinity.rotate(rows_y(upright, [0.5])[0], -turn, origin=(mx, my)).centroid.y > my:
        fracs = [1 - f for f in reversed(fracs)]
        return [affinity.rotate(s, -turn, origin=(mx, my)) for s in rows_y(upright, fracs)][::-1]
    return [affinity.rotate(s, -turn, origin=(mx, my)) for s in rows_y(upright, fracs)]


def by_side(geom, cx):
    """Each part to the side of its centroid: (viewer-left, viewer-right)."""
    left = [p for p in polygons(geom) if p.centroid.x < cx]
    right = [p for p in polygons(geom) if p.centroid.x >= cx]
    return MultiPolygon(left) if left else None, MultiPolygon(right) if right else None


def jaw_box(zones):
    """From the cheeks' lower edge down to a little under the mouth: jaw and chin."""
    _, by0, _, by1 = zones["boca"].bounds
    return box(-BIG, by0 - 6, BIG, by1 + 16)


def face(geom, zones, cx, add, sided):
    """The face around eyes and mouth: crown, forehead, temples, eyes with their
    orbit, cheeks, jaw and chin. Rows by the eyes' and the mouth's bounds."""
    ox0, oy0, ox1, oy1 = zones["ojos"].bounds
    bx0, by0, bx1, by1 = zones["boca"].bounds
    ear_l, ear_r = halves(zones["oidos"], cx)
    beyond_ears = box(-BIG, -BIG, ear_l.bounds[2], BIG).union(box(ear_r.bounds[0], -BIG, BIG, BIG))
    neck_top = zones["garganta"].intersection(box(-BIG, -BIG, BIG, by0 - 6))  # reaches the cheeks
    top = geom.intersection(box(-BIG, -BIG, BIG, oy0 - 31))
    brow = geom.intersection(box(-BIG, oy0 - 31, BIG, oy0 - 3))
    forehead = brow.intersection(box(cx - 30, -BIG, cx + 30, BIG))
    whole = geom.union(neck_top).buffer(1).buffer(-1)  # the two cells only touch: close the slit
    eye_row = whole.intersection(box(-BIG, oy0 - 3, BIG, oy1 + 2))
    orbits = eye_row.intersection(box(ox0 - 3, -BIG, ox1 + 3, BIG))  # lids and orbit go with the eye
    cheeks = whole.intersection(box(-BIG, oy1 + 2, BIG, by0 - 6))
    low = geom.union(zones["garganta"]).intersection(jaw_box(zones))
    lips = low.intersection(box(bx0 - 4, -BIG, bx1 + 4, by1))  # upper lip and mouth corners go with the mouth
    lobes = cheeks.union(low).intersection(beyond_ears)  # the earlobe hangs below the ear cell
    cheeks, low = cheeks.difference(lobes), low.difference(lips).difference(lobes)
    chin = low.intersection(box(cx - 16, by1 - 4, cx + 16, BIG))
    add("coronilla", "cabeza", top)
    add("frente", "cabeza", forehead)
    sided("sien", "cabeza", halves(brow.difference(forehead).union(eye_row.difference(orbits)), cx))
    sided("ojo", "ojos", halves(zones["ojos"].union(orbits), cx))
    sided("oido", "oidos", halves(zones["oidos"].union(lobes), cx))
    mouth = zones["boca"].union(lips)
    add("boca", "boca", mouth.buffer(1).buffer(-1).intersection(mouth.convex_hull))  # no seams between lip and mouth
    sided("mejilla", "cabeza", halves(cheeks, cx))
    sided("mandibula", "cabeza", halves(low.difference(chin), cx))
    add("menton", "cabeza", chin)
