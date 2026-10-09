import { reservas, recursos } from '../fixtures/agenda';
import { CARGO, STATUS, ORGANIZATION_TYPE } from '../fixtures/concepts';
import { affiliationList, MEDICAL, PROFESSIONALS, professionalById } from '../fixtures/people';
import {
  conflict,
  forbidden,
  notFound,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import {
  IDS,
  MOCK_USERS,
  TENANT_ASEGURADORA,
  TENANT_CLINICA,
  TENANT_CONSULTORIO,
  TENANT_FARMACIA,
  TENANT_HOSPITAL,
  TENANT_LABORATORIO,
  TENANT_NAMES,
  TENANT_PLATAFORMA,
} from '../mock-session';
import {
  ahora,
  Coleccion,
  contiene,
  cuerpo,
  iso,
  isoDia,
  nuevoId,
  paginar,
  texto,
  uuid,
} from '../mock-store';

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

export const ROL_TENANT = {
  OWNER: uuid('concept-tenant-role-owner'),
  ADMIN: uuid('concept-tenant-role-admin'),
  STAFF: uuid('concept-tenant-role-staff'),
} as const;
export const ALCANCE_ACCESO = {
  ALL_TENANT: uuid('concept-access-scope-all'),
  BRANCH: uuid('concept-access-scope-branch'),
} as const;
const TIPO_SUCURSAL = {
  CLINIC: uuid('concept-branch-clinic'),
  OFFICE: uuid('concept-branch-office'),
} as const;

const tenants = new Coleccion<TenantSimulado>([
  {
    id: TENANT_CONSULTORIO,
    code: 'ROJAS',
    legalName: 'Consultorio Dra. Valeria Rojas Mendoza',
    tradeName: 'Mi consultorio',
    tenantTypeConceptId: ORGANIZATION_TYPE['ORG-CLINICA']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    verificationStatusConceptId: STATUS['ST-VERIFIED']!,
    parentTenantId: null,
    createdAt: iso(-700),
    timeZone: 'America/La_Paz',
  },
  {
    id: TENANT_CLINICA,
    code: 'OLIVOS',
    legalName: 'Clínica Los Olivos S.R.L.',
    tradeName: 'Clínica Los Olivos',
    tenantTypeConceptId: ORGANIZATION_TYPE['ORG-CLINICA']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    verificationStatusConceptId: STATUS['ST-VERIFIED']!,
    parentTenantId: null,
    createdAt: iso(-900),
    timeZone: 'America/La_Paz',
  },
  {
    id: TENANT_HOSPITAL,
    code: 'SANLUCAS',
    legalName: 'Fundación Hospital San Lucas',
    tradeName: 'Hospital San Lucas',
    tenantTypeConceptId: ORGANIZATION_TYPE['ORG-HOSPITAL']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    verificationStatusConceptId: STATUS['ST-VERIFIED']!,
    parentTenantId: null,
    createdAt: iso(-800),
    timeZone: 'America/La_Paz',
  },
  {
    id: TENANT_FARMACIA,
    code: 'FARVIDA',
    legalName: 'Farmacia Vida S.A.',
    tradeName: 'Farmacia Vida',
    tenantTypeConceptId: ORGANIZATION_TYPE['ORG-FARMACIA']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    verificationStatusConceptId: STATUS['ST-VERIFIED']!,
    parentTenantId: null,
    createdAt: iso(-400),
    timeZone: 'America/La_Paz',
  },
  {
    id: TENANT_LABORATORIO,
    code: 'LABCEN',
    legalName: 'Laboratorio Central Ltda.',
    tradeName: 'Laboratorio Central',
    tenantTypeConceptId: ORGANIZATION_TYPE['ORG-LABORATORIO']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    verificationStatusConceptId: STATUS['ST-VERIFIED']!,
    parentTenantId: null,
    createdAt: iso(-350),
    timeZone: 'America/La_Paz',
  },
  {
    id: TENANT_ASEGURADORA,
    code: 'ANDINA',
    legalName: 'Seguros Andina S.A.',
    tradeName: 'Seguros Andina',
    tenantTypeConceptId: ORGANIZATION_TYPE['ORG-ASEGURADORA']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    verificationStatusConceptId: STATUS['ST-VERIFIED']!,
    parentTenantId: null,
    createdAt: iso(-300),
    timeZone: 'America/La_Paz',
  },
  {
    id: TENANT_PLATAFORMA,
    code: 'ALOVIDA',
    legalName: 'AloVida Plataforma S.R.L.',
    tradeName: 'AloVida',
    tenantTypeConceptId: ORGANIZATION_TYPE['ORG-CLINICA']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    verificationStatusConceptId: STATUS['ST-VERIFIED']!,
    parentTenantId: null,
    createdAt: iso(-1000),
    timeZone: 'America/La_Paz',
  },
  {
    id: uuid('tenant-olivos-norte'),
    code: 'OLIVOS-N',
    legalName: 'Clínica Los Olivos · Norte',
    tradeName: 'Los Olivos Norte',
    tenantTypeConceptId: ORGANIZATION_TYPE['ORG-CLINICA']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    verificationStatusConceptId: STATUS['ST-VERIFIED']!,
    parentTenantId: TENANT_CLINICA,
    createdAt: iso(-200),
    timeZone: 'America/La_Paz',
  },
  {
    id: uuid('tenant-clinica-nueva'),
    code: 'CLINUEVA',
    legalName: 'Clínica Nueva Esperanza S.R.L.',
    tradeName: 'Clínica Nueva Esperanza',
    tenantTypeConceptId: ORGANIZATION_TYPE['ORG-CLINICA']!,
    statusConceptId: STATUS['ST-PENDING']!,
    verificationStatusConceptId: STATUS['ST-PENDING']!,
    parentTenantId: null,
    createdAt: iso(-3),
    timeZone: 'America/La_Paz',
  },
]);

const sucursales = new Coleccion<{
  id: string;
  tenantId: string;
  code: string;
  name: string;
  branchTypeConceptId: string;
  statusConceptId: string;
  timeZone: string;
  createdAt: string;
  // Lo que la carga masiva de sucursales suma y la API todavía no guarda
  // (`PENDIENTES-BACKEND.md`, P54). Opcionales: las sembradas no los traen.
  latitude?: number;
  longitude?: number;
  description?: string;
  locationUrl?: string;
}>([
  {
    id: uuid('branch-olivos-central'),
    tenantId: TENANT_CLINICA,
    code: 'CENTRAL',
    name: 'Sede Central',
    branchTypeConceptId: TIPO_SUCURSAL.CLINIC,
    statusConceptId: STATUS['ST-ACTIVE']!,
    timeZone: 'America/La_Paz',
    createdAt: iso(-900),
  },
  {
    id: uuid('branch-olivos-equipetrol'),
    tenantId: TENANT_CLINICA,
    code: 'EQUIP',
    name: 'Consultorios Equipetrol',
    branchTypeConceptId: TIPO_SUCURSAL.OFFICE,
    statusConceptId: STATUS['ST-ACTIVE']!,
    timeZone: 'America/La_Paz',
    createdAt: iso(-400),
  },
  {
    id: uuid('branch-sanlucas-central'),
    tenantId: TENANT_HOSPITAL,
    code: 'CENTRAL',
    name: 'Hospital central',
    branchTypeConceptId: TIPO_SUCURSAL.CLINIC,
    statusConceptId: STATUS['ST-ACTIVE']!,
    timeZone: 'America/La_Paz',
    createdAt: iso(-800),
  },
  {
    id: uuid('branch-sanlucas-norte'),
    tenantId: TENANT_HOSPITAL,
    code: 'NORTE',
    name: 'Anexo Norte',
    branchTypeConceptId: TIPO_SUCURSAL.CLINIC,
    statusConceptId: STATUS['ST-ACTIVE']!,
    timeZone: 'America/La_Paz',
    createdAt: iso(-300),
  },
]);

const membresias = new Coleccion<{
  id: string;
  tenantId: string;
  userId: string;
  tenantRoleConceptId: string;
  statusConceptId: string;
  accessScopeConceptId: string;
  primaryBranchId: string | null;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}>([
  {
    id: uuid('membership-admin-olivos'),
    tenantId: TENANT_CLINICA,
    userId: MOCK_USERS[2]!.id,
    tenantRoleConceptId: ROL_TENANT.OWNER,
    statusConceptId: STATUS['ST-ACTIVE']!,
    accessScopeConceptId: ALCANCE_ACCESO.ALL_TENANT,
    primaryBranchId: uuid('branch-olivos-central'),
    startDate: isoDia(-900),
    endDate: null,
    createdAt: iso(-900),
  },
  {
    id: uuid('membership-medica-olivos'),
    tenantId: TENANT_CLINICA,
    userId: MEDICAL.userId,
    tenantRoleConceptId: ROL_TENANT.ADMIN,
    statusConceptId: STATUS['ST-ACTIVE']!,
    accessScopeConceptId: ALCANCE_ACCESO.ALL_TENANT,
    primaryBranchId: uuid('branch-olivos-central'),
    startDate: isoDia(-800),
    endDate: null,
    createdAt: iso(-800),
  },
  ...PROFESSIONALS.slice(1, 8).map((p, i) => ({
    id: uuid(`membership-${p.id}`),
    tenantId: p.tenantId,
    userId: p.userId,
    tenantRoleConceptId: ROL_TENANT.STAFF,
    statusConceptId: i === 5 ? STATUS['ST-INACTIVE']! : STATUS['ST-ACTIVE']!,
    accessScopeConceptId: i % 2 === 0 ? ALCANCE_ACCESO.ALL_TENANT : ALCANCE_ACCESO.BRANCH,
    primaryBranchId:
      p.tenantId === TENANT_CLINICA
        ? uuid('branch-olivos-central')
        : uuid('branch-sanlucas-central'),
    startDate: isoDia(-500 + i * 30),
    endDate: i === 5 ? isoDia(-20) : null,
    createdAt: iso(-500 + i * 30),
  })),
  {
    id: uuid('membership-medica-sanlucas'),
    tenantId: TENANT_HOSPITAL,
    userId: MEDICAL.userId,
    tenantRoleConceptId: ROL_TENANT.STAFF,
    statusConceptId: STATUS['ST-ACTIVE']!,
    accessScopeConceptId: ALCANCE_ACCESO.BRANCH,
    primaryBranchId: uuid('branch-sanlucas-central'),
    startDate: isoDia(-300),
    endDate: null,
    createdAt: iso(-300),
  },
  {
    id: uuid('membership-aseguradora-owner'),
    tenantId: TENANT_ASEGURADORA,
    userId: IDS.aseguradora.userId,
    tenantRoleConceptId: ROL_TENANT.OWNER,
    statusConceptId: STATUS['ST-ACTIVE']!,
    accessScopeConceptId: ALCANCE_ACCESO.ALL_TENANT,
    primaryBranchId: null,
    startDate: isoDia(-300),
    endDate: null,
    createdAt: iso(-300),
  },
  {
    id: uuid('membership-aseguradora-staff'),
    tenantId: TENANT_ASEGURADORA,
    userId: IDS.aseguradoraStaff.userId,
    tenantRoleConceptId: ROL_TENANT.STAFF,
    statusConceptId: STATUS['ST-ACTIVE']!,
    accessScopeConceptId: ALCANCE_ACCESO.ALL_TENANT,
    primaryBranchId: null,
    startDate: isoDia(-120),
    endDate: null,
    createdAt: iso(-120),
  },
  // La cuenta de una farmacia o de un laboratorio **es** la organización: su titular es el
  // dueño. Sin esta membresía `canAdminister` daba falso y nadie podía cargar el logo.
  {
    id: uuid('membership-farmacia-owner'),
    tenantId: TENANT_FARMACIA,
    userId: IDS.farmacia.userId,
    tenantRoleConceptId: ROL_TENANT.OWNER,
    statusConceptId: STATUS['ST-ACTIVE']!,
    accessScopeConceptId: ALCANCE_ACCESO.ALL_TENANT,
    primaryBranchId: null,
    startDate: isoDia(-200),
    endDate: null,
    createdAt: iso(-200),
  },
  {
    id: uuid('membership-laboratorio-owner'),
    tenantId: TENANT_LABORATORIO,
    userId: IDS.laboratorio.userId,
    tenantRoleConceptId: ROL_TENANT.OWNER,
    statusConceptId: STATUS['ST-ACTIVE']!,
    accessScopeConceptId: ALCANCE_ACCESO.ALL_TENANT,
    primaryBranchId: null,
    startDate: isoDia(-200),
    endDate: null,
    createdAt: iso(-200),
  },
]);

const asignaciones = new Coleccion<{
  id: string;
  membershipId: string;
  branchId: string;
  localRoleConceptId: string;
  statusConceptId: string;
  createdAt: string;
}>([
  {
    id: uuid('assign-1'),
    membershipId: uuid('membership-medica-olivos'),
    branchId: uuid('branch-olivos-central'),
    localRoleConceptId: CARGO['ROLE-JEFE']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    createdAt: iso(-800),
  },
  {
    id: uuid('assign-2'),
    membershipId: uuid('membership-medica-olivos'),
    branchId: uuid('branch-olivos-equipetrol'),
    localRoleConceptId: CARGO['ROLE-MEDICO']!,
    statusConceptId: STATUS['ST-ACTIVE']!,
    createdAt: iso(-400),
  },
]);

/** El archivo que es el logo de cada organización, por id de tenant. Sin entrada = sin logo. */
const logosDeOrganizaciones = new Map<string, string | null>();

function organizacionPropia(t: TenantSimulado, request: MockRequest) {
  const user = request.user;
  const membresia =
    user === null
      ? undefined
      : membresias.filtrar(
          (m) =>
            m.tenantId === t.id &&
            m.userId === user.id &&
            m.statusConceptId === STATUS['ST-ACTIVE'],
        )[0];
  const esPlataforma = user?.roles.includes('SECURITY_ADMIN') || user?.roles.includes('SUPERADMIN');
  const esAdmin =
    esPlataforma ||
    membresia?.tenantRoleConceptId === ROL_TENANT.OWNER ||
    membresia?.tenantRoleConceptId === ROL_TENANT.ADMIN;
  return {
    ...t,
    parentTenantId: t.parentTenantId ?? undefined,
    myRoleConceptId:
      membresia?.tenantRoleConceptId ?? (esAdmin ? ROL_TENANT.ADMIN : ROL_TENANT.STAFF),
    canAdminister: esAdmin ?? false,
    isVerified: t.verificationStatusConceptId === STATUS['ST-VERIFIED'],
    ...(t.id === TENANT_ASEGURADORA
      ? {
          payer: {
            carrierCode: 'ANDINA',
            regulatorIdentifier: 'APS-0042',
            sigla: 'SA',
            address: 'Av. Arce N.º 2500, La Paz',
          },
        }
      : {}),
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
    const datos = cuerpo<{
      code: string;
      legalName: string;
      tradeName?: string;
      tenantType?: string;
      timeZone?: string;
    }>(request);
    const nuevo = tenants.agregar({
      id: nuevoId('tenant'),
      code: datos.code ?? 'NUEVO',
      legalName: datos.legalName ?? 'Organización nueva',
      tradeName: datos.tradeName ?? datos.legalName ?? 'Organización nueva',
      tenantTypeConceptId:
        datos.tenantType === 'PAYER'
          ? ORGANIZATION_TYPE['ORG-ASEGURADORA']!
          : datos.tenantType === 'PHARMACY'
            ? ORGANIZATION_TYPE['ORG-FARMACIA']!
            : datos.tenantType === 'HOSPITAL'
              ? ORGANIZATION_TYPE['ORG-HOSPITAL']!
              : ORGANIZATION_TYPE['ORG-CLINICA']!,
      statusConceptId: STATUS['ST-PENDING']!,
      verificationStatusConceptId: STATUS['ST-PENDING']!,
      parentTenantId: null,
      createdAt: ahora(),
      timeZone: datos.timeZone ?? 'America/La_Paz',
    });
    return {
      status: 201,
      body: {
        id: nuevo.id,
        code: nuevo.code,
        legalName: nuevo.legalName,
        status: 'PENDING',
        verificationStatus: 'PENDING',
        parentTenantId: null,
        createdAt: nuevo.createdAt,
      },
    };
  });

  router.post('/admin/tenants/:id/verification', (request) => {
    const t = tenants.get(request.params['id']!);
    if (t === undefined) return notFound('Organización no encontrada');
    tenants.actualizar(t.id, {
      statusConceptId: STATUS['ST-ACTIVE']!,
      verificationStatusConceptId: STATUS['ST-VERIFIED']!,
    });
    return {
      id: t.id,
      code: t.code,
      legalName: t.legalName,
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      parentTenantId: t.parentTenantId,
      createdAt: t.createdAt,
    };
  });

  router.get('/tenants/me', (request) => {
    const user = request.user;
    const items = tenants
      .filtrar(
        (t) =>
          user !== null &&
          (user.tenants.includes(t.id) ||
            (user.key === 'medica' && t.parentTenantId === TENANT_CLINICA)),
      )
      .map((t) => organizacionPropia(t, request));
    return { items };
  });

  router.get('/tenants/:id', ({ params }) => {
    const t = tenants.get(params['id']!);
    return t === undefined
      ? notFound('Organización no encontrada')
      : { ...t, parentTenantId: t.parentTenantId ?? undefined };
  });

  router.patch('/tenants/:id', (request) => {
    const t = tenants.get(request.params['id']!);
    if (t === undefined) return notFound('Organización no encontrada');
    const datos = cuerpo<{ legalName?: string; tradeName?: string; timeZone?: string }>(request);
    const actualizado = tenants.actualizar(t.id, {
      ...(datos.legalName === undefined ? {} : { legalName: datos.legalName }),
      ...(datos.tradeName === undefined ? {} : { tradeName: datos.tradeName }),
      ...(datos.timeZone === undefined ? {} : { timeZone: datos.timeZone }),
    })!;
    return { ...actualizado, parentTenantId: actualizado.parentTenantId ?? undefined };
  });

  // El logo de una organización (PENDIENTES-BACKEND P58): la API real todavía no deja que el
  // dueño lo cambie. Sólo owner/admin escribe; leerlo lo puede hacer cualquiera que vea la ficha.
  router.get('/tenants/:id/logo', ({ params }) =>
    tenants.get(params['id']!) === undefined
      ? notFound('Organización no encontrada')
      : { fileId: logosDeOrganizaciones.get(params['id']!) ?? null },
  );

  router.put('/tenants/:id/logo', (request) => {
    const t = tenants.get(request.params['id']!);
    if (t === undefined) return notFound('Organización no encontrada');
    if (!organizacionPropia(t, request).canAdminister) return forbidden();
    const fileId = cuerpo<{ fileId?: string | null }>(request).fileId ?? null;
    logosDeOrganizaciones.set(t.id, fileId);
    return { fileId };
  });

  router.get('/tenants/:id/child-tenants', ({ params, query }) =>
    paginar(
      tenants
        .filtrar((t) => t.parentTenantId === params['id'])
        .map((t) => ({ ...t, parentTenantId: t.parentTenantId ?? undefined })),
      query,
      25,
    ),
  );

  router.post('/tenants/:id/child-tenants', (request) => {
    const datos = cuerpo<{ code: string; legalName: string }>(request);
    const nuevo = tenants.agregar({
      id: nuevoId('tenant-hijo'),
      code: datos.code ?? 'HIJO',
      legalName: datos.legalName ?? 'Organización hija',
      tradeName: datos.legalName ?? 'Organización hija',
      tenantTypeConceptId: ORGANIZATION_TYPE['ORG-CLINICA']!,
      statusConceptId: STATUS['ST-ACTIVE']!,
      verificationStatusConceptId: STATUS['ST-PENDING']!,
      parentTenantId: request.params['id']!,
      createdAt: ahora(),
      timeZone: 'America/La_Paz',
    });
    return {
      status: 201,
      body: {
        id: nuevo.id,
        code: nuevo.code,
        legalName: nuevo.legalName,
        status: 'ACTIVE',
        verificationStatus: 'PENDING',
        parentTenantId: nuevo.parentTenantId,
        createdAt: nuevo.createdAt,
      },
    };
  });

  router.get('/tenants/:id/branches', ({ params }) => {
    const items = sucursales
      .filtrar((s) => s.tenantId === params['id'])
      .map(({ tenantId: _t, ...s }) => s);
    return { items, count: items.length };
  });

  router.post('/tenants/:id/branches', (request) => {
    const datos = cuerpo<{
      code: string;
      name: string;
      branchType?: 'CLINIC' | 'OFFICE';
      timeZone?: string;
      latitude?: number;
      longitude?: number;
      description?: string;
      locationUrl?: string;
    }>(request);
    // Mismo 409 que `DirectoryBranchesService`: el código es único por tenant.
    const tenantId = request.params['id']!;
    if (sucursales.filtrar((s) => s.tenantId === tenantId && s.code === datos.code).length > 0) {
      return conflict('Ya existe una branch con ese código en el tenant', {
        tenantId,
        code: datos.code,
      });
    }
    const nueva = sucursales.agregar({
      id: nuevoId('branch'),
      tenantId: request.params['id']!,
      code: datos.code ?? 'SUC',
      name: datos.name ?? 'Sucursal',
      branchTypeConceptId: TIPO_SUCURSAL[datos.branchType ?? 'CLINIC'],
      statusConceptId: STATUS['ST-ACTIVE']!,
      timeZone: datos.timeZone ?? 'America/La_Paz',
      createdAt: ahora(),
      ...(datos.latitude === undefined ? {} : { latitude: datos.latitude }),
      ...(datos.longitude === undefined ? {} : { longitude: datos.longitude }),
      ...(datos.description === undefined ? {} : { description: datos.description }),
      ...(datos.locationUrl === undefined ? {} : { locationUrl: datos.locationUrl }),
    });
    const { tenantId: _t, ...resto } = nueva;
    return { status: 201, body: resto };
  });

  // La edición de una sucursal desde el portal de la farmacia y del
  // laboratorio (01/10/2026). La API real no la tiene (P54): `null` borra el
  // dato, una clave ausente lo deja como está. El código no se edita: es la
  // identidad de la sucursal dentro de la organización.
  router.patch('/tenants/:id/branches/:branchId', (request) => {
    const tenantId = request.params['id']!;
    const sucursal = sucursales.get(request.params['branchId']!);
    if (sucursal === undefined || sucursal.tenantId !== tenantId) {
      return notFound('Sucursal no encontrada');
    }
    const datos = cuerpo<{
      name?: string;
      description?: string | null;
      locationUrl?: string | null;
      latitude?: number | null;
      longitude?: number | null;
    }>(request);
    if (datos.name !== undefined && datos.name.trim() === '') {
      return validation('La sucursal necesita un nombre', [
        { field: 'name', message: 'El nombre no puede quedar vacío.' },
      ]);
    }
    const actualizada = sucursales.actualizar(sucursal.id, {
      ...(datos.name === undefined ? {} : { name: datos.name.trim() }),
      ...(datos.description === undefined ? {} : { description: datos.description ?? undefined }),
      ...(datos.locationUrl === undefined ? {} : { locationUrl: datos.locationUrl ?? undefined }),
      ...(datos.latitude === undefined ? {} : { latitude: datos.latitude ?? undefined }),
      ...(datos.longitude === undefined ? {} : { longitude: datos.longitude ?? undefined }),
    })!;
    const { tenantId: _t, ...resto } = actualizada;
    return resto;
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
    const datos = cuerpo<{
      userId: string;
      role?: 'OWNER' | 'ADMIN' | 'STAFF';
      accessScope?: 'ALL_TENANT' | 'BRANCH';
      primaryBranchId?: string;
    }>(request);
    const nueva = membresias.agregar({
      id: nuevoId('membership'),
      tenantId: request.params['id']!,
      userId: datos.userId ?? '',
      tenantRoleConceptId: ROL_TENANT[datos.role ?? 'STAFF'],
      statusConceptId: STATUS['ST-ACTIVE']!,
      accessScopeConceptId: ALCANCE_ACCESO[datos.accessScope ?? 'ALL_TENANT'],
      primaryBranchId: datos.primaryBranchId ?? null,
      startDate: isoDia(0),
      endDate: null,
      createdAt: ahora(),
    });
    const { tenantId: _t, ...resto } = nueva;
    return { status: 201, body: resto };
  });

  router.get('/tenants/:id/memberships/:membershipId/branch-assignments', ({ params }) => {
    const items = asignaciones
      .filtrar((a) => a.membershipId === params['membershipId'])
      .map(({ membershipId: _m, ...a }) => a);
    return { items, count: items.length };
  });

  router.post('/tenants/:id/memberships/:membershipId/branch-assignments', (request) => {
    const datos = cuerpo<{ branchId: string; localRoleConceptId?: string }>(request);
    const nueva = asignaciones.agregar({
      id: nuevoId('assign'),
      membershipId: request.params['membershipId']!,
      branchId: datos.branchId ?? '',
      localRoleConceptId: datos.localRoleConceptId ?? CARGO['ROLE-MEDICO']!,
      statusConceptId: STATUS['ST-ACTIVE']!,
      createdAt: ahora(),
    });
    const { membershipId: _m, ...resto } = nueva;
    return { status: 201, body: resto };
  });

  router.get('/tenants/:id/practitioner-requests', ({ params }) => {
    const nombre = TENANT_NAMES[params['id']!] ?? '';
    return affiliationList
      .filtrar((a) => a.organizationName === nombre && a.statusKind === 'pendiente')
      .concat(
        params['id'] === TENANT_CLINICA
          ? [
              {
                id: uuid('req-pendiente-1'),
                practitionerProfileId: PROFESSIONALS[13]!.id,
                organizationName: nombre,
                roleTitle: 'Médico de planta',
                practiceSiteId: null,
                affiliationTypeConceptId: null,
                startDate: isoDia(-2),
                endDate: null,
                current: true,
                status: 'PENDING',
                statusKind: 'pendiente' as const,
                decisionReasonText: null,
                createdAt: iso(-2),
              },
              {
                id: uuid('req-pendiente-2'),
                practitionerProfileId: PROFESSIONALS[14]!.id,
                organizationName: nombre,
                roleTitle: 'Residente',
                practiceSiteId: null,
                affiliationTypeConceptId: null,
                startDate: isoDia(-1),
                endDate: null,
                current: true,
                status: 'PENDING',
                statusKind: 'pendiente' as const,
                decisionReasonText: null,
                createdAt: iso(-1),
              },
            ]
          : [],
      )
      .map((a) => {
        const p = professionalById(a.practitionerProfileId);
        return {
          id: a.id,
          practitionerProfileId: a.practitionerProfileId,
          practitionerName: p?.displayName ?? null,
          practitionerLicense: p?.matricula ?? null,
          organizationName: a.organizationName,
          roleTitle: a.roleTitle ?? 'Profesional',
          practiceSiteId: a.practiceSiteId,
          startDate: a.startDate,
          statusConceptId: STATUS['ST-PENDING']!,
          createdAt: a.createdAt,
        };
      });
  });

  router.post('/tenants/:id/practitioner-requests/:affiliationId/approve', ({ params }) => {
    affiliationList.actualizar(params['affiliationId']!, {
      status: 'APPROVED',
      statusKind: 'aprobado',
    });
    return { ok: true };
  });

  router.post('/tenants/:id/practitioner-requests/:affiliationId/reject', (request) => {
    const datos = cuerpo<{ reason?: string; reasonText?: string }>(request);
    affiliationList.actualizar(request.params['affiliationId']!, {
      status: 'REJECTED',
      statusKind: 'rechazado',
      decisionReasonText: datos.reasonText ?? datos.reason ?? null,
    });
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
        return {
          bookingId: r.id,
          startAt: r.startAt,
          endAt: r.endAt,
          resourceId: r.resourceId,
          resourceName: recurso?.name ?? null,
          practitionerProfileId: recurso?.resourceRefId ?? null,
          patientProfileId: r.patientProfileId,
          patientName: r.patientName,
          statusConceptId: r.statusConceptId,
        };
      })
      .filter(
        (i) => practitionerProfileId === null || i.practitionerProfileId === practitionerProfileId,
      )
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
    return { items: items.slice(0, limit), truncated: items.length > limit };
  });
}

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
tenants.persistirEn('mock.directory.tenants');
sucursales.persistirEn('mock.directory.sucursales');
membresias.persistirEn('mock.directory.membresias');
asignaciones.persistirEn('mock.directory.asignaciones');
