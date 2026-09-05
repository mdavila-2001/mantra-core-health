import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, doctora, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * TAREA-27 · el editor de preguntas del módulo `surveys` (módulo 65).
 *
 * Cubre únicamente lo que existe hoy en el repositorio:
 * `features/questionnaires/questionnaires.ts` (lista «Encuestas», lado
 * profesional) y `features/questionnaires/survey-detail/survey-detail.ts` (el
 * editor: agregar pregunta, publicar, asignar), más la contracara del
 * paciente en `features/account/questionnaires/`.
 *
 * No cubre secciones, editar/eliminar una pregunta ya creada, cambiar el tipo
 * de una existente, la opción «otros», ni mínimos/máximos de cantidad de
 * respuestas: la ficha TAREA-27 §2.2 documenta que el editor de `surveys` no
 * los tiene todavía. Este spec deja constancia de esa ausencia con
 * aserciones negativas en vez de simularlos.
 *
 * Hallazgo de `navigation.map.ts:532`: la sección «Encuestas» está
 * `fueraDelMenuPara: ['PRACTITIONER']` — la doctora de demostración no la ve
 * en el menú (se arma desde la consulta del paciente, no como tarea suelta).
 * La ruta existe igual y es alcanzable de forma directa, como hace
 * `carril-14-crear-cita.spec.ts` con el alta de citas.
 *
 * ## Por qué hay tan pocos `test()`
 *
 * `POST /iam/auth/login` admite diez por minuto y por IP, y este entorno
 * corre varias suites en paralelo (se midieron ~40 procesos `node`/
 * `chrome-headless-shell` concurrentes). Un `test()` por escenario —cada uno
 * con su propio `entrar()`— agota el cupo y deja la suite entera roja por
 * `ThrottlerException`, que no es un defecto del producto. Por eso el flujo
 * funcional entero vive en un solo `test()`, con una sola sesión, navegando
 * por `irA` (sin recargar) como recomienda `sesion.ts`.
 */

const ENCUESTAS = '/questionnaires';
const MIS_CUESTIONARIOS = '/my-account/questionnaires';

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
      '`node tools/alovida/seed-dev-data.mjs`.',
  ).toBe(true);
});

test.afterAll(async () => {
  await api.dispose();
});

/** El `<input>` real de un campo del sistema: el `data-testid` queda en el host. */
function campo(page: Page, testId: string) {
  return page.getByTestId(testId).locator('input');
}

/** Crea una encuesta nueva desde la lista y devuelve su título, único por corrida. */
async function crearEncuesta(page: Page): Promise<string> {
  const titulo = `Encuesta E2E ${Date.now()}`;

  await page.getByTestId('encuestas-nueva').click();
  await expect(page.getByTestId('encuestas-form')).toBeVisible();

  await campo(page, 'encuesta-titulo').fill(titulo);
  await page.getByTestId('encuesta-consigna').locator('textarea').fill('Consigna de prueba E2E.');
  await page.getByTestId('encuesta-crear').click();

  const fila = page.getByTestId('encuestas-lista').getByText(titulo);
  await expect(fila).toBeVisible({ timeout: 15_000 });
  return titulo;
}

/** Abre el editor de la encuesta cuya fila muestra `titulo`. */
async function abrirEditorDe(page: Page, titulo: string): Promise<void> {
  const fila = page.locator('li', { has: page.getByText(titulo, { exact: true }) }).first();
  await fila.getByRole('link', { name: 'Abrir' }).click();
  await estable(page);
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
}

/** Agrega una pregunta de texto libre y espera a que quede listada. */
async function agregarPreguntaDeTexto(page: Page, enunciado: string): Promise<void> {
  await page.getByTestId('pregunta-texto').fill(enunciado);
  await page.getByRole('button', { name: 'Agregar pregunta' }).click();
  await expect(page.getByText(enunciado)).toBeVisible({ timeout: 15_000 });
}

test('recorrido completo del editor: lista, alta, preguntas, publicación y huecos documentados', async ({
  page,
}) => {
  // --- AC-27-1/2: la lista carga por URL directa (fuera del menú de la
  // doctora) y muestra versión y estado. ---------------------------------
  await entrar(page, doctora());
  await irA(page, ENCUESTAS);
  await estable(page);

  await expect(page.getByRole('heading', { name: 'Encuestas' })).toBeVisible();

  const lista = page.getByTestId('encuestas-lista');
  const vacio = page.getByText('Todavía no creaste ninguna encuesta');
  await expect(lista.or(vacio)).toBeVisible({ timeout: 15_000 });
  if (await lista.isVisible()) {
    await expect(lista.getByText(/Versión \d+/).first()).toBeVisible();
  }

  // --- AC-27-2/4: crear una encuesta, abrir su fila, agregar preguntas. --
  const titulo = await crearEncuesta(page);
  await abrirEditorDe(page, titulo);

  await expect(page.getByText('Todavía no tiene preguntas')).toBeVisible();

  await agregarPreguntaDeTexto(page, '¿Cómo calificarías la atención?');

  await page.getByTestId('pregunta-texto').fill('¿Qué servicios usaste?');
  await page.getByLabel('Tipo de respuesta').selectOption({ label: 'Elección múltiple' });
  await expect(page.getByTestId('pregunta-opciones')).toBeVisible();
  await page
    .getByTestId('pregunta-opciones')
    .locator('textarea')
    .fill('Consulta\nLaboratorio\nImágenes');
  await page.getByRole('button', { name: 'Agregar pregunta' }).click();
  await expect(page.getByText('Consulta · Laboratorio · Imágenes')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('¿Qué servicios usaste?')).toBeVisible();

  // --- AC-27-4 parcial: persiste al recargar. ----------------------------
  await page.reload();
  await estable(page);
  await expect(page.getByText('¿Cómo calificarías la atención?')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText('Consulta · Laboratorio · Imágenes')).toBeVisible();

  // --- Hueco documentado (ficha §2.2): no hay editar ni eliminar pregunta.
  const preguntaExistente = page.locator('.encuesta__pregunta', {
    has: page.getByText('¿Cómo calificarías la atención?'),
  });
  await expect(preguntaExistente.getByRole('button', { name: /editar/i })).toHaveCount(0);
  await expect(preguntaExistente.getByRole('button', { name: /eliminar|borrar/i })).toHaveCount(
    0,
  );

  // --- Hueco documentado (ficha §2.2): no hay «otros» ni cardinalidad de
  // cantidad de respuestas (el único mínimo/máximo que ofrece el formulario
  // es el de la escala numérica, no el de cuántas opciones se pueden marcar).
  const formularioTexto = (await page.locator('form').first().textContent()) ?? '';
  expect(formularioTexto.toLowerCase()).not.toContain('otros');
  expect(formularioTexto.toLowerCase()).not.toMatch(/exactamente\s*n|m[ií]nimo de respuestas/);

  // --- AC-27-9: publicar congela el cuestionario y la pantalla lo explica
  // antes de que se apriete el botón. --------------------------------------
  await expect(page.getByText('Publicar es definitivo')).toBeVisible();
  await expect(page.getByText('Una versión publicada ya no acepta preguntas')).toBeVisible();

  await page.getByTestId('encuesta-publicar').click();
  await expect(page.getByText('Publicada')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('pregunta-texto')).toHaveCount(0);

  // --- La contracara del paciente: «Mis cuestionarios» resuelve un estado
  // terminal (no hay cuenta de paciente sembrada con invitaciones propias,
  // así que sólo se mide que la pantalla no se cuelga en `loading`). ------
  await irA(page, MIS_CUESTIONARIOS);
  await estable(page);
  const forbidden = page.getByText(/no ten[ée]s permiso|acceso denegado/i);
  const encabezado = page.getByRole('heading', { name: 'Mis cuestionarios' });
  await expect(encabezado.or(forbidden)).toBeVisible({ timeout: 15_000 });
});

test.describe('AC-27-21 · sin scroll horizontal en los tres anchos obligatorios', () => {
  for (const viewport of VIEWPORTS) {
    test(`lista, editor y «mis cuestionarios» en ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await entrar(page, doctora());

      // Lista -----------------------------------------------------------
      await irA(page, ENCUESTAS);
      await estable(page);
      let desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(desborde, `la lista de encuestas desborda a lo ancho en ${viewport.width}px`).toBe(
        false,
      );
      await page.screenshot({
        path: `artifacts/playwright/tarea-27-editor/lista-${viewport.nombre}.png`,
        fullPage: true,
      });

      // Editor, con preguntas cargadas ------------------------------------
      const titulo = await crearEncuesta(page);
      await abrirEditorDe(page, titulo);
      await agregarPreguntaDeTexto(page, 'Pregunta de texto para la captura');

      await page.getByTestId('pregunta-texto').fill('¿Con qué frecuencia volverías?');
      await page.getByLabel('Tipo de respuesta').selectOption({ label: 'Elección múltiple' });
      await page
        .getByTestId('pregunta-opciones')
        .locator('textarea')
        .fill('Siempre\nA veces\nNunca');
      await page.getByRole('button', { name: 'Agregar pregunta' }).click();
      await expect(page.getByText('Siempre · A veces · Nunca')).toBeVisible({ timeout: 15_000 });

      desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(desborde, `el editor de encuesta desborda a lo ancho en ${viewport.width}px`).toBe(
        false,
      );
      await page.screenshot({
        path: `artifacts/playwright/tarea-27-editor/editor-${viewport.nombre}.png`,
        fullPage: true,
      });

      // «Mis cuestionarios» (paciente), sin recargar la sesión -----------
      await irA(page, MIS_CUESTIONARIOS);
      await estable(page);
      desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(
        desborde,
        `«mis cuestionarios» desborda a lo ancho en ${viewport.width}px`,
      ).toBe(false);
      await page.screenshot({
        path: `artifacts/playwright/tarea-27-editor/mis-cuestionarios-${viewport.nombre}.png`,
        fullPage: true,
      });
    });
  }
});
