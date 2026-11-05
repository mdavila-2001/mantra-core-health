import type { SessionPolicy, SessionPolicyScope } from '../../data-access/support-access/support-access.types';
import { effectiveRules, hoursDurationMinutes, isAllowedAt, policyKey, weekdayAndMinutes, DEFAULT_TIME_ZONE, MIN_ALLOWED_HOURS_MINUTES, type Audience, type EffectiveRules } from '../../data-access/support-access/session-policy';
import { activeRules, evaluateIpRules } from '../../data-access/support-access/ip-rules';
import { vinculos } from '../fixtures/support-hospital';
import { forbidden, isMockReply, reply, unauthorized, validation, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { buscarUsuario, TENANT_HOSPITAL_PILOTO, TENANT_NAMES, usuarioDeRefreshToken, type MockUser } from '../mock-session';
import { Coleccion, ahora, cuerpo, uuid } from '../mock-store';
import { cerrarOtrasSesiones } from './auth.handlers';
import { conAlcanceLimitado, conOrganizacionesNegadas, conPlazoDeInactividad } from './iam-token-claims';
import { CODIGO_DE_PRUEBA, tieneFactorConfirmado } from './iam-mfa.store';
import { ORIGEN_SIMULADO, redesDeLaOrganizacion, registrarSeguridadPropia } from './iam-security.handlers';
import { anotar, doctorDe, tenantDe } from './support-access.core';
import { conMotivo } from './support-access.errors';

/* ============================================================================
    Controles de sesión de la organización y lo que hacen en el inicio de sesión.

    Reproduce, con estado que sobrevive a F5, lo que la API hará con
    `iam.session_policies`:

    - `GET|PUT /org/session-policies` para cualquier cuenta de organización con
      `SECURITY_ADMIN`, como la API;
    - las reglas que alcanzan a la persona se combinan **de la más estricta**, igual que la API;
    - el inicio de sesión aplica la regla que rige para la persona: **horario**
      (401 `OUTSIDE_ALLOWED_HOURS`), **verificación en dos pasos** (401
      `MFA_REQUIRED` / `MFA_INVALID` con un factor confirmado) y **dispositivo
      nuevo** (`newDevice` en la respuesta), y el token lleva el plazo de
      **inactividad** (`idleTimeoutMinutes`);
    - **sin factor y con dos pasos exigidos el login ENTRA**, como la API, y la
      respuesta trae `mfaEnrollmentRequired: true`: restringir la aplicación hasta
      que la persona dé de alta el factor es del cliente;
    - `POST /iam/me/devices/:id/confirm` («Fui yo») y `.../not-me` («No fui yo»,
      cierra las demás sesiones y responde `{ revokedSessions, deviceId }`);
    - `GET|POST /iam/me/mfa…` y `GET|PUT /org/ip-access-rules`
      (`iam-security.handlers.ts`).

    La restricción por red al **iniciar sesión** no se simula: el navegador no tiene
    una IP de organización que comparar (sí el rechazo de `PUT` por un conjunto que
    deja afuera a quien lo guarda). Un rechazo de red, si llegara, sería 401
    `OUTSIDE_ALLOWED_NETWORK`.

    Diferencia con la API: con un factor confirmado la API pide el código siempre; el
    simulador solo lo pide cuando una regla exige los dos pasos, para que las demás
    pruebas entren sin código.

    Cuentas demo (ver `docs/support-access/`):
    - con verificación en dos pasos activada, código `123456`: `ana`, `lucia`,
      `perez`, `hospital_piloto`; sin ella (para ver `mfaEnrollmentRequired`): el resto;
    - dispositivo nuevo en el primer ingreso de cada pestaña: `lucia` y `marcos`.
   ========================================================================== */

interface FilaPolitica extends SessionPolicy {
  readonly id: string;
  readonly tenantId: string;
}

const idDe = (tenantId: string, policy: Pick<SessionPolicy, 'scope' | 'roleCode'>): string => `${tenantId}|${policyKey(policy)}`;

const POLITICAS_DEL_HOSPITAL: readonly FilaPolitica[] = [
  { id: idDe(TENANT_HOSPITAL_PILOTO, { scope: 'ALL_ACCOUNTS' }), tenantId: TENANT_HOSPITAL_PILOTO, scope: 'ALL_ACCOUNTS', idleTimeoutMinutes: 15, newDeviceAlert: true, enforceIpRules: false, requireMfa: false },
  { id: idDe(TENANT_HOSPITAL_PILOTO, { scope: 'ORG_STAFF' }), tenantId: TENANT_HOSPITAL_PILOTO, scope: 'ORG_STAFF', idleTimeoutMinutes: 10, newDeviceAlert: true, enforceIpRules: false, requireMfa: false },
];

export const politicasDeSesion = new Coleccion<FilaPolitica>(POLITICAS_DEL_HOSPITAL).persistirEn('mock.apoyo.politicas');

interface FilaDispositivo {
  readonly id: string;
  readonly userId: string;
  readonly trusted: boolean;
  /** Se pidió el código de confirmación al correo (`POST …/confirm-code`). */
  readonly codigoPedido?: boolean;
}

/** El código de 8 dígitos que el simulador manda «al correo»: no hay un correo de verdad. */
export const CODIGO_DE_DISPOSITIVO = '12345678';

/** Cuentas demo sin un correo verificado: para ellas `…/confirm-code` es 422 `DEVICE_CONFIRM_NO_VERIFIED_EMAIL`. */
const SIN_CORREO_VERIFICADO: readonly string[] = ['marcos'];

/** `l***@alovida.mock`: la dirección con lo central tapado, como la API. */
function correoEnmascarado(correo: string): string {
  const [local = '', dominio = ''] = correo.split('@');
  return `${local.slice(0, 1)}***@${dominio}`;
}
export const dispositivos = new Coleccion<FilaDispositivo>([]).persistirEn('mock.apoyo.dispositivos');

const CON_DISPOSITIVO_NUEVO: readonly string[] = ['lucia', 'marcos'];

/** Las reglas guardadas de una organización; sin ninguna, la de todas las cuentas por omisión. */
function reglasDe(tenantId: string): readonly SessionPolicy[] {
  const filas = politicasDeSesion.filtrar((p) => p.tenantId === tenantId);
  if (filas.length > 0) return filas.map(({ id: _id, tenantId: _t, ...politica }) => politica);
  return [{ scope: 'ALL_ACCOUNTS', idleTimeoutMinutes: 15, newDeviceAlert: true, enforceIpRules: false, requireMfa: false }];
}

function ordenar(politicas: readonly SessionPolicy[]): readonly SessionPolicy[] {
  const rango: Readonly<Record<SessionPolicyScope, number>> = { ALL_ACCOUNTS: 0, ORG_STAFF: 1, ROLE: 2 };
  return [...politicas].sort((a, b) => rango[a.scope] - rango[b.scope] || (a.roleCode ?? '').localeCompare(b.roleCode ?? ''));
}

/** Una cuenta de organización (o la plataforma) sobre ese tenant. */
function cuentaDeOrganizacion(user: MockUser | null, tenantId: string | null): boolean {
  if (user === null || tenantId === null) return false;
  if (user.roles.includes('SUPERADMIN')) return true;
  return user.accountKind === 'ORGANIZATION' && user.roles.includes('SECURITY_ADMIN') && user.tenants.includes(tenantId);
}

/** A quién alcanzan las reglas: el personal con vínculo o los doctores del hospital son «personal»; una cuenta de organización, solo «todas las cuentas». */
function audienciaDe(user: MockUser, tenantId: string): Audience {
  if (user.accountKind === 'ORGANIZATION') return { kind: 'ACCOUNT' };
  if (doctorDe(user) !== undefined) return { kind: 'ROLE', roleCode: 'PRACTITIONER' };
  const vinculo = vinculos.filtrar((v) => v.userId === user.id && v.tenantId === tenantId && v.status !== 'ENDED')[0];
  return vinculo !== undefined ? { kind: 'STAFF' } : { kind: 'ACCOUNT' };
}

/**
 * Lo que rige para esta persona **en esa organización**, o `undefined` si no definió nada (no hay nada que aplicar). La
 * política de una organización rige solo cuando la persona actúa en ella; sin organización, la primera de la cuenta.
 */
function reglasQueRigen(user: MockUser, organizacion?: string): EffectiveRules | undefined {
  const tenantId = organizacion ?? user.tenants[0];
  if (tenantId === undefined) return undefined;
  if (politicasDeSesion.filtrar((p) => p.tenantId === tenantId).length === 0) return undefined;
  return effectiveRules(reglasDe(tenantId), audienciaDe(user, tenantId));
}

/* ---- el token lleva el plazo de inactividad ---------------------------------- */

export { conPlazoDeInactividad } from './iam-token-claims';

function conPolitica<T>(respuesta: T, user: MockUser, organizacion?: string): T {
  if (typeof respuesta !== 'object' || respuesta === null || !('accessToken' in respuesta)) return respuesta;
  const reglas = reglasQueRigen(user, organizacion);
  if (reglas?.idleTimeoutMinutes === undefined) return respuesta;
  const sesion = respuesta as { accessToken: string };
  return { ...respuesta, accessToken: conPlazoDeInactividad(sesion.accessToken, reglas.idleTimeoutMinutes) };
}

/* ---- validar lo que llega ---------------------------------------------------- */

const ALCANCES: readonly string[] = ['ALL_ACCOUNTS', 'ORG_STAFF', 'ROLE'];
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Las mismas reglas que `SessionPolicyDto` de la API. */
function problemasDe(politicas: unknown): readonly { field: string; message: string }[] {
  if (!Array.isArray(politicas)) return [{ field: 'policies', message: 'debe ser una lista' }];
  if (politicas.length > 20) return [{ field: 'policies', message: 'no puede tener más de 20 reglas' }];
  const problemas: { field: string; message: string }[] = [];
  const vistas = new Set<string>();
  for (const [i, p] of (politicas as Partial<SessionPolicy>[]).entries()) {
    const donde = `policies.${i}`;
    if (typeof p.scope !== 'string' || !ALCANCES.includes(p.scope)) {
      problemas.push({ field: `${donde}.scope`, message: 'alcance no válido' });
      continue;
    }
    if (p.scope === 'ROLE' && (typeof p.roleCode !== 'string' || p.roleCode === '')) problemas.push({ field: `${donde}.roleCode`, message: 'falta el rol' });
    const clave = policyKey({ scope: p.scope, ...(p.roleCode === undefined ? {} : { roleCode: p.roleCode }) });
    if (vistas.has(clave)) problemas.push({ field: donde, message: 'hay dos reglas iguales' });
    vistas.add(clave);
    if (!Number.isInteger(p.idleTimeoutMinutes) || (p.idleTimeoutMinutes as number) < 5 || (p.idleTimeoutMinutes as number) > 1440) {
      problemas.push({ field: `${donde}.idleTimeoutMinutes`, message: 'debe estar entre 5 y 1440 minutos' });
    }
    for (const campo of ['newDeviceAlert', 'enforceIpRules', 'requireMfa'] as const) {
      if (typeof p[campo] !== 'boolean') problemas.push({ field: `${donde}.${campo}`, message: 'debe ser verdadero o falso' });
    }
    const horas = p.allowedHours;
    if (horas !== undefined && horas !== null) {
      const dias = horas.days;
      const diasValidos = dias === undefined || (Array.isArray(dias) && dias.length <= 7 && new Set(dias).size === dias.length && dias.every((d) => Number.isInteger(d) && d >= 0 && d <= 6));
      if (!diasValidos) problemas.push({ field: `${donde}.allowedHours.days`, message: 'los días van de 0 a 6, sin repetir' });
      if (typeof horas.from !== 'string' || !HHMM.test(horas.from)) problemas.push({ field: `${donde}.allowedHours.from`, message: 'debe ser HH:mm' });
      if (typeof horas.to !== 'string' || !HHMM.test(horas.to)) problemas.push({ field: `${donde}.allowedHours.to`, message: 'debe ser HH:mm' });
    }
  }
  return problemas;
}

/**
 * Los rechazos de **negocio** de `PUT /org/session-policies`, todos `422` con `details.reason`, que la API hace después de
 * validar el cuerpo:
 *
 * - `SESSION_POLICY_HOURS_EMPTY`: la hora de inicio y la de fin son iguales;
 * - `SESSION_POLICY_HOURS_TOO_SHORT`: la franja dura menos de 4 horas (`details.minimumMinutes`);
 * - `SESSION_POLICY_WOULD_LOCK_OUT_ACTOR`: dejaría fuera el horario en el que trabaja quien guarda;
 * - `IP_RULES_WOULD_LOCK_OUT_ACTOR`: con la red exigida, dejaría fuera la red desde la que trabaja quien guarda.
 */
function rechazoDeNegocio(politicas: readonly SessionPolicy[], tenantId: string, ahoraMismo: Date): MockReply | null {
  for (const p of politicas) {
    const horas = p.allowedHours;
    if (horas === undefined || horas === null) continue;
    if (horas.from === horas.to) {
      return conMotivo(422, 'La franja horaria no admite a nadie: la hora de inicio y la de fin son iguales', 'SESSION_POLICY_HOURS_EMPTY', { from: horas.from, to: horas.to });
    }
    if (hoursDurationMinutes(horas) < MIN_ALLOWED_HOURS_MINUTES) {
      return conMotivo(422, 'La franja horaria debe durar al menos 4 horas', 'SESSION_POLICY_HOURS_TOO_SHORT', { from: horas.from, to: horas.to, minimumMinutes: MIN_ALLOWED_HOURS_MINUTES });
    }
  }
  // Quien guarda es la cuenta de la organización: la alcanzan las reglas de «todas las cuentas» y las de su rol.
  const aplicables = effectiveRules(politicas, { kind: 'ACCOUNT' });
  const fuera = !aplicables.allowedHours.every((h) => { const { day, minutes } = weekdayAndMinutes(ahoraMismo, h.timeZone ?? DEFAULT_TIME_ZONE); return isAllowedAt(h, day, minutes); });
  if (fuera) return conMotivo(422, 'Esta política dejaría fuera el horario en el que está trabajando', 'SESSION_POLICY_WOULD_LOCK_OUT_ACTOR');
  if (aplicables.enforceIpRules) {
    const reglas = redesDeLaOrganizacion.filtrar((r) => r.tenantId === tenantId);
    if (evaluateIpRules(ORIGEN_SIMULADO, activeRules(reglas)) === 'DENIED') {
      return conMotivo(422, 'Estas reglas dejarían fuera la red desde la que está trabajando', 'IP_RULES_WOULD_LOCK_OUT_ACTOR');
    }
  }
  return null;
}

/* ---- las rutas --------------------------------------------------------------- */

function textoDeUsuario(request: MockRequest): string {
  const datos = cuerpo<{ email?: string; nationalId?: string }>(request);
  return datos.email ?? datos.nationalId ?? '';
}

const rechazo = (reason: string, message: string): MockReply =>
  reply(401, { statusCode: 401, code: 'UNAUTHENTICATED', message, error: 'Unauthorized', details: { reason } });

/** ¿Alguna regla que alcanza a esta persona en esa organización le exige los dos pasos? */
function exigeDosPasosEn(user: MockUser, tenantId: string): boolean {
  return reglasQueRigen(user, tenantId)?.requireMfa === true;
}

/** ¿Alguna regla que alcanza a esta persona le exige los dos pasos? */
function exigeDosPasos(user: MockUser): boolean {
  return user.tenants.some((t) => exigeDosPasosEn(user, t)) || reglasQueRigen(user)?.requireMfa === true;
}

/** Lo que pasó con cada organización de la cuenta al iniciar sesión: a cuáles entra y cuáles niegan, con su motivo. */
interface Acceso {
  readonly permitidas: readonly string[];
  readonly negadas: Readonly<Record<string, string>>;
  /** Un código de segundo factor que no sirve: rechaza el login entero (siempre 401 `MFA_INVALID`). */
  readonly codigoInvalido: boolean;
}

/**
 * Evalúa la política de **cada** organización de la cuenta, como la API: rige solo cuando la persona actúa en ella,
 * así que una que niega ahora (franja horaria, dos pasos) sale de la sesión y se declara en `deniedTenants` con su
 * motivo, y la persona entra a las demás. `alRefrescar`: el código del segundo factor se presentó al iniciar sesión, no
 * se vuelve a pedir.
 */
function evaluarAcceso(user: MockUser, mfaCode: string | undefined, alRefrescar: boolean): Acceso {
  const permitidas: string[] = [];
  const negadas: Record<string, string> = {};
  const ahoraMismo = new Date();
  for (const tenantId of user.tenants) {
    const reglas = reglasQueRigen(user, tenantId);
    if (reglas === undefined) {
      permitidas.push(tenantId);
      continue;
    }
    if (!reglas.allowedHours.every((h) => { const { day, minutes } = weekdayAndMinutes(ahoraMismo, h.timeZone ?? DEFAULT_TIME_ZONE); return isAllowedAt(h, day, minutes); })) {
      negadas[tenantId] = 'OUTSIDE_ALLOWED_HOURS';
      continue;
    }
    if (reglas.requireMfa) {
      if (!tieneFactorConfirmado(user)) {
        negadas[tenantId] = 'MFA_ENROLLMENT_REQUIRED';
        continue;
      }
      if (!alRefrescar) {
        if (mfaCode === undefined || mfaCode === '') {
          negadas[tenantId] = 'MFA_REQUIRED';
          continue;
        }
        if (mfaCode !== CODIGO_DE_PRUEBA) return { permitidas, negadas, codigoInvalido: true };
      }
    }
    permitidas.push(tenantId);
  }
  return { permitidas, negadas, codigoInvalido: false };
}

/**
 * Lo que la política hace con una sesión que se abre o se renueva: rechaza, deja entrar a todas, o deja entrar a
 * algunas y declara las que niegan. Igual que la API:
 *
 * - un código de segundo factor que no sirve: 401 `MFA_INVALID`;
 * - **ninguna** organización deja entrar: si todas niegan por falta del factor, el login **entra** con el token de alcance
 *   limitado (`mfaEnrollment: true`, sin roles ni organizaciones) y `mfaEnrollmentRequired: true`; si no, 401 con el motivo
 *   (`MFA_REQUIRED` pide el código; `OUTSIDE_ALLOWED_HOURS` bloquea);
 * - **alguna** deja entrar: el token lleva solo esas y `deniedTenants` el resto, en el claim y en la respuesta.
 */
function aplicarPolitica<T extends object>(respuesta: T, user: MockUser, mfaCode: string | undefined, alRefrescar: boolean): T | MockReply {
  if (!('accessToken' in respuesta)) return respuesta;
  const acceso = evaluarAcceso(user, mfaCode, alRefrescar);
  if (acceso.codigoInvalido) return rechazo('MFA_INVALID', 'El código de verificación no es válido o ya se usó');
  const motivos = Object.values(acceso.negadas);
  const base = respuesta as T & { accessToken: string };
  if (acceso.permitidas.length === 0 && motivos.length > 0) {
    if (motivos.every((m) => m === 'MFA_ENROLLMENT_REQUIRED')) {
      return { ...base, accessToken: conAlcanceLimitado(base.accessToken, acceso.negadas), mfaEnrollmentRequired: true, deniedTenants: Object.entries(acceso.negadas).map(([tenantId, reason]) => ({ tenantId, reason })) };
    }
    if (motivos.includes('MFA_REQUIRED')) return rechazo('MFA_REQUIRED', 'Se requiere el código de verificación en dos pasos');
    return rechazo('OUTSIDE_ALLOWED_HOURS', 'La política de sesión de su organización no permite entrar ahora');
  }
  const conPlazo = conPolitica(base, user, acuerdoDeInactividad(acceso));
  const token = motivos.length === 0 ? conPlazo.accessToken : conOrganizacionesNegadas(conPlazo.accessToken, acceso.permitidas, acceso.negadas);
  return {
    ...conPlazo,
    accessToken: token,
    ...(motivos.length === 0 ? {} : { deniedTenants: Object.entries(acceso.negadas).map(([tenantId, reason]) => ({ tenantId, reason })) }),
    ...(motivos.includes('MFA_ENROLLMENT_REQUIRED') ? { mfaEnrollmentRequired: true } : {}),
  };
}

/** La organización cuyo plazo de inactividad rige el token: la primera a la que se entra. */
const acuerdoDeInactividad = (acceso: Acceso): string | undefined => acceso.permitidas[0];

/** El aviso de dispositivo nuevo, si alguna regla lo pide y esta persona todavía no lo confirmó. */
function avisoDeDispositivo(user: MockUser): { deviceId: string; label: string; ip: string; occurredAt: string } | null {
  const reglas = reglasQueRigen(user);
  if (reglas === undefined || !reglas.newDeviceAlert || !CON_DISPOSITIVO_NUEVO.includes(user.key)) return null;
  const deviceId = uuid(`dispositivo-${user.key}`);
  const conocido = dispositivos.get(deviceId);
  if (conocido?.trusted === true) return null;
  if (conocido === undefined) dispositivos.agregar({ id: deviceId, userId: user.id, trusted: false });
  return { deviceId, label: 'Chrome en Windows · equipo nuevo', ip: '190.129.77.12', occurredAt: ahora() };
}

export function registrarApoyoSesion(router: MockRouter): void {
  router.get('/org/session-policies', (request) => {
    const tenantId = tenantDe(request);
    if (request.user === null) return unauthorized('Sin sesión');
    if (!cuentaDeOrganizacion(request.user, tenantId)) return forbidden('Solo la cuenta de la organización cambia sus controles de sesión.');
    return { policies: ordenar(reglasDe(tenantId!)) };
  });

  router.put('/org/session-policies', (request) => {
    const tenantId = tenantDe(request);
    if (request.user === null) return unauthorized('Sin sesión');
    if (!cuentaDeOrganizacion(request.user, tenantId)) return forbidden('Solo la cuenta de la organización cambia sus controles de sesión.');
    const nuevas = cuerpo<{ policies?: unknown }>(request).policies;
    const problemas = problemasDe(nuevas);
    if (problemas.length > 0) return validation('Revise los controles de sesión.', problemas);
    const rechazoDelNegocio = rechazoDeNegocio(nuevas as SessionPolicy[], tenantId!, new Date());
    if (rechazoDelNegocio !== null) return rechazoDelNegocio;
    for (const fila of politicasDeSesion.filtrar((p) => p.tenantId === tenantId)) politicasDeSesion.borrar(fila.id);
    for (const p of nuevas as SessionPolicy[]) {
      const { allowedHours, ...resto } = p;
      politicasDeSesion.agregar({ ...resto, ...(allowedHours === undefined || allowedHours === null ? {} : { allowedHours }), id: idDe(tenantId!, p), tenantId: tenantId! });
    }
    anotar(tenantId!, TENANT_NAMES[tenantId!] ?? 'La organización', 'session_policy.updated', 'Se cambiaron los controles de sesión de la organización.');
    return { policies: ordenar(reglasDe(tenantId!)) };
  });

  const noEncontrado = (): MockReply => reply(404, { statusCode: 404, code: 'NOT_FOUND', message: 'Dispositivo no encontrado', error: 'Not Found', details: { reason: 'DEVICE_NOT_FOUND' } });
  const rechazoDeDispositivo = (message: string, reason: string, details: Record<string, unknown> = {}): MockReply =>
    reply(422, { statusCode: 422, code: 'PRECONDITION_FAILED', message, error: 'Unprocessable Entity', reason, details: { ...details, reason } });

  /**
   * «Fui yo». Confirmar desde el propio dispositivo no prueba nada: solo vale desde una sesión en OTRO dispositivo de
   * confianza —el simulador no tiene segundas sesiones— o con el código de 8 dígitos que llega al correo verificado.
   * Sin él, 422 `DEVICE_CONFIRM_CODE_REQUIRED` (con `details.canRequestCode`); uno equivocado o ya usado, 422
   * `DEVICE_CONFIRM_CODE_INVALID`.
   */
  router.post('/iam/me/devices/:id/confirm', (request) => {
    if (request.user === null) return unauthorized('Sesión vencida');
    const id = request.params['id']!;
    const fila = dispositivos.get(id);
    if (fila === undefined || fila.userId !== request.user.id) return noEncontrado();
    if (fila.trusted) return { confirmed: true, deviceId: id };
    const codigo = cuerpo<{ code?: unknown }>(request).code;
    if (codigo === undefined) return rechazoDeDispositivo('Para confirmar este dispositivo hace falta el código enviado a su correo', 'DEVICE_CONFIRM_CODE_REQUIRED', { canRequestCode: true });
    if (typeof codigo !== 'string' || codigo.length !== 8) return validation('El código tiene 8 caracteres.', [{ field: 'code', message: 'debe tener 8 caracteres' }]);
    if (fila.codigoPedido !== true || codigo !== CODIGO_DE_DISPOSITIVO) return rechazoDeDispositivo('El código no es válido o ya se usó', 'DEVICE_CONFIRM_CODE_INVALID');
    dispositivos.actualizar(id, { trusted: true, codigoPedido: false });
    return { confirmed: true, deviceId: id };
  });

  /** Manda «al correo verificado» el código de un solo uso. Sin correo verificado no hay canal: 422. */
  router.post('/iam/me/devices/:id/confirm-code', (request) => {
    if (request.user === null) return unauthorized('Sesión vencida');
    const id = request.params['id']!;
    const fila = dispositivos.get(id);
    if (fila === undefined || fila.userId !== request.user.id) return noEncontrado();
    if (fila.trusted) return { sent: false };
    if (SIN_CORREO_VERIFICADO.includes(request.user.key)) return rechazoDeDispositivo('La cuenta no tiene un correo verificado al que enviar el código', 'DEVICE_CONFIRM_NO_VERIFIED_EMAIL');
    dispositivos.actualizar(id, { codigoPedido: true });
    return { sent: true, sentTo: correoEnmascarado(request.user.email) };
  });

  /** «No fui yo»: deja de ser de confianza y se cierran las demás sesiones, todo en una operación. */
  router.post('/iam/me/devices/:id/not-me', (request) => {
    if (request.user === null) return unauthorized('Sesión vencida');
    const id = request.params['id']!;
    const fila = dispositivos.get(id);
    if (fila === undefined || fila.userId !== request.user.id) return reply(404, { statusCode: 404, code: 'NOT_FOUND', message: 'Dispositivo no encontrado', error: 'Not Found', details: { reason: 'DEVICE_NOT_FOUND' } });
    dispositivos.actualizar(id, { trusted: false });
    return { revokedSessions: cerrarOtrasSesiones(request.user), deviceId: id };
  });

  registrarSeguridadPropia(router, exigeDosPasos);

  router.wrap('POST', '/iam/auth/login', (request, siguiente) => {
    const user = buscarUsuario(textoDeUsuario(request));
    if (user === undefined) return siguiente(request);
    // La contraseña se comprueba primero: sin ella no se revela nada de la política ni del segundo factor.
    if ((cuerpo<{ password?: string }>(request).password ?? '') === '') return siguiente(request);
    const base = siguiente(request);
    if (typeof base !== 'object' || base === null || !('accessToken' in base)) return base;
    const sesion = aplicarPolitica(base as object, user, cuerpo<{ mfaCode?: string }>(request).mfaCode, false);
    if (isMockReply(sesion) || !('accessToken' in sesion)) return sesion;
    // La sesión se abrió: el aviso de dispositivo nuevo que la API suma a la respuesta del login.
    const aviso = avisoDeDispositivo(user);
    return { ...sesion, ...(aviso === null ? {} : { newDevice: aviso }) };
  });

  router.wrap('POST', '/iam/auth/token/refresh', (request, siguiente) => {
    const user = usuarioDeRefreshToken(cuerpo<{ refreshToken?: string }>(request).refreshToken ?? '');
    const respuesta = siguiente(request);
    if (user === undefined) return respuesta;
    // El refresco vuelve a evaluar la política: conserva (o levanta) el alcance limitado y las organizaciones que niegan.
    return aplicarPolitica(respuesta as object, user, undefined, true);
  });
}
