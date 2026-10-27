/**
 * Evidencia del pedido del propietario del 17/10/2026: Contabilidad (redacción,
 * Flujo de dinero con cobros facturados y comprobantes descargables, Registros
 * explicados y paginados), la portada de Directorios y el Chat.
 *
 * Uso: `BASE=http://localhost:4237 OUT=artifacts/conta-dir-chat yarn node playwright/contabilidad-directorio-chat.mjs [solo]`
 * — `solo` limita a una parte: `conta`, `registros`, `dir` o `chat`.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4237';
const OUT = process.env.OUT ?? 'artifacts/conta-dir-chat';
const SOLO = process.argv[2] ?? 'todo';
mkdirSync(OUT, { recursive: true });
const nav = await chromium.launch();

async function entrar(pg, usuario = 'medica@alovida.mock') {
  await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
  const destino = /\/(dashboard|auth\/organization)/;
  for (let i = 0; i < 6 && !destino.test(pg.url()); i += 1) {
    await pg.getByTestId('login-identifier').fill(usuario);
    await pg.getByTestId('login-password').fill('Alovida123!');
    await pg.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
    await pg.waitForURL(destino, { timeout: 10000 }).catch(() => {});
  }
  if (pg.url().includes('/auth/organization')) {
    await pg.getByTestId('tenant-opcion').first().click();
    await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
  }
}

/** Espera a que no quede ningún «Cargando…» a la vista (networkidle no llega con HMR). */
async function sinCarga(pg) {
  await pg
    .waitForFunction(
      () => ![...document.querySelectorAll('[role="status"]')].some((n) => /Cargando|Buscando|Leyendo/.test(n.textContent ?? '')),
      null,
      { timeout: 30000 },
    )
    .catch(() => {});
  await pg.waitForTimeout(700);
}

const errores = [];
for (const [nombre, ancho, alto, tema] of [
  ['1440', 1440, 900, 'light'],
  ['390', 390, 844, 'light'],
]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema, acceptDownloads: true });
  const pg = await ctx.newPage();
  pg.on('pageerror', (e) => errores.push(`${nombre} pageerror: ${e.message}`));
  pg.on('console', (m) => {
    if (m.type() === 'error' && !/Content Security Policy/.test(m.text())) errores.push(`${nombre} console: ${m.text()}`);
  });
  await entrar(pg);
  const desborde = async () =>
    pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  if (SOLO === 'todo' || SOLO === 'conta') {
    await pg.goto(`${B}/administration/accounting`);
    await pg.getByText('¿Cuánto ganó?').first().waitFor({ timeout: 120000 });
    await sinCarga(pg);
    await pg.screenshot({ path: `${OUT}/${nombre}-conta-ingresos.png`, fullPage: true });
    console.log(nombre, 'pagos confirmados en Ingresos y gastos:', await pg.getByText('Pagos recibidos y confirmados').count());

    await pg.getByRole('tab', { name: 'Caja y banco' }).click();
    await pg.getByTestId('flujo-cobros').waitFor({ timeout: 30000 });
    await sinCarga(pg);
    console.log(nombre, 'botón viejo:', await pg.getByText('Ver movimientos de caja y banco').count(), 'desborde:', await desborde());
    await pg.screenshot({ path: `${OUT}/${nombre}-flujo-cobros.png`, fullPage: true });
    console.log(nombre, 'filas de cobros:', await pg.locator('[data-testid="flujo-tabla-cobros"] tbody tr').count());

    if (nombre === '1440') {
      // Descargar la factura de la primera fila.
            const [factura] = await Promise.all([
        pg.waitForEvent('download', { timeout: 30000 }),
        pg.locator('[data-testid="flujo-tabla-cobros"] tbody tr').first().locator('[data-action="pdf"]').click(),
      ]);
      await factura.saveAs(`${OUT}/factura-${factura.suggestedFilename()}`);
      console.log('descargó factura:', factura.suggestedFilename());
    }

    await pg.getByRole('tab', { name: /Comprobantes/ }).click();
    await pg.getByTestId('flujo-comprobantes').waitFor({ timeout: 30000 });
    await sinCarga(pg);
    await pg.screenshot({ path: `${OUT}/${nombre}-flujo-comprobantes.png`, fullPage: true });
    if (nombre === '1440') {
            const [pdf] = await Promise.all([
        pg.waitForEvent('download', { timeout: 30000 }),
        pg.locator('[data-testid="flujo-tabla-comprobantes"] tbody tr').first().locator('[data-action="pdf"]').click(),
      ]);
      await pdf.saveAs(`${OUT}/${pdf.suggestedFilename()}`);
      console.log('descargó comprobante:', pdf.suggestedFilename());
      const [csv] = await Promise.all([
        pg.waitForEvent('download', { timeout: 30000 }),
        pg.getByTestId('flujo-comprobantes-descargar').click(),
      ]);
      await csv.saveAs(`${OUT}/${csv.suggestedFilename()}`);
      console.log('descargó historial:', csv.suggestedFilename());
    }

    await pg.getByRole('tab', { name: /Movimientos de la cuenta/ }).click();
    await pg.getByTestId('flujo-movimientos').waitFor({ timeout: 30000 });
    await sinCarga(pg);
    await pg.screenshot({ path: `${OUT}/${nombre}-flujo-movimientos.png`, fullPage: true });
  }

  if (SOLO === 'todo' || SOLO === 'conta' || SOLO === 'registros') {
    await pg.goto(`${B}/administration/accounting`);
    await pg.getByRole('tab', { name: /^(Registros|Anotar gastos, equipos y deudas)$/ }).first().waitFor({ timeout: 60000 });
    await pg.getByRole('tab', { name: /^(Registros|Anotar gastos, equipos y deudas)$/ }).first().click();
    await pg.getByTestId('contabilidad-registros').waitFor({ timeout: 30000 });
    await sinCarga(pg);
    console.log(nombre, 'registros desborde:', await desborde());
    await pg.screenshot({ path: `${OUT}/${nombre}-registros.png`, fullPage: true });
  }

  if (SOLO === 'todo' || SOLO === 'dir') {
    await pg.goto(`${B}/directories`);
    await pg.locator('.mapa').first().waitFor({ timeout: 60000 });
    await sinCarga(pg);
    console.log(nombre, 'directorio desborde:', await desborde());
    await pg.screenshot({ path: `${OUT}/${nombre}-directorios.png`, fullPage: false });
    await pg.screenshot({ path: `${OUT}/${nombre}-directorios-completo.png`, fullPage: true });
  }

  if (SOLO === 'todo' || SOLO === 'chat') {
    await pg.goto(`${B}/messaging`);
    await pg.locator('.mensajeria, app-empty-state').first().waitFor({ timeout: 60000 });
    await sinCarga(pg);
    console.log(nombre, 'chat desborde:', await desborde());
    await pg.screenshot({ path: `${OUT}/${nombre}-chat.png`, fullPage: false });
  }
  await ctx.close();
}
await nav.close();
console.log(errores.length === 0 ? 'sin errores de consola' : errores.join('\n'));
