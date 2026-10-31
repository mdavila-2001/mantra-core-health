import { CATALOGOS_DE_APOYO, doctorPorVinculacion } from '../fixtures/support-staff';
import { forbidden, unauthorized, validation, type MockRequest, type MockRouter } from '../mock-router';
import { MOCK_USERS, TENANT_NAMES } from '../mock-session';
import { cuerpo, nuevoId, uuid } from '../mock-store';
import {
  administra,
  catalogoDe,
  cuentas,
  decidir,
  duplicado,
  fallo,
  lista,
  resolverObjetivo,
  SUPPORT_STAFF,
  tenantActivo,
  terminar,
  vinculoNuevo,
  vinculos,
  vista,
  type Objetivo,
  type Registro,
  type Vinculo,
} from './support-staff.store';

/* ============================================================================
    Personal de apoyo: la secretaria, su alta, la solicitud y aceptación con el
    hospital y con el doctor, y lo que ve después.

    Mismas rutas y formas que el contrato de la API (`claude/secretaria-alta-dev`).
    El estado y sus reglas viven en `support-staff.store.ts`.
    ========================================================================== */

const NO_TE_ESPERA = (): ReturnType<typeof fallo> =>
  fallo(422, 'Este vínculo no espera su respuesta', 'SUPPORT_LINK_NOT_AWAITING_YOU');

/** Quien entra como secretaria: el rol lo trae desde el alta. */
function secretaria(request: MockRequest) {
  const user = request.user;
  if (user === null) return { error: unauthorized('Sesión vencida') } as const;
  if (!user.roles.includes(SUPPORT_STAFF)) return { error: fallo(403, 'Su cuenta no es de personal de apoyo', 'SUPPORT_PROFILE_REQUIRED') } as const;
  return { user } as const;
}

/** El hospital activo, si lo administra. */
function hospital(request: MockRequest) {
  const tenantId = tenantActivo(request);
  if (tenantId === null || !administra(request, tenantId)) {
    return { error: fallo(403, 'Tiene que administrar el hospital', 'SUPPORT_ORGANIZATION_ADMIN_REQUIRED') } as const;
  }
  return { tenantId } as const;
}

/** El doctor que entra: su perfil profesional decide qué vínculos son suyos. */
function doctor(request: MockRequest) {
  const user = request.user;
  if (user === null) return { error: unauthorized('Sesión vencida') } as const;
  if (user.practitionerProfileId === undefined) return { error: forbidden('Solo para profesionales') } as const;
  return { user, hpid: user.practitionerProfileId } as const;
}

/** Crea los vínculos de una lista de objetivos, o el error del primero que no sirve. */
function crearVinculos(
  tenantId: string,
  persona: { readonly id: string; readonly displayName: string },
  objetivos: readonly Objetivo[],
  initiatedBy: NonNullable<Vinculo['initiatedBy']>,
  awaitingDe: (objetivo: Objetivo) => NonNullable<Vinculo['awaiting']>,
) {
  if (objetivos.length === 0 || objetivos.length > 50) {
    return { error: validation('Faltan objetivos', [{ field: 'items', message: 'Elija entre 1 y 50 doctores o pisos.' }]) } as const;
  }
  const nuevos: Registro[] = [];
  for (const objetivo of objetivos) {
    const resuelto = resolverObjetivo(tenantId, objetivo);
    if (resuelto === null) return { error: fallo(404, 'Ese doctor o piso no es del hospital', 'SUPPORT_TARGET_NOT_FOUND') } as const;
    const nuevo = vinculoNuevo(tenantId, persona, resuelto, initiatedBy, awaitingDe(objetivo));
    if (duplicado(nuevo) || nuevos.some((n) => n.targetName === nuevo.targetName && n.targetKind === nuevo.targetKind)) {
      return { error: fallo(409, 'Ya existe ese vínculo', 'SUPPORT_LINK_DUPLICATE') } as const;
    }
    nuevos.push(nuevo);
  }
  nuevos.forEach((v) => vinculos.agregar(v));
  return { creados: { status: 201, body: { id: nuevos[0]!.id, tenantId, items: nuevos.map(vista) } } } as const;
}

export function registrarPersonalDeApoyo(router: MockRouter): void {
  /* el alta ----------------------------------------------------------------------- */

  router.post('/iam/auth/register-support-staff', ({ body }) => {
    const datos = cuerpo<{ email?: string; nationalId?: string; name?: string; middleName?: string; lastName?: string; motherLastName?: string; password?: string }>({ body });
    if (!datos.email || !datos.nationalId || !datos.name || !datos.lastName || !datos.password) {
      return validation('Faltan datos obligatorios', [{ field: 'nationalId', message: 'Complete los datos obligatorios.' }]);
    }
    const email = datos.email.trim().toLocaleLowerCase('es');
    const nationalId = datos.nationalId.trim();
    const repetida = MOCK_USERS.some((u) => u.nationalId === nationalId) || cuentas.todos().some((c) => c.nationalId === nationalId);
    if (repetida) return fallo(409, 'Ya existe una cuenta con ese documento', 'NATIONAL_ID_ALREADY_REGISTERED');
    const id = nuevoId('user-apoyo');
    const nombre = [datos.name, datos.middleName, datos.lastName, datos.motherLastName].filter((p) => p !== undefined && p.trim() !== '').join(' ');
    const personId = uuid(`person-${id}`);
    cuentas.agregar({ id, key: `apoyo-${nationalId}`, email, nationalId, displayName: nombre, personId });
    return { status: 201, body: { userId: id, personId, supportProfileId: uuid(`apoyo-perfil-${id}`), role: SUPPORT_STAFF, emailVerificationSent: true } };
  });

  /* la secretaria ------------------------------------------------------------------ */

  router.get('/me/support-engagements', (request) => {
    const quien = secretaria(request);
    if ('error' in quien) return quien.error;
    const { items } = lista(vinculos.filtrar((v) => v.userId === quien.user.id));
    return { items, count: items.length, requests: items.filter((v) => v.status === 'PENDING') };
  });

  router.get('/me/support-access', (request) => {
    const quien = secretaria(request);
    if ('error' in quien) return quien.error;
    const activos = vinculos.filtrar((v) => v.userId === quien.user.id && v.status === 'ACTIVE');
    const tenants = [...new Set(activos.map((v) => v.tenantId))].map((tenantId) => {
      const delHospital = activos.filter((v) => v.tenantId === tenantId);
      const ids = (campo: 'practiceSiteId' | 'clinicalUnitId' | 'careSpaceId', tipo: Vinculo['targetKind']) =>
        delHospital.filter((v) => v.targetKind === tipo && v[campo] !== null).map((v) => v[campo]!);
      // Sin membresía del hospital (sólo un doctor la aceptó) no hay pisos ni sedes: sólo sus doctores.
      const organizationAccess = delHospital.some((v) => v.viaHospital);
      if (!organizationAccess) {
        return {
          tenantId,
          organizationName: TENANT_NAMES[tenantId] ?? null,
          wholeOrganization: false,
          organizationAccess,
          practiceSiteIds: [],
          clinicalUnitIds: [],
          careSpaceIds: [],
          practitioners: delHospital
            .filter((v) => v.targetKind === 'PRACTITIONER')
            .map((v) => ({ linkId: v.id, practitionerRoleAssignmentId: v.practitionerRoleAssignmentId, practitionerProfileId: v.practitionerProfileId, name: v.targetName })),
        };
      }
      return {
        tenantId,
        organizationName: TENANT_NAMES[tenantId] ?? null,
        wholeOrganization: delHospital.some((v) => v.targetKind === 'ORGANIZATION'),
        organizationAccess,
        practiceSiteIds: ids('practiceSiteId', 'SITE'),
        clinicalUnitIds: ids('clinicalUnitId', 'SERVICE'),
        careSpaceIds: ids('careSpaceId', 'SPACE'),
        practitioners: delHospital
          .filter((v) => v.targetKind === 'PRACTITIONER')
          .map((v) => ({ linkId: v.id, practitionerRoleAssignmentId: v.practitionerRoleAssignmentId, practitionerProfileId: v.practitionerProfileId, name: v.targetName })),
      };
    });
    return { tenants };
  });

  router.get('/me/support-agenda', (request) => {
    const quien = secretaria(request);
    if ('error' in quien) return quien.error;
    const pra = request.query.get('practitionerRoleAssignmentId') ?? '';
    const tenantId = request.query.get('tenantId') ?? '';
    const vinculo = vinculos.filtrar(
      (v) => v.userId === quien.user.id && v.status === 'ACTIVE' && v.targetKind === 'PRACTITIONER' && v.practitionerRoleAssignmentId === pra && v.tenantId === tenantId,
    )[0];
    if (vinculo === undefined) return fallo(403, 'No trabaja con ese doctor', 'SUPPORT_SCOPE_DENIED');
    // La maqueta no cruza con `scheduling`: dos turnos de ejemplo dentro del rango pedido.
    const desde = new Date(request.query.get('from') ?? new Date().toISOString());
    const turno = (horas: number, paciente: string, i: number) => {
      const inicio = new Date(desde.getTime() + horas * 3_600_000);
      return {
        bookingId: uuid(`apoyo-turno-${vinculo.id}-${i}`),
        startAt: inicio.toISOString(),
        endAt: new Date(inicio.getTime() + 30 * 60_000).toISOString(),
        statusCode: 'BOOKED',
        patientProfileId: uuid(`apoyo-paciente-${i}`),
        patientName: paciente,
      };
    };
    const items = [turno(9, 'Ana Lucía Pérez Quiroga', 1), turno(10, 'Jorge Mamani Choque', 2)];
    return { items, count: items.length };
  });

  router.get('/me/support-catalog', (request) => {
    const quien = secretaria(request);
    if ('error' in quien) return quien.error;
    const org = request.query.get('org') ?? '';
    if (CATALOGOS_DE_APOYO[org] === undefined) return fallo(404, 'Organización no encontrada', 'SUPPORT_ORGANIZATION_NOT_FOUND');
    return catalogoDe(org);
  });

  router.post('/support-engagement-requests', (request) => {
    const quien = secretaria(request);
    if ('error' in quien) return quien.error;
    const datos = cuerpo<{ tenantId?: string; items?: Objetivo[] }>(request);
    const tenantId = datos.tenantId ?? '';
    if (CATALOGOS_DE_APOYO[tenantId] === undefined) return fallo(404, 'Organización no encontrada', 'SUPPORT_ORGANIZATION_NOT_FOUND');
    // Lo que pide a un doctor lo acepta el doctor (o el hospital); el resto, el hospital.
    const hecho = crearVinculos(tenantId, quien.user, datos.items ?? [], 'SUPPORT_STAFF', (o) => (o.targetKind === 'PRACTITIONER' ? 'PRACTITIONER' : 'ORGANIZATION'));
    return 'error' in hecho ? hecho.error : hecho.creados;
  });

  const propio = (request: MockRequest, accion: (v: Registro) => Vinculo | null) => {
    const quien = secretaria(request);
    if ('error' in quien) return quien.error;
    const vinculo = vinculos.get(request.params['id'] ?? '');
    if (vinculo === undefined || vinculo.userId !== quien.user.id) return fallo(404, 'Vínculo no encontrado', 'SUPPORT_LINK_NOT_FOUND');
    return accion(vinculo) ?? NO_TE_ESPERA();
  };

  router.post('/me/support-engagements/:id/confirm', (request) => propio(request, (v) => decidir(v.id, 'SUPPORT_STAFF', 'ACTIVE')));
  router.post('/me/support-engagements/:id/decline', (request) => propio(request, (v) => decidir(v.id, 'SUPPORT_STAFF', 'REJECTED')));
  router.post('/me/support-engagements/:id/leave', (request) =>
    propio(request, (v) => (v.status === 'ACTIVE' || v.status === 'PENDING' ? terminar(v.id) : null)),
  );

  /* el hospital --------------------------------------------------------------------- */

  router.get('/org/support-catalog', (request) => {
    const activo = hospital(request);
    return 'error' in activo ? activo.error : catalogoDe(activo.tenantId);
  });

  router.get('/org/support-engagement-requests', (request) => {
    const activo = hospital(request);
    if ('error' in activo) return activo.error;
    const estado = request.query.get('status') ?? 'PENDING';
    return lista(vinculos.filtrar((v) => v.tenantId === activo.tenantId && v.status === estado));
  });

  router.post('/org/support-engagement-requests/:id/decision', (request) => {
    const activo = hospital(request);
    if ('error' in activo) return activo.error;
    const vinculo = vinculos.get(request.params['id'] ?? '');
    if (vinculo === undefined || vinculo.tenantId !== activo.tenantId) return fallo(404, 'Vínculo no encontrado', 'SUPPORT_LINK_NOT_FOUND');
    const datos = cuerpo<{ decision?: string }>(request);
    if (datos.decision !== 'APPROVED' && datos.decision !== 'REJECTED') {
      return validation('Decisión inválida', [{ field: 'decision', message: 'Acepte o rechace.' }]);
    }
    // Lo que pidió a un doctor lo puede decidir también el hospital.
    return decidir(vinculo.id, 'ORGANIZATION', datos.decision === 'APPROVED' ? 'ACTIVE' : 'REJECTED') ?? NO_TE_ESPERA();
  });

  router.get('/org/support-engagements', (request) => {
    const activo = hospital(request);
    if ('error' in activo) return activo.error;
    return lista(vinculos.filtrar((v) => v.tenantId === activo.tenantId && (v.status === 'ACTIVE' || v.status === 'PENDING')));
  });

  router.post('/org/support-engagements/:id/end', (request) => {
    const activo = hospital(request);
    if ('error' in activo) return activo.error;
    const vinculo = vinculos.get(request.params['id'] ?? '');
    if (vinculo === undefined || vinculo.tenantId !== activo.tenantId) return fallo(404, 'Vínculo no encontrado', 'SUPPORT_LINK_NOT_FOUND');
    return terminar(vinculo.id);
  });

  router.post('/org/team/invitations', (request) => {
    const activo = hospital(request);
    if ('error' in activo) return activo.error;
    const datos = cuerpo<{ nationalId?: string; items?: Objetivo[] }>(request);
    const cuenta = cuentas.todos().find((c) => c.nationalId === (datos.nationalId ?? '').trim());
    if (cuenta === undefined) return fallo(404, 'No hay personal de apoyo con ese documento', 'SUPPORT_STAFF_NOT_FOUND');
    const hecho = crearVinculos(activo.tenantId, cuenta, datos.items ?? [], 'ORGANIZATION', () => 'SUPPORT_STAFF');
    return 'error' in hecho ? hecho.error : hecho.creados;
  });

  /* el doctor ---------------------------------------------------------------------- */

  router.get('/me/practitioner/support-team', (request) => {
    const quien = doctor(request);
    if ('error' in quien) return quien.error;
    return lista(
      vinculos.filtrar(
        (v) => v.practitionerProfileId === quien.hpid && v.targetKind === 'PRACTITIONER' && (v.status === 'ACTIVE' || v.status === 'PENDING'),
      ),
    );
  });

  const delDoctor = (request: MockRequest, accion: (v: Registro) => Vinculo | null) => {
    const quien = doctor(request);
    if ('error' in quien) return quien.error;
    const vinculo = vinculos.get(request.params['id'] ?? '');
    if (vinculo === undefined || vinculo.practitionerProfileId !== quien.hpid) return fallo(404, 'Vínculo no encontrado', 'SUPPORT_LINK_NOT_FOUND');
    return accion(vinculo) ?? NO_TE_ESPERA();
  };

  router.post('/practitioner-delegates/:id/accept', (request) => delDoctor(request, (v) => decidir(v.id, 'PRACTITIONER', 'ACTIVE')));
  router.post('/practitioner-delegates/:id/reject', (request) => delDoctor(request, (v) => decidir(v.id, 'PRACTITIONER', 'REJECTED')));
  router.post('/me/practitioner/support-team/:id/end', (request) =>
    delDoctor(request, (v) => (v.status === 'ACTIVE' ? terminar(v.id) : null)),
  );

  router.post('/me/practitioner/support-invitations', (request) => {
    const quien = doctor(request);
    if ('error' in quien) return quien.error;
    const datos = cuerpo<{ nationalId?: string; practitionerRoleAssignmentId?: string }>(request);
    const vinculacion = doctorPorVinculacion(datos.practitionerRoleAssignmentId ?? '');
    if (vinculacion === undefined || vinculacion.doctor.practitionerProfileId !== quien.hpid) {
      return fallo(404, 'Esa vinculación no es suya', 'SUPPORT_TARGET_NOT_FOUND');
    }
    const cuenta = cuentas.todos().find((c) => c.nationalId === (datos.nationalId ?? '').trim());
    if (cuenta === undefined) return fallo(404, 'No hay personal de apoyo con ese documento', 'SUPPORT_STAFF_NOT_FOUND');
    const hecho = crearVinculos(
      vinculacion.tenantId,
      cuenta,
      [{ targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: vinculacion.doctor.id }],
      'PRACTITIONER',
      () => 'SUPPORT_STAFF',
    );
    return 'error' in hecho ? hecho.error : hecho.creados;
  });
}
