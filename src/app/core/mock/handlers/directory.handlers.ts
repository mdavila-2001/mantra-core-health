import { reservas, recursos } from '../fixtures/agenda';
import { CARGO, ESTADO, TIPO_ORGANIZACION } from '../fixtures/conceptos';
import { afiliaciones, MEDICA, PROFESIONALES, profesionalPorId } from '../fixtures/personas';
import { notFound, type MockRequest, type MockRouter } from '../mock-router';
import { MOCK_USERS, TENANT_ASEGURADORA, TENANT_CLINICA, TENANT_CONSULTORIO, TENANT_FARMACIA, TENANT_HOSPITAL, TENANT_LABORATORIO, TENANT_NAMES, TENANT_PLATAFORMA } from '../mock-session';
import { ahora, Coleccion, contiene, cuerpo, iso, isoDia, nuevoId, paginar, texto, uuid } from '../mock-store';

/* ============================================================================
    Directorio de organizaciones (tenants): listado administrativo, mis
    organizaciones, sucursales, membresías, solicitudes de profesionales y
    la agenda de la organización.
    ========================================================================== */

interface TenantSimulado {
  readonly id: string;
  readonly code: string;
  readonly legalName: string;
  readonly tradeName: string;
  readonly tenantTypeConceptId: string;
  readonly statusConceptId: string;
  readonly verificationStatusConceptId: string;
  readonly parentTenantId: string | null;
  readonly createdAt: string;
  readonly timeZone: string;
}

export const ROL_TENANT = { OWNER: uuid('concept-tenant-role-owner'), ADMIN: uuid('concept-tenant-role-admin'), STAFF: uuid('concept-tenant-role-staff') } as const;
export const ALCANCE_ACCESO = { ALL_TENANT: uuid('concept-access-scope-all'), BRANCH: uuid('concept-access-scope-branch') } as const;
const TIPO_SUCURSAL = { CLINIC: uuid('concept-branch-clinic'), OFFICE: uuid('concept-branch-office') } as const;

const tenants = new Coleccion<TenantSimulado>([
  { id: TENANT_CONSULTORIO, code: 'ROJAS', legalName: 'Consultorio Dra. Valeria Rojas Mendoza', tradeName: 'Mi consultorio', tenantTypeConceptId: TIPO_ORGANIZACION['ORG-CLINICA']!, statusConceptId: ESTADO['ST-ACTIVE']!, verificationStatusConceptId: ESTADO['ST-VERIFIED']!, parentTenantId: null, createdAt: iso(-700), timeZone: 'America/La_Paz' },
  { id: TENANT_CLINICA, code: 'OLIVOS', legalName: 'Clínica Los Olivos S.R.L.', tradeName: 'Clínica Los Olivos', tenantTypeConceptId: TIPO_ORGANIZACION['ORG-CLINICA']!, statusConceptId: ESTADO['ST-ACTIVE']!, verificationStatusConceptId: ESTADO['ST-VERIFIED']!, parentTenantId: null, createdAt: iso(-900), timeZone: 'America/La_Paz' },
  { id: TENANT_HOSPITAL, code: 'SANLUCAS', legalName: 'Fundación Hospital San Lucas', tradeName: 'Hospital San Lucas', tenantTypeConceptId: TIPO_ORGANIZACION['ORG-HOSPITAL']!, statusConceptId: ESTADO['ST-ACTIVE']!, verificationStatusConceptId: ESTADO['ST-VERIFIED']!, parentTenantId: null, createdAt: iso(-800), timeZone: 'America/La_Paz' },
  { id: TENANT_FARMACIA, code: 'FARVIDA', legalName: 'Farmacia Vida S.A.', tradeName: 'Farmacia Vida', tenantTypeConceptId: TIPO_ORGANIZACION['ORG-FARMACIA']!, statusConceptId: ESTADO['ST-ACTIVE']!, verificationStatusConceptId: ESTADO['ST-VERIFIED']!, parentTenantId: null, createdAt: iso(-400), timeZone: 'America/La_Paz' },
  { id: TENANT_LABORATORIO, code: 'LABCEN', legalName: 'Laboratorio Central Ltda.', tradeName: 'Laboratorio Central', tenantTypeConceptId: TIPO_ORGANIZACION['ORG-LABORATORIO']!, statusConceptId: ESTADO['ST-ACTIVE']!, verificationStatusConceptId: ESTADO['ST-VERIFIED']!, parentTenantId: null, createdAt: iso(-350), timeZone: 'America/La_Paz' },
  { id: TENANT_ASEGURADORA, code: 'ANDINA', legalName: 'Seguros Andina S.A.', tradeName: 'Seguros Andina', tenantTypeConceptId: TIPO_ORGANIZACION['ORG-ASEGURADORA']!, statusConceptId: ESTADO['ST-ACTIVE']!, verificationStatusConceptId: ESTADO['ST-VERIFIED']!, parentTenantId: null, createdAt: iso(-300), timeZone: 'America/La_Paz' },
  { id: TENANT_PLATAFORMA, code: 'ALOVIDA', legalName: 'AloVida Plataforma S.R.L.', tradeName: 'AloVida', tenantTypeConceptId: TIPO_ORGANIZACION['ORG-CLINICA']!, statusConceptId: ESTADO['ST-ACTIVE']!, verificationStatusConceptId: ESTADO['ST-VERIFIED']!, parentTenantId: null, createdAt: iso(-1000), timeZone: 'America/La_Paz' },
  { id: uuid('tenant-olivos-norte'), code: 'OLIVOS-N', legalName: 'Clínica Los Olivos · Norte', tradeName: 'Los Olivos Norte', tenantTypeConceptId: TIPO_ORGANIZACION['ORG-CLINICA']!, statusConceptId: ESTADO['ST-ACTIVE']!, verificationStatusConceptId: ESTADO['ST-VERIFIED']!, parentTenantId: TENANT_CLINICA, createdAt: iso(-200), timeZone: 'America/La_Paz' },
  { id: uuid('tenant-clinica-nueva'), code: 'CLINUEVA', legalName: 'Clínica Nueva Esperanza S.R.L.', tradeName: 'Clínica Nueva Esperanza', tenantTypeConceptId: TIPO_ORGANIZACION['ORG-CLINICA']!, statusConceptId: ESTADO['ST-PENDING']!, verificationStatusConceptId: ESTADO['ST-PENDING']!, parentTenantId: null, createdAt: iso(-3), timeZone: 'America/La_Paz' },
]);

const sucursales = new Coleccion<{ id: string; tenantId: string; code: string; name: string; branchTypeConceptId: string; statusConceptId: string; timeZone: string; createdAt: string }>([
  { id: uuid('branch-olivos-central'), tenantId: TENANT_CLINICA, code: 'CENTRAL', name: 'Sede Central', branchTypeConceptId: TIPO_SUCURSAL.CLINIC, statusConceptId: ESTADO['ST-ACTIVE']!, timeZone: 'America/La_Paz', createdAt: iso(-900) },
  { id: uuid('branch-olivos-equipetrol'), tenantId: TENANT_CLINICA, code: 'EQUIP', name: 'Consultorios Equipetrol', branchTypeConceptId: TIPO_SUCURSAL.OFFICE, statusConceptId: ESTADO['ST-ACTIVE']!, timeZone: 'America/La_Paz', createdAt: iso(-400) },
  { id: uuid('branch-sanlucas-central'), tenantId: TENANT_HOSPITAL, code: 'CENTRAL', name: 'Hospital central', branchTypeConceptId: TIPO_SUCURSAL.CLINIC, statusConceptId: ESTADO['ST-ACTIVE']!, timeZone: 'America/La_Paz', createdAt: iso(-800) },
  { id: uuid('branch-sanlucas-norte'), tenantId: TENANT_HOSPITAL, code: 'NORTE', name: 'Anexo Norte', branchTypeConceptId: TIPO_SUCURSAL.CLINIC, statusConceptId: ESTADO['ST-ACTIVE']!, timeZone: 'America/La_Paz', createdAt: iso(-300) },
]);

const membresias = new Coleccion<{ id: string; tenantId: string; userId: string; tenantRoleConceptId: string; statusConceptId: string; accessScopeConceptId: string; primaryBranchId: string | null; startDate: string; endDate: string | null; createdAt: string }>([
  { id: uuid('membership-medica-consultorio'), tenantId: TENANT_CONSULTORIO, userId: MEDICA.userId, tenantRoleConceptId: ROL_TENANT.OWNER, statusConceptId: ESTADO['ST-ACTIVE']!, accessScopeConceptId: ALCANCE_ACCESO.ALL_TENANT, primaryBranchId: null, startDate: isoDia(-700), endDate: null, createdAt: iso(-700) },
  { id: uuid('membership-admin-olivos'), tenantId: TENANT_CLINICA, userId: MOCK_USERS[2]!.id, tenantRoleConceptId: ROL_TENANT.OWNER, statusConceptId: ESTADO['ST-ACTIVE']!, accessScopeConceptId: ALCANCE_ACCESO.ALL_TENANT, primaryBranchId: uuid('branch-olivos-central'), startDate: isoDia(-900), endDate: null, createdAt: iso(-900) },
  { id: uuid('membership-medica-olivos'), tenantId: TENANT_CLINICA, userId: MEDICA.userId, tenantRoleConceptId: ROL_TENANT.ADMIN, statusConceptId: ESTADO['ST-ACTIVE']!, accessScopeConceptId: ALCANCE_ACCESO.ALL_TENANT, primaryBranchId: uuid('branch-olivos-central'), startDate: isoDia(-800), endDate: null, createdAt: iso(-800) },
  ...PROFESIONALES.slice(1, 8).map((p, i) => ({ id: uuid(`membership-${p.id}`), tenantId: p.tenantId, userId: p.userId, tenantRoleConceptId: ROL_TENANT.STAFF, statusConceptId: i === 5 ? ESTADO['ST-INACTIVE']! : ESTADO['ST-ACTIVE']!, accessScopeConceptId: i % 2 === 0 ? ALCANCE_ACCESO.ALL_TENANT : ALCANCE_ACCESO.BRANCH, primaryBranchId: p.tenantId === TENANT_CLINICA ? uuid('branch-olivos-central') : uuid('branch-sanlucas-central'), startDate: isoDia(-500 + i * 30), endDate: i === 5 ? isoDia(-20) : null, createdAt: iso(-500 + i * 30) })),
  { id: uuid('membership-medica-sanlucas'), tenantId: TENANT_HOSPITAL, userId: MEDICA.userId, tenantRoleConceptId: ROL_TENANT.STAFF, statusConceptId: ESTADO['ST-ACTIVE']!, accessScopeConceptId: ALCANCE_ACCESO.BRANCH, primaryBranchId: uuid('branch-sanlucas-central'), startDate: isoDia(-300), endDate: null, createdAt: iso(-300) },
]);

const asignaciones = new Coleccion<{ id: string; membershipId: string; branchId: string; localRoleConceptId: string; statusConceptId: string; createdAt: string }>([
  { id: uuid('assign-1'), membershipId: uuid('membership-medica-olivos'), branchId: uuid('branch-olivos-central'), localRoleConceptId: CARGO['ROLE-JEFE']!, statusConceptId: ESTADO['ST-ACTIVE']!, createdAt: iso(-800) },
  { id: uuid('assign-2'), membershipId: uuid('membership-medica-olivos'), branchId: uuid('branch-olivos-equipetrol'), localRoleConceptId: CARGO['ROLE-MEDICO']!, statusConceptId: ESTADO['ST-ACTIVE']!, createdAt: iso(-400) },
]);

function organizacionPropia(t: TenantSimulado, request: MockRequest) {
  const user = request.user;
  const esAdmin = user?.roles.includes('SECURITY_ADMIN') || user?.roles.includes('SUPERADMIN') || ((t.id === TENANT_CLINICA || t.id === TENANT_CONSULTORIO) && user?.key === 'medica');
  return {
    ...t,
    parentTenantId: t.parentTenantId ?? undefined,
    myRoleConceptId: esAdmin ? ROL_TENANT.ADMIN : ROL_TENANT.STAFF,
    canAdminister: esAdmin ?? false,
    isVerified: t.verificationStatusConceptId === ESTADO['ST-VERIFIED'],
    ...(t.id === TENANT_ASEGURADORA ? { payer: { carrierCode: 'ANDINA', regulatorIdentifier: 'APS-0042', sigla: 'SA', address: 'Av. Arce N.º 2500, La Paz' } } : {}),
  };
}

export function registrarDirectorio(router: MockRouter): void {
  // Sustituye al `/admin/tenants` genérico de auth: acá está el modelo completo.
  router.get('/admin/tenants', ({ query }) => {
    // El cliente manda `q` y `status` (`DirectoryClient.searchTenants`); los
    // nombres largos quedan como respaldo.
    const q = texto(query, 'q') ?? texto(query, 'query');
    const status = texto(query, 'status') ?? texto(query, 'statusConceptId');
    const todos = tenants
      .todos()
      .filter((t) => contiene(t.legalName, q) || contiene(t.tradeName, q) || contiene(t.code, q))
      .filter((t) => status === null || t.statusConceptId === status)
      .map((t) => ({ ...t, parentTenantId: t.parentTenantId ?? undefined }));
    return paginar(todos, query, 25);
  });

  router.post('/admin/tenants', (request) => {
    const datos = cuerpo<{ code: string; legalName: string; tradeName?: string; tenantType?: string; timeZone?: string }>(request);
    const nuevo = tenants.agregar({
      id: nuevoId('tenant'),
      code: datos.code ?? 'NUEVO',
      legalName: datos.legalName ?? 'Organización nueva',
      tradeName: datos.tradeName ?? datos.legalName ?? 'Organización nueva',
      tenantTypeConceptId: datos.tenantType === 'PAYER' ? TIPO_ORGANIZACION['ORG-ASEGURADORA']! : datos.tenantType === 'PHARMACY' ? TIPO_ORGANIZACION['ORG-FARMACIA']! : datos.tenantType === 'HOSPITAL' ? TIPO_ORGANIZACION['ORG-HOSPITAL']! : TIPO_ORGANIZACION['ORG-CLINICA']!,
      statusConceptId: ESTADO['ST-PENDING']!,
      verificationStatusConceptId: ESTADO['ST-PENDING']!,
      parentTenantId: null,
      createdAt: ahora(),
      timeZone: datos.timeZone ?? 'America/La_Paz',
    });
    return { status: 201, body: { id: nuevo.id, code: nuevo.code, legalName: nuevo.legalName, status: 'PENDING', verificationStatus: 'PENDING', parentTenantId: null, createdAt: nuevo.createdAt } };
  });

  router.post('/admin/tenants/:id/verification', (request) => {
    const t = tenants.get(request.params['id']!);
    if (t === undefined) return notFound('Organización no encontrada');
    tenants.actualizar(t.id, { statusConceptId: ESTADO['ST-ACTIVE']!, verificationStatusConceptId: ESTADO['ST-VERIFIED']! });
    return { id: t.id, code: t.code, legalName: t.legalName, status: 'ACTIVE', verificationStatus: 'VERIFIED', parentTenantId: t.parentTenantId, createdAt: t.createdAt };
  });

  router.get('/tenants/me', (request) => {
    const user = request.user;
    const items = tenants
      .filtrar((t) => user !== null && (user.tenants.includes(t.id) || (user.key === 'medica' && t.parentTenantId === TENANT_CLINICA)))
      .map((t) => organizacionPropia(t, request));
    return { items };
  });

  router.get('/tenants/:id', ({ params }) => {
    const t = tenants.get(params['id']!);
    return t === undefined ? notFound('Organización no encontrada') : { ...t, parentTenantId: t.parentTenantId ?? undefined };
  });

  router.patch('/tenants/:id', (request) => {
    const t = tenants.get(request.params['id']!);
    if (t === undefined) return notFound('Organización no encontrada');
    const datos = cuerpo<{ legalName?: string; tradeName?: string; timeZone?: string }>(request);
    const actualizado = tenants.actualizar(t.id, { ...(datos.legalName === undefined ? {} : { legalName: datos.legalName }), ...(datos.tradeName === undefined ? {} : { tradeName: datos.tradeName }), ...(datos.timeZone === undefined ? {} : { timeZone: datos.timeZone }) })!;
    return { ...actualizado, parentTenantId: actualizado.parentTenantId ?? undefined };
  });

  router.get('/tenants/:id/child-tenants', ({ params, query }) =>
    paginar(tenants.filtrar((t) => t.parentTenantId === params['id']).map((t) => ({ ...t, parentTenantId: t.parentTenantId ?? undefined })), query, 25),
  );

  router.post('/tenants/:id/child-tenants', (request) => {
    const datos = cuerpo<{ code: string; legalName: string }>(request);
    const nuevo = tenants.agregar({
      id: nuevoId('tenant-hijo'),
      code: datos.code ?? 'HIJO',
      legalName: datos.legalName ?? 'Organización hija',
      tradeName: datos.legalName ?? 'Organización hija',
      tenantTypeConceptId: TIPO_ORGANIZACION['ORG-CLINICA']!,
      statusConceptId: ESTADO['ST-ACTIVE']!,
      verificationStatusConceptId: ESTADO['ST-PENDING']!,
      parentTenantId: request.params['id']!,
      createdAt: ahora(),
      timeZone: 'America/La_Paz',
    });
    return { status: 201, body: { id: nuevo.id, code: nuevo.code, legalName: nuevo.legalName, status: 'ACTIVE', verificationStatus: 'PENDING', parentTenantId: nuevo.parentTenantId, createdAt: nuevo.createdAt } };
  });

  router.get('/tenants/:id/branches', ({ params }) => {
    const items = sucursales.filtrar((s) => s.tenantId === params['id']).map(({ tenantId: _t, ...s }) => s);
    return { items, count: items.length };
  });

  router.post('/tenants/:id/branches', (request) => {
    const datos = cuerpo<{ code: string; name: string; branchType?: 'CLINIC' | 'OFFICE'; timeZone?: string }>(request);
    const nueva = sucursales.agregar({ id: nuevoId('branch'), tenantId: request.params['id']!, code: datos.code ?? 'SUC', name: datos.name ?? 'Sucursal', branchTypeConceptId: TIPO_SUCURSAL[datos.branchType ?? 'CLINIC'], statusConceptId: ESTADO['ST-ACTIVE']!, timeZone: datos.timeZone ?? 'America/La_Paz', createdAt: ahora() });
    const { tenantId: _t, ...resto } = nueva;
    return { status: 201, body: resto };
  });

  router.get('/tenants/:id/memberships', ({ params, query }) => {
    const status = texto(query, 'statusConceptId');
    const items = membresias
      .filtrar((m) => m.tenantId === params['id'])
      .filter((m) => status === null || m.statusConceptId === status)
      .map(({ tenantId: _t, ...m }) => m);
    return paginar(items, query, 25);
  });

  router.post('/tenants/:id/memberships', (request) => {
    const datos = cuerpo<{ userId: string; role?: 'OWNER' | 'ADMIN' | 'STAFF'; accessScope?: 'ALL_TENANT' | 'BRANCH'; primaryBranchId?: string }>(request);
    const nueva = membresias.agregar({ id: nuevoId('membership'), tenantId: request.params['id']!, userId: datos.userId ?? '', tenantRoleConceptId: ROL_TENANT[datos.role ?? 'STAFF'], statusConceptId: ESTADO['ST-ACTIVE']!, accessScopeConceptId: ALCANCE_ACCESO[datos.accessScope ?? 'ALL_TENANT'], primaryBranchId: datos.primaryBranchId ?? null, startDate: isoDia(0), endDate: null, createdAt: ahora() });
    const { tenantId: _t, ...resto } = nueva;
    return { status: 201, body: resto };
  });

  router.get('/tenants/:id/memberships/:membershipId/branch-assignments', ({ params }) => {
    const items = asignaciones.filtrar((a) => a.membershipId === params['membershipId']).map(({ membershipId: _m, ...a }) => a);
    return { items, count: items.length };
  });

  router.post('/tenants/:id/memberships/:membershipId/branch-assignments', (request) => {
    const datos = cuerpo<{ branchId: string; localRoleConceptId?: string }>(request);
    const nueva = asignaciones.agregar({ id: nuevoId('assign'), membershipId: request.params['membershipId']!, branchId: datos.branchId ?? '', localRoleConceptId: datos.localRoleConceptId ?? CARGO['ROLE-MEDICO']!, statusConceptId: ESTADO['ST-ACTIVE']!, createdAt: ahora() });
    const { membershipId: _m, ...resto } = nueva;
    return { status: 201, body: resto };
  });

  router.get('/tenants/:id/practitioner-requests', ({ params }) => {
    const nombre = TENANT_NAMES[params['id']!] ?? '';
    return afiliaciones
      .filtrar((a) => a.organizationName === nombre && a.statusKind === 'pendiente')
      .concat(
        params['id'] === TENANT_CLINICA
          ? [
              { id: uuid('req-pendiente-1'), practitionerProfileId: PROFESIONALES[13]!.id, organizationName: nombre, roleTitle: 'Médico de planta', practiceSiteId: null, affiliationTypeConceptId: null, startDate: isoDia(-2), endDate: null, current: true, status: 'PENDING', statusKind: 'pendiente' as const, decisionReasonText: null, createdAt: iso(-2) },
              { id: uuid('req-pendiente-2'), practitionerProfileId: PROFESIONALES[14]!.id, organizationName: nombre, roleTitle: 'Residente', practiceSiteId: null, affiliationTypeConceptId: null, startDate: isoDia(-1), endDate: null, current: true, status: 'PENDING', statusKind: 'pendiente' as const, decisionReasonText: null, createdAt: iso(-1) },
            ]
          : [],
      )
      .map((a) => {
        const p = profesionalPorId(a.practitionerProfileId);
        return { id: a.id, practitionerProfileId: a.practitionerProfileId, practitionerName: p?.displayName ?? null, practitionerLicense: p?.matricula ?? null, organizationName: a.organizationName, roleTitle: a.roleTitle ?? 'Profesional', practiceSiteId: a.practiceSiteId, startDate: a.startDate, statusConceptId: ESTADO['ST-PENDING']!, createdAt: a.createdAt };
      });
  });

  router.post('/tenants/:id/practitioner-requests/:affiliationId/approve', ({ params }) => {
    afiliaciones.actualizar(params['affiliationId']!, { status: 'APPROVED', statusKind: 'aprobado' });
    return { ok: true };
  });

  router.post('/tenants/:id/practitioner-requests/:affiliationId/reject', (request) => {
    const datos = cuerpo<{ reason?: string; reasonText?: string }>(request);
    afiliaciones.actualizar(request.params['affiliationId']!, { status: 'REJECTED', statusKind: 'rechazado', decisionReasonText: datos.reasonText ?? datos.reason ?? null });
    return { ok: true };
  });

  router.get('/tenants/:id/agenda', ({ params, query }) => {
    const from = texto(query, 'from');
    const to = texto(query, 'to');
    const practitionerProfileId = texto(query, 'practitionerProfileId');
    const limit = Number(query.get('limit') ?? 200) || 200;
    const recursosDelTenant = recursos.filtrar((r) => r.tenantId === params['id']);
    const items = reservas
      .todos()
      .filter((r) => recursosDelTenant.some((x) => x.id === r.resourceId))
      .filter((r) => (from === null || r.startAt >= from) && (to === null || r.startAt <= to))
      .map((r) => {
        const recurso = recursosDelTenant.find((x) => x.id === r.resourceId);
        return { bookingId: r.id, startAt: r.startAt, endAt: r.endAt, resourceId: r.resourceId, resourceName: recurso?.name ?? null, practitionerProfileId: recurso?.resourceRefId ?? null, patientProfileId: r.patientProfileId, patientName: r.patientName, statusConceptId: r.statusConceptId };
      })
      .filter((i) => practitionerProfileId === null || i.practitionerProfileId === practitionerProfileId)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    return { items: items.slice(0, limit), truncated: items.length > limit };
  });
}

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
tenants.persistirEn('mock.directory.tenants');
sucursales.persistirEn('mock.directory.sucursales');
membresias.persistirEn('mock.directory.membresias');
asignaciones.persistirEn('mock.directory.asignaciones');
