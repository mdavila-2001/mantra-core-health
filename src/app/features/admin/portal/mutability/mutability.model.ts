import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import {
  DISPOSITIONS,
  EVIDENCE_LEVELS,
  FINDING_FILTERS,
  LEGAL_HOLD_STATES,
  WRITE_MODES,
  type EvidenceLevel,
  type MutabilityQuery,
  type MutabilityRatio,
} from '../../../../core/data-access/admin-portal/mutability.types';
import type { Rotulo } from '../../platform/platform-labels';
import { nonEmpty } from '../support/route-query';

/* ============================================================================
    Mutabilidad de datos: rótulos, descripciones y consulta.

    Traducen los códigos de `GET /admin/governance/mutability` a texto y color.
    No deciden nada: un código nuevo se muestra tal cual con tono neutro. **El
    color nunca va solo** y «sin evidencia» (`UNKNOWN`) jamás se rotula «No».
    ========================================================================== */

export const MUTABILITY_VIEWS = ['summary', 'tables', 'contradictions', 'evidence'] as const;
export type MutabilityView = (typeof MUTABILITY_VIEWS)[number];

/** Filtros de la pestaña «Tablas» en la URL; `view` y `table` los maneja la pantalla. */
export const MUTABILITY_URL_KEYS = [
  'q',
  'schema',
  'writeMode',
  'evidence',
  'finding',
  'disposition',
  'legalHold',
] as const;
export type MutabilityUrlValues = Readonly<Record<(typeof MUTABILITY_URL_KEYS)[number], string>>;

type Tabla = ((code: string | null | undefined) => Rotulo) & { readonly codes: readonly string[] };

function tabla(entradas: Readonly<Record<string, Rotulo>>, faltante = 'Sin dato'): Tabla {
  const rotular = (code: string | null | undefined): Rotulo =>
    code
      ? (entradas[code] ?? { label: code, tone: 'secondary' })
      : { label: faltante, tone: 'secondary' };
  return Object.assign(rotular, { codes: Object.keys(entradas) });
}

function opciones(t: Tabla, codigos: readonly string[]): readonly SelectOption<string>[] {
  return codigos.map((value) => ({ value, label: t(value).label }));
}

export const writeMode = tabla({
  APPEND_ONLY: { label: 'Sólo se agrega', tone: 'info' },
  APPEND_ONLY_PURGEABLE: { label: 'Sólo se agrega; se purga por retención', tone: 'info' },
  LIFECYCLE_ONLY: { label: 'Sólo avanza su ciclo de vida', tone: 'primary' },
  UPDATABLE: { label: 'Se actualiza; no se borra', tone: 'secondary' },
  UPDATABLE_DELETABLE: { label: 'Se actualiza y se borra', tone: 'warning' },
  SOFT_DELETE: { label: 'Borrado lógico', tone: 'secondary' },
  UNKNOWN: { label: 'Sin evidencia (no se sabe)', tone: 'secondary' },
});

export const WRITE_MODE_HELP: Readonly<Record<string, string>> = {
  APPEND_ONLY: 'Se inserta; UPDATE, DELETE y TRUNCATE no.',
  APPEND_ONLY_PURGEABLE: 'Se inserta; no se actualiza; sólo se borra para aplicar la retención.',
  LIFECYCLE_ONLY: 'Lo registrado no se reescribe: sólo avanza su estado o se cierra su vigencia.',
  UPDATABLE: 'Se inserta y se actualiza; nada indica que se borre.',
  UPDATABLE_DELETABLE: 'Se inserta, se actualiza y el código la borra con DELETE.',
  SOFT_DELETE: 'Se marca como borrada (deleted_at/archived_at) en vez de eliminarse.',
  UNKNOWN: 'Ninguna fuente lo dice. No significa «se puede escribir» ni «no se puede».',
};

export const evidenceLevel = tabla({
  ENFORCED_DB: { label: 'Impuesto por la base', tone: 'success' },
  ENFORCED_CODE: { label: 'Visto en el código', tone: 'info' },
  DECLARED_MODEL: { label: 'Declarado en el modelo', tone: 'primary' },
  DECLARED_DOC: { label: 'Declarado en un README', tone: 'warning' },
  INFERRED: { label: 'Inferido', tone: 'warning' },
  UNKNOWN: { label: 'Sin evidencia', tone: 'secondary' },
});

export const EVIDENCE_HELP: Readonly<Record<EvidenceLevel, string>> = {
  ENFORCED_DB:
    'Un disparador o un privilegio revocado a la aplicación lo impide: la base lo rechaza aunque el código lo intente.',
  ENFORCED_CODE:
    'El código lo hace o lo restringe (una vía de borrado o de purga observada). La base no lo impide.',
  DECLARED_MODEL:
    'Lo declara el diagrama (<<IMMUTABLE>>, <<APPEND_ONLY>>) o la matriz de integridad. Es una intención: sola, no impide nada.',
  DECLARED_DOC: 'Lo dice el README de un módulo. Es prosa, no un control.',
  INFERRED:
    'Una pista por la estructura (columnas) o por el tipo de endpoint. No es un hecho y no sostiene un registro.',
  UNKNOWN: 'No hay evidencia. «No se sabe» no es lo mismo que «No».',
};

export const disposition = tabla({
  KEEP: { label: 'Se conserva', tone: 'secondary' },
  PURGE_BY_RETENTION: { label: 'Se purga por retención', tone: 'warning' },
  ANONYMIZE: { label: 'Se anonimiza', tone: 'info' },
  ARCHIVE: { label: 'Se archiva', tone: 'info' },
  UNKNOWN: { label: 'Sin política (no se sabe)', tone: 'secondary' },
});

export const legalHold = tabla({
  HOLD_AWARE: { label: 'Respeta el legal hold', tone: 'success' },
  HOLD_CAPABLE_NOT_ENFORCED: { label: 'Admite hold, ningún barrido lo consulta', tone: 'warning' },
  UNKNOWN: { label: 'Sin evidencia', tone: 'secondary' },
});

export const findingKind = tabla({
  CONTRADICTION: { label: 'Contradicción', tone: 'error' },
  GAP: { label: 'Brecha', tone: 'warning' },
});

export const severity = tabla({
  HIGH: { label: 'Severidad alta', tone: 'error' },
  MEDIUM: { label: 'Severidad media', tone: 'warning' },
  LOW: { label: 'Severidad baja', tone: 'secondary' },
});

const FINDING_CODES: Readonly<Record<string, string>> = {
  DECLARED_VS_CODE_UPDATE: 'Declarada sin UPDATE, pero el código actualiza',
  DECLARED_VS_CODE_DELETE: 'Declarada sin DELETE, pero el código borra',
  ENFORCED_VS_CODE_UPDATE: 'La base impide el UPDATE, pero el código actualiza',
  ENFORCED_VS_CODE_DELETE: 'La base impide el DELETE, pero el código borra',
  ENFORCED_WITHOUT_DECLARATION: 'Barrera en la base sin ninguna declaración',
  SOFT_COLUMN_VS_HARD_DELETE: 'Tiene borrado lógico y el código también borra',
  DECLARED_NOT_ENFORCED: 'Declarada inmutable, sin barrera que la imponga',
};
export const findingCode = (code: string): string => FINDING_CODES[code] ?? code;

const FILTER_FINDING: Readonly<Record<string, string>> = {
  ANY: 'Con algún hallazgo',
  NONE: 'Sin hallazgos',
  CONTRADICTION: 'Con contradicciones',
  GAP: 'Con brechas',
};

export const WRITE_MODE_OPTIONS = opciones(writeMode, WRITE_MODES);
export const EVIDENCE_OPTIONS = opciones(evidenceLevel, EVIDENCE_LEVELS);
export const DISPOSITION_OPTIONS = opciones(disposition, DISPOSITIONS);
export const LEGAL_HOLD_OPTIONS = opciones(legalHold, LEGAL_HOLD_STATES);
export const FINDING_OPTIONS: readonly SelectOption<string>[] = FINDING_FILTERS.map((value) => ({
  value,
  label: FILTER_FINDING[value] ?? value,
}));

/** «12 de 340»: la cuenta siempre con su denominador. */
export function ratioText(r: MutabilityRatio): string {
  return `${r.numerator.toLocaleString('es-BO')} de ${r.denominator.toLocaleString('es-BO')}`;
}

/** Plazo de retención en una frase; sin plazo no se inventa uno. */
export function retentionText(
  retention: { days: number | null; status: string } | null,
): string | null {
  if (!retention) return null;
  const plazo =
    retention.days === null
      ? 'Sin plazo declarado'
      : `${retention.days} días declarados en el modelo`;
  return `${plazo} · pendiente de cumplimiento (sin base legal confirmada)`;
}

export function hasMutabilityFilters(values: MutabilityUrlValues): boolean {
  return MUTABILITY_URL_KEYS.some((k) => values[k] !== '');
}

const incluye = (codigos: readonly string[], valor: string): string =>
  codigos.includes(valor) ? valor : '';

/** La consulta a la API: sólo filtros con valor y dentro de lo que la API acepta. */
export function mutabilityQuery(
  values: MutabilityUrlValues,
  fixed: Partial<MutabilityQuery> = {},
): MutabilityQuery {
  return {
    ...(nonEmpty({
      q: values.q,
      schema: /^[a-z][a-z0-9_]{0,62}$/.test(values.schema) ? values.schema : '',
      writeMode: incluye(WRITE_MODES, values.writeMode),
      evidence: incluye(EVIDENCE_LEVELS, values.evidence),
      finding: incluye(FINDING_FILTERS, values.finding),
      disposition: incluye(DISPOSITIONS, values.disposition),
      legalHold: incluye(LEGAL_HOLD_STATES, values.legalHold),
    }) as MutabilityQuery),
    ...fixed,
  };
}

/** `schema.tabla` de la URL, o `null` si no tiene esa forma. */
export function parseTableParam(value: string): { schema: string; table: string } | null {
  const m = /^([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)$/.exec(value);
  return m ? { schema: m[1]!, table: m[2]! } : null;
}

export function emptyReason(filtered: boolean, contradictions: boolean): string {
  if (contradictions)
    return filtered
      ? 'Ninguna tabla con contradicciones coincide con los filtros.'
      : 'Ninguna tabla tiene contradicciones registradas entre sus fuentes.';
  return filtered
    ? 'Ninguna tabla coincide con los filtros elegidos.'
    : 'El catálogo de mutabilidad no tiene tablas: hay que regenerarlo desde el modelo.';
}
