import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { catalogoDeRutas, type RutaDelCatalogo } from './support/salud-de-rutas';
import { entrar, esperarAplicacionLista, irA } from './support/sesion';

/**
 * Captura móvil — evidencia real a 390 × 844 de toda la aplicación.
 * Trabajo: `docs/trabajo/2026-10-21-movil-paridad-estetica`.
 *
 * Reusa la forma del barrido `refac-ux-barrido.spec.ts` (login real por la
 * pantalla, catálogo generado de rutas, ids resueltos con enlaces que la propia
 * aplicación mostró) pero a un solo ancho y con otro propósito: producir las
 * capturas «antes» y «después» que se comparan a ojo, en tema claro y oscuro,
 * más una medición de lo que una captura no deja ver (desborde, objetivos
 * táctiles, tablas anchas, marca).
 *
 * No arregla nada. Lo que sale:
 *   `docs/trabajo/2026-10-21-movil-paridad-estetica/evidencia/<FASE>/<actor>/`
 *     `<ruta>-claro.png`, `<ruta>-oscuro.png`, `medicion.json`
 *
 * `MOVIL_FASE` elige la carpeta (`01-antes` por omisión, `02-despues` al final).
 *
 * ```
 * PW_CHROMIUM=/opt/pw-browsers/chromium MOVIL_FASE=01-antes \
 *   yarn pw playwright/movil-captura.spec.ts --grep "paciente"
 * ```
 *
 * En el contenedor de la sesión no se puede bajar el Chromium que pide esta
 * versión de Playwright: `PW_CHROMIUM` apunta al preinstalado. Sin la variable
 * se usa el de siempre.
 */

const FASE = process.env['MOVIL_FASE'] ?? '01-antes';
const EVIDENCIA = join('docs', 'trabajo', '2026-10-21-movil-paridad-estetica', 'evidencia');
const ENLACES_PREVIOS = join('docs', 'refactor-profesional', 'trabajo', 'barrido');
const MOVIL = { width: 390, height: 844 } as const;
const POR_PRUEBA = 8;
const EJECUTABLE = process.env['PW_CHROMIUM'];
/**
 * `MOVIL_SOLO_MEDIR=1` repite la medición sin tomar capturas: sirve para
 * agregar una medición nueva al estado «antes» sin recapturarlo, siempre que el
 * código de la aplicación no haya cambiado desde esa fase.
 */
const SOLO_MEDIR = process.env['MOVIL_SOLO_MEDIR'] === '1';

test.use({
  viewport: MOVIL,
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  ...(EJECUTABLE ? { launchOptions: { executablePath: EJECUTABLE } } : {}),
});

type Clave = 'paciente' | 'medica' | 'superadmin';
const ACTORES: Record<Clave, Actor> = {
  paciente: { rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mock', nombre: 'Paciente' },
  medica: { rol: 'doctora', identificador: 'medica@alovida.mock', clave: 'mock', nombre: 'Médica' },
  superadmin: {
    rol: 'administrador',
    identificador: 'superadmin@alovida.mock',
    clave: 'mock',
    nombre: 'Superadmin',
  },
};

const RUIDO = [
  /Executing inline script violates the following Content Security Policy/,
  /was preloaded using link preload but not used/i,
];

/** Rutas sin sesión: lo que ve quien todavía no entró, más las de error. */
const PUBLICAS = [
  '/auth',
  '/auth/register',
  '/auth/register/patient',
  '/auth/register/practitioner',
  '/auth/register/organization',
  '/auth/register/laboratory',
  '/auth/register/imaging-center',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/activate',
  '/auth/resend-verification',
  '/error',
  '/ruta-que-no-existe',
  '/verify/portability/0000000000000000',
  '/design-system',
];

interface Medicion {
  readonly ruta: string;
  readonly abierta: string;
  readonly componente: string;
  readonly archivo: string;
  readonly alto: number;
  readonly problemas: Record<string, string[]>;
}

/** Quién mira cada ruta. Igual que en `refac-ux-barrido.spec.ts`. */
function actoresDe(entrada: RutaDelCatalogo): Clave[] {
  const roles = entrada.roles ?? [];
  if (entrada.ruta.startsWith('/my-account')) return ['paciente'];
  if (roles.length === 0) return ['medica', 'paciente'];
  if (roles.includes('PATIENT') && !roles.some((r) => r === 'PRACTITIONER' || r === 'CLINICIAN'))
    return ['paciente'];
  if (roles.some((r) => ['PRACTITIONER', 'CLINICIAN', 'SCHEDULER'].includes(r))) return ['medica'];
  return ['superadmin'];
}

function patron(ruta: string): RegExp {
  return new RegExp('^' + ruta.replace(/:[^/]+/g, '[^/?#]+') + '$');
}

function nombreDeArchivo(ruta: string): string {
  const limpio = ruta.replace(/^\//, '').replace(/[/:*]+/g, '_');
  return limpio === '' ? 'raiz' : limpio;
}

/** Lo que se mide dentro de la página. Sin dependencias: corre en el navegador. */
async function medirEnPagina(page: Page): Promise<Record<string, string[]>> {
  return page.evaluate(() => {
    const out: Record<string, string[]> = {};
    const add = (k: string, v: string) => {
      const lista = (out[k] ??= []);
      if (lista.length < 6) lista.push(v.replace(/\s+/g, ' ').trim().slice(0, 100));
    };
    const visible = (e: Element) => {
      const r = (e as HTMLElement).getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const main = document.querySelector('main') ?? document.body;
    const W = document.documentElement.clientWidth;
    const etiqueta = (e: Element) => {
      const cls = (e.className?.toString() || '').split(' ').filter(Boolean).slice(0, 2).join('.');
      return `${e.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
    };

    if (document.documentElement.scrollWidth > W + 1) {
      add('desborde', `${document.documentElement.scrollWidth} > ${W}`);
      for (const e of document.querySelectorAll('body *')) {
        const r = e.getBoundingClientRect();
        if (r.right <= W + 1 || r.width === 0 || !visible(e)) continue;
        const padre = e.parentElement?.getBoundingClientRect();
        if (padre && padre.right > W + 1) continue;
        add('desborde', `${etiqueta(e)} → ${Math.round(r.right)}px`);
      }
    }

    // Contenido que se sale por el borde y NO hace desplazar la página porque un
    // contenedor lo recorta (overflow hidden/clip): el caso de una lista de
    // chats cuyo texto queda cortado. Dentro de un contenedor con scroll
    // lateral (auto/scroll) no cuenta: ahí el recorte tiene salida.
    const recortadoPor = (e: Element): boolean => {
      for (let p = e.parentElement; p; p = p.parentElement) {
        const o = getComputedStyle(p).overflowX;
        if (o === 'auto' || o === 'scroll') return false;
        if (o === 'hidden' || o === 'clip') return true;
      }
      return false;
    };
    for (const e of main.querySelectorAll('*')) {
      if (!visible(e)) continue;
      const r = e.getBoundingClientRect();
      if (r.right <= W + 1) continue;
      const padre = e.parentElement?.getBoundingClientRect();
      if (padre && padre.right > W + 1) continue;
      if (recortadoPor(e)) add('cortado', `${etiqueta(e)} → ${Math.round(r.right)}px en ${W}px`);
    }

    const h1 = [...document.querySelectorAll('h1')].filter(visible);
    if (h1.length !== 1) add('h1', `${h1.length} h1`);

    for (const e of main.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), button, select')) {
      if (!visible(e)) continue;
      const h = e as HTMLElement;
      if (h.matches('.sr-only, .solo-lectores') || h.clientWidth <= 2) continue;
      if (h.scrollWidth > h.clientWidth + 1 && getComputedStyle(h).overflow !== 'visible')
        add('recorte', (h.getAttribute('placeholder') ?? h.textContent ?? h.tagName) || h.tagName);
    }

    for (const e of main.querySelectorAll('button, [role=button], a[app-button], a[href]')) {
      if (!visible(e) || e.closest('[aria-hidden=true]')) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 24 || r.height < 24) {
        const inline = e.tagName === 'A' && getComputedStyle(e).display === 'inline';
        if (!inline) add('objetivo-chico', `${Math.round(r.width)}×${Math.round(r.height)} ${(e.getAttribute('aria-label') ?? e.textContent ?? '').trim()}`);
      }
    }

    // Tablas: una que obliga a desplazarse de lado, o con muchas columnas que
    // no se reacomodan, es lo que más estropea una pantalla de teléfono.
    for (const t of main.querySelectorAll('table')) {
      if (!visible(t)) continue;
      const cols = t.querySelectorAll('thead th').length;
      const caja = t.closest('.data-table__scroll, [class*=scroll], [class*=table-wrap]') ?? t.parentElement;
      const ancho = t.getBoundingClientRect().width;
      if (caja && (caja.scrollWidth > caja.clientWidth + 1 || ancho > W)) {
        add('tabla-ancha', `${cols} col, ${Math.round(Math.max(caja.scrollWidth, ancho))}px en ${W}px`);
      } else if (cols > 3) {
        add('tabla-columnas', `${cols} columnas visibles`);
      }
    }

    for (const tl of document.querySelectorAll('[role=tablist]')) {
      if (visible(tl) && tl.scrollWidth > tl.clientWidth + 1)
        add('pestanas-desbordan', `${tl.scrollWidth - tl.clientWidth}px sin indicio`);
    }

    let chicos = 0;
    for (const e of main.querySelectorAll('p, span, td, th, li, label, a, button, dd, dt')) {
      if (!visible(e) || !(e.textContent ?? '').trim() || e.children.length > 0) continue;
      if (parseFloat(getComputedStyle(e).fontSize) < 12) chicos++;
    }
    if (chicos > 0) add('texto-chico', `${chicos} elementos < 12px`);

    // Marca: ¿se ve el isotipo ALOVIDA en la primera pantalla?
    // El isotipo se dibuja de tres maneras: `<img>`, `<svg>` en línea, o como
    // máscara/fondo CSS (la píldora de las pantallas de ingreso). Las tres cuentan.
    const esMarca = (e: Element): boolean => {
      if (e.matches('img[src*="alovida-logo"], svg[aria-label="AloVida"]')) return true;
      const cs = getComputedStyle(e);
      const capas = `${cs.maskImage} ${cs.webkitMaskImage} ${cs.backgroundImage}`;
      return capas.includes('alovida-logo');
    };
    const marca = [...document.querySelectorAll('body *')].some(
      (e) => esMarca(e) && visible(e) && e.getBoundingClientRect().top < 140 && e.getBoundingClientRect().right > 0,
    );
    if (!marca) add('sin-marca', 'ningún isotipo ALOVIDA visible en los primeros 140px');

    const alto = document.documentElement.scrollHeight;
    if (alto > 4500) add('muy-larga', `${alto}px`);

    const texto = (main as HTMLElement).innerText ?? '';
    const roto = texto.match(/\b(undefined|NaN)\b|\[object Object\]|\bnull\b/);
    if (roto) add('texto-roto', roto[0]);
    if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(texto)) add('uuid-visible', 'uuid en el texto');
    return out;
  });
}

/**
 * Captura la página entera en el tema indicado.
 *
 * Sin `fullPage`: esa opción cambia el alto sin avisar a la página y el menú
 * lateral queda dibujado encima del contenido (sólo en la captura). Se agranda
 * la ventana de verdad y se captura normal — lo mismo que hace el barrido de
 * escritorio.
 */
async function capturar(page: Page, archivo: string, tema: 'light' | 'dark'): Promise<number> {
  await page.emulateMedia({ colorScheme: tema, reducedMotion: 'reduce' });
  await page.setViewportSize(MOVIL);
  await page.waitForTimeout(350);
  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width: MOVIL.width, height: Math.min(Math.max(alto, MOVIL.height), 6000) });
  await page.waitForTimeout(350);
  await page.screenshot({ path: archivo }).catch(() => undefined);
  await page.setViewportSize(MOVIL);
  return alto;
}

/** Captura en claro y oscuro, o sólo mide el alto si `MOVIL_SOLO_MEDIR`. */
async function capturarEnAmbosTemas(page: Page, carpeta: string, base: string): Promise<number> {
  if (SOLO_MEDIR) return page.evaluate(() => document.documentElement.scrollHeight);
  const alto = await capturar(page, join(carpeta, `${base}-claro.png`), 'light');
  await capturar(page, join(carpeta, `${base}-oscuro.png`), 'dark');
  return alto;
}

function carpetaDe(destino: string): string {
  const carpeta = join(EVIDENCIA, FASE, destino);
  mkdirSync(carpeta, { recursive: true });
  return carpeta;
}

function enlacesPrevios(clave: Clave): Set<string> {
  const archivo = join(ENLACES_PREVIOS, `${clave}.enlaces.json`);
  return new Set<string>(existsSync(archivo) ? JSON.parse(readFileSync(archivo, 'utf8')) : []);
}

test('humo: /auth a 390 en claro y oscuro', async ({ page }) => {
  const carpeta = carpetaDe('00-humo');
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  await expect(page.getByTestId('login-submit')).toBeVisible();
  await capturar(page, join(carpeta, 'auth-claro.png'), 'light');
  await capturar(page, join(carpeta, 'auth-oscuro.png'), 'dark');
});

test('publicas', async ({ page }) => {
  test.setTimeout(300_000);
  const carpeta = carpetaDe('publicas');
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !RUIDO.some((r) => r.test(m.text()))) errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(e.message));
  const mediciones: Medicion[] = [];
  for (const ruta of PUBLICAS) {
    errores.length = 0;
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
    await page.goto(ruta);
    await esperarAplicacionLista(page);
    await page.waitForTimeout(1200);
    const problemas = await medirEnPagina(page);
    if (errores.length) problemas['consola'] = errores.slice(0, 4).map((t) => t.slice(0, 140));
    const base = nombreDeArchivo(ruta);
    const alto = await capturarEnAmbosTemas(page, carpeta, base);
    mediciones.push({ ruta, abierta: new URL(page.url()).pathname, componente: '', archivo: base, alto, problemas });
  }
  writeFileSync(join(carpeta, 'medicion.json'), JSON.stringify(mediciones, null, 1));
});

const catalogo = catalogoDeRutas();
const todas: RutaDelCatalogo[] = [...catalogo.secciones, ...catalogo.hijas];

for (const clave of Object.keys(ACTORES) as Clave[]) {
  const propias = todas.filter((r) => actoresDe(r).includes(clave));
  const fijas = propias.filter((r) => !r.parametrizada);
  const conParametro = propias.filter((r) => r.parametrizada);
  const lotes: RutaDelCatalogo[][] = [];
  for (let i = 0; i < fijas.length; i += POR_PRUEBA) lotes.push(fijas.slice(i, i + POR_PRUEBA));
  lotes.push(conParametro);

  lotes.forEach((lote, n) => {
    test(`movil ${clave} ${n + 1}/${lotes.length}`, async ({ page }) => {
      test.setTimeout(600_000);
      const carpeta = carpetaDe(clave);
      const archivo = join(carpeta, 'medicion.json');
      const enlaces = join(carpeta, 'enlaces.json');
      const previas: Medicion[] = n === 0 || !existsSync(archivo) ? [] : JSON.parse(readFileSync(archivo, 'utf8'));
      const vistos = new Set<string>([
        ...enlacesPrevios(clave),
        ...(n === 0 || !existsSync(enlaces) ? [] : (JSON.parse(readFileSync(enlaces, 'utf8')) as string[])),
      ]);
      const errores: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error' && !RUIDO.some((r) => r.test(m.text()))) errores.push(m.text());
      });
      page.on('pageerror', (e) => errores.push(e.message));

      await entrar(page, ACTORES[clave]);

      for (const entrada of lote) {
        let destino = entrada.ruta;
        if (entrada.parametrizada) {
          const p = patron(entrada.ruta);
          const hallado = [...vistos].find((href) => p.test(href.split(/[?#]/)[0]));
          if (!hallado) {
            previas.push({
              ruta: entrada.ruta,
              abierta: '',
              componente: entrada.componente,
              archivo: '',
              alto: 0,
              problemas: { 'sin-enlace': ['ningún enlace real a esta ruta'] },
            });
            continue;
          }
          destino = hallado;
        }
        errores.length = 0;
        await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
        await page.setViewportSize(MOVIL);
        try {
          await irA(page, destino);
        } catch (e) {
          previas.push({
            ruta: entrada.ruta,
            abierta: destino,
            componente: entrada.componente,
            archivo: '',
            alto: 0,
            problemas: { 'no-abre': [String(e).slice(0, 120)] },
          });
          continue;
        }
        await page.waitForTimeout(2000);
        const abierta = new URL(page.url()).pathname;
        for (const href of await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))) vistos.add(href);

        const problemas = await medirEnPagina(page);
        if (abierta !== destino.split(/[?#]/)[0]) (problemas['rebota'] ??= []).push(abierta);
        if (errores.length) problemas['consola'] = errores.slice(0, 4).map((t) => t.slice(0, 140));
        const base = nombreDeArchivo(entrada.ruta);
        const alto = await capturarEnAmbosTemas(page, carpeta, base);
        previas.push({ ruta: entrada.ruta, abierta, componente: entrada.componente, archivo: base, alto, problemas });
      }
      writeFileSync(archivo, JSON.stringify(previas, null, 1));
      writeFileSync(enlaces, JSON.stringify([...vistos]));
    });
  });
}
