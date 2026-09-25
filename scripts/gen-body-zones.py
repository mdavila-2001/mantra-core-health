"""Genera `body-zones.geometry.ts`: la silueta del cuerpo y sus zonas.

Uso:  python scripts/gen-body-zones.py                     (escribe el .ts)
      python scripts/gen-body-zones.py --preview salida.html (además, un HTML para mirarla)

Requiere `shapely` (pip install shapely). No corre en el build: el .ts que
escribe se versiona, y este script queda para poder rehacerlo.

## Cómo se arma la figura

A mano, con curvas sueltas por zona, cada zona era un pedazo con su propia
forma y el conjunto nunca terminaba de parecer una persona. Acá es al revés:

1. Se dibuja **un solo contorno** del cuerpo, con proporciones de figura
   (≈ 7,5 cabezas): media silueta como puntos por los que pasa una curva
   Catmull-Rom, espejada. Los brazos se arman como trazos de ancho variable
   (deltoides → bíceps → codo → antebrazo → muñeca → mano, con pulgar) y se
   unen al tronco; un cierre morfológico redondea axilas y entrepierna.
2. Las zonas son **celdas** (rectángulos y polígonos simples) que se
   intersecan con ese contorno. Como las celdas parten el plano sin
   solaparse, las zonas vecinas comparten exactamente el mismo borde y entre
   todas cubren la figura entera: no hay partes muertas.

Lo mismo para la espalda (misma figura, otras celdas) y para la cara (un busto
ampliado, porque ojos, nariz y boca a escala de cuerpo entero no llegan al
tamaño mínimo de un objetivo táctil).

## Postura (2026-09-24)

Postura en A, la de las láminas clínicas: los brazos separados del tronco
desde la axila, palmas al frente y pulgares hacia afuera. Con los brazos
pegados la figura se leía como un maniquí, y el brazo y el costado del pecho
eran dos objetivos táctiles sin espacio entre ellos.

## Sexo de la silueta (2026-09-25)

`construir()` devuelve las tres proporciones a la vez: `neutro` (la figura de
siempre), `masculino` y `femenino`. Las tres comparten cabeza, brazos, piernas
de la rodilla para abajo y la vista de cara; sólo cambia el ancho relativo de
hombro, cintura y cadera de `MEDIA_SILUETA`, por una tabla de factores por
altura (`BANDAS_DE_SEXO`) que `BodyMap` elige según el sexo del paciente.

## Tres capas de dibujo además de las zonas

- `detalles`: líneas finas (clavículas, pectorales, columna, rótulas…). Se
  dibujan encima de las zonas y no se pulsan.
- `rellenos`: formas llenas y tenues (el pelo, las cejas, los labios).
- `acentos`: formas llenas y marcadas (iris, fosas nasales).
Ninguna de las tres recibe clics: el clic atraviesa hasta la zona.

Cada zona lleva además `centros`: un punto dentro de cada parte (las dos
manos son dos partes), que es donde la pantalla pone el marcador de la zona
elegida.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.ops import unary_union

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "src/app/shared/components/organisms/body-map/body-zones.geometry.ts"
CX = 100.0  # eje de simetría


# ─── Curvas ────────────────────────────────────────────────────────────────


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


def espejo(puntos):
    return [(2 * CX - x, y) for x, y in puntos]


def trazo(nodos):
    """Trazo de ancho variable: la unión de las envolventes de círculos vecinos."""
    circulos = [Point(x, y).buffer(r, quad_segs=16) for x, y, r in nodos]
    partes = [unary_union([a, b]).convex_hull for a, b in zip(circulos, circulos[1:])]
    return unary_union(partes)


def suave(geom, r):
    """Apertura morfológica: redondea las esquinas salientes de un trazo."""
    return geom.buffer(-r, quad_segs=16).buffer(r, quad_segs=16)


def cerrar(geom, r):
    """Cierre morfológico: redondea los ángulos entrantes (axilas, entrepierna)."""
    return geom.buffer(r, quad_segs=16).buffer(-r, quad_segs=16)


def con_espejo(geom):
    """Una forma del lado derecho unida a su reflejo."""
    reflejo = [Polygon(espejo(list(p.exterior.coords))) for p in poligonos(geom)]
    return unary_union([geom, *reflejo])


# ─── Proporciones por sexo (P-04, 2026-09-25) ───────────────────────────────
#
# La figura neutra queda tal cual estaba: `BANDAS_DE_SEXO['neutro']` es `None`,
# y sin tabla no se toca ni un punto. Masculina y femenina escalan la
# DISTANCIA AL EJE de cada punto de `MEDIA_SILUETA`, según una tabla de
# factores por altura (`y`) que se interpola linealmente entre sus puntos y se
# recorta en los extremos. Sólo se tocan hombro, pecho, cintura y cadera —de
# `y≈90` a `y≈300`—: la cabeza, los brazos y de la rodilla para abajo quedan
# iguales en las tres, porque no son lo que distingue una silueta de otra en
# este dibujo esquemático.


def factor_en(y, bandas):
    """El factor de escala en una altura `y`, interpolado en `bandas`."""
    if bandas is None:
        return 1.0
    if y <= bandas[0][0]:
        return bandas[0][1]
    for (y0, f0), (y1, f1) in zip(bandas, bandas[1:]):
        if y0 <= y <= y1:
            if y1 == y0:
                return f1
            t = (y - y0) / (y1 - y0)
            return f0 + (f1 - f0) * t
    return bandas[-1][1]


def escalar_silueta(puntos, bandas):
    """Cada punto se aleja o se acerca del eje según el factor de su altura."""
    if bandas is None:
        return puntos
    return [(CX + (x - CX) * factor_en(y, bandas), y) for x, y in puntos]


# Hombro más ancho, cintura apenas afinada, cadera más angosta.
BANDAS_MASCULINO = [
    (0, 1.0),
    (90, 1.0),
    (100, 1.08),
    (135, 1.07),
    (161, 1.03),
    (186, 0.97),
    (214, 0.91),
    (250, 0.9),
    (292, 0.95),
    (316, 1.0),
    (440, 1.0),
]

# Hombro más angosto, cintura marcada, cadera más ancha.
BANDAS_FEMENINO = [
    (0, 1.0),
    (90, 1.0),
    (100, 0.93),
    (135, 0.92),
    (161, 0.87),
    (186, 0.93),
    (214, 1.03),
    (250, 1.1),
    (292, 1.04),
    (316, 1.0),
    (440, 1.0),
]

BANDAS_DE_SEXO = {
    "neutro": None,
    "masculino": BANDAS_MASCULINO,
    "femenino": BANDAS_FEMENINO,
}


# ─── La figura de cuerpo entero ────────────────────────────────────────────

# Media silueta derecha (x ≥ 100) de cabeza, cuello, tronco y pierna: de la
# coronilla bajando por afuera hasta la planta, y subiendo por adentro de la
# pierna hasta la entrepierna. Alto total: 8 → 434 (≈ 7,5 cabezas de 57).
# Marcas de altura: mentón 65, pezones 120, ombligo 176, entrepierna 238,
# rodilla 322, tobillo 414.
MEDIA_SILUETA = [
    (100, 8),
    (109.4, 9.6),
    (116.8, 14.2),
    (121, 22.4),
    (122.2, 32),
    (121.6, 41),
    (119.8, 48.6),
    (116.6, 55.4),
    (112.4, 60.6),
    (108.8, 63.8),
    # cuello
    (109, 68),
    (110.2, 73.6),
    # trapecio hacia el hombro
    (115.6, 78.2),
    (123.6, 81),
    (131.4, 83.4),
    (137, 86.6),
    # (el hombro y el brazo son un trazo aparte; el tronco sigue por el costado)
    (139.6, 96),
    (140, 108),
    (138.8, 121),
    (136.2, 135),
    (133.4, 149),
    (132, 161),
    # cintura → cadera
    (132.6, 172),
    (135.4, 186),
    (138.6, 200),
    (140.2, 214),
    # muslo por afuera
    (139.8, 230),
    (138, 250),
    (135, 271),
    (131.6, 292),
    (128.8, 306),
    # rodilla
    (127.2, 316),
    (126.6, 326),
    (127.2, 335),
    # pantorrilla: el gemelo externo abulta alto
    (129.2, 347),
    (129.4, 359),
    (127.4, 373),
    (124, 389),
    (120.8, 403),
    # tobillo y pie, apenas girado hacia afuera
    (119.4, 412),
    (120.6, 419),
    (124, 425),
    (127, 429.6),
    (126, 433.4),
    (118.6, 434.4),
    (111.4, 434),
    (107, 432),
    (105.8, 426.6),
    (106.2, 419),
    # por adentro de la pierna, subiendo: el gemelo interno abulta más abajo
    (106.8, 410),
    (107.4, 397),
    (106.4, 381),
    (104.8, 364),
    (104.6, 348),
    (105.6, 336),
    (105.8, 325),
    (104.8, 315),
    (104.4, 301),
    (104.2, 287),
    (103.6, 271),
    (102.6, 256),
    (101.2, 244.6),
    (100, 241),
]

# El brazo derecho en postura A: deltoides, bíceps, codo a la altura de la
# cintura, antebrazo que abulta cerca del codo y se afina hacia la muñeca.
BRAZO = [
    (135, 91, 10.4),
    (139.4, 99, 11.2),
    (143.4, 111, 10),
    (146.6, 124, 9.2),
    (149.4, 139, 8.4),
    (152, 152, 7.6),
    (153.6, 161, 7.1),
    (156.4, 174, 7.9),
    (159.8, 190, 7),
    (163.4, 205, 5.8),
    (166.4, 218, 4.7),
]
# La mano, palma al frente: palma, dedos juntos y el pulgar hacia afuera.
PALMA = [(167.2, 222, 5.4), (169.4, 231, 6.8), (171, 241, 6.6), (172, 249, 5.4)]
DEDOS = [(172, 249, 5.2), (172.6, 257, 4.2), (172.6, 263, 3)]
PULGAR = [(172, 226, 3.6), (175.6, 234, 3), (177.6, 240.4, 2.4), (177.8, 243.6, 1.9)]


def figura_entera(bandas=None):
    derecha = catmull_rom(escalar_silueta(MEDIA_SILUETA, bandas), pasos=10)
    izquierda = list(reversed(espejo(derecha)))
    tronco = Polygon(derecha + izquierda[1:-1]).buffer(0)

    brazo = unary_union(
        [
            trazo(BRAZO),
            suave(unary_union([trazo(PALMA), trazo(DEDOS)]), 1.2),
            trazo(PULGAR),
        ]
    )
    brazos = con_espejo(cerrar(brazo, 1.4))
    cuerpo = cerrar(unary_union([tronco, brazos]), 2.8)
    return cuerpo, brazos


# ─── La cara (busto ampliado) ───────────────────────────────────────────────

# Media cara derecha: coronilla, sien, pómulo, ángulo de la mandíbula, mentón.
MEDIA_CARA = [
    (100, 12),
    (116.6, 13.6),
    (131.4, 20.6),
    (141.6, 33.4),
    (146.4, 50),
    (147.6, 68),
    (146.6, 86),
    (145, 102),
    (141.6, 118),
    (136.2, 132),
    (128.4, 145),
    (119, 155.4),
    (108.6, 162.4),
    (100, 164.6),
]

# La oreja derecha: hélice por afuera, lóbulo abajo, pegada entre ceja y nariz.
OREJA = [(144, 80), (150.4, 74.4), (157, 76.4), (159.4, 86), (158, 99), (154, 110), (149.6, 118), (145, 118.6), (142.6, 112)]

# El cuello y el arranque de los hombros, con la pendiente del trapecio.
MEDIO_CUELLO = [
    (100, 150),
    (123.6, 146),
    (125, 162),
    (127, 178),
    (132.4, 190),
    (146, 198),
    (164, 204.4),
    (180, 211),
    (190.4, 221),
    (195, 238),
]


def figura_cara():
    derecha = catmull_rom(MEDIA_CARA, pasos=12)
    cara = Polygon(derecha + list(reversed(espejo(derecha)))[1:-1]).buffer(0)
    oreja = Polygon(catmull_rom(OREJA, pasos=10, cerrada=True)).buffer(0)
    orejas = con_espejo(oreja)
    media = catmull_rom(MEDIO_CUELLO, pasos=10)
    cuello = Polygon(media + [(195, 240), (5, 240)] + list(reversed(espejo(media)))).buffer(0)
    cabeza = unary_union([cara, orejas])
    return cerrar(unary_union([cabeza, cuello]), 2), cara, orejas, cuello


# ─── Celdas de cada vista ───────────────────────────────────────────────────

INF = 1000


def banda(y0, y1):
    return box(-INF, y0, INF, y1)


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


def sobre(puntos):
    """Todo lo que queda por ENCIMA de una costura (y crece hacia abajo).

    La costura es una curva de izquierda a derecha; se estira hasta los bordes
    del plano para que corte la figura de lado a lado.
    """
    c = catmull_rom(puntos, pasos=10)
    return Polygon([(-INF, c[0][1])] + c + [(INF, c[-1][1]), (INF, -INF), (-INF, -INF)]).buffer(0)


def simetrica(media):
    """Una costura simétrica a partir de su mitad izquierda (x ≤ 100)."""
    return media + [(2 * CX - x, y) for x, y in reversed(media[:-1])]


def ambos_lados(puntos):
    """Un polígono del lado derecho y su espejo."""
    return con_espejo(Polygon(catmull_rom(puntos, pasos=10, cerrada=True)).buffer(0))


def elipse(cx, cy, rx, ry, giro=0.0):
    c, s = math.cos(giro), math.sin(giro)
    puntos = []
    for i in range(64):
        t = i * math.pi / 32
        x, y = rx * math.cos(t), ry * math.sin(t)
        puntos.append((cx + x * c - y * s, cy + x * s + y * c))
    return Polygon(puntos)


# El hombro: del cuello, por el trapecio, hasta bajo el deltoides. Una curva
# y no un recuadro, así el corte con el pecho sigue la línea del músculo.
HOMBRO = [(113, 70), (190, 70), (190, 116), (148, 117), (141, 114), (134, 104), (126, 93), (116, 85)]


def celdas_de_cuerpo(brazos, frente: bool, bandas=None):
    hombros = unary_union([ambos_lados(HOMBRO), brazos.intersection(banda(-INF, 116))])
    comunes = [
        ("hombros", hombros),
        ("manos", brazos.intersection(banda(219, INF)).buffer(0.01)),
        ("brazos", brazos.buffer(0.01)),
    ]
    piernas = [
        ("pies", banda(405, INF)),
        ("rodillas", sobre(simetrica([(40, 344), (100, 344)])).difference(banda(-INF, 304))),
        ("piernas", banda(-INF, INF)),
    ]
    if frente:
        return [
            # La mandíbula baja hacia el mentón.
            ("cabeza", sobre(simetrica([(60, 50), (82, 57), (100, 66)]))),
            ("garganta", sobre(simetrica([(60, 80), (84, 88), (100, 90)]))),
            *comunes,
            # El arco de las costillas: alto en el esternón, bajo a los costados.
            ("pecho", sobre(simetrica([(50, 150), (70, 146), (88, 134), (100, 129)]))),
            ("estomago", sobre(simetrica([(50, 172), (76, 177), (100, 179)]))),
            # Las líneas de la ingle: del hueso de la cadera al pubis.
            (
                "intima",
                Polygon(
                    catmull_rom(
                        escalar_silueta(simetrica([(74, 201), (84, 220), (94, 238), (100, 247)]), bandas),
                        pasos=8,
                    )
                    + [(100, 201)]
                ).buffer(0),
            ),
            ("abdomen", sobre(simetrica([(40, 202), (74, 201), (100, 201)]))),
            ("caderas", banda(-INF, 252)),
            *piernas,
        ]
    return [
        # La nuca empieza donde termina el pelo.
        ("cabeza", sobre(simetrica([(60, 54), (84, 56), (100, 58)]))),
        ("nuca", sobre(simetrica([(60, 82), (84, 88), (100, 90)]))),
        *comunes,
        ("espalda", sobre(simetrica([(40, 166), (100, 170)]))),
        # La cresta de la cadera cierra la cintura.
        ("rinones", sobre(simetrica([(40, 198), (70, 202), (100, 206)]))),
        # El pliegue del glúteo.
        ("gluteos", sobre(simetrica([(40, 238), (62, 248), (82, 256), (96, 252), (100, 245)]))),
        *piernas,
    ]


# Los ojos: una almendra generosa alrededor de cada uno (párpados incluidos),
# que es lo que se señala cuando «me arde el ojo».
OJO_D = elipse(CX + 24, 91, 17.5, 11.5)
NARIZ = [(95, 96), (105, 96), (109.4, 112), (114.2, 123), (111, 129.4), (100, 131.6), (89, 129.4), (85.8, 123), (90.6, 112)]
BOCA = [(100, 136.4), (112, 136.4), (125, 142.6), (117, 151.6), (100, 154.4), (83, 151.6), (75, 142.6), (88, 136.4)]


def celdas_de_cara(cara, orejas, cuello):
    ojos = con_espejo(OJO_D)
    nariz = Polygon(catmull_rom(NARIZ, pasos=8, cerrada=True)).buffer(0)
    boca = Polygon(catmull_rom(BOCA, pasos=8, cerrada=True)).buffer(0)
    return [
        ("oidos", orejas.difference(cara)),
        ("ojos", ojos),
        ("nariz", nariz.difference(ojos)),
        ("boca", boca.difference(nariz)),
        ("cabeza", cara),
        ("garganta", sobre(simetrica([(60, 200), (74, 192), (100, 190)]))),
        ("hombros", banda(-INF, INF)),
    ]


# ─── Detalles de dibujo (no se pulsan) ──────────────────────────────────────


def curva(puntos, pasos=8):
    return catmull_rom(puntos, pasos=pasos)


def por_lado(f):
    """Aplica `f(s)` a los dos lados (s = 1 derecha, s = -1 izquierda)."""
    salida = []
    for s in (1, -1):
        salida.extend(f(s))
    return salida


def detalles_frente():
    def lado(s):
        return [
            # Esternocleidomastoideo: de detrás de la oreja al esternón.
            curva([(CX + s * 8.6, 66), (CX + s * 6.4, 76), (CX + s * 3, 88)]),
            # Clavícula, con su S.
            curva([(CX + s * 5, 90.6), (CX + s * 13, 89.4), (CX + s * 22, 90.4), (CX + s * 31, 88.4)]),
            # Borde del deltoides.
            curva([(CX + s * 29, 92), (CX + s * 34, 102), (CX + s * 39.6, 113)]),
            # Borde bajo del pectoral.
            curva([(CX + s * 3, 121), (CX + s * 12, 126.4), (CX + s * 24, 125), (CX + s * 33, 116)]),
            # Oblicuo, del costado a la cresta de la cadera.
            curva([(CX + s * 30, 150), (CX + s * 27, 172), (CX + s * 25, 190)]),
            # Pliegue del codo.
            curva([(CX + s * 50.4, 160.4), (CX + s * 53.6, 162.4), (CX + s * 56.4, 161.6)], pasos=4),
            # Dedos: tres rayas cortas en la mano.
            curva([(CX + s * 70.2, 251), (CX + s * 70.4, 260)], pasos=2),
            curva([(CX + s * 72.6, 251.4), (CX + s * 72.8, 261.6)], pasos=2),
            curva([(CX + s * 75, 250.6), (CX + s * 74.8, 259)], pasos=2),
            # Rótula.
            curva([(CX + s * 10.6, 326), (CX + s * 11.2, 318), (CX + s * 16, 314.6), (CX + s * 20.8, 318), (CX + s * 21.2, 326)]),
            # Canto de la tibia.
            curva([(CX + s * 15.6, 344), (CX + s * 14.8, 372), (CX + s * 14.4, 398)], pasos=4),
            # Dedos del pie.
            curva([(CX + s * 13.4, 430.6), (CX + s * 13.6, 434)], pasos=2),
            curva([(CX + s * 17.8, 430.6), (CX + s * 18.2, 434)], pasos=2),
        ]

    trazos = por_lado(lado)
    # Línea alba, del esternón al ombligo, apenas insinuada.
    trazos.append(curva([(CX, 130), (CX, 152), (CX, 170)], pasos=4))
    # Ombligo.
    trazos.append(
        catmull_rom([(CX, 174.6), (CX + 1.8, 177), (CX, 179.8), (CX - 1.8, 177)], pasos=6, cerrada=True) + [(CX, 174.6)]
    )
    return trazos


def detalles_espalda():
    def lado(s):
        return [
            # Trapecio: de la nuca al acromion.
            curva([(CX + s * 9, 72), (CX + s * 20, 82), (CX + s * 32, 88)]),
            # Omóplato: el borde interno y la punta de abajo.
            curva([(CX + s * 13, 100), (CX + s * 15.6, 117), (CX + s * 22, 131), (CX + s * 31, 121)]),
            # Dorsal, del omóplato a la cintura.
            curva([(CX + s * 34, 124), (CX + s * 30, 146), (CX + s * 22, 168)]),
            # Hoyuelos lumbares.
            curva([(CX + s * 6, 214), (CX + s * 8.4, 216.4), (CX + s * 10, 214)], pasos=4),
            # Codo por detrás.
            curva([(CX + s * 51, 161.6), (CX + s * 53.6, 164.4), (CX + s * 56.8, 162.6)], pasos=4),
            # Nudillos: el dorso de la mano.
            curva([(CX + s * 69, 250.6), (CX + s * 72, 252.4), (CX + s * 75.4, 250)], pasos=4),
            # Hueco de la rodilla (poplíteo).
            curva([(CX + s * 9, 322), (CX + s * 16, 325.6), (CX + s * 23.4, 322)]),
            # Los dos gemelos.
            curva([(CX + s * 16.4, 334), (CX + s * 16, 352), (CX + s * 15.6, 366)], pasos=4),
            # Talón.
            curva([(CX + s * 9.6, 424), (CX + s * 14, 428), (CX + s * 19.4, 424)]),
        ]

    trazos = por_lado(lado)
    # Columna, de la nuca al sacro.
    trazos.append(curva([(CX, 76), (CX, 150), (CX, 212)], pasos=4))
    # Pliegue interglúteo.
    trazos.append(curva([(CX, 224), (CX, 247)], pasos=2))
    return trazos


def detalles_cara():
    def lado(s):
        return [
            # Párpado superior y línea del ojo.
            catmull_rom(
                [(CX + s * 13, 91), (CX + s * 18.6, 86.2), (CX + s * 26, 85), (CX + s * 33.6, 88.6), (CX + s * 36, 91), (CX + s * 25, 95.4)],
                pasos=8,
                cerrada=True,
            )
            + [(CX + s * 13, 91)],
            # Pliegue del párpado.
            curva([(CX + s * 15, 84.4), (CX + s * 24, 80.6), (CX + s * 34, 84)]),
            # Hélice interna de la oreja.
            curva([(CX + s * 49, 84), (CX + s * 53.4, 80.6), (CX + s * 56, 88), (CX + s * 54.4, 100), (CX + s * 50.6, 108)]),
            # Surco de la nariz a la comisura.
            curva([(CX + s * 12.6, 123), (CX + s * 16, 129.6), (CX + s * 18.4, 134)]),
            # Esternocleidomastoideo.
            curva([(CX + s * 22, 160), (CX + s * 16, 180), (CX + s * 8, 198)]),
            # Clavícula.
            curva([(CX + s * 8, 204), (CX + s * 30, 202), (CX + s * 56, 206)]),
        ]

    trazos = por_lado(lado)
    # Dorso de la nariz y sus alas.
    trazos.append(curva([(CX - 3, 98), (CX - 4.6, 112), (CX - 8.6, 121.6), (CX - 5.4, 126.4), (CX, 125.2), (CX + 5.4, 126.4), (CX + 8.6, 121.6)]))
    # Comisura de los labios.
    trazos.append(curva([(CX - 17, 143.4), (CX - 7, 142), (CX, 143), (CX + 7, 142), (CX + 17, 143.4)]))
    # Mentón.
    trazos.append(curva([(CX - 8, 158.4), (CX, 160), (CX + 8, 158.4)], pasos=4))
    return trazos


def rellenos_cara(cara):
    """Formas tenues: el pelo, las cejas, los labios."""
    # El pelo: la cabeza por encima de una línea de nacimiento con entradas.
    nacimiento = simetrica([(40, 76), (54.4, 62), (60, 44), (72, 38), (86, 36.4), (100, 38.6)])
    pelo = cara.buffer(1.4).intersection(sobre(nacimiento))
    cejas = con_espejo(
        Polygon(
            catmull_rom(
                [(CX + 12, 77.6), (CX + 22, 73), (CX + 33, 73.4), (CX + 38.4, 77), (CX + 33, 76.2), (CX + 22, 76.6), (CX + 13, 80.4)],
                pasos=6,
                cerrada=True,
            )
        ).buffer(0)
    )
    labios = Polygon(
        catmull_rom(
            [(CX - 17, 143.4), (CX - 9, 138.4), (CX - 3, 139.6), (CX, 138.2), (CX + 3, 139.6), (CX + 9, 138.4), (CX + 17, 143.4), (CX + 8, 150.6), (CX, 151.6), (CX - 8, 150.6)],
            pasos=6,
            cerrada=True,
        )
    ).buffer(0)
    return [pelo, cejas, labios]


def acentos_cara():
    """Formas marcadas: iris y fosas nasales."""
    iris = con_espejo(Point(CX + 24.6, 90.2).buffer(4.8, quad_segs=12))
    fosas = con_espejo(elipse(CX + 4.6, 125.6, 2.4, 1.2, giro=0.35))
    return [iris, fosas]


def rellenos_cuerpo(cuerpo, frente: bool):
    """El pelo, también en el cuerpo entero: sin él la cabeza era un huevo."""
    if frente:
        linea = simetrica([(70, 30), (80, 22), (90, 19), (100, 20)])
        return [cuerpo.intersection(sobre(linea)).intersection(banda(-INF, 40))]
    # De espaldas el pelo cubre la cabeza hasta la nuca.
    return [cuerpo.intersection(sobre(simetrica([(70, 50), (86, 54), (100, 55)]))).intersection(banda(-INF, 60))]


# ─── Salida ────────────────────────────────────────────────────────────────


def num(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def poligonos(geom):
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return list(geom.geoms)
    return [g for g in getattr(geom, "geoms", []) if isinstance(g, Polygon)]


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


def formas_a_d(formas):
    return "".join(a_d(f, tolerancia=0.12, minimo=1) for f in formas)


def trazos_a_d(trazos):
    salida = []
    for t in trazos:
        pts = LineString(t).simplify(0.12).coords
        salida.append("M" + " ".join(f"{num(x)} {num(y)}" for x, y in pts))
    return "".join(salida)


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
    y = miny
    while y <= maxy:
        x = minx
        while x <= maxx:
            p = Point(x, y)
            if pol.contains(p):
                d = borde.distance(p)
                if d > distancia:
                    mejor, distancia = p, d
            x += paso
        y += paso
    return mejor


def vistas_de(bandas, cara_vista):
    """Frente y espalda con la proporción de `bandas` (`None` = neutra), más
    la cara —que es la misma figura para los tres perfiles: no es lo que
    distingue una silueta de otra acá (ver `BANDAS_DE_SEXO`)."""
    cuerpo, brazos = figura_entera(bandas)
    return [
        {
            "id": "frente",
            "nombre": "Frente",
            "viewBox": "0 0 200 440",
            "figura": cuerpo,
            "zonas": repartir(cuerpo, celdas_de_cuerpo(brazos, True, bandas)),
            "detalles": detalles_frente(),
            "rellenos": rellenos_cuerpo(cuerpo, True),
            "acentos": [],
        },
        {
            "id": "espalda",
            "nombre": "Espalda",
            "viewBox": "0 0 200 440",
            "figura": cuerpo,
            "zonas": repartir(cuerpo, celdas_de_cuerpo(brazos, False, bandas)),
            "detalles": detalles_espalda(),
            "rellenos": rellenos_cuerpo(cuerpo, False),
            "acentos": [],
        },
        cara_vista,
    ]


def construir():
    """Las vistas de los tres perfiles de sexo: `neutro`, `masculino` y
    `femenino` (ver `BANDAS_DE_SEXO`). La cara se arma una sola vez."""
    cara_fig, cara, orejas, cuello = figura_cara()
    cara_vista = {
        "id": "cara",
        "nombre": "Cara",
        "viewBox": "0 0 200 240",
        "figura": cara_fig,
        "zonas": repartir(cara_fig, celdas_de_cara(cara, orejas, cuello)),
        "detalles": detalles_cara(),
        "rellenos": rellenos_cara(cara),
        "acentos": acentos_cara(),
    }
    return {clave: vistas_de(bandas, cara_vista) for clave, bandas in BANDAS_DE_SEXO.items()}


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
            lineas.append(f"    contorno: '{a_d(v['figura'])}',")
            lineas.append(f"    detalles: '{trazos_a_d(v['detalles'])}',")
            lineas.append(f"    rellenos: '{formas_a_d(v['rellenos'])}',")
            lineas.append(f"    acentos: '{formas_a_d(v['acentos'])}',")
            lineas.append("    zonas: [")
            # El orden del tabulador: de arriba abajo por el centro de cada
            # zona y, a la misma altura, de izquierda a derecha.
            for zid, geom in sorted(
                v["zonas"], key=lambda z: (round(z[1].centroid.y / 4), z[1].centroid.x)
            ):
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
    La silueta del cuerpo y sus zonas, para señalar dónde duele con el dedo o
    con el teclado (P-01, doctor 22/09/2026).

    **ARCHIVO GENERADO** por `scripts/gen-body-zones.py`. No se edita a mano:
    se cambia el script y se vuelve a correr (el porqué del método está en su
    cabecera). A mano, zona por zona, la figura nunca llegó a parecer una
    persona; generada, es un solo contorno partido en celdas.

    ## Qué es y qué no es este dato

    Un dibujo esquemático hecho para este control, no una lámina anatómica: es
    lo que la regla 97 llama dato sintético declarado. No representa ningún
    dato del mundo y no tiene fuente que citar.

    ## Las tres vistas

    - **Frente** y **espalda**: la figura entera en postura A (≈ 7,5 cabezas,
      codo a la altura de la cintura, muñeca a la de la cadera, rodilla a
      media pierna). Cada vista reparte la misma figura en sus propias zonas:
      al frente el pecho, el estómago y la zona íntima; atrás la nuca, la
      espalda, los riñones y los glúteos.
    - **Cara**: un busto ampliado. Ojos, oídos, nariz y boca a escala de
      cuerpo entero miden menos que un objetivo táctil (WCAG 2.2 · 2.5.8), así
      que tienen su propia vista.

    ## Por qué el `id` es el de la tabla de zonas

    El organismo no sabe de síntomas: dibuja sólo las zonas cuyo `id` le pasa
    quien lo monta (`features/symptom-check/zonas.datos.ts`). Una misma zona
    puede aparecer en más de una vista —los brazos se ven de frente y de
    espaldas— y es el mismo control lógico.

    ## Orden

    El orden de `zonas` es el del tabulador: de arriba abajo.

    ## Tres proporciones de cuerpo (P-04, 2026-09-25)

    `VISTAS_DEL_CUERPO` es la figura neutra de siempre. `_MASCULINA` y
    `_FEMENINA` son la misma figura con hombro, cintura y cadera escalados
    (`BANDAS_DE_SEXO` en el script): quien monta el organismo (`BodyMap`)
    elige una de las tres según el sexo del paciente, o la neutra si no lo
    sabe. La cabeza, los brazos, las piernas de la rodilla para abajo y la
    vista de la cara son **la misma figura en las tres**: no es lo que
    distingue una silueta de otra en este dibujo esquemático.
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
  /** El contorno entero, que se pinta debajo de las zonas. */
  readonly contorno: string;
  /** Líneas de dibujo (clavículas, columna, rasgos). No se pulsan. */
  readonly detalles: string;
  /** Formas llenas y tenues (pelo, cejas, labios). No se pulsan. */
  readonly rellenos: string;
  /** Formas llenas y marcadas (iris, fosas nasales). No se pulsan. */
  readonly acentos: string;
  readonly zonas: readonly SiluetaDeZona[];
}
"""


def preview(perfiles):
    colores = ["#f6c6c6", "#f6dcc0", "#f3efb8", "#cdeec2", "#bfe6e6", "#c6d6f6", "#dcc8f4", "#f4c6e4"]
    partes = []
    for clave in ("neutro", "masculino", "femenino"):
        for v in perfiles[clave]:
            paths = "".join(
                f'<path d="{a_d(g)}" fill="{colores[i % len(colores)]}" stroke="#fff" stroke-width="1.2"><title>{z}</title></path>'
                for i, (z, g) in enumerate(v["zonas"])
            )
            marcas = "".join(
                f'<circle cx="{x}" cy="{y}" r="2" fill="#c00"/>' for _z, g in v["zonas"] for x, y in centros(g)
            )
            partes.append(
                f'<figure><svg viewBox="{v["viewBox"]}" width="320"><path d="{a_d(v["figura"])}" fill="#ddd" stroke="#666" stroke-width="2"/>'
                f'{paths}<path d="{formas_a_d(v["rellenos"])}" fill="#8a8a8a" opacity=".55"/>'
                f'<path d="{formas_a_d(v["acentos"])}" fill="#444"/>'
                f'<path d="{trazos_a_d(v["detalles"])}" fill="none" stroke="#777" stroke-width="0.8" stroke-linecap="round"/>{marcas}</svg>'
                f"<figcaption>{clave} · {v['id']}</figcaption></figure>"
            )
    return '<body style="display:flex;flex-wrap:wrap;gap:24px;font:14px sans-serif;background:#fff">' + "".join(partes) + "</body>"


if __name__ == "__main__":
    perfiles = construir()
    DESTINO.write_text(ts(perfiles), encoding="utf-8", newline="\n")
    for clave, vistas in perfiles.items():
        for v in vistas:
            print(clave, v["id"], [(z, round(g.area)) for z, g in v["zonas"]])
    if "--preview" in sys.argv:
        salida = Path(sys.argv[sys.argv.index("--preview") + 1])
        salida.write_text(preview(perfiles), encoding="utf-8")
