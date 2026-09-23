import { chromium } from 'playwright';
import path from 'path';

const BASE_URL = 'http://localhost:4200';
const ARTIFACTS_DIR = 'C:/Users/Usuario/.gemini/antigravity-ide/brain/a03dcc71-c895-4a75-ad01-86307bdf85e4';
const IMAGES_DIR = path.join(ARTIFACTS_DIR, 'images_audit_v2');

async function captureFixes() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  // Login as paciente
  await page.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="identifier"], input#identifier, input[type="text"]', 'paciente@alovida.mock');
  await page.fill('input[formcontrolname="password"], input#password, input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // 1. Correct Pharmacy Orders
  await page.goto(`${BASE_URL}/my-account/pharmacy-orders`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(IMAGES_DIR, '09_pedidos_farmacia.png'), fullPage: true });

  // 2. Correct Diagnostic Results
  await page.goto(`${BASE_URL}/my-account/diagnostic-results`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(IMAGES_DIR, '10_resultados_diagnosticos.png'), fullPage: true });

  // 3. New Order in Pharmacy
  await page.goto(`${BASE_URL}/my-account/pharmacy-orders/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(IMAGES_DIR, '09b_nuevo_pedido_farmacia.png'), fullPage: true });

  // Now login as Medica to inspect the new Evoluciones & Attachments
  await page.goto(`${BASE_URL}/auth`, { waitUntil: 'networkidle' });
  await page.fill('input[formcontrolname="identifier"], input#identifier, input[type="text"]', 'medica@alovida.mock');
  await page.fill('input[formcontrolname="password"], input#password, input[type="password"]', 'demo123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  const clinic = await page.$('button:has-text("Clínica Los Olivos"), .tenant__option');
  if (clinic) {
    await clinic.click();
    await page.waitForTimeout(3000);
  }

  // Evoluciones: click on first attention to open side panel / drawer
  await page.goto(`${BASE_URL}/progress-notes`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const noteRow = await page.$('.evoluciones__fila, tr[role="button"], tr, .tabla__fila');
  if (noteRow) {
    await noteRow.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(IMAGES_DIR, '19b_evolucion_detalle_lateral.png'), fullPage: true });
  }

  // Expedientes: test attachment button or dialog
  await page.goto(`${BASE_URL}/medical-records`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  const attachBtn = await page.$('button:has-text("Adjuntar"), button[aria-label*="adjunt"], button:has-text("Subir")');
  if (attachBtn) {
    await attachBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(IMAGES_DIR, '20b_modal_adjuntos_dialog.png') });
  }

  await browser.close();
  console.log('Capturas complementarias finalizadas con éxito.');
}

captureFixes().catch(console.error);
