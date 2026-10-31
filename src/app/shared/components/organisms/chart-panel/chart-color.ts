/* ============================================================================
    Color de la etiqueta de una celda: la que más contraste da sobre su relleno.
    Los tonos salen de los tokens del tema; aquí solo se interpola la rampa y se
    elige entre el color de texto y el de superficie (en claro y en oscuro la
    rampa va en sentidos opuestos, y ninguno de los dos casos debe quedar ilegible).
    ========================================================================== */

type Rgb = readonly [number, number, number];

function parseHex(color: string): Rgb | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (m === null) {
    return null;
  }
  const h = m[1] ?? '';
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** Color de la rampa en la posición `t` (0–1), interpolando entre sus paradas. */
export function rampColorAt(ramp: readonly string[], t: number): Rgb | null {
  const stops = ramp.map(parseHex);
  if (stops.length === 0 || stops.some((s) => s === null)) {
    return null;
  }
  const pos = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(pos));
  const a = stops[i] as Rgb;
  const b = stops[i + 1] as Rgb;
  const f = pos - i;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Devuelve `texto` o `superficie`, el que mejor se lea sobre `fondo`. */
export function readableOn(fondo: Rgb | null, texto: string, superficie: string): string {
  const t = parseHex(texto);
  const s = parseHex(superficie);
  if (fondo === null || t === null || s === null) {
    return texto;
  }
  const mejor = contrast(fondo, t) >= contrast(fondo, s) ? texto : superficie;
  const mejorRatio = Math.max(contrast(fondo, t), contrast(fondo, s));
  if (mejorRatio >= CONTRASTE_MINIMO) {
    return mejor;
  }
  // En la mitad de la rampa ni el texto ni la superficie del tema llegan a AA (3,7–3,9:1 medido con los
  // tokens reales): ahí el negro o el blanco puros sí (≥ 4,59:1 en todo el recorrido, en los dos temas).
  return contrast(fondo, NEGRO) >= contrast(fondo, BLANCO) ? '#000000' : '#ffffff';
}

/** WCAG 2.2 AA para texto pequeño. */
const CONTRASTE_MINIMO = 4.5;
const NEGRO: Rgb = [0, 0, 0];
const BLANCO: Rgb = [255, 255, 255];
