import type {
  QualityIssueStatus,
  QualitySeverity,
} from '../../../../core/data-access/admin-portal/data-quality.types';
import { QUALITY_SEVERITIES } from '../../../../core/data-access/admin-portal/data-quality.types';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import type { Rotulo } from '../../platform/platform-labels';

/* ============================================================================
    Rótulos de la calidad de datos. Traducen los códigos de la API a texto y
    tono; no deciden nada. Un código que la API no pudo reconocer llega como
    `null` y se dice así, sin adivinar. El color nunca va solo: todo rótulo trae
    su texto.
    ========================================================================== */

const SEVERITY: Readonly<Record<QualitySeverity, Rotulo>> = {
  FATAL: { label: 'Fatal', tone: 'error' },
  ERROR: { label: 'Error', tone: 'error' },
  WARNING: { label: 'Aviso', tone: 'warning' },
  INFORMATION: { label: 'Informativa', tone: 'info' },
};

const STATUS: Readonly<Record<QualityIssueStatus, Rotulo>> = {
  OPEN: { label: 'Abierta', tone: 'primary' },
  RESOLVED: { label: 'Resuelta', tone: 'success' },
  DISMISSED: { label: 'Descartada', tone: 'secondary' },
};

export function severityLabel(code: QualitySeverity | null): Rotulo {
  return code ? SEVERITY[code] : { label: 'Severidad no reconocida', tone: 'secondary' };
}

export function issueStatusLabel(code: QualityIssueStatus | null): Rotulo {
  return code ? STATUS[code] : { label: 'Estado no reconocido', tone: 'secondary' };
}

export const SEVERITY_OPTIONS: readonly SelectOption<string>[] = [
  { value: '', label: 'Cualquier severidad' },
  ...QUALITY_SEVERITIES.map((code) => ({ value: code, label: SEVERITY[code].label })),
];

/** Texto de un concepto que la API devuelve como `{ code, display }`; ambos pueden faltar. */
export function conceptText(concept: { readonly code: string | null; readonly display: string | null }): string {
  return concept.display ?? concept.code ?? 'Sin dato';
}

/** «1.200» o «Sin dato»: un `null` es que la corrida no lo informó, no que valga cero. */
export function countText(value: number | null): string {
  return value === null ? 'No informado' : value.toLocaleString('es-BO');
}
