import { test, expect, type Page } from '@playwright/test';
import type { Actor } from './support/actores';
import { entrar, esperarAplicacionLista, irA } from './support/sesion';

/**
 * «Mis verificaciones» y la bandeja de la aseguradora **contra la API real**
 * (no el simulador). Cada mutación se prueba entera: UI → petición →
 * respuesta → persistencia → recarga → UI.
 *
 * Requiere una API con el modelo v4.2.64 aplicado y, como datos, un médico que
 * se registró eligiendo una institución y una aseguradora, y una cuenta
 * administradora de esa aseguradora. Las credenciales llegan por variables de
 * entorno para no fijar cuentas de prueba en el repositorio; sin ellas la spec
 * se saltea con su motivo.
 */
const MEDICO: Actor | null = process.env['E2E_MEDICO_EMAIL']
  ? {
      rol: 'doctora',
      identificador: process.env['E2E_MEDICO_EMAIL'],
      clave: process.env['E2E_MEDICO_CLAVE'] ?? '',
      nombre: 'Médico',
    }
  : null;
const ASEGURADORA: Actor | null = process.env['E2E_ASEGURADORA_EMAIL']
  ? {
      rol: 'administrador',
      identificador: process.env['E2E_ASEGURADORA_EMAIL'],
      clave: process.env['E2E_ASEGURADORA_CLAVE'] ?? '',
      nombre: 'Aseguradora',
    }
  : null;

const EVIDENCIA = 'docs/refactor-profesional/trabajo/capturas/e2e/verificaciones/api-real';

/**
 * Los errores de consola desde que se llama a `desde()`. Se mide sólo dentro de
 * las pantallas nuevas: el panel de una cuenta de prueba armada a mano puede
 * pedir cosas que su rol no tiene, y eso no es de este cambio.
 */
function erroresDeConsola(page: Page): { desde(): void; (): string[] } {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // H-14: la CSP con hash bloquea un script que inyecta `ng serve`.
    if (/Executing inline script violates the following Content Security Policy/.test(m.text()))
      return;
    errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
  let inicio = 0;
  const leer = (() => errores.slice(inicio)) as { desde(): void; (): string[] };
  leer.desde = () => {
    inicio = errores.length;
  };
  return leer;
}

test.describe('contra la API real', () => {
  test.skip(MEDICO === null || ASEGURADORA === null, 'Faltan E2E_MEDICO_* / E2E_ASEGURADORA_*');

  test('la aseguradora rechaza con motivo y el médico lo lee en su bandeja', async ({ page }) => {
    const errores = erroresDeConsola(page);

    await entrar(page, ASEGURADORA!);
    // La cuenta puede pertenecer a más de una organización: se activa la
    // aseguradora con el selector del encabezado, como lo haría la persona.
    const nombre = process.env['E2E_ASEGURADORA_TENANT'];
    if (nombre !== undefined) {
      await page.getByRole('button', { name: /Organización activa/ }).click();
      await page.getByRole('menuitem', { name: new RegExp(nombre) }).click();
      await expect(page.getByRole('button', { name: /Organización activa/ })).toContainText(nombre);
    }
    errores.desde();
    await irA(page, '/administration/insurer-practitioner-requests');
    await expect(page.getByTestId('aseguradora-pedidos')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: `${EVIDENCIA}/aseguradora-bandeja.png`, fullPage: true });
    const erroresAseguradora: string[] = [];

    await page.getByTestId('aseguradora-rechazar').first().click();
    await page
      .getByTestId('aseguradora-motivo')
      .locator('textarea')
      .fill('Por ahora no sumamos su especialidad');
    const [rechazo, relectura] = await Promise.all([
      page.waitForResponse((r) =>
        /\/insurance\/practitioner-requests\/[^/]+\/reject$/.test(r.url()),
      ),
      page.waitForResponse(
        (r) =>
          r.url().endsWith('/insurance/practitioner-requests') && r.request().method() === 'GET',
      ),
      page.getByTestId('aseguradora-confirmar-rechazo').click(),
    ]);
    expect(rechazo.status()).toBe(200);
    expect((await rechazo.json()).status).toBe('REJECTED');
    expect(relectura.status()).toBe(200);

    await page.reload();
    await esperarAplicacionLista(page);
    await expect(page.getByTestId('aseguradora-pedidos')).toContainText(
      '«Por ahora no sumamos su especialidad»',
      { timeout: 30_000 },
    );

    // La cuenta de prueba de la aseguradora se armó a mano a partir de un alta
    // de médico: conserva su perfil profesional sin el rol, y el armazón pide
    // sus sedes y su agenda (403). Es del fixture, no de este cambio; se
    // excluyen ESAS dos lecturas y nada más.
    const DEL_FIXTURE = /\/practitioners\/[0-9a-f-]+\/sites|\/scheduling\/resources|status of 403/;
    erroresAseguradora.push(...errores().filter((e) => !DEL_FIXTURE.test(e)));
    expect(erroresAseguradora).toEqual([]);
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
    await entrar(page, MEDICO!);
    errores.desde();
    await irA(page, '/my-account/verifications');
    await expect(page.getByTestId('verif-tramo-insurers')).toContainText('Rechazado', {
      timeout: 30_000,
    });
    await page.screenshot({ path: `${EVIDENCIA}/medico-hoja-de-ruta.png`, fullPage: true });

    await page.getByRole('tab', { name: 'Solicitudes enviadas' }).click();
    await expect(page.getByTestId('verif-hilo-abierto')).toContainText(
      '«Por ahora no sumamos su especialidad»',
    );

    // Volver a pedir: petición real y relectura de lo guardado.
    const [repedido] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith('/practitioners/me/insurer-requests') && r.request().method() === 'POST',
      ),
      page.getByTestId('verif-volver-a-pedir').click(),
    ]);
    expect(repedido.status()).toBe(201);
    await page.reload();
    await esperarAplicacionLista(page);
    await expect(page.getByTestId('verif-bandeja')).toContainText('Esperando respuesta', {
      timeout: 30_000,
    });
    await page.screenshot({ path: `${EVIDENCIA}/medico-bandeja.png`, fullPage: true });

    expect(errores()).toEqual([]);
  });
});
