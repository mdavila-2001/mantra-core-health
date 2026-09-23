import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, doctora, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * FT-22 · «Mis servicios», la vista de quien atiende sobre lo que ofrece.
 *
 * Lo que se observa acá es lo que la pantalla pasó a hacer: que el médico
 * **llegue por el menú** —hasta el 04/09 la sección existía pero no tenía
 * renglón—, que una práctica traiga «Cita médica» sin que nadie la haya
 * cargado, y que el precio se edite **y persista**: se recarga la página y se
 * vuelve a leer, porque mirar la tarjeta después de guardar sólo demuestra que
 * el componente se actualizó a sí mismo.
 *
 * Lo que esta suite **no** cubre porque no existe: la imagen y la descripción
 * del servicio (no hay columnas: van por el modelo, PR aparte) y los términos y
 * condiciones con su modal (exigen tabla con historial — bloqueador B-2).
 *
 * ## Una sola sesión para toda la suite
 *
 * `POST /iam/auth/login` admite diez por minuto y por IP, y en esta máquina
 * conviven barridos de otros carriles. Se entra una vez y el resto se navega
 * por el router.
 */

const MIS_SERVICIOS = '/my-services';

/** Los tres anchos obligatorios de la ficha (AC-22-18). */
const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

test.describe.configure({ mode: 'serial' });

let api: APIRequestContext;
let browser: Browser;
let page: Page;

test.beforeAll(async ({ browser: b }) => {
  browser = b;
  api = await contextoDeApi();
  expect(await apiViva(api), `La API no responde en ${urlDeApi()}.`).toBe(true);

  page = await browser.newPage();
  await entrar(page, doctora());
});

test.afterAll(async () => {
  await page.close();
  await api.dispose();
});

/** La primera tarjeta del listado, ya cargada. */
async function primeraTarjeta() {
  await irA(page, MIS_SERVICIOS);
  await estable(page);
  const tarjeta = page.getByTestId('my-services-item').first();
  await expect(tarjeta).toBeVisible();
  return tarjeta;
}

test('el médico llega a sus servicios desde el menú, sin escribir la ruta', async () => {
  // El renglón es la entrega: la ruta ya funcionaba antes de este carril.
  await irA(page, '/');
  await estable(page);

  await page.getByRole('link', { name: 'Mis servicios' }).click();
  await estable(page);

  await expect(page).toHaveURL(new RegExp(`${MIS_SERVICIOS}$`));
  await expect(page.getByRole('heading', { name: 'Mis servicios' })).toBeVisible();
});

test('la práctica trae «Cita médica» sin que nadie la haya cargado', async () => {
  await primeraTarjeta();

  await expect(page.getByText('Cita médica').first()).toBeVisible();
  await expect(page.getByText('CITA_MEDICA').first()).toBeVisible();
});

test('un precio sin definir se dice con palabras, no con un cero', async () => {
  const tarjeta = await primeraTarjeta();
  const precio = tarjeta.getByTestId('my-services-price');

  // Si alguien ya le puso precio en una corrida anterior, el cartel no
  // corresponde: lo que se comprueba es que nunca se muestre un «0.00» pelado.
  await expect(precio).not.toHaveText(/^\s*0[.,]00/);
});

test('el precio se edita y persiste al recargar', async () => {
  const tarjeta = await primeraTarjeta();
  const importe = `${100 + (Date.now() % 100)}.50`;

  await tarjeta.getByTestId('my-services-price-edit').click();
  await tarjeta.getByTestId('my-services-price-input').fill(importe);
  await tarjeta.getByTestId('my-services-price-save').click();
  await estable(page);

  await expect(tarjeta.getByTestId('my-services-price')).toContainText(importe);

  // La prueba de verdad: recargar y volver a leerlo de la API.
  await page.reload();
  await estable(page);
  await expect(
    page.getByTestId('my-services-item').first().getByTestId('my-services-price'),
  ).toContainText(importe);
});

test('un importe inválido lo rechaza el servidor y no se pierde lo escrito', async () => {
  const tarjeta = await primeraTarjeta();

  await tarjeta.getByTestId('my-services-price-edit').click();
  const campo = tarjeta.getByTestId('my-services-price-input');
  await campo.fill('-1');
  await tarjeta.getByTestId('my-services-price-save').click();
  await estable(page);

  // El campo sigue abierto, con lo escrito, y el error está a la vista.
  await expect(campo).toHaveValue('-1');
  await expect(tarjeta).toContainText(/importe|precio/i);
});

test('cancelar no cambia el precio', async () => {
  const tarjeta = await primeraTarjeta();
  const antes = (await tarjeta.getByTestId('my-services-price').textContent())?.trim() ?? '';

  await tarjeta.getByTestId('my-services-price-edit').click();
  await tarjeta.getByTestId('my-services-price-input').fill('7.77');
  await tarjeta.getByTestId('my-services-price-cancel').click();
  await estable(page);

  await expect(tarjeta.getByTestId('my-services-price')).toHaveText(antes);

  // Y no fue sólo la pantalla: se relee de la API.
  await page.reload();
  await estable(page);
  await expect(
    page.getByTestId('my-services-item').first().getByTestId('my-services-price'),
  ).toHaveText(antes);
});

for (const viewport of VIEWPORTS) {
  test(`sin scroll horizontal a ${viewport.width} px (${viewport.nombre})`, async () => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await primeraTarjeta();

    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborde, `La página desborda a lo ancho en ${viewport.width} px.`).toBe(false);

    await page.screenshot({
      path: `playwright/evidencia/carril-22-mis-servicios-${viewport.nombre}.png`,
      fullPage: true,
    });
  });
}
