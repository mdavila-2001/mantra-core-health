import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi, type Actor } from './actores';
import { entrar, esperarAplicacionLista } from './sesion';

/**
 * Una sola sesión real por archivo, para las specs de acciones contra la API
 * viva (carriles 15 y 31–41).
 *
 * ## Por qué una sola
 *
 * `POST /iam/auth/login` admite diez por minuto y por IP. Cada archivo entra
 * **una vez** por la pantalla de ingreso —como una persona— y comparte esa
 * página entre sus pruebas, que corren en serie. El token con el que se
 * prepara o se limpia por API no sale de un segundo login: se lee del
 * encabezado `Authorization` que el propio navegador manda, así que la cuenta
 * gasta un único intento por archivo.
 *
 * ## Por qué se salta y no falla
 *
 * Sin `E2E_API_REAL=1`, o con la API caída, la spec se **salta** con el motivo
 * a la vista. Un salto no es un verde: lo dice el motivo.
 */

/** `E2E_API_REAL=1` habilita estas specs. */
export const REAL_API = process.env['E2E_API_REAL'] === '1';

/** El motivo del salto cuando falta `E2E_API_REAL`. */
export const REAL_API_SKIP_REASON =
  'Omitido: hace falta E2E_API_REAL=1 con la API y el front en modo real-api. No es un verde.';

export interface RealSession {
  readonly page: Page;
  readonly api: APIRequestContext;
  /**
   * El último `Bearer` que mandó el navegador, con su `X-Tenant-Id`: sin él,
   * una cuenta con varias organizaciones vería otro alcance que la pantalla.
   */
  authHeaders(): Record<string, string>;
  /** El perfil profesional del token (`hpid`). */
  practitionerProfileId(): string;
  close(): Promise<void>;
}

function decodeJwt(token: string): Record<string, unknown> {
  const [, body] = token.split('.');
  return JSON.parse(Buffer.from(body ?? '', 'base64url').toString('utf8')) as Record<
    string,
    unknown
  >;
}

/**
 * Abre la sesión del archivo, o salta todas sus pruebas si no hay API.
 *
 * Se llama desde `test.beforeAll`. El salto ocurre **acá** y no en cada
 * prueba: un backend caído hace fallar cada prueba por un motivo distinto y
 * ninguno dice la verdad.
 *
 * @param browser - El navegador del worker.
 * @param actor - La cuenta con la que se entra.
 * @returns La sesión compartida del archivo.
 */
export async function openRealSession(browser: Browser, actor: Actor): Promise<RealSession> {
  const api = await contextoDeApi();
  const alive = await apiViva(api);
  if (!alive) await api.dispose();
  test.skip(!alive, `Omitido: la API no responde en ${urlDeApi()}/health. No es un verde.`);

  const page = await browser.newPage();
  let token: string | null = null;
  let tenant: string | null = null;
  const captureToken = (req: Request): void => {
    const headers = req.headers();
    const header = headers['authorization'];
    if (header?.startsWith('Bearer ')) {
      token = header.slice('Bearer '.length);
      tenant = headers['x-tenant-id'] ?? tenant;
    }
  };
  page.on('request', captureToken);

  await entrar(page, actor);
  await expect
    .poll(() => token, { message: 'el navegador nunca mandó un Bearer tras el ingreso' })
    .not.toBeNull();

  const current = (): string => {
    if (token === null) throw new Error('No hay token capturado del navegador.');
    return token;
  };

  return {
    page,
    api,
    authHeaders: () => ({
      Authorization: `Bearer ${current()}`,
      ...(tenant === null ? {} : { 'X-Tenant-Id': tenant }),
    }),
    practitionerProfileId: () => {
      const hpid = decodeJwt(current())['hpid'];
      if (typeof hpid !== 'string') throw new Error('El token no declara perfil profesional (hpid).');
      return hpid;
    },
    close: async () => {
      page.off('request', captureToken);
      await page.close();
      await api.dispose();
    },
  };
}

/**
 * Recarga la página completa y espera a que Angular hidrate.
 *
 * Cuesta un canje de refresh token (también limitado a diez por minuto): por
 * eso cada spec recarga sólo para comprobar lo persistido, no para navegar.
 */
export async function reloadApp(page: Page): Promise<void> {
  await page.reload();
  await esperarAplicacionLista(page);
}

/**
 * Espera la respuesta de una petición a la API que dispara `action`.
 *
 * @param page - La página.
 * @param method - Método HTTP.
 * @param path - Expresión que debe cumplir la URL.
 * @param action - La interacción que la dispara.
 * @returns La respuesta, para afirmar su estado y su cuerpo.
 */
export async function responseOf(
  page: Page,
  method: string,
  path: RegExp,
  action: () => Promise<unknown>,
): Promise<Response> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.request().method() === method && path.test(new URL(res.url()).pathname),
      { timeout: 30_000 },
    ),
    action(),
  ]);
  return response;
}

/** Sufijo único por corrida, para que los datos propios se reconozcan y se limpien. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`.toUpperCase();
}
