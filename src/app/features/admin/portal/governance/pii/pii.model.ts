import type {
  PiiField,
  PiiQuery,
  PiiSource,
  PiiSources,
} from '../../../../../core/data-access/admin-portal/governance-policies.types';
import {
  PII_SENSITIVITIES,
  PII_SOURCES,
} from '../../../../../core/data-access/admin-portal/governance-policies.types';
import { sensitivityLabel, type Rotulo } from '../../../platform/platform-labels';
import { nonEmpty } from '../../support/route-query';

/* ============================================================================
    Inventario de campos con datos personales: rótulos y consulta.

    El nivel lo clasifica el escaneo del catálogo de datos; la marca de datos
    personales o de salud, el registro de gobierno. Esta capa no vuelve a
    clasificar nada: traduce los códigos de `GET /admin/governance/pii-fields`.
    ========================================================================== */

export const PII_URL_KEYS = ['q', 'schema', 'sensitivity', 'source'] as const;
export type PiiUrlValues = Readonly<Record<(typeof PII_URL_KEYS)[number], string>>;

const LEVEL_TONES: Readonly<Record<string, Rotulo['tone']>> = {
  PERSONAL: 'warning',
  PHI_IDENTIFIER: 'error',
  PHI_SENSITIVE: 'error',
  PHI_SPECIAL: 'error',
  CREDENTIAL: 'error',
};

/** Sin nivel = el catálogo no clasificó la columna; sólo la marca el registro de gobierno. */
export const piiLevel = (code: string | null | undefined): Rotulo =>
  code
    ? { label: sensitivityLabel(code), tone: LEVEL_TONES[code] ?? 'secondary' }
    : { label: 'Sin nivel en el catálogo', tone: 'secondary' };

export const PII_LEVEL_OPTIONS = PII_SENSITIVITIES.map((value) => ({
  value,
  label: piiLevel(value).label,
}));

const SOURCES: Readonly<Record<PiiSource, string>> = {
  CATALOG: 'Sólo catálogo de datos',
  REGISTRY: 'Sólo registro de gobierno',
  BOTH: 'Catálogo y registro',
};

export const piiSource = (code: PiiSource): string => SOURCES[code];
export const PII_SOURCE_OPTIONS = PII_SOURCES.map((value) => ({ value, label: SOURCES[value] }));

/** Cómo se protege el campo según el registro de gobierno; sin registro, no hay protección declarada. */
export function piiProtection(field: Pick<PiiField, 'registry'>): readonly string[] {
  const r = field.registry;
  if (!r) return [];
  return [
    r.maskingStrategy ? `Enmascarado: ${r.maskingStrategy}` : null,
    r.anonymizationRule ? `Anonimización: ${r.anonymizationRule}` : null,
  ].filter((x): x is string => x !== null);
}

/** Lo que el registro de gobierno dice del campo, en una frase. */
export function piiRegistryMark(field: Pick<PiiField, 'registry'>): string | null {
  const r = field.registry;
  if (!r) return null;
  const marks = [r.isPii ? 'datos personales' : null, r.isPhi ? 'datos de salud' : null].filter(
    (m): m is string => m !== null,
  );
  return `Registro de gobierno: ${marks.length ? marks.join(' y ') : 'sin marca de datos personales'}`;
}

export function hasPiiFilters(values: PiiUrlValues): boolean {
  return PII_URL_KEYS.some((k) => values[k] !== '');
}

/** La consulta a la API: sólo filtros con valor, y niveles/fuentes que la API acepta. */
export function piiQuery(values: PiiUrlValues): PiiQuery {
  return nonEmpty({
    q: values.q,
    schema: /^[A-Za-z0-9_]{1,80}$/.test(values.schema) ? values.schema : '',
    sensitivity: (PII_SENSITIVITIES as readonly string[]).includes(values.sensitivity)
      ? values.sensitivity
      : '',
    source: (PII_SOURCES as readonly string[]).includes(values.source) ? values.source : '',
  }) as PiiQuery;
}

/** Por qué la lista está vacía, dicho con lo que la API informa de sus fuentes. */
export function emptyReason(sources: PiiSources | null, filtered: boolean): string {
  if (filtered) return 'Ningún campo coincide con los filtros elegidos.';
  if (sources === null) return 'No hay campos con datos personales registrados.';
  if (sources.catalogColumns === 0 && sources.registryFields === 0) {
    return 'Todavía no hay campos que mostrar: el catálogo de datos no tiene columnas escaneadas y el registro de gobierno está vacío.';
  }
  if (sources.catalogColumns === 0) {
    return 'El catálogo de datos no tiene columnas escaneadas y el registro de gobierno no marca ningún campo como personal.';
  }
  return `El catálogo tiene ${sources.catalogColumns.toLocaleString('es-BO')} columnas, ninguna clasificada como dato personal o secreto, y el registro de gobierno no marca ningún campo.`;
}
