import type { Tone } from '../../../../../shared/components/tone/tone.types';
import type { MetricTone } from '../../../../../shared/components/molecules/metric-card/metric-card.types';
import type {
  FitCheckResult,
  FitCheckStatus,
  FitDimension,
  FitDimensionScore,
  FitHistoryEntry,
  FitRunTrigger,
  FitSeverity,
} from '../../../../../core/data-access/admin-portal/catalog-fit.types';

/* ============================================================================
    Rótulos de la sonda de ajuste de la catalogación.

    Traducen los códigos de la API a texto y a tono. No deciden nada: el estado,
    el veredicto y el puntaje los calcula el servidor. Un código que no esté
    acá se muestra tal cual con tono neutro, no se le inventa un significado.
    El color nunca va solo: todo rótulo lleva su texto.
    ========================================================================== */

export interface Rotulo {
  readonly label: string;
  readonly tone: Tone;
}

const NEUTRO = (code: string): Rotulo => ({ label: code, tone: 'secondary' });

const tabla =
  (entradas: Readonly<Record<string, Rotulo>>) =>
  (code: string | null | undefined): Rotulo =>
    code ? (entradas[code] ?? NEUTRO(code)) : { label: 'Sin dato', tone: 'secondary' };

export const DIMENSIONES: Readonly<
  Record<FitDimension, { readonly label: string; readonly question: string }>
> = {
  ROUTES: {
    label: 'Rutas',
    question: '¿Las rutas del código y el inventario de operaciones cuentan lo mismo?',
  },
  MODEL: {
    label: 'Modelo y base',
    question: '¿El modelo, el ORM y la base observada tienen las mismas tablas y columnas?',
  },
  COMPLETENESS: {
    label: 'Completitud',
    question: '¿Cada operación y cada tabla tienen su ficha completa?',
  },
  FRESHNESS: {
    label: 'Frescura',
    question: '¿El escaneo y la importación son del código que está desplegado?',
  },
  MUTABILITY: {
    label: 'Mutabilidad',
    question: '¿Cada tabla declara si se puede editar, borrar o purgar?',
  },
  SENSITIVITY: {
    label: 'Sensibilidad',
    question: '¿Cada tabla y columna con datos personales está clasificada?',
  },
};

export const dimensionLabel = (d: FitDimension): string => DIMENSIONES[d]?.label ?? d;

export const verdict = tabla({
  AJUSTADA: { label: 'Ajustada', tone: 'success' },
  CON_AVISOS: { label: 'Ajustada con avisos', tone: 'warning' },
  DESAJUSTADA: { label: 'Desajustada', tone: 'error' },
  SIN_DATOS: { label: 'Sin datos para decidir', tone: 'secondary' },
});

export const checkStatus = tabla({
  OK: { label: 'Cumple', tone: 'success' },
  FALLA: { label: 'Falla', tone: 'error' },
  SIN_DATO: { label: 'Sin dato', tone: 'secondary' },
  NO_DECLARADO: { label: 'No declarado', tone: 'info' },
  NO_APLICA: { label: 'No aplica', tone: 'secondary' },
});

export const severity = tabla({
  ALTA: { label: 'Alta', tone: 'error' },
  MEDIA: { label: 'Media', tone: 'warning' },
  BAJA: { label: 'Baja', tone: 'info' },
  INFO: { label: 'Informativa', tone: 'secondary' },
});

export const trigger = (t: FitRunTrigger): string =>
  t === 'TICK' ? 'Automática (worker)' : 'Manual';

/** Un puntaje: `null` nunca es 0 %; dice por qué no hay número. */
export function ratioText(d: FitDimensionScore): string {
  if (d.status === 'NO_DECLARADO') return 'No declarado';
  if (d.status === 'SIN_DATO') return 'Sin dato';
  if (d.status === 'NO_APLICA' || d.ratio === null) return 'No aplica';
  return `${(d.ratio * 100).toLocaleString('es-BO', { maximumFractionDigits: 1 })} %`;
}

export function entero(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : valor.toLocaleString('es-BO');
}

/** «13 de 15 ítems»: el numerador y el denominador del puntaje, o por qué no los hay. */
export function baseText(covered: number | null, denominator: number | null): string {
  return covered === null || denominator === null
    ? 'Sin base para medir'
    : `${entero(covered)} de ${entero(denominator)}`;
}

/** El detalle bajo el puntaje de una dimensión. */
export function dimensionHint(d: FitDimensionScore): string {
  if (d.status !== 'MEDIDA') return `${d.checksUnmeasured} comprobación(es) sin medir`;
  const partes = [`${baseText(d.covered, d.denominator)} ítems`];
  if (d.checksFailed > 0)
    partes.push(`${d.checksFailed} de ${d.checksMeasured} comprobaciones fallan`);
  if (d.checksUnmeasured > 0) partes.push(`${d.checksUnmeasured} sin medir`);
  return partes.join(' · ');
}

/**
 * El tono de la tarjeta de una dimensión: error si falla una comprobación de severidad alta,
 * aviso si falla otra, neutro si no se pudo medir. Siempre acompañado del texto del puntaje.
 */
export function dimensionTone(d: FitDimensionScore, checks: readonly FitCheckResult[]): MetricTone {
  if (d.status !== 'MEDIDA') return d.status === 'NO_DECLARADO' ? 'info' : 'neutral';
  const fallas = checks.filter((c) => c.dimension === d.dimension && c.status === 'FALLA');
  if (fallas.some((c) => c.severity === 'ALTA')) return 'error';
  return fallas.length > 0 ? 'warning' : 'success';
}

/** `hace 3 min`, `hace 2 h`: la antigüedad del dato, siempre a la vista (S7). */
export function ageText(seconds: number | null): string {
  if (seconds === null) return 'sin dato';
  if (seconds < 60) return 'hace menos de un minuto';
  if (seconds < 3_600) return `hace ${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `hace ${Math.round(seconds / 3_600)} h`;
  return `hace ${Math.round(seconds / 86_400)} d`;
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return 'Sin dato';
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime())
    ? 'Sin dato'
    : fecha.toLocaleString('es-BO', { dateStyle: 'medium', timeStyle: 'short' });
}

/** Una fila de la tabla de comprobaciones, ya en palabras. */
export interface FilaComprobacion {
  readonly id: string;
  readonly check: FitCheckResult;
  readonly dimension: string;
  readonly base: string;
  readonly hallazgos: string;
}

export function filaDeComprobacion(c: FitCheckResult): FilaComprobacion {
  return {
    id: c.id,
    check: c,
    dimension: dimensionLabel(c.dimension),
    base: baseText(c.covered, c.denominator),
    hallazgos: c.status === 'FALLA' ? entero(c.findingsTotal) : '—',
  };
}

export type FiltroComprobaciones = 'fallan' | 'ciegas' | 'todas';

/** Orden: primero lo que más importa, las fallas altas; los puntos ciegos antes que lo que cumple. */
const PESO_ESTADO: Readonly<Record<FitCheckStatus, number>> = {
  FALLA: 0,
  SIN_DATO: 1,
  NO_DECLARADO: 2,
  OK: 3,
  NO_APLICA: 4,
};
const PESO_SEVERIDAD: Readonly<Record<FitSeverity, number>> = {
  ALTA: 0,
  MEDIA: 1,
  BAJA: 2,
  INFO: 3,
};

export function ordenarComprobaciones(
  checks: readonly FitCheckResult[],
  filtro: FiltroComprobaciones,
): readonly FitCheckResult[] {
  const visibles = checks.filter((c) =>
    filtro === 'fallan'
      ? c.status === 'FALLA'
      : filtro === 'ciegas'
        ? c.status === 'SIN_DATO' || c.status === 'NO_DECLARADO'
        : true,
  );
  return [...visibles].sort(
    (a, b) =>
      PESO_ESTADO[a.status] - PESO_ESTADO[b.status] ||
      PESO_SEVERIDAD[a.severity] - PESO_SEVERIDAD[b.severity] ||
      a.id.localeCompare(b.id),
  );
}

/** Una fila del historial: el ratio de cada dimensión en una línea legible. */
export interface FilaHistorial {
  readonly id: string;
  readonly entry: FitHistoryEntry;
  readonly dimensiones: string;
}

export function filaDeHistorial(e: FitHistoryEntry): FilaHistorial {
  const texto = e.dimensions
    .map((d) => {
      const valor =
        d.ratio === null
          ? d.status === 'NO_DECLARADO'
            ? 'no declarado'
            : d.status === 'SIN_DATO'
              ? 'sin dato'
              : 'no aplica'
          : `${(d.ratio * 100).toLocaleString('es-BO', { maximumFractionDigits: 1 })} %`;
      return `${dimensionLabel(d.dimension)} ${valor}`;
    })
    .join(' · ');
  return { id: e.runId, entry: e, dimensiones: texto };
}

/** Los pares clave/valor de la evidencia de una comprobación, para mostrarlos. */
export function evidenceRows(
  evidence: FitCheckResult['evidence'],
): readonly { key: string; value: string }[] {
  return Object.entries(evidence).map(([key, value]) => ({
    key,
    value: value === null ? '—' : String(value),
  }));
}
