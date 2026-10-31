import { SUPPORT_TEMPLATE_DEFAULT_ACTIONS, type SupportRoleTemplateCode, type SupportScopeTarget } from '../../data-access/support-access/support-access.types';
import { bitacora, CATALOGOS, invitaciones, solicitudes, vinculos, type FilaSolicitud, type FilaVinculo } from '../fixtures/support-hospital';
import { conflict, forbidden, notFound, preconditionFailed, validation, type MockRouter } from '../mock-router';
import { TENANT_HOSPITAL_PILOTO, TENANT_NAMES } from '../mock-session';
import { createPendingQrAffiliation, PRACTICE_CM_NORTE } from '../fixtures/role-assignments';
import { ahora, cuerpo, iso, nuevoId, uuid } from '../mock-store';
import { paginaDeActividad } from './support-access.activity';
import { agendaReal, horariosLibres } from './support-access.agenda-wire';
import { barrerRecertificaciones, QUINCE_DIAS, vinculosActivosDe, catalogoDe, vistaVinculo, vistaSolicitud, anotar, PLANTILLAS, accionesValidas, objetivoValido, soloObjetivo } from './support-access.core';

/* ============================================================================
    Rutas de la persona de apoyo: sus vínculos, pedir acceso, canjear un código,
    su agenda combinada, su catálogo y su bandeja.
   ========================================================================== */

/** La práctica activa de cada organización donde un doctor puede canjear un QR multiuso. Las demás no tienen: 412. */
export const PRACTICA_DE_LA_ORGANIZACION: Readonly<Record<string, string>> = { [TENANT_HOSPITAL_PILOTO]: PRACTICE_CM_NORTE };

export function registrarApoyoPersona(router: MockRouter): void {
  /* ---- persona de apoyo ---------------------------------------------------- */

  router.get('/me/support-engagements', ({ user }) => {
    if (user === null) return forbidden('Sin sesión.');
    barrerRecertificaciones();
    const propios = vinculos.filtrar((v) => v.userId === user.id);
    return {
      // `MySupportEngagementsResponseDto`: `items` (los vínculos), `count` y `requests`.
      items: propios.map(vistaVinculo),
      count: propios.length,
      requests: solicitudes
        .filtrar((r) => r.requesterUserId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map(vistaSolicitud),
    };
  });

  /**
   * La persona declara que **sigue trabajando aquí** (sin cuerpo). Responde el vínculo y
   * `reactivated`.
   *
   * Sigue la decisión de producto: es solo una declaración (`lastConfirmedAt` y
   * `lastConfirmedBy: PERSON`), **no renueva** el vínculo ni reactiva uno suspendido —eso
   * es de la organización (`/org/.../recertify`)—, así que `reactivated` es siempre `false`.
   * La API de hoy sí deja que la persona lo renueve y reactive; el coordinador lo corrige.
   * Terminado: no hay nada que confirmar.
   */
  router.post('/me/support-engagements/:id/confirm', (request) => {
    const user = request.user;
    if (user === null) return forbidden('Sin sesión.');
    barrerRecertificaciones();
    const vinculo = vinculos.get(request.params['id']!);
    if (vinculo === undefined || vinculo.userId !== user.id) return notFound('Vínculo no encontrado.');
    if (vinculo.status === 'ENDED' || vinculo.status === 'PENDING') return conflict('Este vínculo no se puede confirmar.');
    const nombreOrg = TENANT_NAMES[vinculo.tenantId] ?? 'La organización';
    const declarado = vinculos.actualizar(vinculo.id, { lastConfirmedAt: ahora(), lastConfirmedBy: 'PERSON' })!;
    anotar(vinculo.tenantId, user.displayName, 'engagement.confirmed_by_person', `${user.displayName} confirmó que sigue trabajando en ${nombreOrg}.`);
    return { ...vistaVinculo(declarado), reactivated: false };
  });

  /** «Mi actividad»: lo que hizo esta persona, en todas las organizaciones donde ayuda (o en una, con `tenantId`). */
  router.get('/me/support-activity', ({ user, query }) => {
    if (user === null) return forbidden('Sin sesión.');
    return paginaDeActividad(bitacora.filtrar((b) => b.actorName === user.displayName), query);
  });

  router.post('/support-engagement-requests', (request) => {
    const user = request.user;
    if (user === null) return forbidden('Sin sesión.');
    // Los nombres de `CreateEngagementRequestDto`: `roleTemplateCode`, `parentAssignmentId` y `actions`.
    const datos = cuerpo<{
      tenantId: string;
      roleTemplateCode: string;
      parentAssignmentId?: string;
      message?: string;
      items: (Partial<SupportScopeTarget> & { actions?: unknown })[];
    }>(request);
    if (datos.tenantId === undefined || CATALOGOS[datos.tenantId] === undefined) return notFound('Organización no encontrada.');
    if (datos.roleTemplateCode === undefined || !PLANTILLAS.includes(datos.roleTemplateCode)) {
      return validation('Elija un rol válido.', [{ field: 'roleTemplateCode', message: 'no es un rol válido' }]);
    }
    const items = datos.items ?? [];
    if (items.length === 0) return validation('Pida al menos un permiso.', [{ field: 'items', message: 'no puede estar vacío' }]);
    for (const item of items) {
      if (!objetivoValido(item) || accionesValidas(item.actions) === null) {
        return validation('Hay un permiso incompleto.', [{ field: 'items', message: 'cada permiso necesita su objetivo y sus acciones' }]);
      }
    }
    const solicitud: FilaSolicitud = {
      id: nuevoId('solicitud'),
      tenantId: datos.tenantId,
      requesterUserId: user.id,
      requesterName: user.displayName,
      direction: 'REQUEST',
      roleTemplate: datos.roleTemplateCode as SupportRoleTemplateCode,
      ...(datos.parentAssignmentId === undefined ? {} : { parentEngagementId: datos.parentAssignmentId }),
      ...(datos.message === undefined || datos.message === '' ? {} : { message: datos.message }),
      status: 'PENDING',
      expiresAt: iso(QUINCE_DIAS),
      createdAt: ahora(),
      items: items.map((item) => ({
        id: nuevoId('item'),
        ...soloObjetivo(item),
        proposedActions: accionesValidas(item.actions)!,
        decision: 'PENDING' as const,
      })),
    };
    solicitudes.agregar(solicitud);
    anotar(datos.tenantId, user.displayName, 'request.created', `${user.displayName} pidió acceso (${items.length} ${items.length === 1 ? 'permiso' : 'permisos'}).`);
    return { status: 201, body: vistaSolicitud(solicitud) };
  });

  router.post('/affiliation-invitations/redeem', (request) => {
    const user = request.user;
    if (user === null) return forbidden('Sin sesión.');
    // El código es base64url y **distingue mayúsculas**: solo se quitan los espacios.
    const codigo = String(cuerpo<{ code: string }>(request).code ?? '').replace(/\s+/g, '');
    if (codigo.length < 8 || codigo.length > 200) return validation('El código tiene entre 8 y 200 caracteres.', [{ field: 'code', message: 'largo no válido' }]);
    // Inexistente, usado, vencido, revocado o de alguien que ya está adentro: la API
    // responde **lo mismo** (422 opaco) para no revelar cuál fue.
    const rechazo = preconditionFailed('La invitación no es válida', { reason: 'SUPPORT_INVITATION_INVALID' });
    const invitacion = invitaciones.filtrar((i) => i.code === codigo)[0];
    if (invitacion === undefined) return rechazo;
    const vencida = new Date(invitacion.expiresAt).getTime() < Date.now();
    if (vencida || invitacion.status !== 'ACTIVE' || invitacion.usesCount >= invitacion.maxUses) return rechazo;
    const usos = invitacion.usesCount + 1;
    const cerrar = usos >= invitacion.maxUses ? { status: 'USED' as const } : {};
    const membresia = uuid(`membresia-${invitacion.id}-${user.id}`);
    // Un código SIN persona destino (multiuso: un QR que cualquiera puede fotografiar) no afilia solo, sea de doctores o de
    // apoyo: deja algo pendiente y la organización decide. Solo uno dirigido a una persona afilia directo.
    const dirigido = invitacion.targetPersonId !== undefined;
    if (invitacion.kind === 'PRACTITIONER') {
      if (!dirigido) {
        // 412 con motivo (no el 422 opaco): sin perfil profesional no hay a quién afiliar; sin práctica activa, tampoco a dónde.
        if (user.practitionerProfileId === undefined) return preconditionFailed('Su cuenta no tiene un perfil profesional', { reason: 'SUPPORT_PRACTITIONER_PROFILE_REQUIRED' });
        const practica = PRACTICA_DE_LA_ORGANIZACION[invitacion.tenantId];
        if (practica === undefined) return preconditionFailed('La organización no tiene una práctica activa', { reason: 'SUPPORT_AFFILIATION_PRACTICE_MISSING' });
        invitaciones.actualizar(invitacion.id, { usesCount: usos, ...cerrar });
        const solicitud = createPendingQrAffiliation(practica, user.practitionerProfileId);
        anotar(invitacion.tenantId, user.displayName, 'invitation.redeemed', `${user.displayName} canjeó un código para doctores: queda pendiente de la aprobación de la organización.`);
        // La solicitud aparece en «Médicos del centro» (`initiatedBy: 'PRACTITIONER'`); no hay `requestId` ni `membershipId`.
        return { kind: 'PRACTITIONER', tenantId: invitacion.tenantId, roleAssignmentId: solicitud.id, pendingApproval: true };
      }
      invitaciones.actualizar(invitacion.id, { usesCount: usos, ...cerrar });
      anotar(invitacion.tenantId, user.displayName, 'invitation.redeemed', `${user.displayName} se afilió como doctor con una invitación.`);
      return { kind: 'PRACTITIONER', tenantId: invitacion.tenantId, membershipId: membresia };
    }
    if (vinculosActivosDe(user.id, invitacion.tenantId).length > 0) return rechazo;
    if (!dirigido) {
      const plantilla = (invitacion.roleTemplate ?? 'FRONT_DESK') as SupportRoleTemplateCode;
      const solicitud: FilaSolicitud = {
        id: nuevoId('solicitud'),
        tenantId: invitacion.tenantId,
        requesterUserId: user.id,
        requesterName: user.displayName,
        direction: 'REQUEST',
        roleTemplate: plantilla,
        status: 'PENDING',
        expiresAt: iso(QUINCE_DIAS),
        createdAt: ahora(),
        items: [{ id: nuevoId('item'), targetKind: 'ALL', proposedActions: [...SUPPORT_TEMPLATE_DEFAULT_ACTIONS[plantilla]], decision: 'PENDING' }],
      };
      solicitudes.agregar(solicitud);
      invitaciones.actualizar(invitacion.id, { usesCount: usos, ...cerrar });
      anotar(invitacion.tenantId, user.displayName, 'request.created', `${user.displayName} canjeó un código de apoyo: queda una solicitud pendiente de la organización.`);
      return { kind: 'SUPPORT_STAFF', tenantId: invitacion.tenantId, requestId: solicitud.id, pendingApproval: true };
    }
    const vinculo: FilaVinculo = {
      id: nuevoId('vinculo'),
      tenantId: invitacion.tenantId,
      ownerKind: 'ORGANIZATION',
      userId: user.id,
      personName: user.displayName,
      personEmail: user.email,
      roleTemplate: invitacion.roleTemplate ?? 'FRONT_DESK',
      status: 'ACTIVE',
      origin: 'INVITATION',
      validFrom: ahora(),
      recertifyEveryMonths: 12,
      nextRecertificationAt: iso(365),
    };
    vinculos.agregar(vinculo);
    invitaciones.actualizar(invitacion.id, { usesCount: usos, ...cerrar });
    anotar(invitacion.tenantId, user.displayName, 'engagement.created', `${user.displayName} se unió con un código de invitación. Todavía no tiene permisos.`);
    return { kind: 'SUPPORT_STAFF', tenantId: invitacion.tenantId, membershipId: membresia, engagementId: vinculo.id };
  });

  router.get('/me/support-agenda', agendaReal);
  router.get('/me/support-agenda/free-slots', horariosLibres);

  router.get('/me/support-catalog', ({ user, query }) => {
    const org = query.get('org');
    if (user === null) return forbidden('Sin sesión.');
    if (org === null || CATALOGOS[org] === undefined) return notFound('Organización no encontrada.');
    if (vinculosActivosDe(user.id, org).length === 0) return forbidden('No tiene un vínculo de apoyo vigente con esta organización.');
    return catalogoDe(org);
  });
}
