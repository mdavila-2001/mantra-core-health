import type { ReferralTransferInput } from '../../../../core/data-access/referrals/referral-transfer.types';
import type {
  NewReferral,
  Referral,
  ReferralStatus,
  ReferralTarget,
  ReferralTargetKind,
  ReferralTargetService,
  ReferralType,
} from '../../../../core/data-access/referrals/referrals.types';
import { REFERRAL_TYPES_WITH_CONSENT } from '../../../../core/data-access/referrals/referrals.types';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import type { StatusSealVariant } from '../../../../shared/components/organisms/status-seal/status-seal.types';
import { writeFailureMessage } from '../../write-message';

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
  THERAPY: 'Terapia',
  HOSPITALIZATION: 'Internación',
  OTHER: 'Otro',
};

/** El rótulo del tipo, o «Sin tipo» en las filas anteriores al campo. */
export function referralTypeLabel(type: ReferralType | undefined): string {
  return type === undefined ? 'Sin tipo' : REFERRAL_TYPE_LABELS[type];
}

/**
 * El título de una fila: «Tipo · destino». Una fila anterior al tipo dice sólo
 * el destino: «Sin tipo» como título se leía como un dato que falta cargar.
 */
export function referralHeading(type: ReferralType | undefined, target: string): string {
  return type === undefined ? target : `${REFERRAL_TYPE_LABELS[type]} · ${target}`;
}

/** Ejemplo del servicio pedido según el tipo: es el placeholder del campo. */
export const SERVICE_EXAMPLE: Readonly<Record<ReferralType, string>> = {
  TREATMENT: 'Ej.: Hemodiálisis tres veces por semana',
  CONSULTATION: 'Ej.: Interconsulta con endocrinología',
  DIAGNOSTIC_STUDY: 'Ej.: Perfil lipídico y HbA1c',
  PROCEDURE: 'Ej.: Colonoscopia diagnóstica',
  SECOND_OPINION: 'Ej.: Segunda opinión sobre la indicación quirúrgica',
  THERAPY: 'Ej.: Fisioterapia de rodilla, 10 sesiones',
  HOSPITALIZATION: 'Ej.: Internación en medicina interna para compensación',
  OTHER: 'Ej.: Valoración nutricional',
};

export const REFERRAL_TYPE_OPTIONS: readonly SelectOption<ReferralType>[] = (
  Object.keys(REFERRAL_TYPE_LABELS) as ReferralType[]
).map((value) => ({ value, label: REFERRAL_TYPE_LABELS[value] }));

/**
 * A qué clase de destino se deriva: las dos de la API (`/referrals/targets`)
 * y el destino **fuera** de la plataforma, que no se busca: se escribe.
 */
export type ReferralDestinationKind = ReferralTargetKind | 'EXTERNAL';

export const TARGET_KIND_OPTIONS: readonly SegmentedOption<ReferralDestinationKind>[] = [
  { value: 'PRACTITIONER', label: 'Profesional', icon: 'stethoscope' },
  // Rótulo corto: a 390 px «Organización médica» se cortaba con puntos
  // suspensivos. El nombre accesible es el completo y contiene al visible.
  { value: 'ORGANIZATION', label: 'Organización', icon: 'hospital', description: 'Organización médica' },
  { value: 'EXTERNAL', label: 'Externo', icon: 'globe', description: 'Destino fuera de la plataforma' },
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
  REF_COMPLETED: { label: 'Con contrarreferencia', variant: 'approved' },
  REF_CANCELLED: { label: 'Anulada', variant: 'expired' },
};

/**
 * El estado legible de la API (`ReferralResponseDto.status`, v4266). Manda
 * sobre el concepto cuando viene: no depende de que el catálogo esté.
 */
const STATUS_BY_API: Readonly<
  Record<ReferralStatus, { readonly label: string; readonly variant: StatusSealVariant }>
> = {
  PENDING: STATUS_BY_CODE['REF_REQUESTED']!,
  ACCEPTED: STATUS_BY_CODE['REF_ACCEPTED']!,
  REJECTED: STATUS_BY_CODE['REF_REJECTED']!,
  COMPLETED: STATUS_BY_CODE['REF_COMPLETED']!,
  CANCELLED: STATUS_BY_CODE['REF_CANCELLED']!,
};

/** El estado de una derivación en palabras, sin catálogo: el de la API o «Registrada». */
export function referralStatusOf(referral: Referral): { readonly label: string; readonly variant: StatusSealVariant } {
  return referral.status === undefined
    ? { label: 'Registrada', variant: 'unknown' }
    : STATUS_BY_API[referral.status];
}

/**
 * El destino en una línea, con lo que la API resolvió. Nunca un uuid: si el
 * nombre no vino, se dice qué clase de destino es.
 */
export function destinationOf(referral: Referral): string {
  if (referral.targetExternalName !== undefined) {
    return `${referral.targetExternalName} (externo)`;
  }
  const organization = referral.targetTenantName ?? referral.targetDisplayName;
  if (referral.targetBranchName !== undefined) {
    return `${organization ?? 'Organización de la plataforma'} · ${referral.targetBranchName}`;
  }
  return referral.targetDisplayName ?? organization ?? 'Destino sin nombre';
}

/** Si la vigencia ya pasó, mirado al día (no al instante). */
export function isExpired(referral: Referral, today: Date = new Date()): boolean {
  if (referral.validUntil === undefined) return false;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return referral.validUntil < startOfToday;
}

/** Una derivación ya resuelta para la lista. */
export interface ReferralRow {
  readonly id: string;
  /** «Tipo · destino», o sólo el destino en una fila anterior al tipo. */
  readonly heading: string;
  readonly target: string;
  readonly service: string | null;
  readonly status: string;
  readonly variant: StatusSealVariant;
  readonly createdAt: Date;
  readonly validUntil: Date | null;
  readonly reason: string | null;
  /** Si el tipo ofrece el consentimiento dirigido y la derivación sigue viva. */
  readonly offersConsent: boolean;
  /** Lo que dice la API: hay un consentimiento ACEPTADO vinculado. */
  readonly consentLinked: boolean;
}

export function toReferralRow(referral: Referral, labels: ConceptLabels): ReferralRow {
  const concept = labels.get(referral.statusConceptId);
  const known =
    referral.status === undefined
      ? concept === undefined
        ? undefined
        : STATUS_BY_CODE[concept.code]
      : STATUS_BY_API[referral.status];
  const target = destinationOf(referral);
  return {
    id: referral.id,
    heading: referralHeading(referral.referralType, target),
    target,
    service: referral.targetServiceName ?? referral.requestedServiceText ?? null,
    // Un estado que esta versión no conoce no se inventa ni se oculta: se
    // dice con el rótulo del catálogo, en neutro.
    status: known?.label ?? concept?.display ?? 'Sin registrar',
    variant: known?.variant ?? 'unknown',
    createdAt: referral.createdAt,
    validUntil: referral.validUntil ?? null,
    reason: referral.reasonText ?? null,
    offersConsent: offersConsent(referral),
    consentLinked: referral.informedConsentId !== undefined,
  };
}

/** Si la derivación ofrece el consentimiento dirigido: por tipo, y viva. */
export function offersConsent(referral: Referral): boolean {
  return (
    referral.referralType !== undefined &&
    REFERRAL_TYPES_WITH_CONSENT.has(referral.referralType) &&
    referral.status !== 'REJECTED' &&
    referral.status !== 'CANCELLED'
  );
}

/**
 * «Bs 250.00» o «USD 40.00». La API manda el arancel siempre como número y un
 * `0` cuando nadie lo declaró (`Number(defaultPrice ?? 0)`): eso se dice con
 * palabras, no como «gratis».
 */
export function formatPrice(service: ReferralTargetService): string {
  if (service.price === 0) {
    return 'Sin arancel declarado';
  }
  const amount = service.price.toFixed(2);
  const currency = service.currency === 'BOB' ? 'Bs' : service.currency;
  return currency === null ? amount : `${currency} ${amount}`;
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

/** Lo cargado en el formulario de derivación, tal como lo tienen sus señales. */
export interface ReferralFormValues {
  readonly patientProfileId: string;
  readonly sourceEncounterId: string;
  readonly kind: ReferralDestinationKind;
  readonly target: ReferralTarget | null;
  readonly branchId: string | null;
  readonly serviceId: string | null;
  readonly referralType: ReferralType | null;
  readonly externalName: string | number | null;
  readonly externalContact: string | number | null;
  readonly requestedService: string;
  readonly clinicalSummary: string;
  readonly diagnosis: string;
  readonly treatmentGiven: string;
  readonly reason: string;
  readonly validUntil: Date | null;
  /** El traslado, si el paciente se traslada; `null` lo omite. */
  readonly transfer?: ReferralTransferInput | null;
}

/**
 * El cuerpo de `POST /referrals`, ya recortado. Los opcionales sin elegir se
 * **omiten**: el backend valida con `forbidNonWhitelisted`. El destino externo
 * no lleva servicio del catálogo; la sede sólo va con una organización.
 */
export function buildNewReferral(v: ReferralFormValues): NewReferral {
  const text = (value: string | number | null): string => String(value ?? '').trim();
  const optional = <K extends string>(key: K, value: string): Partial<Record<K, string>> =>
    value === '' ? {} : ({ [key]: value } as Record<K, string>);
  const target =
    v.kind === 'EXTERNAL'
      ? {
          ...optional('targetExternalName', text(v.externalName)),
          ...optional('targetExternalContact', text(v.externalContact)),
        }
      : v.target === null
        ? {}
        : v.target.kind === 'PRACTITIONER'
          ? { targetProfileId: v.target.id }
          : { targetTenantId: v.target.id, ...(v.branchId === null ? {} : { targetBranchId: v.branchId }) };
  return {
    patientProfileId: v.patientProfileId,
    sourceEncounterId: v.sourceEncounterId,
    ...target,
    ...(v.kind === 'EXTERNAL' || v.serviceId === null ? {} : { targetServiceCatalogId: v.serviceId }),
    ...(v.referralType === null ? {} : { referralType: v.referralType }),
    ...optional('requestedServiceText', text(v.requestedService)),
    ...optional('clinicalSummary', text(v.clinicalSummary)),
    ...optional('diagnosisText', text(v.diagnosis)),
    ...optional('treatmentGivenText', text(v.treatmentGiven)),
    ...optional('reasonText', v.reason.trim()),
    ...(v.validUntil === null ? {} : { validUntil: v.validUntil }),
    ...(v.transfer === null || v.transfer === undefined ? {} : { transfer: v.transfer }),
  };
}

/**
 * Un 404 sin sub-código conocido: no se culpa a una sola pieza, porque la API
 * responde igual por el encuentro, el destino o el servicio.
 */
export const GENERIC_NOT_FOUND =
  'El encuentro, el destino o el servicio ya no están disponibles. Vuelva a buscar el destino.';

/** Lo que se dice tras un envío fallido y, aparte, el código de soporte (S9). */
export interface SubmissionFailure {
  readonly text: string;
  /** El identificador de petición de S9, para pintarlo entero; `null` si no es S9. */
  readonly code: string | null;
}

/**
 * Lo que se dice tras un envío fallido, o `null` si no falló. Manda el
 * sub-código de la API ya en palabras (400, 404, 422); sin él, la validación
 * tal cual, y para el resto el texto de escritura de siempre. El código de
 * soporte sale del **estado** (`requestId` de S9), no de leer el texto.
 */
export function submissionMessage(state: ViewState<null>, serverReason: string | null): SubmissionFailure | null {
  if (state.status === 'ready' || state.status === 'loading') return null;
  if (serverReason !== null) return { text: serverReason, code: null };
  if (state.status === 'validation') {
    const text = state.issues.map((issue) => issue.message).join(' ');
    return text === '' ? null : { text, code: null };
  }
  if (state.status === 'error') {
    // `writeFailureMessage` le agrega «(requestId)» al final: acá va aparte.
    return { text: state.message || 'Ocurrió un error inesperado.', code: state.requestId };
  }
  const text = writeFailureMessage(state, {
    accion: 'derivar',
    sinPermiso: 'Sólo puede derivar a quien atiende desde su propia organización.',
    yaNoExiste: GENERIC_NOT_FOUND,
  });
  return text === null ? null : { text, code: null };
}

/**
 * Dónde ve la persona el motivo. El aviso a un profesional lo lleva (si sale:
 * la API no lo garantiza); el de una organización no, y a un externo no hay
 * aviso.
 */
export function reasonHintFor(kind: ReferralDestinationKind): string {
  switch (kind) {
    case 'PRACTITIONER':
      return 'Opcional. Puede aparecer en el aviso a la persona.';
    case 'ORGANIZATION':
      return 'Opcional. La persona lo ve en su lista de derivaciones.';
    default:
      return 'Opcional. Queda en el registro; entréguele la derivación a la persona.';
  }
}

/**
 * Qué decir cuando falta el servicio pedido, según el contexto: un externo no
 * tiene catálogo; un destino sin servicios publicados, tampoco; con catálogo,
 * se puede elegir de la lista o escribirlo.
 */
export function requestedServiceMessage(kind: ReferralDestinationKind, withoutCatalog: boolean): string {
  if (kind === 'EXTERNAL') {
    return 'Escriba qué se le pide al destino externo, por ejemplo «Hemodiálisis tres veces por semana».';
  }
  if (withoutCatalog) {
    return 'Este destino no publica servicios: escriba qué se le pide, por ejemplo «Fisioterapia de rodilla, 10 sesiones».';
  }
  return 'Elija un servicio de la lista del destino o escriba qué se le pide.';
}

/** El orden de los campos en la pestaña «Traslado», para que el resumen lo siga. */
const TRANSFER_FIELD_ORDER: readonly string[] = [
  'departureCondition',
  'transportMode',
  'transportDetail',
  'escortProfessionalName',
  'escortProfessionalRole',
  'companionName',
  'companionRelationship',
  'companionPhone',
  'systolicBp',
  'diastolicBp',
  'heartRate',
  'respiratoryRate',
  'temperatureC',
  'oxygenSaturation',
  'glasgow',
  'receiverContacted',
  'receiverContactName',
];

/** Los problemas del traslado en el orden del formulario (estable para el mismo campo). */
export function inFormOrder<T extends { readonly field: string }>(issues: readonly T[]): readonly T[] {
  const rank = (field: string): number => {
    const i = TRANSFER_FIELD_ORDER.indexOf(field);
    return i === -1 ? TRANSFER_FIELD_ORDER.length : i;
  };
  return [...issues].sort((a, b) => rank(a.field) - rank(b.field));
}

/**
 * Por qué «Derivar» está apagado, para decirlo junto al botón (y anunciarlo
 * con `aria-describedby`), o `null` si se puede enviar o si envía ahora.
 */
export function submitBlocker(kind: ReferralDestinationKind, hasTarget: boolean, reasonTooLong: boolean): string | null {
  if (!hasTarget) {
    return kind === 'EXTERNAL'
      ? 'Para registrarla, escriba el nombre del destino.'
      : 'Para derivar, elija el destino.';
  }
  return reasonTooLong ? 'El motivo es demasiado largo: acórtelo para derivar.' : null;
}

/** Los rótulos de las dos pestañas; tras intentar derivar, cuál está lista y a cuál le falta algo. */
export function referralTabLabels(attempted: boolean, referralOk: boolean, transferOk: boolean): readonly string[] {
  const mark = (ok: boolean): string => (attempted ? (ok ? ' · lista' : ' · falta') : '');
  return [`1 · Derivación${mark(referralOk)}`, `2 · Traslado${mark(transferOk)}`];
}

/** Una derivación recién emitida, para el aviso de éxito: a quién y de qué clase. */
export interface IssuedReferral {
  readonly name: string;
  readonly kind: ReferralDestinationKind;
}
