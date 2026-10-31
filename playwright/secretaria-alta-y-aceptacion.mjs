/**
 * Evidencia de la secretaria (personal de apoyo) contra la maqueta:
 *
 * - El alta (`/auth/register/support-staff`) y la tarjeta «Secretaria o personal de apoyo» en «Crear cuenta».
 * - La secretaria sembrada ve sólo su hospital, su doctora y su piso; acepta una invitación de la clínica, la
 *   pantalla vuelve a leer de la maqueta y, tras recargar, la clínica sigue con su doctor y su piso.
 * - La administración acepta la solicitud de otra secretaria; la doctora ve su equipo.
 * - En cada pantalla mide que la tarjeta esté centrada (holgura izquierda ≈ derecha, ≤ 2 px) y a lo ancho
 *   (≥ 85 % del área), y que no haya desborde horizontal (composition-rules §5).
 *
 * Nunca espera `networkidle`. Uso: `yarn node playwright/secretaria-alta-y-aceptacion.mjs` con el front
 * levantado en `BASE` (por omisión http://localhost:4231). Capturas en `SALIDA`.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const B = process.env.BASE ?? 'http://localhost:4231';
const SALIDA = process.env.SALIDA ?? 'test-results/secretaria';
mkdirSync(SALIDA, { recursive: true });
const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push(Boolean(cond));
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

const nav = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});

async function entrar(pg, identificador) {
  await pg.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
  const destino = /\/(dashboard|auth\/organization|my-support|portal)/;
  for (let i = 0; i < 6 && !destino.test(pg.url()); i += 1) {
    await pg.getByTestId('login-identifier').fill(identificador);
    await pg.getByTestId('login-password').fill('mockup');
    await pg.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
    await pg.waitForURL(destino, { timeout: 10000 }).catch(() => {});
  }
  if (pg.url().includes('/auth/organization')) {
    await pg.getByTestId('tenant-opcion').first().click();
    await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
  }
}

async function geometria(pg, selector, etiqueta) {
  const g = await pg.evaluate((sel) => {
    const area = document.querySelector('.app-main__inner') ?? document.body;
    const caja = document.querySelector(sel);
    if (!caja) return null;
    const a = area.getBoundingClientRect();
    const c = caja.getBoundingClientRect();
    return {
      izq: Math.round(c.left - a.left),
      der: Math.round(a.right - c.right),
      ancho: c.width / a.width,
      desborde: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    };
  }, selector);
  ok(`${etiqueta}: tarjeta presente`, g !== null);
  if (g === null) return;
  ok(`${etiqueta}: centrada`, Math.abs(g.izq - g.der) <= 2, `izq ${g.izq}px · der ${g.der}px`);
  ok(`${etiqueta}: a lo ancho`, g.ancho >= 0.85, `${Math.round(g.ancho * 100)} %`);
  ok(`${etiqueta}: sin desborde horizontal`, !g.desborde);
}

for (const [nombre, ancho] of [['escritorio', 1440], ['celular', 390]]) {
  const ctx = await nav.newContext({ viewport: { width: ancho, height: 900 } });
  const pg = await ctx.newPage();

  // 1. Crear cuenta: la tarjeta y el alta.
  await pg.goto(`${B}/auth/register`, { waitUntil: 'commit', timeout: 180000 });
  await pg.getByTestId('tipo-personal-apoyo').waitFor({ timeout: 60000 });
  ok(`${nombre}: «Crear cuenta» ofrece la secretaria`, await pg.getByTestId('tipo-personal-apoyo').isVisible());
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${SALIDA}/${nombre}-01-crear-cuenta.png`, fullPage: true });
  await pg.getByTestId('tipo-personal-apoyo').click();
  await pg.getByTestId('alta-apoyo-form').waitFor({ timeout: 60000 });
  await pg.waitForTimeout(800);
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${SALIDA}/${nombre}-02-alta.png`, fullPage: true });

  // 2. La secretaria: su hospital, su doctora, su piso.
  await entrar(pg, 'secretaria@alovida.mock');
  await pg.goto(`${B}/my-support`, { waitUntil: 'commit', timeout: 180000 });
  await pg.getByTestId('mi-apoyo-hospitales').waitFor({ timeout: 60000 });
  const hospitales = await pg.getByTestId('mi-apoyo-hospitales').innerText();
  ok(`${nombre}: ve el Hospital San Lucas`, hospitales.includes('Hospital San Lucas'));
  ok(`${nombre}: no ve la clínica antes de aceptar`, !hospitales.includes('Clínica Los Olivos'));
  ok(`${nombre}: ve a su doctora y su piso`, hospitales.includes('Dra. Valeria Rojas') && hospitales.includes('Piso 2'));
  await geometria(pg, '[data-testid="mi-apoyo"]', `${nombre} mi trabajo de apoyo`);
  const menu = await pg.locator('app-side-nav, nav').first().innerText().catch(() => '');
  ok(`${nombre}: «Mi trabajo de apoyo» en el menú`, menu.includes('Mi trabajo de apoyo') || ancho < 800, ancho < 800 ? 'menú plegado en celular' : '');
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${SALIDA}/${nombre}-03-mis-hospitales.png`, fullPage: true });

  if (nombre === 'escritorio') {
    await pg.getByRole('tab', { name: /Invitaciones/ }).click();
    await pg.getByTestId('mi-apoyo-invitaciones').waitFor({ timeout: 30000 });
    await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${SALIDA}/${nombre}-04-invitaciones.png`, fullPage: true });
    await pg.locator('[data-testid^="mi-apoyo-aceptar-"]').first().click();
    await pg.getByTestId('mi-apoyo-ok').waitFor({ timeout: 30000 });
    await pg.locator('[data-testid^="mi-apoyo-aceptar-"]').first().click();
    await pg.getByTestId('mi-apoyo-ok').waitFor({ timeout: 30000 });
    await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${SALIDA}/${nombre}-04b-tras-aceptar-antes-de-recargar.png`, fullPage: true });
    await pg.reload({ waitUntil: 'commit' });
    // Con dos hospitales en el token, la sesión pide elegir organización: es lo esperado.
    await pg.locator('[data-testid="mi-apoyo-hospitales"], [data-testid="tenant-opcion"]').first().waitFor({ timeout: 60000 });
    if (pg.url().includes('/auth/organization')) {
      ok('tras aceptar, el token trae un segundo hospital (pide elegir organización)', true);
      await pg.getByTestId('tenant-opcion').first().click();
      await pg.goto(`${B}/my-support`, { waitUntil: 'commit', timeout: 180000 });
    }
    await pg.getByTestId('mi-apoyo-hospitales').waitFor({ timeout: 60000 }).catch(async (e) => {
      await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${SALIDA}/error-recarga.png`, fullPage: true });
      process.stdout.write(`URL ${pg.url()}\n`);
      throw e;
    });
    const tras = await pg.getByTestId('mi-apoyo-hospitales').innerText();
    ok('tras aceptar y recargar: la clínica aparece con su doctor y su piso', tras.includes('Clínica Los Olivos') && tras.includes('Céspedes') && tras.includes('Ginecología'));
    await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${SALIDA}/${nombre}-05-tras-aceptar.png`, fullPage: true });
  }

  // 3. La administración de la clínica.
  await ctx.clearCookies();
  await pg.evaluate(() => localStorage.clear());
  await entrar(pg, 'admin@alovida.mock');
  await pg.goto(`${B}/administration/support-staff`, { waitUntil: 'commit', timeout: 180000 });
  await pg.getByTestId('apoyo-admin').waitFor({ timeout: 60000 });
  await pg.locator('[data-testid="apoyo-admin-solicitudes"], [data-testid="apoyo-admin-sin-solicitudes"]').first().waitFor({ timeout: 60000 });
  await geometria(pg, '[data-testid="apoyo-admin"]', `${nombre} personal de apoyo`);
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${SALIDA}/${nombre}-06-admin-solicitudes.png`, fullPage: true });
  if (nombre === 'escritorio') {
    await pg.locator('[data-testid^="apoyo-solicitud-aceptar-"]').first().click();
    await pg.getByTestId('apoyo-admin-ok').waitFor({ timeout: 30000 });
    ok('la administración acepta la solicitud', (await pg.getByTestId('apoyo-admin-ok').innerText()).includes('Aceptó'));
    await pg.getByRole('tab', { name: 'Invitar' }).click();
    await pg.getByTestId('apoyo-invitar-documento').waitFor({ timeout: 30000 });
    await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${SALIDA}/${nombre}-07-admin-invitar.png`, fullPage: true });
  }

  // 4. La doctora.
  await pg.evaluate(() => localStorage.clear());
  await entrar(pg, 'medica@alovida.mock');
  await pg.goto(`${B}/my-support-team`, { waitUntil: 'commit', timeout: 180000 });
  await pg.locator('[data-testid="mi-secretaria-lista"], [data-testid="mi-secretaria-vacio"]').first().waitFor({ timeout: 60000 });
  ok(`${nombre}: la doctora ve a su secretaria`, (await pg.getByTestId('mi-secretaria').innerText()).includes('Rosa'));
  await geometria(pg, '[data-testid="mi-secretaria"]', `${nombre} mi secretaría`);
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${SALIDA}/${nombre}-08-mi-secretaria.png`, fullPage: true });
  await ctx.close();
}

await nav.close();
const fallas = veredictos.filter((v) => !v).length;
process.stdout.write(`\n${veredictos.length - fallas}/${veredictos.length} comprobaciones\n`);
process.exit(fallas === 0 ? 0 : 1);
