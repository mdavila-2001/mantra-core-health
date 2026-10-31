import { atomosDe } from './support-access.governance.view';
import { type MockReply, type MockRequest, forbidden, reply } from '../mock-router';
import { permisos, vinculos } from '../fixtures/support-hospital';
import { ADMIN_PRINCIPAL, nombreDeUsuario } from '../fixtures/support-hospital-governance';
import type { MockUser } from '../mock-session';
import { conMotivo } from './support-access.errors';
import { esCuentaDeLaOrganizacion, esRespuesta, soloOrganizacion, tenantDe } from './support-access.core';

/* ============================================================================
    Lo que comparten los handlers del **gobierno de accesos**: quién llama (administrador, administrador
    delegado, doctor, persona de apoyo), el paso extra, el motivo y los errores con la forma de la API.

    El mock **no reimplementa la política** (CONTRATO-GOBIERNO §9.6): hace cumplir solo lo que cambia la
    forma de la respuesta (paso extra, cuatro ojos, comentario obligatorio, 404 uniforme) para que el front
    ejercite todos sus estados.
   ========================================================================== */

/** Quién llama a una ruta de organización. */
export interface ActorDeGobierno {
  readonly tenantId: string;
  readonly user: MockUser;
  /** `SECURITY_ADMIN` de la cuenta de la organización. */
  readonly esAdmin: boolean;
  /** Los átomos vigentes de la persona (administrador delegado): vacío para el administrador. */
  readonly atomos: ReadonlySet<string>;
}

/** Los átomos vigentes de una persona en una organización (sus permisos activos con efecto `ALLOW`). */
export function atomosVigentesDe(userId: string, tenantId: string): ReadonlySet<string> {
  const mios = vinculos.filtrar((v) => v.userId === userId && v.tenantId === tenantId && v.status === 'ACTIVE').map((v) => v.id);
  return new Set(
    permisos
      .filtrar((p) => mios.includes(p.engagementId) && p.status === 'ACTIVE' && p.effect !== 'DENY')
      .flatMap((p) => atomosDe(p)),
  );
}

/** Solo el administrador de seguridad (`@Roles('SECURITY_ADMIN')`). */
export function soloAdministrador(request: MockRequest): ActorDeGobierno | MockReply {
  const acceso = soloOrganizacion(request);
  if (esRespuesta(acceso)) return acceso;
  return { tenantId: acceso.tenantId, user: request.user!, esAdmin: true, atomos: new Set() };
}

/**
 * `@Roles('SECURITY_ADMIN', 'SUPPORT_STAFF')` **más átomo**: el administrador pasa; la persona de apoyo pasa si tiene alguno
 * de los átomos pedidos. Sin sesión, 401; sin autoridad, el mismo 403 genérico de siempre.
 */
export function administradorOConAtomo(request: MockRequest, ...atomos: readonly string[]): ActorDeGobierno | MockReply {
  const user = request.user;
  if (user === null) return { status: 401, body: { statusCode: 401, code: 'UNAUTHENTICATED', message: 'Sin sesión', error: 'Unauthorized' } };
  const tenantId = tenantDe(request);
  if (tenantId === null) return forbidden('Falta la organización.');
  if (esCuentaDeLaOrganizacion(user, tenantId)) return { tenantId, user, esAdmin: true, atomos: new Set() };
  if (!user.tenants.includes(tenantId) || !user.roles.includes('SUPPORT_STAFF')) return forbidden('No tiene permiso para esta operación.');
  const vigentes = atomosVigentesDe(user.id, tenantId);
  if (!atomos.some((a) => vigentes.has(a))) return forbidden('No tiene permiso para esta operación.');
  return { tenantId, user, esAdmin: false, atomos: vigentes };
}

export const esActor = (valor: ActorDeGobierno | MockReply): valor is ActorDeGobierno => 'tenantId' in valor && 'esAdmin' in valor;

/** Cualquier sesión autenticada (rutas `/me/*` y `/approvals/*`, donde autoriza el servicio por identidad o elegibilidad). */
export function conSesion(request: MockRequest): { readonly user: MockUser; readonly tenantId: string } | MockReply {
  if (request.user === null) return { status: 401, body: { statusCode: 401, code: 'UNAUTHENTICATED', message: 'Sin sesión', error: 'Unauthorized' } };
  return { user: request.user, tenantId: tenantDe(request) ?? request.user.tenants[0] ?? '' };
}

export const hayRespuesta = (valor: unknown): valor is MockReply => typeof valor === 'object' && valor !== null && 'status' in valor && 'body' in valor;

/** `404` uniforme: lo ajeno y lo inexistente se ven igual y no filtran existencia. */
export const noEncontrado = (reason: string, mensaje = 'No encontrado.'): MockReply => conMotivo(404, mensaje, reason);

/* ---- paso extra ------------------------------------------------------------------------------------------ */

/** Cuánto vale un paso extra, por omisión, en minutos. */
export const PASO_EXTRA_MINUTOS = 10;

const sellos = new Map<string, number>();

/** Sella la sesión (o la persona) con un paso extra reciente: lo que haría `POST /iam/me/step-up`. */
export function sellarPasoExtra(userId: string, ahoraMs: number = Date.now()): void {
  sellos.set(userId, ahoraMs);
}

/** Antigüedad del sello en minutos; `null` si no hay. */
export function antiguedadDelPasoExtra(userId: string, ahoraMs: number = Date.now()): number | null {
  const sello = sellos.get(userId);
  return sello === undefined ? null : Math.floor((ahoraMs - sello) / 60_000);
}

/** Las pruebas parten sin sello. */
export function olvidarPasosExtra(): void {
  sellos.clear();
}

/**
 * Las rutas «+ paso extra»: sin sello fresco, 403 `STEP_UP_REQUIRED` con `details { maxAgeMinutes, enrolled }`, como el
 * mapa DENY/CHALLENGE → HTTP de la API. Devuelve `null` si el paso extra está al día.
 */
export function exigirPasoExtra(userId: string, maxAgeMinutes: number = PASO_EXTRA_MINUTOS): MockReply | null {
  const edad = antiguedadDelPasoExtra(userId);
  if (edad !== null && edad <= maxAgeMinutes) return null;
  return conMotivo(403, 'Confirme su identidad con el segundo paso para continuar.', 'STEP_UP_REQUIRED', { maxAgeMinutes, enrolled: true });
}

/* ---- varios ----------------------------------------------------------------------------------------------- */

/** Un texto recortado de al menos `minimo` caracteres; si no, 422 con `reason`. */
export function textoObligatorio(valor: unknown, minimo: number, reason: string): { ok: true; texto: string } | { ok: false; respuesta: MockReply } {
  const texto = typeof valor === 'string' ? valor.trim() : '';
  if (texto.length < minimo) return { ok: false, respuesta: conMotivo(422, `Escriba al menos ${minimo} caracteres.`, reason, { minLength: minimo }) };
  return { ok: true, texto };
}

/** `{ items, count }`, la forma de todas las listas del gobierno de accesos. */
export const lista = <T>(items: readonly T[]): { readonly items: readonly T[]; readonly count: number } => ({ items, count: items.length });

/** Quién es el administrador de la sesión simulada: para los asientos y las aprobaciones. */
export const nombreDe = (user: MockUser): string => nombreDeUsuario(user.id) ?? user.displayName ?? ADMIN_PRINCIPAL.nombre;

export const ok = (extra: Record<string, unknown> = {}): MockReply => reply(200, { ok: true, ...extra });
