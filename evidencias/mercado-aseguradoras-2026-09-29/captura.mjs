/**
 * Evidencia del mercado de aseguradoras (29/09/2026): «en el directorio al ir
 * a una aseguradora no cargan sus productos».
 *
 * Entra como paciente, abre el directorio de aseguradoras y cuatro fichas —la
 * de la maqueta, la La Vitalicia real, BISA y una de seguros generales—, mide
 * cuántos planes trae cada una y el centrado de la tarjeta (regla 6) y guarda
 * capturas a 1440, 768 y 390 de ancho. Busca también desde «Directorios».
 *
 * Uso: `corepack yarn node evidencias/mercado-aseguradoras-2026-09-29/captura.mjs`
 * con el front levantado (`BASE`, por omisión http://127.0.0.1:4310).
 * Nunca espera `networkidle`: con `ng serve` no llega.
 */
import { chromium } from 'playwright';

const B = process.env.BASE ?? 'http://127.0.0.1:4310';
const DIR = 'evidencias/mercado-aseguradoras-2026-09-29';
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

const FICHAS = [
  ['seguros-andina', 'andina'],
  ['la-vitalicia-seguros-y-reaseguros-de-vida-s-a', 'la-vitalicia-real'],
  ['bisa-seguros-y-reaseguros-s-a', 'bisa'],
  ['seguros-illimani-s-a-generales-y-fianzas', 'illimani-generales'],
];

async function entrar(pg) {
  await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
  const fuera = (url) => !/\/auth(\/|$|\?)/.test(new URL(url).pathname + '/') || /\/auth\/organization/.test(url);
  for (let i = 0; i < 6 && !fuera(pg.url()); i += 1) {
    await pg.getByTestId('login-identifier').fill('paciente@alovida.mock', { timeout: 60000 });
    await pg.getByTestId('login-password').fill('mockup');
    await pg.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
    await pg.waitForURL((url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'), { timeout: 15000 }).catch(() => {});
  }
  if (pg.url().includes('/auth/organization')) {
    await pg.getByTestId('tenant-opcion').first().click();
    await pg.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60000 });
  }
}

/** Holgura izquierda/derecha de la tarjeta de planes contra `.app-main__inner` y su ancho relativo. */
async function medirCentrado(pg) {
  return pg.evaluate(() => {
    const area = document.querySelector('.app-main__inner')?.getBoundingClientRect();
    const card = document.querySelector('[data-testid=aseguradora-planes]')?.getBoundingClientRect();
    if (!area || !card) return 'sin medir';
    const izq = Math.round(card.left - area.left);
    const der = Math.round(area.right - card.right);
    return `holgura izq=${izq}px der=${der}px · ancho=${Math.round((card.width / area.width) * 100)} %`;
  });
}

/**
 * La página entera sin `fullPage`: con la barra lateral y la superior fijas,
 * `fullPage` las dibuja a media altura. Se estira la ventana al alto del
 * documento, se captura y se vuelve al alto de antes.
 */
async function capturar(pg, path) {
  const { width, height } = pg.viewportSize();
  const alto = await pg.evaluate(() => document.documentElement.scrollHeight);
  await pg.setViewportSize({ width, height: Math.max(height, alto) });
  await pg.waitForTimeout(600);
  await pg.screenshot({ path });
  await pg.setViewportSize({ width, height });
}

const ctx = await nav.newContext({ viewport: { width: 1440, height: 900 } });
const pg = await ctx.newPage();
const errores = [];
pg.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
await entrar(pg);
process.stdout.write(`sesión abierta en ${pg.url()}\n`);
// La entrada de la barra lateral es animada: se espera a que termine.
await pg.locator('body.entrada-hecha').waitFor({ state: 'attached', timeout: 60000 }).catch(() => {});

// El directorio: cuántas tarjetas de aseguradora hay.
await pg.goto(`${B}/insurers-directory`, { waitUntil: 'commit', timeout: 180000 });
await pg.locator('li[app-result-card]').first().waitFor({ timeout: 90000 });
await pg.waitForTimeout(1200);
process.stdout.write(`directorio: ${await pg.locator('li[app-result-card]').count()} tarjetas visibles\n`);
await pg.screenshot({ path: `${DIR}/00-directorio-1440.png`, fullPage: false });

let n = 1;
for (const [slug, nombre] of FICHAS) {
  await pg.goto(`${B}/insurers-directory/${slug}`, { waitUntil: 'commit', timeout: 180000 });
  await pg.locator('[data-testid=aseguradora-planes], [data-testid=aseguradora-sin-productos]').first().waitFor({ timeout: 90000 });
  await pg.waitForTimeout(1000);
  const sinProductos = await pg.getByTestId('aseguradora-sin-productos').count();
  const pestanas = await pg.locator('[data-testid=aseguradora-planes] [role=tab]').allInnerTexts();
  const ofertas = await pg.getByTestId('aseguradora-oferta').count();
  const primas = (await pg.locator('[data-testid=aseguradora-oferta] [data-testid=aseguradora-prima]').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  process.stdout.write(
    `[${nombre}] sin-productos=${sinProductos} · pestañas=${JSON.stringify(pestanas)} · tarjetas de plan=${ofertas} · primas=${JSON.stringify(primas)} · ${await medirCentrado(pg)}\n`,
  );
  const archivo = `${DIR}/${String(n).padStart(2, '0')}-${nombre}-1440.png`;
  await capturar(pg, archivo);
  n += 1;

  // «Ver cláusulas» del segundo plan (o del único) abre su pestaña.
  if (nombre === 'bisa') {
    await pg.getByTestId('oferta-ver-clausulas').nth(1).click();
    await pg.waitForTimeout(500);
    const activa = await pg.locator('[role=tab][aria-selected=true]').innerText();
    process.stdout.write(`[${nombre}] «Ver cláusulas» del 2.º plan → pestaña activa «${activa.trim()}»\n`);
    await capturar(pg, `${DIR}/${String(n).padStart(2, '0')}-${nombre}-pestana-plan-1440.png`);
    n += 1;
  }
}

// La búsqueda desde «Directorios».
await pg.goto(`${B}/directories?q=vitalicia`, { waitUntil: 'commit', timeout: 180000 });
await pg.locator('.directorio__rotulo').first().waitFor({ timeout: 90000 });
await pg.waitForTimeout(800);
const grupos = await pg.locator('.directorio__rotulo').allInnerTexts();
const enlaces = await pg.locator('li[app-result-card] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
process.stdout.write(`[directorios?q=vitalicia] grupos=${JSON.stringify(grupos)} · enlaces=${JSON.stringify(enlaces)}\n`);
await pg.screenshot({ path: `${DIR}/${String(n).padStart(2, '0')}-directorios-busqueda-vitalicia-1440.png`, fullPage: false });
n += 1;

// Tablet y teléfono: BISA (tres planes) a 768 y a 390.
for (const [ancho, alto] of [[768, 1024], [390, 844]]) {
  await pg.setViewportSize({ width: ancho, height: alto });
  await pg.goto(`${B}/insurers-directory/bisa-seguros-y-reaseguros-s-a`, { waitUntil: 'commit', timeout: 180000 });
  await pg.getByTestId('aseguradora-planes').waitFor({ timeout: 90000 });
  await pg.waitForTimeout(1000);
  const desborde = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  // El contenido de la ficha, sin la barra superior de la aplicación.
  const desbordeFicha = await pg.evaluate(() => {
    const area = document.querySelector('.app-main__inner').getBoundingClientRect();
    const ficha = document.querySelector('app-insurer-detail').getBoundingClientRect();
    return Math.max(0, Math.round(ficha.right - area.right), Math.round(document.querySelector('app-insurer-detail').scrollWidth - ficha.width));
  });
  process.stdout.write(`[bisa ${ancho}] desborde de la página=${desborde}px · desborde de la ficha=${desbordeFicha}px · ${await medirCentrado(pg)}\n`);
  await capturar(pg, `${DIR}/${String(n).padStart(2, '0')}-bisa-${ancho}.png`);
  n += 1;
}

// Control: el mismo desborde en el tablero, que esta tarea no toca.
await pg.goto(`${B}/dashboard`, { waitUntil: 'commit', timeout: 180000 });
await pg.locator('.app-header__derecha').waitFor({ timeout: 90000 });
await pg.waitForTimeout(1500);
const control = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
process.stdout.write(`[control /dashboard 390] desborde de la página=${control}px (barra superior, previo)\n`);

process.stdout.write(`errores de consola: ${errores.length}${errores.length ? `\n  ${errores.slice(0, 5).join('\n  ')}` : ''}\n`);
await nav.close();
