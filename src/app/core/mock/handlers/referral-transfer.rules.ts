import { reply, type MockReply } from '../mock-router';

/* ============================================================================
    Traslado de una derivación (API v4274) en el simulador: las mismas reglas
    que `assertTransferRules` de `clinical_ext/services/referral-transfer.ts`,
    en el mismo orden, con el mismo `reason` y `details.fields`.

    El traslado se guarda anidado tal como viaja (`transfer`), y la fusión
    sigue la de la API: `undefined` conserva, `null` borra, otro valor
    reemplaza.
    ========================================================================== */

export interface SimulatedVitals {
  readonly recordedAt?: string | null;
  readonly systolicBp?: number | null;
  readonly diastolicBp?: number | null;
  readonly heartRate?: number | null;
  readonly respiratoryRate?: number | null;
  readonly temperatureC?: number | null;
  readonly oxygenSaturation?: number | null;
  readonly glasgow?: number | null;
}

export interface SimulatedTransfer {
  readonly required?: boolean | null;
  readonly transportMode?: string | null;
  readonly transportDetail?: string | null;
  readonly companionName?: string | null;
  readonly companionRelationship?: string | null;
  readonly companionPhone?: string | null;
  readonly escortProfessionalName?: string | null;
  readonly escortProfessionalRole?: string | null;
  readonly departureCondition?: string | null;
  readonly vitals?: SimulatedVitals | null;
  readonly receiverContacted?: boolean | null;
  readonly receiverContactName?: string | null;
  readonly receiverContactedAt?: string | null;
  readonly departedAt?: string | null;
  readonly arrivedAt?: string | null;
  readonly arrivalCondition?: string | null;
  readonly arrivalNotes?: string | null;
}

const TRANSPORT_MODES = [
  'AMBULANCE_BASIC',
  'AMBULANCE_ADVANCED',
  'AIR_AMBULANCE',
  'RIVER',
  'PRIVATE_VEHICLE',
  'PUBLIC_TRANSPORT',
  'ON_FOOT',
  'OTHER',
];
const AMBULANCES = new Set(['AMBULANCE_BASIC', 'AMBULANCE_ADVANCED', 'AIR_AMBULANCE']);
const DEPARTURE = ['STABLE', 'UNSTABLE', 'CRITICAL'];
export const ARRIVAL_CONDITIONS = ['STABLE', 'UNSTABLE', 'CRITICAL', 'DECEASED'];

const RANGES: Readonly<Record<string, readonly [number, number]>> = {
  systolicBp: [40, 300],
  diastolicBp: [20, 200],
  heartRate: [20, 300],
  respiratoryRate: [4, 80],
  temperatureC: [30, 45],
  oxygenSaturation: [50, 100],
  glasgow: [3, 15],
};

export const transferInvalid = (reason: string, message: string, fields: readonly string[]): MockReply =>
  reply(400, { statusCode: 400, code: 'VALIDATION_FAILED', reason, message, details: { fields } });

const has = (v: unknown): boolean => typeof v === 'string' && v.trim() !== '';

/** La fusión de la API: `undefined` conserva, `null` borra. */
export function mergeTransfer(stored: SimulatedTransfer | null | undefined, incoming: SimulatedTransfer): SimulatedTransfer {
  const base: Record<string, unknown> = { ...(stored ?? {}) };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || key === 'vitals') continue;
    base[key] = value;
  }
  if (incoming.vitals === null) base['vitals'] = null;
  else if (incoming.vitals !== undefined) {
    const vitals: Record<string, unknown> = { ...(stored?.vitals ?? {}) };
    for (const [key, value] of Object.entries(incoming.vitals)) {
      if (value !== undefined) vitals[key] = value;
    }
    base['vitals'] = vitals;
  }
  return base as SimulatedTransfer;
}

/**
 * El primer problema del traslado efectivo, como lo devuelve la API, o `null`.
 * Antes, la forma: los enumerados conocidos y los signos enteros (el
 * `ValidationPipe` los rechaza con 400 genérico).
 */
export function transferProblem(t: SimulatedTransfer): MockReply | null {
  if (t.transportMode != null && !TRANSPORT_MODES.includes(t.transportMode)) {
    return transferInvalid('VALIDATION_PIPE_REJECTED', 'transportMode inválido', ['transfer.transportMode']);
  }
  if (t.departureCondition != null && !DEPARTURE.includes(t.departureCondition)) {
    return transferInvalid('VALIDATION_PIPE_REJECTED', 'departureCondition inválido', ['transfer.departureCondition']);
  }
  if (t.required === true) {
    const missing = (['transportMode', 'departureCondition'] as const).filter((f) => !has(t[f]));
    if (missing.length > 0) {
      return transferInvalid(
        'TRANSFER_INCOMPLETE',
        'Un traslado necesita el medio de transporte y el estado del paciente al salir',
        missing.map((f) => `transfer.${f}`),
      );
    }
  }
  if (t.transportMode === 'OTHER' && !has(t.transportDetail)) {
    return transferInvalid('TRANSFER_DETAIL_REQUIRED', 'Con el medio «otro» hace falta el detalle del transporte', [
      'transfer.transportDetail',
    ]);
  }
  const v = t.vitals ?? {};
  const out = Object.keys(RANGES).filter((key) => {
    const value = (v as Record<string, unknown>)[key];
    if (value === null || value === undefined) return false;
    const [min, max] = RANGES[key]!;
    return typeof value !== 'number' || value < min || value > max;
  });
  if (v.systolicBp != null && v.diastolicBp != null && v.diastolicBp >= v.systolicBp && !out.includes('diastolicBp')) {
    out.push('diastolicBp');
  }
  if (out.length > 0) {
    return transferInvalid(
      'TRANSFER_VITALS_OUT_OF_RANGE',
      'Hay signos vitales fuera de rango, o la diastólica no es menor que la sistólica',
      out.map((key) => `transfer.vitals.${key}`),
    );
  }
  const unsafe = t.departureCondition === 'UNSTABLE' || t.departureCondition === 'CRITICAL';
  if (unsafe) {
    const fields: string[] = [];
    if (t.transportMode == null || !AMBULANCES.has(t.transportMode)) fields.push('transfer.transportMode');
    if (!has(t.escortProfessionalName)) fields.push('transfer.escortProfessionalName');
    if (fields.length > 0) {
      return transferInvalid(
        'TRANSFER_UNSAFE_TRANSPORT',
        'Un paciente inestable o crítico se traslada en ambulancia y con personal de salud',
        fields,
      );
    }
  }
  // La API no mira la prioridad: el módulo no tiene un concepto de prioridad
  // urgente para derivaciones. El aviso lo exige el estado.
  if (unsafe) {
    const fields: string[] = [];
    if (t.receiverContacted !== true) fields.push('transfer.receiverContacted');
    if (!has(t.receiverContactName)) fields.push('transfer.receiverContactName');
    if (fields.length > 0) {
      return transferInvalid(
        'TRANSFER_RECEIVER_NOT_CONTACTED',
        'Con el paciente inestable o crítico hay que avisar antes al receptor',
        fields,
      );
    }
  }
  return null;
}
