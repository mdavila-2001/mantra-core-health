import type { DerivaCatalogo } from '../../../../core/data-access/admin-portal/portal.types';

/* ============================================================================
    La deriva entre el DDL del modelo, el ORM y la base, leída sin suponer.

    `/admin/portal/catalogo/deriva` declara `resumen` y `deriva` como objetos
    abiertos: cada clave es una lista (los casos) o un número (el recuento). Acá
    se nombran las claves que se conocen y las demás se muestran con su clave
    tal cual: inventar un significado sería peor que no traducirlo.
    ========================================================================== */

/** Qué mide cada clave de `deriva`, en palabras del producto. */
const DRIFT_LABELS: Readonly<Record<string, string>> = {
  entidadesSinTabla: 'Entidades del ORM sin tabla en el modelo',
  tablasSinEntidad: 'Tablas del modelo sin entidad en el ORM',
  columnasAusentesEnOrm: 'Columnas del modelo ausentes en su entidad',
  columnasDeMasEnOrm: 'Columnas de la entidad que el modelo no tiene',
  nulabilidad: 'Columnas con nulabilidad divergente',
  tipos: 'Columnas con tipo divergente',
  esquemasSinCatalogoDeApi: 'Schemas sin catálogo de la API',
  esquemasSinDominio: 'Schemas sin dominio de negocio',
};

export interface DriftMetric {
  readonly key: string;
  readonly label: string;
  readonly value: number;
}

export interface OrphanEntity {
  readonly table: string;
  readonly className: string;
  readonly file: string;
  readonly ddlKind: string;
  readonly ddlSource: string | null;
}

export interface DriftView {
  readonly metrics: readonly DriftMetric[];
  readonly orphanEntities: readonly OrphanEntity[];
  readonly schemasWithoutDomain: readonly string[];
  readonly schemasWithoutApiCatalog: readonly string[];
  readonly tables: number | null;
  readonly divergingTables: number | null;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asText(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function asStrings(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function asCount(value: unknown): number | null {
  if (Array.isArray(value)) return value.length;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function orphan(value: unknown): OrphanEntity | null {
  const row = asRecord(value);
  const table = asText(row?.['tabla']);
  if (!row || !table) return null;
  const ddl = asRecord(row['ddl']);
  return {
    table,
    className: asText(row['clase']) ?? '—',
    file: asText(row['archivo']) ?? '—',
    ddlKind: asText(ddl?.['tipo']) ?? '',
    ddlSource: asText(ddl?.['fuente']),
  };
}

/** De la respuesta abierta a lo que la pantalla dibuja. */
export function readDrift(body: DerivaCatalogo): DriftView {
  const drift = asRecord(body.deriva) ?? {};
  const summary = asRecord(body.resumen) ?? {};
  const metrics: DriftMetric[] = [];
  for (const [key, value] of Object.entries(drift)) {
    const n = asCount(value);
    if (n !== null) metrics.push({ key, label: DRIFT_LABELS[key] ?? key, value: n });
  }
  return {
    metrics,
    orphanEntities: (Array.isArray(drift['entidadesSinTabla']) ? drift['entidadesSinTabla'] : [])
      .map(orphan)
      .filter((o): o is OrphanEntity => o !== null),
    schemasWithoutDomain: asStrings(drift['esquemasSinDominio']),
    schemasWithoutApiCatalog: asStrings(drift['esquemasSinCatalogoDeApi']),
    tables: asCount(summary['tablas']),
    divergingTables: asCount(asRecord(summary['orm'])?.['DIVERGE']),
  };
}

/** Un caso de un hallazgo, ya escrito: qué es, qué pasa y dónde está. */
export interface FindingItemView {
  readonly title: string;
  readonly detail: string | null;
  readonly source: string | null;
  readonly operationId: string | null;
}

/**
 * Los casos de un hallazgo no tienen una sola forma: unos son operaciones
 * (`metodo`, `ruta`), otros procesos (`nombre`). Se toma lo que traiga.
 */
export function describeFindingItem(item: Readonly<Record<string, unknown>>): FindingItemView {
  const method = asText(item['metodo']);
  const route = asText(item['ruta']);
  const title =
    (route ? [method, route].filter(Boolean).join(' ') : null) ??
    asText(item['nombre']) ??
    asText(item['proceso']) ??
    asText(item['operacion']) ??
    asText(item['tabla']) ??
    'Caso sin nombre';
  return {
    title,
    detail: asText(item['detalle']),
    source: asText(item['fuente']),
    operationId: asText(item['operacion']),
  };
}
