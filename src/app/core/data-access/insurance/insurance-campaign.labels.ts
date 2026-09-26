import type {
  CampaignPartnerRole,
  CampaignPartnerType,
  CampaignStatus,
  CampaignType,
} from './insurance.types';

/* ============================================================================
   Rótulos de las campañas preventivas (Tarea 4 · M-06).

   La API manda códigos cerrados (`LABORATORY`, `ACTIVE`…), no textos: el
   castellano vive acá, en un solo lugar, para que la consola de la aseguradora
   y el panel del afiliado digan lo mismo.
   ========================================================================== */

export const CAMPAIGN_TYPES: readonly CampaignType[] = [
  'LABORATORY',
  'PHARMACY',
  'DIAGNOSTIC_IMAGING',
  'VACCINATION',
];

export const CAMPAIGN_STATUSES: readonly CampaignStatus[] = [
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'EXPIRED',
];

export const CAMPAIGN_PARTNER_ROLES: readonly CampaignPartnerRole[] = ['SPONSOR', 'PROVIDER'];

export const CAMPAIGN_PARTNER_TYPES: readonly CampaignPartnerType[] = [
  'IMPORTER',
  'MANUFACTURER',
  'LABORATORY',
  'PHARMACY',
  'MEDICAL_CENTER',
];

export const CAMPAIGN_TYPE_LABELS: Readonly<Record<CampaignType, string>> = {
  LABORATORY: 'Laboratorio',
  PHARMACY: 'Farmacia',
  DIAGNOSTIC_IMAGING: 'Diagnóstico por imagen',
  VACCINATION: 'Vacunación',
};

export const CAMPAIGN_STATUS_LABELS: Readonly<Record<CampaignStatus, string>> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activa',
  PAUSED: 'Pausada',
  EXPIRED: 'Finalizada',
};

/** Tonos del `Badge` compartido. El color nunca es lo único que distingue un estado: va con su texto. */
export const CAMPAIGN_STATUS_TONES: Readonly<
  Record<CampaignStatus, 'info' | 'success' | 'warning' | 'secondary'>
> = {
  DRAFT: 'info',
  ACTIVE: 'success',
  PAUSED: 'warning',
  EXPIRED: 'secondary',
};

export const CAMPAIGN_PARTNER_ROLE_LABELS: Readonly<Record<CampaignPartnerRole, string>> = {
  SPONSOR: 'Auspiciante',
  PROVIDER: 'Prestador',
};

export const CAMPAIGN_PARTNER_TYPE_LABELS: Readonly<Record<CampaignPartnerType, string>> = {
  IMPORTER: 'Importadora de medicamentos',
  MANUFACTURER: 'Fabricante de medicamentos',
  LABORATORY: 'Laboratorio',
  PHARMACY: 'Farmacia',
  MEDICAL_CENTER: 'Centro de diagnóstico',
};

/**
 * El sello de beneficio. `100` es el caso que el cliente espera ver —copago
 * Bs. 0— y por eso tiene su propia frase; el resto dice cuánto se bonifica.
 */
export function copayBonusLabel(percentage: number): string {
  if (percentage >= 100) {
    return '100% Cubierto por tu Seguro';
  }
  return `${formatPercentage(percentage)}% de bonificación en copago`;
}

function formatPercentage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, '');
}
