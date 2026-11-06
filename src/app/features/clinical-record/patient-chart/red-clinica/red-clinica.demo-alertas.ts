/* ============================================================================
    The demonstration story's facts as they arrive from the API, for the
    alerts (the network's nodes are in `red-clinica.demo.ts`).
    ========================================================================== */

import type { Condition, Encounter } from '../../../../core/data-access/clinical/clinical.types';
import type {
  DiagnosticOrder,
  DiagnosticReport,
} from '../../../../core/data-access/diagnostics/diagnostics.types';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import type { EntradaDeAlertas, ResultadoParaAlertas } from './red-clinica-alertas.types';
import { AHORA_DEMO, d, NODOS_DEMO } from './red-clinica.demo';
import type { NodoDeRed } from './red-clinica.types';

const paciente = 'pid-paciente';

const CODIGOS: Readonly<Record<string, string>> = {
  'v-prov': 'COND_PROVISIONAL',
  'v-conf': 'COND_CONFIRMED',
  'v-ref': 'COND_REFUTED',
  'cs-act': 'COND_ACTIVE',
  'sr-activa': 'SR_ACTIVE',
};

const ETIQUETAS: Readonly<Record<string, string>> = {
  'cpt-cefalea': 'Cefalea tensional',
  'cpt-hta': 'Hipertensión arterial esencial',
  'cpt-hvi': 'Hipertrofia ventricular izquierda',
  'cpt-mapa': 'Monitoreo ambulatorio de presión (MAPA)',
  'cpt-lipidos': 'Perfil lipídico',
  'cpt-eco': 'Ecocardiograma transtorácico',
};

export const DIAGNOSTICOS_DEMO: readonly Condition[] = [
  {
    id: 'dx1',
    codeConceptId: 'cpt-cefalea',
    verificationStatusConceptId: 'v-ref',
    encounterId: 'a1',
    createdAt: d(8, 4),
    verification: {
      outcome: 'REFUTED',
      decidedAt: d(8, 25).toISOString(),
      decidedByProfileId: 'pro-rojas',
      reasonText: 'Hipertensión sostenida en MAPA.',
      basedOn: { kind: 'ANALYSIS', serviceRequestId: 'e1' },
    },
    replacedByConditionId: 'dx2',
  },
  {
    id: 'dx2',
    codeConceptId: 'cpt-hta',
    verificationStatusConceptId: 'v-conf',
    clinicalStatusConceptId: 'cs-act',
    encounterId: 'a1',
    createdAt: d(8, 4),
  },
  {
    id: 'dx3',
    codeConceptId: 'cpt-hvi',
    verificationStatusConceptId: 'v-prov',
    encounterId: 'a3',
    createdAt: d(9, 2, 11),
    verification: null,
  },
];

export const ORDENES_DEMO: readonly DiagnosticOrder[] = [
  { id: 'e1', patientProfileId: paciente, codeConceptId: 'cpt-mapa', statusConceptId: 'sr-activa', encounterId: 'a1', createdAt: d(8, 4), reasonConditionId: 'dx2' },
  { id: 'e2', patientProfileId: paciente, codeConceptId: 'cpt-lipidos', statusConceptId: 'sr-activa', encounterId: 'a1', createdAt: d(8, 4), reasonConditionId: 'dx2' },
  { id: 'e3', patientProfileId: paciente, codeConceptId: 'cpt-eco', statusConceptId: 'sr-activa', encounterId: 'a3', createdAt: d(9, 2, 11), reasonConditionId: 'dx2' },
];

export const INFORMES_DEMO: readonly DiagnosticReport[] = [
  { id: 'inf-1', patientProfileId: paciente, serviceRequestId: 'e1', codeConceptId: 'cpt-mapa', lifecycleStatusConceptId: 'x', currentVersionId: 'v1', currentReleasedVersionId: 'v1', createdAt: d(8, 20) },
  { id: 'inf-2', patientProfileId: paciente, serviceRequestId: 'e2', codeConceptId: 'cpt-lipidos', lifecycleStatusConceptId: 'x', currentVersionId: 'v1', currentReleasedVersionId: 'v1', createdAt: d(8, 8) },
];

export const DERIVACIONES_DEMO: readonly Referral[] = [
  {
    id: 'd1',
    patientProfileId: paciente,
    statusConceptId: 'x',
    status: 'ACCEPTED',
    createdAt: d(8, 25),
    sourceEncounterId: 'a2',
    targetDisplayName: 'Cardiología · Clínica Norte',
    respondedAt: d(8, 27),
    transfer: { arrivedAt: d(9, 2, 10) },
    targetEncounterId: 'a3',
  },
  {
    id: 'd2',
    patientProfileId: paciente,
    statusConceptId: 'x',
    status: 'PENDING',
    createdAt: d(10, 10),
    sourceEncounterId: 'a2',
    targetDisplayName: 'Centro de Nutrición Vida',
  },
];

export const ATENCIONES_DEMO: readonly Encounter[] = [
  { id: 'a1', statusConceptId: 'x', reasonText: 'Cefalea persistente', startAt: d(8, 4) },
  { id: 'a2', statusConceptId: 'x', reasonText: 'cefalea persistente.', startAt: d(8, 25) },
  { id: 'a3', statusConceptId: 'x', reasonText: 'Interconsulta por HTA', startAt: d(9, 2, 10) },
];

/** The network's released results, already in the alerts' format. */
export function resultadosDe(nodos: readonly NodoDeRed[]): readonly ResultadoParaAlertas[] {
  return nodos.flatMap((n) =>
    n.detalle?.tipo === 'estudio' && n.detalle.resultado !== null
      ? [{ nodoId: n.id, estudio: n.titulo, valores: n.detalle.resultado.valores }]
      : [],
  );
}

export const ENTRADA_DE_ALERTAS_DEMO: EntradaDeAlertas = {
  ahora: AHORA_DEMO,
  diagnosticos: DIAGNOSTICOS_DEMO,
  ordenes: ORDENES_DEMO,
  informes: INFORMES_DEMO,
  derivaciones: DERIVACIONES_DEMO,
  atenciones: ATENCIONES_DEMO,
  resultados: resultadosDe(NODOS_DEMO),
  codigoDe: (id) => (id === undefined ? undefined : CODIGOS[id]),
  etiquetaDe: (id) => (id === undefined ? undefined : ETIQUETAS[id]),
};
