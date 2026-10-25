import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, crearPaciente, urlDeApi, type Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * Carril 19 — la pestaña «Centros médicos» de la pantalla de la receta.
 *
 * ## Qué prueba
 *
 * 1. Con un paciente recién dado de alta (sin órdenes): la pestaña abre por la
 *    URL, consulta `GET /clinical/me/procedure-centers` **sin** mandar qué le
 *    pidieron —sólo el tope— y dice con honestidad que no hay procedimientos
 *    pendientes, sin el aviso viejo de «Esta parte todavía no está».
 * 2. Con un paciente que ya tiene órdenes de procedimiento y sedes que las
 *    ofrecen (`E2E_L19_PATIENT_EMAIL` / `E2E_L19_PATIENT_PASSWORD`): por defecto
 *    sólo se ven los centros que tienen todo, «Ver el que tiene una parte»
 *    muestra el resto con lo que le falta, y cada centro trae «Cómo llegar» por
 *    OpenStreetMap en una pestaña nueva.
 *
 * ## Por qué el segundo caso pide un paciente sembrado
 *
 * Una orden de procedimiento la crea un médico con relación asistencial con el
 * paciente (`POST /clinical/service-requests`), y la oferta la declara un
 * administrador por sede (`POST /practices/:id/healthcare-services`). El
 * entorno E2E no siembra esa combinación, así que el caso corre sólo cuando se
 * le da una cuenta que ya la tiene.
 */

const RECETA_INEXISTENTE = '00000000-0000-4000-8000-000000000000';
const PANTALLA = `/my-account/medical-record/where-to-buy/${RECETA_INEXISTENTE}?tab=medical-centers`;

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await contextoDeApi();
  test.skip(
    !(await apiViva(api)),
    `La API E2E no responde en ${urlDeApi()}: este carril necesita backend vivo.`,
  );
});

test.afterAll(async () => {
  await api.dispose();
});

/** Entra, abre la pestaña por la URL y devuelve la consulta de centros. */
async function abrirCentrosMedicos(page: Page, paciente: Actor): Promise<URL> {
  await entrar(page, paciente);
  const consulta = page.waitForRequest((peticion) =>
    new URL(peticion.url()).pathname.endsWith('/clinical/me/procedure-centers'),
  );
  const respuesta = page.waitForResponse((r) =>
    new URL(r.url()).pathname.endsWith('/clinical/me/procedure-centers'),
  );
  await irA(page, PANTALLA);
  const url = new URL((await consulta).url());
  expect((await respuesta).status()).toBe(200);
  await expect(page.getByRole('tab', { name: 'Centros médicos' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  return url;
}

test.describe('Carril 19 · Centros médicos', () => {
  test('sin órdenes: consulta sin PHI en la URL y lo dice con honestidad', async ({ page }) => {
    const paciente = await crearPaciente(api);
    const url = await abrirCentrosMedicos(page, paciente);

    expect([...url.searchParams.keys()]).toEqual(['limit']);
    await expect(page.getByText('No tiene procedimientos pendientes.')).toBeVisible();
    await expect(page.getByText('Esta parte todavía no está')).toHaveCount(0);
    await expect(page.getByTestId('medical-centers-list')).toHaveCount(0);
  });

  test('con órdenes: completos primero, parciales con lo que les falta y «Cómo llegar»', async ({
    page,
  }, testInfo) => {
    const email = process.env['E2E_L19_PATIENT_EMAIL'];
    const clave = process.env['E2E_L19_PATIENT_PASSWORD'];
    test.skip(
      email === undefined || clave === undefined,
      'Necesita E2E_L19_PATIENT_EMAIL/PASSWORD de un paciente con órdenes de procedimiento sembradas.',
    );
    const paciente: Actor = {
      rol: 'paciente',
      identificador: email as string,
      clave: clave as string,
      nombre: 'Paciente con procedimientos (carril 19)',
    };
    await abrirCentrosMedicos(page, paciente);

    const pendientes = page.getByTestId('medical-centers-procedures');
    await expect(pendientes).toContainText('Procedimientos pendientes:');

    const lista = page.getByTestId('medical-centers-list');
    await expect(lista.locator('li')).not.toHaveCount(0);
    // Por defecto, sólo los que tienen todo.
    await expect(lista.getByText('Le falta algo')).toHaveCount(0);
    await expect(lista.getByText('Tiene todos').first()).toBeVisible();

    const comoLlegar = lista.locator('a[href*="openstreetmap.org/directions"]').first();
    await expect(comoLlegar).toHaveAttribute('target', '_blank');
    await expect(comoLlegar).toHaveAttribute('rel', 'noopener noreferrer');
    await page.screenshot({ path: testInfo.outputPath('centros-medicos-completos.png'), fullPage: true });

    const verParciales = page.getByTestId('medical-centers-show-partial');
    await expect(verParciales).toHaveAttribute('aria-pressed', 'false');
    await verParciales.focus();
    await page.keyboard.press('Enter');
    await expect(verParciales).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('medical-centers-missing').first()).toContainText('Le falta:');
    await page.screenshot({ path: testInfo.outputPath('centros-medicos-parciales.png'), fullPage: true });

    // En un teléfono la tarjeta no se desborda: nada más ancho que la pantalla.
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(lista.locator('li').first()).toBeVisible();
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde).toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath('centros-medicos-movil.png'), fullPage: true });

    // Ni un uuid a la vista: los procedimientos se muestran por su nombre.
    const cuerpo = (await page.locator('main').first().textContent()) ?? '';
    expect(cuerpo).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  });
});
