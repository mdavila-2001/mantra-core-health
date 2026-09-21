/**
 * Pasada visual del portal administrativo (catálogo, analítica, QA, operación).
 *
 * No es un `spec`: es el barrido que la memoria del repo pide antes de dar por
 * cerrada una pantalla —3 anchos × 2 temas, mirando las capturas— más las tres
 * comprobaciones baratas que delatan lo que el typecheck y las unitarias no ven:
 *
 *   1. desborde horizontal del documento (tablas anchas en el teléfono);
 *   2. elementos más anchos que el viewport, con su selector;
 *   3. quién recibe el puntero en el centro de cada control visible
 *      (`elementFromPoint`), que es como se descubrió el defecto de `day-view`.
 *
 * Corre contra el backend simulado: `yarn start` en el 4200, sin docker.
 *
 *   node playwright/portal-admin-visual.mjs [carpeta-de-salida]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const SALIDA = process.argv[2] ?? path.join(process.cwd(), 'artifacts', 'portal-admin-visual');

const TODOS_LOS_VIEWPORTS = [
  { nombre: 'telefono', width: 390, height: 844 },
  { nombre: 'tableta', width: 820, height: 1180 },
  { nombre: 'escritorio', width: 1440, height: 900 },
];

/**
 * `SOLO_VIEWPORT=escritorio` corre un ancho solo. En esta máquina el navegador
 * se cae por memoria antes de terminar los tres de un tirón, y repetir los dos
 * que ya pasaron para llegar al tercero cuesta más de lo que informa.
 */
const VIEWPORTS = process.env.SOLO_VIEWPORT
  ? TODOS_LOS_VIEWPORTS.filter((v) => v.nombre === process.env.SOLO_VIEWPORT)
  : TODOS_LOS_VIEWPORTS;
const TEMAS = ['light', 'dark'];

/**
 * Las rutas de lista; las de detalle salen del primer enlace de cada lista.
 * `RUTAS_JSON` las reemplaza: sirve para medir una pantalla vieja como control
 * y saber si lo que se ve en una nueva ya pasaba antes.
 */
const RUTAS = process.env.RUTAS_JSON ? JSON.parse(process.env.RUTAS_JSON) : [
  { id: 'data-catalog', ruta: '/administration/data-catalog', detalle: 'a[href^="/administration/data-catalog/"]' },
  { id: 'web-analytics', ruta: '/administration/web-analytics', detalle: null },
  { id: 'qa-lab', ruta: '/administration/qa-lab', detalle: 'a[href^="/administration/qa-lab/plans/"]' },
  { id: 'operations', ruta: '/administration/operations', detalle: null },
];

/** Un barrido por ancho escribe su propio informe para no pisar al anterior. */
const ARCHIVO_INFORME = path.join(
  SALIDA,
  process.env.SOLO_VIEWPORT ? `informe-${process.env.SOLO_VIEWPORT}.json` : 'informe.json',
);

const CREDENCIAL = { identificador: 'admin@alovida.mock', clave: 'S3cret-passw0rd' };

async function esperarApp(page) {
  await page.waitForLoadState('load');
  await page.waitForFunction(() => document.querySelector('app-root')?.children.length > 0, null, {
    timeout: 30_000,
  });
  await page.evaluate(
    () => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo))),
  );
}

async function entrar(page) {
  await page.goto(`${BASE}/auth`);
  await esperarApp(page);
  await page.getByTestId('login-identifier').fill(CREDENCIAL.identificador);
  await page.getByTestId('login-password').fill(CREDENCIAL.clave);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

async function irA(page, ruta) {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, ruta);
  await page.waitForTimeout(400);
  try {
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
  } catch {
    // Una pantalla que nunca se aquieta es un hallazgo, no un motivo para abortar.
  }
}

/** Las tres mediciones, hechas en la página. */
async function medir(page) {
  return page.evaluate(() => {
    const selectorDe = (el) => {
      if (!el) return null;
      const clase = typeof el.className === 'string' && el.className.trim()
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : '';
      return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${clase}`;
    };

    const raiz = document.documentElement;
    const desborde = raiz.scrollWidth - raiz.clientWidth;

    /**
     * Un elemento más ancho que la pantalla sólo es un defecto si **nadie
     * arriba lo contiene**: dentro de un desplazador horizontal —la tira de
     * pestañas, la caja de una tabla ancha— es el comportamiento buscado.
     */
    const contenido = (el) => {
      for (let p = el.parentElement; p && p !== raiz; p = p.parentElement) {
        const overflow = getComputedStyle(p).overflowX;
        if (overflow === 'auto' || overflow === 'scroll' || overflow === 'hidden') return true;
      }
      return false;
    };

    const anchos = [];
    const culpables = [];
    for (const el of document.querySelectorAll('main *')) {
      const caja = el.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0) continue;
      const excedente = Math.round(caja.right - raiz.clientWidth);
      if (excedente <= 1) continue;
      const dato = { selector: selectorDe(el), excedente };
      anchos.push(dato);
      if (!contenido(el)) culpables.push(dato);
    }
    anchos.sort((a, b) => b.excedente - a.excedente);
    culpables.sort((a, b) => b.excedente - a.excedente);

    const tapados = [];
    const controles = document.querySelectorAll(
      'main button, main a[href], main [role="button"], main input, main select',
    );
    for (const control of controles) {
      const caja = control.getBoundingClientRect();
      if (caja.width === 0 || caja.height === 0) continue;
      const x = caja.left + caja.width / 2;
      const y = caja.top + caja.height / 2;
      if (x < 0 || y < 0 || x > raiz.clientWidth || y > window.innerHeight) continue;
      const encima = document.elementFromPoint(x, y);
      if (encima === null) {
        tapados.push({ control: selectorDe(control), recibe: null, texto: control.textContent?.trim().slice(0, 40) ?? '' });
        continue;
      }
      if (control.contains(encima) || encima.contains(control)) continue;
      tapados.push({
        control: selectorDe(control),
        recibe: selectorDe(encima),
        texto: control.textContent?.trim().slice(0, 40) ?? '',
      });
    }

    const vacia = (document.querySelector('main')?.innerText ?? '').trim().length < 40;

    return {
      desborde,
      anchos: anchos.slice(0, 6),
      culpables: culpables.slice(0, 6),
      tapados: tapados.slice(0, 8),
      vacia,
    };
  });
}

async function main() {
  await mkdir(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const informe = [];

  for (const viewport of VIEWPORTS) {
    for (const tema of TEMAS) {
      const contexto = await navegador.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        locale: 'es-BO',
        timezoneId: 'America/La_Paz',
        colorScheme: tema === 'dark' ? 'dark' : 'light',
      });
      await contexto.addInitScript(
        ([clave, valor]) => {
          try {
            window.localStorage.setItem(clave, valor);
          } catch {
            /* modo privado */
          }
        },
        ['mantra-core-health.theme', tema],
      );

      const page = await contexto.newPage();
      const consola = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consola.push(msg.text().slice(0, 200));
      });
      page.on('pageerror', (err) => consola.push(`pageerror: ${String(err).slice(0, 200)}`));

      await entrar(page);

      for (const pantalla of RUTAS) {
        const destinos = [{ id: pantalla.id, ruta: pantalla.ruta }];
        await irA(page, pantalla.ruta);

        if (pantalla.detalle) {
          const href = await page
            .locator(pantalla.detalle)
            .first()
            .getAttribute('href')
            .catch(() => null);
          if (href) destinos.push({ id: `${pantalla.id}-detalle`, ruta: href });
        }

        for (const destino of destinos) {
          if (destino.ruta !== page.url().replace(BASE, '')) await irA(page, destino.ruta);
          consola.length = 0;
          await page.waitForTimeout(300);
          const medida = await medir(page);
          const archivo = path.join(SALIDA, `${destino.id}-${viewport.nombre}-${tema}.png`);
          // Una página muy alta agota al capturador; la pantalla completa es
          // deseable, pero perderla no puede tumbar el barrido.
          let captura = 'completa';
          try {
            await page.screenshot({ path: archivo, fullPage: true, timeout: 20_000 });
          } catch {
            captura = 'recortada';
            try {
              await page.screenshot({ path: archivo, timeout: 20_000 });
            } catch {
              captura = 'fallida';
            }
          }
          informe.push({
            pantalla: destino.id,
            ruta: destino.ruta,
            viewport: viewport.nombre,
            tema,
            ...medida,
            consola: [...consola],
            captura: path.basename(archivo),
            capturaModo: captura,
          });
          const señales = [
            medida.desborde > 1 ? `desborde ${medida.desborde}px` : null,
            medida.culpables.length ? `${medida.culpables.length} culpables` : null,
            medida.tapados.length ? `${medida.tapados.length} tapados` : null,
            medida.vacia ? 'vacía' : null,
            consola.length ? `${consola.length} errores` : null,
          ].filter(Boolean);
          console.log(
            `${destino.id.padEnd(22)} ${viewport.nombre.padEnd(11)} ${tema.padEnd(5)} ${señales.length ? señales.join(' · ') : 'ok'}`,
          );
          // Se escribe en cada paso: un barrido cortado a la mitad deja igual
          // lo que ya midió.
          await writeFile(ARCHIVO_INFORME, JSON.stringify(informe, null, 2), 'utf8');
        }
      }

      await contexto.close();
    }
  }

  await navegador.close();
  await writeFile(ARCHIVO_INFORME, JSON.stringify(informe, null, 2), 'utf8');
  console.log(`\nCapturas e informe en ${SALIDA}`);
}

await main();
