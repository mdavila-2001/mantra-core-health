import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * Planes de pago flexibles (sin interés) — evidencia de navegador.
 *
 * 1. Al abrir la consulta de una persona con un plan aceptado, el plan está a
 *    la vista: tratamiento, estado, cuotas sin interés y la próxima a pagar.
 * 2. «Ofrecer plan de pago» abre el alta con la persona ya elegida.
 * 3. El alta no pregunta tasa ni método: arma un cronograma editable cuota por
 *    cuota, y avisa cuando lo escrito a mano deja de sumar el precio.
 *
 * Contra el backend simulado de `mockup` (ver `support/simulador.ts`).
 */

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const FOTOS = join('artifacts', 'planes-de-pago');
/** Ana Pérez en el simulador: `IDS.paciente.patientProfileId` = `uuid('pid-paciente')`. */
const ANA = 'c2aa6dda-67d6-46a6-aa79-a40ca7e62ee0';

test.beforeAll(() => mkdirSync(FOTOS, { recursive: true }));

test('la consulta muestra el plan de pago y el alta lo arma sin interés', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });

  await entrarAlSimulador(page, 'medica', BASE);

  // ─── La consulta ────────────────────────────────────────────────────────
  await page.goto(`${BASE}/medical-records/${ANA}/consultation`);
  const panel = page.getByTestId('consulta-plan-de-pago');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Plan de pago' })).toBeVisible();
  await expect(panel).toContainText('En curso');
  await expect(panel).toContainText('sin interés');
  await expect(page.getByText(/tasa de inter/i)).toHaveCount(0);
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(FOTOS, 'consulta-1440.png'), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(FOTOS, 'consulta-375.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });

  // ─── Desde la consulta, al alta con la persona elegida ─────────────────
  await page.getByTestId('consulta-ofrecer-plan-de-pago').click();
  await expect(page).toHaveURL(/\/my-quotations\/new\?patient=/);
  await expect(page.getByTestId('quotation-form-paciente-elegido')).toContainText('Ana');

  // Sin tasa, sin método, sin simulador.
  await expect(page.getByText(/tasa de inter|m[eé]todo de c[aá]lculo|simulador/i)).toHaveCount(0);
  await expect(page.getByText('Sin interés.', { exact: false })).toBeVisible();

  // Un servicio del catálogo y la fecha de atención arman el plan solo.
  await page.getByRole('button', { name: 'Elegir' }).first().click();
  const fecha = page.getByLabel('Fecha de atención');
  // La máscara es por segmentos: se empieza desde el del día, no desde donde
  // cayó el clic (que en la primera prueba fue el año).
  await fecha.focus();
  await fecha.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 2));
  await fecha.pressSequentially('20092026');
  await fecha.blur();

  const cuotas = page.getByRole('list', { name: 'Cuotas del plan' }).getByRole('listitem');
  await expect(cuotas).toHaveCount(3);
  await expect(page.getByTestId('quotation-form-plan-mismatch')).toHaveCount(0);

  // Quincenal mueve las fechas; una cuota fijada a mano reparte el resto.
  await page.getByRole('radio', { name: 'Quincenal' }).or(page.getByRole('button', { name: 'Quincenal' })).first().click();
  // El rearmado aterriza en el ciclo siguiente: se espera a verlo (atención el
  // 20/09 → primera cuota quincenal el 04/10) antes de fijar un monto encima.
  await expect(page.getByLabel('Vencimiento de la cuota 1')).toHaveValue('04/10/2026');
  await page.getByTestId('quotation-form-installment-amount-1').fill('10');
  await page.getByTestId('quotation-form-installment-amount-1').blur();
  await expect(cuotas.first()).toContainText('Fijado a mano');
  await expect(page.getByTestId('quotation-form-plan-mismatch')).toHaveCount(0);

  await page.getByTestId('quotation-form-add-installment').click();
  await expect(cuotas).toHaveCount(4);
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(FOTOS, 'alta-1440.png'), fullPage: true });

  await page.setViewportSize({ width: 375, height: 812 });
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(FOTOS, 'alta-375.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // Excluidas sólo dos firmas, preexistentes y ajenas a este cambio (ninguno de
  // sus archivos está en el diff):
  // - `ubicar()` de `core/alovida/alovida-runtime.service.ts` lanza
  //   `insertBefore` cuando la ventana cruza su media query —lo provoca el
  //   `setViewportSize` de arriba— y el reportador de la app lo repite.
  // - La CSP del `index.html` rechaza los scripts en línea que inyecta
  //   `ng serve`; en el build de producción no existen.
  // Cualquier otro error falla.
  const ajenos = [/insertBefore.*not a child of this node/, /Executing inline script violates/];
  const propios = errores.filter((e) => !ajenos.some((firma) => firma.test(e)));
  expect(propios, propios.join('\n')).toEqual([]);
});
