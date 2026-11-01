"""Genera `body-zones.geometry.ts` y las imágenes del maniquí a partir del render.

Uso:  python scripts/gen-body-zones.py --render <carpeta del render> [--overlay <carpeta>]

`<carpeta del render>` es la salida de `scripts/render-body-map.py` (Blender):
un PNG RGBA por sexo y vista más `landmarks.json`. Este script escribe:

- `public/body-map/<sexo>-<vista>.webp`: el maniquí, reducido y comprimido;
- `src/app/shared/components/organisms/body-map/body-zones.geometry.ts`: la
  silueta y las zonas pulsables de cada vista, en el mismo `viewBox` que la
  imagen, para que cada zona calce con el cuerpo que se ve;
- con `--overlay`, un PNG por vista con las zonas delineadas sobre el render
  (la prueba de calce).

Requiere `pillow`, `shapely` y `scikit-image`. No corre en el build: lo que
escribe se versiona y este script queda para poder rehacerlo.

## Cómo se arma (2026-10-23)

Hasta acá la figura era un dibujo vectorial esquemático hecho con curvas en
este mismo script. Ahora la figura es un **maniquí clínico renderizado** (malla
de MakeHuman, CC0; ver la cabecera de `render-body-map.py`) y las zonas se
calzan sobre él:

1. **La silueta** sale de la máscara alfa del render: el contorno del cuerpo
   que se ve es, exactamente, el contorno de la figura pulsable.
2. **Los brazos** se separan del tronco por la abertura de la axila, que se
   busca en la máscara; **las manos** se cortan en la muñeca del esqueleto,
   perpendicular al antebrazo.
3. **Las costuras del tronco** (pecho, estómago, abdomen, zona íntima,
   caderas; nuca, espalda, riñones, glúteos; rodillas, pies) son las que ya
   estaban acordadas, escritas sobre la **lámina de referencia** (la figura
   anterior: coronilla 8, mentón 65, pezones 120, ombligo 176, entrepierna
   238, rodilla 322, tobillo 414, planta 434, eje en x = 100). Se trasladan al
   maniquí con un mapeo por tramos entre esas marcas y las del render, y se
   ensanchan o angostan según el ancho del tronco a cada altura.
4. **La cara** escala sus celdas (ojos, nariz, boca, oídos) por la distancia
   entre los ojos del esqueleto.

Las celdas parten el plano sin solaparse (`repartir`): las zonas vecinas
comparten el mismo borde y entre todas cubren la figura entera.

Cada zona lleva `centros`: un punto dentro de cada parte (las dos manos son
dos partes), donde la pantalla pone el marcador de la zona elegida.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.ops import unary_union
from skimage import measure

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "src/app/shared/components/organisms/body-map/body-zones.geometry.ts"
IMAGENES = RAIZ / "public/body-map"
URL_IMAGENES = "/body-map"

# Perfil del organismo → nombre del render.
SEXOS = {"neutro": "neutral", "masculino": "male", "femenino": "female"}
VISTAS = {"frente": "front", "espalda": "back", "cara": "face"}
NOMBRE_VISTA = {"frente": "Frente", "espalda": "Espalda", "cara": "Cara"}

# Píxeles por unidad del viewBox en el WebP publicado. Desde 2026-10-29 son
# «ultra HD»: el render sale a 10 px/unidad (cuerpo) y 16 (cara) y se publica
# a 8 y 10, es decir 1920×3520 y 2000×2400. La figura entera (20rem) sigue
# nítida a 3× de densidad y el acercamiento 5× del organismo muestra píxeles
# reales hasta ~2× (antes se veía a 840×1540 y se desenfocaba a 1,5×).
DENSIDAD_WEBP = {"frente": 8.0, "espalda": 8.0, "cara": 10.0}
CALIDAD_WEBP = 82

INF = 1000.0

# ─── Lámina de referencia ──────────────────────────────────────────────────

REF_CX = 100.0
REF_MARCAS = {
    "coronilla": 8.0,
    "menton": 65.0,
    "pezon": 120.0,
    "ombligo": 176.0,
    "entrepierna": 238.0,
    "rodilla": 322.0,
    "tobillo": 414.0,
    "planta": 434.0,
}
# Medio ancho del tronco de la lámina a cada altura (sin brazos).
REF_MEDIO_ANCHO = [(100, 39.6), (120, 38.8), (150, 33.2), (176, 33.0), (200, 38.6), (214, 40.2), (236, 39.8)]
# Entre los ojos de la cara de referencia (x = 76 y 124, y = 91).
REF_OJOS_Y = 91.0
REF_DISTANCIA_OJOS = 48.0


# ─── Utilidades geométricas ────────────────────────────────────────────────


def catmull_rom(puntos, pasos=10, cerrada=False):
    """Curva Catmull-Rom centrípeta por los puntos dados, muestreada."""
    p = list(puntos)
    if cerrada:
        p = [p[-1]] + p + [p[0], p[1]]
    else:
        p = [p[0]] + p + [p[-1]]
    salida = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]

        def tj(ti, a, b):
            return ti + max(math.dist(a, b), 1e-6) ** 0.5

        t0 = 0.0
        t1 = tj(t0, p0, p1)
        t2 = tj(t1, p1, p2)
        t3 = tj(t2, p2, p3)
        for k in range(pasos):
            t = t1 + (t2 - t1) * k / pasos

            def lerp(a, b, ta, tb):
                if tb - ta == 0:
                    return a
                return (
                    (tb - t) / (tb - ta) * a[0] + (t - ta) / (tb - ta) * b[0],
                    (tb - t) / (tb - ta) * a[1] + (t - ta) / (tb - ta) * b[1],
                )

            a1 = lerp(p0, p1, t0, t1)
            a2 = lerp(p1, p2, t1, t2)
            a3 = lerp(p2, p3, t2, t3)
            b1 = lerp(a1, a2, t0, t2)
            b2 = lerp(a2, a3, t1, t3)
            salida.append(lerp(b1, b2, t1, t2))
    if not cerrada:
        salida.append(p[-2])
    return salida


def simetrica(media, cx=REF_CX):
    """Una costura simétrica a partir de su mitad izquierda (x ≤ cx)."""
    return media + [(2 * cx - x, y) for x, y in reversed(media[:-1])]


def banda(y0, y1):
    return box(-INF, y0, INF, y1)


def sobre(curva):
    """Todo lo que queda por ENCIMA de una costura (y crece hacia abajo).

    La costura es una curva de izquierda a derecha; se estira hasta los bordes
    del plano para que corte la figura de lado a lado.
    """
    c = list(curva)
    return Polygon([(-INF, c[0][1])] + c + [(INF, c[-1][1]), (INF, -INF), (-INF, -INF)]).buffer(0)


def elipse(cx, cy, rx, ry):
    return Polygon([(cx + rx * math.cos(t), cy + ry * math.sin(t)) for t in np.linspace(0, 2 * math.pi, 64)])


def poligonos(geom):
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)]


def tramos(figura, y, x_min=-INF, x_max=INF):
    """Los tramos (x0, x1) de la figura cortada por la horizontal `y`."""
    corte = figura.intersection(LineString([(x_min, y), (x_max, y)]))
    partes = [corte] if isinstance(corte, LineString) else list(getattr(corte, "geoms", []))
    return sorted((min(p.xy[0]), max(p.xy[0])) for p in partes if isinstance(p, LineString) and p.length > 0.3)


def interpolar(x, tabla):
    xs, ys = zip(*tabla)
    if x <= xs[0]:
        return ys[0] + (x - xs[0]) * (ys[1] - ys[0]) / (xs[1] - xs[0])
    if x >= xs[-1]:
        return ys[-1] + (x - xs[-1]) * (ys[-1] - ys[-2]) / (xs[-1] - xs[-2])
    return float(np.interp(x, xs, ys))


def repartir(figura, celdas):
    """Interseca en orden; cada celda se queda con lo que no tomó una anterior."""
    restante = figura
    zonas = []
    for id_, celda in celdas:
        parte = restante.intersection(celda)
        restante = restante.difference(celda)
        zonas.append((id_, parte))
    if restante.area > 0.5:
        raise SystemExit(f"quedó figura sin zona: área {restante.area:.1f}")
    return zonas


# ─── Lectura del render ────────────────────────────────────────────────────


def silueta(alfa: np.ndarray, px_por_unidad: float):
    """El contorno de la máscara alfa, en unidades del viewBox (par-impar)."""
    contornos = measure.find_contours(np.pad(alfa, 1), 0.5)
    figura = Polygon()
    for c in sorted(contornos, key=len, reverse=True):
        if len(c) < 12:
            continue
        pol = Polygon([((x - 1) / px_por_unidad, (y - 1) / px_por_unidad) for y, x in c]).buffer(0)
        if pol.area * px_por_unidad**2 < 30:
            continue
        figura = figura.symmetric_difference(pol)
    return figura.simplify(0.15, preserve_topology=True).buffer(0)


class Vista:
    """Una vista del render: su silueta, su encuadre y sus puntos anatómicos."""

    def __init__(self, render: Path, sexo: str, vista: str, datos: dict):
        self.vista = vista
        self.png = render / datos["image"]
        self.ancho, self.alto = datos["viewBox"]
        self.cx = self.ancho / 2
        self.marcas = {k: tuple(v) for k, v in datos["landmarks"].items()}
        imagen = Image.open(self.png)
        self.px_por_unidad = imagen.width / self.ancho
        alfa = np.asarray(imagen.getchannel("A"), dtype=np.float32) / 255.0
        self.figura = silueta(alfa, self.px_por_unidad)

    @property
    def viewbox(self) -> str:
        return f"0 0 {num(self.ancho)} {num(self.alto)}"

    def lado(self, nombre: str, signo: float):
        """El punto `l-`/`r-` que cae del lado `signo` del eje en esta vista."""
        for prefijo in ("l-", "r-"):
            p = self.marcas[prefijo + nombre]
            if (p[0] - self.cx) * signo > 0:
                return p
        raise KeyError(nombre)

    def media(self, nombre: str):
        a, b = self.marcas["l-" + nombre], self.marcas["r-" + nombre]
        return ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)

    def medio_ancho_tronco(self, y: float) -> float:
        for x0, x1 in tramos(self.figura, y):
            if x0 <= self.cx <= x1:
                return (x1 - x0) / 2
        return 0.0


# ─── Traslado de la lámina al maniquí ──────────────────────────────────────


class Traslado:
    """Lleva coordenadas de la lámina de referencia al viewBox del render."""

    def __init__(self, v: Vista):
        minx, miny, maxx, maxy = v.figura.bounds
        ojos_y = v.media("eye")[1]
        clavicula_y = v.media("clavicle")[1]
        # El mentón de la lámina es donde arranca el cuello: el tramo más
        # angosto entre los ojos y las clavículas.
        candidatos = np.arange(ojos_y + 4, clavicula_y, 0.25)
        menton = min(candidatos, key=v.medio_ancho_tronco)
        pezon = v.media("nipple")[1]
        entrepierna = self._entrepierna(v)
        ombligo = pezon + (entrepierna - pezon) * (176 - 120) / (238 - 120)
        marcas = {
            "coronilla": miny,
            "menton": menton,
            "pezon": pezon,
            "ombligo": ombligo,
            "entrepierna": entrepierna,
            "rodilla": v.media("knee")[1],
            "tobillo": v.media("ankle")[1],
            "planta": maxy,
        }
        self.tabla_y = sorted((REF_MARCAS[k], marcas[k]) for k in REF_MARCAS)
        self.cx = v.cx
        self.escalas = [(yr, v.medio_ancho_tronco(self.y(yr)) / ancho) for yr, ancho in REF_MEDIO_ANCHO]
        self.marcas = marcas

    @staticmethod
    def _entrepierna(v: Vista) -> float:
        y = v.marcas["pelvis"][1]
        while y < v.marcas["l-knee"][1]:
            if v.medio_ancho_tronco(y) == 0.0:
                return y
            y += 0.25
        raise SystemExit("no se encontró la entrepierna en la silueta")

    def y(self, y_ref: float) -> float:
        return interpolar(y_ref, self.tabla_y)

    def escala_x(self, y_ref: float) -> float:
        return float(np.interp(y_ref, *zip(*self.escalas)))

    def __call__(self, puntos):
        return [(self.cx + (x - REF_CX) * self.escala_x(y), self.y(y)) for x, y in puntos]

    def costura(self, media):
        return catmull_rom(self(simetrica(media)), pasos=10)


# ─── Brazos ────────────────────────────────────────────────────────────────


def brazo(v: Vista, signo: float):
    """El brazo de un lado, entero, más la altura de su axila.

    La axila es la primera horizontal, bajando desde el hombro, en la que la
    figura de ese lado se parte en dos tramos (tronco y brazo). Debajo, el
    brazo es la parte conexa que no llega al eje; arriba, lo que queda por
    afuera de la recta que sube de la axila hacia la punta del hombro.
    """
    hombro = v.lado("shoulder", signo)
    codo = v.lado("elbow", signo)
    lado = box(v.cx, -INF, INF, INF) if signo > 0 else box(-INF, -INF, v.cx, INF)
    y = hombro[1]
    while y < codo[1]:
        # Del lado elegido: el tronco es el tramo que toca el eje; el hueco de
        # la axila, el que lo separa del tramo siguiente hacia afuera.
        de_este_lado = tramos(v.figura.intersection(lado), y)
        if len(de_este_lado) >= 2:
            if signo > 0:
                hueco_x = (de_este_lado[0][1] + de_este_lado[1][0]) / 2
            else:
                hueco_x = (de_este_lado[-2][1] + de_este_lado[-1][0]) / 2
            break
        y += 0.25
    else:
        raise SystemExit(f"no se encontró la axila del lado {signo:+}")
    axila = (hueco_x, y)
    debajo = v.figura.intersection(lado).intersection(banda(axila[1], INF))
    limite = (v.cx + hueco_x) / 2
    partes_brazo = [p for p in poligonos(debajo) if (p.bounds[0] > limite if signo > 0 else p.bounds[2] < limite)]
    tope = (hombro[0] - signo * 0.2 * abs(hombro[0] - v.cx), hombro[1] - 30)
    # La recta axila → tope, prolongada, y el semiplano de afuera.
    dx, dy = tope[0] - axila[0], tope[1] - axila[1]
    largo = math.hypot(dx, dy)
    ux, uy = dx / largo, dy / largo
    a = (axila[0] - ux * INF, axila[1] - uy * INF)
    b = (axila[0] + ux * INF, axila[1] + uy * INF)
    afuera_x = INF * signo
    semiplano = Polygon([a, b, (afuera_x, b[1]), (afuera_x, a[1])]).buffer(0)
    arriba = v.figura.intersection(lado).intersection(banda(-INF, axila[1])).intersection(semiplano)
    return unary_union([*partes_brazo, arriba]).buffer(0.01), axila[1]


def mano(v: Vista, signo: float, brazo_):
    """La mano: lo que queda más allá de la muñeca, perpendicular al antebrazo."""
    codo = np.array(v.lado("elbow", signo))
    muneca = np.array(v.lado("hand", signo))
    d = (muneca - codo) / np.linalg.norm(muneca - codo)
    n = np.array([-d[1], d[0]])
    base = muneca - 2.0 * d
    semiplano = Polygon([base + n * INF, base - n * INF, base - n * INF + d * INF, base + n * INF + d * INF])
    return brazo_.intersection(semiplano)


# ─── Celdas de cada vista ──────────────────────────────────────────────────

# El hombro de la lámina: del cuello, por el trapecio, hasta bajo el deltoides.
HOMBRO = [(113, 70), (190, 70), (190, 116), (148, 117), (141, 114), (134, 104), (126, 93), (116, 85)]
# Las líneas de la ingle de la lámina: del hueso de la cadera al pubis.
INGLE = [(74, 201), (84, 220), (94, 238), (100, 247)]


def ambos_lados(t: Traslado, puntos, cx):
    derecha = Polygon(catmull_rom(t(puntos), pasos=10, cerrada=True)).buffer(0)
    espejo = Polygon([(2 * cx - x, y) for x, y in derecha.exterior.coords])
    return unary_union([derecha, espejo])


def celdas_de_cuerpo(v: Vista, frente: bool):
    t = Traslado(v)
    brazos, axilas, manos = [], [], []
    for signo in (1.0, -1.0):
        b, axila_y = brazo(v, signo)
        brazos.append(b)
        axilas.append(axila_y)
        manos.append(mano(v, signo, b))
    brazos_ = unary_union(brazos)
    trapecios = ambos_lados(t, HOMBRO, v.cx)
    hombros = unary_union([trapecios, brazos_.intersection(banda(-INF, max(axilas) + 2))])
    comunes = [
        ("hombros", hombros),
        ("manos", unary_union(manos).buffer(0.01)),
        ("brazos", brazos_),
    ]
    piernas = [
        ("pies", banda(t.y(405), INF)),
        ("rodillas", sobre(t.costura([(40, 344), (100, 344)])).difference(banda(-INF, t.y(304)))),
        ("piernas", banda(-INF, INF)),
    ]
    if frente:
        ingle = catmull_rom(t(simetrica(INGLE)), pasos=8)
        return t, [
            # La mandíbula baja hacia el mentón.
            ("cabeza", sobre(t.costura([(60, 50), (82, 57), (100, 66)]))),
            # El cuello, sin la pendiente del trapecio: esa es del hombro.
            ("garganta", sobre(t.costura([(60, 80), (84, 88), (100, 90)])).difference(trapecios)),
            *comunes,
            # El arco de las costillas: alto en el esternón, bajo a los costados.
            ("pecho", sobre(t.costura([(50, 150), (70, 146), (88, 134), (100, 129)]))),
            ("estomago", sobre(t.costura([(50, 172), (76, 177), (100, 179)]))),
            ("intima", Polygon(ingle + [(v.cx, t.y(201))]).buffer(0)),
            ("abdomen", sobre(t.costura([(40, 202), (74, 201), (100, 201)]))),
            ("caderas", banda(-INF, t.y(252))),
            *piernas,
        ]
    return t, [
        ("cabeza", sobre(t.costura([(60, 54), (84, 56), (100, 58)]))),
        ("nuca", sobre(t.costura([(60, 82), (84, 88), (100, 90)])).difference(trapecios)),
        *comunes,
        ("espalda", sobre(t.costura([(40, 166), (100, 170)]))),
        # La cresta de la cadera cierra la cintura.
        ("rinones", sobre(t.costura([(40, 198), (70, 202), (100, 206)]))),
        # El pliegue del glúteo.
        ("gluteos", sobre(t.costura([(40, 238), (62, 248), (82, 256), (96, 252), (100, 245)]))),
        *piernas,
    ]


# La cara de referencia: ojos en (76, 91) y (124, 91).
REF_NARIZ = [(95, 96), (105, 96), (109.4, 112), (114.2, 123), (111, 129.4), (100, 131.6), (89, 129.4), (85.8, 123), (90.6, 112)]
REF_BOCA = [(100, 136.4), (112, 136.4), (125, 142.6), (117, 151.6), (100, 154.4), (83, 151.6), (75, 142.6), (88, 136.4)]
# La línea de la mandíbula, de oreja a oreja pasando por el mentón.
REF_MANDIBULA = [(54, 102), (58.4, 118), (63.8, 132), (71.6, 145), (81, 155.4), (91.4, 162.4), (100, 164.6)]


def celdas_de_cara(v: Vista):
    izq, der = sorted([v.marcas["l-eye"], v.marcas["r-eye"]])
    k = (der[0] - izq[0]) / REF_DISTANCIA_OJOS
    ojos_y = (izq[1] + der[1]) / 2

    def t(puntos):
        return [(v.cx + (x - REF_CX) * k, ojos_y + (y - REF_OJOS_Y) * k) for x, y in puntos]

    ojos = unary_union([elipse(x, y, 0.365 * REF_DISTANCIA_OJOS * k, 0.24 * REF_DISTANCIA_OJOS * k) for x, y in (izq, der)])
    nariz = Polygon(catmull_rom(t(REF_NARIZ), pasos=8, cerrada=True)).buffer(0)
    # La boca del maniquí cae un poco más abajo que la de la lámina.
    boca = Polygon(catmull_rom(t([(x, y + 3) for x, y in REF_BOCA]), pasos=8, cerrada=True)).buffer(0)
    # Las orejas sobresalen del cráneo: lo que pasa el ancho máximo de la
    # cabeza por encima de ellas, entre la ceja y el labio superior.
    oreja_y0, oreja_y1 = t([(0, 74)])[0][1], t([(0, 124)])[0][1]
    craneo = max(v.medio_ancho_tronco(y) for y in np.arange(t([(0, 30)])[0][1], oreja_y0 - 1, 0.25))
    orejas = banda(oreja_y0, oreja_y1).difference(box(v.cx - craneo, -INF, v.cx + craneo, INF))
    # La garganta es la columna del cuello, de la mandíbula a la clavícula; la
    # pendiente del trapecio, a los costados, ya es hombro.
    clavicula_y = v.media("clavicle")[1]
    menton_y = t([(0, 164.6)])[0][1]
    cuello_medio = min(v.medio_ancho_tronco(y) for y in np.arange(menton_y, clavicula_y, 0.25))
    costura = catmull_rom(
        simetrica([(v.cx - 40, clavicula_y + 6), (v.cx - 24, clavicula_y), (v.cx, clavicula_y - 2)], v.cx), pasos=10
    )
    # El hombro empieza donde el cuello se abre: más arriba, los costados del
    # cuello (bajo la oreja) siguen siendo garganta.
    hombro_y = next(y for y in np.arange(menton_y, clavicula_y, 0.25) if v.medio_ancho_tronco(y) > 1.4 * cuello_medio)
    columna = box(v.cx - 1.15 * cuello_medio, -INF, v.cx + 1.15 * cuello_medio, INF)
    cuello = sobre(costura).intersection(unary_union([columna, banda(-INF, hombro_y)]))
    return [
        ("oidos", orejas),
        ("ojos", ojos),
        ("nariz", nariz.difference(ojos)),
        ("boca", boca.difference(nariz)),
        ("cabeza", sobre(catmull_rom(t(simetrica(REF_MANDIBULA)), pasos=10))),
        ("garganta", cuello),
        ("hombros", banda(-INF, INF)),
    ]


# ─── Salida ────────────────────────────────────────────────────────────────


def num(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def anillo_a_d(coords):
    pts = [(round(x, 1), round(y, 1)) for x, y in coords]
    limpio = [pts[0]]
    for p in pts[1:]:
        if p != limpio[-1]:
            limpio.append(p)
    if limpio[0] == limpio[-1]:
        limpio.pop()
    return "M" + " ".join(f"{num(x)} {num(y)}" for x, y in limpio) + "Z"


def a_d(geom, tolerancia=0.2, minimo=4):
    partes = []
    for pol in poligonos(geom.simplify(tolerancia, preserve_topology=True)):
        if pol.area < minimo:  # astillas de la intersección
            continue
        partes.append(anillo_a_d(pol.exterior.coords))
        partes.extend(anillo_a_d(i.coords) for i in pol.interiors)
    return "".join(partes)


def centros(geom):
    """Un punto adentro de cada parte grande: donde va el marcador."""
    salida = []
    for pol in poligonos(geom):
        if pol.area < 20:
            continue
        # El centro del círculo más grande que entra en la parte: queda en
        # el medio visual incluso en formas cóncavas (la cara con sus huecos).
        p = polo_de_inaccesibilidad(pol)
        salida.append((round(p.x, 1), round(p.y, 1)))
    return salida


def polo_de_inaccesibilidad(pol, paso=0.5):
    minx, miny, maxx, maxy = pol.bounds
    mejor, distancia = pol.representative_point(), -1.0
    borde = pol.boundary
    for y in np.arange(miny, maxy + paso, paso):
        for x in np.arange(minx, maxx + paso, paso):
            p = Point(x, y)
            if pol.contains(p):
                d = borde.distance(p)
                if d > distancia:
                    mejor, distancia = p, d
    return mejor


def publicar_imagen(v: Vista, perfil: str, id_vista: str) -> str:
    nombre = f"{SEXOS[perfil]}-{VISTAS[id_vista]}.webp"
    densidad = DENSIDAD_WEBP[id_vista]
    imagen = Image.open(v.png).convert("RGBA")
    tamano = (round(v.ancho * densidad), round(v.alto * densidad))
    imagen.resize(tamano, Image.LANCZOS).save(IMAGENES / nombre, "WEBP", quality=CALIDAD_WEBP, method=6)
    return f"{URL_IMAGENES}/{nombre}"


COLORES = ["#e4572e", "#29335c", "#f3a712", "#669bbc", "#a8c686", "#8e44ad", "#16a085", "#c0392b"]


def superponer(v: Vista, zonas, destino: Path):
    """La prueba de calce: las zonas delineadas sobre el render."""
    base = Image.new("RGBA", Image.open(v.png).size, (247, 245, 241, 255))
    base.alpha_composite(Image.open(v.png).convert("RGBA"))
    s = v.px_por_unidad
    # Una capa por zona: dibujar todas en la misma capa RGBA reemplaza los
    # píxeles en vez de mezclarlos, y la cabeza tapaba ojos, nariz y boca.
    for i, (zid, geom) in enumerate(zonas):
        color = COLORES[i % len(COLORES)]
        rgb = tuple(int(color[j : j + 2], 16) for j in (1, 3, 5))
        capa = Image.new("RGBA", base.size, (0, 0, 0, 0))
        dibujo = ImageDraw.Draw(capa)
        for pol in poligonos(geom):
            dibujo.polygon([(x * s, y * s) for x, y in pol.exterior.coords], fill=rgb + (46,))
            for hueco in pol.interiors:
                dibujo.polygon([(x * s, y * s) for x, y in hueco.coords], fill=(0, 0, 0, 0))
            for anillo in (pol.exterior, *pol.interiors):
                dibujo.line([(x * s, y * s) for x, y in anillo.coords], fill=rgb + (255,), width=max(2, round(s * 0.5)))
        for x, y in centros(geom):
            dibujo.ellipse((x * s - 6, y * s - 6, x * s + 6, y * s + 6), fill=rgb + (255,))
            dibujo.text((x * s + 9, y * s - 7), zid, fill=(20, 20, 20, 255))
        base.alpha_composite(capa)
    base.convert("RGB").save(destino, quality=88)


def construir(render: Path, overlay: Path | None):
    manifiesto = json.loads((render / "landmarks.json").read_text())
    IMAGENES.mkdir(parents=True, exist_ok=True)
    if overlay:
        overlay.mkdir(parents=True, exist_ok=True)
    perfiles = {}
    for perfil, sexo in SEXOS.items():
        vistas = []
        for id_vista, nombre in VISTAS.items():
            v = Vista(render, sexo, id_vista, manifiesto[sexo][nombre])
            if id_vista == "cara":
                zonas = repartir(v.figura, celdas_de_cara(v))
            else:
                _t, celdas = celdas_de_cuerpo(v, frente=id_vista == "frente")
                zonas = repartir(v.figura, celdas)
            if overlay:
                superponer(v, zonas, overlay / f"{sexo}-{nombre}.png")
            vistas.append(
                {
                    "id": id_vista,
                    "nombre": NOMBRE_VISTA[id_vista],
                    "viewBox": v.viewbox,
                    "image": publicar_imagen(v, perfil, id_vista),
                    "figura": v.figura,
                    "zonas": zonas,
                }
            )
        perfiles[perfil] = vistas
    return perfiles


NOMBRE_EXPORT = {
    "neutro": "VISTAS_DEL_CUERPO",
    "masculino": "VISTAS_DEL_CUERPO_MASCULINA",
    "femenino": "VISTAS_DEL_CUERPO_FEMENINA",
}


def ts(perfiles):
    lineas = [ENCABEZADO]
    for clave in ("neutro", "masculino", "femenino"):
        lineas.append(f"export const {NOMBRE_EXPORT[clave]}: readonly VistaDelCuerpo[] = [")
        for v in perfiles[clave]:
            lineas.append("  {")
            lineas.append(f"    id: '{v['id']}',")
            lineas.append(f"    nombre: '{v['nombre']}',")
            lineas.append(f"    viewBox: '{v['viewBox']}',")
            lineas.append(f"    image: '{v['image']}',")
            lineas.append("    zonas: [")
            # El orden del tabulador: de arriba abajo por el centro de cada
            # zona y, a la misma altura, de izquierda a derecha.
            for zid, geom in sorted(v["zonas"], key=lambda z: (round(z[1].centroid.y / 4), z[1].centroid.x)):
                d = a_d(geom)
                if not d:
                    continue
                # De frente, la cabeza es chica para señalar ojos, nariz o
                # boca: tocarla acerca la vista de la cara.
                acerca = " acercaA: 'cara'," if (v["id"], zid) == ("frente", "cabeza") else ""
                pts = ", ".join(f"[{num(x)}, {num(y)}]" for x, y in centros(geom))
                lineas.append(f"      {{ id: '{zid}',{acerca} centros: [{pts}], d: '{d}' }},")
            lineas.append("    ],")
            lineas.append("  },")
        lineas.append("];")
        lineas.append("")
    return "\n".join(lineas).rstrip("\n") + "\n"


ENCABEZADO = """/* ============================================================================
    El maniquí del cuerpo y sus zonas, para señalar dónde duele con el dedo o
    con el teclado (P-01, doctor 22/09/2026; maniquí 3D, 2026-10-23).

    **ARCHIVO GENERADO** por `scripts/gen-body-zones.py` a partir del render
    de `scripts/render-body-map.py`. No se edita a mano: se cambia el script y
    se vuelve a correr (el método está en las cabeceras de los dos).

    ## Qué es y qué no es este dato

    Un maniquí clínico renderizado (malla de MakeHuman, CC0) con las zonas
    calzadas sobre su silueta. No es una lámina anatómica ni representa a
    ninguna persona: es lo que la regla 97 llama dato sintético declarado.

    ## Las tres vistas

    - **Frente** y **espalda**: la figura entera en postura A. Cada vista
      reparte la misma figura en sus propias zonas: al frente el pecho, el
      estómago y la zona íntima; atrás la nuca, la espalda, los riñones y los
      glúteos.
    - **Cara**: un busto ampliado. Ojos, oídos, nariz y boca a escala de
      cuerpo entero miden menos que un objetivo táctil (WCAG 2.2 · 2.5.8), así
      que tienen su propia vista.

    `image` es el render de la vista, en el mismo `viewBox` que las zonas:
    la imagen va debajo y las zonas, transparentes, encima.

    ## Por qué el `id` es el de la tabla de zonas

    El organismo no sabe de síntomas: dibuja sólo las zonas cuyo `id` le pasa
    quien lo monta (`features/symptom-check/zones.data.ts`). Una misma zona
    puede aparecer en más de una vista —los brazos se ven de frente y de
    espaldas— y es el mismo control lógico.

    ## Orden

    El orden de `zonas` es el del tabulador: de arriba abajo.

    ## Tres proporciones de cuerpo (P-04, 2026-09-25)

    `VISTAS_DEL_CUERPO` es el maniquí neutro (la malla base de MakeHuman, sin
    targets de género); `_MASCULINA` y `_FEMENINA` son los maniquíes de cada
    sexo. Quien monta el organismo (`BodyMap`) elige uno según el sexo del
    paciente, o el neutro si no lo sabe.
    ========================================================================== */

/** Una zona dibujable: su `id` (el de la tabla de zonas) y su contorno. */
export interface SiluetaDeZona {
  readonly id: string;
  /** Contorno(s) cerrado(s), `M…Z`; puede tener varios subtrazos. */
  readonly d: string;
  /**
   * Un punto adentro de cada parte de la zona (las dos manos son dos partes):
   * donde se pone el marcador cuando la zona queda elegida.
   */
  readonly centros: readonly (readonly [number, number])[];
  /** Si al elegirla la figura pasa a otra vista (la cabeza acerca la cara). */
  readonly acercaA?: IdDeVista;
}

export type IdDeVista = 'frente' | 'espalda' | 'cara';

/** Una manera de mirar el cuerpo: de frente, de espaldas o la cara de cerca. */
export interface VistaDelCuerpo {
  readonly id: IdDeVista;
  /** Rótulo del selector de vista. */
  readonly nombre: string;
  readonly viewBox: string;
  /** El render del maniquí en esta vista (WebP con fondo transparente). */
  readonly image: string;
  readonly zonas: readonly SiluetaDeZona[];
}
"""


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--render", required=True, type=Path)
    p.add_argument("--overlay", type=Path, default=None)
    args = p.parse_args()
    perfiles = construir(args.render, args.overlay)
    DESTINO.write_text(ts(perfiles), encoding="utf-8", newline="\n")
    for clave, vistas in perfiles.items():
        for v in vistas:
            print(clave, v["id"], [(z, round(g.area)) for z, g in v["zonas"]])
