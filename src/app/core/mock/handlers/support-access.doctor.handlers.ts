import { SUPPORT_ACTION_CODES, type SupportActionCode } from '../../data-access/support-access/support-access.types';
import { actionsFor, contextsOf, indexLocations, previewCoverage, type CoverageGrant } from '../../data-access/support-access/support-coverage';
import { accesosClinicos, bitacora, delegadoId, delegados, permisos, vinculos, type FilaDelegado } from '../fixtures/support-hospital';
import { conflict, forbidden, notFound, preconditionFailed, validation, type MockRouter } from '../mock-router';
import { ahora, cuerpo, nuevoId } from '../mock-store';
import { paginaDeActividad } from './support-access.activity';
import { doctorDe, doctorDelPermiso, catalogoDe, anotar, resolverDelegado, miembroDe } from './support-access.core';

/* ============================================================================
    Rutas del doctor: su equipo, aceptar, retirar, ajustes de respuesta y accesos
    clínicos temporales. El chat (asignación, notas internas, responder en su
    nombre) vive en `support-access.chat.handlers.ts`.
   ========================================================================== */

export function registrarApoyoDoctor(router: MockRouter): void {
  /* ---- doctor -------------------------------------------------------------- */

  router.get('/me/practitioner/support-team', ({ user }) => {
    const doctor = doctorDe(user);
    if (doctor === undefined) return forbidden('Esta pantalla es para quien atiende.');
    const catalogo = catalogoDe(doctor.tenantId);
    const locations = indexLocations(catalogo.locations);
    const doctorEnCatalogo = catalogo.doctors.find((d) => d.id === doctor.id);
    /** Las acciones que la persona tiene sobre este doctor: la unión de sus permisos que lo cubren. */
    const accionesSobreElDoctor = (grants: readonly CoverageGrant[]): readonly SupportActionCode[] => {
      if (doctorEnCatalogo === undefined) return [];
      const reunidas = new Set<SupportActionCode>();
      for (const c of contextsOf(doctorEnCatalogo)) for (const a of actionsFor(grants, c, locations)) reunidas.add(a);
      return SUPPORT_ACTION_CODES.filter((a) => reunidas.has(a));
    };
    const miembros: ReturnType<typeof miembroDe>[] = [];
    for (const v of vinculos.filtrar((x) => x.tenantId === doctor.tenantId)) {
      const fila = delegados.get(delegadoId(v.id, doctor.id));
      const grants = permisos.filtrar((p) => p.engagementId === v.id && p.status === 'ACTIVE');
      const cobertura = previewCoverage(grants, catalogo).doctors.find((c) => c.doctor.id === doctor.id);
      if (fila?.status === 'REVOKED' && cobertura === undefined) {
        miembros.push(miembroDe(v, doctor, fila, 'Ya no tiene acceso a su agenda.', [], 'REVOKED'));
        continue;
      }
      if (cobertura === undefined) continue;
      const resumen =
        cobertura.extent === 'all'
          ? 'Cubre toda su agenda: todos sus lugares y servicios.'
          : `Cubre solo parte de su agenda: ${cobertura.coveredSpaceNames.join(', ')}.`;
      // Un vínculo suspendido por no recertificarse sigue con sus permisos, pero la API lo cuenta como baja.
      if (v.status === 'SUSPENDED') {
        miembros.push(miembroDe(v, doctor, fila, resumen, accionesSobreElDoctor(grants), 'SUSPENDED'));
        continue;
      }
      if (v.status !== 'ACTIVE') continue;
      miembros.push(miembroDe(v, doctor, fila, resumen, accionesSobreElDoctor(grants)));
    }
    return { items: miembros };
  });

  router.post('/practitioner-delegates/:id/accept', (request) => {
    const doctor = doctorDe(request.user);
    const encontrado = resolverDelegado(request.params['id']!);
    if (encontrado === undefined) return notFound('Delegación no encontrada.');
    if (doctor === undefined || doctor.id !== encontrado.doctor.id) return forbidden('Solo el doctor puede aceptar a su personal de apoyo.');
    const datos = cuerpo<{ acceptsSupportClause: boolean; mayReplyOnBehalf?: boolean; replyDisclosure?: 'SHOW' | 'HIDE' }>(request);
    // `AcceptSupportDelegateDto`: aceptar es aceptar la cláusula de personal de apoyo (`true`).
    if (datos.acceptsSupportClause !== true) return validation('Para aceptar a esta persona hay que aceptar la cláusula de personal de apoyo.', [{ field: 'acceptsSupportClause', message: 'debe ser verdadero' }]);
    const base: FilaDelegado = encontrado.fila ?? {
      id: request.params['id']!,
      engagementId: encontrado.engagement.id,
      doctorId: doctor.id,
      status: 'PENDING_ACCEPTANCE',
      mayReplyOnBehalf: false,
      replyDisclosure: 'SHOW',
    };
    delegados.agregar({
      ...base,
      status: 'ACTIVE',
      mayReplyOnBehalf: datos.mayReplyOnBehalf ?? false,
      replyDisclosure: datos.replyDisclosure ?? base.replyDisclosure,
      acceptedAt: ahora(),
    });
    anotar(doctor.tenantId, doctor.name, 'delegate.accepted', `${doctor.name} aceptó a ${encontrado.engagement.personName} como parte de su equipo.`, { doctorId: doctor.id });
    return { ok: true };
  });

  router.wrap('POST', '/practitioner-delegates/:id/revoke', (request, siguiente) => {
    const encontrado = resolverDelegado(request.params['id']!);
    if (encontrado === undefined) return siguiente(request);
    const doctor = doctorDe(request.user);
    if (doctor === undefined || doctor.id !== encontrado.doctor.id) return forbidden('Solo el doctor puede retirar a alguien de su equipo.');
    const base: FilaDelegado = encontrado.fila ?? {
      id: request.params['id']!,
      engagementId: encontrado.engagement.id,
      doctorId: doctor.id,
      status: 'ACTIVE',
      mayReplyOnBehalf: false,
      replyDisclosure: 'SHOW',
    };
    // En cascada: los permisos que lo nombran a él dejan de regir al instante.
    delegados.agregar({ ...base, status: 'REVOKED', mayReplyOnBehalf: false });
    for (const p of permisos.filtrar((x) => x.engagementId === encontrado.engagement.id && x.status === 'ACTIVE' && doctorDelPermiso(x) === doctor.id)) {
      permisos.actualizar(p.id, { status: 'REVOKED' });
    }
    anotar(doctor.tenantId, doctor.name, 'delegate.revoked', `${doctor.name} retiró a ${encontrado.engagement.personName} de su equipo.`, { doctorId: doctor.id });
    return { ok: true };
  });

  router.patch('/practitioner-delegates/:id/reply-settings', (request) => {
    const doctor = doctorDe(request.user);
    const encontrado = resolverDelegado(request.params['id']!);
    if (encontrado === undefined) return notFound('Delegación no encontrada.');
    if (doctor === undefined || doctor.id !== encontrado.doctor.id) return forbidden('Solo el doctor decide esto sobre su equipo.');
    const datos = cuerpo<{ mayReplyOnBehalf?: boolean; replyDisclosure?: 'SHOW' | 'HIDE' }>(request);
    const base: FilaDelegado = encontrado.fila ?? {
      id: request.params['id']!,
      engagementId: encontrado.engagement.id,
      doctorId: doctor.id,
      status: 'ACTIVE',
      mayReplyOnBehalf: false,
      replyDisclosure: 'SHOW',
    };
    if (base.status !== 'ACTIVE') return preconditionFailed('Primero acepte a esta persona.');
    delegados.agregar({
      ...base,
      ...(datos.mayReplyOnBehalf === undefined ? {} : { mayReplyOnBehalf: datos.mayReplyOnBehalf }),
      ...(datos.replyDisclosure === undefined ? {} : { replyDisclosure: datos.replyDisclosure }),
    });
    return { ok: true };
  });

  router.get('/me/practitioner/support-activity', ({ user, query }) => {
    const doctor = doctorDe(user);
    if (doctor === undefined) return forbidden('Esta pantalla es para quien atiende.');
    return paginaDeActividad(bitacora.filtrar((b) => b.tenantId === doctor.tenantId && b.doctorId === doctor.id), query);
  });

  router.wrap('POST', '/access-requests/:id/decision', (request, siguiente) => {
    const solicitud = accesosClinicos.get(request.params['id']!);
    if (solicitud === undefined) return siguiente(request);
    const doctor = doctorDe(request.user);
    if (doctor === undefined || doctor.id !== solicitud.doctorId) return forbidden('Este acceso lo decide el doctor.');
    if (solicitud.status !== 'PENDING') return conflict('Esa solicitud ya fue resuelta.');
    const aprobada = cuerpo<{ decision: 'APPROVED' | 'DENIED' }>(request).decision !== 'DENIED';
    accesosClinicos.actualizar(solicitud.id, { status: aprobada ? 'APPROVED' : 'DENIED' });
    const vinculo = vinculos.get(solicitud.engagementId);
    anotar(
      doctor.tenantId,
      doctor.name,
      aprobada ? 'clinical_access.approved' : 'clinical_access.denied',
      aprobada
        ? `${doctor.name} autorizó a ${vinculo?.personName ?? 'su equipo'} un acceso clínico temporal (${solicitud.requestedHours} h).`
        : `${doctor.name} negó un acceso clínico a ${vinculo?.personName ?? 'su equipo'}.`,
      { doctorId: doctor.id, patientLabel: solicitud.patientLabel },
    );
    return { requestId: solicitud.id, decision: aprobada ? 'APPROVED' : 'DENIED', ...(aprobada ? { grantId: nuevoId('grant') } : {}) };
  });
}
