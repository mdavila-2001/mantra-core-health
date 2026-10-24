import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, type Browser, type Page, type Response } from '@playwright/test';

import { contextoDeApi, crearPaciente, doctora, type Actor } from './actores';
import { esperarAplicacionLista, irA } from './sesion';
import { openRealSession } from './real-session';

/**
 * Lo que comparten los specs del portal de inventario (centro de datos):
 * dónde se guardan las capturas, cómo se espera una pantalla del portal y la
 * prueba de que médico y paciente no entran.
 *
 * El portal es de los roles de plataforma (`PORTAL_READ_ROLES` de la API). Que
 * el menú no lo ofrezca no es seguridad: por eso la prueba de los roles que no
 * lo ven mira las tres cosas —el menú, la dirección escrita a mano y la API
 * llamada directo con su token—.
 */

/** Donde `visual-quality-gate` manda la evidencia de navegador; viaja en el diff. */
export const EVIDENCE_DIR = join(__dirname, '..', '..', 'docs', 'frontend', 'evidence', 'centro-datos-e3');

export const PORTAL = '/superadmin/portal';

/** Captura del viewport (sin `fullPage`: las tablas largas la vuelven ilegible). */
export async function capture(page: Page, name: string): Promise<void> {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: join(EVIDENCE_DIR, `${name}.png`), animations: 'disabled' });
}

/** Va a una pantalla del portal por el router y espera su marco. */
export async function openPortal(page: Page, path: string): Promise<void> {
  await irA(page, `${PORTAL}/${path}`);
  await esperarAplicacionLista(page);
  await expect(page.getByTestId('portal-shell')).toBeVisible();
}

/**
 * Espera la respuesta de `path` cuya consulta trae `params`. Hace falta cuando
 * dos lecturas comparten ruta: el catálogo de módulos y la lista de procesos
 * piden los dos `/admin/portal/flujos`, con parámetros distintos.
 */
export async function responseWith(
  page: Page,
  path: RegExp,
  params: Readonly<Record<string, string>>,
  action: () => Promise<unknown>,
): Promise<Response> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => {
        const url = new URL(res.url());
        return (
          res.request().method() === 'GET' &&
          path.test(url.pathname) &&
          Object.entries(params).every(([k, v]) => url.searchParams.get(k) === v)
        );
      },
      { timeout: 30_000 },
    ),
    action(),
  ]);
  return response;
}

/** El médico de demostración y una paciente recién dada de alta: los dos sin rol de plataforma. */
export async function actorsWithoutPortal(): Promise<readonly Actor[]> {
  const api = await contextoDeApi();
  try {
    return [doctora(), await crearPaciente(api)];
  } finally {
    await api.dispose();
  }
}

/**
 * Entra como `actor` y comprueba que no llega al portal: la dirección escrita a
 * mano lo devuelve al panel y la API le contesta 403 a su propio token.
 *
 * @param paths - Pantallas del grupo, relativas al portal.
 * @param apiPath - Una lectura del grupo, para la denegación directa.
 */
export async function expectDenied(
  browser: Browser,
  actor: Actor,
  paths: readonly string[],
  apiPath: string,
): Promise<void> {
  const session = await openRealSession(browser, actor);
  try {
    const { page } = session;
    for (const path of paths) {
      await irA(page, `${PORTAL}/${path}`);
      await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
      await expect(page.getByTestId('portal-shell'), `${actor.rol} no ve ${path}`).toHaveCount(0);
    }
    const direct = await session.api.get(apiPath, { headers: session.authHeaders() });
    expect(direct.status(), `${actor.rol} pide ${apiPath} a la API`).toBe(403);
  } finally {
    await session.close();
  }
}
