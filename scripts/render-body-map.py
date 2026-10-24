"""Renderiza el maniquí clínico 3D de `app-body-map` y sus puntos anatómicos.

Uso (headless, desde la raíz del repo):

    blender -b -P scripts/render-body-map.py -- \
        --mpfb <ruta a mpfb2-2.0.18/src/mpfb/data> \
        --out scripts/body-map-render [--samples 256] [--only male:front]

Escribe, por sexo (`male`, `female`, `neutral`) y vista (`front`, `back`,
`face`), un PNG RGBA con fondo transparente y un `landmarks.json` con:

- el encuadre de cada vista (qué rectángulo del mundo cae en el `viewBox`);
- los puntos anatómicos de MakeHuman (los grupos `joint-*` de la malla base:
  cuello, hombros, codos, muñecas, cadera, rodillas, ojos…) proyectados a
  coordenadas del `viewBox`.

`scripts/gen-body-zones.py` lee las dos cosas: la silueta sale de la máscara
alfa del PNG y las celdas de las zonas se ubican con esos puntos, así cada
zona clicable calza con la imagen. Este script no corre en el build: los WebP
que produce `gen-body-zones.py` se versionan en `public/body-map/`.

## Procedencia del cuerpo

Malla base y targets de **MakeHuman**, tal como los distribuye el complemento
**MPFB2 v2.0.18** para Blender
(https://github.com/makehumancommunity/mpfb2/archive/refs/tags/v2.0.18.tar.gz,
descargado el 2026-10-23). Los assets (`src/mpfb/data/`) son **CC0 1.0**
(`LICENSE.ASSETS.md` del paquete); el código del complemento es GPL y **no se
usa**: este script lee la malla y los targets directamente.

## Por qué un maniquí y no una persona

Decisión del propietario (2026-10-23): figura de estudio, piel neutra mate,
sin pezones ni genitales detallados, apta para cualquier paciente. Por eso se
dibuja sólo el grupo `body` de la malla (sin pelo, dientes, pestañas ni el
`helper-genital`) con un material único, como un maniquí de yeso cálido.

## Las tres proporciones

Macro de MakeHuman con edad 25, músculo y peso promedio, y las tres razas por
tercios: `male` = género 1, `female` = género 0, `neutral` = 0,5 (la malla
base sin targets de género). En MakeHuman los targets `<raza>-<sexo>-young`
llevan la forma de sexo y edad; los `universal-*-averagemuscle-averageweight`
son nulos (la malla base ya es el promedio), así que no se cargan.

## Postura

La malla base de MakeHuman ya está en postura A. Los brazos se acercan un
poco al tronco (`ARM_DROP_DEG`) girando los vértices del brazo alrededor del
hombro con los pesos del rig estándar, para que la figura entre en un
`viewBox` vertical sin achicarse y sin que brazo y costado se toquen.
"""

from __future__ import annotations

import argparse
import gzip
import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

RACES = ("african", "asian", "caucasian")
SEXES = {"male": 1.0, "female": 0.0, "neutral": 0.5}

# El viewBox de cada vista: el de siempre del organismo, más ancho en el cuerpo
# para que entren los brazos del maniquí sin achicarlo.
BODY_VIEWBOX = (240.0, 440.0)
FACE_VIEWBOX = (200.0, 240.0)
# Margen alrededor de la figura, en unidades del viewBox.
BODY_MARGIN_TOP = 6.0
BODY_MARGIN_BOTTOM = 8.0

# Cuántos grados se bajan los brazos desde la postura A de la malla base.
ARM_DROP_DEG = 22.0

# Material del maniquí: yeso cálido mate (sRGB).
MANNEQUIN_SRGB = (0.80, 0.775, 0.74)
RENDER_PX_PER_UNIT = 5  # 240×440 → 1200×2200 px; gen-body-zones lo reduce.


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--mpfb", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--samples", type=int, default=256)
    p.add_argument("--only", default=None, help="sexo:vista, p. ej. male:front")
    p.add_argument("--scale", type=float, default=1.0, help="escala de resolución")
    p.add_argument("--landmarks-only", action="store_true", help="sólo landmarks.json, sin render")
    return p.parse_args(argv)


# ─── Malla base y targets ──────────────────────────────────────────────────


def read_obj(path: Path):
    """Vértices, caras por grupo y vértices por grupo de `base.obj`."""
    verts: list[tuple[float, float, float]] = []
    faces: dict[str, list[list[int]]] = {}
    group = "default"
    for line in path.read_text().splitlines():
        if line.startswith("v "):
            _, x, y, z = line.split()[:4]
            verts.append((float(x), float(y), float(z)))
        elif line.startswith("g "):
            group = line[2:].strip()
        elif line.startswith("f "):
            idx = [int(tok.split("/")[0]) - 1 for tok in line.split()[1:]]
            faces.setdefault(group, []).append(idx)
    return np.array(verts, dtype=np.float64), faces


def read_target(path: Path) -> tuple[np.ndarray, np.ndarray]:
    rows = [
        line.split()
        for line in gzip.open(path, "rt").read().splitlines()
        if line and not line.startswith("#")
    ]
    if not rows:
        return np.zeros(0, dtype=int), np.zeros((0, 3))
    arr = np.array(rows, dtype=np.float64)
    return arr[:, 0].astype(int), arr[:, 1:4]


def shaped_vertices(base: np.ndarray, data: Path, gender: float) -> np.ndarray:
    """La malla base con la macro de MakeHuman para ese género (edad 25)."""
    out = base.copy()
    macro = data / "targets" / "macrodetails"
    for race in RACES:
        for sex, weight in (("male", gender), ("female", 1.0 - gender)):
            w = weight / len(RACES)
            if w == 0:
                continue
            idx, delta = read_target(macro / f"{race}-{sex}-young.target.gz")
            out[idx] += w * delta
    return out


def joint_centers(verts: np.ndarray, faces: dict[str, list[list[int]]]) -> dict[str, np.ndarray]:
    """Centro de cada cubo `joint-*`: los puntos anatómicos de MakeHuman."""
    centers = {}
    for name, fs in faces.items():
        if name.startswith("joint-"):
            ids = sorted({i for f in fs for i in f})
            centers[name[len("joint-") :]] = verts[ids].mean(axis=0)
    return centers


def neighbours(n_verts: int, faces: list[list[int]]) -> list[np.ndarray]:
    sets: list[set[int]] = [set() for _ in range(n_verts)]
    for f in faces:
        for a, b in zip(f, f[1:] + f[:1]):
            sets[a].add(b)
            sets[b].add(a)
    return [np.array(sorted(s), dtype=int) for s in sets]


def laplacian_smooth(verts: np.ndarray, adj: list[np.ndarray], weight: np.ndarray, iterations: int) -> np.ndarray:
    """Alisado laplaciano sólo donde `weight` > 0 (con caída suave)."""
    out = verts.copy()
    active = np.flatnonzero(weight > 0)
    for _ in range(iterations):
        avg = np.array([out[adj[i]].mean(axis=0) if len(adj[i]) else out[i] for i in active])
        out[active] += 0.5 * weight[active, None] * (avg - out[active])
    return out


def resurface_disc(verts: np.ndarray, ids: np.ndarray, tip: np.ndarray, inner: float, outer: float) -> np.ndarray:
    """Rehace un disco de la superficie (pezón y areola) con la curva del busto.

    Ajusta z = f(x, y) cuadrática por mínimos cuadrados al anillo que rodea el
    disco (sólo la cara de adelante) y lleva los vértices de adentro a esa
    superficie, con un borde suave. El pecho conserva su volumen; lo que
    desaparece es el relieve chico.
    """
    out = verts.copy()
    v = verts[ids]
    d = np.linalg.norm(v - tip, axis=1)
    front = v[:, 2] > tip[2] - outer
    ring = (d >= inner) & (d < outer) & front
    disc = (d < inner) & front
    x, y = v[ring, 0] - tip[0], v[ring, 1] - tip[1]
    design = np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], axis=1)
    coef, *_ = np.linalg.lstsq(design, v[ring, 2], rcond=None)
    xi, yi = v[disc, 0] - tip[0], v[disc, 1] - tip[1]
    fitted = np.stack([np.ones_like(xi), xi, yi, xi * xi, xi * yi, yi * yi], axis=1) @ coef
    t = d[disc] / inner
    keep = np.clip((t - 0.75) / 0.25, 0, 1) ** 2
    target_ids = ids[disc]
    out[target_ids, 2] = keep * v[disc, 2] + (1 - keep) * fitted
    return out


def falloff(verts: np.ndarray, center: np.ndarray, radius: float) -> np.ndarray:
    d = np.linalg.norm(verts - center, axis=1)
    return np.clip(1.0 - d / radius, 0.0, 1.0) ** 0.7


def nipple_vertices(female: np.ndarray, body_faces: list[list[int]], joints: dict[str, np.ndarray]) -> list[int]:
    """Índice del vértice del pezón de cada lado, buscado en la forma femenina.

    Es la punta más adelantada de cada pecho entre la clavícula y el abdomen.
    Se busca en la femenina porque ahí el pecho sobresale sin ambigüedad; en
    un pecho plano el punto más adelantado puede ser el pectoral. Como los
    targets sólo mueven vértices, el mismo índice vale para las tres formas.
    """
    body_ids = np.array(sorted({i for f in body_faces for i in f}))
    v = female[body_ids]
    clav_y = joints["l-clavicle"][1]
    belly_y = joints["spine-2"][1]
    shoulder_x = joints["l-shoulder"][0]
    found = []
    for sign in (1.0, -1.0):
        x = sign * v[:, 0]
        region = (v[:, 1] < clav_y) & (v[:, 1] > belly_y) & (x > 0.15 * shoulder_x) & (x < 0.85 * shoulder_x)
        found.append(int(body_ids[region][np.argmax(v[region][:, 2])]))
    return found


def mannequin_smoothing(
    verts: np.ndarray, body_faces: list[list[int]], joints: dict[str, np.ndarray], nipples: list[int]
) -> np.ndarray:
    """Borra pezones y el relieve de la ingle: es un maniquí apto para todo público.

    El pezón llega por índice (`nipple_vertices`); la ingle se busca en la
    malla ya formada: el punto más adelantado del pubis sobre la entrepierna.
    """
    body_ids = np.array(sorted({i for f in body_faces for i in f}))
    adj = neighbours(len(verts), body_faces)
    v = verts[body_ids]
    knee_y = joints["l-knee"][1]
    pelvis_y = joints["pelvis"][1]
    mid = np.abs(v[:, 0]) < 0.08
    low = mid & (v[:, 1] < pelvis_y) & (v[:, 1] > knee_y)
    crotch_y = v[low][:, 1].min()
    pubis_region = mid & (v[:, 1] > crotch_y) & (v[:, 1] < crotch_y + 0.9)
    pubis = v[pubis_region][np.argmax(v[pubis_region][:, 2])]
    groin = np.zeros(len(verts))
    groin[body_ids] = falloff(v, pubis, 1.0)
    # Pezón y areola: la superficie del busto, rehecha sin el relieve.
    smoothed = verts
    for nipple in nipples:
        smoothed = resurface_disc(smoothed, body_ids, verts[nipple], inner=0.3, outer=0.55)
    return laplacian_smooth(smoothed, adj, groin, iterations=40)


def lower_arms(verts: np.ndarray, data: Path, joints: dict[str, np.ndarray]) -> np.ndarray:
    """Acerca los brazos al tronco girándolos alrededor del hombro.

    Peso de cada vértice = suma de los pesos de los huesos del brazo en el rig
    estándar, así el deltoides se dobla suave en vez de cortarse.
    """
    weights = json.loads((data / "rigs/standard/weights.default.json").read_text())["weights"]
    out = verts.copy()
    for side, sign in ((".L", 1.0), (".R", -1.0)):
        w = np.zeros(len(verts))
        for bone, pairs in weights.items():
            if not bone.endswith(side):
                continue
            if bone.startswith(("upperarm", "lowerarm", "wrist", "finger", "metacarpal")):
                for vi, vw in pairs:
                    w[vi] += vw
            elif bone.startswith("shoulder"):
                for vi, vw in pairs:
                    w[vi] += 0.3 * vw
        w = np.clip(w, 0, 1)
        pivot = joints["l-shoulder" if side == ".L" else "r-shoulder"]
        # MakeHuman: x hacia la izquierda del sujeto en .L (x>0), y arriba.
        ang = -sign * math.radians(ARM_DROP_DEG)
        rel = verts - pivot
        cos_a, sin_a = np.cos(ang * w), np.sin(ang * w)
        x = rel[:, 0] * cos_a - rel[:, 1] * sin_a
        y = rel[:, 0] * sin_a + rel[:, 1] * cos_a
        moved = np.stack([x, y, rel[:, 2]], axis=1) + pivot
        mask = w > 0
        out[mask] = moved[mask]
    return out


def to_blender(v: np.ndarray) -> np.ndarray:
    """MakeHuman (y arriba, z al frente) → Blender (z arriba, mira a −y)."""
    return np.stack([v[:, 0], -v[:, 2], v[:, 1]], axis=1)


def build_mesh(name: str, verts: np.ndarray, faces: list[list[int]]):
    used = sorted({i for f in faces for i in f})
    remap = {old: new for new, old in enumerate(used)}
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts[used].tolist(), [], [[remap[i] for i in f] for f in faces])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    for poly in mesh.polygons:
        poly.use_smooth = True
    sub = obj.modifiers.new("subsurf", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    return obj


# ─── Escena ────────────────────────────────────────────────────────────────


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    try:
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for dev in prefs.devices:
            dev.use = True
        scene.cycles.device = "GPU"
    except Exception:  # noqa: BLE001 — sin GPU, CPU
        scene.cycles.device = "CPU"
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.color_depth = "16"
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Base Contrast"
    scene.cycles.use_denoising = True
    return scene


def srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def mannequin_material():
    mat = bpy.data.materials.new("mannequin")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*[srgb_to_linear(c) for c in MANNEQUIN_SRGB], 1)
    bsdf.inputs["Roughness"].default_value = 0.62
    bsdf.inputs["Subsurface Weight"].default_value = 0.12
    bsdf.inputs["Subsurface Radius"].default_value = (0.6, 0.45, 0.35)
    bsdf.inputs["Subsurface Scale"].default_value = 0.05
    bsdf.inputs["Coat Weight"].default_value = 0.08
    bsdf.inputs["Coat Roughness"].default_value = 0.35
    return mat


def world_light(scene):
    world = bpy.data.worlds.new("studio")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.62, 0.64, 0.68, 1)
    bg.inputs["Strength"].default_value = 0.14
    scene.world = world


def area_light(name, loc, target, size, energy, color=(1, 1, 1)):
    data = bpy.data.lights.new(name, "AREA")
    data.shape = "RECTANGLE"
    data.size, data.size_y = size
    data.energy = energy
    data.color = color
    obj = bpy.data.objects.new(name, data)
    obj.location = loc
    direction = Vector(target) - Vector(loc)
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(obj)
    return obj


def studio_lights(center: Vector, height: float, facing: float):
    """Luz de estudio: principal arriba a la izquierda, relleno, y contraluz.

    `facing` = −1 cuando la cámara mira la espalda (la luz gira con ella, así
    la espalda tiene el mismo modelado que el frente).
    """
    h = height
    s = facing
    area_light("key", center + Vector((-0.9 * h * s, -1.3 * h * s, 0.55 * h)), center, (0.9 * h, 0.9 * h), 130 * h * h)
    area_light("fill", center + Vector((1.2 * h * s, -1.0 * h * s, 0.1 * h)), center, (1.2 * h, 1.2 * h), 14 * h * h, (0.96, 0.98, 1.0))
    area_light("rim", center + Vector((0.4 * h * s, 1.2 * h * s, 0.7 * h)), center, (0.5 * h, 0.9 * h), 80 * h * h, (1.0, 0.97, 0.93))


def ortho_camera(center_xz: tuple[float, float], width: float, facing: float):
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = width
    cam = bpy.data.objects.new("cam", cam_data)
    x, z = center_xz
    cam.location = (x, -50.0 * facing, z)
    cam.rotation_euler = (math.radians(90), 0, 0 if facing > 0 else math.radians(180))
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


# ─── Encuadre y proyección ─────────────────────────────────────────────────


def frame_for(view: str, verts_b: np.ndarray, joints_b: dict[str, np.ndarray]):
    """El rectángulo del mundo (x0, x1, z0, z1) que cae en el viewBox."""
    if view in ("front", "back"):
        vb_w, vb_h = BODY_VIEWBOX
        z_min, z_max = verts_b[:, 2].min(), verts_b[:, 2].max()
        units_per_world = (vb_h - BODY_MARGIN_TOP - BODY_MARGIN_BOTTOM) / (z_max - z_min)
        world_w = vb_w / units_per_world
        z1 = z_max + BODY_MARGIN_TOP / units_per_world
        z0 = z1 - vb_h / units_per_world
        return (-world_w / 2, world_w / 2, z0, z1)
    # Cara: busto de la coronilla al arranque del cuello, centrado en x = 0.
    vb_w, vb_h = FACE_VIEWBOX
    z_top = verts_b[:, 2].max()
    neck = joints_b["neck"][2]
    head_h = z_top - neck
    z1 = z_top + 0.06 * head_h
    z0 = neck - 0.42 * head_h
    world_h = z1 - z0
    world_w = world_h * vb_w / vb_h
    return (-world_w / 2, world_w / 2, z0, z1)


def project(point: np.ndarray, frame, viewbox, facing: float) -> list[float]:
    x0, x1, z0, z1 = frame
    vb_w, vb_h = viewbox
    x = point[0] if facing > 0 else -point[0]
    u = (x - x0) / (x1 - x0) * vb_w
    v = (z1 - point[2]) / (z1 - z0) * vb_h
    return [round(u, 2), round(v, 2)]


# ─── Principal ─────────────────────────────────────────────────────────────


def render_view(sex: str, view: str, base, faces, data: Path, out: Path, samples: int, scale: float, render: bool):
    scene = reset_scene()
    scene.cycles.samples = samples
    shaped = shaped_vertices(base, data, SEXES[sex])
    joints_mh = joint_centers(shaped, faces)
    female = shaped_vertices(base, data, SEXES["female"])
    nipples = nipple_vertices(female, faces["body"], joint_centers(female, faces))
    shaped = mannequin_smoothing(shaped, faces["body"], joints_mh, nipples)
    posed = lower_arms(shaped, data, joints_mh)
    joints_mh = joint_centers(posed, faces)
    verts_b = to_blender(posed)
    joints_b = {k: to_blender(v[None, :])[0] for k, v in joints_mh.items()}
    # El pezón no es un `joint-*`, pero es la marca de altura del pecho que
    # usa gen-body-zones.py para ubicar las costuras del tronco.
    joints_b["l-nipple"], joints_b["r-nipple"] = (to_blender(posed[[i]])[0] for i in nipples)

    # El cuerpo y los globos oculares (sin ellos la cara mira con cuencas
    # vacías). Mismo material: es un maniquí, los ojos no llevan iris.
    body_faces = faces["body"] + faces["helper-l-eye"] + faces["helper-r-eye"]
    body = build_mesh("body", verts_b, body_faces)
    body.data.materials.append(mannequin_material())
    used = sorted({i for f in body_faces for i in f})
    body_verts = verts_b[used]

    world_light(scene)
    facing = -1.0 if view == "back" else 1.0
    frame = frame_for(view, body_verts, joints_b)
    x0, x1, z0, z1 = frame
    viewbox = FACE_VIEWBOX if view == "face" else BODY_VIEWBOX
    center = Vector((0, 0, (body_verts[:, 2].min() + body_verts[:, 2].max()) / 2))
    height = body_verts[:, 2].max() - body_verts[:, 2].min()
    studio_lights(center if view != "face" else Vector((0, 0, joints_b["head"][2])), height, facing)
    ortho_camera(((x0 + x1) / 2 if facing > 0 else -(x0 + x1) / 2, (z0 + z1) / 2), max(x1 - x0, z1 - z0), facing)

    px = RENDER_PX_PER_UNIT * scale * (1.6 if view == "face" else 1.0)
    scene.render.resolution_x = round(viewbox[0] * px)
    scene.render.resolution_y = round(viewbox[1] * px)
    scene.render.resolution_percentage = 100

    target = out / f"{sex}-{view}.png"
    scene.render.filepath = str(target)
    if render:
        bpy.ops.render.render(write_still=True)

    return {
        "viewBox": list(viewbox),
        "frame": [float(c) for c in frame],
        "image": target.name,
        "landmarks": {k: project(v, frame, viewbox, facing) for k, v in joints_b.items()},
    }


def main():
    args = parse_args()
    data = args.mpfb
    args.out.mkdir(parents=True, exist_ok=True)
    base, faces = read_obj(data / "3dobjs" / "base.obj")
    only = tuple(args.only.split(":")) if args.only else None
    manifest_path = args.out / "landmarks.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    for sex in SEXES:
        for view in ("front", "back", "face"):
            if only and (sex, view) != only:
                continue
            manifest.setdefault(sex, {})[view] = render_view(
                sex, view, base, faces, data, args.out, args.samples, args.scale, not args.landmarks_only
            )
            manifest_path.write_text(json.dumps(manifest, indent=1, sort_keys=True))
            print(f"[body-map] {sex}/{view} listo", flush=True)


main()
