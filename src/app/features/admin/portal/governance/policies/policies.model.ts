import type {
  PolicyAppliedToItem,
  PolicyDetail,
  PolicyQuery,
  PolicySettings,
  PolicySummary,
  PolicyType,
} from '../../../../../core/data-access/admin-portal/governance-policies.types';
import { POLICY_TYPES } from '../../../../../core/data-access/admin-portal/governance-policies.types';
import { fecha } from '../../../../../shared/components/organisms/data-table/sin-cortes';
import type { Hecho } from '../../../../../shared/components/molecules/fact-list/fact-list.types';
import type { Rotulo } from '../../../platform/platform-labels';
import { nonEmpty } from '../../support/route-query';

/* ============================================================================
    Políticas de gobierno de datos: rótulos y consulta.

    Traducen los códigos de `GET /admin/governance/policies` a texto. No deciden
    nada: lo que el servidor no declaró se escribe «sin declarar», y un código de
    concepto que no está acá se muestra tal cual, con tono neutro. La API manda
    CÓDIGOS (`ALLOWED`, `ARCHIVE`…): esta capa no los traduce a frases que nadie
    verificó contra el catálogo de conceptos.
    ========================================================================== */

export const POLICY_URL_KEYS = ['q', 'type'] as const;
export type PolicyUrlValues = Readonly<Record<(typeof POLICY_URL_KEYS)[number], string>>;

/** Qué clase de política es y qué controla, en palabras. */
export const POLICY_TYPE_INFO: Readonly<Record<PolicyType, { label: string; hint: string }>> = {
  WRITE: {
    label: 'Escritura',
    hint: 'Qué se puede agregar, cambiar o borrar, y con qué aprobación',
  },
  RETENTION: { label: 'Retención', hint: 'Cuánto se conserva un dato y qué pasa al vencer' },
  ANONYMIZATION: {
    label: 'Anonimización',
    hint: 'Cómo se oculta un campo para que no identifique a nadie',
  },
  RESIDENCY: {
    label: 'Residencia',
    hint: 'En qué regiones pueden vivir los datos y cuándo pueden salir',
  },
};

export const isPolicyType = (code: string | null | undefined): code is PolicyType =>
  code !== null && code !== undefined && (POLICY_TYPES as readonly string[]).includes(code);

export const policyType = (code: string | null | undefined): Rotulo =>
  isPolicyType(code)
    ? { label: POLICY_TYPE_INFO[code].label, tone: 'info' }
    : { label: code ?? 'Sin tipo', tone: 'secondary' };

const STATE_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: 'Activa',
  DRAFT: 'Borrador',
  PENDING: 'Pendiente',
  INACTIVE: 'Inactiva',
  RETIRED: 'Retirada',
  EXPIRED: 'Vencida',
};

/** El estado tal como lo manda la API (un código); el tono sólo distingue lo vigente. */
export function policyState(state: string | null | undefined): Rotulo {
  if (!state) return { label: 'Sin estado', tone: 'secondary' };
  const code = state.toUpperCase();
  const label = STATE_LABELS[code] ?? state;
  if (code === 'ACTIVE') return { label, tone: 'success' };
  if (code === 'DRAFT' || code === 'PENDING') return { label, tone: 'warning' };
  return { label, tone: 'secondary' };
}

const text = (value: unknown, missing = 'Sin declarar'): string =>
  value === null || value === undefined || value === '' ? missing : String(value);

/** Lo que cada política controla, en una línea. Lo que nadie declaró se dice «sin declarar». */
export function policyControl(type: PolicyType, settings: PolicySettings): string {
  switch (type) {
    case 'WRITE': {
      const flags = [
        settings['requiresReason'] === true ? 'exige motivo' : null,
        settings['requiresApproval'] === true ? 'exige aprobación' : null,
        settings['dualControl'] === true ? 'doble control' : null,
      ].filter((f): f is string => f !== null);
      return `Alta: ${text(settings['insertMode'])} · Cambio: ${text(settings['updateMode'])} · Baja: ${text(settings['deleteMode'])}${
        flags.length ? ` · ${flags.join(', ')}` : ''
      }`;
    }
    case 'RETENTION': {
      const days = settings['retentionPeriodDays'];
      const period =
        typeof days === 'number' ? `${days.toLocaleString('es-BO')} días` : 'Sin plazo declarado';
      return `${period} · al vencer: ${text(settings['disposition'])}`;
    }
    case 'ANONYMIZATION':
      return `Técnica: ${text(settings['technique'])}`;
    case 'RESIDENCY':
      return `Jurisdicción: ${text(settings['jurisdiction'])} · Transferencia: ${text(settings['crossBorderTransferBasis'], 'sin base declarada')}`;
  }
}

const SETTING_LABELS: Readonly<Record<string, string>> = {
  insertMode: 'Alta',
  updateMode: 'Cambio',
  deleteMode: 'Baja',
  requiresReason: 'Exige motivo',
  requiresApproval: 'Exige aprobación',
  dualControl: 'Doble control',
  maxBatchSize: 'Máximo por lote',
  retentionPeriodDays: 'Plazo (días)',
  legalBasis: 'Base legal',
  disposition: 'Al vencer',
  jurisdiction: 'Jurisdicción',
  technique: 'Técnica',
  description: 'Descripción',
  parameterKeys: 'Parámetros (sólo sus nombres)',
  dataClassification: 'Clasificación de los datos',
  crossBorderTransferBasis: 'Base de transferencia',
  transferImpactAssessmentRequired: 'Exige evaluación de impacto',
  encryptionKeyRegionLocked: 'Clave de cifrado fija a la región',
  validFrom: 'Vigente desde',
  validTo: 'Vigente hasta',
};

function settingValue(key: string, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (value === null || value === undefined || value === '') return 'Sin declarar';
  if (Array.isArray(value)) return value.length === 0 ? 'Ninguno' : value.join(', ');
  if ((key === 'validFrom' || key === 'validTo') && typeof value === 'string') {
    return fecha(value);
  }
  if (typeof value === 'number') return value.toLocaleString('es-BO');
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** Los ajustes del tipo como lista de datos de una ficha, en el orden que la API los mandó. */
export function policyFacts(settings: PolicySettings): readonly Hecho[] {
  return Object.entries(settings).map(([key, value]) => ({
    etiqueta: SETTING_LABELS[key] ?? key,
    valor: settingValue(key, value),
  }));
}

/** El rótulo de una acción de la bitácora; un código desconocido se muestra tal cual. */
export function changeAction(code: string): string {
  return code === 'UNKNOWN' ? 'Acción no registrada' : code;
}

/** Qué son los destinos de una política: columnas si alguno trae columna, tablas si no. */
export function appliedKind(items: readonly PolicyAppliedToItem[]): 'Columnas' | 'Tablas' {
  return items.some((i) => i.columnName !== null) ? 'Columnas' : 'Tablas';
}

export const appliedName = (item: PolicyAppliedToItem): string =>
  item.columnName === null
    ? `${item.schemaName}.${item.tableName}`
    : `${item.schemaName}.${item.tableName}.${item.columnName}`;

/**
 * Desde cuándo pedir la bitácora de una política: la API sin `from` sólo mira 30 días, así que la
 * ficha pide desde un día antes de su alta. Sin fecha de alta, la API decide (y la ficha lo dice).
 */
export function historyFrom(policy: Pick<PolicyDetail, 'createdAt'>): string | null {
  const created = policy.createdAt;
  if (!created) return null;
  return new Date(created.getTime() - 24 * 60 * 60 * 1000).toISOString();
}

/** La consulta a la API: sólo los filtros con valor y un tipo que la API acepte. */
export function policyQuery(values: PolicyUrlValues): PolicyQuery {
  return nonEmpty({
    q: values.q,
    type: isPolicyType(values.type) ? values.type : '',
  }) as PolicyQuery;
}

/** La fila es la cabecera de la lista; los ajustes se piden a la ficha. */
export const policyRowName = (row: Pick<PolicySummary, 'policyType' | 'code'>): string =>
  `${policyType(row.policyType).label} ${row.code}`;

/** ¿Hay filtros que la API recibe? Un tipo inventado en la URL se descarta y no cuenta. */
export function hasPolicyFilters(values: PolicyUrlValues): boolean {
  return Object.keys(policyQuery(values)).length > 0;
}
