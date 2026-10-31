import { mkdir } from 'node:fs/promises';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';

import { esperarAplicacionLista, irA } from './support/sesion';

/**
 * H2.S3.M10: recorridos de DEMO, sin interceptar peticiones desde Playwright.
 * Servir con `corepack yarn start:demo` y ejecutar con Chromium:
 * corepack yarn exec playwright test playwright/hito2-laboratory-insurance.spec.ts --project=chromium --workers=1 --retries=0
 *
 * Se exige el aviso de demo antes de ingresar. Las cuentas, las solicitudes y
 * el PDF son sintéticos. El archivo no se vincula a una persona ni envía avisos.
 * Los handlers de la aplicación guardan metadatos en sessionStorage y los
 * bytes del PDF en IndexedDB: se comprueban ambos después de recargar.
 *
 * Esto NO certifica API real ni facturación fiscal: la factura de
 * `/insurance/received-claims` y el portal P52 del laboratorio sólo existen en el
 * simulador. Ver docs/contracts/insurer-received-claims.md y LabPortalClient.
 */

const LAB_SUMMARY = '/administration/laboratory';
const LAB_ORDERS = '/administration/laboratory-orders';
const RECEIVED_CLAIMS = '/administration/received-claims';
const ANNULMENT_REASON = 'Hito 2: corregir una factura sintética de demostración.';
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

async function signInDemo(page: Page, email: string): Promise<void> {
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  await expect(page.getByRole('complementary', { name: 'Modo de demostración' })).toBeVisible();
  await page.getByTestId('login-identifier').fill(email);
  await page.getByTestId('login-password').fill('mock');
  await expect(page.getByTestId('login-identifier')).toHaveValue(email);
  await expect(page.getByTestId('login-password')).toHaveValue('mock');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/);
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/);
  }
  await esperarAplicacionLista(page);
}

function observeBrowserErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function capture(page: Page, name: string, width: number, info: TestInfo): Promise<void> {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    `${name}: la página no debe desbordar horizontalmente a ${width} px`,
  ).toBe(false);
  await mkdir('artifacts/playwright/hito2', { recursive: true });
  const path = `artifacts/playwright/hito2/${name}-${width}.png`;
  await page.screenshot({ path, fullPage: true });
  await info.attach(`${name}-${width}`, { path, contentType: 'image/png' });
}

/** PDF válido de una página, con tabla xref y texto ASCII exclusivamente sintético. */
function syntheticPdf(): Buffer {
  const stream = 'BT\n/F1 14 Tf\n50 750 Td\n(ALOVIDA H2 - DOCUMENTO SINTETICO SIN DATOS CLINICOS) Tj\nET\n';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}endstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

async function reopenApprovedClaim(page: Page, claimIdentifier: string): Promise<Locator> {
  await page.reload();
  await esperarAplicacionLista(page);
  await expect(page.getByTestId('received-claims-queue')).toBeVisible();
  await page.getByTestId('received-claims-queue').getByRole('radio', { name: /^Aprobadas/ }).click();
  await page.getByRole('textbox', { name: 'Buscar en las solicitudes' }).fill(claimIdentifier);
  const opener = page.getByTestId('received-claim-open');
  await expect(opener).toHaveCount(1);
  await expect(opener).toHaveAttribute('aria-label', new RegExp(claimIdentifier));
  await opener.click();
  const detail = page.getByRole('dialog', { name: 'Detalle de la solicitud' });
  await expect(detail).toBeVisible();
  await expect(detail).toContainText(claimIdentifier);
  return detail;
}

test.describe('Hito 2 · laboratorio y aseguradora · solo demo', () => {
  test.describe.configure({ retries: 0 });

  for (const viewport of VIEWPORTS) {
    test(`laboratorio: portal, PDF y persistencia tras recarga a ${viewport.width} px`, async ({ page }, info) => {
      const errors = observeBrowserErrors(page);
      const fileName = `hito2-synthetic-laboratory-${viewport.width}.pdf`;
      const pdf = syntheticPdf();
      await page.setViewportSize(viewport);
      await signInDemo(page, 'laboratorio@alovida.mock');

      await irA(page, LAB_SUMMARY);
      const summary = page.getByTestId('summary-card');
      await expect(summary).toBeVisible();
      await expect(page.getByTestId('summary-result-files')).toHaveText(/^\d+$/);
      const initialCount = Number(await page.getByTestId('summary-result-files').innerText());
      await capture(page, 'laboratory-portal-before', viewport.width, info);
      // «Órdenes» (31/10/2026) junta recepción, cola y resultados: recibida → procesada →
      // resultados subidos → descarga, todo desde el menú de acciones de la fila.
      await summary.getByRole('link', { name: /^Recibir y procesar órdenes/ }).click();
      await expect(page).toHaveURL(new RegExp(`${LAB_ORDERS}\\?estado=draft$`));
      await page.getByRole('tab', { name: /^Recibidas/ }).click();
      const order = page.locator('tbody tr').first();
      await expect(order.getByTestId('lab-order-status')).toHaveText('Recibida');
      const orderMenu = async (action: string): Promise<void> => {
        await order.getByRole('button', { name: /^Acciones/ }).click();
        await page.getByRole('menuitem', { name: action, exact: true }).click();
      };
      const orderName = await order.locator('strong').first().innerText();

      await orderMenu('Marcar como procesada');
      await page.getByRole('tab', { name: /^Procesadas/ }).click();
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await expect(page.getByTestId('lab-order-status')).toHaveText('Procesada');

      await order.getByRole('button', { name: /^Acciones/ }).click();
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('menuitem', { name: 'Subir resultados', exact: true }).click();
      await (await chooser).setFiles({ name: fileName, mimeType: 'application/pdf', buffer: pdf });
      await page.getByRole('tab', { name: /^Subidos/ }).click();
      await expect(page.getByTestId('lab-orders-uploads')).toContainText(fileName);
      const uploaded = page.locator('tbody tr').filter({ hasText: orderName });
      await expect(uploaded.getByTestId('lab-order-status')).toHaveText('Subidos');
      await capture(page, 'laboratory-order-uploaded', viewport.width, info);

      await page.reload();
      await esperarAplicacionLista(page);
      await page.getByRole('tab', { name: /^Subidos/ }).click();
      const afterReload = page.locator('tbody tr').filter({ hasText: orderName });
      await expect(afterReload.getByTestId('lab-order-status')).toHaveText('Subidos');
      await expect(afterReload).toContainText(/\d+ archivos?/);
      await afterReload.getByRole('button', { name: /^Acciones/ }).click();
      const downloading = page.waitForEvent('download');
      await page.getByRole('menuitem', { name: 'Descargar', exact: true }).click();
      const download = await downloading;
      expect(download.suggestedFilename()).toBeTruthy();
      await capture(page, 'laboratory-order-after-reload', viewport.width, info);

      await irA(page, LAB_SUMMARY);
      await expect(page.getByTestId('summary-result-files')).toHaveText(String(initialCount + 1));
      await expect(page.getByTestId('summary-activity')).toContainText(fileName);
      await capture(page, 'laboratory-portal-after-upload', viewport.width, info);
      expect(errors, 'errores de consola o del navegador en laboratorio').toEqual([]);
    });

    test(`aseguradora: dictamen, factura, anulación y refacturación persistentes a ${viewport.width} px`, async ({ page }, info) => {
      const errors = observeBrowserErrors(page);
      await page.setViewportSize(viewport);
      await signInDemo(page, 'aseguradora@alovida.mock');
      await irA(page, RECEIVED_CLAIMS);
      await expect(page.getByTestId('received-claims-table')).toBeVisible();
      await expect(page.getByTestId('received-claims-queue').getByRole('radio', { name: /^Por dictaminar/ })).toBeChecked();
      await page.getByTestId('received-claim-open').first().click();
      let detail = page.getByRole('dialog', { name: 'Detalle de la solicitud' });
      await expect(detail).toBeVisible();
      const claimIdentifier = (await detail.locator('dl').first().locator('dd').first().innerText()).trim();
      expect(claimIdentifier).toMatch(/^CLM-2026-\d{4}$/);
      const billedAmount = await detail.locator('dl').first().getByText('Monto solicitado', { exact: true })
        .locator('..').locator('dd').innerText();
      await expect(detail.getByTestId('received-claim-decision')).toHaveCount(0);
      await expect(detail.getByTestId('received-claim-invoices')).toHaveCount(0);
      const approve = detail.getByTestId('received-claim-detail-actions').getByRole('button', { name: /^Aprobar —/ });
      await approve.click();
      await expect(page.getByTestId('dialogo')).toContainText('no se puede revertir');
      await expect(page.getByTestId('dialogo')).toContainText('evento de facturación');
      await page.getByTestId('dialogo-cancelar').click();
      await expect(approve).toBeFocused();
      await expect(detail.getByTestId('received-claim-decision')).toHaveCount(0);
      await expect(detail.getByTestId('received-claim-invoices')).toHaveCount(0);

      await approve.click();
      await expect(page.getByTestId('dialogo-confirmar')).toHaveText('Aprobar y facturar');
      await page.getByTestId('dialogo-confirmar').click();
      await expect(detail.getByTestId('received-claim-decision')).toContainText('Aprobada');
      const decision = (await detail.getByTestId('received-claim-decision').textContent()) ?? '';
      expect(decision).not.toBe('');
      await expect(detail.getByTestId('received-claim-decision').getByText('Monto aprobado', { exact: true })
        .locator('..').locator('dd')).toHaveText(billedAmount);
      let invoices = detail.getByTestId('received-claim-invoices').locator('li');
      await expect(invoices).toHaveCount(1);
      await expect(invoices.first()).toContainText('vigente');
      await expect(invoices.first()).toContainText(billedAmount);
      const originalInvoice = (await invoices.first().locator('strong').first().innerText()).trim();
      expect(originalInvoice).toMatch(/^FAC-\d+$/);
      await capture(page, 'insurance-approved-invoice', viewport.width, info);

      detail = await reopenApprovedClaim(page, claimIdentifier);
      await expect(detail.getByTestId('received-claim-decision')).toHaveText(decision);
      await expect(detail.getByTestId('received-claim-invoices')).toContainText(originalInvoice);
      await detail.getByTestId('received-claim-detail-actions').getByRole('button', { name: /^Anular factura —/ }).click();
      await expect(page.getByTestId('dialogo')).toContainText('El dictamen no cambia');
      await page.getByTestId('dialogo-confirmar').click();
      await expect(page.getByTestId('dialogo')).toBeVisible();
      await expect(page.getByTestId('dialogo')).toContainText('Escriba el motivo');
      await expect(detail.getByTestId('received-claim-invoices')).toContainText('vigente');
      await page.getByTestId('dialogo-motivo').locator('textarea').fill(ANNULMENT_REASON);
      await page.getByTestId('dialogo-confirmar').click();
      await expect(detail.getByTestId('received-claim-invoices')).toContainText('anulada');
      await expect(detail.getByTestId('received-claim-invoices')).toContainText(ANNULMENT_REASON);
      await expect(detail.getByTestId('received-claim-decision')).toHaveText(decision);
      await capture(page, 'insurance-annulled-invoice', viewport.width, info);

      detail = await reopenApprovedClaim(page, claimIdentifier);
      await expect(detail.getByTestId('received-claim-decision')).toHaveText(decision);
      await expect(detail.getByTestId('received-claim-invoices')).toContainText(ANNULMENT_REASON);
      await detail.getByTestId('received-claim-detail-actions').getByRole('button', { name: /^Volver a facturar —/ }).click();
      await expect(page.getByTestId('dialogo')).toContainText('La anulada queda en el historial');
      await expect(page.getByTestId('dialogo-confirmar')).toHaveText('Emitir factura');
      await page.getByTestId('dialogo-confirmar').click();
      invoices = detail.getByTestId('received-claim-invoices').locator('li');
      await expect(invoices).toHaveCount(2);
      await expect(invoices.first()).toContainText('vigente');
      await expect(invoices.first()).toContainText(billedAmount);
      const replacementInvoice = (await invoices.first().locator('strong').first().innerText()).trim();
      expect(replacementInvoice).toMatch(/^FAC-\d+$/);
      expect(replacementInvoice).not.toBe(originalInvoice);
      await expect(invoices.nth(1)).toContainText(originalInvoice);
      await expect(invoices.nth(1)).toContainText('anulada');
      await expect(invoices.nth(1)).toContainText(ANNULMENT_REASON);
      await expect(detail.getByTestId('received-claim-decision')).toHaveText(decision);

      detail = await reopenApprovedClaim(page, claimIdentifier);
      invoices = detail.getByTestId('received-claim-invoices').locator('li');
      await expect(invoices).toHaveCount(2);
      await expect(invoices.first()).toContainText(replacementInvoice);
      await expect(invoices.first()).toContainText('vigente');
      await expect(invoices.nth(1)).toContainText(originalInvoice);
      await expect(invoices.nth(1)).toContainText(ANNULMENT_REASON);
      await expect(detail.getByTestId('received-claim-decision')).toHaveText(decision);
      await expect(detail.getByTestId('received-claim-detail-actions').getByRole('button', { name: /^Aprobar/ })).toHaveCount(0);
      await capture(page, 'insurance-reissued-after-reload', viewport.width, info);
      expect(errors, 'errores de consola o del navegador en aseguradora').toEqual([]);
    });
  }
});
