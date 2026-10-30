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
      return formato(`m:${unidad.moneda}:${compacto}`, () =>
        new Intl.NumberFormat('es-BO', {
          style: 'currency',
          currency: unidad.moneda,
          notation: compacto ? 'compact' : 'standard',
          maximumFractionDigits: compacto ? 1 : 2,
        }),
      ).format(valor);
    case 'porcentaje':
      return `${formato(`p:${compacto}`, () =>
        new Intl.NumberFormat('es-BO', { maximumFractionDigits: 1, minimumFractionDigits: compacto ? 0 : 1 }),
      ).format(valor)} %`;
    case 'razon':
      return `${formato('r', () => new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 })).format(valor)}${unidad.sufijo}`;
    case 'numero':
      return formato(`n:${compacto}`, () =>
        new Intl.NumberFormat('es-BO', {
          notation: compacto ? 'compact' : 'standard',
          maximumFractionDigits: compacto ? 1 : 0,
        }),
      ).format(valor);
  }
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
