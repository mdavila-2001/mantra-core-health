/**
 * Evidencia del ritmo vertical entre bloques hermanos.
 *
 * `app-tab` y el slot de `app-view-state-host` son bloques de flujo normal, sin
 * `gap`: dos bloques proyectados seguidos se tocaban (0 px entre «Pagos por
 * registrar» y la barra Día · Semana · Mes de `/schedule`). `alovida.css` fija
 * el paso (`--e4`, 16 px) entre hermanos; este recorrido lo comprueba en el
 * navegador, por ruta y por pestaña.
 *
 * Mide, en cada `app-tab` visible y en cada `app-view-state-host`, el hueco
 * entre un hijo y el siguiente. Falla (exit 1) si hay una pareja de BLOQUES
 * apilados con menos de `MINIMO` px que no sea una excepción declarada.
 *
 * Uso: `yarn node playwright/ritmo-vertical-hermanos.mjs` con el front en modo
 * demo levantado (`yarn start:demo`). Variables:
 *   BASE      http://localhost:4200
 *   ROLES     medica,paciente,admin   (cuentas `<rol>@alovida.mock`)
 *   ANCHOS    1440,390
 *   MINIMO    8
 *   CHROMIUM_PATH  ejecutable de Chromium, si el de Playwright no está instalado
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:4200';
const ROLES = (process.env.ROLES ?? 'medica,paciente,admin').split(',');
const ANCHOS = (process.env.ANCHOS ?? '1440,390').split(',').map(Number);
const MINIMO = Number(process.env.MINIMO ?? 8);

// Parejas que van pegadas a propósito. Cada una lleva su motivo.
const EXCEPCIONES = [
  // Los días de la bandeja van dentro de UNA tarjeta: los separa el filete, no el aire.
  { a: 'section.avisos__dia', b: 'section.avisos__dia' },
  // Nombre del médico de cabecera y «Desde el…»: dos líneas de un mismo dato.
  { a: 'p.mi-cabecera__dato', b: 'p.mi-cabecera__desde' },
];

const medir = () => {
  const nombre = (el) =>
    el.tagName.toLowerCase() +
    (typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : '');
  const filas = [];
  for (const padre of document.querySelectorAll('app-tab.tab:not([hidden]), app-view-state-host')) {
    const hijos = [...padre.children].filter((c) => {
      const r = c.getBoundingClientRect();
      const cs = getComputedStyle(c);
      return r.height > 0 && cs.display !== 'none' && cs.position !== 'absolute' && cs.position !== 'fixed';
    });
    for (let i = 0; i < hijos.length - 1; i += 1) {
      const a = hijos[i];
      const b = hijos[i + 1];
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      filas.push({
        padre: nombre(padre),
        a: nombre(a),
        b: nombre(b),
        hueco: Math.round(rb.top - ra.bottom),
        display: getComputedStyle(b).display,
        apilado: Math.abs(rb.left - ra.left) < 2, // misma columna: no es una fila de cosas en línea
      });
    }
  }
  return filas;
};

const esBloque = (d) => ['block', 'flex', 'grid', 'list-item', 'table'].includes(d);
const esExcepcion = (f) => EXCEPCIONES.some((e) => e.a === f.a && e.b === f.b);

const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const defectos = [];
let parejas = 0;
let vistas = 0;

for (const rol of ROLES) {
  for (const ancho of ANCHOS) {
    const ctx = await navegador.newContext({ viewport: { width: ancho, height: 900 } });
    const pg = await ctx.newPage();
    await pg.goto(`${BASE}/auth`, { waitUntil: 'commit', timeout: 180000 });
    const destino = /\/(dashboard|auth\/organization)/;
    for (let i = 0; i < 6 && !destino.test(pg.url()); i += 1) {
      await pg.getByTestId('login-identifier').fill(`${rol}@alovida.mock`);
      await pg.getByTestId('login-password').fill('mockup');
      await pg.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
      await pg.waitForURL(destino, { timeout: 10000 }).catch(() => {});
    }
    if (pg.url().includes('/auth/organization')) {
      await pg.getByTestId('tenant-opcion').first().click();
      await pg.waitForURL(/\/dashboard/, { timeout: 60000 });
    }
    const rutas = await pg.evaluate(() => [
      ...new Set(
        [...document.querySelectorAll('a[href^="/"]')]
          .map((a) => a.getAttribute('href').split('?')[0].split('#')[0])
          .filter((h) => h.length > 1 && !h.includes(':') && !/\/(auth|logout|design-system)/.test(h)),
      ),
    ]);
    for (const ruta of rutas) {
      try {
        await pg.goto(`${BASE}${ruta}`, { waitUntil: 'commit', timeout: 60000 });
        await pg.locator('.app-main__inner').waitFor({ timeout: 20000 });
        // Sin `networkidle`: con HMR no llega nunca. Se espera a que el contenido deje de cargar.
        await pg.locator('[aria-busy="true"]').first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => {});
        const lecturas = [['base', await pg.evaluate(medir)]];
        const pestanas = pg.locator('[role=tab]:not([disabled])');
        const n = Math.min(await pestanas.count(), 7);
        for (let i = 0; i < n; i += 1) {
          await pestanas.nth(i).click({ timeout: 2000 }).catch(() => {});
          await pg.locator('[aria-busy="true"]').first().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
          lecturas.push([`pestaña ${i}`, await pg.evaluate(medir)]);
        }
        for (const [donde, filas] of lecturas) {
          vistas += 1;
          for (const f of filas) {
            parejas += 1;
            if (f.apilado && esBloque(f.display) && f.hueco < MINIMO && !esExcepcion(f)) {
              defectos.push(`${rol} ${ancho}px ${ruta} (${donde}): ${f.padre} › ${f.a} + ${f.b} = ${f.hueco} px`);
            }
          }
        }
      } catch (e) {
        defectos.push(`${rol} ${ancho}px ${ruta}: no se pudo medir (${String(e).slice(0, 80)})`);
      }
    }
    await ctx.close();
  }
}
await navegador.close();

process.stdout.write(`vistas=${vistas} parejas=${parejas} defectos=${defectos.length}\n`);
for (const d of defectos) process.stdout.write(`  ✘ ${d}\n`);
process.exit(defectos.length === 0 ? 0 : 1);
