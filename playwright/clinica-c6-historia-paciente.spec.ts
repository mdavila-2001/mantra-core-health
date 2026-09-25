import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, crearPaciente, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril C6 — la historia clínica del paciente: en estudio, enfermedades
 * activas, históricos y la línea de cada atención.
 *
 * ## Qué recorre
 *
 * `paciente@alovida.mock` → «Mi historia clínica» → la pestaña **Diagnósticos**
 * con sus tres bloques → «Atenciones», desplegar la primera y leer su línea del
 * encuentro → la reconsulta si la hay → descargar el PDF → recargar y comprobar
 * que la pestaña abierta se conserva.
 *
 * ## Qué NO se puede afirmar todavía
 *
 * Este archivo se escribió **sin ejecutarse**: `scripts/pw-guard.mjs` no existe
 * en este árbol (era de C0) y el carril tiene prohibido levantar un servidor
 * mientras corren otros agentes. El peldaño de evidencia de este archivo es
 * `WRITTEN`, no `TESTED` — está declarado así en el `REPORTE.md` y no debe
 * citarse como verificación de nada.
 *
 * ## Por qué el paciente es nuevo
 *
 * Como en el resto de los carriles: las cuentas sembradas no tienen contraseña
 * conocida. Un paciente recién dado de alta no tiene diagnósticos, y eso acá es
 * un dato y no un estorbo: fija el estado vacío, que es lo que la mayoría de la
 * gente ve el primer día. Los bloques con contenido se comprueban **si la
 * cuenta los tiene**, sin inventar una historia que el backend no dio.
 */

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

/** La forma de un uuid. Ni uno puede aparecer en el texto de esta pantalla. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Abre «Mi historia clínica» con una sesión de paciente recién creada. */
async function abrirMiHistoria(page: Page): Promise<void> {
  const paciente = await crearPaciente(api);
  await entrar(page, paciente);
  await irA(page, '/my-account/medical-record');
  await estable(page);
}

/** Abre la pestaña por su nombre visible. */
async function abrirPestana(page: Page, nombre: string): Promise<void> {
  await page.getByRole('tab', { name: new RegExp(`^${nombre}`) }).click();
  await estable(page);
}

test.describe('Carril C6 · mi historia clínica con diagnósticos y encuentros', () => {
  test('la pestaña Diagnósticos muestra los tres bloques', async ({ page }) => {
    await abrirMiHistoria(page);

    // Cinco pestañas desde C6; «Diagnósticos» es la última.
    await expect(page.locator('[data-testid="historia-tabs"] [role="tab"]')).toHaveCount(5);

    await abrirPestana(page, 'Diagnósticos');

    // Con historia, los tres bloques existen; sin ella, el vacío orienta (S3).
    const enEstudio = page.getByTestId('historia-en-estudio');
    if ((await enEstudio.count()) > 0) {
      await expect(enEstudio).toBeVisible();
      await expect(page.getByTestId('historia-activas')).toBeVisible();
      await expect(page.getByTestId('historia-historicos')).toBeVisible();
    } else {
      await expect(page.getByText('Todavía no tenés diagnósticos registrados')).toBeVisible();
    }
  });

  test('desplegar una atención muestra su línea del encuentro', async ({ page }) => {
    await abrirMiHistoria(page);

    const atenciones = page.getByTestId('historia-atenciones');
    const paneles = atenciones.locator('.accordion-panel__trigger');
    test.skip(
      (await paneles.count()) === 0,
      'La cuenta de prueba no tiene atenciones: no hay línea que desplegar.',
    );

    // Antes de desplegar, la línea no está en el DOM: el acordeón no la dibuja.
    await expect(page.getByTestId('historia-linea-encuentro')).toHaveCount(0);

    await paneles.first().click();
    await estable(page);

    const linea = page.getByTestId('historia-linea-encuentro').first();
    await expect(linea).toBeVisible();
    // Al menos un hecho: la línea de una consulta cerrada nunca está en blanco.
    await expect(linea.locator('.linea-encuentro__hecho')).not.toHaveCount(0);

    // Si hay reconsulta agendada, se lee con día y hora, no con un identificador.
    const reconsulta = page.getByTestId('historia-reconsulta');
    if ((await reconsulta.count()) > 0) {
      await expect(reconsulta).toContainText(/Reconsulta el \d{2}\/\d{2} a las \d{2}:\d{2}/);
    }
  });

  test('desplegar una atención no dispara lecturas al abrir la pantalla', async ({ page }) => {
    const lecturas: string[] = [];
    page.on('request', (peticion) => {
      const ruta = new URL(peticion.url()).pathname;
      if (ruta.includes('/chart') || ruta.includes('/diagnostic-results/me/orders')) {
        lecturas.push(ruta);
      }
    });

    await abrirMiHistoria(page);

    // Son dos lecturas que sólo sirven cuando alguien quiere ver qué pasó en
    // una consulta: cobrárselas a todos al abrir la pantalla es lo que el
    // carril prohíbe.
    expect(lecturas).toEqual([]);

    const paneles = page.getByTestId('historia-atenciones').locator('.accordion-panel__trigger');
    test.skip((await paneles.count()) === 0, 'La cuenta de prueba no tiene atenciones.');

    await paneles.first().click();
    await estable(page);
    expect(lecturas.length).toBeGreaterThan(0);

    // Y el segundo despliegue no vuelve a salir a la red.
    const despuesDelPrimero = lecturas.length;
    await paneles.first().click();
    await paneles.first().click();
    await estable(page);
    expect(lecturas.length).toBe(despuesDelPrimero);
  });

  /**
   * Lo que el paciente **nunca** ve. Es la pantalla más sensible del producto:
   * un identificador en la historia clínica no es un defecto de estilo.
   */
  test('ningún uuid aparece en la pantalla, en ninguna pestaña', async ({ page }) => {
    await abrirMiHistoria(page);

    for (const pestana of ['Atenciones', 'Recetas', 'Alergias', 'Resultados', 'Diagnósticos']) {
      await abrirPestana(page, pestana);
      expect(await page.locator('body').innerText()).not.toMatch(UUID);
    }

    // También con la línea del encuentro desplegada, que es donde más datos hay.
    await abrirPestana(page, 'Atenciones');
    const paneles = page.getByTestId('historia-atenciones').locator('.accordion-panel__trigger');
    if ((await paneles.count()) > 0) {
      await paneles.first().click();
      await estable(page);
      expect(await page.locator('body').innerText()).not.toMatch(UUID);
    }
  });

  test('«Descargar tu historia» entrega un PDF', async ({ page }) => {
    await abrirMiHistoria(page);

    const descarga = page.waitForEvent('download');
    await page.getByTestId('historia-descargar-todo').click();
    const archivo = await descarga;

    expect(archivo.suggestedFilename()).toMatch(/^historia-.*\.pdf$/);
  });

  test('la pestaña abierta sobrevive a una recarga', async ({ page }) => {
    await abrirMiHistoria(page);
    await abrirPestana(page, 'Diagnósticos');

    await page.reload({ waitUntil: 'commit' });
    await estable(page);

    // La pestaña vive en la URL, así que recargar no la pierde: es lo mismo que
    // hace que «mirá mis diagnósticos» sea un enlace y no una instrucción.
    await expect(page.getByRole('tab', { name: /^Diagnósticos/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
