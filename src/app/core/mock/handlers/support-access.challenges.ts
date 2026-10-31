import {
  actionsFor,
  indexLocations,
  type CoverageGrant,
} from '../../data-access/support-access/support-coverage';
import type { SupportActionCode } from '../../data-access/support-access/support-access.types';
import type { FilaPermiso } from '../fixtures/support-hospital';
import { filaDeAgenda } from '../fixtures/support-hospital-agenda';
import { aprobaciones } from '../fixtures/support-hospital-governance';
import type { MockUser } from '../mock-session';
import type { MockReply, MockRequest } from '../mock-router';
import { ahora } from '../mock-store';
import { catalogoDe, permisosEfectivos } from './support-access.core';
import { conMotivo, denegadoGenerico } from './support-access.errors';
import { exigirPasoExtra } from './support-access.governance.core';
import { esPacienteReservado } from './support-access.reserved';

/* ============================================================================
    Los **desafíos** de agenda y bandeja (CONTRATO-GOBIERNO §8.4, «Mapa DENY/CHALLENGE → HTTP en los PEP»).

    Hasta acá solo los hacían las rutas del gobierno. Esto lo deja a la API simulada **decir «falta algo» en vez de «no»**, con la
    misma forma que la API: 422 `REASON_REQUIRED`, 403 `STEP_UP_REQUIRED` y 403 `APPROVAL_REQUIRED` (con `X-Approval-Id` en el
    reintento). Es aditivo y sale de los **datos** del piloto —no de código duro por persona—:

    - **Cancelar** una cita con menos horas de las que fija el permiso (`appointment.leadTime`, `REQUIRE_APPROVAL`): aprobación del doctor.
    - **Responder** a un paciente con banderas de restricción (VIP, confidencial…) en nombre del doctor: segundo paso.

    **No** hay desafíos al **buscar pacientes** ni en **caja** (anular un comprobante): la API real no los emite (la búsqueda no
    admite motivo y la facturación no tiene un PEP, pendientes 45 y 58). El mock no los inventa.

    El mock **no reimplementa la política** (§9.6): hace cumplir solo lo que cambia la forma de la respuesta.
   ========================================================================== */

/** Cuántos minutos vale una aprobación de acción ya dada (`fourEyesActionTtlMinutes`). */
const VIGENCIA_DE_APROBACION_MINUTOS = 60;

const HORA_EN_MS = 3_600_000;

/* ---- cuatro ojos de una acción ------------------------------------------------------------------------------------------------ */

/**
 * La aprobación de **esta** acción: sin `X-Approval-Id`, 403 `APPROVAL_REQUIRED` con `{ approverKind, atom, ttlMinutes }`; con él,
 * se **consume una sola vez** si es de esta persona, de este permiso y está aprobada y vigente. Una aprobación de otra acción o ya
 * usada es 409 (`FOUR_EYES_PAYLOAD_CHANGED`, `FOUR_EYES_ALREADY_CONSUMED`); una vencida, `FOUR_EYES_EXPIRED`; una que aún no se decidió,
 * el mismo `APPROVAL_REQUIRED` con `approvalProblem`. Devuelve `null` si la acción puede seguir.
 */
export function exigirAprobacionDeAccion(
  request: MockRequest,
  user: MockUser,
  atom: string,
  approverKind: 'DOCTOR' | 'SECOND_APPROVER',
): MockReply | null {
  const detalles = { approverKind, atom, ttlMinutes: VIGENCIA_DE_APROBACION_MINUTOS };
  const id = request.headers.get('X-Approval-Id');
  if (id === null || id === '')
    return conMotivo(
      403,
      'Esta acción necesita la aprobación de otra persona.',
      'APPROVAL_REQUIRED',
      detalles,
    );
  const fila = aprobaciones.get(id);
  if (
    fila === undefined ||
    fila.kind !== 'ACTION' ||
    fila.requesterUserId !== user.id ||
    fila.atom !== atom
  ) {
    return conMotivo(
      409,
      'La aprobación es de otra acción. Pida una nueva.',
      'FOUR_EYES_PAYLOAD_CHANGED',
      detalles,
    );
  }
  if (fila.status === 'CONSUMED')
    return conMotivo(
      409,
      'Esa aprobación ya se usó. Pida una nueva.',
      'FOUR_EYES_ALREADY_CONSUMED',
      detalles,
    );
  if (fila.status === 'PENDING')
    return conMotivo(
      403,
      'Esta acción necesita la aprobación de otra persona.',
      'APPROVAL_REQUIRED',
      { ...detalles, approvalProblem: 'FOUR_EYES_PENDING' },
    );
  if (fila.status !== 'APPROVED')
    return conMotivo(409, 'Esa solicitud ya fue resuelta.', 'FOUR_EYES_NOT_PENDING', detalles);
  if (fila.approvedUntil === undefined || new Date(fila.approvedUntil).getTime() < Date.now()) {
    return conMotivo(409, 'La solicitud caducó. Pida una nueva.', 'FOUR_EYES_EXPIRED', detalles);
  }
  aprobaciones.actualizar(fila.id, { status: 'CONSUMED', consumedAt: ahora() });
  return null;
}

/* ---- agenda: cancelar con poca antelación ------------------------------------------------------------------------------------------ */

type FilaDeAgenda = NonNullable<ReturnType<typeof filaDeAgenda>>;

/** Lo que fijan los permisos de quien llama para cancelar esa cita con poca antelación: las horas y qué hacer si no se cumplen. */
function antelacionExigida(
  user: MockUser,
  fila: FilaDeAgenda,
): { readonly minHours: number; readonly onViolation: 'DENY' | 'REQUIRE_APPROVAL' } | null {
  const locations = indexLocations(catalogoDe(fila.tenantId).locations);
  const contexto = {
    practitionerRoleAssignmentId: fila.doctorId,
    careSpaceId: fila.careSpaceId,
    healthcareServiceId: fila.healthcareServiceId,
  };
  for (const permiso of permisosEfectivos(user.id, fila.tenantId) as readonly (CoverageGrant &
    Partial<FilaPermiso>)[]) {
    const regla = permiso.actionConditions?.['agenda.appointment.cancel']?.appointment?.leadTime;
    if (regla === undefined || permiso.effect === 'DENY') continue;
    if (actionsFor([permiso], contexto, locations).includes('schedule.cancel' as SupportActionCode))
      return regla;
  }
  return null;
}

/**
 * Cancelar una cita que empieza en menos horas de las que exige el permiso pide **la aprobación del doctor** (el motivo ya lo
 * juzgó quien llama). Devuelve el desafío o `null` si puede seguir.
 */
export function desafioDeCancelacion(request: MockRequest, fila: FilaDeAgenda): MockReply | null {
  const user = request.user;
  if (user === null) return null;
  const regla = antelacionExigida(user, fila);
  if (regla === null) return null;
  const horas = (new Date(fila.start).getTime() - Date.now()) / HORA_EN_MS;
  if (horas >= regla.minHours) return null;
  if (regla.onViolation === 'DENY') return denegadoGenerico();
  return exigirAprobacionDeAccion(request, user, 'agenda.appointment.cancel', 'DOCTOR');
}

/* ---- pacientes con banderas de restricción -------------------------------------------------------------------------------------- */

/** Responder en nombre del doctor a un paciente reservado: segundo paso reciente. `null` si puede seguir. */
export function desafioDePacienteReservado(
  user: MockUser,
  pacientes: readonly (string | undefined)[],
): MockReply | null {
  return pacientes.some(esPacienteReservado) ? exigirPasoExtra(user.id) : null;
}
