import type { SupportApproval } from '../../data-access/access-governance/access-reviews.types';
import { aprobaciones } from '../fixtures/support-hospital-governance';
import { type MockRouter, reply, validation } from '../mock-router';
import { CODIGO_DE_PRUEBA } from './iam-mfa.store';
import { ahora, cuerpo, iso, nuevoId } from '../mock-store';
import type { MockUser } from '../mock-session';
import { anotar, doctorDe } from './support-access.core';
import { conMotivo } from './support-access.errors';
import { ejecutarAprobacion } from './support-access.governance.lifecycle.handlers';
import { antiguedadDelPasoExtra, atomosVigentesDe, conSesion, exigirPasoExtra, hayRespuesta, lista, noEncontrado, nombreDe, PASO_EXTRA_MINUTOS, sellarPasoExtra, textoObligatorio } from './support-access.governance.core';

/* ============================================================================
    Cuatro ojos y paso extra (CONTRATO-GOBIERNO §8.3 C y H).

    Quien pide ≠ quien aprueba. Una aprobación de acción se **consume una sola vez** y caduca
    (`approvedUntil`); el reintento la presenta con `X-Approval-Id`. El paso extra del mock acepta el
    código de prueba `123456` (el mismo de la verificación en dos pasos del simulador) y vale
    {@link PASO_EXTRA_MINUTOS} minutos.
   ========================================================================== */

/** ¿Puede esta persona decidir esta aprobación? El doctor, solo las suyas; el segundo aprobador, un administrador distinto de quien pidió. */
export function puedeDecidir(user: MockUser, a: SupportApproval): boolean {
  if (a.requesterUserId === user.id) return false;
  if (a.approverKind === 'DOCTOR') return esDelDoctor(user, a);
  if (a.approverKind === 'SERVICE_HEAD') return atomosVigentesDe(user.id, a.tenantId).has('team.requests.decide');
  return user.roles.includes('SECURITY_ADMIN');
}

/** En el piloto, el cuatro ojos de una cita de Mateo Rivera es del Dr. Suárez; el resto de los de doctor, de quien atiende ese caso. */
function esDelDoctor(user: MockUser, a: SupportApproval): boolean {
  const doctor = doctorDe(user);
  if (doctor === undefined) return false;
  const objetivo = a.summary.includes('Suárez') ? 'suarez' : a.summary.includes('Rojas') ? 'rojas' : 'perez';
  return doctor.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(objetivo);
}

export function registrarGobiernoAprobaciones(router: MockRouter): void {
  /* ---- las propias de la persona de apoyo ------------------------------------------------------------------- */

  router.post('/me/support-approvals', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    const d = cuerpo<{ tenantId?: string; atom?: string; reasonText?: string; careSpaceId?: string; appointmentStartAt?: string; patientProfileId?: string }>(request);
    if (typeof d.tenantId !== 'string' || typeof d.atom !== 'string') return validation('Falta la organización o la acción.', [{ field: 'atom', message: 'es obligatoria' }]);
    if (!sesion.user.tenants.includes(d.tenantId)) return noEncontrado('SUPPORT_ENGAGEMENT_NOT_FOUND');
    const motivo = textoObligatorio(d.reasonText, 5, 'REASON_REQUIRED');
    if (!motivo.ok) return motivo.respuesta;
    const repetida = aprobaciones.filtrar((a) => a.status === 'PENDING' && a.requesterUserId === sesion.user.id && a.atom === d.atom && a.kind === 'ACTION')[0];
    if (repetida !== undefined) return conMotivo(409, 'Ya hay una solicitud igual esperando decisión.', 'FOUR_EYES_DUPLICATE_PENDING');
    const fila = aprobaciones.agregar({
      id: nuevoId('aprobacion'),
      tenantId: d.tenantId,
      kind: 'ACTION',
      status: 'PENDING',
      approverKind: d.atom.startsWith('billing.') || d.atom.startsWith('patients.profile') ? 'SECOND_APPROVER' : 'DOCTOR',
      atom: d.atom,
      requesterUserId: sesion.user.id,
      subjectUserId: sesion.user.id,
      reasonText: motivo.texto,
      createdAt: ahora(),
      expiresAt: new Date(Date.now() + 24 * 3_600_000).toISOString(),
      summary: `${sesion.user.displayName} pide permiso para «${d.atom}»${d.appointmentStartAt === undefined ? '' : ` sobre una cita del ${d.appointmentStartAt.slice(0, 10)}`}. Si se aprueba, se puede hacer una vez en la próxima hora.`,
    });
    anotar(d.tenantId, nombreDe(sesion.user), 'four_eyes.requested', 'Se pidió una aprobación de cuatro ojos.');
    return reply(201, fila);
  });

  router.get('/me/support-approvals', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    return lista(aprobaciones.filtrar((a) => a.requesterUserId === sesion.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  });

  router.post('/me/support-approvals/:id/cancel', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    const fila = aprobaciones.get(request.params['id']!);
    if (fila === undefined || fila.requesterUserId !== sesion.user.id) return noEncontrado('FOUR_EYES_NOT_FOUND');
    if (fila.status !== 'PENDING') return conMotivo(409, 'Esa solicitud ya fue resuelta.', 'FOUR_EYES_NOT_PENDING');
    return aprobaciones.actualizar(fila.id, { status: 'CANCELLED', decidedAt: ahora() });
  });

  /* ---- lo que yo puedo decidir -------------------------------------------------------------------------------- */

  router.get('/approvals/pending', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    return lista(aprobaciones.filtrar((a) => a.status === 'PENDING' && puedeDecidir(sesion.user, a)));
  });

  router.post('/approvals/:id/decision', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    const fila = aprobaciones.get(request.params['id']!);
    if (fila === undefined) return noEncontrado('FOUR_EYES_NOT_FOUND');
    if (fila.requesterUserId === sesion.user.id) return conMotivo(403, 'No puede aprobar lo que usted mismo pidió.', 'FOUR_EYES_SELF_APPROVAL');
    if (!puedeDecidir(sesion.user, fila)) return conMotivo(403, 'Usted no es quien debe decidir esta solicitud.', 'FOUR_EYES_NOT_ELIGIBLE');
    if (fila.status !== 'PENDING') return conMotivo(409, 'Esa solicitud ya fue resuelta.', 'FOUR_EYES_NOT_PENDING');
    if (new Date(fila.expiresAt).getTime() < Date.now()) {
      aprobaciones.actualizar(fila.id, { status: 'EXPIRED' });
      return conMotivo(409, 'La solicitud caducó. Pida una nueva.', 'FOUR_EYES_EXPIRED');
    }
    const d = cuerpo<{ decision?: string; comment?: string }>(request);
    if (d.decision !== 'APPROVE' && d.decision !== 'REJECT') return validation('Indique si aprueba o rechaza.', [{ field: 'decision', message: 'use APPROVE o REJECT' }]);
    if (d.decision === 'REJECT') {
      const c = textoObligatorio(d.comment, 5, 'REASON_REQUIRED');
      if (!c.ok) return c.respuesta;
      anotar(fila.tenantId, nombreDe(sesion.user), 'four_eyes.rejected', 'Se rechazó una aprobación de cuatro ojos.');
      return { approval: aprobaciones.actualizar(fila.id, { status: 'REJECTED', decidedAt: ahora(), decisionComment: c.texto })! };
    }
    // Las de sensibilidad crítica (anular, devolver, corregir identidad) piden además el segundo paso de quien aprueba.
    if (
      (fila.atom !== undefined && ['billing.receipt.void', 'billing.payment.refund', 'patients.profile.edit_verified'].includes(fila.atom)) ||
      (fila.details?.criticalAtoms.length ?? 0) > 0
    ) {
      const paso = exigirPasoExtra(sesion.user.id);
      if (paso !== null) return paso;
    }
    anotar(fila.tenantId, nombreDe(sesion.user), 'four_eyes.approved', 'Se aprobó una solicitud de cuatro ojos.');
    const aprobada = aprobaciones.actualizar(fila.id, { status: 'APPROVED', decidedAt: ahora(), approvedUntil: iso(0, new Date().getHours() + 1, new Date().getMinutes()) })!;
    // Las aprobaciones que no son de una acción (reactivar, excepción SoD) se ejecutan al aprobarse; las de acción esperan el reintento.
    return { approval: aprobada, execution: fila.kind === 'ACTION' ? { executed: false } : ejecutarAprobacion(fila.id) };
  });

  /* ---- paso extra -------------------------------------------------------------------------------------------------- */

  router.post('/iam/me/step-up', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    const codigo = String(cuerpo<{ code?: unknown }>(request).code ?? '');
    if (codigo.length < 6 || codigo.length > 8) return validation('El código tiene entre 6 y 8 dígitos.', [{ field: 'code', message: 'debe tener entre 6 y 8 caracteres' }]);
    if (codigo !== CODIGO_DE_PRUEBA) return conMotivo(422, 'El código no es correcto.', 'MFA_CODE_INVALID');
    sellarPasoExtra(sesion.user.id);
    return { verifiedAt: ahora(), validForMinutes: PASO_EXTRA_MINUTOS };
  });

  router.get('/iam/me/step-up', (request) => {
    const sesion = conSesion(request);
    if (hayRespuesta(sesion)) return sesion;
    const maxima = Number(request.query.get('maxAgeMinutes') ?? PASO_EXTRA_MINUTOS);
    const edad = antiguedadDelPasoExtra(sesion.user.id);
    return { fresh: edad !== null && edad <= maxima, ageMinutes: edad };
  });
}

