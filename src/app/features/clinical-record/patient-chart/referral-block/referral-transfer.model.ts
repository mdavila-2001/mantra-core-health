import {
  AMBULANCE_MODES,
  TRANSPORT_MODES,
  VITAL_RANGES,
  type ArrivalCondition,
  type DepartureCondition,
  type ReferralTransfer,
  type ReferralTransferInput,
  type ReferralVitals,
  type TransportMode,
  type VitalKey,
} from '../../../../core/data-access/referrals/referral-transfer.types';

/* ============================================================================
    El traslado de una derivación en palabras y en borrador: rótulos, el
    borrador del formulario (lo que tienen sus señales) y la ida y vuelta
    entre el borrador y el cuerpo de la API. Traducción pura: se prueba sin
    montar nada.
    ========================================================================== */

export const TRANSPORT_MODE_LABELS: Readonly<Record<TransportMode, string>> = {
  AMBULANCE_BASIC: 'Ambulancia básica',
  AMBULANCE_ADVANCED: 'Ambulancia avanzada (terapia intensiva móvil)',
  AIR_AMBULANCE: 'Ambulancia aérea',
  RIVER: 'Transporte fluvial',
  PRIVATE_VEHICLE: 'Vehículo particular',
  PUBLIC_TRANSPORT: 'Transporte público',
  ON_FOOT: 'Por sus propios medios, a pie',
  OTHER: 'Otro',
};

/** Las ambulancias primero, en su propio grupo: son las que pide un traslado inestable. */
export const AMBULANCE_MODE_LIST: readonly TransportMode[] = TRANSPORT_MODES.filter((m) => AMBULANCE_MODES.has(m));
export const OTHER_MODE_LIST: readonly TransportMode[] = TRANSPORT_MODES.filter((m) => !AMBULANCE_MODES.has(m));

export const CONDITION_LABELS: Readonly<Record<ArrivalCondition, string>> = {
  STABLE: 'Estable',
  UNSTABLE: 'Inestable',
  CRITICAL: 'Crítico',
  DECEASED: 'Fallecido',
};

export const DEPARTURE_CONDITION_LIST: readonly DepartureCondition[] = ['STABLE', 'UNSTABLE', 'CRITICAL'];
export const ARRIVAL_CONDITION_LIST: readonly ArrivalCondition[] = ['STABLE', 'UNSTABLE', 'CRITICAL', 'DECEASED'];

/** Un signo vital de la grilla: rótulo corto, unidad y teclado. */
export interface VitalField {
  readonly key: VitalKey;
  readonly label: string;
  readonly unit: string;
  readonly inputMode: 'numeric' | 'decimal';
  readonly range: string;
}

const vital = (key: VitalKey, label: string, unit: string): VitalField => {
  const r = VITAL_RANGES[key];
  return {
    key,
    label,
    unit,
    inputMode: r.decimals === 0 ? 'numeric' : 'decimal',
    range: `${r.min}–${r.max}`.replace('.', ','),
  };
};

export const VITAL_FIELDS: readonly VitalField[] = [
  vital('systolicBp', 'PA sistólica', 'mmHg'),
  vital('diastolicBp', 'PA diastólica', 'mmHg'),
  vital('heartRate', 'Frecuencia cardíaca', 'lpm'),
  vital('respiratoryRate', 'Frecuencia respiratoria', 'rpm'),
  vital('temperatureC', 'Temperatura', '°C'),
  vital('oxygenSaturation', 'Saturación de O₂', '%'),
  vital('glasgow', 'Glasgow', 'puntos'),
];

/** Lo cargado en el formulario del traslado, tal como lo tienen sus controles. */
export interface TransferDraft {
  readonly required: boolean;
  readonly transportMode: TransportMode | null;
  readonly transportDetail: string;
  readonly companionName: string;
  readonly companionRelationship: string;
  readonly companionPhone: string;
  readonly escortProfessionalName: string;
  readonly escortProfessionalRole: string;
  readonly departureCondition: DepartureCondition | null;
  /** Los signos como se escribieron: el número se lee al armar el cuerpo. */
  readonly vitals: Readonly<Record<VitalKey, string>>;
  readonly vitalsRecordedAt: Date | null;
  readonly receiverContacted: boolean;
  readonly receiverContactName: string;
  readonly receiverContactedAt: Date | null;
  readonly departedAt: Date | null;
}

const EMPTY_VITALS: Readonly<Record<VitalKey, string>> = {
  systolicBp: '',
  diastolicBp: '',
  heartRate: '',
  respiratoryRate: '',
  temperatureC: '',
  oxygenSaturation: '',
  glasgow: '',
};

export function emptyTransferDraft(): TransferDraft {
  return {
    required: false,
    transportMode: null,
    transportDetail: '',
    companionName: '',
    companionRelationship: '',
    companionPhone: '',
    escortProfessionalName: '',
    escortProfessionalRole: '',
    departureCondition: null,
    vitals: EMPTY_VITALS,
    vitalsRecordedAt: null,
    receiverContacted: false,
    receiverContactName: '',
    receiverContactedAt: null,
    departedAt: null,
  };
}

/** El traslado guardado como borrador, para completarlo o corregirlo. */
export function draftFromTransfer(transfer: ReferralTransfer | undefined): TransferDraft {
  const empty = emptyTransferDraft();
  if (transfer === undefined) return { ...empty, required: true };
  const v = transfer.vitals;
  const show = (n: number | undefined): string => (n === undefined ? '' : String(n).replace('.', ','));
  return {
    // Se abre para completar: si nunca se dijo, se asume que se traslada.
    required: transfer.required ?? true,
    transportMode: transfer.transportMode ?? null,
    transportDetail: transfer.transportDetail ?? '',
    companionName: transfer.companionName ?? '',
    companionRelationship: transfer.companionRelationship ?? '',
    companionPhone: transfer.companionPhone ?? '',
    escortProfessionalName: transfer.escortProfessionalName ?? '',
    escortProfessionalRole: transfer.escortProfessionalRole ?? '',
    departureCondition: transfer.departureCondition ?? null,
    vitals: {
      systolicBp: show(v?.systolicBp),
      diastolicBp: show(v?.diastolicBp),
      heartRate: show(v?.heartRate),
      respiratoryRate: show(v?.respiratoryRate),
      temperatureC: show(v?.temperatureC),
      oxygenSaturation: show(v?.oxygenSaturation),
      glasgow: show(v?.glasgow),
    },
    vitalsRecordedAt: v?.recordedAt ?? null,
    receiverContacted: transfer.receiverContacted ?? false,
    receiverContactName: transfer.receiverContactName ?? '',
    receiverContactedAt: transfer.receiverContactedAt ?? null,
    departedAt: transfer.departedAt ?? null,
  };
}

/**
 * Un signo escrito → número. Acepta la coma decimal; lo que no es un número
 * da `NaN`, para que la regla de rango lo marque en vez de omitirlo callado.
 */
export function parseVital(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return undefined;
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
}

/**
 * El cuerpo del traslado, ya recortado. Sin traslado físico sólo viaja
 * `required: false`: lo demás no aplica y la API no lo pide.
 */
export function transferFromDraft(d: TransferDraft): ReferralTransferInput {
  if (!d.required) return { required: false };
  const text = <K extends string>(key: K, value: string): Partial<Record<K, string>> =>
    value.trim() === '' ? {} : ({ [key]: value.trim() } as Record<K, string>);
  const vitals: { -readonly [K in keyof ReferralVitals]: ReferralVitals[K] } = {};
  for (const field of VITAL_FIELDS) {
    const n = parseVital(d.vitals[field.key]);
    if (n !== undefined) vitals[field.key] = n;
  }
  const hasVitals = Object.keys(vitals).length > 0;
  if (hasVitals && d.vitalsRecordedAt !== null) vitals.recordedAt = d.vitalsRecordedAt;
  return {
    required: true,
    ...(d.transportMode === null ? {} : { transportMode: d.transportMode }),
    ...text('transportDetail', d.transportDetail),
    ...text('companionName', d.companionName),
    ...text('companionRelationship', d.companionRelationship),
    ...text('companionPhone', d.companionPhone),
    ...text('escortProfessionalName', d.escortProfessionalName),
    ...text('escortProfessionalRole', d.escortProfessionalRole),
    ...(d.departureCondition === null ? {} : { departureCondition: d.departureCondition }),
    ...(hasVitals ? { vitals } : {}),
    receiverContacted: d.receiverContacted,
    ...(d.receiverContacted ? text('receiverContactName', d.receiverContactName) : {}),
    ...(d.receiverContacted && d.receiverContactedAt !== null ? { receiverContactedAt: d.receiverContactedAt } : {}),
    ...(d.departedAt === null ? {} : { departedAt: d.departedAt }),
  };
}

/** Un renglón del bloque de lectura del traslado. */
export interface TransferLine {
  readonly label: string;
  readonly value: string;
}

/** Los signos en una línea: «PA 120/80 mmHg · FC 88 lpm · …». */
export function vitalsLine(v: ReferralVitals | undefined): string | null {
  if (v === undefined) return null;
  const parts: string[] = [];
  if (v.systolicBp !== undefined || v.diastolicBp !== undefined) {
    parts.push(`PA ${v.systolicBp ?? '—'}/${v.diastolicBp ?? '—'} mmHg`);
  }
  const add = (abbr: string, value: number | undefined, unit: string): void => {
    if (value !== undefined) parts.push(`${abbr} ${String(value).replace('.', ',')}${unit}`);
  };
  add('FC', v.heartRate, ' lpm');
  add('FR', v.respiratoryRate, ' rpm');
  add('T', v.temperatureC, ' °C');
  add('SatO₂', v.oxygenSaturation, ' %');
  add('Glasgow', v.glasgow, '/15');
  return parts.length === 0 ? null : parts.join(' · ');
}

/** «Nombre (parentesco) · teléfono», sin los vacíos. */
export function joinParts(main: string | undefined, detail: string | undefined, extra?: string): string | null {
  if (main === undefined) return null;
  return [detail === undefined ? main : `${main} (${detail})`, extra].filter((p) => p !== undefined).join(' · ');
}
