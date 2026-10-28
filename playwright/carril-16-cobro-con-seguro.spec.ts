import { mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from '@playwright/test';

import { entrarAlSimulador } from './support/simulador';

/**
 * REQ-16-026, 031, 032 y 035 (punto 5), contra el backend simulado: la médica
 * cotiza el cobro en el bloque «Pagos» de la consulta; el paciente ve su
 * desglose en «Mis solicitudes» y objeta el cobro. Serial, un solo trabajador,
 * claro y oscuro, en 375, 768 y 1280 px.
 *
 * Las capturas son del elemento que se mide, no de la página entera: así no
 * entran las cabeceras con el nombre de la persona.
 */

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

/** Id de perfil de la paciente de la maqueta (`uuid('pid-paciente')`). */
const PACIENTE = 'c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0';

/** La aprobación previa de prueba: aprueba los cobros de internación de la maqueta. */
const APROBACION_DE_PRUEBA = '00000000-0000-4000-8000-0000000000a1';

const ANCHOS = [
  { nombre: '375', width: 375, height: 812 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1280', width: 1280, height: 800 },
] as const;

const P0 = path.resolve('docs/progress/evidence/lane-16/P0');

type Tema = 'claro' | 'oscuro';

/** Abre una sesión con el tema fijado antes de la primera carga, como ve la persona al entrar. */
async function sesion(browser: Browser, rol: 'medica' | 'paciente', tema: Tema) {
  const contexto: BrowserContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
  });
  await contexto.addInitScript((valor: string) => {
    window.localStorage.setItem('mantra-core-health.theme', valor);
  }, tema === 'oscuro' ? 'dark' : 'light');
  const page: Page = await contexto.newPage();
  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));
  await entrarAlSimulador(page, rol, BASE);
  await expect(page.locator('html')).toHaveAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light');
  return { contexto, page, errores };
}

/** Sin desborde horizontal del documento: REQ-16-035 en cada ancho. */
async function sinDesbordeHorizontal(page: Page): Promise<void> {
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(desborda, 'la pantalla desborda a lo ancho').toBe(false);
}

/**
 * Captura lo que la persona ve del elemento dentro del diálogo: el elemento se
 * desplaza a la vista y la captura se recorta al diálogo, para no mezclar la
 * página de fondo cuando el bloque es más alto que la pantalla.
 */
async function fotoDentroDelDialogo(page: Page, elemento: Locator, ruta: string, alineacion: 'start' | 'end'): Promise<void> {
  await elemento.evaluate((el, bloque) => el.scrollIntoView({ block: bloque }), alineacion);
  const dialogo = await page.locator('dialog[open]').first().boundingBox();
  const caja = await elemento.boundingBox();
  expect(dialogo && caja, 'no hay diálogo abierto para capturar').toBeTruthy();
  const x = Math.max(dialogo!.x, caja!.x);
  const y = Math.max(dialogo!.y, caja!.y);
  const fin = Math.min(dialogo!.y + dialogo!.height, caja!.y + caja!.height);
  const ancho = Math.min(dialogo!.x + dialogo!.width, caja!.x + caja!.width) - x;
  await page.screenshot({ path: ruta, clip: { x, y, width: ancho, height: fin - y } });
}

function foto(nombre: string, ancho: string, tema: Tema): string {
  mkdirSync(P0, { recursive: true });
  return path.join(P0, `${nombre}-${ancho}-${tema === 'oscuro' ? 'oscuro' : 'claro'}.png`);
}

for (const tema of ['claro', 'oscuro'] as const) {
  test.describe.serial(`la médica cotiza el cobro · tema ${tema}`, () => {
    let contexto: BrowserContext;
    let page: Page;
    let errores: string[];

    test.beforeAll(async ({ browser }) => {
      ({ contexto, page, errores } = await sesion(browser, 'medica', tema));
    });

    test.afterAll(async () => {
      await contexto.close();
    });

    test('REQ-16-026 · el reparto del cobro aparece en el bloque Pagos de la consulta', async () => {
      await page.goto(`${BASE}/medical-records/${PACIENTE}/consultation`);
      await page.getByTestId('consulta-casilla-pagos').click();
      await expect(page.getByTestId('claim-quote-section')).toBeVisible();
    });

    test('REQ-16-024 · sin la aprobación previa, el envío queda deshabilitado y la alerta lo explica', async () => {
      await page.getByTestId('claim-quote-section').locator('input').first().fill('quirúrgico');
      await page.getByRole('option', { name: /quirúrgico/i }).first().click();
      await page.getByTestId('claim-quote-amount').fill('500.00');

      await expect(page.getByTestId('claim-quote-alert')).toContainText(/aprobación previa/i);
      await expect(page.getByTestId('claim-quote-submit')).toHaveAttribute('aria-disabled', 'true');
    });

    test('REQ-16-026 · con la aprobación, el reparto es el del servidor y el envío se habilita', async () => {
      await page.getByTestId('claim-quote-prior-auth').fill(APROBACION_DE_PRUEBA);

      // Internación de la maqueta: 90 % de cobertura, sin copago. 500.00 → 50.00 paciente, 450.00 aseguradora.
      await expect(page.getByTestId('claim-quote-total-patient')).toContainText('50.00');
      await expect(page.getByTestId('claim-quote-total-insurer')).toContainText('450.00');
      await expect(page.getByTestId('claim-quote-alert')).toHaveCount(0);
      await expect(page.getByTestId('claim-quote-submit')).toHaveAttribute('aria-disabled', 'false');
    });

    for (const ancho of ANCHOS) {
      test(`REQ-16-035 · el reparto se lee sin desborde en ${ancho.nombre} px, tema ${tema}`, async () => {
        await page.setViewportSize({ width: ancho.width, height: ancho.height });
        await expect(page.getByTestId('claim-quote-section')).toBeVisible();
        await sinDesbordeHorizontal(page);
        // El reparto es lo que la médica mira antes de enviar: se captura el bloque, no la cabecera.
        await fotoDentroDelDialogo(page, page.getByTestId('claim-quote-breakdown'), foto('cotizacion-medico-cifras', ancho.nombre, tema), 'start');
        await fotoDentroDelDialogo(page, page.getByTestId('claim-quote-submit'), foto('cotizacion-medico-envio', ancho.nombre, tema), 'end');
      });
    }

    test('la pantalla no lanza errores de ejecución durante el recorrido', async () => {
      expect(errores, errores.join('\n')).toEqual([]);
    });
  });

  test.describe.serial(`el paciente ve su parte y objeta · tema ${tema}`, () => {
    let contexto: BrowserContext;
    let page: Page;

    test.beforeAll(async ({ browser }) => {
      ({ contexto, page } = await sesion(browser, 'paciente', tema));
    });

    test.afterAll(async () => {
      await contexto.close();
    });

    test('REQ-16-031 · el paciente ve qué paga él y qué paga su aseguradora antes de pagar', async () => {
      await page.goto(`${BASE}/my-account/requests`);
      await expect(page.getByTestId('mis-solicitudes-tabla')).toBeVisible();
      await page.getByRole('button', { name: /^Ver (decisión|solicitud) — Solicitud/i }).first().click();

      await expect(page.getByTestId('mis-solicitudes-desglose')).toBeVisible();
      await expect(page.getByTestId('mis-solicitudes-desglose')).toContainText('Bs');
    });

    test('REQ-16-032 · objetar el cobro con un motivo cerrado deja la objeción registrada', async () => {
      await page.getByTestId('mis-solicitudes-objetar').click();
      const modal = page.getByRole('dialog', { name: /objetar cobro/i });
      await expect(modal).toBeVisible();
      await modal.screenshot({ path: foto('objecion-modal', '1280', tema) });

      const enviar = modal.getByRole('button', { name: /presentar objeción/i });
      await expect(enviar).toHaveAttribute('aria-disabled', 'true');

      // El radio nativo queda oculto por el estilo de la casa: se elige desde su etiqueta.
      await modal.getByText(/no coincide/i).click();
      await expect(enviar).toHaveAttribute('aria-disabled', 'false');
      await enviar.click();

      await expect(page.getByTestId('mis-solicitudes-objecion-sello')).toContainText('Objeción presentada');
      await expect(page.getByTestId('mis-solicitudes-objetar')).toHaveCount(0);
    });

    for (const ancho of ANCHOS) {
      test(`REQ-16-035 · el desglose y la objeción se leen sin desborde en ${ancho.nombre} px, tema ${tema}`, async () => {
        await page.setViewportSize({ width: ancho.width, height: ancho.height });
        await expect(page.getByTestId('mis-solicitudes-desglose')).toBeVisible();
        await sinDesbordeHorizontal(page);
        await page.getByTestId('mis-solicitudes-desglose').screenshot({ path: foto('desglose-paciente', ancho.nombre, tema) });
        await page.getByTestId('mis-solicitudes-objecion').screenshot({ path: foto('objecion-paciente', ancho.nombre, tema) });
      });
    }
  });
}

test('REQ-16-035 · ningún nombre de archivo de captura lleva datos de la persona', () => {
  const nombres = readdirSync(P0);
  expect(nombres.length, 'no hay capturas en la carpeta de evidencia').toBeGreaterThan(0);
  for (const nombre of nombres) {
    expect(nombre).not.toMatch(/@|\d{7}|[A-ZÁÉÍÓÚ][a-záéíóú]+ [A-ZÁÉÍÓÚ][a-záéíóú]+/);
  }
});
