/* ============================================================================
    The guided tour bench's demonstration story (`recorrido-guiado.scenarios.ts`),
    typed with the same `core/data-access/` types the chart reads.
    ========================================================================== */

import type { Condition, Encounter, MedicationRequest } from '../../../core/data-access/clinical/clinical.types';
import type { DiagnosticOrder, DiagnosticReport } from '../../../core/data-access/diagnostics/diagnostics.types';
import type { Referral } from '../../../core/data-access/referrals/referrals.types';
import type { Booking } from '../../../core/data-access/scheduling/scheduling.types';
import type {
  LectorDelRecorrido,
  RegistrosDelRecorrido,
} from '../../clinical-record/patient-chart/recorrido-guiado/recorrido-guiado.model';

const dia = (mes: number, d: number, hora = 13): Date => new Date(Date.UTC(2026, mes - 1, d, hora));
const u = (n: number): string => `00000de3-0000-4000-a000-${String(n).padStart(12, '0')}`;

const ID = {
  e1: u(1),
  e2: u(2),
  e3: u(3),
  migrana: u(10),
  sinusitis: u(11),
  tac: u(20),
  informe: u(21),
  paracetamol: u(30),
  amoxicilina: u(31),
  claritromicina: u(32),
  cita1: u(40),
  cita2: u(41),
  cita3: u(42),
  derivacion: u(50),
} as const;

const NOMBRES: Record<string, string> = {
  'demo-migrana': 'Migraña',
  'demo-sinusitis': 'Sinusitis aguda',
  'demo-tac': 'Tomografía de cráneo',
  'demo-paracetamol': 'Paracetamol 500 mg',
  'demo-amoxicilina': 'Amoxicilina 500 mg',
  'demo-claritromicina': 'Claritromicina 500 mg',
};

const SERVICIOS: Record<string, string> = {
  [ID.e1]: 'Medicina general',
  [ID.e2]: 'Neurología',
  [ID.e3]: 'Otorrinolaringología',
};

export const LECTOR: LectorDelRecorrido = {
  etiqueta: (id) => (id === undefined ? undefined : NOMBRES[id]),
  servicioDeAtencion: (a) => SERVICIOS[a.id],
};

const atencion = (id: string, cuando: Date, motivo: string): Encounter => ({
  id,
  statusConceptId: 'demo-estado',
  startAt: cuando,
  reasonText: motivo,
});

const receta = (
  id: string,
  med: string,
  encounterId: string,
  cuando: Date,
  extra: Partial<MedicationRequest> & Record<string, unknown> = {},
): MedicationRequest => ({ id, medicationConceptId: med, statusConceptId: 'demo-estado', encounterId, createdAt: cuando, ...extra });

const cita = (id: string, cuando: Date, extra: Partial<Booking> = {}): Booking => ({
  id,
  statusConceptId: 'demo-estado',
  startAt: cuando,
  createdAt: dia(1, 1),
  ...extra,
});

const migrana: Condition = {
  id: ID.migrana,
  codeConceptId: 'demo-migrana',
  encounterId: ID.e1,
  createdAt: dia(2, 3),
  verification: {
    outcome: 'REFUTED',
    decidedAt: dia(2, 17, 15).toISOString(),
    decidedByProfileId: u(900),
    reasonText: 'La tomografía no muestra hallazgos compatibles.',
    basedOn: { kind: 'ANALYSIS', serviceRequestId: ID.tac, encounterId: ID.e2 },
  },
  replacedByConditionId: ID.sinusitis,
};

const sinusitis: Condition = {
  id: ID.sinusitis,
  codeConceptId: 'demo-sinusitis',
  encounterId: ID.e2,
  createdAt: dia(2, 17),
  verification: {
    outcome: 'CONFIRMED',
    decidedAt: dia(2, 17, 16).toISOString(),
    decidedByProfileId: u(900),
    reasonText: null,
    basedOn: null,
  },
};

const tac: DiagnosticOrder = {
  id: ID.tac,
  patientProfileId: u(800),
  encounterId: ID.e1,
  codeConceptId: 'demo-tac',
  statusConceptId: 'demo-estado',
  createdAt: dia(2, 3, 14),
  reasonConditionId: ID.migrana,
};

const informe: DiagnosticReport = {
  id: ID.informe,
  patientProfileId: u(800),
  serviceRequestId: ID.tac,
  codeConceptId: 'demo-tac',
  lifecycleStatusConceptId: 'demo-estado',
  currentReleasedVersionId: u(700),
  createdAt: dia(2, 10),
};

const derivacion: Referral = {
  id: ID.derivacion,
  patientProfileId: u(800),
  statusConceptId: 'demo-estado',
  status: 'ACCEPTED',
  createdAt: dia(2, 17),
  sourceEncounterId: ID.e2,
  targetDisplayName: 'Otorrinolaringología de Clínica Norte',
  diagnosisText: 'Sinusitis aguda que no cede',
  targetEncounterId: ID.e3,
};

export const HISTORIA_DE_DEMOSTRACION: RegistrosDelRecorrido = {
  atenciones: [
    atencion(ID.e1, dia(2, 3), 'Cefalea de dos semanas'),
    atencion(ID.e2, dia(2, 17), 'Control de cefalea'),
    atencion(ID.e3, dia(3, 2), 'Sinusitis que no cede'),
  ],
  diagnosticos: [migrana, sinusitis],
  ordenes: [tac],
  informes: [informe],
  recetas: [
    receta(ID.paracetamol, 'demo-paracetamol', ID.e1, dia(2, 3)),
    receta(ID.amoxicilina, 'demo-amoxicilina', ID.e2, dia(2, 17), {
      indicationConditionId: ID.sinusitis,
      doseText: '1 comprimido',
      frequencyText: 'cada 8 horas',
      replacedByRequestId: ID.claritromicina,
    }),
    receta(ID.claritromicina, 'demo-claritromicina', ID.e3, dia(3, 2), { indicationConditionId: ID.sinusitis }),
  ],
  citas: [
    cita(ID.cita1, dia(2, 3)),
    cita(ID.cita2, dia(2, 17), { followUpOf: { bookingId: ID.cita1, encounterId: ID.e1, startAt: dia(2, 3) } }),
    cita(ID.cita3, dia(3, 20), { followUpOf: { bookingId: ID.cita2, encounterId: ID.e2 } }),
  ],
  derivaciones: [derivacion],
};

/** El reloj de la demostración: la reconsulta del 20 mar queda en el futuro. */
export const AHORA = dia(3, 10);

/** Los registros de la red de mentira, en el orden en que se dibujan. */
export const NODOS: readonly { readonly id: string; readonly rotulo: string }[] = [
  { id: ID.e1, rotulo: 'Consulta · Medicina general' },
  { id: ID.migrana, rotulo: 'Migraña (presuntivo → descartado)' },
  { id: ID.tac, rotulo: 'Tomografía de cráneo' },
  { id: ID.informe, rotulo: 'Informe de la tomografía' },
  { id: ID.paracetamol, rotulo: 'Paracetamol 500 mg' },
  { id: ID.cita2, rotulo: 'Reconsulta del 17 feb' },
  { id: ID.e2, rotulo: 'Consulta · Neurología' },
  { id: ID.sinusitis, rotulo: 'Sinusitis aguda (confirmado)' },
  { id: ID.amoxicilina, rotulo: 'Amoxicilina 500 mg' },
  { id: ID.derivacion, rotulo: 'Derivación a Otorrinolaringología' },
  { id: ID.e3, rotulo: 'Consulta · Otorrinolaringología' },
  { id: ID.claritromicina, rotulo: 'Claritromicina 500 mg' },
  { id: ID.cita3, rotulo: 'Reconsulta del 20 mar' },
];

export const EPISODIO_SINUSITIS: readonly string[] = [
  ID.e2,
  ID.sinusitis,
  ID.amoxicilina,
  ID.derivacion,
  ID.e3,
  ID.claritromicina,
];
