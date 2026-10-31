import type {
  OperacionDetalle,
  TablaOperacion,
} from '../../../../core/data-access/admin-portal/portal.types';

/* ============================================================================
    De las filas `datos[]` del inventario a tablas afectadas legibles.

    La API devuelve una fila por (tabla, efecto, camino): `billing.bills` sale
    dos veces en `POST /billing/bills` —una `ESCRIBE/CREA`, otra `LEE`— y una
    misma tabla escrita desde dos repositorios sale otras dos. Acá se agrupa por
    tabla y efecto, juntando los caminos (`via`), las fuentes y las confianzas,
    para que la pestaña cuente tablas y no filas. No se inventa nada: cada dato
    que se muestra viene de alguna fila.
    ========================================================================== */

export const TABLE_EFFECTS = ['LEE', 'ESCRIBE', 'BORRA'] as const;
export type TableEffectCode = (typeof TABLE_EFFECTS)[number];

/** El orden en que se muestran las confianzas: de la más firme a la más débil. */
const CONFIDENCE_ORDER = ['DIRECTA', 'POR_TIPO', 'POR_REGISTRO', 'POR_SQL'] as const;

export interface AffectedTable {
  readonly schema: string;
  readonly table: string;
  readonly qualified: string;
  readonly effect: string;
  /** `CREA`, `ACTUALIZA`, `GUARDA`, `BORRA`, `LEE`… sin repetir. */
  readonly details: readonly string[];
  /** Confianzas distintas con que el generador llegó a esta tabla, de la más firme a la más débil. */
  readonly confidences: readonly string[];
  /** Caminos handler → servicio → repositorio, uno por fila de origen, sin repetir. */
  readonly paths: readonly (readonly string[])[];
  /** `archivo:línea` de cada acceso, sin repetir. */
  readonly sources: readonly string[];
  readonly catalogued: boolean;
}

export interface AffectedTableGroup {
  readonly effect: string;
  readonly tables: readonly AffectedTable[];
}

export interface AffectedTableCounts {
  /** Tablas distintas (una tabla leída y escrita cuenta una vez). */
  readonly distinct: number;
  readonly byEffect: Readonly<Record<TableEffectCode, number>>;
  /** Efectos que no son LEE/ESCRIBE/BORRA; se muestran igual, en su propio grupo. */
  readonly other: number;
}

export interface AffectedTablesSummary {
  readonly counts: AffectedTableCounts;
  readonly groups: readonly AffectedTableGroup[];
}

function unique<T>(values: readonly T[], key: (v: T) => string): T[] {
  const seen = new Set<string>();
  return values.filter((v) => {
    const k = key(v);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function confidenceRank(code: string): number {
  const i = (CONFIDENCE_ORDER as readonly string[]).indexOf(code);
  return i < 0 ? CONFIDENCE_ORDER.length : i;
}

function merge(rows: readonly TablaOperacion[]): AffectedTable {
  const first = rows[0]!;
  return {
    schema: first.schema,
    table: first.tabla,
    qualified: `${first.schema}.${first.tabla}`,
    effect: first.operacion,
    details: unique(rows.map((r) => r.detalle).filter(Boolean), (d) => d),
    confidences: unique(rows.map((r) => r.confianza).filter(Boolean), (c) => c).sort(
      (a, b) => confidenceRank(a) - confidenceRank(b),
    ),
    paths: unique(
      rows.map((r) => r.via).filter((v) => v.length > 0),
      (v) => v.join('>'),
    ),
    sources: unique(rows.map((r) => r.fuente).filter(Boolean), (s) => s),
    catalogued: rows.every((r) => r.catalogada),
  };
}

/**
 * Agrupa `datos[]` por efecto y, dentro de cada efecto, por tabla. Los grupos
 * salen en el orden Lee · Escribe · Borra y después cualquier efecto que el
 * generador haya inventado más tarde; los grupos vacíos no salen.
 */
export function summarizeAffectedTables(datos: readonly TablaOperacion[]): AffectedTablesSummary {
  const byKey = new Map<string, TablaOperacion[]>();
  for (const row of datos) {
    const key = `${row.operacion}|${row.schema}.${row.tabla}`;
    byKey.set(key, [...(byKey.get(key) ?? []), row]);
  }
  const merged = [...byKey.values()].map(merge);

  const known = TABLE_EFFECTS.map((effect) => ({
    effect,
    tables: merged.filter((t) => t.effect === effect),
  }));
  const otherEffects = unique(
    merged.map((t) => t.effect).filter((e) => !(TABLE_EFFECTS as readonly string[]).includes(e)),
    (e) => e,
  ).map((effect) => ({ effect, tables: merged.filter((t) => t.effect === effect) }));

  const groups = [...known, ...otherEffects].filter((g) => g.tables.length > 0);
  const byEffect = Object.fromEntries(
    TABLE_EFFECTS.map((e) => [e, known.find((g) => g.effect === e)?.tables.length ?? 0]),
  ) as Record<TableEffectCode, number>;

  return {
    counts: {
      distinct: new Set(merged.map((t) => t.qualified)).size,
      byEffect,
      other: otherEffects.reduce((n, g) => n + g.tables.length, 0),
    },
    groups,
  };
}

/**
 * «N tablas: X leídas · Y escritas · Z borradas». Cuenta tablas distintas, no
 * filas, que es lo que infla el número `tablas` del resumen de la API.
 */
export function affectedTablesHeadline(counts: AffectedTableCounts): string {
  const n = counts.distinct;
  const head = n === 1 ? '1 tabla' : `${n} tablas`;
  const parts = [
    `${counts.byEffect.LEE} ${counts.byEffect.LEE === 1 ? 'leída' : 'leídas'}`,
    `${counts.byEffect.ESCRIBE} ${counts.byEffect.ESCRIBE === 1 ? 'escrita' : 'escritas'}`,
    `${counts.byEffect.BORRA} ${counts.byEffect.BORRA === 1 ? 'borrada' : 'borradas'}`,
  ];
  if (counts.other > 0) parts.push(`${counts.other} con otro efecto`);
  return `${head}: ${parts.join(' · ')}`;
}

/** Qué clase de operación es, derivada del método y de lo que toca: no es un campo de la API. */
export type OperationKind = 'SOLO_LECTURA' | 'ESCRITURA' | 'DESTRUCTIVA' | 'SIN_DATO';

export function operationKind(op: Pick<OperacionDetalle, 'datos'>): OperationKind {
  if (op.datos.some((d) => d.operacion === 'BORRA')) return 'DESTRUCTIVA';
  if (op.datos.some((d) => d.operacion === 'ESCRIBE')) return 'ESCRITURA';
  if (op.datos.length > 0 && op.datos.every((d) => d.operacion === 'LEE')) return 'SOLO_LECTURA';
  return 'SIN_DATO';
}
