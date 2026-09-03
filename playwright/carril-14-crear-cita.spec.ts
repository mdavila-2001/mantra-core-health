import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, doctora, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * TAREA-14 — agendar una cita sin pasar por el calendario.
 *
 * Precondición: un profesional con **agenda publicada** y pacientes con los
 * que agendar. Los deja `node tools/redesa/seed-dev-data.mjs` en el
 * repositorio de la API.
 *
 * Lo que esta suite **no** puede afirmar, y hay que decirlo: AC-14-10 (la
 * prueba de concurrencia de H-1) y AC-14-12 (que todo ocurra en una
 * transacción) no se miden desde el navegador. La primera necesita dos
 * peticiones en paralelo y contar filas; la segunda, forzar el fallo del
 * segundo paso. Son pruebas de la API y van con ella.
 */

const ALTA = '/schedule/appointment/new';
const MI_AGENDA = '/schedule/mine';

/** Los tres anchos obligatorios de la ficha. */
const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await contextoDeApi();
  expect(
    await apiViva(api),
    `La API no responde en ${urlDeApi()}. Levantala y sembrá con ` +
      '`node tools/redesa/seed-dev-data.mjs`.',
  ).toBe(true);
});

test.afterAll(async () => {
  await api.dispose();
});

/**
 * Entra como profesional y abre el alta.
 *
 * @param page - La página de la prueba.
 */
/**
 * El `<input>` real de un campo del sistema.
 *
 * El `data-testid` queda en el host `<app-input>`, que no es un campo: para
 * escribir hay que bajar al elemento nativo que proyecta adentro.
 *
 * @param page - La página.
 * @param testId - Identificador del campo.
 * @returns El localizador del `<input>`.
 */
function campo(page: Page, testId: string) {
  return page.getByTestId(testId).locator('input');
}

async function abrirAlta(page: Page): Promise<void> {
  await entrar(page, doctora());
  await irA(page, ALTA);
  await estable(page);
}

test('AC-14-1 · se llega desde la agenda, sin pasar por el calendario', async ({
  page,
}) => {
  await entrar(page, doctora());
  await irA(page, MI_AGENDA);
  await estable(page);

  const entrada = page.getByTestId('agendar-cita');
  await expect(entrada).toBeVisible();
  await entrada.click();

  // La dirección es propia: se puede compartir y volver a ella. Hasta acá la
  // única forma de crear una cita era encontrar el día y tocar el rato.
  await expect(page).toHaveURL(new RegExp(`${ALTA}$`));
});

test('AC-14-2 · el doctor no se elige: no hay campo de profesional', async ({
  page,
}) => {
  await abrirAlta(page);

  // Verificable en el DOM, que es como lo pide el criterio. La cita nace en la
  // agenda de quien tiene la sesión; el servidor impone lo mismo, así que la
  // ausencia del campo es la consecuencia, no la barrera.
  const etiquetas = (await page.locator('form').textContent()) ?? '';
  expect(etiquetas).not.toMatch(/profesional|m[ée]dico|doctor[a]?\b/i);

  await expect(page.getByTestId('cita-profesional')).toHaveCount(0);
});

test('AC-14-4 · pide paciente, día, hora, duración, modalidad y motivo', async ({
  page,
}) => {
  await abrirAlta(page);

  await expect(page.getByTestId('cita-paciente')).toBeVisible();
  // El día usa el organismo del sistema, no un `<input type="date">`: se
  // comprueba que esté, no que sea un campo de texto.
  await expect(page.getByTestId('cita-fecha')).toBeVisible();
  await expect(page.getByTestId('cita-hora')).toBeVisible();
  await expect(page.getByTestId('cita-duracion')).toBeVisible();
  await expect(page.getByTestId('cita-motivo')).toBeVisible();

  // Las tres modalidades del value set, y sólo esas tres.
  const modalidades = page.locator('input[name="modalidad"]');
  await expect(modalidades).toHaveCount(3);

  // La duración es libre: hay un campo numérico además de los atajos, porque
  // «la cirugía de tres horas y la consulta de cuarenta y cinco conviven».
  const libre = campo(page, 'cita-duracion-libre');
  await expect(libre).toBeVisible();
  await libre.fill('180');
  await expect(libre).toHaveValue('180');
});

test('AC-14-5 · con una sola agenda no pregunta cuál', async ({ page }) => {
  await abrirAlta(page);

  const selector = page.getByTestId('cita-agenda');
  const agendas = await selector.count();

  // Un select de una sola opción es una decisión que no existe. Con dos sedes
  // sí aparece, y elegirla ES elegir la sede.
  if (agendas === 1) {
    const opciones = await selector.locator('option').count();
    expect(opciones).toBeGreaterThan(1);
  } else {
    expect(agendas).toBe(0);
  }
});

test('AC-14-6 · la modalidad arranca en presencial y se puede cambiar', async ({
  page,
}) => {
  await abrirAlta(page);

  const presencial = page.locator('input[name="modalidad"][value="PRESENCIAL"]');
  await expect(presencial).toBeChecked();

  const video = page.locator('input[name="modalidad"][value="TELECONSULTA"]');
  await video.check();
  await expect(video).toBeChecked();
});

test('no deja agendar sin paciente ni sin cuándo', async ({ page }) => {
  await abrirAlta(page);

  // El botón apagado dice que falta algo antes de que alguien lo apriete y
  // reciba un 400 que no provocó a propósito.
  await expect(page.getByTestId('cita-guardar')).toBeDisabled();

  await campo(page, 'cita-hora').fill('09:00');
  // Con la hora puesta y sin paciente sigue apagado: una cita sin paciente no
  // es una cita, es un rato ocupado, y eso se crea en otra pantalla.
  await expect(page.getByTestId('cita-guardar')).toBeDisabled();
});

for (const viewport of VIEWPORTS) {
  test(`AC-14-14 · sin scroll horizontal en ${viewport.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await abrirAlta(page);

    const desborde = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(desborde, 'el alta de cita desborda a lo ancho').toBe(false);

    await page.screenshot({
      path: `artifacts/playwright/tarea-14/alta-${viewport.nombre}.png`,
      fullPage: true,
    });
  });
}
