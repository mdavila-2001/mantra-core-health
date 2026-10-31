/**
 * Evidencia H10: pantalla «Instancias y herramientas» y tarjeta de la portada,
 * contra `ng serve` en modo simulador. Un solo navegador, capturas en serie.
 * Nunca `networkidle` (con HMR no llega).
 *
 * Uso: yarn node playwright/h10-instancias-y-herramientas.mjs <urlBase> <carpetaSalida>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4321';
const SALIDA = process.argv[3];
if (!SALIDA) throw new Error('Falta la carpeta de salida');
mkdirSync(SALIDA, { recursive: true });

const notas = [];
const anotar = (l) => {
  notas.push(l);
  process.stdout.write(l + '\n');
};

const consola = [];
const red = [];

function vigilar(pagina) {
  pagina.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consola.push(`[${m.type()}] ${m.text()}`);
  });
  pagina.on('pageerror', (e) => consola.push(`[pageerror] ${e.message}`));
  pagina.on('requestfailed', (r) => red.push(`[failed] ${r.method()} ${r.url()} — ${r.failure()?.errorText}`));
  pagina.on('response', (r) => {
    if (r.status() >= 400) red.push(`[${r.status()}] ${r.request().method()} ${r.url()}`);
  });
}

async function entrar(pagina) {
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill('superadmin@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  // El superadmin cae en el selector de portales (o en el de organización antes).
  await pagina.waitForURL(/\/(dashboard|portal-selector|auth\/organization)/, { timeout: 90_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/(dashboard|portal-selector)/, { timeout: 60_000 });
  }
}

async function capturar(pagina, nombre) {
  const ruta = join(SALIDA, nombre);
  await pagina.screenshot({ path: ruta, fullPage: true });
  anotar(`captura: ${nombre}`);
}

/** Ancho de la tarjeta frente al ancho de su contenedor: la regla «a lo ancho». */
async function medirTarjeta(pagina) {
  return pagina.evaluate(() => {
    const tarjeta = document.querySelector('.instancias app-card');
    const contenedor = document.querySelector('.instancias');
    if (!tarjeta || !contenedor) return null;
    return { tarjeta: Math.round(tarjeta.getBoundingClientRect().width), contenedor: Math.round(contenedor.getBoundingClientRect().width), ventana: window.innerWidth, scrollX: document.documentElement.scrollWidth > window.innerWidth };
  });
}

const navegador = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
try {
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-BO', timezoneId: 'America/La_Paz', colorScheme: 'light' });
  const pagina = await contexto.newPage();
  vigilar(pagina);
  await pagina.emulateMedia({ colorScheme: 'light' });
  await entrar(pagina);
  anotar(`sesión: ${pagina.url()}`);

  // --- Escritorio: instancias ---
  await pagina.goto(`${BASE}/superadmin/instances`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.waitForSelector('[data-testid="instances-overall"]', { timeout: 90_000 });
  await pagina.waitForSelector('[data-testid="instances-table"] tbody tr, [data-testid="instances-table"] [role="row"]', { timeout: 30_000 }).catch(() => {});
  anotar(`escritorio · veredicto: ${(await pagina.locator('[data-testid="instances-overall"] app-badge').first().textContent())?.trim()}`);
  anotar(`escritorio · contadores: ${(await pagina.locator('.instancias__contadores').first().textContent())?.replace(/\s+/g, ' ').trim()}`);
  anotar(`escritorio · banner crítico presente: ${await pagina.locator('[data-testid="instances-banner-critico"]').count()}`);
  anotar(`escritorio · medida tarjeta: ${JSON.stringify(await medirTarjeta(pagina))}`);
  await capturar(pagina, '01-instancias-escritorio.png');

  // --- Escritorio: herramientas ---
  await pagina.getByRole('tab', { name: 'Herramientas' }).click();
  await pagina.waitForSelector('[data-testid="tools-summary"]', { timeout: 30_000 });
  anotar(`herramientas · contadores: ${(await pagina.locator('[data-testid="tools-summary"] .instancias__contadores').textContent())?.replace(/\s+/g, ' ').trim()}`);
  anotar(`herramientas · banner crítico: ${(await pagina.locator('[data-testid="tools-banner-critico"]').textContent().catch(() => 'ausente'))?.replace(/\s+/g, ' ').trim().slice(0, 160)}`);
  await capturar(pagina, '02-herramientas-escritorio.png');
  await pagina.getByRole('radio', { name: 'Críticas' }).or(pagina.getByRole('button', { name: 'Críticas', exact: true })).first().click();
  await pagina.waitForTimeout(300);
  anotar(`herramientas · filas con filtro Críticas: ${await pagina.locator('[data-testid="tools-table"] tbody tr').count()}`);
  await capturar(pagina, '03-herramientas-filtro-criticas.png');
  await pagina.getByRole('radio', { name: 'Todas' }).or(pagina.getByRole('button', { name: 'Todas', exact: true })).first().click();

  // --- Móvil ---
  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.goto(`${BASE}/superadmin/instances`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.waitForSelector('[data-testid="instances-overall"]', { timeout: 90_000 });
  await pagina.waitForTimeout(500);
  anotar(`móvil · medida tarjeta: ${JSON.stringify(await medirTarjeta(pagina))}`);
  await capturar(pagina, '04-instancias-movil.png');
  await pagina.getByRole('tab', { name: 'Herramientas' }).click();
  await pagina.waitForSelector('[data-testid="tools-summary"]', { timeout: 30_000 });
  await pagina.waitForTimeout(300);
  await capturar(pagina, '05-herramientas-movil.png');

  // --- Portada ---
  await pagina.setViewportSize({ width: 1440, height: 900 });
  await pagina.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.waitForSelector('[data-testid="centro-instancias-overall"]', { timeout: 90_000 });
  await pagina.waitForSelector('[data-testid="centro-herramientas-caidas"]', { timeout: 60_000 });
  anotar(`portada · veredicto sonda: ${(await pagina.locator('[data-testid="centro-instancias-overall"]').textContent())?.trim()}`);
  anotar(`portada · herramientas caídas: ${(await pagina.locator('[data-testid="centro-herramientas-caidas"]').textContent())?.trim()}`);
  anotar(`portada · enlaces a /superadmin/instances: ${await pagina.locator('a[href="/superadmin/instances"]').count()}`);
  await capturar(pagina, '06-portada-escritorio.png');

  anotar('');
  anotar(`consola (errores y avisos): ${consola.length}`);
  for (const c of consola) anotar(`  ${c}`);
  anotar(`red (fallidas o >= 400): ${red.length}`);
  for (const r of red) anotar(`  ${r}`);
} finally {
  await navegador.close();
  writeFileSync(join(SALIDA, 'notas-consola-y-red.txt'), notas.join('\n') + '\n');
}
