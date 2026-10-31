/**
 * Evidencia H9: la ficha de una operación del portal con sus pestañas
 * (Tablas afectadas, Ciclo de la petición, Respuestas), escritorio y móvil,
 * contra `ng serve` en modo simulador. Nunca `networkidle`.
 *
 * Uso: BASE=http://localhost:4243 OUT=<carpeta> yarn node captura-h9.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4243';
const OUT = process.env.OUT ?? 'capturas-h9';
mkdirSync(OUT, { recursive: true });

const OP = 'SchedulingController_book';
const DETAIL = `/superadmin/portal/systems/operations/${OP}`;
const notas = [];
const consola = [];
const red = [];

const nav = await chromium.launch({ executablePath: process.env.CHROME ?? undefined });

async function entrar(pg) {
  await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
  const destino = /\/(dashboard|portal-selector|superadmin|auth\/organization)/;
  for (let i = 0; i < 6 && !destino.test(pg.url()); i += 1) {
    await pg.getByTestId('login-identifier').fill('superadmin@alovida.mock');
    await pg.getByTestId('login-password').fill('mockup');
    await pg.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
    await pg.waitForURL(destino, { timeout: 10000 }).catch(() => {});
  }
  if (pg.url().includes('/auth/organization')) {
    await pg.getByTestId('tenant-opcion').first().click();
    await pg.waitForURL(/\/(dashboard|portal-selector|superadmin)/, { timeout: 60000 });
  }
}

for (const [nombre, ancho, alto] of [['escritorio', 1440, 900], ['movil', 390, 844]]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: alto }, locale: 'es-BO' });
  const pg = await ctx.newPage();
  pg.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consola.push(`[${nombre}] ${m.type()}: ${m.text()}`);
  });
  pg.on('response', (r) => {
    if (r.status() >= 400) red.push(`[${nombre}] ${r.status()} ${r.request().method()} ${r.url()}`);
  });
  pg.on('pageerror', (e) => consola.push(`[${nombre}] pageerror: ${e.message}`));

  await entrar(pg);

  for (const [vista, testId] of [
    ['', 'portal-operation-detail'],
    ['datos', 'portal-operation-data'],
    ['ciclo', 'portal-request-cycle'],
    ['respuestas', 'portal-operation-responses'],
    ['acceso', 'portal-operation-detail'],
    ['arbol', 'portal-decision-tree'],
  ]) {
    await pg.goto(`${B}${DETAIL}${vista ? `?vista=${vista}` : ''}`, { waitUntil: 'commit', timeout: 180000 });
    await pg.getByTestId(testId).first().waitFor({ timeout: 60000 });
    await pg.waitForTimeout(800);
    const archivo = `operacion-${vista || 'resumen'}-${nombre}.png`;
    await pg.screenshot({ path: join(OUT, archivo), fullPage: true });

    const info = await pg.evaluate(() => {
      const card = document.querySelector('[data-testid="portal-operation-detail"]');
      const r = card?.getBoundingClientRect();
      const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) => `${t.textContent.trim()}${t.getAttribute('aria-selected') === 'true' ? '*' : ''}`);
      const texto = (sel) => document.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() ?? null;
      return {
        tarjeta: r ? `x=${Math.round(r.left)} ancho=${Math.round(r.width)} ventana=${window.innerWidth} scrollX=${document.documentElement.scrollWidth}` : 'sin tarjeta',
        pestanas: tabs.join(' | '),
        tablas: texto('[data-testid="portal-operation-tables-count"]'),
        ciclo: texto('[data-testid="portal-request-cycle-count"]'),
        etapas: document.querySelectorAll('li.cycle__stage').length,
        callers: texto('[data-testid="portal-operation-callers"]'),
        tipo: texto('[data-testid="portal-operation-kind"]'),
      };
    });
    notas.push(`[${nombre}] vista=${vista || 'resumen'} → ${archivo}\n  ${JSON.stringify(info)}`);
  }
  await ctx.close();
}
await nav.close();

const resumen = [
  `Capturas H9 — ${new Date().toISOString()} — base ${B} — operación ${OP}`,
  '',
  ...notas,
  '',
  `Consola (errores y avisos): ${consola.length === 0 ? 'ninguno' : ''}`,
  ...consola,
  `Red (respuestas >= 400): ${red.length === 0 ? 'ninguna' : ''}`,
  ...red,
].join('\n');
writeFileSync(join(OUT, 'consola-y-red.txt'), `${resumen}\n`);
process.stdout.write(`${resumen}\n`);
