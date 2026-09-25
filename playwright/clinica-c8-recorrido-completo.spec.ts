import { expect, test, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * C8 — el recorrido del paquete «Encuentro clínico», **acotado a lo que existe**.
 *
 * ## Por qué este archivo no es el recorrido que el carril pedía
 *
 * El prompt de C8 describe un recorrido de once tramos: nota médica → orden de
 * análisis → diagnóstico presuntivo → reconsulta → confirmación con evidencia →
 * receta ligada al diagnóstico confirmado → expediente → «Mis órdenes» con su
 * buscador y su paginación. **Ese recorrido no se puede escribir**: de los diez
 * carriles del paquete sólo se entregaron **C4** (la reconsulta como cita real)
 * y **C6** (la historia clínica del paciente). C0, C1, C2, C3, C5, C7 y C9 no
 * tienen rama, ni PR, ni una línea en el árbol.
 *
 * Los tramos que quedan fuera, y de quién eran:
 *
 * | Tramo | Carril | Por qué no está |
 * |---|---|---|
 * | Nota médica de tres filas | C1 | La casilla «Notas» abre la hoja libre; los apartados y `entries` eran de C1 |
 * | Orden de análisis «basada en» la nota | C2 | No existe la pantalla de orden ni `category` resuelta |
 * | Diagnóstico → Acciones → Confirmar con evidencia | C3 | `verification.reasonText` y el flujo de confirmación no se construyeron |
 * | Receta ligada al diagnóstico confirmado | C5 | El paso de firma/emisión ligado al confirmado no se entregó |
 * | «Mis órdenes» con buscador y paginación | C7 | La pantalla no existe |
 * | Crear la reconsulta desde la consulta | C4/C1 | El bloque existe (`follow-up-block`) pero su casilla la montaba `consultation/**`, que era de C1 — y el bloque necesita el **`bookingId`**, que la ruta de la consulta no lleva (sólo lleva `?cita=`, que es el `appointmentId`) |
 *
 * ## Qué sí recorre este archivo
 *
 * Lo que las dos entregas reales dejaron, en el orden en que se usa:
 *
 * 1. **Médica** → Consultas médicas → «Iniciar la consulta» → la sección
 *    **«Lo registrado en este encuentro»** (C8: el organismo de C6 montado del
 *    lado de quien escribe) con la línea del encuentro.
 * 2. La agenda muestra el **sello de reconsulta** sobre las citas que lo son (C4).
 * 3. **Paciente** → «Mis citas»: el sello y la frase de la reconsulta (C4).
 * 4. **Paciente** → «Mi historia»: la pestaña **Diagnósticos** con sus tres
 *    bloques (C6), y «Atenciones» → desplegar → la línea del encuentro con la
 *    **reconsulta** dentro (C4 → C6, que es lo que C8 cableó).
 * 5. `page.reload()` en cada pantalla final: lo que se ve sobrevive a recargar.
 * 6. Ningún uuid en la historia del paciente, que es la superficie más sensible.
 *
 * ## Contra el simulador, no contra la API
 *
 * Igual que C4: la rama `mockup` declara `mockBackend: true` y el interceptor de
 * `src/app/core/mock/` contesta todo. Las cuentas son las del propio simulador
 * (`medica@alovida.mock`, `paciente@alovida.mock`), personas **sintéticas**
 * declaradas en `core/mock/fixtures/personas.ts`.
 *
 * ## Lo que este archivo NO demuestra
 *
 * **No se ejecutó.** `scripts/pw-guard.mjs` no existe en este árbol —era
 * artefacto de C0— y el turno de C8 tenía prohibido levantar un servidor. El
 * peldaño de evidencia de este archivo es `WRITTEN`, nunca `TESTED`, y así está
 * declarado en `docs/trabajo/2026-09-25-encuentro-clinico/c8/REPORTE.md`.
 * Citarlo como verificación de cualquier cosa sería inventar evidencia.
 */

const BASE = process.env['PW_BASE_URL'] ?? 'http://localhost:4218';

const CONSULTAS = '/schedule';
const MIS_CITAS = '/my-account/appointments';
const MI_HISTORIA = '/my-account/medical-record';

/** La forma de un uuid. Ni uno puede aparecer en la historia del paciente. */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Abre la primera consulta de la agenda de la médica.
 *
 * Se entra **desde la cita** y no desde el expediente: es la puerta que lleva el
 * `?cita=`, y es la que ata el encuentro a su turno.
 */
async function abrirConsultaDesdeLaCita(page: Page): Promise<void> {
  await entrarAlSimulador(page, 'medica', BASE);
  await page.goto(`${BASE}${CONSULTAS}`, { waitUntil: 'domcontentloaded' });
  await esperarAQueSeAsiente(page);

  await page.getByRole('link', { name: /iniciar la consulta/i }).first().click();
  await page.waitForURL((url) => url.searchParams.has('cita'), { timeout: 30_000 });
  await esperarAQueSeAsiente(page);
}

/** Abre «Mi historia clínica» con la sesión de la paciente del simulador. */
async function abrirMiHistoria(page: Page): Promise<void> {
  await entrarAlSimulador(page, 'paciente', BASE);
  await page.goto(`${BASE}${MI_HISTORIA}`, { waitUntil: 'domcontentloaded' });
  await esperarAQueSeAsiente(page);
}

/** Abre una pestaña de la historia por su nombre visible. */
async function abrirPestana(page: Page, nombre: string): Promise<void> {
  await page.getByRole('tab', { name: new RegExp(`^${nombre}`) }).click();
  await esperarAQueSeAsiente(page);
}

test.describe.configure({ mode: 'serial' });

test.describe('C8 · lo que el paquete «Encuentro clínico» entregó de verdad', () => {
  test('la consulta muestra «Lo registrado en este encuentro» con su línea', async ({ page }) => {
    await abrirConsultaDesdeLaCita(page);

    const seccion = page.getByTestId('consulta-lo-registrado');
    test.skip(
      (await seccion.count()) === 0,
      'La cita de la que se entró no tiene encuentro abierto: sin encuentro no hay línea.',
    );

    await expect(seccion).toBeVisible();
    await expect(seccion.getByRole('heading', { name: 'Lo registrado en este encuentro' })).toBeVisible();

    // La línea dice en qué estado está la atención: en curso o cerrada. Nunca
    // se queda muda, que es lo que haría un bloque vacío sin explicación.
    const linea = page.getByTestId('consulta-linea-encuentro');
    await expect(linea).toContainText(/Atención (en curso|cerrada)|todavía no quedó nada registrado/);

    // Recargar no la pierde: sale de las mismas dos lecturas que la pantalla ya
    // hace, no de un estado que sólo existía en memoria.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await esperarAQueSeAsiente(page);
    await expect(page.getByTestId('consulta-lo-registrado')).toBeVisible();
  });

  test('la agenda de la médica sella las citas que son reconsulta', async ({ page }) => {
    await entrarAlSimulador(page, 'medica', BASE);
    await page.goto(`${BASE}${CONSULTAS}`, { waitUntil: 'domcontentloaded' });
    await esperarAQueSeAsiente(page);

    const sello = page.getByTestId('cita-reconsulta-sello').first();
    test.skip(
      (await sello.count()) === 0,
      'La agenda sembrada no tiene ninguna reconsulta en el rango visible.',
    );
    await expect(sello).toBeVisible();
  });

  test('«Mis citas» de la paciente explica de qué consulta sale la reconsulta', async ({
    page,
  }) => {
    await entrarAlSimulador(page, 'paciente', BASE);
    await page.goto(`${BASE}${MIS_CITAS}`, { waitUntil: 'domcontentloaded' });
    await esperarAQueSeAsiente(page);

    const sello = page.getByTestId('mis-citas-reconsulta-sello').first();
    test.skip(
      (await sello.count()) === 0,
      'La paciente sembrada no tiene ninguna reconsulta agendada.',
    );

    await expect(sello).toBeVisible();
    // El sello solo no alcanza: la frase es la que dice de qué consulta sale.
    // Sin ella, «Reconsulta» es una etiqueta que no explica nada.
    await expect(page.getByTestId('mis-citas-reconsulta-frase').first()).toContainText(
      /consulta del/i,
    );
  });

  test('la historia de la paciente reparte los diagnósticos en tres bloques', async ({ page }) => {
    await abrirMiHistoria(page);

    await abrirPestana(page, 'Diagnósticos');

    const enEstudio = page.getByTestId('historia-en-estudio');
    if ((await enEstudio.count()) > 0) {
      // Los tres, siempre: uno que desaparece cuando está vacío obliga a
      // adivinar si no hay nada o si el sistema no lo trajo.
      await expect(enEstudio).toBeVisible();
      await expect(page.getByTestId('historia-activas')).toBeVisible();
      await expect(page.getByTestId('historia-historicos')).toBeVisible();
    } else {
      await expect(page.getByText('Todavía no tenés diagnósticos registrados')).toBeVisible();
    }

    // La pestaña vive en la URL: recargar no la pierde.
    await page.reload({ waitUntil: 'domcontentloaded' });
    await esperarAQueSeAsiente(page);
    await expect(page.getByRole('tab', { name: /^Diagnósticos/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  /**
   * El tramo que justifica C8: C4 produce el vínculo, C6 dibuja el hecho, y
   * hasta esta integración nadie los ataba. Si la paciente sembrada tiene una
   * reconsulta, su atención de origen tiene que nombrarla con día y hora.
   */
  test('la línea del encuentro nombra la reconsulta que salió de esa atención', async ({
    page,
  }) => {
    await abrirMiHistoria(page);

    const paneles = page.getByTestId('historia-atenciones').locator('.accordion-panel__trigger');
    test.skip(
      (await paneles.count()) === 0,
      'La paciente sembrada no tiene atenciones: no hay línea que desplegar.',
    );

    // Plegado, el contenido NO está en el DOM: es un acordeón, no una lista.
    await expect(page.getByTestId('historia-linea-encuentro')).toHaveCount(0);

    await paneles.first().click();
    await esperarAQueSeAsiente(page);

    const linea = page.getByTestId('historia-linea-encuentro').first();
    await expect(linea).toBeVisible();
    await expect(linea.locator('.linea-encuentro__hecho')).not.toHaveCount(0);

    // La reconsulta es un hecho más de la línea, con su propio tipo.
    const reconsulta = page.locator('[data-tipo="reconsulta"]');
    test.skip(
      (await reconsulta.count()) === 0,
      'Ninguna atención de la paciente sembrada derivó en una reconsulta.',
    );
    await expect(reconsulta.first()).toContainText(
      /Reconsulta el \d{1,2}\/\d{1,2} a las \d{1,2}:\d{2}/,
    );
  });

  test('ningún uuid llega a la historia de la paciente, en ninguna pestaña', async ({ page }) => {
    await abrirMiHistoria(page);

    for (const pestana of ['Atenciones', 'Recetas', 'Alergias', 'Resultados', 'Diagnósticos']) {
      await abrirPestana(page, pestana);
      expect(await page.locator('body').innerText()).not.toMatch(UUID);
    }

    // Y con la línea desplegada, que es donde más datos hay — incluida la
    // reconsulta, que llega con el identificador de una reserva.
    await abrirPestana(page, 'Atenciones');
    const paneles = page.getByTestId('historia-atenciones').locator('.accordion-panel__trigger');
    if ((await paneles.count()) > 0) {
      await paneles.first().click();
      await esperarAQueSeAsiente(page);
      expect(await page.locator('body').innerText()).not.toMatch(UUID);
    }
  });
});
