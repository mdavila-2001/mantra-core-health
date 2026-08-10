import express, { type Request, type Response, type Router } from 'express';

import {
  COOKIE_ESCENARIO,
  ESCENARIO_POR_DEFECTO,
  RUTA_ESCENARIO,
  RUTA_SALUD,
  resolverEscenario,
  type Escenario,
} from '../support/fixtures/escenarios';

/**
 * API simulada del arnés de pruebas.
 *
 * Responde los endpoints que la aplicación usa en los flujos que la suite
 * funcional cubre, con el **mismo contrato** que la API real: el sobre de error
 * de `docs/api/error-model.md` (`code`, `message`, `timestamp`, `path`) y el par
 * de tokens de `POST /iam/auth/login`.
 *
 * Qué responde en cada caso lo decide el escenario que la prueba dejó en una
 * cookie. Cypress limpia las cookies entre pruebas, así que ninguna hereda el
 * escenario de la anterior.
 *
 * ## Por qué del lado del servidor y no con `cy.intercept`
 *
 * Porque así la respuesta cruza **todo** lo que cruzaría en producción: el
 * servidor de renderizado, las cabeceras de seguridad y el interceptor de la
 * aplicación. Interceptar dentro del navegador —que es lo que hace la suite de
 * recorrido, y ahí está bien— saltea justamente las capas que las pruebas de
 * humo verifican.
 */

/** Código de error de la API, tal como lo declara `core/http/api-error.ts`. */
type CodigoError =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'CONFLICT'
  | 'DEPENDENCY_UNAVAILABLE';

function base64Url(valor: unknown): string {
  return Buffer.from(JSON.stringify(valor), 'utf8').toString('base64url');
}

/**
 * Un access token con los claims que la interfaz lee.
 *
 * No está firmado y no hace falta que lo esté: el frontend **no valida la
 * firma** —no puede, no tiene la clave— solo lee los claims. `exp` una hora
 * adelante evita que el refresco proactivo del interceptor dispare en cada
 * petición y las pruebas terminen midiendo otra cosa.
 */
function tokenDe(claims: Readonly<Record<string, unknown>> = {}): string {
  const payload = {
    sub: 'u-e2e',
    sid: 's-e2e',
    roles: ['PATIENT'],
    tenants: ['t-1'],
    name: 'Ana Salas',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  };
  return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url(payload)}.firma-de-prueba`;
}

function sesion(escenario: Escenario): Record<string, string> {
  return {
    accessToken: tokenDe(escenario.claims),
    refreshToken: 'refresh-de-prueba',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  };
}

function error(res: Response, estado: number, code: CodigoError, message: string): void {
  res.status(estado).json({
    code,
    message,
    timestamp: new Date().toISOString(),
    path: res.req.path,
    correlationId: `e2e-${Date.now()}`,
  });
}

/** Lee el escenario de la cookie. Sin cookie, el de por defecto. */
function escenarioDe(req: Request): Escenario {
  const crudo = req.headers.cookie ?? '';
  const entrada = crudo
    .split(';')
    .map((parte) => parte.trim())
    .find((parte) => parte.startsWith(`${COOKIE_ESCENARIO}=`));
  const nombre = entrada?.slice(COOKIE_ESCENARIO.length + 1);
  return resolverEscenario(nombre === undefined ? undefined : decodeURIComponent(nombre));
}

/**
 * Aplica la demora del escenario, cuando lo pide.
 *
 * Es la única espera por tiempo de toda la suite y está del lado del
 * **servidor**: existe para que haya un estado de carga que observar, no para
 * sincronizar nada. Las pruebas siguen esperando por condiciones.
 */
async function demorar(escenario: Escenario): Promise<void> {
  if (escenario.demoraMs === undefined) {
    return;
  }
  await new Promise((resolver) => setTimeout(resolver, escenario.demoraMs));
}

function registrosDirectorio(cuantos: number): unknown[] {
  return Array.from({ length: cuantos }, (_, indice) => ({
    id: `org-${indice + 1}`,
    name: `Centro de salud ${indice + 1}`,
    kind: 'CLINIC',
    city: 'Santa Cruz de la Sierra',
  }));
}

/**
 * Cuántas veces se pidió cada cosa.
 *
 * Lo consulta la prueba de sesión persistente, que necesita afirmar que la
 * recarga **canjeó el refresh token** y no simplemente que terminó en el panel.
 * Sin este contador, esa prueba pasaría igual si la recuperación de sesión
 * dejara de existir y el guard se volviera permisivo.
 *
 * Vive en el arnés y se consulta con `cy.task('contadores')`, porque el
 * contador tiene que estar del lado que ve las peticiones de verdad.
 */
export interface Contadores {
  logins: number;
  refrescos: number;
}

const contadores: Contadores = { logins: 0, refrescos: 0 };

export function leerContadores(): Contadores {
  return { ...contadores };
}

export function reiniciarContadores(): void {
  contadores.logins = 0;
  contadores.refrescos = 0;
}

export function crearApiSimulada(): Router {
  const router = express.Router();
  router.use(express.json());

  // --- Control del arnés -----------------------------------------------------

  router.get(RUTA_SALUD, (_req, res) => {
    res.json({ estado: 'listo', escenarioPorDefecto: ESCENARIO_POR_DEFECTO });
  });

  /**
   * Fija el escenario y redirige a la pantalla pedida.
   *
   * Una sola navegación: la cookie viaja en la respuesta del redirect, así que
   * cuando la aplicación arranca y pide datos, la API ya sabe qué responder.
   */
  router.get(RUTA_ESCENARIO, (req, res) => {
    const id = String(req.query['id'] ?? ESCENARIO_POR_DEFECTO);
    const destinoCrudo = String(req.query['destino'] ?? '/');
    // Solo rutas internas: un destino absoluto convertiría al arnés en un
    // redirector abierto, y no hay ninguna razón para que exista uno.
    const destino = destinoCrudo.startsWith('/') && !destinoCrudo.startsWith('//')
      ? destinoCrudo
      : '/';

    res.cookie(COOKIE_ESCENARIO, id, { path: '/', httpOnly: false, sameSite: 'lax' });
    res.redirect(302, destino);
  });

  // --- iam: sesión -----------------------------------------------------------

  router.post('/iam/auth/login', async (req, res) => {
    const escenario = escenarioDe(req);
    contadores.logins += 1;
    await demorar(escenario);

    if (escenario.loginValido === false) {
      error(res, 401, 'UNAUTHENTICATED', 'Las credenciales no son válidas.');
      return;
    }
    res.json(sesion(escenario));
  });

  router.post('/iam/auth/token/refresh', async (req, res) => {
    const escenario = escenarioDe(req);
    contadores.refrescos += 1;
    await demorar(escenario);

    if (escenario.refrescoValido === false) {
      error(res, 401, 'UNAUTHENTICATED', 'El refresh token no es válido.');
      return;
    }
    res.json(sesion(escenario));
  });

  router.post('/iam/auth/logout', (_req, res) => {
    res.status(200).json({});
  });

  // --- iam: alta de cuentas --------------------------------------------------

  router.post('/iam/auth/register-patient', async (req, res) => {
    const escenario = escenarioDe(req);
    await demorar(escenario);

    if (escenario.registroValido === false) {
      error(res, 409, 'CONFLICT', 'Ya existe una cuenta con ese documento.');
      return;
    }
    const cuerpo = req.body as { email?: string };
    res.status(201).json({
      userId: 'u-nuevo',
      personId: 'per-nuevo',
      patientProfileId: 'pp-nuevo',
      patientCode: 'PAC-0001',
      emailVerificationSent: typeof cuerpo.email === 'string' && cuerpo.email !== '',
    });
  });

  router.post('/iam/auth/register-practitioner', async (req, res) => {
    const escenario = escenarioDe(req);
    await demorar(escenario);

    if (escenario.registroValido === false) {
      error(res, 409, 'CONFLICT', 'Ya existe una cuenta con ese correo.');
      return;
    }
    res.status(201).json({
      userId: 'u-pro',
      personId: 'per-pro',
      practitionerProfileId: 'prp-pro',
      practitionerCode: 'PRO-0001',
    });
  });

  // --- iam: recuperación -----------------------------------------------------

  router.post('/iam/auth/forgot-password', async (req, res) => {
    await demorar(escenarioDe(req));
    // La API real responde lo mismo exista o no la cuenta: lo contrario
    // permitiría averiguar quién está registrado probando direcciones.
    res.json({ message: 'Si la cuenta existe, te enviamos un enlace.' });
  });

  router.post('/iam/auth/reset-password', async (req, res) => {
    const escenario = escenarioDe(req);
    await demorar(escenario);

    if (escenario.tokenValido === false) {
      error(res, 400, 'VALIDATION_FAILED', 'El enlace venció o ya se usó.');
      return;
    }
    // `revokedSessions` es lo que la pantalla muestra en palabras: cambiar la
    // contraseña cierra las demás sesiones, y decirlo es parte del contrato.
    res.json({ userId: 'u-e2e', revokedSessions: escenario.sesionesRevocadas ?? 0 });
  });

  router.post('/iam/auth/verify-email', async (req, res) => {
    const escenario = escenarioDe(req);
    await demorar(escenario);

    if (escenario.tokenValido === false) {
      error(res, 400, 'VALIDATION_FAILED', 'El enlace venció o ya se usó.');
      return;
    }
    res.json({ userId: 'u-e2e', emailVerified: true });
  });

  // --- público ---------------------------------------------------------------

  router.get('/public/directory', async (req, res) => {
    const escenario = escenarioDe(req);
    await demorar(escenario);

    if (escenario.directorioCaido === true) {
      error(res, 503, 'DEPENDENCY_UNAVAILABLE', 'El directorio no está disponible.');
      return;
    }

    res.json({
      slug: 'directory',
      records: registrosDirectorio(escenario.registrosDirectorio ?? 0),
      refreshedAt: escenario.registrosDirectorio === undefined ? null : new Date().toISOString(),
      generatedAt: new Date().toISOString(),
    });
  });

  return router;
}
