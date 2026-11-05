import { HttpErrorResponse } from '@angular/common/http';

import type {
  ExplainAccessResponse,
  SimulateAccessResponse,
} from '../../../core/data-access/access-governance/access-explain.types';
import type {
  SupportCatalog,
  SupportEngagement,
} from '../../../core/data-access/support-access/support-access.types';

/* Datos de prueba compartidos por las specs del simulador y de las pantallas de autoservicio (no entran al bundle). */

export const VINCULO_MARCOS: SupportEngagement = {
  id: 'eng-marcos',
  tenantId: 't-hospital',
  organizationName: 'Hospital Piloto Mantra',
  ownerKind: 'ORGANIZATION',
  userId: 'u-marcos',
  personName: 'Marcos Ribera',
  roleTemplate: 'FRONT_DESK',
  status: 'ACTIVE',
  origin: 'REQUEST',
  recertifyEveryMonths: 12,
  grants: [],
};

export const VINCULO_ANA: SupportEngagement = {
  ...VINCULO_MARCOS,
  id: 'eng-ana',
  userId: 'u-ana',
  personName: 'Ana Gutiérrez',
  roleTemplate: 'SECRETARY',
};

export const CATALOGO: SupportCatalog = {
  organizationName: 'Hospital Piloto Mantra',
  doctors: [
    { id: 'doc-suarez', name: 'Dr. Martín Suárez', specialty: 'Pediatría', placements: [] },
    { id: 'doc-perez', name: 'Dr. Andrés Pérez', specialty: 'Cardiología', placements: [] },
  ],
  services: [{ id: 'svc-eco', name: 'Ecografía' }],
  locations: [
    {
      id: 'loc-n102',
      kind: 'CONSULTING_ROOM',
      name: 'Consultorio N102',
      parentId: null,
      path: '/n102/',
    },
  ],
};

/** El caso del piloto (§5.2): Marcos cancela con 6 horas y su permiso exige 24. */
export const EXPLICACION_MARCOS: ExplainAccessResponse = {
  decision: {
    effect: 'CHALLENGE',
    allowed: false,
    reason: 'APPROVAL_REQUIRED',
    atom: 'agenda.appointment.cancel',
    grantId: 'g-1',
  },
  summary:
    'Marcos Ribera no puede cancelar esta cita por sí solo: faltan 6 horas y su permiso exige 24. Puede hacerlo si el Dr. Suárez lo aprueba.',
  decidedBy: {
    layer: 'CONDITION',
    step: 7,
    grantId: 'g-1',
    atom: 'agenda.appointment.cancel',
    conditionPath: 'actionConditions.agenda.appointment.cancel.appointment.leadTime',
  },
  reasons: [
    {
      order: 1,
      layer: 'ENGAGEMENT',
      passed: true,
      code: 'ENGAGEMENT_ACTIVE',
      message: 'El vínculo de Marcos está vigente y recertificado.',
    },
    {
      order: 2,
      layer: 'ENGAGEMENT',
      passed: true,
      code: 'DOCTOR_ACCEPTED',
      message: 'El Dr. Suárez aceptó a Marcos (14 de octubre).',
    },
    {
      order: 3,
      layer: 'GUARDRAIL',
      passed: true,
      code: 'DELEGABLE',
      message: 'Cancelar citas se puede dar al personal de apoyo.',
    },
    {
      order: 4,
      layer: 'ORG_RULE',
      passed: true,
      code: 'NO_ORG_RULE_DENY',
      message: 'Ninguna regla de la organización lo prohíbe.',
    },
    {
      order: 5,
      layer: 'EXPLICIT_DENY',
      passed: true,
      code: 'NO_EXPLICIT_DENY',
      message: 'No hay una prohibición expresa para Marcos en esta agenda.',
    },
    {
      order: 6,
      layer: 'GRANT_COVERAGE',
      passed: true,
      code: 'COVERED',
      message: 'El permiso «Dr. Suárez en Sede Norte» cubre esta cita (consultorio N102).',
      grantId: 'g-1',
    },
    {
      order: 7,
      layer: 'CONDITION',
      passed: false,
      code: 'LEAD_TIME',
      message:
        'Faltan 6 horas para la cita; el permiso pide al menos 24 horas de anticipación y, si no, la aprobación del doctor.',
      grantId: 'g-1',
      atom: 'agenda.appointment.cancel',
      conditionPath: 'actionConditions.agenda.appointment.cancel.appointment.leadTime',
      details: { minHours: 24, hoursLeft: 6, onViolation: 'REQUIRE_APPROVAL' },
    },
    {
      order: 8,
      layer: 'CONDITION',
      passed: true,
      code: 'LIMIT_OK',
      message: 'Cancelaciones de hoy: 3 de 20.',
      details: { used: 3, max: 20, per: 'DAY', resetsAt: '2026-11-04T00:00:00-04:00' },
    },
  ],
  missing: [
    {
      kind: 'APPROVAL',
      by: 'DOCTOR',
      message: 'Pida la aprobación del Dr. Suárez (queda vigente 60 minutos).',
      fix: { type: 'REQUEST_APPROVAL', approverKind: 'DOCTOR' },
    },
    {
      kind: 'REASON',
      message: 'Escriba el motivo de la cancelación (al menos 10 caracteres).',
      fix: { type: 'PROVIDE_REASON', minLength: 10 },
    },
  ],
  adminFixes: [
    {
      type: 'RELAX_CONDITION',
      grantId: 'g-1',
      conditionPath: 'actionConditions.agenda.appointment.cancel.appointment.leadTime',
      message: 'Bajar la anticipación mínima o quitarla.',
    },
  ],
  obligations: {
    reason: { minLength: 10 },
    stepUp: null,
    approval: { by: 'DOCTOR', ttlMinutes: 60 },
  },
  visibleFields: { 'agenda.appointment.view.patient_name': 'FULL' },
  usage: [
    {
      key: 'ACTIONS/DAY/agenda.appointment.cancel',
      used: 3,
      max: 20,
      resetsAt: '2026-11-04T00:00:00-04:00',
    },
  ],
  evaluatedAt: '2026-11-03T10:30:00-04:00',
  correlationId: '2f3d2a5e-3c41-4f7b-9d2e-1c1b7e6a9f10',
};

/** La misma pregunta con la aprobación supuesta: pasa. */
export const EXPLICACION_MARCOS_APROBADA: ExplainAccessResponse = {
  ...EXPLICACION_MARCOS,
  decision: {
    effect: 'PERMIT',
    allowed: true,
    reason: 'ALLOWED',
    atom: 'agenda.appointment.cancel',
    grantId: 'g-1',
  },
  summary: 'Marcos Ribera puede cancelar esta cita: el Dr. Suárez la aprobó.',
  reasons: EXPLICACION_MARCOS.reasons.map((r) =>
    r.order === 7 ? { ...r, passed: true, message: 'Aprobada por el Dr. Suárez.' } : r,
  ),
  missing: [],
};

/** Ana fuera de horario: negación por condición, sin nada que ella pueda hacer. */
export const EXPLICACION_ANA_FUERA_DE_HORARIO: ExplainAccessResponse = {
  decision: {
    effect: 'DENY',
    allowed: false,
    reason: 'TIME_WINDOW',
    atom: 'agenda.appointment.create',
    unmet: ['time'],
  },
  summary: 'Ana Gutiérrez solo puede hacerlo dentro de su horario.',
  decidedBy: { layer: 'CONDITION', step: 7 },
  reasons: [
    {
      order: 1,
      layer: 'ENGAGEMENT',
      passed: true,
      code: 'ENGAGEMENT_ACTIVE',
      message: 'El vínculo está vigente.',
    },
    {
      order: 7,
      layer: 'CONDITION',
      passed: false,
      code: 'TIME_WINDOW',
      message: 'Está fuera del horario que el permiso autoriza.',
    },
  ],
  missing: [],
  adminFixes: [{ type: 'RELAX_CONDITION', message: 'Ampliar el horario del permiso.' }],
  obligations: { reason: null, stepUp: null, approval: null },
  visibleFields: {},
  evaluatedAt: '2026-11-03T22:00:00-04:00',
};

export const SIMULACION_CON_CAMBIOS: SimulateAccessResponse = {
  valid: true,
  validation: {
    errors: [],
    warnings: [
      {
        code: 'SOD_WARN',
        path: 'grants[0]',
        message:
          'Cancelar citas y cobrar en la misma persona: conflicto de funciones (advertencia).',
      },
    ],
  },
  governance: {
    sodFindings: [
      {
        ruleCode: 'SOD-BILL-03',
        action: 'WARN',
        atoms: ['agenda.appointment.cancel', 'billing.payment.collect'],
        message: 'Cancelar y cobrar en la misma persona.',
      },
    ],
    needsFourEyes: {
      required: true,
      reasons: ['El cambio sube el puntaje de privilegios más de 10 puntos.'],
    },
    privilegeScore: { before: 41, after: 56, delta: 15 },
  },
  summary: {
    plain: ['Marcos podrá, de lunes a viernes de 08:00 a 18:00: cobrar la atención.'],
    changes: ['Ahora podrá cobrar la atención.'],
  },
  scenarios: [
    {
      label: 'Cobrar un sábado',
      change: 'SAME',
      before: { effect: 'DENY', allowed: false, reason: 'ACTION_NOT_GRANTED' },
      after: { effect: 'DENY', allowed: false, reason: 'TIME_WINDOW' },
    },
    {
      label: 'Cobrar el lunes',
      change: 'NEWLY_ALLOWED',
      before: { effect: 'DENY', allowed: false, reason: 'ACTION_NOT_GRANTED' },
      after: { effect: 'PERMIT', allowed: true, reason: 'ALLOWED' },
    },
    {
      label: 'Cancelar con 6 horas',
      change: 'NEWLY_DENIED',
      before: { effect: 'PERMIT', allowed: true, reason: 'ALLOWED' },
      after: { effect: 'DENY', allowed: false, reason: 'LEAD_TIME' },
    },
  ],
  impact: {
    newlyAllowed: 1,
    newlyDenied: 1,
    unchanged: 1,
    challengesNew: 0,
    doctorsCovered: { before: 1, after: 1 },
    servicesCovered: { before: 0, after: 0 },
    spacesCovered: { before: 2, after: 2 },
    effectiveAtoms: { added: ['billing.payment.collect'], removed: [] },
  },
  simulationToken: 'sim_abc',
  limits: { scenarioCount: 3, truncated: false },
  evaluatedAt: '2026-11-03T10:30:00-04:00',
};

export const SIMULACION_CON_ERRORES: SimulateAccessResponse = {
  ...SIMULACION_CON_CAMBIOS,
  valid: false,
  validation: {
    errors: [
      {
        code: 'GUARDRAIL_CEILING_EXCEEDED',
        path: 'grants[0].actions[0]',
        message: 'Cobrar no cabe en el techo de la plantilla «Recepción» de esta organización.',
      },
    ],
    warnings: [],
  },
  simulationToken: undefined as never,
};

/** Un fallo de la API con la forma del contrato (`reason` arriba y en `details`). */
export const falloDeApi = (
  status: number,
  code: string,
  reason?: string,
  message = 'x',
): HttpErrorResponse =>
  new HttpErrorResponse({
    status,
    error: {
      statusCode: status,
      code,
      message,
      ...(reason === undefined ? {} : { reason, details: { reason } }),
      correlationId: 'req-123',
      timestamp: '',
      path: '/x',
    },
  });

/* ---- ayudas de DOM para las specs ---------------------------------------------------------------- */

export type Settle = () => Promise<void>;

/** Abre un `app-select` por su `data-testid` y elige la opción cuyo texto contiene `texto`. */
export async function elegir(
  host: HTMLElement,
  testId: string,
  texto: string,
  settle: Settle,
): Promise<void> {
  const trigger = host.querySelector<HTMLElement>(`[data-testid="${testId}"] .select-trigger`);
  if (trigger === null) throw new Error(`No hay un select con data-testid="${testId}"`);
  trigger.click();
  await settle();
  const fila = Array.from(host.querySelectorAll<HTMLElement>('[role="option"]')).find((f) =>
    (f.textContent ?? '').includes(texto),
  );
  if (fila === undefined) throw new Error(`El select «${testId}» no tiene la opción «${texto}»`);
  fila.click();
  await settle();
}

/** Escribe en un campo por `data-testid` (en el `<input>` o en un contenedor que lo tenga adentro). */
export async function escribir(
  host: HTMLElement,
  testId: string,
  valor: string,
  settle: Settle,
): Promise<void> {
  const el = host.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (el === null) throw new Error(`No hay un campo con data-testid="${testId}"`);
  const campo = (
    el.matches('input,textarea') ? el : el.querySelector('input,textarea')
  ) as HTMLInputElement;
  campo.value = valor;
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  await settle();
}

export async function pulsar(host: HTMLElement, testId: string, settle: Settle): Promise<void> {
  const el = host.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (el === null) throw new Error(`No hay nada con data-testid="${testId}"`);
  el.click();
  await settle();
}
