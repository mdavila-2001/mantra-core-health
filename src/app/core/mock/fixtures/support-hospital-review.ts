import { SUPPORT_TEMPLATE_DEFAULT_ACTIONS, type SupportRoleTemplateCode, type SupportScopeTarget } from '../../data-access/support-access/support-access.types';
import { TENANT_HOSPITAL_PILOTO } from '../mock-session';
import { iso, uuid } from '../mock-store';
import type { FilaBitacora, FilaPermiso, FilaSolicitud, FilaVinculo } from './support-hospital.types';

/* ============================================================================
    Lo que el **Hospital Piloto Mantra** necesita para mostrar la revisión
    periódica, la bandeja de solicitudes con sus filtros y la bitácora con
    historia: personas con el vínculo por vencer, vencido y suspendido; solicitudes
    de todas las edades y estados; y un mes de actividad.

    Todo sintético. Vive aparte de `support-hospital.ts` para no engordarlo y se
    suma a sus colecciones al construirlas. Sus tipos vienen de `support-hospital.types.ts`, no del archivo principal: así no hay ciclo.

    Los ids se derivan igual que en el principal (`uuid('hp-loc-…')`,
    `uuid('hp-doc-…')`), para apuntar a las mismas ubicaciones y doctores sin
    importarlos.
   ========================================================================== */

const T = TENANT_HOSPITAL_PILOTO;
const loc = (clave: string): string => uuid(`hp-loc-${clave}`);
const doc = (clave: string): string => uuid(`hp-doc-${clave}`);

function persona(
  clave: string,
  personName: string,
  roleTemplate: SupportRoleTemplateCode,
  origin: FilaVinculo['origin'],
  diasDesdeAlta: number,
  recertificacionEnDias: number,
  extras: Partial<FilaVinculo> = {},
): FilaVinculo {
  return {
    id: uuid(`hp-eng-${clave}`),
    tenantId: T,
    ownerKind: 'ORGANIZATION',
    userId: uuid(`user-${clave}`),
    personName,
    personEmail: `${clave}@alovida.mock`,
    roleTemplate,
    status: 'ACTIVE',
    origin,
    validFrom: iso(-diasDesdeAlta),
    recertifyEveryMonths: 12,
    nextRecertificationAt: iso(recertificacionEnDias),
    ...extras,
  };
}

/**
 * Tres vínculos que piden revisión, uno por cada estado:
 * - Gabriel vence en 12 días (**por vencer**);
 * - Pedro venció hace 6 días y se suspende en 9 (**vencido**, en plazo de gracia);
 * - Silvia venció hace 22 días y se suspendió hace 7 (**suspendido**).
 */
export const VINCULOS_PARA_REVISION: readonly FilaVinculo[] = [
  persona('gabriel-rojas', 'Gabriel Rojas', 'CALL_CENTER', 'INVITATION', 350, 12),
  persona('pedro-camacho', 'Pedro Camacho', 'FRONT_DESK', 'QR', 371, -6),
  persona('silvia-soria', 'Silvia Soria', 'BILLING_CASHIER', 'REQUEST', 387, -22, { status: 'SUSPENDED', suspendedAt: iso(-7) }),
];

const porClave = (clave: string): FilaVinculo => VINCULOS_PARA_REVISION.find((v) => v.id === uuid(`hp-eng-${clave}`))!;

function permiso(clave: string, vinculo: FilaVinculo, objetivo: SupportScopeTarget): FilaPermiso {
  return {
    id: uuid(`hp-grant-${clave}`),
    engagementId: vinculo.id,
    ...objetivo,
    expansionMode: 'DYNAMIC',
    actions: SUPPORT_TEMPLATE_DEFAULT_ACTIONS[vinculo.roleTemplate],
    status: 'ACTIVE',
  };
}

export const PERMISOS_PARA_REVISION: readonly FilaPermiso[] = [
  permiso('gabriel-b-p2', porClave('gabriel-rojas'), { targetKind: 'LOCATION', careSpaceId: loc('b-p2') }),
  permiso('pedro-pb', porClave('pedro-camacho'), { targetKind: 'LOCATION', careSpaceId: loc('a-pb') }),
  permiso('pedro-p3', porClave('pedro-camacho'), { targetKind: 'LOCATION', careSpaceId: loc('a-p3') }),
  permiso('silvia-caja', porClave('silvia-soria'), { targetKind: 'ALL_PRACTITIONERS' }),
];

function pedido(
  clave: string,
  requesterName: string,
  roleTemplate: SupportRoleTemplateCode,
  creadaHaceDias: number,
  estado: FilaSolicitud['status'],
  items: FilaSolicitud['items'],
  extras: Partial<FilaSolicitud> = {},
): FilaSolicitud {
  return {
    id: uuid(`hp-req-${clave}`),
    tenantId: T,
    requesterUserId: uuid(`user-${clave}`),
    requesterName,
    direction: 'REQUEST',
    roleTemplate,
    status: estado,
    expiresAt: iso(15 - creadaHaceDias),
    createdAt: iso(-creadaHaceDias),
    items,
    ...extras,
  };
}

function item(clave: string, objetivo: SupportScopeTarget, decision: FilaSolicitud['items'][number]['decision'], roleTemplate: SupportRoleTemplateCode): FilaSolicitud['items'][number] {
  return { id: uuid(`hp-item-${clave}`), ...objetivo, proposedActions: SUPPORT_TEMPLATE_DEFAULT_ACTIONS[roleTemplate], decision };
}

/** Solicitudes de todas las edades y estados: dos urgentes, dos vencidas y las que ya se resolvieron. */
export const SOLICITUDES_PARA_BANDEJA: readonly FilaSolicitud[] = [
  pedido('rocio-vargas', 'Rocío Vargas', 'SECRETARY', 13, 'PENDING', [item('rocio-vargas', { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: doc('mendez') }, 'PENDING', 'SECRETARY')], {
    message: 'Voy a cubrir la agenda de la Dra. Méndez mientras está de licencia su secretaria.',
  }),
  pedido('sofia-aguilar', 'Sofía Aguilar', 'MEDICAL_ASSISTANT', 6, 'PENDING', [item('sofia-aguilar', { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: doc('flores') }, 'PENDING', 'MEDICAL_ASSISTANT')]),
  pedido('carmen-ibanez', 'Carmen Ibáñez', 'NURSING', 21, 'EXPIRED', [item('carmen-ibanez', { targetKind: 'LOCATION', careSpaceId: loc('a-p4') }, 'PENDING', 'NURSING')], {
    message: 'Necesito ver quién llega a internación.',
  }),
  pedido('luis-teran', 'Luis Terán', 'CALL_CENTER', 18, 'EXPIRED', [item('luis-teran', { targetKind: 'ALL_SERVICES' }, 'PENDING', 'CALL_CENTER')]),
  pedido('pedro-camacho', 'Pedro Camacho', 'FRONT_DESK', 33, 'REJECTED', [item('pedro-camacho', { targetKind: 'ALL' }, 'REJECTED', 'FRONT_DESK')], {
    decidedAt: iso(-29),
    decisionReason: 'Con toda la organización es demasiado: pida el piso donde trabaja.',
  }),
  pedido('silvia-soria', 'Silvia Soria', 'BILLING_CASHIER', 52, 'APPROVED', [item('silvia-soria', { targetKind: 'ALL_PRACTITIONERS' }, 'APPROVED', 'BILLING_CASHIER')], { decidedAt: iso(-50) }),
  pedido('gabriel-rojas', 'Gabriel Rojas', 'CALL_CENTER', 41, 'PARTIAL', [
    item('gabriel-rojas-1', { targetKind: 'LOCATION', careSpaceId: loc('b-p2') }, 'APPROVED', 'CALL_CENTER'),
    item('gabriel-rojas-2', { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: doc('vaca') }, 'REJECTED', 'CALL_CENTER'),
  ], { decidedAt: iso(-38), decisionReason: 'El Dr. Vaca prefiere atender su agenda con una sola persona.' }),
  pedido('raul-pena', 'Raúl Peña', 'MEDICAL_ASSISTANT', 35, 'APPROVED', [item('raul-pena', { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: doc('flores') }, 'APPROVED', 'MEDICAL_ASSISTANT')], { decidedAt: iso(-30) }),
  pedido('mariana-lopez', 'Mariana López', 'SECRETARY', 27, 'REJECTED', [item('mariana-lopez', { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: doc('rojas') }, 'REJECTED', 'SECRETARY')], {
    decidedAt: iso(-24),
    decisionReason: 'La agenda de la Dra. Rojas ya la cubre otra persona.',
  }),
];

const entrada = (clave: string, haceDias: number, hora: number, minuto: number, actorName: string, action: string, summary: string, extras: { doctor?: string; patientLabel?: string } = {}): FilaBitacora => ({
  id: uuid(`hp-act-${clave}`),
  tenantId: T,
  occurredAt: iso(-haceDias, hora, minuto),
  actorName,
  action,
  summary,
  ...(extras.doctor === undefined ? {} : { doctorId: doc(extras.doctor) }),
  ...(extras.patientLabel === undefined ? {} : { patientLabel: extras.patientLabel }),
});

const ORG = 'Hospital Piloto Mantra';

/** Un mes de actividad: agenda, mensajes, búsquedas y lo que pasó con los vínculos. */
export const BITACORA_PARA_HISTORIA: readonly FilaBitacora[] = [
  entrada('h1', 1, 11, 20, 'Ana Gutiérrez', 'schedule.reschedule', 'Reprogramó una cita con el Dr. Andrés Pérez.', { doctor: 'perez', patientLabel: 'Paciente J. T.' }),
  entrada('h2', 1, 9, 5, 'Lucía Paz', 'schedule.check_in', 'Registró la llegada de un paciente del Dr. Andrés Pérez.', { doctor: 'perez', patientLabel: 'Paciente M. R.' }),
  entrada('h3', 2, 15, 40, 'Ana Gutiérrez', 'patient.search', 'Buscó a un paciente por documento.', { patientLabel: 'Paciente S. A. · CI ***218' }),
  entrada('h4', 3, 10, 12, 'Marcos Ribera', 'schedule.cancel', 'Canceló una ecografía con la Dra. Lucía Antelo.', { doctor: 'antelo', patientLabel: 'Paciente D. C.' }),
  entrada('h5', 4, 16, 2, 'Ana Gutiérrez', 'schedule.confirm', 'Confirmó una cita con la Dra. Valeria Rojas.', { doctor: 'rojas', patientLabel: 'Paciente P. Q.' }),
  entrada('h6', 5, 8, 30, 'Pedro Camacho', 'schedule.check_in', 'Registró la llegada de un paciente de la Dra. Carla Méndez.', { doctor: 'mendez', patientLabel: 'Paciente H. V.' }),
  entrada('h7', 6, 12, 45, 'Ana Gutiérrez', 'messages.reply_on_behalf', 'Respondió un mensaje administrativo en nombre del Dr. Andrés Pérez.', { doctor: 'perez' }),
  entrada('h8', 7, 9, 10, ORG, 'engagement.recertified', 'Se confirmó el vínculo de Lucía Paz por 12 meses.'),
  entrada('h9', 8, 14, 22, 'Marcos Ribera', 'schedule.create', 'Agendó una consulta con el Dr. Martín Suárez en la Sede Norte.', { doctor: 'suarez', patientLabel: 'Paciente E. L.' }),
  entrada('h10', 9, 11, 0, ORG, 'grant.revoked', 'Se retiró un permiso a Pedro Camacho.'),
  entrada('h11', 10, 17, 35, 'Lucía Paz', 'schedule.walk_in', 'Atendió a un paciente sin cita de la Dra. Carla Méndez.', { doctor: 'mendez', patientLabel: 'Paciente G. F.' }),
  entrada('h12', 12, 10, 50, 'Ana Gutiérrez', 'schedule.create', 'Creó una cita con el Dr. Andrés Pérez.', { doctor: 'perez', patientLabel: 'Paciente L. B.' }),
  entrada('h13', 14, 9, 15, 'Silvia Soria', 'billing.collect', 'Cobró una consulta del Dr. Jorge Vaca.', { doctor: 'vaca', patientLabel: 'Paciente R. N.' }),
  entrada('h14', 16, 13, 5, 'Ana Gutiérrez', 'schedule.view', 'Abrió la agenda del Dr. Andrés Pérez.', { doctor: 'perez' }),
  entrada('h15', 18, 16, 30, ORG, 'engagement.suspended', 'Se suspendió el vínculo de Silvia Soria por no confirmarse a tiempo.'),
  entrada('h16', 21, 10, 0, 'Marcos Ribera', 'patient.search', 'Buscó a un paciente por teléfono.', { patientLabel: 'Paciente A. M. · CI ***907' }),
  entrada('h17', 24, 15, 10, 'Ana Gutiérrez', 'schedule.reschedule', 'Reprogramó una cita con la Dra. Valeria Rojas.', { doctor: 'rojas', patientLabel: 'Paciente C. Z.' }),
  entrada('h18', 28, 11, 40, ORG, 'invitation.created', 'Se emitió una invitación para personal de apoyo.'),
];
