import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { catalogoDeRutas, tieneContenido, vigilar } from './support/salud-de-rutas';
import { entrar, estable, irA } from './support/sesion';

/**
 * Baseline visual de la Wave 0 del protocolo FABLE.
 *
 * Mide, no juzga: recorre las secciones del catálogo generado en los cinco
 * viewports contractuales y anota lo que el navegador reporta. El resultado
 * alimenta `docs/frontend/VISUAL_BASELINE.md` y el DAG de refactor.
 *
 * Reusa el arnés que ya existe (`support/`) en vez de montar uno nuevo, y
 * **no espera `networkidle`**: contra `ng serve` con HMR no llega nunca y
 * produce verdes falsos.
 *
 * Sólo guarda captura donde hay defecto. Fotografiar 140 pantallas sanas
 * engorda el repositorio sin agregar información.
 */

const SALIDA = join(
  'docs',
  'frontend',
  'evidence',
  process.env['FABLE_ALCANCE'] === 'todo' ? 'matriz' : 'baseline',
);

const VIEWPORTS = [
  { nombre: '390x844', width: 390, height: 844 },
  { nombre: '768x1024', width: 768, height: 1024 },
  { nombre: '1024x768', width: 1024, height: 768 },
  { nombre: '1440x900', width: 1440, height: 900 },
  { nombre: '1920x1080', width: 1920, height: 1080 },
] as const;

const CUENTA: Actor = {
  rol: 'administrador',
  identificador: 'superadmin@alovida.mock',
  clave: 'mock',
  nombre: 'Superadmin',
};

interface Medicion {
  readonly ruta: string;
  readonly urlFinal: string;
  readonly componente: string;
  readonly estado: string;
  readonly viewport: string;
  readonly pinta: boolean;
  readonly desbordeX: number;
  readonly erroresDeConsola: readonly string[];
  readonly peticionesFallidas: readonly string[];
  readonly defectos: readonly string[];
  readonly captura: string | null;
}

/** Cuánto se sale el documento del ancho de la ventana, en px. */
async function desbordeHorizontal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(0, d.scrollWidth - d.clientWidth);
  });
}

test.describe('FABLE · baseline visual', () => {
  test('recorre las secciones en los cinco viewports', async ({ page }) => {
    test.setTimeout(30 * 60_000);

    const mediciones: Medicion[] = [];
    const cat = catalogoDeRutas();
    const todas = [...cat.secciones, ...cat.hijas, ...cat.portadas];
    const soloSecciones = process.env['FABLE_ALCANCE'] !== 'todo';
    const objetivo = (soloSecciones ? cat.secciones : todas).filter((s) => !s.parametrizada);

    const ojo = vigilar(page);
    await entrar(page, CUENTA);

    for (const seccion of objetivo) {
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        ojo.limpiar();

        // Un reintento antes de declarar NO-PINTA: la corrida del 2026-09-08
        // marco /glossary caido en uno de cinco viewports y pintaba 3 de 3 en
        // una sonda dirigida. Sin esto la matriz miente hacia el rojo.
        let pinta = false;
        for (let intento = 0; intento < 2 && !pinta; intento++) {
          try {
            await irA(page, seccion.ruta);
            await estable(page);
            pinta = await tieneContenido(page);
          } catch {
            pinta = false;
          }
        }

        const urlFinal = new URL(page.url()).pathname;
        const desbordeX = pinta ? await desbordeHorizontal(page) : 0;
        const defectos: string[] = [];
        if (!pinta) defectos.push('NO-PINTA');
        if (desbordeX > 0) defectos.push(`RESP-OVERFLOW:${desbordeX}px`);
        if (ojo.erroresDeConsola.length) defectos.push('CONSOLA');
        if (ojo.peticionesFallidas.length) defectos.push('RED');
        if (urlFinal !== seccion.ruta) defectos.push(`REDIRIGE:${urlFinal}`);

        let captura: string | null = null;
        if (defectos.length) {
          const carpeta = join(SALIDA, seccion.ruta.replace(/^\//, '').replace(/\//g, '_') || 'raiz');
          mkdirSync(carpeta, { recursive: true });
          captura = join(carpeta, `${vp.nombre}.png`);
          await page.screenshot({ path: captura, fullPage: true });
        }

        mediciones.push({
          ruta: seccion.ruta,
          urlFinal,
          componente: seccion.componente,
          estado: seccion.estado,
          viewport: vp.nombre,
          pinta,
          desbordeX,
          erroresDeConsola: [...ojo.erroresDeConsola],
          peticionesFallidas: [...ojo.peticionesFallidas],
          defectos,
          captura,
        });
      }
    }

    mkdirSync(SALIDA, { recursive: true });
    writeFileSync(
      join(SALIDA, 'mediciones.json'),
      JSON.stringify(
        {
          capturadoEl: new Date().toISOString(),
          cuenta: CUENTA.identificador,
          viewports: VIEWPORTS.map((v) => v.nombre),
          rutas: objetivo.length,
          mediciones,
        },
        null,
        2,
      ) + '\n',
      'utf8',
    );

    const conDefecto = mediciones.filter((m) => m.defectos.length);
    console.log(`[fable] ${mediciones.length} mediciones · ${conDefecto.length} con defecto`);
  });
});
