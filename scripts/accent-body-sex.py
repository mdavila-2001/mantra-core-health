"""Acentúa la diferencia de proporciones entre el maniquí masculino y el femenino.

Uso (desde la raíz del repo):

    python scripts/accent-body-sex.py                 # aplica el acento
    python scripts/accent-body-sex.py --guardar-base  # sólo la primera vez

## Por qué existe (2026-10-30)

Los renders de MakeHuman salen con la forma de cada sexo, pero en yeso blanco
sobre fondo claro la diferencia casi no se lee: medida sobre los WebP, los
hombros de la mujer eran apenas 5 % más angostos que los del hombre, la
cintura 5 % más fina y sólo la cadera se separaba de verdad (12 %). El cliente
no distinguía la silueta de mujer de la de hombre.

Rehacer el render con más peso en los targets de género exige Blender y los
assets de MPFB2 (`render-body-map.py`), y de ahí `gen-body-zones.py`; ninguno
está disponible donde se hizo este cambio (los PNG de origen y
`landmarks.json` no se versionan). Esto es el atajo honesto: **una
deformación horizontal por filas** de los WebP ya generados, aplicada igual a
la imagen y a las zonas, que exagera lo que el render ya traía.

## Qué hace

Para cada fila de la figura, estira o encoge el cuerpo respecto del eje
central (`x = 120` en el `viewBox`) con un factor que depende de la altura:

- mujer: hombros más angostos, cintura más fina, cadera y muslos más anchos;
- hombre: hombros y pecho más anchos, cadera apenas más angosta.

Los factores son suaves (interpolación lineal entre las marcas de `ACENTO`) y
nunca pasan de ±10 %: la figura se sigue leyendo como el mismo maniquí. La
cabeza y las piernas bajo la rodilla no se tocan. La cara y el maniquí neutro
tampoco.

El **mismo** factor se aplica a cada vértice de cada zona (`d` y `centros`) de
`body-zones.geometry.ts`, así que las zonas siguen calzando con el cuerpo.

## Es idempotente

Parte siempre de los originales sin acentuar, guardados en
`scripts/body-map-base/` (`--guardar-base` los toma de `public/body-map/` y de
`body-zones.geometry.ts` **antes** de aplicar nada). Correrlo dos veces da el
mismo resultado. Si algún día se rehace el render, se corre `gen-body-zones.py`,
se vuelve a guardar la base y se aplica de nuevo; o se sube el peso de los
targets en `render-body-map.py` y se retira este acento.

Requiere `pillow` y `numpy`.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
BASE = RAIZ / "scripts" / "body-map-base"
PUBLICO = RAIZ / "public" / "body-map"
GEOMETRIA = (
    RAIZ / "src/app/shared/components/organisms/body-map/body-zones.geometry.ts"
)

EJE_X = 120.0
ALTO_VIEWBOX = 440.0

# Marcas (altura como fracción del alto de la figura, factor horizontal).
# Entre marcas se interpola en línea recta; fuera de ellas vale 1.
ACENTO: dict[str, list[tuple[float, float]]] = {
    "female": [
        (0.15, 1.00),
        (0.20, 0.93),  # hombros
        (0.26, 0.92),
        (0.32, 0.94),
        (0.37, 0.93),  # cintura
        (0.42, 1.00),
        (0.47, 1.06),  # cadera
        (0.53, 1.08),
        (0.60, 1.05),  # muslos
        (0.68, 1.02),
        (0.80, 1.00),
    ],
    "male": [
        (0.15, 1.00),
        (0.20, 1.06),  # hombros
        (0.26, 1.07),
        (0.32, 1.04),  # pecho
        (0.37, 1.01),  # cintura
        (0.42, 0.98),
        (0.48, 0.95),  # cadera
        (0.54, 0.95),
        (0.62, 0.98),
        (0.74, 1.00),
    ],
}

SEXOS = {"female": "FEMENINA", "male": "MASCULINA"}
VISTAS = {"front": "frente", "back": "espalda"}


def factor(sexo: str, fraccion: float) -> float:
    marcas = ACENTO[sexo]
    if fraccion <= marcas[0][0] or fraccion >= marcas[-1][0]:
        return 1.0
    for (y0, f0), (y1, f1) in zip(marcas, marcas[1:]):
        if y0 <= fraccion <= y1:
            return f0 + (f1 - f0) * (fraccion - y0) / (y1 - y0)
    return 1.0


# ─── La imagen ──────────────────────────────────────────────────────────────


def deformar_imagen(origen: Path, destino: Path, sexo: str) -> None:
    imagen = np.asarray(Image.open(origen).convert("RGBA"), dtype=np.float64) / 255.0
    alto, ancho, _ = imagen.shape
    # Premultiplicado: al mezclar píxeles vecinos, el borde transparente no
    # tiñe el contorno.
    premult = imagen.copy()
    premult[..., :3] *= premult[..., 3:4]

    centro = ancho / 2.0
    xs = np.arange(ancho, dtype=np.float64)
    resultado = np.empty_like(premult)
    for fila in range(alto):
        f = factor(sexo, (fila + 0.5) / alto)
        origen_x = centro + (xs - centro) / f
        izq = np.clip(np.floor(origen_x).astype(int), 0, ancho - 1)
        der = np.clip(izq + 1, 0, ancho - 1)
        t = (origen_x - np.floor(origen_x))[:, None]
        valido = ((origen_x >= 0) & (origen_x <= ancho - 1))[:, None]
        mezcla = premult[fila, izq] * (1 - t) + premult[fila, der] * t
        resultado[fila] = np.where(valido, mezcla, 0.0)

    alfa = resultado[..., 3:4]
    color = np.divide(resultado[..., :3], alfa, out=np.zeros_like(resultado[..., :3]), where=alfa > 1e-6)
    salida = np.concatenate([np.clip(color, 0, 1), np.clip(alfa, 0, 1)], axis=2)
    Image.fromarray((salida * 255.0 + 0.5).astype(np.uint8), "RGBA").save(
        destino, "WEBP", quality=88, method=6
    )


# ─── Las zonas ──────────────────────────────────────────────────────────────


def numero(valor: float) -> str:
    texto = f"{valor:.1f}"
    return texto[:-2] if texto.endswith(".0") else texto


def mover(sexo: str, x: float, y: float) -> tuple[float, float]:
    f = factor(sexo, y / ALTO_VIEWBOX)
    return EJE_X + (x - EJE_X) * f, y


def deformar_trazo(sexo: str, d: str) -> str:
    # Los trazos del generador son absolutos: «M x y x y … Z», sin curvas.
    def un_subtrazo(m: re.Match[str]) -> str:
        cifras = [float(n) for n in m.group(1).split()]
        puntos = [mover(sexo, cifras[i], cifras[i + 1]) for i in range(0, len(cifras), 2)]
        return "M" + " ".join(f"{numero(x)} {numero(y)}" for x, y in puntos) + "Z"

    return re.sub(r"M([^MZ]+)Z", un_subtrazo, d)


def deformar_centros(sexo: str, centros: list[list[float]]) -> list[list[float]]:
    return [[round(v, 1) for v in mover(sexo, x, y)] for x, y in centros]


RE_CENTROS = re.compile(r"centros: (\[\[[^a-zA-Z]*?\]\])")
RE_D = re.compile(r"(?<!\w)d: '([^']*)'")


def leer_zonas(lineas: list[str]) -> dict[str, dict[str, dict[str, object]]]:
    """`{exportación: {vista: {zona: {d, centros}}}}` de las vistas con cuerpo."""
    zonas: dict[str, dict[str, dict[str, object]]] = {}
    exportacion = vista = None
    for linea in lineas:
        m = re.match(r"export const VISTAS_DEL_CUERPO(\w*):", linea)
        if m:
            exportacion = m.group(1) or "NEUTRA"
        m = re.match(r"    id: '(frente|espalda|cara)',", linea)
        if m:
            vista = m.group(1)
        m = re.match(r"\s*\{ id: '(\w+)',", linea)
        if m and exportacion and vista:
            centros = RE_CENTROS.search(linea)
            d = RE_D.search(linea)
            if centros and d:
                zonas.setdefault(exportacion, {}).setdefault(vista, {})[m.group(1)] = {
                    "d": d.group(1),
                    "centros": json.loads(centros.group(1)),
                }
    return zonas


def guardar_base() -> None:
    BASE.mkdir(parents=True, exist_ok=True)
    for sexo in SEXOS:
        for vista in VISTAS:
            nombre = f"{sexo}-{vista}.webp"
            shutil.copyfile(PUBLICO / nombre, BASE / nombre)
    zonas = leer_zonas(GEOMETRIA.read_text(encoding="utf-8").splitlines())
    (BASE / "zonas.json").write_text(
        json.dumps(zonas, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"base guardada en {BASE.relative_to(RAIZ)}")


def aplicar() -> None:
    base_zonas = json.loads((BASE / "zonas.json").read_text(encoding="utf-8"))

    for sexo in SEXOS:
        for vista in VISTAS:
            nombre = f"{sexo}-{vista}.webp"
            deformar_imagen(BASE / nombre, PUBLICO / nombre, sexo)
            peso = (PUBLICO / nombre).stat().st_size
            print(f"  {nombre}: {peso / 1024:.0f} KB")

    lineas = GEOMETRIA.read_text(encoding="utf-8").split("\n")
    exportacion = vista = None
    cambiadas = 0
    for i, linea in enumerate(lineas):
        m = re.match(r"export const VISTAS_DEL_CUERPO(\w*):", linea)
        if m:
            exportacion = m.group(1) or "NEUTRA"
        m = re.match(r"    id: '(frente|espalda|cara)',", linea)
        if m:
            vista = m.group(1)
        m = re.match(r"\s*\{ id: '(\w+)',", linea)
        if not (m and exportacion and vista):
            continue
        sexo = next((s for s, e in SEXOS.items() if exportacion == "_" + e), None)
        if sexo is None or vista == "cara":
            continue
        base = base_zonas[exportacion][vista][m.group(1)]
        d_nuevo = deformar_trazo(sexo, base["d"])
        c_nuevo = (
            "["
            + ", ".join(f"[{numero(x)}, {numero(y)}]" for x, y in deformar_centros(sexo, base["centros"]))
            + "]"
        )
        nueva = RE_D.sub(lambda _: f"d: '{d_nuevo}'", linea)
        nueva = RE_CENTROS.sub(lambda _: f"centros: {c_nuevo}", nueva)
        lineas[i] = nueva
        cambiadas += 1
    GEOMETRIA.write_text("\n".join(lineas), encoding="utf-8")
    print(f"  {cambiadas} zonas deformadas en {GEOMETRIA.name}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--guardar-base", action="store_true")
    args = ap.parse_args()
    if args.guardar_base:
        guardar_base()
    else:
        aplicar()


if __name__ == "__main__":
    main()
