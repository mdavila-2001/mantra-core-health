import {
  CATALOGOS_DE_APOYO,
  SECRETARIA,
  SECRETARIA_PENDIENTE,
  type EntradaDeCatalogo,
} from '../fixtures/support-staff';
import { reply, type MockReply, type MockRequest } from '../mock-router';
import {
  decorarCuentasCon,
  resolverCuentasDeApoyo,
  TENANT_CLINICA,
  TENANT_HOSPITAL,
  TENANT_NAMES,
  type MockUser,
} from '../mock-session';
import { ahora, Coleccion, iso, nuevoId, uuid } from '../mock-store';

/* ============================================================================
    El estado del personal de apoyo en la maqueta: las cuentas de las
    secretarias, sus vínculos y las reglas de la solicitud y aceptación. Las
    rutas viven en `support-staff.handlers.ts`.
    ========================================================================== */

export const SUPPORT_STAFF = 'SUPPORT_STAFF';

export type TipoDeObjetivo = 'ORGANIZATION' | 'SITE' | 'SERVICE' | 'SPACE' | 'PRACTITIONER';
export type Parte = 'SUPPORT_STAFF' | 'ORGANIZATION' | 'PRACTITIONER';
export type EstadoDeVinculo = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'ENDED';

export interface Cuenta {
  readonly id: string;
  readonly key: string;
  readonly email: string;
  readonly nationalId: string;
  readonly displayName: string;
  readonly personId: string;
}

/** `SupportLinkView`, tal cual lo devuelve la API. */
export interface Vinculo {
  readonly id: string;
  readonly kind: 'LOCATION' | 'PRACTITIONER';
  readonly targetKind: TipoDeObjetivo;
  readonly tenantId: string;
  readonly organizationName: string | null;
  readonly userId: string;
  readonly personName: string | null;
  readonly status: EstadoDeVinculo;
  readonly initiatedBy: Parte | null;
  readonly awaiting: Parte | null;
  readonly practiceSiteId: string | null;
  readonly clinicalUnitId: string | null;
  readonly careSpaceId: string | null;
  readonly practitionerRoleAssignmentId: string | null;
  readonly practitionerProfileId: string | null;
  readonly targetName: string | null;
  readonly createdAt: string;
}

/**
 * Cómo se guarda un vínculo: la vista más si **el hospital** lo aprobó (lo
 * aceptó el admin, o ella aceptó lo que ofreció el hospital). Sólo eso abre la
 * membresía del hospital; lo que acepta o invita un doctor, no.
 */
export interface Registro extends Vinculo {
  readonly viaHospital: boolean;
}

/** La vista que devuelve la API, sin el dato interno. */
export function vista(registro: Registro): Vinculo {
  const { viaHospital: _interno, ...resto } = registro;
  return resto;
}

/** `SupportTarget` como llega en un cuerpo. */
export interface Objetivo {
  readonly targetKind?: string;
  readonly practiceSiteId?: string;
  readonly clinicalUnitId?: string;
  readonly careSpaceId?: string;
  readonly practitionerRoleAssignmentId?: string;
}

/** Un error con su motivo, como lo devuelve la API: en `reason` y en `code`. */
export function fallo(status: number, message: string, reason: string): MockReply {
  return reply(status, { statusCode: status, code: reason, reason, message, details: { reason } });
}

/* ---- cuentas ------------------------------------------------------------------ */

export const cuentas = new Coleccion<Cuenta>(
  [
    { id: SECRETARIA.userId, key: 'secretaria', email: SECRETARIA.email, nationalId: SECRETARIA.nationalId, displayName: SECRETARIA.displayName, personId: SECRETARIA.personId },
    {
      id: SECRETARIA_PENDIENTE.userId,
      key: 'secretaria_lucia',
      email: SECRETARIA_PENDIENTE.email,
      nationalId: SECRETARIA_PENDIENTE.nationalId,
      displayName: SECRETARIA_PENDIENTE.displayName,
      personId: SECRETARIA_PENDIENTE.personId,
    },
  ],
  'mock:apoyo:cuentas',
);

/** La cuenta de una secretaria: `SUPPORT_STAFF` desde el alta, sin organizaciones. */
export function cuentaSimulada(cuenta: Cuenta): MockUser {
  return {
    key: cuenta.key,
    id: cuenta.id,
    email: cuenta.email,
    nationalId: cuenta.nationalId,
    displayName: cuenta.displayName,
    roles: ['USER', SUPPORT_STAFF],
    tenants: [],
    tenantNames: TENANT_NAMES,
    personId: cuenta.personId,
    accountKind: 'PERSON',
  };
}

resolverCuentasDeApoyo(({ identificador, id, key }) => {
  const cuenta = cuentas
    .todos()
    .find(
      (c) =>
        (identificador !== undefined &&
          (c.email === identificador || c.nationalId === identificador || c.key === identificador.replace(/@.*$/, ''))) ||
        (id !== undefined && c.id === id) ||
        (key !== undefined && c.key === key),
    );
  return cuenta === undefined ? undefined : cuentaSimulada(cuenta);
});

/* ---- objetivos ---------------------------------------------------------------- */

interface ObjetivoResuelto {
  readonly kind: Vinculo['kind'];
  readonly targetKind: TipoDeObjetivo;
  readonly entrada: EntradaDeCatalogo | null;
}

/** El objetivo dentro del catálogo del hospital, o `null` si no es de ese hospital. */
export function resolverObjetivo(tenantId: string, objetivo: Objetivo): ObjetivoResuelto | null {
  const catalogo = CATALOGOS_DE_APOYO[tenantId];
  if (catalogo === undefined) return null;
  switch (objetivo.targetKind) {
    case 'ORGANIZATION':
      return { kind: 'LOCATION', targetKind: 'ORGANIZATION', entrada: null };
    case 'PRACTITIONER': {
      const entrada = catalogo.practitioners.find((d) => d.id === objetivo.practitionerRoleAssignmentId);
      return entrada === undefined ? null : { kind: 'PRACTITIONER', targetKind: 'PRACTITIONER', entrada };
    }
    case 'SPACE': {
      const entrada = catalogo.floors.find((p) => p.id === objetivo.careSpaceId);
      return entrada === undefined ? null : { kind: 'LOCATION', targetKind: 'SPACE', entrada };
    }
    case 'SITE': {
      const entrada = catalogo.sites.find((s) => s.id === objetivo.practiceSiteId);
      return entrada === undefined ? null : { kind: 'LOCATION', targetKind: 'SITE', entrada };
    }
    default:
      return null;
  }
}

/** Arma un vínculo nuevo `PENDING` que decide `awaiting`. */
export function vinculoNuevo(
  tenantId: string,
  persona: { readonly id: string; readonly displayName: string },
  objetivo: ObjetivoResuelto,
  initiatedBy: Parte,
  awaiting: Parte,
): Registro {
  const entrada = objetivo.entrada;
  return {
    id: nuevoId('apoyo-vinculo'),
    kind: objetivo.kind,
    targetKind: objetivo.targetKind,
    tenantId,
    organizationName: TENANT_NAMES[tenantId] ?? null,
    userId: persona.id,
    personName: persona.displayName,
    status: 'PENDING',
    initiatedBy,
    awaiting,
    practiceSiteId: entrada?.practiceSiteId ?? null,
    clinicalUnitId: null,
    careSpaceId: objetivo.targetKind === 'SPACE' ? (entrada?.id ?? null) : null,
    practitionerRoleAssignmentId: objetivo.targetKind === 'PRACTITIONER' ? (entrada?.id ?? null) : null,
    practitionerProfileId: entrada?.practitionerProfileId ?? null,
    targetName: entrada?.name ?? null,
    createdAt: ahora(),
    viaHospital: false,
  };
}

/* ---- vínculos sembrados ------------------------------------------------------- */

function sembrado(
  semilla: string,
  tenantId: string,
  persona: { readonly userId: string; readonly displayName: string },
  objetivo: Objetivo,
  estado: { status: EstadoDeVinculo; initiatedBy: Parte; awaiting: Parte | null; dias: number; viaHospital?: boolean },
): Registro {
  const base = vinculoNuevo(tenantId, { id: persona.userId, displayName: persona.displayName }, resolverObjetivo(tenantId, objetivo)!, estado.initiatedBy, estado.awaiting ?? 'ORGANIZATION');
  return {
    ...base,
    id: uuid(`apoyo-vinculo-${semilla}`),
    status: estado.status,
    awaiting: estado.awaiting,
    createdAt: iso(estado.dias, 10),
    viaHospital: estado.viaHospital ?? false,
  };
}

const HOSPITAL = CATALOGOS_DE_APOYO[TENANT_HOSPITAL]!;
const CLINICA = CATALOGOS_DE_APOYO[TENANT_CLINICA]!;
const piso = (catalogo: typeof HOSPITAL, nombre: string) => catalogo.floors.find((p) => p.name.startsWith(nombre))!.id;

export const vinculos = new Coleccion<Registro>(
  [
    sembrado('rosa-rojas', TENANT_HOSPITAL, SECRETARIA, { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: HOSPITAL.practitioners[0]!.id }, { status: 'ACTIVE', initiatedBy: 'ORGANIZATION', awaiting: null, dias: -40, viaHospital: true }),
    sembrado('rosa-piso2', TENANT_HOSPITAL, SECRETARIA, { targetKind: 'SPACE', careSpaceId: piso(HOSPITAL, 'Piso 2') }, { status: 'ACTIVE', initiatedBy: 'ORGANIZATION', awaiting: null, dias: -40, viaHospital: true }),
    sembrado('rosa-cespedes', TENANT_CLINICA, SECRETARIA, { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: CLINICA.practitioners[1]!.id }, { status: 'PENDING', initiatedBy: 'ORGANIZATION', awaiting: 'SUPPORT_STAFF', dias: -1 }),
    sembrado('rosa-piso1', TENANT_CLINICA, SECRETARIA, { targetKind: 'SPACE', careSpaceId: piso(CLINICA, 'Piso 1') }, { status: 'PENDING', initiatedBy: 'ORGANIZATION', awaiting: 'SUPPORT_STAFF', dias: -1 }),
    sembrado('lucia-paz', TENANT_CLINICA, SECRETARIA_PENDIENTE, { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: CLINICA.practitioners[2]!.id }, { status: 'PENDING', initiatedBy: 'SUPPORT_STAFF', awaiting: 'ORGANIZATION', dias: -2 }),
    sembrado('lucia-rojas', TENANT_CLINICA, SECRETARIA_PENDIENTE, { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: CLINICA.practitioners[0]!.id }, { status: 'PENDING', initiatedBy: 'SUPPORT_STAFF', awaiting: 'PRACTITIONER', dias: -2 }),
  ],
  'mock:apoyo:vinculos',
);

/**
 * Las organizaciones con membresía de apoyo: donde tiene un vínculo activo que
 * aprobó **el hospital**. Lo que sólo aceptó un doctor no la hace miembro.
 */
export function tenantsDeApoyo(userId: string): readonly string[] {
  return [
    ...new Set(vinculos.filtrar((v) => v.userId === userId && v.status === 'ACTIVE' && v.viaHospital).map((v) => v.tenantId)),
  ];
}

// Como la API: al aceptar algo que aprobó el hospital, el hospital entra a los `tenants` del token.
decorarCuentasCon((user) => {
  const tenants = tenantsDeApoyo(user.id);
  return tenants.length === 0 ? user : { ...user, tenants: [...new Set([...user.tenants, ...tenants])] };
});

/* ---- reglas --------------------------------------------------------------------- */

export function tenantActivo(request: MockRequest): string | null {
  return request.headers.get('X-Tenant-Id') ?? request.user?.tenants[0] ?? null;
}

/** Si administra el hospital activo: `SECURITY_ADMIN` en él, o `SUPERADMIN`. */
export function administra(request: MockRequest, tenantId: string): boolean {
  const user = request.user;
  if (user === null) return false;
  if (user.roles.includes('SUPERADMIN')) return true;
  if (!user.tenants.includes(tenantId)) return false;
  const acotado = Object.values(user.scopedRoles ?? {}).some((r) => r.includes('SECURITY_ADMIN'));
  return (user.roles.includes('SECURITY_ADMIN') && !acotado) || user.scopedRoles?.[tenantId]?.includes('SECURITY_ADMIN') === true;
}

/** Si ya hay un vínculo vivo de esa persona con ese objetivo. */
export function duplicado(nuevo: Registro): boolean {
  return vinculos
    .filtrar((v) => v.userId === nuevo.userId && v.tenantId === nuevo.tenantId && (v.status === 'PENDING' || v.status === 'ACTIVE'))
    .some(
      (v) =>
        v.targetKind === nuevo.targetKind &&
        v.careSpaceId === nuevo.careSpaceId &&
        v.practitionerRoleAssignmentId === nuevo.practitionerRoleAssignmentId &&
        v.practiceSiteId === (nuevo.targetKind === 'SITE' ? nuevo.practiceSiteId : v.practiceSiteId),
    );
}

/**
 * Pasa un vínculo de estado; `null` si ya no espera a quien decide.
 *
 * `quien` es la parte que decide. El hospital puede decidir lo que espera al
 * doctor (un pedido de la secretaria a un doctor). Queda `viaHospital` si
 * decidió el hospital, o si la secretaria aceptó lo que ofreció el hospital.
 */
export function decidir(id: string, quien: Parte, estado: EstadoDeVinculo): Vinculo | null {
  const actual = vinculos.get(id);
  if (actual === undefined || actual.status !== 'PENDING' || actual.awaiting === null) return null;
  const puede = actual.awaiting === quien || (quien === 'ORGANIZATION' && actual.awaiting === 'PRACTITIONER');
  if (!puede) return null;
  const viaHospital = quien === 'ORGANIZATION' || (quien === 'SUPPORT_STAFF' && actual.initiatedBy === 'ORGANIZATION');
  const nuevo = vinculos.actualizar(id, { status: estado, awaiting: null, viaHospital: estado === 'ACTIVE' && viaHospital });
  return nuevo === undefined ? null : vista(nuevo);
}

/** Termina un vínculo y devuelve su vista. */
export function terminar(id: string): Vinculo | null {
  const nuevo = vinculos.actualizar(id, { status: 'ENDED', awaiting: null });
  return nuevo === undefined ? null : vista(nuevo);
}

/** El catálogo de un hospital, con la forma de `SupportCatalog`. */
export function catalogoDe(tenantId: string) {
  const catalogo = CATALOGOS_DE_APOYO[tenantId];
  return {
    tenantId,
    organizationName: TENANT_NAMES[tenantId] ?? null,
    sites: catalogo?.sites ?? [],
    services: [],
    floors: catalogo?.floors ?? [],
    practitioners: catalogo?.practitioners ?? [],
  };
}

export function lista(items: readonly Registro[]) {
  const ordenados = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(vista);
  return { items: ordenados, count: ordenados.length, nextCursor: null };
}
