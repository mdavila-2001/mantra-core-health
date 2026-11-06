import type { UnidadValor } from './reporting.types';

/** Lo que se escribe cuando no hay dato. Nunca «0», nunca un guion suelto. */
export const NO_DATA = 'Sin dato';

const FORMATOS = new Map<string, Intl.NumberFormat>();

function formato(clave: string, crear: () => Intl.NumberFormat): Intl.NumberFormat {
  let f = FORMATOS.get(clave);
  if (f === undefined) {
    f = crear();
    FORMATOS.set(clave, f);
  }
  return f;
}

/** `12,5 k`, `1,2 M`, `3 mil M`: el sufijo no depende del idioma del navegador, para que un eje no mezcle `3 K` con `12 k`. */
function abreviar(valor: number): string {
  const abs = Math.abs(valor);
  const [n, sufijo] =
    abs >= 1e9 ? [valor / 1e9, ' mil M'] : abs >= 1e6 ? [valor / 1e6, ' M'] : abs >= 1e3 ? [valor / 1e3, ' k'] : [valor, ''];
  return `${formato('c', () => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1 })).format(n)}${sufijo}`;
}

function simboloMoneda(moneda: string): string {
  return formato(`s:${moneda}`, () => new Intl.NumberFormat('es-BO', { style: 'currency', currency: moneda }))
    .formatToParts(0)
    .find((p) => p.type === 'currency')?.value ?? moneda;
}

/**
 * Da formato a un valor según su unidad. `null` y `NaN` salen como «Sin dato»:
 * un reporte que convierte la ausencia en cero miente (CLAUDE.md, regla de la
 * casa; mismo criterio que AtlasDashboards).
 */
export function formatearValor(
  valor: number | null | undefined,
  unidad: UnidadValor,
  compacto = false,
): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) {
    return NO_DATA;
  }
  switch (unidad.tipo) {
    case 'moneda':
      if (compacto) {
        return `${simboloMoneda(unidad.moneda)} ${abreviar(valor)}`;
      }
      return formato(`m:${unidad.moneda}`, () =>
        new Intl.NumberFormat('es-BO', { style: 'currency', currency: unidad.moneda, maximumFractionDigits: 2 }),
      ).format(valor);
    case 'porcentaje':
      return `${formato(`p:${compacto}`, () =>
        new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1, minimumFractionDigits: compacto ? 0 : 1 }),
      ).format(valor)} %`;
    case 'duracion':
      return formatearDuracion(valor);
    case 'razon':
      return `${formato('r', () => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 })).format(valor)}${unidad.sufijo}`;
    case 'numero':
      if (compacto) {
        return abreviar(valor);
      }
      return formato('n', () => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 0 })).format(valor);
  }
}

/** Milisegundos legibles: «0,4 ms», «850 ms», «1,2 s», «2,5 min». Negativo no existe: un tiempo no baja de cero. */
export function formatearDuracion(ms: number): string {
  const nf = (max: number) => formato(`d:${max}`, () => new Intl.NumberFormat('es-BO', { maximumFractionDigits: max }));
  if (ms < 1) {
    return `${nf(2).format(ms)} ms`;
  }
  if (ms < 1000) {
    return `${nf(ms < 10 ? 1 : 0).format(ms)} ms`;
  }
  if (ms < 60_000) {
    return `${nf(1).format(ms / 1000)} s`;
  }
  return `${nf(1).format(ms / 60_000)} min`;
}

/** «+4,2 %» / «−1,0 %» con signo explícito; `null` → «Sin comparativo». */
export function formatearVariacion(pct: number | null): string {
  if (pct === null || Number.isNaN(pct)) {
    return 'Sin comparativo';
  }
  const signo = pct > 0 ? '+' : pct < 0 ? '−' : '';
  return `${signo}${formato('v', () => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1, minimumFractionDigits: 1 })).format(Math.abs(pct))} %`;
}

/** «hace 5 min», «hace 3 h», «hace 2 d». */
export function formatearFrescura(minutos: number): string {
  if (minutos < 1) {
    return 'actualizado ahora';
  }
  if (minutos < 60) {
    return `hace ${Math.round(minutos)} min`;
  }
  if (minutos < 60 * 24) {
    return `hace ${Math.round(minutos / 60)} h`;
  }
  return `hace ${Math.round(minutos / 1440)} d`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_MONTH = /^(\d{4})-(\d{2})$/;

/**
 * «2026-10-06» → «6 oct» (o «6 oct 2026» con `conAnio`). Cualquier otro texto vuelve igual: una
 * categoría que no es una fecha («Esencial», «T1») no se toca. Se parte el texto a mano, sin `Date`,
 * para que la zona horaria del navegador no mueva el día.
 */
export function formatDate(texto: string, conAnio = false): string {
  const mensual = ISO_MONTH.exec(texto);
  const monthName = mensual === null ? undefined : MESES[Number(mensual[2]) - 1];
  if (mensual !== null && monthName !== undefined) {
    // Un mes de cohorte («2026-05») se lee «may 2026»: aquí el año es parte de lo que se quiere decir.
    return `${monthName} ${mensual[1]}`;
  }
  const m = ISO_DATE.exec(texto);
  const mes = m === null ? undefined : MESES[Number(m[2]) - 1];
  if (m === null || mes === undefined) {
    return texto;
  }
  const dia = String(Number(m[3]));
  return conAnio ? `${dia} ${mes} ${m[1]}` : `${dia} ${mes}`;
}
