import * as wire from '../wire';
import {
  ARRIVAL_CONDITIONS,
  DEPARTURE_CONDITIONS,
  TRANSPORT_MODES,
  type ArrivalCondition,
  type DepartureCondition,
  type ReferralArrivalInput,
  type ReferralTransfer,
  type ReferralTransferInput,
  type ReferralVitals,
  type TransportMode,
} from './referral-transfer.types';

/* ============================================================================
    El traslado en la frontera: fechas a ISO al mandar, `null` y textos a
    fechas al leer. Aparte de `referrals.client.ts` por tamaño.
    ========================================================================== */

const TEXT_AND_FLAG_KEYS = [
  'required',
  'transportMode',
  'transportDetail',
  'companionName',
  'companionRelationship',
  'companionPhone',
  'escortProfessionalName',
  'escortProfessionalRole',
  'departureCondition',
  'receiverContacted',
  'receiverContactName',
] as const;

const VITAL_KEYS = [
  'systolicBp',
  'diastolicBp',
  'heartRate',
  'respiratoryRate',
  'temperatureC',
  'oxygenSaturation',
  'glasgow',
] as const;

/**
 * Lo que viaja: las fechas en ISO.
 *
 * En el alta los opcionales vacíos se **omiten**. Al corregir
 * (`PATCH …/transfer`, `clear: true`) viajan en `null`: la API fusiona con lo
 * guardado —omitido conserva, `null` borra—, y un campo que se vació en el
 * formulario tiene que borrarse, no quedar como estaba.
 */
export function transferToWire(input: ReferralTransferInput, clear = false): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const put = (key: string, value: unknown): void => {
    const v = typeof value === 'string' ? value.trim() : value;
    if (v !== undefined && v !== '') body[key] = v;
    else if (clear) body[key] = null;
  };
  for (const key of TEXT_AND_FLAG_KEYS) put(key, input[key]);
  put('receiverContactedAt', input.receiverContactedAt?.toISOString());
  put('departedAt', input.departedAt?.toISOString());
  const vitals = input.vitals;
  const anyVital = vitals !== undefined && VITAL_KEYS.some((k) => vitals[k] !== undefined);
  if (anyVital) {
    const wireVitals: Record<string, unknown> = {};
    for (const key of VITAL_KEYS) {
      if (vitals[key] !== undefined) wireVitals[key] = vitals[key];
      else if (clear) wireVitals[key] = null;
    }
    if (vitals.recordedAt !== undefined) wireVitals['recordedAt'] = vitals.recordedAt.toISOString();
    else if (clear) wireVitals['recordedAt'] = null;
    body['vitals'] = wireVitals;
  } else if (clear) {
    body['vitals'] = null;
  }
  return body;
}

/** Cuerpo de `PATCH /referrals/:id/arrival`. */
export function arrivalToWire(input: ReferralArrivalInput): Record<string, unknown> {
  const notes = input.arrivalNotes?.trim();
  return {
    arrivedAt: input.arrivedAt.toISOString(),
    arrivalCondition: input.arrivalCondition,
    ...(notes === undefined || notes === '' ? {} : { arrivalNotes: notes }),
  };
}

type WireRecord = Readonly<Record<string, unknown>> | null | undefined;

/**
 * `ReferralResponseDto.transfer` → la vista. `null`, ausente o sin ningún
 * dato da `undefined`: la derivación no tiene traslado registrado.
 * Un código que esta versión no conoce no se inventa: queda sin valor.
 */
export function transferFromWire(raw: unknown): ReferralTransfer | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Readonly<Record<string, unknown>>;
  const text = (key: string): string | undefined => {
    const v = r[key];
    return typeof v === 'string' && v.trim() !== '' ? v : undefined;
  };
  const date = (value: unknown): Date | undefined => wire.maybeDate(typeof value === 'string' ? value : null);
  const vitals = vitalsFromWire(r['vitals'] as WireRecord);
  const transfer: ReferralTransfer = {
    ...(typeof r['required'] === 'boolean' ? { required: r['required'] } : {}),
    ...pick('transportMode', oneOf(TRANSPORT_MODES, r['transportMode']) as TransportMode | undefined),
    ...pick('transportDetail', text('transportDetail')),
    ...pick('companionName', text('companionName')),
    ...pick('companionRelationship', text('companionRelationship')),
    ...pick('companionPhone', text('companionPhone')),
    ...pick('escortProfessionalName', text('escortProfessionalName')),
    ...pick('escortProfessionalRole', text('escortProfessionalRole')),
    ...pick(
      'departureCondition',
      oneOf(DEPARTURE_CONDITIONS, r['departureCondition']) as DepartureCondition | undefined,
    ),
    ...pick('vitals', vitals),
    ...(typeof r['receiverContacted'] === 'boolean' ? { receiverContacted: r['receiverContacted'] } : {}),
    ...pick('receiverContactName', text('receiverContactName')),
    ...pick('receiverContactedAt', date(r['receiverContactedAt'])),
    ...pick('departedAt', date(r['departedAt'])),
    ...pick('arrivedAt', date(r['arrivedAt'])),
    ...pick('arrivalCondition', oneOf(ARRIVAL_CONDITIONS, r['arrivalCondition']) as ArrivalCondition | undefined),
    ...pick('arrivalNotes', text('arrivalNotes')),
  };
  return Object.keys(transfer).length === 0 ? undefined : transfer;
}

function vitalsFromWire(raw: WireRecord): ReferralVitals | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const num = (key: string): number | undefined => {
    const v = raw[key];
    // `numeric(4,1)` de Postgres puede viajar como texto.
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
    return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
  };
  const recorded = wire.maybeDate(typeof raw['recordedAt'] === 'string' ? raw['recordedAt'] : null);
  const vitals: ReferralVitals = {
    ...pick('recordedAt', recorded),
    ...pick('systolicBp', num('systolicBp')),
    ...pick('diastolicBp', num('diastolicBp')),
    ...pick('heartRate', num('heartRate')),
    ...pick('respiratoryRate', num('respiratoryRate')),
    ...pick('temperatureC', num('temperatureC')),
    ...pick('oxygenSaturation', num('oxygenSaturation')),
    ...pick('glasgow', num('glasgow')),
  };
  return Object.keys(vitals).length === 0 ? undefined : vitals;
}

function pick<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

function oneOf(values: readonly string[], value: unknown): string | undefined {
  return typeof value === 'string' && values.includes(value) ? value : undefined;
}
