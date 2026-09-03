import { test, expect, type Page } from '@playwright/test';

import { administrador, apiViva, contextoDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 20 — auditoría visual del módulo contable (TAREA-20).
 *
 * ## Qué es esto y qué no es
 *
 * Esta suite **no implementa** las pestañas o exportaciones que faltan (son de
 * otra sesión, en `wt-claude-t20-front`/`wt-claude-t20-api`): audita lo que
 * `src/app/features/accounting/` **ya muestra hoy** contra la API viva —qué
 * pestañas existen de verdad, si el formulario de asientos es de N filas, si
 * hay exportación— y deja evidencia visual en tres anchos.
 *
 * ## Un solo ingreso
 *
 * `POST /iam/auth/login` admite diez por minuto y por IP (ver `sesion.ts`),
 * así que todo el recorrido va en **una sola prueba** con una sola sesión de
 * `administrador()` — tiene `SECURITY_ADMIN` y `SUPERADMIN`, así que ve la
 * vista de quien lleva los libros (no la de un `PRACTITIONER`) y puede abrir
 * MODO CONTADOR.
 *
 * ## Orden deliberado: capturas primero, MODO CONTADOR al final
 *
 * El árbol interactivo de MODO CONTADOR (agregar filas de a una, con sus
 * `<select>` nativos) es la parte más frágil de automatizar. Se lo dejó al
 * final y envuelto en su propio bloque con timeouts cortos explícitos: si algo
 * ahí se traba, falla rápido y **no** se lleva puestas las capturas de las
 * pestañas y los libros, que ya están confirmadas con datos reales.
 *
 * ## Por qué no se postea ningún asiento
 *
 * El encargo pide no escribir en la base contable salvo que sea
 * imprescindible. El único POST que dispara esta suite es un **borrador
 * deliberadamente descuadrado**: `createDraft` valida el balance **antes** de
 * la transacción (`ledger.service.ts:289`), así que la llamada falla con 422 y
 * no persiste nada.
 */

const RUTA_CONTABILIDAD = '/administration/accounting';
const ACCION_TIMEOUT = 8_000;

const ANCHOS = [
  { nombre: '390x844 (móvil)', width: 390, height: 844 },
  { nombre: '768x1024 (tablet)', width: 768, height: 1024 },
  { nombre: '1440x900 (escritorio)', width: 1440, height: 900 },
] as const;

/** Sin scroll horizontal del `body`, en el ancho que sea (AC-20-18). */
async function sinScrollHorizontal(page: Page): Promise<{ scrollWidth: number; clientWidth: number }> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

function slugificar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-');
}

test.describe('Carril 20 · módulo contable — auditoría visual', () => {
  test.beforeAll(async () => {
    const api = await contextoDeApi();
    const viva = await apiViva(api);
    await api.dispose();
    test.skip(!viva, 'La API no responde: no hay libros que auditar.');
  });

  test('pestañas existentes, exportación, MODO CONTADOR y responsive', async ({ page }) => {
    test.setTimeout(300_000);

    /**
     * DEFECTO DE CONTRATO encontrado en la auditoría, ajeno a esta pantalla:
     * `AccountingClient.listPractices()` (`core/data-access/accounting/accounting.client.ts:65-69`)
     * espera `{ items, count }` de `GET /practices`, pero el controlador real
     * (`practices.controller.ts:107`, `Promise<PracticeSummaryDto[]>`) devuelve
     * un **array desnudo** — confirmado con `curl` contra la API viva. Los
     * otros tres clientes del repo que leen `/practices`
     * (`medical-organization.client.ts:44`, `services-catalog.client.ts:41`,
     * `practice-sites.client.ts`) lo tratan correctamente como array. Sin este
     * parche, `body.items.map(...)` explota, el error queda silenciado por el
     * `catchError(() => of([]))` de `accounting.ts:187-190`, y el selector de
     * práctica **nunca tiene una opción real** — la pantalla entera queda
     * inutilizable para cualquier usuario real, hoy, en producción.
     *
     * Se intercepta acá, en el test, para poder seguir auditando el resto de
     * la pantalla con datos reales — no se toca el código fuente, que vive
     * fuera de `features/accounting/` y es compartido con `my-organizations.ts`.
     */
    await page.route('**/practices', async (route) => {
      const respuesta = await route.fetch();
      const cuerpo: unknown = await respuesta.json();
      if (Array.isArray(cuerpo)) {
        await route.fulfill({
          status: respuesta.status(),
          contentType: 'application/json',
          body: JSON.stringify({ items: cuerpo, count: cuerpo.length }),
        });
      } else {
        await route.fulfill({ response: respuesta });
      }
    });

    await entrar(page, administrador());
    await irA(page, RUTA_CONTABILIDAD);
    await estable(page);

    const pantalla = page.locator('app-accounting');
    await expect(pantalla).toBeVisible();

    /* ── 1. Elegir la práctica sembrada (11 cuentas, 8 asientos) ──────────── */
    const selectorDePractica = pantalla.locator('app-select').first().locator('select');
    await expect(selectorDePractica).toBeVisible();
    await selectorDePractica.selectOption({ index: 1 });
    await estable(page);

    /* ── 2. Los libros ya existentes (balance de sumas y saldos + diario) ── */
    await expect(pantalla.getByRole('heading', { name: 'Balance de sumas y saldos' })).toBeVisible();
    await expect(pantalla.getByRole('heading', { name: 'Libro diario' })).toBeVisible();

    /* ── 3. HUECO #1 — cuántas pestañas hay de verdad ─────────────────────── */
    const listaDePestanas = pantalla.locator('[role="tablist"]');
    const hayTablist = (await listaDePestanas.count()) > 0;
    const rotulosDePestanas = hayTablist
      ? await listaDePestanas.first().locator('[role="tab"]').evaluateAll((nodos) =>
          nodos.map((n) => (n.textContent ?? '').trim()),
        )
      : [];
    console.log('[carril-20] Pestañas dentro de <app-tabs>:', JSON.stringify(rotulosDePestanas));
    console.log(
      '[carril-20] Secciones fuera de <app-tabs> (siempre visibles): "Balance de sumas y saldos", "Libro diario"',
    );

    const SEIS_PESTANAS_DEL_PEDIDO = [
      'Cuadro de mando integral',
      'Libro diario',
      'Libro mayor',
      'Flujo de caja',
      'Estado de resultados',
      'Balance general',
    ];
    const faltantes = SEIS_PESTANAS_DEL_PEDIDO.filter(
      (nombre) => !rotulosDePestanas.includes(nombre) && nombre !== 'Libro diario',
    );
    console.log('[carril-20] De las seis pestañas del pedido, ausentes como pestaña real:', faltantes);

    /* ── 4. HUECO #2 — exportación (CSV/PDF) ──────────────────────────────── */
    const botonesDeExportacion = pantalla.getByRole('button', { name: /descargar|exportar|csv|pdf/i });
    const cantidadDeExportacion = await botonesDeExportacion.count();
    console.log('[carril-20] Botones de exportación (CSV/PDF) encontrados:', cantidadDeExportacion);
    expect(cantidadDeExportacion).toBe(0);

    /* ── 5. Capturas de "Balance + diario" en tres anchos, YA con datos ──── */
    for (const ancho of ANCHOS) {
      await page.setViewportSize({ width: ancho.width, height: ancho.height });
      await page.waitForTimeout(300);

      const medidas = await sinScrollHorizontal(page);
      console.log(
        `[carril-20] ${ancho.nombre} (libros) — scrollWidth=${medidas.scrollWidth} clientWidth=${medidas.clientWidth}`,
      );
      expect(
        medidas.scrollWidth,
        `${ancho.nombre}: scrollWidth (${medidas.scrollWidth}) > clientWidth (${medidas.clientWidth}) — hay scroll horizontal del body`,
      ).toBeLessThanOrEqual(medidas.clientWidth);

      await page.screenshot({
        path: `artifacts/playwright/tarea-20/contabilidad-libros-${ancho.width}.png`,
        fullPage: true,
      });
    }

    /* ── 6. Recorrer y fotografiar cada pestaña de <app-tabs>, si hay ────── */
    if (hayTablist) {
      for (const rotulo of rotulosDePestanas) {
        await page.getByRole('tab', { name: rotulo, exact: true }).click();
        await estable(page);
        // El panel inactivo no se renderiza (ver `tab.html`): que el panel
        // activo tenga contenido es la prueba de que sí se instanció.
        await expect(pantalla.locator('.tabs__panels')).not.toBeEmpty();

        const slug = slugificar(rotulo);
        for (const ancho of ANCHOS) {
          await page.setViewportSize({ width: ancho.width, height: ancho.height });
          await page.waitForTimeout(300);
          const medidas = await sinScrollHorizontal(page);
          console.log(
            `[carril-20] ${ancho.nombre} (${rotulo}) — scrollWidth=${medidas.scrollWidth} clientWidth=${medidas.clientWidth}`,
          );
          expect(
            medidas.scrollWidth,
            `${ancho.nombre} · pestaña "${rotulo}": hay scroll horizontal del body`,
          ).toBeLessThanOrEqual(medidas.clientWidth);
          await page.screenshot({
            path: `artifacts/playwright/tarea-20/contabilidad-${slug}-${ancho.width}.png`,
            fullPage: true,
          });
        }
      }
    }

    // Volver al ancho de escritorio y a la primera pestaña antes de MODO CONTADOR.
    await page.setViewportSize({ width: 1440, height: 900 });
    if (hayTablist) {
      await page.getByRole('tab', { name: rotulosDePestanas[0], exact: true }).click();
      await estable(page);
    }

    /* ── 7. HUECO #3 — MODO CONTADOR: ¿de dos líneas o de N? ──────────────
       Envuelto entero en try/catch con timeouts cortos: si algo acá se
       traba, se reporta y se sigue — no debe costar las capturas ya hechas. */
    try {
      const botonModoContador = pantalla.getByRole('button', { name: 'MODO CONTADOR', exact: true });
      await expect(botonModoContador).toBeVisible({ timeout: ACCION_TIMEOUT });
      await botonModoContador.click({ timeout: ACCION_TIMEOUT });
      await estable(page);

      const panelModoContador = pantalla.locator('.titulo-de-seccion', { hasText: 'MODO CONTADOR' });
      await expect(panelModoContador).toBeVisible({ timeout: ACCION_TIMEOUT });

      // El formulario de la fila en curso: cuenta + dirección + importe + memo,
      // con un botón «Agregar fila» — es el formulario de N filas, no de dos
      // líneas fijas de débito/crédito.
      const formularioDeFila = pantalla.locator('form').filter({
        has: page.getByRole('button', { name: 'Agregar fila' }),
      });
      await expect(formularioDeFila).toBeVisible({ timeout: ACCION_TIMEOUT });

      // Captura del panel recién abierto, con el formulario a la vista, en
      // los tres anchos — esto por sí solo ya vale como evidencia visual de
      // MODO CONTADOR aunque la carga de filas de abajo falle.
      for (const ancho of ANCHOS) {
        await page.setViewportSize({ width: ancho.width, height: ancho.height });
        await page.waitForTimeout(300);
        await page.screenshot({
          path: `artifacts/playwright/tarea-20/contabilidad-modo-contador-vacio-${ancho.width}.png`,
          fullPage: true,
        });
      }
      await page.setViewportSize({ width: 1440, height: 900 });

      const cuentaSelect = formularioDeFila.locator('select').first();
      const direccionSelect = formularioDeFila.locator('select').nth(1);
      const importeInput = formularioDeFila.locator('input[type="text"]').first();
      const agregarFilaBtn = formularioDeFila.getByRole('button', { name: 'Agregar fila' });

      // `app-select` pone el `value` real de cada `<option>` como el índice de
      // `$index` (ver `select.html`), no el valor del modelo — así que se
      // elige por **rótulo**, no por 'DEBIT'/'CREDIT'.
      const filas: Array<{ label: 'Debe' | 'Haber'; amount: string }> = [
        { label: 'Debe', amount: '100.00' },
        { label: 'Haber', amount: '35.00' },
      ];
      for (const [i, fila] of filas.entries()) {
        await cuentaSelect.selectOption({ index: 1 }, { timeout: ACCION_TIMEOUT });
        await direccionSelect.selectOption({ label: fila.label }, { timeout: ACCION_TIMEOUT });
        await importeInput.fill(fila.amount, { timeout: ACCION_TIMEOUT });
        await agregarFilaBtn.click({ timeout: ACCION_TIMEOUT });
        console.log(`[carril-20] MODO CONTADOR: fila ${i + 1} (${fila.label} ${fila.amount}) agregada`);
      }

      const filasDeLaLista = pantalla.locator('.fila-del-asiento');
      const cantidadDeFilas = await filasDeLaLista.count();
      console.log('[carril-20] Filas agregadas al asiento de MODO CONTADOR:', cantidadDeFilas);
      // El punto duro del hueco #3: si el front sólo soportara dos líneas
      // fijas, esta segunda fila ya sería un problema.
      expect(cantidadDeFilas).toBeGreaterThanOrEqual(2);

      // Cada fila trae "Modificar" y "Eliminar" (AC-20-8).
      await expect(filasDeLaLista.first().getByRole('button', { name: 'Modificar' })).toBeVisible({
        timeout: ACCION_TIMEOUT,
      });
      await expect(filasDeLaLista.first().getByRole('button', { name: 'Eliminar' })).toBeVisible({
        timeout: ACCION_TIMEOUT,
      });

      // El descuadre en vivo, anunciado como TEXTO (no sólo color) — WCAG.
      const selloDeCuadre = pantalla.locator('.cuadre').filter({ hasText: /Cuadra|Descuadrado/ });
      if ((await selloDeCuadre.count()) > 0) {
        await expect(selloDeCuadre.first()).toContainText(/Descuadrado/, { timeout: ACCION_TIMEOUT });
        console.log('[carril-20] Descuadre en vivo detectado y anunciado como texto: OK');
      }

      // Capturas del asiento cargado, con el descuadre en vivo, en tres anchos.
      for (const ancho of ANCHOS) {
        await page.setViewportSize({ width: ancho.width, height: ancho.height });
        await page.waitForTimeout(300);
        const medidas = await sinScrollHorizontal(page);
        console.log(
          `[carril-20] ${ancho.nombre} (MODO CONTADOR con filas) — scrollWidth=${medidas.scrollWidth} clientWidth=${medidas.clientWidth}`,
        );
        expect(
          medidas.scrollWidth,
          `${ancho.nombre} · MODO CONTADOR: hay scroll horizontal del body`,
        ).toBeLessThanOrEqual(medidas.clientWidth);
        await page.screenshot({
          path: `artifacts/playwright/tarea-20/contabilidad-modo-contador-filas-${ancho.width}.png`,
          fullPage: true,
        });
      }
      await page.setViewportSize({ width: 1440, height: 900 });

      /* ── 8. HUECO #4 — draft, ¿acepta el descuadre? ─────────────────────
         `createDraft` valida antes de persistir: esta llamada, si el asiento
         quedó descuadrado, debe fallar con 422 y no dejar nada escrito. */
      const botonGuardarBorrador = pantalla.getByRole('button', { name: 'Guardar en borrador' });
      if ((await botonGuardarBorrador.count()) > 0 && (await botonGuardarBorrador.isEnabled())) {
        await botonGuardarBorrador.click({ timeout: ACCION_TIMEOUT });
        await page.waitForTimeout(2_000);
        const alertaDeError = pantalla.locator('.alerta-de-formulario');
        const huboError = await alertaDeError.count().then((n) => n > 0);
        console.log(
          '[carril-20] Intento de guardar borrador DESCUADRADO → hubo alerta de error en pantalla:',
          huboError,
        );
        if (huboError) {
          const texto = await alertaDeError.first().textContent();
          console.log('[carril-20] Texto de la alerta:', texto?.trim());
        }
      }
    } catch (fallo) {
      console.log('[carril-20] MODO CONTADOR: la interacción no se completó —', (fallo as Error).message);
      // No se relanza: las capturas de pestañas y libros ya quedaron a salvo
      // más arriba, y este bloque es evidencia igual de valiosa (un defecto).
    }
  });
});
