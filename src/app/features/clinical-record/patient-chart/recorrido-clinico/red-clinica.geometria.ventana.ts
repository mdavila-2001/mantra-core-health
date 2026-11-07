/* ============================================================================
    The clinical network's plane, fitted to the stretch in view.

    `ubicarRed` places the whole history; the canvas shows a window of it. Two
    things only make sense against that window:

    - an expanded thread with none of its records in view was a band of up to
      650 px of nothing: it measures what a collapsed thread does and says how
      many records it has left and right of the view;
    - a line towards something out of view ran off the canvas: it is cut where
      the view ends (inside the edge's fade) and that end gets a marker.

    Only the y changes, through a monotone function, so the x of everything
    (and so the window itself) stays put and straight stretches stay straight.
    ========================================================================== */

import { poligonal } from './red-clinica.trazos';
import {
  DISTANCIA_DEL_TRONCO,
  MEDIDAS_DE_LA_RED,
  type AristaDeLaRed,
  type HiloDeLaRed,
  type NodoDeLaRed,
  type PiezaDeArista,
  type PlanoDeLaRed,
  type Punto,
  type VentanaDeLaRed,
} from './red-clinica.geometria.types';

/** The canvas edge's fade (`--sp-12`): a line cut under it would not be seen. */
export const BORDE_DEL_LIENZO = 48;

/** The trunk's corner radius, as `red-clinica.trazos.ts` draws it. */
const RADIO_DEL_TRONCO = 10;

/** How many records a node stands for: a «+N» stands for its hidden ones, a control for none. */
function registrosDe(n: NodoDeLaRed): number {
  if (n.forma === 'plegar') return 0;
  return n.forma === 'grupo' ? (n.grupo?.ocultos.length ?? 0) : 1;
}

export function ajustarALaVentana(plano: PlanoDeLaRed, ventana: VentanaDeLaRed): PlanoDeLaRed {
  const m = MEDIDAS_DE_LA_RED;
  const altoPlegado = m.altoCabeceraHilo + m.altoPista;
  const enLaVentana = (n: NodoDeLaRed): boolean => n.x < ventana.hasta && n.x + n.ancho > ventana.desde;

  /* 1 · The expanded threads with nothing in view, and what they have on each side. */
  const fuera = new Map<string, { antes: number; despues: number }>();
  for (const h of plano.hilos) {
    if (!h.desplegado || h.alto <= altoPlegado) continue;
    const propios = plano.nodos.filter((n) => n.episodio === h.episodio.id);
    if (propios.some(enLaVentana)) continue;
    const contar = (lado: (n: NodoDeLaRed) => boolean): number => propios.filter(lado).reduce((s, n) => s + registrosDe(n), 0);
    fuera.set(h.episodio.id, { antes: contar((n) => n.x + n.ancho <= ventana.desde), despues: contar((n) => n.x >= ventana.hasta) });
  }

  /* 2 · Each band's new height. A band whose only mark is the «N después» chip
     (it sits at the view's right edge, clear of the sticky header on the
     left) takes the header's row alone: 48 px instead of 80 for one chip. An
     expanded band keeps its strip if links run in its channel. */
  const soloDespues = (l: { antes: number; despues: number }): boolean => l.antes === 0 && l.despues > 0;
  const altoNuevo = new Map<string, number>();
  for (const h of plano.hilos) {
    const lados = fuera.get(h.episodio.id);
    if (lados !== undefined) {
      altoNuevo.set(h.episodio.id, soloDespues(lados) && h.altoCanal <= 4 ? m.altoCabeceraHilo : altoPlegado);
    } else if (!h.desplegado && h.hitos.length > 0 && h.hitos.every((x) => x.x > ventana.hasta)) {
      altoNuevo.set(h.episodio.id, m.altoCabeceraHilo);
    }
  }

  /* 3 · The y, through a monotone function: each shrunk band keeps its header,
     squeezes its channel into what is left of the strip and folds the rest away. */
  const nuevaY = (y: number): number => {
    let recorte = 0;
    for (const h of plano.hilos) {
      const alto = altoNuevo.get(h.episodio.id);
      if (alto === undefined || y <= h.y + m.altoCabeceraHilo) continue;
      const fin = h.y + h.alto;
      if (y >= fin) {
        recorte += h.alto - alto;
        continue;
      }
      const pista = alto - m.altoCabeceraHilo;
      const canal = Math.max(0, Math.min(h.altoCanal, pista - 4));
      const relativa = y - h.y - m.altoCabeceraHilo;
      const enLaBanda =
        pista === 0
          ? 0
          : relativa <= h.altoCanal
            ? 2 + (h.altoCanal === 0 ? 0 : (relativa * canal) / h.altoCanal)
            : 2 + canal + ((relativa - h.altoCanal) * (pista - 2 - canal)) / (h.alto - m.altoCabeceraHilo - h.altoCanal);
      return h.y - recorte + m.altoCabeceraHilo + enLaBanda;
    }
    return y - recorte;
  };

  const hilos: HiloDeLaRed[] = plano.hilos.map((h) => {
    const y = nuevaY(h.y);
    const alto = altoNuevo.get(h.episodio.id);
    if (alto === undefined && h.desplegado) return { ...h, y, yCanal: nuevaY(h.yCanal) };
    if (alto === undefined) return { ...h, y, yPista: nuevaY(h.yPista), hitos: h.hitos.map((x) => ({ ...x, y: nuevaY(x.y) })) };
    // In the header's row the chip is centred on it; in a strip, as `ubicarRed` places it.
    const yPista = alto === m.altoCabeceraHilo ? y + m.altoCabeceraHilo / 2 : y + m.altoCabeceraHilo + m.altoPista / 2 - 6;
    const lados = fuera.get(h.episodio.id);
    if (lados === undefined) return { ...h, y, alto, yPista, hitos: h.hitos.map((x) => ({ ...x, y: yPista })) };
    return { ...h, y, alto, yCanal: nuevaY(h.yCanal), altoCanal: nuevaY(h.yCanal + h.altoCanal) - nuevaY(h.yCanal), yPista, fueraDeLaVentana: lados };
  });
  const nodos = plano.nodos.map((n) => ({ ...n, y: nuevaY(n.y) }));

  /* 3 · The lines: moved in y, then cut to the view. An edge's fade is only
     there when something is beyond it. */
  const izquierda = ventana.desde > 1 ? ventana.desde + BORDE_DEL_LIENZO : Number.NEGATIVE_INFINITY;
  const derecha = ventana.hasta < plano.ancho - 1 ? ventana.hasta - BORDE_DEL_LIENZO : Number.POSITIVE_INFINITY;
  const aristas: AristaDeLaRed[] = plano.aristas.map((a) => {
    const puntos = a.puntos.map(([x, y]): Punto => [x, nuevaY(y)]);
    const radio = a.familia === 'tronco' ? RADIO_DEL_TRONCO : undefined;
    const piezas: PiezaDeArista[] = recortar(puntos, izquierda, derecha).map((p) => ({ ...p, trazo: poligonal(p.puntos, radio) }));
    const etiqueta = a.etiqueta === undefined ? undefined : { ...a.etiqueta, y: nuevaY(a.etiqueta.y) };
    const etiquetaVisible = etiqueta !== undefined && etiqueta.x >= izquierda && etiqueta.x <= derecha;
    return { ...a, puntos, trazo: poligonal(puntos, radio), piezas, etiqueta: etiquetaVisible ? etiqueta : undefined };
  });
  return { ...plano, alto: nuevaY(plano.alto), hilos, nodos, aristas };
}

/**
 * The pieces of a polyline inside `[izquierda, derecha]`, each saying whether
 * it starts or ends at a cut. The routing is orthogonal, so a cut always falls
 * on a horizontal stretch.
 */
export function recortar(
  puntos: readonly Punto[],
  izquierda: number,
  derecha: number,
): { puntos: Punto[]; cortaInicio: boolean; cortaFin: boolean }[] {
  const dentro = (x: number): boolean => x >= izquierda && x <= derecha;
  const piezas: { puntos: Punto[]; cortaInicio: boolean; cortaFin: boolean }[] = [];
  let actual: { puntos: Punto[]; cortaInicio: boolean } | null = dentro(puntos[0][0]) ? { puntos: [puntos[0]], cortaInicio: false } : null;
  const cerrar = (cortaFin: boolean): void => {
    if (actual !== null && actual.puntos.length > 1) piezas.push({ ...actual, cortaFin });
    actual = null;
  };
  for (let i = 1; i < puntos.length; i++) {
    const [ax, ay] = puntos[i - 1];
    const [bx, by] = puntos[i];
    const enX = (x: number): Punto => [x, ay + ((by - ay) * (x - ax)) / (bx - ax)];
    if (Math.max(ax, bx) < izquierda || Math.min(ax, bx) > derecha) {
      cerrar(true);
      continue;
    }
    if (actual === null) actual = { puntos: [dentro(ax) ? puntos[i - 1] : enX(ax < izquierda ? izquierda : derecha)], cortaInicio: true };
    if (dentro(bx)) {
      actual.puntos.push(puntos[i]);
    } else {
      actual.puntos.push(enX(bx > derecha ? derecha : izquierda));
      cerrar(true);
    }
  }
  cerrar(false);
  return piezas;
}

/** The stretch an episode's records (or, collapsed, its milestones) take: where «N antes / N después» takes the canvas. */
export function tramoDelEpisodio(plano: PlanoDeLaRed, episodio: string): readonly [number, number] | null {
  const propios = plano.nodos.filter((n) => n.episodio === episodio);
  if (propios.length > 0) {
    return [Math.min(...propios.map((n) => n.x)) - 2 * DISTANCIA_DEL_TRONCO, Math.max(...propios.map((n) => n.x + n.ancho))];
  }
  const hitos = plano.hilos.find((h) => h.episodio.id === episodio)?.hitos ?? [];
  return hitos.length === 0 ? null : [hitos[0].x - MEDIDAS_DE_LA_RED.anchoAncha, hitos[hitos.length - 1].x + DISTANCIA_DEL_TRONCO];
}
