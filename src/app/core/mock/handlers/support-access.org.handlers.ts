import { SUPPORT_ACTION_CODES, type AccessLookupEntry, type SupportActionCode, type SupportRoleTemplateCode, type SupportScopeTarget } from '../../data-access/support-access/support-access.types';
import { actionsFor, indexLocations } from '../../data-access/support-access/support-coverage';
import { targetKey } from '../../data-access/support-access/support-grant-draft';
import { bitacora, delegados, DOCTORES_POR_TENANT, invitaciones, permisos, solicitudes, vinculos, type FilaVinculo } from '../fixtures/support-hospital';
import { paginaDeActividad } from './support-access.activity';
import { conflict, notFound, preconditionFailed, validation, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { PRACTICA_DE_LA_ORGANIZACION } from './support-access.persona.handlers';
import { TENANT_CESPEDES, TENANT_NAMES } from '../mock-session';
import { ahora, cuerpo, iso, nuevoId } from '../mock-store';
import { codigoDeInvitacion, barrerRecertificaciones, soloOrganizacion, esRespuesta, permisosEfectivosDeVinculo, catalogoDe, vistaPermiso, vistaVinculo, vistaSolicitud, anotar, contextosDeConsulta, PLANTILLAS, accionesValidas, objetivoValido, soloObjetivo, otorgar, invitacionVisible } from './support-access.core';

/* ============================================================================
    Rutas de la organización: solicitudes, equipo, permisos, consulta de acceso,
    invitaciones, bitácora, recertificación y fin de vínculo. La política de sesión
    vive en `support-access.session.handlers.ts`.
    Solo la cuenta de la organización las alcanza.
   ========================================================================== */

/** Los estados que acepta el filtro del listado: `PARTIAL` no (la API lo rechaza con 400). */
const ESTADOS_DEL_FILTRO: readonly string[] = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'];

export function registrarApoyoOrganizacion(router: MockRouter): void {
  /* ---- organización -------------------------------------------------------- */

  router.get('/org/support-engagements', (request) => {
    const acceso = soloOrganizacion(request);
    if (esRespuesta(acceso)) return acceso;
    barrerRecertificaciones();
    const items = vinculos.filtrar((v) => v.tenantId === acceso.tenantId).map(vistaVinculo);
    return { items, count: items.length };
  });

  router.get('/org/support-catalog', (request) => {
    const acceso = soloOrganizacion(request);
    if (esRespuesta(acceso)) return acceso;
    return catalogoDe(acceso.tenantId);
  });

  router.get('/org/support-engagement-requests', (request) => {
    const acceso = soloOrganizacion(request);
    if (esRespuesta(acceso)) return acceso;
    const estado = request.query.get('status');
    // `ListEngagementRequestsQueryDto`: el estado es uno de cinco (**no** `PARTIAL`), `limit` de 1 a 100.
    if (estado !== null && !ESTADOS_DEL_FILTRO.includes(estado)) return validation('El estado no es válido.', [{ field: 'status', message: `debe ser uno de: ${ESTADOS_DEL_FILTRO.join(', ')}` }]);
    const limiteTexto = request.query.get('limit');
    const limite = limiteTexto === null ? 25 : Number(limiteTexto);
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) return validation('El tope no es válido.', [{ field: 'limit', message: 'debe estar entre 1 y 100' }]);
    // Lo vencido se marca al leer, como haría el barrido de la API.
    for (const r of solicitudes.filtrar((s) => s.status === 'PENDING' && new Date(s.expiresAt).getTime() < Date.now())) {
      solicitudes.actualizar(r.id, { status: 'EXPIRED' });
    }
    const cursor = request.query.get('cursor');
    const todas = solicitudes
      .filtrar((r) => r.tenantId === acceso.tenantId && (estado === null || r.status === estado) && (cursor === null || r.createdAt < cursor))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const pagina = todas.slice(0, limite);
    // El cursor es opaco para el cliente: el instante de la última solicitud entregada.
    return { items: pagina.map(vistaSolicitud), count: pagina.length, nextCursor: todas.length > limite ? pagina[pagina.length - 1]!.createdAt : null };
  });

  router.post('/org/support-engagement-requests/:id/decision', (request) => {
    const acceso = soloOrganizacion(request);
    if (esRespuesta(acceso)) return acceso;
    const solicitud = solicitudes.get(request.params['id']!);
    if (solicitud === undefined || solicitud.tenantId !== acceso.tenantId) return notFound('Solicitud no encontrada.');
    if (solicitud.status !== 'PENDING') return conflict('Esa solicitud ya fue resuelta.');
    const datos = cuerpo<{
      items: { itemId: string; decision: 'APPROVED' | 'ADJUSTED' | 'REJECTED'; actions?: unknown; comment?: string }[];
      reasonText?: string;
    }>(request);
    const veredictos = datos.items ?? [];
    for (const item of solicitud.items) {
      const v = veredictos.find((x) => x.itemId === item.id);
      if (v === undefined) return validation('Falta decidir un ítem de la solicitud.', [{ field: 'items', message: 'cada ítem necesita su decisión' }]);
      if (!['APPROVED', 'ADJUSTED', 'REJECTED'].includes(v.decision)) return validation('Decisión no válida.', [{ field: 'items', message: 'decisión no válida' }]);
      if (v.decision === 'ADJUSTED' && accionesValidas(v.actions) === null) {
        return validation('Un ítem ajustado necesita las acciones que sí se conceden.', [{ field: 'items', message: 'faltan las acciones del ajuste' }]);
      }
      if (v.decision === 'REJECTED' && (v.comment ?? '').trim() === '' && (datos.reasonText ?? '').trim() === '') {
        return validation('Para rechazar, escriba el motivo.', [{ field: 'items', message: 'el rechazo necesita motivo' }]);
      }
    }

    let vinculo =
      solicitud.parentEngagementId === undefined
        ? vinculos.filtrar((v) => v.userId === solicitud.requesterUserId && v.tenantId === solicitud.tenantId && v.status === 'ACTIVE')[0]
        : vinculos.get(solicitud.parentEngagementId);
    const aprobados = veredictos.filter((v) => v.decision !== 'REJECTED');
    if (vinculo === undefined && aprobados.length > 0) {
      vinculo = vinculos.agregar({
        id: nuevoId('vinculo'),
        tenantId: solicitud.tenantId,
        ownerKind: solicitud.tenantId === TENANT_CESPEDES ? 'PRIVATE_PRACTICE' : 'ORGANIZATION',
        userId: solicitud.requesterUserId,
        personName: solicitud.requesterName,
        personEmail: '',
        roleTemplate: solicitud.roleTemplate,
        status: 'ACTIVE',
        origin: 'REQUEST',
        validFrom: ahora(),
        recertifyEveryMonths: 12,
        nextRecertificationAt: iso(365),
      });
    }

    const items = solicitud.items.map((item) => {
      const v = veredictos.find((x) => x.itemId === item.id)!;
      if (v.decision === 'REJECTED' || vinculo === undefined) {
        return { ...item, decision: 'REJECTED' as const, ...(v.comment === undefined || v.comment === '' ? {} : { decisionComment: v.comment }) };
      }
      const acciones = v.decision === 'ADJUSTED' ? accionesValidas(v.actions)! : item.proposedActions;
      const permiso = otorgar(vinculo, soloObjetivo(item), acciones, 'DYNAMIC');
      return {
        ...item,
        decision: v.decision,
        resultingGrantId: permiso.id,
        ...(v.comment === undefined || v.comment === '' ? {} : { decisionComment: v.comment }),
      };
    });
    const aprobadas = items.filter((i) => i.decision !== 'REJECTED').length;
    const estado = aprobadas === items.length ? 'APPROVED' : aprobadas === 0 ? 'REJECTED' : 'PARTIAL';
    const actualizada = solicitudes.actualizar(solicitud.id, {
      status: estado,
      items,
      decidedAt: ahora(),
      ...(datos.reasonText === undefined || datos.reasonText === '' ? {} : { decisionReason: datos.reasonText }),
    })!;
    anotar(
      acceso.tenantId,
      TENANT_NAMES[acceso.tenantId] ?? 'La organización',
      'request.decided',
      estado === 'REJECTED'
        ? `Se rechazó la solicitud de ${solicitud.requesterName}.`
        : `Se resolvió la solicitud de ${solicitud.requesterName}: ${aprobadas} de ${items.length} aprobados.`,
    );
    // `EngagementDecisionResultDto`: cómo quedó, no la solicitud.
    return {
      requestId: actualizada.id,
      status: actualizada.status,
      ...(vinculo === undefined ? {} : { engagementId: vinculo.id }),
      grantIds: actualizada.items.flatMap((i) => (i.resultingGrantId === undefined ? [] : [i.resultingGrantId])),
    };
  });

  const alcanzarVinculo = (request: MockRequest): { tenantId: string; vinculo: FilaVinculo } | MockReply => {
    const acceso = soloOrganizacion(request);
    if (esRespuesta(acceso)) return acceso;
    const vinculo = vinculos.get(request.params['id']!);
    if (vinculo === undefined || vinculo.tenantId !== acceso.tenantId) return notFound('Vínculo no encontrado.');
    return { tenantId: acceso.tenantId, vinculo };
  };
  const esFallo = (valor: { tenantId: string; vinculo: FilaVinculo } | MockReply): valor is MockReply => 'status' in valor;

  router.get('/org/support-engagements/:id/grants', (request) => {
    const alcance = alcanzarVinculo(request);
    if (esFallo(alcance)) return alcance;
    return permisos.filtrar((p) => p.engagementId === alcance.vinculo.id && p.status === 'ACTIVE').map((p) => vistaPermiso(p, alcance.tenantId));
  });

  router.post('/org/support-engagements/:id/grants', (request) => {
    const alcance = alcanzarVinculo(request);
    if (esFallo(alcance)) return alcance;
    const datos = cuerpo<Partial<SupportScopeTarget> & { actions?: unknown; expansionMode?: string }>(request);
    const acciones = accionesValidas(datos.actions);
    if (!objetivoValido(datos) || acciones === null) {
      return validation('El permiso necesita su objetivo y al menos una acción.', [{ field: 'actions', message: 'elija al menos una acción' }]);
    }
    if (alcance.vinculo.status !== 'ACTIVE') return preconditionFailed('El vínculo no está activo.');
    const objetivo = soloObjetivo(datos);
    const repetido = permisos.filtrar((p) => p.engagementId === alcance.vinculo.id && p.status === 'ACTIVE' && targetKey(p) === targetKey(objetivo))[0];
    if (repetido !== undefined) return conflict('Esa persona ya tiene un permiso con ese mismo objetivo: edítelo en vez de crear otro.');
    const fila = otorgar(alcance.vinculo, objetivo, acciones, datos.expansionMode === 'FIXED' ? 'FIXED' : 'DYNAMIC');
    anotar(alcance.tenantId, TENANT_NAMES[alcance.tenantId] ?? 'La organización', 'grant.created', `Se agregó un permiso a ${alcance.vinculo.personName}.`);
    // `ResourceCreatedDto`: el id y el estado.
    return { status: 201, body: { id: fila.id, status: 'ACTIVE' } };
  });

  router.patch('/org/support-engagements/:id/grants', (request) => {
    const alcance = alcanzarVinculo(request);
    if (esFallo(alcance)) return alcance;
    const datos = cuerpo<{ grantId: string; actions?: unknown; expansionMode?: 'DYNAMIC' | 'FIXED'; validTo?: string | null; revoke?: boolean }>(request);
    const fila = permisos.get(datos.grantId ?? '');
    if (fila === undefined || fila.engagementId !== alcance.vinculo.id) return notFound('Permiso no encontrado.');
    if (datos.revoke === true) {
      permisos.actualizar(fila.id, { status: 'REVOKED' });
      anotar(alcance.tenantId, TENANT_NAMES[alcance.tenantId] ?? 'La organización', 'grant.revoked', `Se retiró un permiso a ${alcance.vinculo.personName}.`);
      return { ok: true };
    }
    let acciones = fila.actions;
    if (datos.actions !== undefined) {
      const validas = accionesValidas(datos.actions);
      if (validas === null) return validation('Elija al menos una acción.', [{ field: 'actions', message: 'elija al menos una acción' }]);
      acciones = validas;
    }
    permisos.actualizar(fila.id, {
      actions: acciones,
      ...(datos.expansionMode === undefined ? {} : { expansionMode: datos.expansionMode }),
    });
    anotar(alcance.tenantId, TENANT_NAMES[alcance.tenantId] ?? 'La organización', 'grant.updated', `Se cambió un permiso de ${alcance.vinculo.personName}.`);
    return { ok: true };
  });

  router.get('/org/access-lookup', (request) => {
    const acceso = soloOrganizacion(request);
    if (esRespuesta(acceso)) return acceso;
    const catalogo = catalogoDe(acceso.tenantId);
    const clave = (['doctor', 'service', 'location'] as const).find((k) => request.query.get(k) !== null);
    if (clave === undefined) return validation('Elija un doctor, un servicio o una ubicación.', [{ field: 'doctor', message: 'falta el objetivo de la consulta' }]);
    const contextos = contextosDeConsulta(catalogo, DOCTORES_POR_TENANT[acceso.tenantId] ?? [], clave, request.query.get(clave)!);
    const locations = indexLocations(catalogo.locations);
    const items: AccessLookupEntry[] = [];
    for (const v of vinculos.filtrar((x) => x.tenantId === acceso.tenantId && x.status === 'ACTIVE')) {
      const grants = permisosEfectivosDeVinculo(v.id);
      const acciones = new Set<SupportActionCode>();
      for (const c of contextos) for (const a of actionsFor(grants, c, locations)) acciones.add(a);
      if (acciones.size > 0) {
        items.push({ engagementId: v.id, personName: v.personName, roleTemplate: v.roleTemplate, actions: SUPPORT_ACTION_CODES.filter((a) => acciones.has(a)) });
      }
    }
    return { items: items.sort((a, b) => a.personName.localeCompare(b.personName, 'es')) };
  });

  router.post('/org/affiliation-invitations', (request) => {
    const acceso = soloOrganizacion(request);
    if (esRespuesta(acceso)) return acceso;
    const datos = cuerpo<{ kind: string; targetPersonId?: string; maxUses: number; expiresInDays: number; roleTemplateCode?: string }>(request);
    if (datos.kind !== 'PRACTITIONER' && datos.kind !== 'SUPPORT_STAFF') return validation('Elija a quién invita.', [{ field: 'kind', message: 'tipo no válido' }]);
    const usos = Number(datos.maxUses);
    const dias = Number(datos.expiresInDays);
    if (!Number.isInteger(usos) || usos < 1 || usos > 500) return validation('Los usos deben estar entre 1 y 500.', [{ field: 'maxUses', message: 'debe estar entre 1 y 500' }]);
    if (!Number.isInteger(dias) || dias < 1 || dias > 90) return validation('La vigencia debe estar entre 1 y 90 días.', [{ field: 'expiresInDays', message: 'debe estar entre 1 y 90' }]);
    if (datos.roleTemplateCode !== undefined && !PLANTILLAS.includes(datos.roleTemplateCode)) return validation('Rol no válido.', [{ field: 'roleTemplateCode', message: 'rol no válido' }]);
    // Un QR de doctor sin destino deja la solicitud en una práctica de la organización: sin práctica activa no tendría dónde aterrizar.
    if (datos.kind === 'PRACTITIONER' && datos.targetPersonId === undefined && PRACTICA_DE_LA_ORGANIZACION[acceso.tenantId] === undefined) {
      return preconditionFailed('La organización necesita una práctica activa para recibir solicitudes de médicos', { reason: 'SUPPORT_AFFILIATION_PRACTICE_MISSING' });
    }
    const fila = invitaciones.agregar({
      id: nuevoId('invitacion'),
      tenantId: acceso.tenantId,
      kind: datos.kind,
      code: codigoDeInvitacion(),
      ...(datos.targetPersonId === undefined ? {} : { targetPersonId: datos.targetPersonId }),
      maxUses: usos,
      usesCount: 0,
      expiresAt: iso(dias),
      ...(datos.roleTemplateCode === undefined ? {} : { roleTemplate: datos.roleTemplateCode as SupportRoleTemplateCode }),
      status: 'ACTIVE',
      createdAt: ahora(),
    });
    anotar(acceso.tenantId, TENANT_NAMES[acceso.tenantId] ?? 'La organización', 'invitation.created', `Se emitió una invitación ${datos.kind === 'PRACTITIONER' ? 'para doctores' : 'para personal de apoyo'}.`);
    return { status: 201, body: invitacionVisible(fila, true) };
  });

  router.get('/org/affiliation-invitations', (request) => {
    const acceso = soloOrganizacion(request);
    if (esRespuesta(acceso)) return acceso;
    return {
      items: invitaciones
        .filtrar((i) => i.tenantId === acceso.tenantId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((i) => invitacionVisible(i, false)),
    };
  });

  router.get('/org/support-activity', (request) => {
    const acceso = soloOrganizacion(request);
    if (esRespuesta(acceso)) return acceso;
    return paginaDeActividad(bitacora.filtrar((b) => b.tenantId === acceso.tenantId), request.query);
  });

  router.post('/org/support-engagements/:id/recertify', (request) => {
    const alcance = alcanzarVinculo(request);
    if (esFallo(alcance)) return alcance;
    // `RecertifyEngagementDto.recertifyEveryMonths` es opcional: sin él se repite el período del vínculo.
    const pedidos = cuerpo<{ recertifyEveryMonths: number }>(request).recertifyEveryMonths;
    const meses = pedidos === undefined ? alcance.vinculo.recertifyEveryMonths : Number(pedidos);
    if (meses !== 6 && meses !== 12) return validation('Elija 6 o 12 meses.', [{ field: 'recertifyEveryMonths', message: 'debe ser 6 o 12' }]);
    if (alcance.vinculo.status === 'ENDED') return conflict('Ese vínculo ya terminó: no se puede confirmar.');
    const estabaSuspendido = alcance.vinculo.status === 'SUSPENDED';
    const { suspendedAt: _s, ...vigente } = alcance.vinculo;
    vinculos.agregar({
      ...vigente,
      status: 'ACTIVE',
      recertifyEveryMonths: meses,
      nextRecertificationAt: iso(meses * 30),
      lastConfirmedAt: ahora(),
      lastConfirmedBy: 'ORGANIZATION',
    });
    const actualizado = vinculos.get(alcance.vinculo.id)!;
    anotar(
      alcance.tenantId,
      TENANT_NAMES[alcance.tenantId] ?? 'La organización',
      'engagement.recertified',
      estabaSuspendido
        ? `Se reactivó el vínculo de ${actualizado.personName} y se confirmó por ${meses} meses.`
        : `Se confirmó el vínculo de ${actualizado.personName} por ${meses} meses.`,
    );
    return { ok: true };
  });

  router.post('/org/support-engagements/:id/end', (request) => {
    const alcance = alcanzarVinculo(request);
    if (esFallo(alcance)) return alcance;
    // Primero se valida el cuerpo (400) y después el estado del vínculo (409), como la API.
    const motivo = cuerpo<{ reason?: string }>(request).reason;
    if (typeof motivo !== 'string') return validation('Falta el motivo.', [{ field: 'reason', message: 'debe ser un texto' }]);
    if (alcance.vinculo.status === 'ENDED') return conflict('Ese vínculo ya terminó.');
    // Revocación inmediata y automática. Las citas ya creadas se mantienen:
    // viven en la agenda del doctor, no en el vínculo.
    for (const p of permisos.filtrar((x) => x.engagementId === alcance.vinculo.id)) {
      permisos.actualizar(p.id, { status: 'REVOKED' });
    }
    for (const d of delegados.filtrar((x) => x.engagementId === alcance.vinculo.id)) {
      delegados.actualizar(d.id, { status: 'REVOKED' });
    }
    const terminado = vinculos.actualizar(alcance.vinculo.id, {
      status: 'ENDED',
      ...(motivo === undefined || motivo === '' ? {} : { endedReason: motivo }),
    })!;
    anotar(alcance.tenantId, TENANT_NAMES[alcance.tenantId] ?? 'La organización', 'engagement.ended', `Terminó el vínculo de ${terminado.personName}. Sus citas se mantienen y su gestión pasa a la recepción.`);
    return { ok: true };
  });

}
