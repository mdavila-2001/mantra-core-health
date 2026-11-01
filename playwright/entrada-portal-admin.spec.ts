import { expect, test, type Page, type Request } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrarYObservar, esperarAplicacionLista } from './support/sesion';

/**
 * Kill-test de la entrada del Portal Admin (frente 01 §5 de
 * `docs/trabajo/2026-10-31-portal-observabilidad-gobierno/`).
 *
 * > Entro como Portal Admin de AloVida contra la API REAL y no veo selección de organización;
 * > aterrizo en el panel.
 *
 * Corre contra `ng serve` (`yarn start:real-api`) con el proxy hacia la API local con Postgres. **No vale contra
 * el simulador**: una corrida con `mockBackend` no prueba nada de esto.
 *
 * Cuentas (clave `12345678`, ver `evidencia-f0/ENTORNO.md`), sobreescribibles por entorno:
 *   - `E2E_PLAT_SUPERADMIN`  SUPERADMIN con 2+ membresías activas.
 *   - `E2E_PLAT_ADMIN`       PLATFORM_ADMIN global, sin SUPERADMIN.
 *   - `E2E_PLAT_MEDICO`      rol de persona con 2+ membresías, sin rol de plataforma (control negativo).
 *
 * Sin `networkidle` (con HMR no llega): se espera por elementos, URLs y respuestas concretas. Serie, un solo
 * navegador (`playwright.config.ts`); se corre con `flock /tmp/pw.lock`.
 */
const CLAVE = process.env['E2E_PLAT_CLAVE'] ?? '12345678';
const SUPERADMIN = process.env['E2E_PLAT_SUPERADMIN'] ?? 'admin@alovidasalud.com';
const PLATAFORMA = process.env['E2E_PLAT_ADMIN'] ?? 'plataforma@alovida.test';
const PRACTITIONER_ACCOUNT = process.env['E2E_PLAT_MEDICO'] ?? 'medico2org@alovida.test';

/** Rutas que NO pueden aparecer en el aterrizaje de una cuenta de plataforma. */
const PROHIBIDAS = [/^\/auth\/organization/, /^\/portal-selector/];

interface Peticion {
  readonly url: string;
  readonly tenant: string | undefined;
  status?: number;
  requestId?: string | undefined;
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

/** Entra sin hacer clic en nada (`entrarYObservar`) y devuelve cada ruta por la que pasó el documento tras el envío. */
async function entrar(page: Page, identificador: string): Promise<readonly string[]> {
  const actor: Actor = { rol: 'administrador', identificador, clave: CLAVE, nombre: identificador };
  return (await entrarYObservar(page, actor)).rutas;
}

/** Anota cada `GET /admin/ops/traffic` con su cabecera `x-tenant-id` y su respuesta. */
function vigilarTrafico(page: Page): Peticion[] {
  const vistas: Peticion[] = [];
  const byRequest = new Map<Request, Peticion>();
  page.on('request', (r) => {
    if (r.method() === 'GET' && new URL(r.url()).pathname === '/admin/ops/traffic') {
      const p: Peticion = { url: r.url(), tenant: r.headers()['x-tenant-id'] };
      byRequest.set(r, p);
      vistas.push(p);
    }
  });
  page.on('response', (respuesta) => {
    const p = byRequest.get(respuesta.request());
    if (p) {
      p.status = respuesta.status();
      p.requestId = respuesta.headers()['x-request-id'];
    }
  });
  return vistas;
}

for (const [titulo, cuenta] of [
  ['SUPERADMIN con 2+ membresías', SUPERADMIN],
  ['PLATFORM_ADMIN (sin SUPERADMIN)', PLATAFORMA],
] as const) {
  test(`${titulo}: aterriza en el Centro de la plataforma, sin elegir organización y sin X-Tenant-Id`, async ({ browser }) => {
    const contexto = await browser.newContext();
    const page = await contexto.newPage();
    const trafico = vigilarTrafico(page);

    const rutas = await entrar(page, cuenta);

    // 2. Primera navegación /dashboard; nunca /auth/organization ni /portal-selector.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    const tras = rutas.filter((r) => !r.startsWith('/auth') || PROHIBIDAS.some((p) => p.test(r)));
    expect(tras[0], `rutas: ${rutas.join(' -> ')}`).toMatch(/^\/(dashboard)?(\?.*)?$/);
    for (const prohibida of PROHIBIDAS) {
      expect(rutas.filter((r) => prohibida.test(r)), `rutas: ${rutas.join(' -> ')}`).toEqual([]);
    }

    // 3. El armazón rotula «Toda la plataforma».
    await expect(page.getByTestId('header-organization')).toContainText('Toda la plataforma', { timeout: 30_000 });

    // 5. El bloque «API hoy» tiene datos (ni esqueleto ni error) a los 10 s.
    await expect(page.getByTestId('centro-requests')).toBeVisible({ timeout: 10_000 });

    // 4. En la red: GET /admin/ops/traffic -> 200, sin x-tenant-id, con x-request-id.
    await expect.poll(() => trafico.find((t) => t.status !== undefined)?.status, { timeout: 10_000 }).toBe(200);
    const primera = trafico.find((t) => t.status !== undefined)!;
    expect(primera.tenant, 'la petición no debe llevar x-tenant-id').toBeUndefined();
    expect(primera.requestId, 'la respuesta lleva x-request-id').toBeTruthy();

    await contexto.close();
  });
}

test('SUPERADMIN: fijar una organización manda X-Tenant-Id; «Toda la plataforma» lo quita (H3)', async ({ browser }) => {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  const trafico = vigilarTrafico(page);
  await entrar(page, SUPERADMIN);
  await expect(page.getByTestId('centro-requests')).toBeVisible({ timeout: 30_000 });

  // UI -> fijar organización -> la siguiente petición lleva la cabecera.
  await page.getByTestId('header-organization').click();
  const opciones = page.locator('#menu-organizaciones .app-menu-item:not([data-testid="header-organization-platform"])');
  await expect(opciones.first()).toBeVisible();
  const orgName = (await opciones.first().innerText()).trim();
  const antes = trafico.length;
  await opciones.first().click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId('header-organization')).toContainText(orgName, { timeout: 15_000 });
  // El panel ya estaba cargado: «Actualizar» fuerza la lectura siguiente, que es la que debe llevar la cabecera.
  await page.getByRole('button', { name: 'Actualizar' }).click();
  await expect.poll(() => trafico.slice(antes).find((t) => t.status !== undefined)?.tenant, { timeout: 15_000 }).toBeTruthy();

  // Recarga: la elección se recuerda (localStorage) y el rótulo sigue siendo la organización.
  await page.reload();
  await esperarAplicacionLista(page);
  await expect(page.getByTestId('header-organization')).toContainText(orgName, { timeout: 30_000 });

  // Camino inverso: «Toda la plataforma» -> la cabecera deja de viajar.
  await page.getByTestId('header-organization').click();
  const despues = trafico.length;
  await page.getByTestId('header-organization-platform').click();
  await expect(page.getByTestId('header-organization')).toContainText('Toda la plataforma', { timeout: 15_000 });
  await page.getByRole('button', { name: 'Actualizar' }).click();
  await expect.poll(() => trafico.slice(despues).find((t) => t.status !== undefined)?.status, { timeout: 15_000 }).toBe(200);
  expect(trafico.slice(despues).find((t) => t.status !== undefined)?.tenant).toBeUndefined();

  await contexto.close();
});

test('control negativo: una cuenta con 2 membresías y sin rol de plataforma SÍ pasa por /auth/organization', async ({ browser }) => {
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  const rutas = await entrar(page, PRACTITIONER_ACCOUNT);

  await expect(page).toHaveURL(/\/auth\/organization/, { timeout: 30_000 });
  expect(rutas.some((r) => r.startsWith('/auth/organization')), `rutas: ${rutas.join(' -> ')}`).toBe(true);
  await expect(page.getByTestId('tenant-opcion').first()).toBeVisible();
  // Y no se le ofrece «Toda la plataforma».
  await expect(page.getByTestId('tenant-plataforma')).toHaveCount(0);

  await contexto.close();
});
