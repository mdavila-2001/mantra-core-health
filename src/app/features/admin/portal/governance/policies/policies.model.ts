import type {
  PolicyAttributes,
  PolicyQuery,
  PolicySummary,
  PolicyType,
} from '../../../../../core/data-access/admin-portal/governance-policies.types';
import { POLICY_TYPES } from '../../../../../core/data-access/admin-portal/governance-policies.types';
import type { Hecho } from '../../../../../shared/components/molecules/fact-list/fact-list.types';
import type { Rotulo } from '../../../platform/platform-labels';
import { nonEmpty } from '../../support/route-query';

/* ============================================================================
    Políticas de gobierno de datos: rótulos y consulta.

    Traducen los códigos de `GET /admin/governance/policies` a texto. No deciden
    nada: lo que el servidor no declaró se escribe «sin declarar» y un código que
    no está acá se muestra tal cual con tono neutro.
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
  CLASSIFICATION: {
    label: 'Clasificación',
    hint: 'Niveles de sensibilidad y las reglas de manejo de cada uno',
  },
  RESIDENCY: {
    label: 'Residencia',
    hint: 'En qué regiones pueden vivir los datos y cuándo pueden salir',
  },
};

export const policyType = (code: string | null | undefined): Rotulo =>
  code && code in POLICY_TYPE_INFO
    ? { label: POLICY_TYPE_INFO[code as PolicyType].label, tone: 'info' }
    : { label: code ?? 'Sin tipo', tone: 'secondary' };

/** El estado tal como lo rotula la API; el tono sólo distingue lo vigente. */
export function policyState(policy: Pick<PolicySummary, 'stateCode' | 'stateLabel'>): Rotulo {
  if (!policy.stateCode && !policy.stateLabel) return { label: 'Sin estado', tone: 'secondary' };
  const label = policy.stateLabel ?? policy.stateCode ?? 'Sin estado';
  const code = (policy.stateCode ?? '').toUpperCase();
  if (code === 'ACTIVE' || code === 'EFFECTIVE') return { label, tone: 'success' };
  if (code === 'DRAFT' || code === 'PENDING') return { label, tone: 'warning' };
  if (code === 'RETIRED' || code === 'INACTIVE' || code === 'EXPIRED')
    return { label, tone: 'secondary' };
  return { label, tone: 'secondary' };
}

const yesNo = (value: unknown): string =>
  value === true ? 'Sí' : value === false ? 'No' : 'Sin declarar';
const text = (value: unknown, missing = 'Sin declarar'): string =>
  value === null || value === undefined || value === '' ? missing : String(value);

/** Lo que cada política controla, en una línea. Lo que nadie declaró se dice «sin declarar». */
export function policyControl(policy: Pick<PolicySummary, 'type' | 'attributes'>): string {
  const a: PolicyAttributes = policy.attributes;
  switch (policy.type) {
    case 'WRITE': {
      const flags = [
        a['requiresReason'] === true ? 'exige motivo' : null,
        a['requiresApproval'] === true ? 'exige aprobación' : null,
        a['dualControl'] === true ? 'doble control' : null,
      ].filter((f): f is string => f !== null);
      return `Alta: ${text(a['insertMode'])} · Cambio: ${text(a['updateMode'])} · Baja: ${text(a['deleteMode'])}${
        flags.length ? ` · ${flags.join(', ')}` : ''
      }`;
    }
    case 'RETENTION': {
      const days = a['retentionPeriodDays'];
      const period =
        typeof days === 'number' ? `${days.toLocaleString('es-BO')} días` : 'Sin plazo declarado';
      return `${period} · al vencer: ${text(a['disposition'])}`;
    }
    case 'ANONYMIZATION':
      return `Técnica: ${text(a['technique'])}`;
    case 'CLASSIFICATION':
      return `Datos personales: ${yesNo(a['isPii'])} · Datos de salud: ${yesNo(a['isPhi'])}`;
    case 'RESIDENCY':
      return `Jurisdicción: ${text(a['jurisdiction'])} · Transferencia: ${text(a['transferBasis'], 'sin base declarada')}`;
    default:
      return 'Sin descripción';
  }
}

const ATTRIBUTE_LABELS: Readonly<Record<string, string>> = {
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
  rank: 'Nivel (orden)',
  isPii: 'Datos personales',
  isPhi: 'Datos de salud',
  dataClassification: 'Clasificación de los datos',
  transferBasis: 'Base de transferencia',
  transferImpactAssessmentRequired: 'Exige evaluación de impacto',
  encryptionKeyRegionLocked: 'Clave de cifrado fija a la región',
  validFrom: 'Vigente desde',
  validTo: 'Vigente hasta',
};

function attributeValue(key: string, value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (value === null || value === undefined || value === '') return 'Sin declarar';
  if ((key === 'validFrom' || key === 'validTo') && typeof value === 'string') {
    return new Date(value).toLocaleDateString('es-BO', { dateStyle: 'medium' });
  }
  if (typeof value === 'number') return value.toLocaleString('es-BO');
  return String(value);
}

/** Los atributos del tipo como lista de datos de una ficha, en el orden que la API los mandó. */
export function policyFacts(policy: Pick<PolicySummary, 'attributes'>): readonly Hecho[] {
  return Object.entries(policy.attributes).map(([key, value]) => ({
    etiqueta: ATTRIBUTE_LABELS[key] ?? key,
    valor: attributeValue(key, value),
  }));
}

/** Qué son los destinos de una política, escrito en plural. */
export const APPLIES_TO_LABELS = {
  ENTITY: 'Tablas',
  FIELD: 'Campos',
  TENANT_BINDING: 'Vínculos con organizaciones',
} as const;

export function hasPolicyFilters(values: PolicyUrlValues): boolean {
  return values.q !== '' || values.type !== '';
}

/** La consulta a la API: sólo los filtros con valor y un tipo que la API acepte. */
export function policyQuery(values: PolicyUrlValues): PolicyQuery {
  const known = (POLICY_TYPES as readonly string[]).includes(values.type);
  return nonEmpty({ q: values.q, type: known ? values.type : '' }) as PolicyQuery;
}

/** Pretty-print de la configuración; un texto plano se deja como está. */
export function configurationText(configuration: unknown): string | null {
  if (configuration === null || configuration === undefined) return null;
  return typeof configuration === 'string' ? configuration : JSON.stringify(configuration, null, 2);
}
