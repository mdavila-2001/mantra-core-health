import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { conceptIdOf } from '../../../../scripts/lib/glossary-shards.mjs';

const baseUrl = process.argv[2] ?? 'http://localhost:4300';
const curated = process.argv.includes('--curated');
// --curated necesita `node scripts/glossary-articulos-alovida.mjs --only angiografia`
// antes de arrancar el servidor local; el archivo generado no se commitea.
const withoutArticle = process.argv.includes('--no-article');
const mobile = process.argv.includes('--mobile');
const evidenceName = `${curated ? 'angiografia' : withoutArticle ? 'sin-articulo' : 'amigdalitis'}${mobile ? '-mobile' : ''}`;
const output = new URL('.', import.meta.url);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  locale: 'es-BO',
});
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

try {
  await page.goto(`${baseUrl}/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/);
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/);
  }

  const conceptId = withoutArticle
    ? '00185814-18e5-48ce-abd8-833aa75bbdc2'
    : conceptIdOf(curated ? 'angiografia' : 'medlineplus-es-6441');
  await page.goto(`${baseUrl}/glossary/${conceptId}`, {
    waitUntil: 'domcontentloaded',
  });
  const article = page.getByTestId('articulo-enciclopedico');
  if (!withoutArticle) await article.waitFor();
  const button = page.getByRole('button', { name: 'Descargar ficha en PDF' });
  await button.waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const control = [...document.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('Descargar ficha en PDF'),
    );
    return control?.getAttribute('aria-disabled') === 'false';
  });
  const alignment = await (
    withoutArticle
      ? page.locator('.termino__definicion').first()
      : article.locator('.articulo__parrafo').first()
  ).evaluate((node) => getComputedStyle(node).textAlign);
  if (alignment !== 'justify') throw new Error(`Texto sin justificar: ${alignment}`);
  await page.screenshot({
    path: fileURLToPath(new URL(`${evidenceName}-${mobile ? 'viewport' : 'desktop'}.png`, output)),
    fullPage: !mobile,
  });

  const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
  await button.click();
  const download = await downloadPromise;
  const pdfPath = fileURLToPath(new URL(`${evidenceName}.pdf`, output));
  await download.saveAs(pdfPath);
  const signature = readFileSync(pdfPath).subarray(0, 5).toString('ascii');
  if (signature !== '%PDF-') throw new Error(`Descarga sin firma PDF: ${signature}`);
  const result = {
    route: page.url(),
    alignment,
    visibleImages: withoutArticle ? 0 : await article.locator('img').count(),
    curatedRouteFixture: curated,
    withoutArticle,
    pdfBytes: statSync(pdfPath).size,
    pdfName: download.suggestedFilename(),
    pageErrors: errors,
  };
  writeFileSync(new URL(`${evidenceName}-result.json`, output), JSON.stringify(result, null, 2));
  if (errors.length > 0) throw new Error(`Errores de navegador: ${errors.join(' | ')}`);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  await page.screenshot({ path: fileURLToPath(new URL('failure.png', output)), fullPage: true });
  writeFileSync(
    new URL('failure.txt', output),
    `${page.url()}\n${(await page.locator('body').innerText()).slice(0, 4000)}\n`,
  );
  throw error;
} finally {
  await browser.close();
}
