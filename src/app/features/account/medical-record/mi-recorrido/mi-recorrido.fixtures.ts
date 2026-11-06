import type {
  ClinicalSummary,
  Condition,
  Encounter,
  MedicationRequest,
} from '../../../../core/data-access/clinical/clinical.types';
import type { PatientOrder } from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { Booking } from '../../../../core/data-access/scheduling/scheduling.types';
import type { FuentesDelPortal } from './registro-con-vinculos';

/* Una historia chica y completa, compartida por las pruebas del recorrido:
   cefalea → se pensó en migraña (descartada, reemplazada por cefalea
   tensional, confirmada con una resonancia), con receta, control realizado,
   y una consulta suelta de vacunación con un estudio sin vínculo. */

/** Mediodía UTC: ningún huso horario corre el día. */
export const dia = (iso: string): Date => new Date(`${iso}T12:00:00Z`);

export const ETIQUETAS: Readonly<Record<string, { display: string; code: string }>> = {
  'dx-migrana': { display: 'Migraña', code: 'G43' },
  'dx-tensional': { display: 'Cefalea tensional', code: 'G44.2' },
  'dx-gastritis': { display: 'Gastritis', code: 'K29' },
  confirmado: { display: 'Confirmado', code: 'COND_CONFIRMED' },
  descartado: { display: 'Descartado', code: 'COND_REFUTED' },
  presuntivo: { display: 'Presuntivo', code: 'COND_PROVISIONAL' },
  activa: { display: 'Activa', code: 'COND_ACTIVE' },
  rm: { display: 'Resonancia de cráneo', code: 'RM' },
  hemograma: { display: 'Hemograma', code: 'HEM' },
  ibuprofeno: { display: 'Ibuprofeno 400 mg', code: 'IBU' },
  emitida: { display: 'Emitida', code: 'RX_ISSUED' },
  'sr-completa': { display: 'Completada', code: 'SR_DONE' },
  'bk-completed': { display: 'Atendida', code: 'BK-COMPLETED' },
  'bk-confirmed': { display: 'Confirmada', code: 'BOOKING_CONFIRMED' },
};

export const etiqueta = (id: string | undefined): string =>
  id === undefined ? 'Sin registrar' : (ETIQUETAS[id]?.display ?? 'Sin registrar');
export const codigo = (id: string | undefined): string | undefined =>
  id === undefined ? undefined : ETIQUETAS[id]?.code;

export const ENCUENTROS: readonly Encounter[] = [
  { id: 'e1', statusConceptId: 'x', reasonText: 'Dolor de cabeza', startAt: dia('2026-02-03'), endAt: dia('2026-02-03') },
  { id: 'e2', statusConceptId: 'x', reasonText: 'Control de cefalea', startAt: dia('2026-03-10'), endAt: dia('2026-03-10') },
  { id: 'e3', statusConceptId: 'x', reasonText: 'Vacunación', startAt: dia('2026-04-01'), endAt: dia('2026-04-01') },
];

export const DIAGNOSTICOS: readonly Condition[] = [
  {
    id: 'c-migrana',
    codeConceptId: 'dx-migrana',
    verificationStatusConceptId: 'descartado',
    encounterId: 'e1',
    createdAt: dia('2026-02-03'),
    verification: {
      outcome: 'REFUTED',
      decidedAt: dia('2026-02-20').toISOString(),
      decidedByProfileId: 'doc',
      reasonText: 'La resonancia salió normal.',
      basedOn: null,
    },
    // Vínculo nuevo de franja 1, todavía no declarado en el tipo.
    ...({ replacedByConditionId: 'c-tensional' } as object),
  } as Condition,
  {
    id: 'c-tensional',
    codeConceptId: 'dx-tensional',
    verificationStatusConceptId: 'confirmado',
    clinicalStatusConceptId: 'activa',
    encounterId: 'e1',
    createdAt: dia('2026-02-03'),
    verification: {
      outcome: 'CONFIRMED',
      decidedAt: dia('2026-02-20').toISOString(),
      decidedByProfileId: 'doc',
      reasonText: null,
      basedOn: { kind: 'ANALYSIS', serviceRequestId: 'sr-rm' },
    },
  },
];

export const RECETAS: readonly MedicationRequest[] = [
  {
    id: 'rx-1',
    medicationConceptId: 'ibuprofeno',
    statusConceptId: 'emitida',
    encounterId: 'e2',
    indicationConditionId: 'c-tensional',
    doseText: '1 comprimido',
    frequencyText: 'cada 8 horas',
    issuedAt: dia('2026-03-10'),
    createdAt: dia('2026-03-10'),
  },
];

const orden = (extra: Partial<PatientOrder> & Pick<PatientOrder, 'id'>): PatientOrder =>
  ({
    codeConceptId: 'rm',
    statusConceptId: 'sr-completa',
    createdAt: dia('2026-02-03'),
    hasReleasedResult: false,
    ...extra,
  }) as PatientOrder;

export const ORDENES: readonly PatientOrder[] = [
  orden({
    id: 'sr-rm',
    encounterId: 'e1',
    hasReleasedResult: true,
    reportId: 'rep-1',
    ...({ reasonConditionId: 'c-migrana' } as object),
  }),
  orden({ id: 'sr-hem', encounterId: 'e3', codeConceptId: 'hemograma', createdAt: dia('2026-04-01') }),
];

export const CITAS: readonly Booking[] = [
  {
    id: 'bk-control',
    statusConceptId: 'bk-completed',
    startAt: dia('2026-03-10'),
    followUpOf: { bookingId: 'bk-origen', encounterId: 'e1' },
  } as Booking,
  // Una cita sin origen no es un control: no entra al recorrido.
  { id: 'bk-suelta', statusConceptId: 'bk-confirmed', startAt: dia('2026-05-01') } as Booking,
];

export function resumen(extra: Partial<ClinicalSummary> = {}): ClinicalSummary {
  return {
    patientProfileId: 'pid-paciente',
    conditions: DIAGNOSTICOS,
    allergies: [],
    medicationRequests: RECETAS,
    observations: [],
    encounters: ENCUENTROS,
    careEpisodes: [],
    limit: 50,
    truncated: [],
    ...extra,
  };
}

export function fuentes(extra: Partial<FuentesDelPortal> = {}): FuentesDelPortal {
  return { resumen: resumen(), ordenes: ORDENES, citas: CITAS, ...extra };
}

export const AHORA = dia('2026-06-01');
