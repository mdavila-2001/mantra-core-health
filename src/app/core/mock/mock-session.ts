import { uuid } from './mock-store';
import type { TenantTypeCode } from '../data-access/directory/directory.types';

/* ============================================================================
    Las cuentas del backend simulado y sus tokens.

    El token de acceso es un JWT «de utilería»: tres segmentos, con un payload
    real que `decodeAccessToken` lee tal cual (sub, roles, tenants, name,
    tenantNames, tenantTypes, ownTenantId, pid, hpid, exp). La firma es
    decorativa: nadie la verifica en esta rama.
    ========================================================================== */

export interface MockUser {
  /** La clave con la que se identifica en el login (correo) y dentro del token. */
  readonly key: string;
  readonly id: string;
  readonly email: string;
  readonly nationalId: string;
  readonly displayName: string;
  readonly roles: readonly string[];
  readonly tenants: readonly string[];
  readonly tenantNames: Readonly<Record<string, string>>;
  /** Su organización propia, la que se activa por defecto («Mi consultorio»). */
  readonly ownTenantId?: string;
  readonly patientProfileId?: string;
  readonly practitionerProfileId?: string;
  readonly personId: string;
}

export const TENANT_CLINICA = uuid('tenant-clinica-los-olivos');
export const TENANT_HOSPITAL = uuid('tenant-hospital-san-lucas');
export const TENANT_PLATAFORMA = uuid('tenant-plataforma-alovida');
export const TENANT_FARMACIA = uuid('tenant-farmacia-vida');
export const TENANT_LABORATORIO = uuid('tenant-laboratorio-central');
export const TENANT_ASEGURADORA = uuid('tenant-seguros-andina');
/** El consultorio propio de la médica: su organización por defecto. */
export const TENANT_CONSULTORIO = uuid('tenant-consultorio-rojas');

export const TENANT_NAMES: Readonly<Record<string, string>> = {
  [TENANT_CONSULTORIO]: 'Consultorio Dra. Rojas',
  [TENANT_CLINICA]: 'Clínica Los Olivos',
  [TENANT_HOSPITAL]: 'Hospital San Lucas',
  [TENANT_PLATAFORMA]: 'AloVida Plataforma',
  [TENANT_FARMACIA]: 'Farmacia Vida',
  [TENANT_LABORATORIO]: 'Laboratorio Central',
  [TENANT_ASEGURADORA]: 'Seguros Andina',
};

/**
 * El tipo de cada tenant del simulador, para el claim `tenantTypes` — el
 * mismo dato que la API real firmaría a partir de `tenant_type_concept_id`.
 *
 * Sigue al fixture de `directory.handlers.ts` (`TIPO_ORGANIZACION`) para que
 * el token y `GET /admin/tenants` digan lo mismo de un mismo tenant: el
 * consultorio, la clínica y la plataforma son `ORG-CLINICA` ahí, y acá
 * `'PROVIDER'`; el laboratorio también es `ORG-CLINICA` en el fixture —el
 * simulador no distingue un centro de diagnóstico de un prestador genérico—,
 * y se deja anotado que la API real emitiría `'DIAGNOSTIC_CENTER'`, un código
 * que `TenantTypeCode` (front) todavía no declara.
 *
 * Sin campo por cuenta en {@link MockUser}: a diferencia del nombre —que la
 * médica reescribe para «Mi consultorio»—, el tipo de un tenant no varía
 * según quién entra, así que basta una tabla y `emitirAccessToken` la
 * consulta por cada tenant de la cuenta.
 */
export const TENANT_TYPES: Readonly<Record<string, TenantTypeCode>> = {
  [TENANT_CONSULTORIO]: 'PROVIDER',
  [TENANT_CLINICA]: 'PROVIDER',
  [TENANT_HOSPITAL]: 'HOSPITAL',
  [TENANT_PLATAFORMA]: 'PROVIDER',
  [TENANT_FARMACIA]: 'PHARMACY',
  // La API real emitiría 'DIAGNOSTIC_CENTER' (directory.concepts.ts:169 de la
  // API); el front todavía no lo tiene en TENANT_TYPE_CODES.
  [TENANT_LABORATORIO]: 'PROVIDER',
  [TENANT_ASEGURADORA]: 'PAYER',
};

/** Perfiles que aparecen en toda la aplicación (agenda, expediente, red). */
export const IDS = {
  medica: {
    userId: uuid('user-medica'),
    personId: uuid('person-medica'),
    practitionerProfileId: uuid('hpid-medica'),
    patientProfileId: uuid('pid-medica-como-paciente'),
  },
  paciente: {
    userId: uuid('user-paciente'),
    personId: uuid('person-paciente'),
    patientProfileId: uuid('pid-paciente'),
  },
  admin: {
    userId: uuid('user-admin'),
    personId: uuid('person-admin'),
  },
  superadmin: {
    userId: uuid('user-superadmin'),
    personId: uuid('person-superadmin'),
  },
  visitador: {
    userId: uuid('user-visitador'),
    personId: uuid('person-visitador'),
  },
  aseguradora: {
    userId: uuid('user-aseguradora-owner'),
    personId: uuid('person-aseguradora-owner'),
  },
  aseguradoraStaff: {
    userId: uuid('user-aseguradora-staff'),
    personId: uuid('person-aseguradora-staff'),
  },
} as const;

export const MOCK_USERS: readonly MockUser[] = [
  {
    key: 'medica',
    id: IDS.medica.userId,
    email: 'medica@alovida.mock',
    nationalId: '4567890',
    displayName: 'Dra. Valeria Rojas Mendoza',
    roles: ['PRACTITIONER', 'CLINICIAN', 'SCHEDULING_ADMIN'],
    // «Mi consultorio» primero y como organización propia: entra ahí sin pasar
    // por el selector, y las clínicas quedan a un cambio de distancia.
    tenants: [TENANT_CONSULTORIO, TENANT_CLINICA, TENANT_HOSPITAL],
    tenantNames: { ...TENANT_NAMES, [TENANT_CONSULTORIO]: 'Mi consultorio' },
    ownTenantId: TENANT_CONSULTORIO,
    practitionerProfileId: IDS.medica.practitionerProfileId,
    personId: IDS.medica.personId,
  },
  {
    key: 'paciente',
    id: IDS.paciente.userId,
    email: 'paciente@alovida.mock',
    nationalId: '7654321',
    displayName: 'Ana Lucía Pérez Quiroga',
    roles: ['PATIENT'],
    tenants: [TENANT_PLATAFORMA],
    tenantNames: TENANT_NAMES,
    patientProfileId: IDS.paciente.patientProfileId,
    personId: IDS.paciente.personId,
  },
  {
    key: 'admin',
    id: IDS.admin.userId,
    email: 'admin@alovida.mock',
    nationalId: '1112223',
    displayName: 'Marcelo Dávila Arce',
    roles: [
      'SECURITY_ADMIN',
      'SCHEDULING_ADMIN',
      'IDENTITY_ADMIN',
      'PLATFORM_ADMIN',
      'BUSINESS_ADMIN',
      'PAYMENTS_ADMIN',
      'PHARMA_LAB_ADMIN',
      'ACCOUNTING_APPROVER',
      'BILLING',
      'BILLING_OPERATOR',
      'FINANCE',
      'CASHIER',
      'PERIOP_ADMIN',
      'CLINICAL_INFORMATICIAN',
    ],
    tenants: [TENANT_CLINICA],
    tenantNames: TENANT_NAMES,
    personId: IDS.admin.personId,
  },
  {
    key: 'superadmin',
    id: IDS.superadmin.userId,
    email: 'superadmin@alovida.mock',
    nationalId: '9998887',
    displayName: 'Soporte AloVida',
    roles: ['SUPERADMIN', 'SECURITY_ADMIN', 'PLATFORM_ADMIN'],
    tenants: [TENANT_PLATAFORMA, TENANT_CLINICA, TENANT_HOSPITAL],
    tenantNames: TENANT_NAMES,
    personId: IDS.superadmin.personId,
  },
  {
    key: 'visitador',
    id: IDS.visitador.userId,
    email: 'visitador@alovida.mock',
    nationalId: '5556667',
    displayName: 'Carla Fernández Ríos',
    roles: ['MEDICAL_VISITOR'],
    tenants: [TENANT_FARMACIA],
    tenantNames: TENANT_NAMES,
    personId: IDS.visitador.personId,
  },
  {
    key: 'aseguradora',
    id: IDS.aseguradora.userId,
    email: 'aseguradora@alovida.mock',
    nationalId: '7001001',
    displayName: 'Patricia Suárez · Seguros Andina',
    roles: ['USER'],
    tenants: [TENANT_ASEGURADORA],
    tenantNames: TENANT_NAMES,
    personId: IDS.aseguradora.personId,
  },
  {
    key: 'aseguradora_staff',
    id: IDS.aseguradoraStaff.userId,
    email: 'aseguradora.staff@alovida.mock',
    nationalId: '7001002',
    displayName: 'Luis Mercado · Seguros Andina',
    roles: ['USER'],
    tenants: [TENANT_ASEGURADORA],
    tenantNames: TENANT_NAMES,
    personId: IDS.aseguradoraStaff.personId,
  },
];

/**
 * Las cuentas de los pacientes del padrón, que no están en {@link MOCK_USERS}.
 *
 * Las resuelve quien conoce el padrón (`auth.handlers`), inyectándolo acá: este
 * archivo no puede importar los fixtures de personas sin armar un ciclo. Hace
 * falta para que un dependiente con cuenta pueda entrar a aceptar la solicitud.
 */
type ResolverDeCuentas = (criterio: {
  readonly identificador?: string;
  readonly id?: string;
  readonly key?: string;
}) => MockUser | undefined;

let cuentaDePaciente: ResolverDeCuentas = () => undefined;

export function resolverCuentasDePacientes(resolver: ResolverDeCuentas): void {
  cuentaDePaciente = resolver;
}

export function buscarUsuario(identificador: string): MockUser | undefined {
  const limpio = identificador.trim().toLocaleLowerCase('es');
  return (
    MOCK_USERS.find(
      (u) =>
        u.email === limpio ||
        u.nationalId === limpio ||
        u.key === limpio ||
        u.key === limpio.replace(/@.*$/, ''),
    ) ?? cuentaDePaciente({ identificador: limpio })
  );
}

export function usuarioPorId(userId: string): MockUser | undefined {
  return MOCK_USERS.find((u) => u.id === userId) ?? cuentaDePaciente({ id: userId });
}

/* ---- tokens ---------------------------------------------------------------- */

const VIDA_TOKEN_SEGUNDOS = 60 * 60 * 8;

export function emitirAccessToken(user: MockUser, ahora = Date.now()): string {
  const header = base64url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  // Sólo los tenants de la cuenta, y sólo los que tienen tipo conocido: mismo
  // criterio que usaría la API real (`TENANT_TYPE_CODE_BY_CONCEPT_ID`), donde
  // un `tenant_type_concept_id` fuera del catálogo tampoco entra al mapa.
  const tenantTypes = Object.fromEntries(
    user.tenants.flatMap((tenantId) => {
      const tipo = TENANT_TYPES[tenantId];
      return tipo === undefined ? [] : [[tenantId, tipo]];
    }),
  );
  const payload = base64url(
    JSON.stringify({
      sub: user.id,
      sid: `sesion-${user.key}`,
      name: user.displayName,
      roles: user.roles,
      tenants: user.tenants,
      tenantNames: user.tenantNames,
      ...(Object.keys(tenantTypes).length === 0 ? {} : { tenantTypes }),
      ...(user.ownTenantId === undefined ? {} : { ownTenantId: user.ownTenantId }),
      ...(user.patientProfileId === undefined ? {} : { pid: user.patientProfileId }),
      ...(user.practitionerProfileId === undefined ? {} : { hpid: user.practitionerProfileId }),
      iat: Math.floor(ahora / 1000),
      exp: Math.floor(ahora / 1000) + VIDA_TOKEN_SEGUNDOS,
    }),
  );
  return `${header}.${payload}.mock`;
}

export function emitirRefreshToken(user: MockUser): string {
  return `mock-refresh.${user.key}.${Date.now().toString(36)}`;
}

export function usuarioDeRefreshToken(refreshToken: string): MockUser | undefined {
  const [prefijo, key] = refreshToken.split('.');
  if (prefijo !== 'mock-refresh' || key === undefined) return undefined;
  return MOCK_USERS.find((u) => u.key === key) ?? cuentaDePaciente({ key });
}

export function usuarioDeAccessToken(token: string): MockUser | undefined {
  const payload = token.split('.')[1];
  if (payload === undefined) return undefined;
  try {
    const claims = JSON.parse(desdeBase64url(payload)) as { sub?: string };
    return claims.sub === undefined ? undefined : usuarioPorId(claims.sub);
  } catch {
    return undefined;
  }
}

export function expiracion(ahora = Date.now()): string {
  return new Date(ahora + VIDA_TOKEN_SEGUNDOS * 1000).toISOString();
}

function base64url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (const byte of bytes) {
    binario += String.fromCharCode(byte);
  }
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function desdeBase64url(segmento: string): string {
  const base64 = segmento.replace(/-/g, '+').replace(/_/g, '/');
  const relleno = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binario = atob(relleno);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
