import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { catalogoDeRutas, type RutaDelCatalogo } from './support/salud-de-rutas';
import { entrar, irA } from './support/sesion';

/**
 * Refactor UX — barrido de TODA la aplicación (backend simulado de `mockup`).
 *
 * Cada ruta del catálogo generado, con el rol que la ve, en 1440 / 768 / 390,
 * midiendo los defectos que la auditoría encontró a mano en el piloto. No
 * arregla nada: produce `docs/refactor-profesional/trabajo/barrido/<actor>.json`
 * para que cada familia se corrija con evidencia y se vuelva a medir.
 *
 * Rutas con parámetro: se resuelven con enlaces reales que el mismo barrido
 * encontró en pantallas anteriores; si no apareció ninguno, se reportan como
 * «sin enlace» en vez de inventar un id.
 *
 * `E2E_BASE_URL=http://localhost:4310 yarn pw playwright/refac-ux-barrido.spec.ts --workers=1`
 */

const SALIDA = join('docs', 'refactor-profesional', 'trabajo', 'barrido');
const VIEWPORTS = [
  { ancho: 1440, alto: 900 },
  { ancho: 768, alto: 1024 },
  { ancho: 390, alto: 844 },
] as const;
const POR_PRUEBA = 10;
/** Carpeta de capturas para la revisión visual (fuera del repo), o nada. */
const CAPTURAS = process.env['REFAC_CAPTURAS'] ?? '';

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

interface Medicion {
  readonly ruta: string;
  readonly abierta: string;
  readonly componente: string;
  readonly ancho: number;
  readonly problemas: Record<string, string[]>;
}

/** Quién mira cada ruta. Un rol que la ve de verdad, no uno que rebota. */
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

/** Lo que se mide dentro de la página. Sin dependencias: corre en el navegador. */
async function medirEnPagina(page: Page, ancho: number): Promise<Record<string, string[]>> {
  return page.evaluate((anchoVp) => {
    const out: Record<string, string[]> = {};
    const add = (k: string, v: string) => {
      const lista = (out[k] ??= []);
      if (lista.length < 6) lista.push(v.replace(/\s+/g, ' ').trim().slice(0, 90));
    };
    const visible = (e: Element) => {
      const r = (e as HTMLElement).getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
    };
    const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const main = document.querySelector('main') ?? document.body;

    const W = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > W + 1) {
      add('desborde', `${document.documentElement.scrollWidth} > ${W}`);
      // Los culpables: los elementos más externos que pasan el borde derecho.
      for (const e of document.querySelectorAll('main *')) {
        const r = e.getBoundingClientRect();
        if (r.right <= W + 1 || r.width === 0) continue;
        const padre = e.parentElement?.getBoundingClientRect();
        if (padre && padre.right > W + 1) continue;
        const cls = (e.className?.toString() || '').split(' ').filter(Boolean).slice(0, 2).join('.');
        add('desborde', `${e.tagName.toLowerCase()}${cls ? '.' + cls : ''} → ${Math.round(r.right)}px`);
      }
    }

    const h1 = [...document.querySelectorAll('h1')].filter(visible);
    if (h1.length !== 1) add('h1', `${h1.length} h1`);

    for (const e of main.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), button, select, a[app-button]')) {
      if (!visible(e)) continue;
      const h = e as HTMLElement;
      // Los ocultos a propósito (solo para lectores, 1 px) no están «recortados».
      if (h.matches('.sr-only, .solo-lectores') || h.clientWidth <= 2) continue;
      if (h.scrollWidth > h.clientWidth + 1 && getComputedStyle(h).overflow !== 'visible')
        add('recorte', (h.getAttribute('placeholder') ?? h.textContent ?? h.tagName) || h.tagName);
    }

    for (const e of document.querySelectorAll('body *')) {
      if (getComputedStyle(e).textTransform !== 'capitalize' || !visible(e)) continue;
      const t = e.textContent ?? '';
      if (/\b(de|del|a las|al|en|y)\b/.test(t)) add('mayusculas', t);
    }

    const texto = (main as HTMLElement).innerText ?? '';
    const m = texto.match(UUID);
    if (m) add('uuid-visible', m[0]);
    const roto = texto.match(/\b(undefined|NaN)\b|\[object Object\]|\bnull\b/);
    if (roto) add('texto-roto', roto[0]);

    for (const e of document.querySelectorAll('[aria-label], [title]')) {
      const n = `${e.getAttribute('aria-label') ?? ''} ${e.getAttribute('title') ?? ''}`;
      if (UUID.test(n)) add('uuid-en-nombre', n);
    }

    for (const e of document.querySelectorAll('button, a[href], [role=button]')) {
      if (!visible(e) || e.closest('[aria-hidden=true]')) continue;
      const nombre =
        (e.getAttribute('aria-label') ?? '').trim() ||
        (e.getAttribute('title') ?? '').trim() ||
        (e.getAttribute('aria-labelledby') ?? '').trim() ||
        (e.textContent ?? '').trim() ||
        [...e.querySelectorAll('img[alt]')].map((i) => i.getAttribute('alt')).join('');
      if (!nombre) add('sin-nombre', e.outerHTML.slice(0, 90));
    }

    for (const i of document.querySelectorAll('img:not([alt])')) if (visible(i)) add('img-sin-alt', (i as HTMLImageElement).src);

    // El mismo nombre accesible repetido en varias filas («Descargar PDF» ×3):
    // navegando por botones con lector de pantalla no se sabe de qué es cada uno.
    const nombres = new Map<string, number>();
    for (const e of main.querySelectorAll('button, a[href], [role=button]')) {
      if (!visible(e) || e.closest('nav, [aria-hidden=true], .data-table__detail-toggle-cell')) continue;
      const n = ((e.getAttribute('aria-label') ?? '').trim() || (e.textContent ?? '').replace(/\s+/g, ' ').trim()).toLowerCase();
      if (n.length < 2) continue;
      nombres.set(n, (nombres.get(n) ?? 0) + 1);
    }
    for (const [n, veces] of nombres) if (veces > 1) add('nombre-repetido', `${n} ×${veces}`);

    if (anchoVp <= 400) {
      for (const e of main.querySelectorAll('button, [role=button], a[app-button]')) {
        if (!visible(e)) continue;
        const r = e.getBoundingClientRect();
        if (r.width < 24 || r.height < 24) add('objetivo-chico', `${Math.round(r.width)}×${Math.round(r.height)} ${(e.getAttribute('aria-label') ?? e.textContent ?? '').trim()}`);
      }
    }
    if (anchoVp >= 1400) {
      // Botones que se estiran a lo ancho de su contenedor en escritorio.
      for (const b of main.querySelectorAll('button[app-button], a[app-button]')) {
        if (!visible(b)) continue;
        const r = b.getBoundingClientRect();
        if (r.width > 600) add('boton-a-lo-ancho', `${Math.round(r.width)}px ${(b.textContent ?? '').trim().slice(0, 40)}`);
      }
      // Regla del cliente (composition-rules §5): cada bloque de la pantalla,
      // centrado (holguras ≤ 2 px de diferencia) y ≥ 85 % del área de contenido.
      const inner = document.querySelector('.app-main__inner');
      const vista = inner?.querySelector(':scope > :not(router-outlet)');
      if (inner && vista) {
        const ci = inner.getBoundingClientRect();
        const pad = parseFloat(getComputedStyle(inner).paddingLeft) + parseFloat(getComputedStyle(inner).paddingRight);
        const area = ci.width - pad;
        const izq0 = ci.left + parseFloat(getComputedStyle(inner).paddingLeft);
        for (const b of vista.children) {
          if (!visible(b) || b.matches('app-page-header, router-outlet, ng-template, [hidden]')) continue;
          const r = b.getBoundingClientRect();
          if (r.height < 40) continue;
          const izq = r.left - izq0;
          const der = izq0 + area - r.right;
          if (r.width < area * 0.85 && Math.abs(izq - der) > 2) {
            const cls = (b.className?.toString() || '').split(' ').filter(Boolean).slice(0, 2).join('.');
            add('composicion', `${b.tagName.toLowerCase()}${cls ? '.' + cls : ''} ${Math.round((r.width / area) * 100)}% izq ${Math.round(izq)} der ${Math.round(der)}`);
          }
        }
        // Formularios acotados a una «medida de formulario» dentro de su tarjeta.
        for (const f of main.querySelectorAll('form, app-form-field')) {
          if (!visible(f)) continue;
          const tarjeta = f.closest('app-card, .card');
          if (!tarjeta) continue;
          const rf = f.getBoundingClientRect();
          const rt = tarjeta.getBoundingClientRect();
          if (f.tagName === 'FORM' && rt.width > 600 && rf.width < rt.width * 0.7) {
            add('formulario-acotado', `form ${Math.round(rf.width)}px en tarjeta de ${Math.round(rt.width)}px`);
          }
        }
        // Un campo solo en su fila y angosto dentro de una tarjeta ancha: la
        // «medida de formulario» que la regla prohíbe. En columnas no cuenta.
        const campos = [...main.querySelectorAll('app-form-field')].filter(visible);
        for (const c of campos) {
          const tarjeta = c.closest('app-card, .card');
          if (!tarjeta) continue;
          const rc = c.getBoundingClientRect();
          const rt = tarjeta.getBoundingClientRect();
          if (rt.width < 700) continue;
          const acompanado = campos.some(
            (o) => o !== c && Math.abs(o.getBoundingClientRect().top - rc.top) < 4,
          );
          if (!acompanado && rc.width < rt.width * 0.6) {
            add('campo-acotado', `${(c.querySelector('label')?.textContent ?? '').trim().slice(0, 30)} ${Math.round(rc.width)}/${Math.round(rt.width)}px`);
          }
        }
      }
      for (const s of document.querySelectorAll('.data-table__scroll')) {
        if (s.scrollWidth > s.clientWidth + 1) add('tabla-oculta', `${s.scrollWidth - s.clientWidth}px`);
      }
    }
    return out;
  }, ancho);
}

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
    test(`barrido ${clave} ${n + 1}/${lotes.length}`, async ({ page }) => {
      test.setTimeout(600_000);
      mkdirSync(SALIDA, { recursive: true });
      if (CAPTURAS) mkdirSync(CAPTURAS, { recursive: true });
      const archivo = join(SALIDA, `${clave}.json`);
      const enlaces = join(SALIDA, `${clave}.enlaces.json`);
      const previas: Medicion[] = n === 0 || !existsSync(archivo) ? [] : JSON.parse(readFileSync(archivo, 'utf8'));
      const vistos = new Set<string>(n === 0 || !existsSync(enlaces) ? [] : JSON.parse(readFileSync(enlaces, 'utf8')));
      const errores: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error' && !RUIDO.some((r) => r.test(m.text()))) errores.push(m.text());
      });
      page.on('pageerror', (e) => errores.push(e.message));

      await page.setViewportSize({ width: 1440, height: 900 });
      await entrar(page, ACTORES[clave]);

      for (const entrada of lote) {
        let destino = entrada.ruta;
        if (entrada.parametrizada) {
          const p = patron(entrada.ruta);
          const hallado = [...vistos].find((href) => p.test(href.split(/[?#]/)[0]));
          if (!hallado) {
            previas.push({ ruta: entrada.ruta, abierta: '', componente: entrada.componente, ancho: 0, problemas: { 'sin-enlace': ['ningún enlace real a esta ruta en el barrido'] } });
            continue;
          }
          destino = hallado;
        }
        errores.length = 0;
        await page.setViewportSize({ width: 1440, height: 900 });
        try {
          await irA(page, destino);
        } catch (e) {
          previas.push({ ruta: entrada.ruta, abierta: destino, componente: entrada.componente, ancho: 0, problemas: { 'no-abre': [String(e).slice(0, 120)] } });
          continue;
        }
        await page.waitForTimeout(2200);
        const abierta = new URL(page.url()).pathname;
        for (const href of await page.locator('a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))) vistos.add(href);
        for (const vp of VIEWPORTS) {
          await page.setViewportSize({ width: vp.ancho, height: vp.alto });
          await page.waitForTimeout(500);
          const problemas = await medirEnPagina(page, vp.ancho);
          if (CAPTURAS) {
            const nombre = `${clave}${entrada.ruta.replace(/[/:]/g, '_')}-${vp.ancho}.png`;
            // Sin `fullPage`: esa opción cambia el alto sin avisar a la página y
            // el menú lateral quedaba dibujado encima del contenido (sólo en la
            // captura). Se agranda la ventana de verdad y se captura normal.
            const alto = await page.evaluate(() => document.documentElement.scrollHeight);
            await page.setViewportSize({ width: vp.ancho, height: Math.min(Math.max(alto, vp.alto), 6000) });
            await page.waitForTimeout(400);
            await page.screenshot({ path: join(CAPTURAS, nombre) }).catch(() => undefined);
            await page.setViewportSize({ width: vp.ancho, height: vp.alto });
          }
          if (vp.ancho === 1440 && abierta !== destino.split(/[?#]/)[0]) (problemas['rebota'] ??= []).push(abierta);
          if (vp.ancho === 1440 && errores.length) problemas['consola'] = errores.slice(0, 4).map((t) => t.slice(0, 140));
          previas.push({ ruta: entrada.ruta, abierta, componente: entrada.componente, ancho: vp.ancho, problemas });
        }
      }
      writeFileSync(archivo, JSON.stringify(previas, null, 1));
      writeFileSync(enlaces, JSON.stringify([...vistos]));
    });
  });
}
