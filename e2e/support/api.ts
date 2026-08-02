import type { Page, Route } from '@playwright/test';

/**
 * Simulación de la API para las pruebas de extremo a extremo.
 *
 * Los journeys que estas pruebas cubren son de **navegación, estado y
 * persistencia**: que la sesión sobreviva a un `F5`, que el guard redirija, que
 * elegir organización lleve al panel. Ninguno depende del contrato — eso es
 * otra capa y otra herramienta.
 *
 * Con la red simulada no hace falta base de datos, ni datos sembrados, ni una
 * API levantada, y **el resultado es el mismo en cada corrida**. Una suite E2E
 * que falla al azar se termina ignorando, que es peor que no tenerla.
 */

/** base64url sobre UTF-8, como el token real. */
function b64(valor: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(valor));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Un access token con los claims que la interfaz lee.
 *
 * `exp` una hora adelante: sin él, el refresco proactivo del interceptor
 * dispararía en cada petición y las pruebas medirían otra cosa.
 */
export function tokenDe(claims: Record<string, unknown> = {}): string {
  const payload = {
    sub: 'u-e2e',
    sid: 's-e2e',
    roles: ['PATIENT'],
    tenants: ['t-1'],
    name: 'Ana Salas',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

export interface ApiSimulada {
  /** Cuántas veces se pidió un refresco. Lo usa la prueba de sesión persistente. */
  refrescos: () => number;
  /** Cuántos inicios de sesión. */
  logins: () => number;
}

/**
 * Intercepta las rutas de la API y responde lo que la prueba necesite.
 *
 * Se registra **antes** de navegar: una ruta interceptada después de que la
 * petición salió no intercepta nada.
 */
export async function simularApi(
  page: Page,
  opciones: {
    /** Claims del token que devuelve el login. */
    claims?: Record<string, unknown>;
    /** `false` hace fallar el login con credenciales inválidas. */
    loginValido?: boolean;
    /** `false` hace fallar el canje del refresh token. */
    refrescoValido?: boolean;
    /** Registros que devuelve el directorio del panel. */
    directorio?: { records: unknown[]; refreshedAt: string | null };
  } = {},
): Promise<ApiSimulada> {
  const {
    claims = {},
    loginValido = true,
    refrescoValido = true,
    directorio = { records: [], refreshedAt: null },
  } = opciones;

  let refrescos = 0;
  let logins = 0;

  const sesion = () => ({
    accessToken: tokenDe(claims),
    refreshToken: 'r-e2e',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  });

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

  await page.route('**/iam/auth/login', (route) => {
    logins += 1;
    return loginValido
      ? json(route, sesion())
      : json(
          route,
          {
            code: 'UNAUTHENTICATED',
            message: 'Credenciales inválidas',
            timestamp: new Date().toISOString(),
            path: '/iam/auth/login',
          },
          401,
        );
  });

  await page.route('**/iam/auth/token/refresh', (route) => {
    refrescos += 1;
    return refrescoValido
      ? json(route, sesion())
      : json(
          route,
          {
            code: 'UNAUTHENTICATED',
            message: 'Refresh token inválido',
            timestamp: new Date().toISOString(),
            path: '/iam/auth/token/refresh',
          },
          401,
        );
  });

  await page.route('**/iam/auth/logout', (route) => json(route, {}));

  await page.route('**/public/directory*', (route) =>
    json(route, {
      slug: 'directory',
      records: directorio.records,
      refreshedAt: directorio.refreshedAt,
      generatedAt: new Date().toISOString(),
    }),
  );

  await page.route('**/iam/auth/forgot-password', (route) =>
    json(route, { message: 'Si la cuenta existe, te enviamos un enlace.' }),
  );

  return { refrescos: () => refrescos, logins: () => logins };
}

/**
 * Entra con las credenciales de prueba.
 *
 * La contraseña se localiza por `type="password"` y no por su etiqueta: el
 * campo lleva dentro un botón de mostrar/ocultar cuyo nombre accesible también
 * dice «contraseña», así que buscar por etiqueta devuelve dos elementos. No es
 * un defecto —el botón está bien nombrado— pero hay que desambiguar.
 */
export async function iniciarSesion(page: Page): Promise<void> {
  await page.goto('/auth');
  await page.getByLabel(/correo o documento/i).fill('ana@mantra.test');
  await page.locator('input[type="password"]').fill('secreto-de-prueba');
  await page.getByRole('button', { name: /^entrar$/i }).click();
}
