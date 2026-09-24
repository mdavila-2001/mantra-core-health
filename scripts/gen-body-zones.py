"""Genera `body-zones.geometry.ts`: la silueta del cuerpo y sus zonas.

Uso:  python scripts/gen-body-zones.py            (escribe el .ts)
      python scripts/gen-body-zones.py --preview  (además, un HTML para mirarla)

Requiere `shapely` (pip install shapely). No corre en el build: el .ts que
escribe se versiona, y este script queda para poder rehacerlo.

## Cómo se arma la figura

A mano, con curvas sueltas por zona, cada zona era un pedazo con su propia
forma y el conjunto nunca terminaba de parecer una persona. Acá es al revés:

1. Se dibuja **un solo contorno** del cuerpo, con proporciones de figura
   (≈ 7,5 cabezas): media silueta como puntos por los que pasa una curva
   Catmull-Rom, espejada. Los brazos se arman como trazos de ancho variable
   (hombro → codo → muñeca → mano, con pulgar) y se unen al tronco; un cierre
   morfológico redondea axilas y entrepierna.
2. Las zonas son **celdas** (rectángulos y polígonos simples) que se
   intersecan con ese contorno. Como las celdas parten el plano sin
   solaparse, las zonas vecinas comparten exactamente el mismo borde y entre
   todas cubren la figura entera: no hay partes muertas.

Lo mismo para la espalda (misma figura, otras celdas) y para la cara (un busto
ampliado, porque ojos, nariz y boca a escala de cuerpo entero no llegan al
tamaño mínimo de un objetivo táctil).
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


def cerrar(geom, r):
    """Cierre morfológico: redondea los ángulos entrantes (axilas, entrepierna)."""
    return geom.buffer(r, quad_segs=16).buffer(-r, quad_segs=16)


# ─── La figura de cuerpo entero ────────────────────────────────────────────

# Media silueta derecha (x ≥ 100) de cabeza, cuello, tronco y pierna: de la
# coronilla bajando por afuera hasta la planta, y subiendo por adentro de la
# pierna hasta la entrepierna. Alto total: 8 → 432 (≈ 7,5 cabezas de 56).
MEDIA_SILUETA = [
    (100, 8),
    (109, 9.6),
    (116.5, 14.5),
    (120.6, 23),
    (121.4, 33),
    (120.4, 43),
    (118, 51),
    (113.6, 57.6),
    (108.4, 62),
    # cuello
    (109.6, 68),
    (111, 74),
    # trapecio hacia el hombro
    (118, 79.5),
    (128, 82.6),
    (137, 85.6),
    # (el hombro y el brazo son un trazo aparte; el tronco sigue por el costado)
    (140.5, 96),
    (140.4, 110),
    (138.6, 124),
    (135.4, 140),
    (132.6, 156),
    (131.8, 168),
    (133.6, 182),
    (137.4, 197),
    (139.6, 212),
    (139.8, 226),
    # muslo por afuera
    (138.4, 244),
    (135.6, 266),
    (131.6, 290),
    (127.4, 310),
    # rodilla
    (125.4, 322),
    (125.2, 334),
    # pantorrilla
    (127.4, 350),
    (126.6, 368),
    (122.4, 390),
    (118.6, 406),
    # tobillo y pie
    (117.4, 414),
    (120.6, 422),
    (124.6, 428.4),
    (122.6, 432.4),
    (112, 432.8),
    (106.4, 430.4),
    (105.6, 422),
    (106.6, 412),
    # por adentro de la pierna, subiendo
    (106.8, 398),
    (105.6, 372),
    (106.4, 348),
    (105, 332),
    (104.4, 320),
    (105, 300),
    (104.6, 276),
    (103.4, 254),
    (101.6, 240),
    (100, 236.5),
]


def figura_entera():
    derecha = catmull_rom(MEDIA_SILUETA, pasos=10)
    izquierda = list(reversed(espejo(derecha)))
    tronco = Polygon(derecha + izquierda[1:-1]).buffer(0)

    # El brazo derecho: hombro redondo (deltoides), codo a la altura de la
    # cintura, muñeca a la de la cadera, palma y dedos juntos, pulgar hacia
    # adentro (palmas al frente, como en toda lámina).
    brazo = unary_union(
        [
            trazo(
                [
                    (134, 90, 10),
                    (143.2, 101, 11.4),
                    (147.4, 124, 9.4),
                    (150.4, 146, 8),
                    (152.2, 162, 7.2),
                    (154.4, 180, 7.4),
                    (157, 204, 5.8),
                    (158.2, 216, 5),
                ]
            ),
            trazo([(158.4, 222, 6.2), (159.6, 236, 7.2), (160.4, 250, 5.2), (160, 256, 3.6)]),
            trazo([(154.6, 224, 3.4), (151.8, 234, 2.8), (151.4, 240, 2.4)]),
        ]
    )
    brazos = unary_union([brazo, Polygon(espejo(list(brazo.exterior.coords)))])
    cuerpo = cerrar(unary_union([tronco, brazos]), 2.6)
    return cuerpo, brazos


# ─── La cara (busto ampliado) ───────────────────────────────────────────────

MEDIA_CARA = [
    (100, 14),
    (118, 16),
    (133, 25),
    (143, 42),
    (146.6, 62),
    (146, 84),
    (144, 104),
    (140, 124),
    (133, 142),
    (123, 156),
    (111, 164.6),
    (100, 167),
]


def figura_cara():
    derecha = catmull_rom(MEDIA_CARA, pasos=12)
    cara = Polygon(derecha + list(reversed(espejo(derecha)))[1:-1]).buffer(0)
    # Orejas: una forma de C apoyada en el costado, entre cejas y nariz.
    oreja = Polygon(
        catmull_rom(
            [(143, 80), (152, 74), (158.4, 82), (158, 98), (153, 112), (146.4, 118), (142, 112)],
            pasos=10,
            cerrada=True,
        )
    ).buffer(0)
    orejas = unary_union([oreja, Polygon(espejo(list(oreja.exterior.coords)))])
    # Cuello y arranque de los hombros, para que se lea como una persona.
    media_cuello = [
        (100, 150),
        (124, 150),
        (126, 176),
        (130, 192),
        (146, 202),
        (170, 210),
        (184, 220),
        (190, 236),
        (100, 236),
    ]
    cuello = Polygon(
        catmull_rom(media_cuello[:-1], pasos=10) + [(190, 236), (10, 236)]
        + list(reversed(espejo(catmull_rom(media_cuello[:-1], pasos=10))))
    ).buffer(0)
    cabeza = unary_union([cara, orejas])
    return cerrar(unary_union([cabeza, cuello]), 2), cara, orejas, cuello


# ─── Celdas de cada vista ───────────────────────────────────────────────────

INF = 1000


def banda(y0, y1):
    return box(-INF, y0, INF, y1)


def lados(x_media, y0, y1):
    """Las dos franjas exteriores a |x - 100| ≥ x_media entre y0 e y1."""
    return unary_union([box(-INF, y0, CX - x_media, y1), box(CX + x_media, y0, INF, y1)])


def centro(x_media, y0, y1):
    return box(CX - x_media, y0, CX + x_media, y1)


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
    pol = Polygon(catmull_rom(puntos, pasos=10, cerrada=True)).buffer(0)
    return unary_union([pol, Polygon(espejo(list(pol.exterior.coords)))])


def elipse(cx, cy, rx, ry):
    return Polygon(
        [(cx + rx * math.cos(t), cy + ry * math.sin(t)) for t in (i * math.pi / 32 for i in range(64))]
    )


# El hombro: del cuello, por el trapecio, hasta bajo el deltoides. Una curva
# y no un recuadro, así el corte con el pecho sigue la línea del músculo.
HOMBRO = [(113, 70), (180, 70), (180, 120), (146, 120), (140, 116), (134, 104), (126, 92), (116, 84)]


def celdas_de_cuerpo(brazos, frente: bool):
    hombros = unary_union([ambos_lados(HOMBRO), brazos.intersection(banda(-INF, 118))])
    comunes = [
        ("hombros", hombros),
        ("manos", brazos.intersection(banda(212, INF)).buffer(0.01)),
        ("brazos", brazos.buffer(0.01)),
    ]
    piernas = [
        ("pies", banda(404, INF)),
        ("rodillas", sobre(simetrica([(40, 344), (100, 344)])).difference(banda(-INF, 304))),
        ("piernas", banda(-INF, INF)),
    ]
    if frente:
        return [
            # La mandíbula baja hacia el mentón.
            ("cabeza", sobre(simetrica([(60, 50), (82, 56), (100, 65.5)]))),
            ("garganta", sobre(simetrica([(60, 80), (84, 88), (100, 90)]))),
            *comunes,
            # El arco de las costillas: alto en el esternón, bajo a los costados.
            ("pecho", sobre(simetrica([(50, 150), (70, 146), (88, 134), (100, 129)]))),
            ("estomago", sobre(simetrica([(50, 172), (76, 177), (100, 179)]))),
            # Las líneas de la ingle: del hueso de la cadera al pubis.
            ("intima", Polygon(catmull_rom(simetrica([(74, 199), (84, 218), (94, 236), (100, 246)]), pasos=8) + [(100, 199)]).buffer(0)),
            ("abdomen", sobre(simetrica([(40, 200), (74, 199), (100, 199)]))),
            ("caderas", banda(-INF, 250)),
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
        ("gluteos", sobre(simetrica([(40, 236), (62, 246), (82, 254), (96, 250), (100, 243)]))),
        *piernas,
    ]


def celdas_de_cara(cara, orejas, cuello):
    ojos = unary_union([elipse(CX - 24, 89, 18, 12.5), elipse(CX + 24, 89, 18, 12.5)])
    nariz = Polygon(catmull_rom([(93.6, 101.6), (106.4, 101.6), (113, 118), (112.4, 127), (100, 130.4), (87.6, 127), (87, 118)], pasos=8, cerrada=True))
    return [
        ("oidos", orejas.difference(cara)),
        ("ojos", ojos),
        ("nariz", nariz.difference(ojos)),
        ("boca", elipse(CX, 142, 25, 14).difference(nariz)),
        ("cabeza", cara),
        ("garganta", sobre(simetrica([(60, 200), (74, 196), (100, 194)]))),
        ("hombros", banda(-INF, INF)),
    ]


# ─── Detalles de dibujo (no se pulsan) ──────────────────────────────────────


def curva(puntos, pasos=8):
    return catmull_rom(puntos, pasos=pasos)


def detalles_frente():
    trazos = []
    for s in (1, -1):
        # Clavículas.
        trazos.append(curva([(CX + s * 7, 91), (CX + s * 18, 89), (CX + s * 30, 90.4)]))
        # Rótulas.
        trazos.append(curva([(CX + s * 10.4, 320), (CX + s * 15, 316), (CX + s * 19.6, 320)]))
    # Ombligo.
    trazos.append(curva([(CX - 1.8, 186), (CX, 188.4), (CX + 1.8, 186)], pasos=4))
    return trazos


def detalles_espalda():
    trazos = [curva([(CX, 92), (CX, 150), (CX, 206)], pasos=4)]  # columna
    for s in (1, -1):
        # Omóplatos: el borde interno y la punta de abajo.
        trazos.append(curva([(CX + s * 13, 100), (CX + s * 16, 118), (CX + s * 24, 132), (CX + s * 32, 122)]))
    trazos.append(curva([(CX, 222), (CX, 244)], pasos=2))
    return trazos


def detalles_cara():
    trazos = []
    for s in (1, -1):
        trazos.append(curva([(CX + s * 12, 76), (CX + s * 24, 71.6), (CX + s * 37, 75.6)]))  # cejas
        trazos.append(
            catmull_rom(
                [(CX + s * 13, 89), (CX + s * 24, 83.4), (CX + s * 35, 89), (CX + s * 24, 93.6)],
                pasos=8,
                cerrada=True,
            )
            + [(CX + s * 13, 89)]
        )  # ojos
        trazos.append(curva([(CX + s * 47.6, 86), (CX + s * 53, 83), (CX + s * 55, 94), (CX + s * 50.6, 106)]))  # oreja
    trazos.append(curva([(CX - 3, 98), (CX - 5.4, 114), (CX - 9.4, 121), (CX - 4, 124.6), (CX, 123.2), (CX + 4, 124.6), (CX + 9.4, 121)]))  # nariz
    trazos.append(curva([(CX - 15, 140), (CX - 6, 137.4), (CX, 138.4), (CX + 6, 137.4), (CX + 15, 140)]))  # boca
    trazos.append(curva([(CX - 15, 140), (CX - 6, 145), (CX + 6, 145), (CX + 15, 140)]))
    return trazos



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


def a_d(geom, tolerancia=0.25):
    partes = []
    for pol in poligonos(geom.simplify(tolerancia, preserve_topology=True)):
        if pol.area < 4:  # astillas de la intersección
            continue
        partes.append(anillo_a_d(pol.exterior.coords))
        partes.extend(anillo_a_d(i.coords) for i in pol.interiors)
    return "".join(partes)


def trazos_a_d(trazos):
    salida = []
    for t in trazos:
        pts = LineString(t).simplify(0.15).coords
        salida.append("M" + " ".join(f"{num(x)} {num(y)}" for x, y in pts))
    return "".join(salida)


def construir():
    cuerpo, brazos = figura_entera()
    cara_fig, cara, orejas, cuello = figura_cara()
    vistas = [
        ("frente", "Frente", "0 0 200 440", cuerpo, repartir(cuerpo, celdas_de_cuerpo(brazos, True)), detalles_frente()),
        ("espalda", "Espalda", "0 0 200 440", cuerpo, repartir(cuerpo, celdas_de_cuerpo(brazos, False)), detalles_espalda()),
        ("cara", "Cara", "0 0 200 240", cara_fig, repartir(cara_fig, celdas_de_cara(cara, orejas, cuello)), detalles_cara()),
    ]
    return vistas


def ts(vistas):
    lineas = [ENCABEZADO]
    lineas.append("export const VISTAS_DEL_CUERPO: readonly VistaDelCuerpo[] = [")
    for id_, nombre, vb, figura, zonas, detalles in vistas:
        lineas.append("  {")
        lineas.append(f"    id: '{id_}',")
        lineas.append(f"    nombre: '{nombre}',")
        lineas.append(f"    viewBox: '{vb}',")
        lineas.append(f"    contorno: '{a_d(figura)}',")
        lineas.append(f"    detalles: '{trazos_a_d(detalles)}',")
        lineas.append("    zonas: [")
        # El orden del tabulador: de arriba abajo por el centro de cada zona y,
        # a la misma altura, de izquierda a derecha.
        for zid, geom in sorted(zonas, key=lambda z: (round(z[1].centroid.y / 4), z[1].centroid.x)):
            d = a_d(geom)
            if not d:
                continue
            # De frente, la cabeza es chica para señalar ojos, nariz o boca:
            # tocarla acerca la vista de la cara.
            acerca = " acercaA: 'cara'," if (id_, zid) == ("frente", "cabeza") else ""
            lineas.append(f"      {{ id: '{zid}',{acerca} d: '{d}' }},")
        lineas.append("    ],")
        lineas.append("  },")
    lineas.append("];")
    return "\n".join(lineas) + "\n"


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

    - **Frente** y **espalda**: la figura entera (≈ 7,5 cabezas, codo a la
      altura de la cintura, muñeca a la de la cadera, rodilla a media pierna).
      Cada vista reparte la misma figura en sus propias zonas: al frente el
      pecho, el estómago y la zona íntima; atrás la nuca, la espalda, los
      riñones y los glúteos.
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
    ========================================================================== */

/** Una zona dibujable: su `id` (el de la tabla de zonas) y su contorno. */
export interface SiluetaDeZona {
  readonly id: string;
  /** Contorno(s) cerrado(s), `M…Z`; puede tener varios subtrazos. */
  readonly d: string;
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
  readonly zonas: readonly SiluetaDeZona[];
}
"""


def preview(vistas):
    colores = ["#f6c6c6", "#f6dcc0", "#f3efb8", "#cdeec2", "#bfe6e6", "#c6d6f6", "#dcc8f4", "#f4c6e4"]
    partes = []
    for id_, _n, vb, figura, zonas, detalles in vistas:
        paths = "".join(
            f'<path d="{a_d(g)}" fill="{colores[i % len(colores)]}" stroke="#fff" stroke-width="1.2"><title>{z}</title></path>'
            for i, (z, g) in enumerate(zonas)
        )
        partes.append(
            f'<figure><svg viewBox="{vb}" width="320"><path d="{a_d(figura)}" fill="#ddd" stroke="#666" stroke-width="3"/>'
            f'{paths}<path d="{trazos_a_d(detalles)}" fill="none" stroke="#777" stroke-width="1.2" stroke-linecap="round"/></svg>'
            f"<figcaption>{id_}</figcaption></figure>"
        )
    return '<body style="display:flex;gap:24px;font:14px sans-serif;background:#fff">' + "".join(partes) + "</body>"


if __name__ == "__main__":
    vistas = construir()
    DESTINO.write_text(ts(vistas), encoding="utf-8", newline="\n")
    for id_, _n, _vb, _f, zonas, _d in vistas:
        print(id_, [(z, round(g.area)) for z, g in zonas])
    if "--preview" in sys.argv:
        salida = Path(sys.argv[sys.argv.index("--preview") + 1])
        salida.write_text(preview(vistas), encoding="utf-8")
