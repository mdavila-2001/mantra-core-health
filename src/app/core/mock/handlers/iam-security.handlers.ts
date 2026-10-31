import { evaluateIpRules, isValidCidr, activeRules } from '../../data-access/support-access/ip-rules';
import type { IpAccessRule } from '../../data-access/support-access/support-access.types';
import { forbidden, notFound, unauthorized, validation, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { TENANT_NAMES, type MockUser } from '../mock-session';
import { Coleccion, ahora, cuerpo, nuevoId, uuid } from '../mock-store';
import { CODIGO_DE_PRUEBA, factores, factoresDe, secretoNuevo } from './iam-mfa.store';
import { anotar, esCuentaDeLaOrganizacion, tenantDe } from './support-access.core';
import { conMotivo } from './support-access.errors';

/* ============================================================================
    La seguridad de la propia cuenta y las redes de la organización, con la forma
    de la API (`iam/presentation/controllers`):

    - `GET /iam/me/mfa`, `POST /iam/me/mfa/totp`, `POST /iam/me/mfa/totp/:id/confirm`
      (422 `MFA_CODE_INVALID`) y `POST /iam/me/mfa/:id/revoke` → `{ revoked, remainingVerified }`;
    - dar de alta y quitar un método **exigen reautenticación**: `currentPassword` o `mfaCode` (código vigente de
      un factor ya verificado). Sin ninguna, 422 `MFA_REAUTH_REQUIRED`; si no valen, 422 `MFA_REAUTH_FAILED`. El
      simulador acepta cualquier contraseña salvo `incorrecta`, y el código `123456` si la cuenta tiene un factor;
    - `GET|PUT /org/ip-access-rules` (máx. 50; 422 `IP_RULE_CIDR_INVALID`,
      `IP_RULE_VALIDITY_INVALID`, `IP_RULES_WOULD_LOCK_OUT_ACTOR`).

    El navegador no tiene una red de organización contra la que comparar, así que el
    simulador usa un **origen fijo** (`ORIGEN_SIMULADO`) como la dirección de quien
    guarda: es lo que la API lee de `req.ip`. Con él se reproduce el rechazo por un
    conjunto que dejaría afuera a quien lo guarda. El inicio de sesión **no** rechaza
    por red: el origen es siempre el mismo y un conjunto que lo bloquee no se puede guardar.
   ========================================================================== */

/** Desde dónde «trabaja» cualquier persona en el simulador; coincide con la IP de la sesión actual de `auth.handlers`. */
export const ORIGEN_SIMULADO = '190.129.10.4';

interface FilaRed extends IpAccessRule {
  readonly id: string;
  readonly tenantId: string;
}

const MAX_REGLAS = 50;

/**
 * Cuántos saltos de proxy de confianza tiene el «servidor» del simulador (`TRUST_PROXY_HOPS`). Con 1 la dirección que
 * se ve es la de quien entra; con 0 se vería la del proxy. Las pruebas lo cambian para ver el aviso.
 */
let saltosDeProxy = 1;
export function fijarSaltosDeProxy(saltos: number): void {
  saltosDeProxy = saltos;
}

export const redesDeLaOrganizacion = new Coleccion<FilaRed>([]).persistirEn('mock.iam.redes');

const sinSesion = (): MockReply => unauthorized('Sesión vencida');

function vistaDeRegla(r: FilaRed): IpAccessRule & { id: string } {
  const { tenantId: _t, ...resto } = r;
  return resto;
}

/** Las mismas validaciones que `PutIpAccessRulesDto` (400) y que el servicio (422). */
function problemasDelCuerpo(reglas: unknown): readonly { field: string; message: string }[] {
  if (!Array.isArray(reglas)) return [{ field: 'rules', message: 'debe ser una lista' }];
  if (reglas.length > MAX_REGLAS) return [{ field: 'rules', message: `no puede tener más de ${MAX_REGLAS} reglas` }];
  const problemas: { field: string; message: string }[] = [];
  (reglas as Partial<IpAccessRule>[]).forEach((r, i) => {
    if (r.type !== 'ALLOW' && r.type !== 'DENY') problemas.push({ field: `rules.${i}.type`, message: 'debe ser ALLOW o DENY' });
    if (typeof r.cidr !== 'string' || r.cidr.length > 64) problemas.push({ field: `rules.${i}.cidr`, message: 'debe ser un texto de hasta 64 caracteres' });
    if (r.description !== undefined && (typeof r.description !== 'string' || r.description.length > 200)) problemas.push({ field: `rules.${i}.description`, message: 'debe ser un texto de hasta 200 caracteres' });
    for (const campo of ['validFrom', 'validTo'] as const) {
      const valor = r[campo];
      if (valor !== undefined && (typeof valor !== 'string' || Number.isNaN(new Date(valor).getTime()))) problemas.push({ field: `rules.${i}.${campo}`, message: 'debe ser una fecha ISO 8601' });
    }
  });
  return problemas;
}

function organizacionDe(request: MockRequest): { tenantId: string } | MockReply {
  const tenantId = tenantDe(request);
  if (request.user === null) return sinSesion();
  if (!esCuentaDeLaOrganizacion(request.user, tenantId)) return forbidden('Solo la cuenta de la organización cambia sus redes.');
  return { tenantId: tenantId! };
}

const esFallo = (valor: { tenantId: string } | MockReply): valor is MockReply => 'status' in valor;

/** La contraseña que el simulador da por equivocada (acepta cualquier otra no vacía). */
export const CONTRASENA_INCORRECTA = 'incorrecta';

/**
 * La reautenticación de `assertReauthenticated` de la API: contraseña actual **o** código de un factor ya
 * verificado. `null` si vale; si no, el 422 con su motivo.
 */
function reautenticacion(user: MockUser, datos: { currentPassword?: unknown; mfaCode?: unknown }): MockReply | null {
  const contrasena = typeof datos.currentPassword === 'string' && datos.currentPassword !== '' ? datos.currentPassword : undefined;
  const codigo = typeof datos.mfaCode === 'string' && datos.mfaCode !== '' ? datos.mfaCode : undefined;
  if (contrasena === undefined && codigo === undefined) {
    return conMotivo(422, 'Para esto hace falta confirmar su identidad: escriba su contraseña actual o el código de su aplicación', 'MFA_REAUTH_REQUIRED');
  }
  const contrasenaVale = contrasena !== undefined && contrasena !== CONTRASENA_INCORRECTA;
  const codigoVale = codigo !== undefined && codigo === CODIGO_DE_PRUEBA && factoresDe(user).some((f) => f.state === 'VERIFIED');
  return contrasenaVale || codigoVale ? null : conMotivo(422, 'La contraseña o el código no son correctos', 'MFA_REAUTH_FAILED');
}

function faltaCodigo(): MockReply {
  return validation('El código tiene entre 6 y 8 caracteres.', [{ field: 'code', message: 'debe tener entre 6 y 8 caracteres' }]);
}

/**
 * Registra las rutas. `exigeDosPasos` dice si alguna regla de sesión le exige el segundo
 * paso a esa persona: lo conoce el módulo de la política, que no se importa desde acá.
 */
export function registrarSeguridadPropia(router: MockRouter, exigeDosPasos: (user: MockUser) => boolean): void {
  /** `GET /iam/me/network`: la dirección con que la API ve esta conexión, su familia y los saltos de proxy de confianza. */
  router.get('/iam/me/network', ({ user }) => {
    if (user === null) return sinSesion();
    return { ip: ORIGEN_SIMULADO, family: 'ipv4', trustProxyHops: saltosDeProxy };
  });

  router.get('/iam/me/mfa', ({ user }) => {
    if (user === null) return sinSesion();
    const lista = factoresDe(user);
    const enrolled = lista.some((f) => f.state === 'VERIFIED');
    const required = exigeDosPasos(user);
    return {
      required,
      enrolled,
      enrollmentRequired: required && !enrolled,
      factors: lista.map((f) => ({
        id: f.id,
        type: f.type,
        state: f.state,
        label: f.label,
        ...(f.verifiedAt === undefined ? {} : { verifiedAt: f.verifiedAt }),
        createdAt: f.createdAt,
      })),
    };
  });

  router.post('/iam/me/mfa/totp', (request) => {
    const user = request.user;
    if (user === null) return sinSesion();
    const etiqueta = cuerpo<{ label?: string }>(request).label;
    // Antes de tocar nada: sin reautenticar no se retira ni se crea ningún factor.
    const reauth = reautenticacion(user, cuerpo<{ currentPassword?: unknown; mfaCode?: unknown }>(request));
    if (reauth !== null) return reauth;
    // Retira los intentos anteriores sin confirmar: no se acumulan secretos que nadie va a usar.
    for (const f of factores.filtrar((x) => x.userId === user.id && x.state === 'PENDING')) factores.actualizar(f.id, { state: 'REVOKED' });
    const secret = secretoNuevo();
    const fila = factores.agregar({
      id: nuevoId('factor'),
      userId: user.id,
      type: 'TOTP',
      state: 'PENDING',
      label: etiqueta === undefined || etiqueta === '' ? 'Aplicación autenticadora' : etiqueta,
      secret,
      createdAt: ahora(),
    });
    // `MfaFactorResponseDto`: el id, el estado y, solo esta vez, el secreto y la URI del QR.
    return {
      status: 201,
      body: {
        id: fila.id,
        userId: user.id,
        state: uuid('estado-factor-pendiente'),
        secret,
        otpauthUri: `otpauth://totp/Alovida:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Alovida&algorithm=SHA1&digits=6&period=30`,
      },
    };
  });

  router.post('/iam/me/mfa/totp/:factorId/confirm', (request) => {
    const user = request.user;
    if (user === null) return sinSesion();
    const codigo = cuerpo<{ code?: unknown }>(request).code;
    if (typeof codigo !== 'string' || codigo.length < 6 || codigo.length > 8) return faltaCodigo();
    const fila = factores.get(request.params['factorId']!);
    if (fila === undefined || fila.userId !== user.id || fila.state !== 'PENDING') return notFound('El factor no existe o ya no está pendiente.');
    if (codigo !== CODIGO_DE_PRUEBA) {
      return conMotivo(422, 'El código de verificación no es válido', 'MFA_CODE_INVALID');
    }
    const verifiedAt = ahora();
    factores.actualizar(fila.id, { state: 'VERIFIED', verifiedAt });
    return { verified: true, factorId: fila.id, verifiedAt };
  });

  /** Quitar un método propio: misma reautenticación que agregarlo; si era el último confirmado, el segundo paso queda apagado. */
  router.post('/iam/me/mfa/:factorId/revoke', (request) => {
    const user = request.user;
    if (user === null) return sinSesion();
    const reauth = reautenticacion(user, cuerpo<{ currentPassword?: unknown; mfaCode?: unknown }>(request));
    if (reauth !== null) return reauth;
    const fila = factores.get(request.params['factorId']!);
    if (fila === undefined || fila.userId !== user.id || fila.state === 'REVOKED') {
      return conMotivo(404, 'Factor MFA no encontrado', 'MFA_FACTOR_NOT_FOUND');
    }
    factores.actualizar(fila.id, { state: 'REVOKED' });
    return { revoked: true, remainingVerified: factoresDe(user).filter((f) => f.state === 'VERIFIED').length };
  });

  router.get('/org/ip-access-rules', (request) => {
    const acceso = organizacionDe(request);
    if (esFallo(acceso)) return acceso;
    return { rules: redesDeLaOrganizacion.filtrar((r) => r.tenantId === acceso.tenantId).map(vistaDeRegla) };
  });

  router.put('/org/ip-access-rules', (request) => {
    const acceso = organizacionDe(request);
    if (esFallo(acceso)) return acceso;
    const nuevas = cuerpo<{ rules?: unknown }>(request).rules;
    const problemas = problemasDelCuerpo(nuevas);
    if (problemas.length > 0) return validation('Revise las reglas de red.', problemas);
    const reglas = nuevas as IpAccessRule[];
    for (const r of reglas) {
      if (!isValidCidr(r.cidr)) {
        return conMotivo(422, 'El rango de red no es un CIDR válido (ejemplo: 190.129.0.0/16)', 'IP_RULE_CIDR_INVALID', { cidr: r.cidr });
      }
      if (r.validFrom !== undefined && r.validTo !== undefined && new Date(r.validTo).getTime() <= new Date(r.validFrom).getTime()) {
        return conMotivo(422, 'La regla termina antes de empezar', 'IP_RULE_VALIDITY_INVALID', { cidr: r.cidr });
      }
    }
    // No se guarda un conjunto que deje fuera el origen de quien lo guarda.
    if (evaluateIpRules(ORIGEN_SIMULADO, activeRules(reglas)) === 'DENIED') {
      return conMotivo(422, 'Estas reglas dejarían fuera la red desde la que está trabajando', 'IP_RULES_WOULD_LOCK_OUT_ACTOR');
    }
    for (const fila of redesDeLaOrganizacion.filtrar((r) => r.tenantId === acceso.tenantId)) redesDeLaOrganizacion.borrar(fila.id);
    for (const r of reglas) {
      redesDeLaOrganizacion.agregar({
        id: nuevoId('red'),
        tenantId: acceso.tenantId,
        type: r.type,
        cidr: r.cidr.trim(),
        ...(r.description === undefined || r.description === '' ? {} : { description: r.description }),
        ...(r.validFrom === undefined ? {} : { validFrom: r.validFrom }),
        ...(r.validTo === undefined ? {} : { validTo: r.validTo }),
      });
    }
    anotar(acceso.tenantId, TENANT_NAMES[acceso.tenantId] ?? 'La organización', 'session_policy.updated', 'Se cambiaron las redes desde las que se puede entrar.');
    return { rules: redesDeLaOrganizacion.filtrar((r) => r.tenantId === acceso.tenantId).map(vistaDeRegla) };
  });
}
