import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * Tarea 4 — Campañas preventivas de la aseguradora (Proceso 4 del cliente,
 * «MODULO DE PROMOCIONES», M-06).
 *
 * `mockBackend: true` en esta rama sirve la aplicación contra
 * `core/mock/handlers/insurance-campaigns.handlers.ts`, no contra la API: lo que
 * se certifica acá es la experiencia de la pantalla. El contrato del backend
 * (400/403/409/422, aislamiento por titular y por aseguradora) lo cubren sus
 * pruebas unitarias en `mantra-core-health-api`.
 *
 * Dos superficies, dos actores:
 *
 * - **La consola de la aseguradora** (`aseguradora@alovida.mock`, dueña de
 *   Seguros Andina): crea y activa campañas, filtra, y sólo ve las suyas.
 * - **El portal del afiliado** (`paciente@alovida.mock`, con cobertura de
 *   Seguros Andina): ve la tarjeta del beneficio en su panel y en la pestaña de
 *   seguros de «Mi cuenta», y el botón la lleva a agendar con la campaña como
 *   contexto.
 *
 * Los tres anchos del criterio de aceptación (1440, 768 y 390) se recorren con
 * las mismas pruebas, con el objetivo táctil mínimo del sistema de diseño.
 */

const CONSOLA = '/administration/insurance-campaigns';

const EVIDENCIA = join(
  process.cwd(),
  'docs',
  'trabajo',
  '2026-09-25-insurance-preventive-campaigns',
  'evidencia',
);

/** Dueña de Seguros Andina: administra la consola de campañas. */
const ASEGURADORA_MOCK: Actor = {
  rol: 'administrador',
  identificador: 'aseguradora@alovida.mock',
  clave: 'cualquiera',
  nombre: 'Aseguradora (maqueta)',
};

/** Afiliada de Seguros Andina, con «Plan Integral». */
const PACIENTE_MOCK: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'cualquiera',
  nombre: 'Paciente (maqueta)',
};

const VIEWPORTS = [
  { nombre: 'escritorio', width: 1440, height: 900 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'movil', width: 390, height: 844 },
] as const;

/**
 * El sistema de diseño baja el mínimo táctil a 40 px recién desde 780 px
 * (`atoms/button/button.css`): a 768 px —tablet vertical— todavía rige el
 * mínimo móvil de 44. Es la misma regla que ya usan las suites de portabilidad
 * y WhatsApp.
 */
function altoMinimoTactil(width: number): number {
  return width >= 780 ? 40 : 44;
}

/** `dd/MM/yyyy` de hoy más `days`, en hora local: lo que pinta el `DatePipe` de la consola. */
function fechaVisible(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

/** El ruido de CSP que `ng serve` inyecta en cualquier ruta (recarga en vivo). */
function esRuidoDelServidorDeDesarrollo(texto: string): boolean {
  return texto.includes('Content Security Policy') && texto.includes('inline script');
}

/** Sin desborde horizontal y con captura completa, guardada como evidencia del PR. */
async function evidencia(page: Page, nombre: string): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Las capturas de página completa redimensionan el viewport: el menú lateral
  // animaba su ancho a mitad de captura y la barra de acciones pegajosa quedaba
  // cruzando el formulario. Para la evidencia se apagan las animaciones y las
  // barras pegajosas pasan a su lugar natural.
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; }',
  });
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
      if (getComputedStyle(el).position === 'sticky') el.style.position = 'static';
    }
  });
  // Sin puntero ni foco residual: un tooltip de hover manchaba la captura.
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), fullPage: true });
}

async function altoDe(page: Page, testId: string): Promise<number> {
  const caja = await page.getByTestId(testId).first().boundingBox();
  expect(caja, `${testId} tiene caja`).not.toBeNull();
  return caja!.height;
}

test.describe.configure({ mode: 'serial' });

for (const viewport of VIEWPORTS) {
  test.describe(`campañas preventivas · ${viewport.nombre} (${viewport.width} px)`, () => {
    const errores: string[] = [];

    test.beforeEach(async ({ page }) => {
      errores.length = 0;
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      page.on('pageerror', (error) => errores.push(`pageerror: ${error.message}`));
      page.on('console', (mensaje) => {
        if (mensaje.type() === 'error' && !esRuidoDelServidorDeDesarrollo(mensaje.text())) {
          errores.push(`console: ${mensaje.text()}`);
        }
      });
    });

    test.afterEach(() => {
      expect(errores, 'errores de consola o de página').toEqual([]);
    });

    test('CA-4.1: la aseguradora crea CMP-CARDIO-E2E con sus aliados y queda Activa', async ({
      page,
    }) => {
      await entrar(page, ASEGURADORA_MOCK);
      await irA(page, CONSOLA);
      await expect(page.getByTestId('campaigns-table')).toBeVisible({ timeout: 30_000 });

      const nueva = page.getByTestId('campaign-new');
      expect(await altoDe(page, 'campaign-new')).toBeGreaterThanOrEqual(
        altoMinimoTactil(viewport.width),
      );
      await nueva.click();
      await expect(page.getByTestId('campaign-form')).toBeVisible();

      await page.getByTestId('campaign-form-code').fill('CMP-CARDIO-E2E');
      await page
        .getByTestId('campaign-form-title')
        .fill('Chequeo Preventivo Cardiovascular (E2E)');
      await page.getByTestId('campaign-form-icd10').fill('I10');

      // Los valores por omisión son los del caso habitual del criterio:
      // laboratorio, 100 % bonificado, vigente hoy y 60 días, activar al crear.
      await expect(page.getByTestId('campaign-form-bonus')).toHaveValue('100');
      await expect(page.getByTestId('campaign-form-valid-from')).not.toHaveValue('');
      await expect(page.getByTestId('campaign-form-valid-to')).not.toHaveValue('');

      await page.getByTestId('campaign-form-partner-name-0').fill('Laboratorio Central AloVida');
      await page.getByTestId('campaign-form-add-partner').click();
      await page.getByTestId('campaign-form-partner-name-1').fill('Farmacias Aliadas');
      await page
        .getByTestId('campaign-form-partner-type-1')
        .locator('select')
        .selectOption({ label: 'Farmacia' });

      await evidencia(page, `campanas-01-formulario-${viewport.nombre}`);

      const enviar = page
        .getByTestId('campaign-form-actions')
        .getByRole('button', { name: 'Guardar campaña' });
      const caja = await enviar.boundingBox();
      expect(caja!.height).toBeGreaterThanOrEqual(altoMinimoTactil(viewport.width));
      await enviar.click();

      // Se cierra el formulario y la campaña aparece Activa con su fecha de caducidad.
      await expect(page.getByTestId('campaign-form')).toBeHidden();
      await expect(page.getByTestId('campaign-row-CMP-CARDIO-E2E')).toBeVisible();
      await expect(page.getByTestId('campaign-status-CMP-CARDIO-E2E')).toContainText('Activa');
      await expect(page.getByTestId('campaigns-table')).toContainText(fechaVisible(60));
      await expect(page.getByTestId('campaigns-table')).toContainText('Hipertensión esencial');

      await evidencia(page, `campanas-02-consola-${viewport.nombre}`);
    });

    test('CA-4.6: el formulario avisa apenas se escribe algo inválido y no envía', async ({
      page,
    }) => {
      await entrar(page, ASEGURADORA_MOCK);
      await irA(page, CONSOLA);
      await expect(page.getByTestId('campaigns-table')).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('campaign-new').click();

      // Código inválido: el error sale al escribir, sin esperar al envío.
      await page.getByTestId('campaign-form-code').fill('código inválido');
      await expect(page.getByTestId('campaign-form')).toContainText('Usá de 3 a 40 caracteres');

      // Fechas invertidas.
      await page.getByTestId('campaign-form-valid-from').fill('2027-01-31');
      await page.getByTestId('campaign-form-valid-to').fill('2027-01-01');
      await expect(page.getByTestId('campaign-form')).toContainText(
        'La fecha final no puede ser anterior a la inicial',
      );

      // Porcentaje fuera de rango.
      await page.getByTestId('campaign-form-bonus').fill('101');
      await expect(page.getByTestId('campaign-form')).toContainText(
        'Escribí un porcentaje entre 0 y 100',
      );

      await page
        .getByTestId('campaign-form-actions')
        .getByRole('button', { name: 'Guardar campaña' })
        .click();
      // Sigue abierto: no se creó nada.
      await expect(page.getByTestId('campaign-form')).toBeVisible();
      await expect(page.getByTestId('campaign-row-CMP-INVALIDA')).toHaveCount(0);
      await evidencia(page, `campanas-03-validacion-${viewport.nombre}`);
    });

    test('CA-4.3/4.4: la consola muestra el estado de cada una y sólo las de su aseguradora', async ({
      page,
    }) => {
      await entrar(page, ASEGURADORA_MOCK);
      await irA(page, CONSOLA);
      await expect(page.getByTestId('campaigns-table')).toBeVisible({ timeout: 30_000 });

      await expect(page.getByTestId('campaign-status-CMP-CARDIO-2026')).toContainText('Activa');
      await expect(page.getByTestId('campaign-status-CMP-DIABETES-2026')).toContainText('Borrador');
      await expect(page.getByTestId('campaign-status-CMP-MAMA-2026')).toContainText('Pausada');
      // Sigue ACTIVE en la base, pero su vigencia terminó: se rotula como vencida.
      await expect(page.getByTestId('campaign-status-CMP-FLU-2025')).toContainText('Vencida');
      // Una activa vencida ya no se pausa: sólo se puede finalizar.
      await expect(page.getByTestId('campaign-action-paused-CMP-FLU-2025')).toHaveCount(0);
      await expect(page.getByTestId('campaign-action-expired-CMP-FLU-2025')).toBeVisible();
      // La de otra aseguradora no existe para esta consola.
      await expect(page.getByTestId('campaign-row-CMP-VITALICIA-OSTEO')).toHaveCount(0);

      // Un filtro por estado es una vista compartible: vive en la dirección.
      await irA(page, `${CONSOLA}?status=PAUSED`);
      await expect(page.getByTestId('campaign-row-CMP-MAMA-2026')).toBeVisible();
      await expect(page.getByTestId('campaign-row-CMP-CARDIO-2026')).toHaveCount(0);
      await evidencia(page, `campanas-04-filtro-${viewport.nombre}`);
    });

    test('CA-4.2 y CA-4.3: el afiliado ve la tarjeta «100% Cubierto» y ninguna que no le corresponde', async ({
      page,
    }) => {
      await entrar(page, PACIENTE_MOCK);
      await irA(page, '/dashboard');

      const tarjeta = page.locator('[data-testid="campaign-card"][data-campaign-code="CMP-CARDIO-2026"]');
      await expect(tarjeta).toBeVisible({ timeout: 30_000 });
      await expect(tarjeta.getByTestId('campaign-badge-coverage')).toContainText(
        '100% Cubierto por tu Seguro',
      );
      await expect(tarjeta).toContainText('Chequeo Preventivo Cardiovascular y Perfil Lipídico');
      await expect(tarjeta).toContainText('Laboratorio Central AloVida');
      await expect(tarjeta).toContainText('Farmacias Aliadas');
      await expect(tarjeta).toContainText('Vigente hasta');
      await expect(tarjeta.getByTestId('btn-campaign-action')).toContainText(
        'Agendar chequeo preventivo',
      );

      // Objetivo táctil del botón de acción.
      const boton = await tarjeta.getByTestId('btn-campaign-action').boundingBox();
      expect(boton!.height).toBeGreaterThanOrEqual(altoMinimoTactil(viewport.width));

      // CA-4.3 y CA-4.4: borrador, pausada, vencida y de otra aseguradora no aparecen.
      for (const codigo of [
        'CMP-DIABETES-2026',
        'CMP-MAMA-2026',
        'CMP-FLU-2025',
        'CMP-VITALICIA-OSTEO',
      ]) {
        await expect(page.locator(`[data-campaign-code="${codigo}"]`), codigo).toHaveCount(0);
      }
      await expect(page.getByTestId('campaign-card')).toHaveCount(1);

      await evidencia(page, `campanas-05-panel-afiliado-${viewport.nombre}`);
    });

    test('el botón lleva a agendar con la campaña como contexto', async ({ page }) => {
      await entrar(page, PACIENTE_MOCK);
      await irA(page, '/dashboard');

      const boton = page.getByTestId('btn-campaign-action').first();
      await expect(boton).toBeVisible({ timeout: 30_000 });
      await boton.click();

      await page.waitForURL(/\/my-account\/appointments/, { timeout: 30_000 });
      const url = new URL(page.url());
      expect(url.pathname).toBe('/my-account/appointments');
      expect(url.searchParams.get('campaign')).toBe('CMP-CARDIO-2026');
      expect(url.searchParams.get('seccion')).toBe('pedir');
      expect(url.searchParams.get('resource')).toBe('lab');
      expect(url.searchParams.get('campaignTitle')).toContain('Chequeo Preventivo Cardiovascular');

      const aviso = page.getByTestId('turnos-campana');
      await expect(aviso).toBeVisible({ timeout: 30_000 });
      // Se nombra por su título, no por el código, y está a la vista al llegar.
      await expect(aviso).toContainText('Chequeo Preventivo Cardiovascular y Perfil Lipídico');
      await expect(aviso).not.toContainText('CMP-CARDIO-2026');
      await expect(aviso).toBeInViewport();

      await evidencia(page, `campanas-06-agendar-${viewport.nombre}`);
    });

    test('la pestaña de seguros de «Mi cuenta» muestra el mismo beneficio', async ({ page }) => {
      await entrar(page, PACIENTE_MOCK);
      await irA(page, '/my-account?pestana=seguros');

      const tarjeta = page.locator('[data-testid="campaign-card"][data-campaign-code="CMP-CARDIO-2026"]');
      await expect(tarjeta).toBeVisible({ timeout: 30_000 });
      await expect(tarjeta.getByTestId('campaign-badge-coverage')).toContainText(
        '100% Cubierto por tu Seguro',
      );
      await expect(page.locator('[data-campaign-code="CMP-VITALICIA-OSTEO"]')).toHaveCount(0);

      await evidencia(page, `campanas-07-mi-cuenta-seguros-${viewport.nombre}`);
    });

    test('CA-4.7: un paciente no llega a la consola de la aseguradora', async ({ page }) => {
      await entrar(page, PACIENTE_MOCK);
      await irA(page, CONSOLA);

      // La sección está oculta para el paciente: ni su tabla ni su botón aparecen.
      await expect(page.getByTestId('campaigns-table')).toHaveCount(0);
      await expect(page.getByTestId('campaign-new')).toHaveCount(0);
    });
  });
}
