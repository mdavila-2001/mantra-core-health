import type {
  Referral,
  ReferralTargetKind,
  ReferralTargetService,
  ReferralType,
} from '../../../../core/data-access/referrals/referrals.types';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import type { StatusSealVariant } from '../../../../shared/components/organisms/status-seal/status-seal.types';

/* ============================================================================
    Lo que el bloque de derivación dice en palabras. Separado del componente
    porque es traducción pura —código → rótulo, fila → renglón— y se prueba
    sin montar nada.
    ========================================================================== */

/**
 * «Tratamiento» primero y por defecto: es lo que el cliente pidió
 * literalmente («derivación de servicios específicos… tipo tratamiento»).
 */
export const DEFAULT_REFERRAL_TYPE: ReferralType = 'TREATMENT';

const REFERRAL_TYPE_LABELS: Readonly<Record<ReferralType, string>> = {
  TREATMENT: 'Tratamiento',
  CONSULTATION: 'Interconsulta',
  DIAGNOSTIC_STUDY: 'Estudio diagnóstico',
  PROCEDURE: 'Procedimiento',
  SECOND_OPINION: 'Segunda opinión',
};

export const REFERRAL_TYPE_OPTIONS: readonly SelectOption<ReferralType>[] = (
  Object.keys(REFERRAL_TYPE_LABELS) as ReferralType[]
).map((value) => ({ value, label: REFERRAL_TYPE_LABELS[value] }));

export const TARGET_KIND_OPTIONS: readonly SegmentedOption<ReferralTargetKind>[] = [
  { value: 'PRACTITIONER', label: 'Profesional', icon: 'stethoscope' },
  // Rótulo corto: a 390 px «Organización médica» se cortaba con puntos
  // suspensivos. El nombre accesible es el completo y contiene al visible.
  { value: 'ORGANIZATION', label: 'Organización', icon: 'hospital', description: 'Organización médica' },
];

/**
 * Los tres estados que siembra la API, por **código**: el rótulo del catálogo
 * puede venir en inglés si el concepto no tiene designación en castellano, y
 * el tono del sello no se deduce de un texto.
 */
const STATUS_BY_CODE: Readonly<
  Record<string, { readonly label: string; readonly variant: StatusSealVariant }>
> = {
  REF_REQUESTED: { label: 'Solicitada', variant: 'pending' },
  REF_ACCEPTED: { label: 'Aceptada', variant: 'approved' },
  REF_REJECTED: { label: 'Rechazada', variant: 'rejected' },
};

/** Una derivación ya resuelta para la lista. */
export interface ReferralRow {
  readonly id: string;
  readonly type: string;
  readonly target: string;
  readonly service: string | null;
  readonly status: string;
  readonly variant: StatusSealVariant;
  readonly createdAt: Date;
  readonly validUntil: Date | null;
  readonly reason: string | null;
}

export function toReferralRow(referral: Referral, labels: ConceptLabels): ReferralRow {
  const concept = labels.get(referral.statusConceptId);
  const known = concept === undefined ? undefined : STATUS_BY_CODE[concept.code];
  return {
    id: referral.id,
    type: referral.referralType === undefined ? 'Sin tipo' : REFERRAL_TYPE_LABELS[referral.referralType],
    target: referral.targetDisplayName ?? 'Destino sin nombre',
    service: referral.targetServiceName ?? null,
    // Un estado que esta versión no conoce no se inventa ni se oculta: se
    // dice con el rótulo del catálogo, en neutro.
    status: known?.label ?? concept?.display ?? 'Sin registrar',
    variant: known?.variant ?? 'unknown',
    createdAt: referral.createdAt,
    validUntil: referral.validUntil ?? null,
    reason: referral.reasonText ?? null,
  };
}

/** «Bs 250.00» o «USD 40», tal como llegó; sin arancel, se dice. */
export function formatPrice(service: ReferralTargetService): string {
  if (service.price === null || service.price === '') {
    return 'Sin arancel declarado';
  }
  const currency = service.currency === 'BOB' ? 'Bs' : service.currency;
  return currency === null ? String(service.price) : `${currency} ${service.price}`;
}

/** El servicio es opcional: la primera opción dice que se deriva sin uno. */
export function serviceOptions(
  services: readonly ReferralTargetService[],
): readonly SelectOption<string | null>[] {
  return [
    { value: null, label: 'Sin un servicio en particular' },
    ...services.map((s) => ({ value: s.id, label: `${s.name} · ${formatPrice(s)}` })),
  ];
}
