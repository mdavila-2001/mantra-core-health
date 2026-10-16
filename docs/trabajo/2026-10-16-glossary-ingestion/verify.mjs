import { createHash } from 'node:crypto';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:4310';
const conceptId = 'b66560fd-8a7b-4eb1-a0c2-1d54e896aabe';
const output = new URL('.', import.meta.url);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: 'es-BO' });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
try {
  await page.goto(`${base}/auth`);
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/);
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/);
  }
  await page.goto(`${base}/glossary/${conceptId}`);
  const article = page.getByTestId('articulo-enciclopedico');
  await article.waitFor();
  const sourceCount = await article.getByText('MedlinePlus', { exact: false }).count();
  if (sourceCount === 0) throw new Error('Falta la procedencia MedlinePlus.');
  const imageCount = await article.locator('img').count();
  if (imageCount !== 0) throw new Error(`Hay ${imageCount} imágenes sin revisión.`);
  const screenshot = fileURLToPath(new URL('ficha-cargada.png', output));
  await page.screenshot({ path: screenshot });
  const button = page.getByRole('button', { name: 'Descargar ficha en PDF' });
  await button.waitFor();
  const downloadWait = page.waitForEvent('download', { timeout: 60_000 });
  await button.click();
  const download = await downloadWait;
  const pdf = fileURLToPath(new URL('ficha-cargada.pdf', output));
  await download.saveAs(pdf);
  const bytes = readFileSync(pdf);
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('La descarga no es PDF.');
  if (errors.length > 0) throw new Error(errors.join(' | '));
  const result = {
    url: page.url(),
    sourceCount,
    imageCount,
    pdfBytes: statSync(pdf).size,
    pdfSha256: createHash('sha256').update(bytes).digest('hex'),
    filename: download.suggestedFilename(),
    pageErrors: errors,
  };
  writeFileSync(new URL('verificacion.json', output), `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await browser.close();
}
