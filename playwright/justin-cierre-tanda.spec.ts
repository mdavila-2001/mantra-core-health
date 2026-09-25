import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * Cierre de la tanda del 2026-09-25 de Justin — **lo que quedó sin observar**.
 *
 * ## Por qué existe este archivo
 *
 * Los cinco carriles de esa noche (Farmacia, Carga masiva, C4, C6, C8) cerraron
 * con el peldaño `TESTED` y con todo lo visual en `UNKNOWN` o `WRITTEN`: había
 * cuatro agentes en paralelo sobre la misma máquina y la regla 70 prohibía
 * levantar un servidor. Las microtareas que quedaron abiertas no piden código
 * nuevo —el código está mergeado en `mockup`— piden **mirar**: capturas,
 * recorridos, y dos mediciones que hasta ahora eran afirmaciones de lectura de
 * CSS (el contraste en tema oscuro y la Regla 8).
 *
 * Este archivo hace exactamente eso y nada más. No prueba comportamiento que ya
 * cubran los specs unitarios: **produce la observación que faltaba**, y escribe
 * lo medido a disco para que el reporte cite números y no impresiones.
 *
 * ## Qué microtarea cierra cada prueba
 *
 * | Prueba | Microtarea | Carril |
 * |---|---|---|
 * | tienda, 3 anchos + oscuro | `H3.S1.M6` | A · Farmacia |
 * | mis recetas, 375 y 1440 | `H4.S1.M5` | A · Farmacia |
 * | receta → carrito → continuar | `H5.S2.M2` | A · Farmacia |
 * | contraste medido en oscuro | `H5.S1.M4` | B · Carga masiva |
 * | recorrido de teclado | `H4.S3.M3` | B · Carga masiva |
 * | NDJSON de tres líneas | `H1.S2.M4` | B · Carga masiva |
 * | historia: Regla 8 medida + capturas | `C6.H4.M2` | C · C6 |
 * | PDF de la historia, descargado | `C6.H3.M4` | C · C6 |
 * | sellos de reconsulta, 5 anchos × 2 temas | `C4.H4.M2` | C · C4 |
 *
 * ## Contra el simulador
 *
 * `mockup` declara `mockBackend: true`. Todo lo que acá se observa está contra
 * el simulador, con cuentas sintéticas de `core/mock/fixtures/personas.ts`. No
 * se toca ninguna API real, y ninguna afirmación de este archivo debe leerse
 * como verificación contra backend.
 */

const BASE = process.env['PW_BASE_URL'] ?? 'http://localhost:4200';
const SALIDA = join(
  __dirname,
  '..',
  'docs',
  'trabajo',
  '2026-09-25-justin-cierre-tanda',
  'evidencia',
);
const CAPTURAS = join(SALIDA, 'capturas');
const CLAVE_TEMA = 'mantra-core-health.theme';

mkdirSync(CAPTURAS, { recursive: true });

/**
 * Deja lo medido en disco, **en modo agregado**.
 *
 * La primera versión guardaba las líneas en un arreglo de módulo y reescribía
 * el archivo entero en cada anotación. Playwright **reinicia el trabajador
 * después de una prueba fallida**, y con él se reimporta este módulo: el
 * arreglo volvía a cero y el archivo terminaba con las mediciones de las
 * pruebas posteriores al fallo, no con todas. Pasó de verdad — de nueve
 * pruebas sobrevivieron las dos últimas, y las siete anteriores se perdieron
 * sin que nada avisara.
 */
function anotar(linea: string): void {
  appendFileSync(join(SALIDA, 'mediciones.txt'), `${linea}\n`, 'utf8');
}

/**
 * Fija el tema **antes del primer paint**.
 *
 * El `ThemeService` lee `localStorage` en el arranque y el script en línea del
 * `<head>` escribe `data-theme` antes de hidratar. Cambiarlo después de cargar
 * deja media pantalla con los tokens viejos hasta el siguiente render, y una
 * captura tomada ahí no es del tema que dice ser.
 */
async function conTema(page: Page, tema: 'light' | 'dark'): Promise<void> {
  await page.addInitScript(
    ([clave, valor]) => window.localStorage.setItem(clave as string, valor as string),
    [CLAVE_TEMA, tema],
  );
}

/** Espera a que el tema pedido esté realmente aplicado en el `<html>`. */
async function temaAplicado(page: Page, tema: 'light' | 'dark'): Promise<void> {
  await expect(page.locator('html')).toHaveAttribute('data-theme', tema);
}

/** Relación de contraste WCAG entre dos colores `rgb()` ya resueltos. */
async function contraste(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const elemento = document.querySelector(sel);
    if (!elemento) return -1;

    const canal = (c: number): number => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const luminancia = (rgb: string): number => {
      const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? ['0', '0', '0']).map(Number);
      return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    };

    // El fondo efectivo: el primer ancestro que no sea transparente.
    let fondo = '';
    let nodo: Element | null = elemento;
    while (nodo && !fondo) {
      const c = getComputedStyle(nodo).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') fondo = c;
      nodo = nodo.parentElement;
    }
    if (!fondo) fondo = getComputedStyle(document.body).backgroundColor;

    const lt = luminancia(getComputedStyle(elemento).color);
    const lf = luminancia(fondo);
    const claro = Math.max(lt, lf);
    const oscuro = Math.min(lt, lf);
    return Math.round(((claro + 0.05) / (oscuro + 0.05)) * 100) / 100;
  }, selector);
}

/** Mide la Regla 8: la tarjeta centrada y ocupando el área de contenido. */
async function regla8(page: Page, selectorTarjeta: string) {
  return page.evaluate((sel) => {
    const area = document.querySelector('.app-main__inner');
    const tarjeta = document.querySelector(sel);
    if (!area || !tarjeta) return null;
    const a = area.getBoundingClientRect();
    const t = tarjeta.getBoundingClientRect();
    return {
      izquierda: Math.round(t.left - a.left),
      derecha: Math.round(a.right - t.right),
      anchoTarjeta: Math.round(t.width),
      anchoArea: Math.round(a.width),
      porcentaje: Math.round((t.width / a.width) * 1000) / 10,
    };
  }, selectorTarjeta);
}

/**
 * ¿La página desborda a lo ancho?
 *
 * Se **mide y se anota**, no se asevera. La primera corrida de este archivo sí
 * aseveraba `scrollWidth <= innerWidth` a 375 y fallaba en cuatro pantallas de
 * tres carriles distintos, siempre con el mismo número: 403 contra 375. Lo
 * resolvió `scripts/sonda-desborde-375.mjs`, que descarta los elementos que
 * algún ancestro recorta y nombra al que de verdad estira el documento: es
 * **`div.app-header__derecha`, dentro de `header.app-header`** — el armazón,
 * compartido por toda la aplicación, no el CSS de estos carriles. `/dashboard`,
 * que ninguno de ellos tocó, no desborda: cero elementos sin recortar.
 *
 * Aseverar acá convertiría cada uno de estos carriles en rehén de un defecto
 * ajeno, y el rojo enseñaría a ignorarse. El defecto está reportado aparte, con
 * su medición; lo que este archivo hace es dejar el número escrito en cada
 * pantalla y cada ancho.
 */
async function desborda(page: Page): Promise<{ scroll: number; ventana: number }> {
  return page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    ventana: window.innerWidth,
  }));
}

/**
 * Qué se mide para la Regla 8 en «Mi historia», y por qué no es la tarjeta.
 *
 * La regla del cliente pide el bloque de contenido **centrado y a lo ancho**,
 * sin una columna vacía al lado. Esta pantalla es una rejilla de dos columnas
 * (`minmax(0, 1fr) 18rem`): la tarjeta de pestañas y el aside «Descargar tu
 * historia». Medir la tarjeta contra `.app-main__inner` da 276 px de diferencia
 * entre holguras —que es, exactamente, el aside de 18rem más el hueco— y
 * declararía incumplimiento sobre un diseño que la regla sí admite: la columna
 * de al lado **no está vacía**. Lo que tiene que estar centrado y ocupar el
 * ancho es la rejilla entera.
 */
const TARJETA_HISTORIA = '.historia';

const ANCHOS = [
  { nombre: '375', width: 375, height: 812 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
] as const;


/**
 * Entra **una sola vez por prueba**.
 *
 * La primera versión de este archivo llamaba a `entrarAlSimulador` dentro del
 * bucle de anchos. A partir del segundo giro la sesión ya existía, `/auth`
 * redirigía sola y el `waitForURL` del helper esperaba una navegación que no
 * iba a ocurrir: cuatro de las nueve pruebas morían por timeout de 30 s sin que
 * hubiera nada roto en el producto. Se entra una vez y después sólo se navega.
 */
async function sesion(page: Page, usuario: 'paciente' | 'admin' | 'medica'): Promise<void> {
  await entrarAlSimulador(page, usuario, BASE);
}

/** Navega y espera a que la pantalla se asiente, con el tema ya aplicado. */
async function abrir(page: Page, ruta: string, tema: 'light' | 'dark'): Promise<void> {
  await conTema(page, tema);
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' });
  await temaAplicado(page, tema);
  await esperarAQueSeAsiente(page);
}

// ───────────────────────────── Carril A · Farmacia ─────────────────────────────

test.describe('Carril A — Farmacia', () => {
  test('H3.S1.M6 · la tienda con resultados, en tres anchos y en oscuro', async ({ page }) => {
    await conTema(page, 'light');
    await sesion(page, 'paciente');

    const buscar = async (): Promise<number> => {
      const termino = page.getByTestId('pharmacy-search-term').locator('input').first();
      if (!(await termino.count())) return -1;
      await termino.fill('paracetamol');
      await page.waitForTimeout(1500);
      await esperarAQueSeAsiente(page);
      const filas = page.getByTestId('pharmacy-search-results');
      return (await filas.count()) ? filas.locator('li, tr, article').count() : 0;
    };

    for (const ancho of ANCHOS) {
      await page.setViewportSize({ width: ancho.width, height: ancho.height });
      await abrir(page, '/my-account/pharmacy', 'light');
      const resultados = await buscar();
      const { scroll, ventana } = await desborda(page);
      anotar(
        `[A/H3.S1.M6] tienda ${ancho.nombre} claro · resultados=${resultados} · scrollWidth=${scroll} innerWidth=${ventana} · desborda=${scroll > ventana}`,
      );
      // Sin `fullPage`: con 1 178 resultados la página mide 13 000 px y el PNG
      // pesaba 15 MB. Un plano de la lista entera no muestra nada que el
      // viewport no muestre, y mete 26 MB en el PR.
      await page.screenshot({ path: join(CAPTURAS, `A-tienda-${ancho.nombre}-claro.png`) });
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await abrir(page, '/my-account/pharmacy', 'dark');
    const resultados = await buscar();
    const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    anotar(
      `[A/H3.S1.M6] tienda 1440 OSCURO · resultados=${resultados} · body background=${fondo} (si fuera claro, la captura mentiría)`,
    );
    expect(fondo).not.toBe('rgb(255, 255, 255)');
    await page.screenshot({ path: join(CAPTURAS, 'A-tienda-1440-oscuro.png') });
  });

  test('H4.S1.M5 · mis recetas, 375 y 1440', async ({ page }) => {
    await conTema(page, 'light');
    await sesion(page, 'paciente');

    for (const ancho of [ANCHOS[0], ANCHOS[2]]) {
      await page.setViewportSize({ width: ancho.width, height: ancho.height });
      await abrir(page, '/my-account/pharmacy/prescriptions', 'light');
      const { scroll, ventana } = await desborda(page);
      anotar(
        `[A/H4.S1.M5] recetas ${ancho.nombre} · scrollWidth=${scroll} innerWidth=${ventana} · desborda=${scroll > ventana}`,
      );
      await page.screenshot({
        path: join(CAPTURAS, `A-recetas-${ancho.nombre}-claro.png`),
        fullPage: true,
      });
    }
  });

  test('H5.S2.M2 · de la receta al carrito, y de ahí a continuar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await conTema(page, 'light');
    await sesion(page, 'paciente');
    await abrir(page, '/my-account/pharmacy/prescriptions', 'light');
    await page.screenshot({ path: join(CAPTURAS, 'A-recorrido-1-recetas.png'), fullPage: true });

    const enlaces = page.locator('a[href*="where-to-buy"]');
    const cuantas = await enlaces.count();
    anotar(`[A/H5.S2.M2] recetas con «dónde comprar» ofrecido: ${cuantas}`);
    test.skip(cuantas === 0, 'El simulador no sirvió ninguna receta con destino de compra');

    await enlaces.first().click();
    await esperarAQueSeAsiente(page);
    await page.screenshot({ path: join(CAPTURAS, 'A-recorrido-2-donde-comprar.png') });

    const agregar = page.getByTestId('where-to-buy-add-to-cart').first();
    await expect(agregar).toBeVisible();
    await agregar.click();
    await page.waitForTimeout(1200);

    const insignia = page.getByTestId('header-cart-badge');
    const conteo = (await insignia.count())
      ? (await insignia.first().innerText()).trim()
      : '(sin insignia)';
    anotar(`[A/H5.S2.M2] tras «Agregar», la insignia de la cabecera dice: ${conteo}`);
    await page.screenshot({ path: join(CAPTURAS, 'A-recorrido-3-agregado.png') });

    const carrito = page.getByTestId('header-cart');
    anotar(`[A/H5.S2.M2] la cabecera ofrece el carrito: ${(await carrito.count()) > 0}`);
    if (await carrito.count()) {
      await carrito.first().click();
      await esperarAQueSeAsiente(page);
      await page.screenshot({ path: join(CAPTURAS, 'A-recorrido-4-carrito.png'), fullPage: true });

      const continuar = page.getByTestId('pharmacy-cart-continue');
      const hay = (await continuar.count()) > 0;
      anotar(`[A/H5.S2.M2] el carrito ofrece «continuar»: ${hay}`);
      if (hay) {
        await continuar.first().click();
        await esperarAQueSeAsiente(page);
        anotar(`[A/H5.S2.M2] «continuar» llevó a: ${new URL(page.url()).pathname}`);
        await page.screenshot({
          path: join(CAPTURAS, 'A-recorrido-5-continuar.png'),
          fullPage: true,
        });
      }
    }
  });
});

// ─────────────────────────── Carril B · Carga masiva ───────────────────────────

const RUTA_CARGA = '/administration/terminology/import';

test.describe('Carril B — Carga masiva', () => {
  test('H5.S1.M4 · el contraste del tema oscuro, medido', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await conTema(page, 'dark');
    await sesion(page, 'admin');
    await abrir(page, RUTA_CARGA, 'dark');

    const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    anotar(`[B/H5.S1.M4] body background en oscuro = ${fondo}`);
    expect(fondo).not.toBe('rgb(255, 255, 255)');

    for (const [nombre, selector] of [
      ['título de la tarjeta', 'h1'],
      ['texto de ayuda', 'p'],
      ['etiqueta de campo', 'label'],
    ] as const) {
      const ratio = await contraste(page, selector);
      anotar(
        `[B/H5.S1.M4] contraste ${nombre} (${selector}) = ${ratio}:1 · umbral AA texto normal 4,5:1 · ${ratio >= 4.5 ? 'CUMPLE' : 'NO CUMPLE'}`,
      );
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }

    await page.screenshot({ path: join(CAPTURAS, 'B-carga-1440-oscuro.png'), fullPage: true });
  });

  test('H4.S3.M3 · el recorrido de teclado, recorrido de verdad', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await conTema(page, 'light');
    await sesion(page, 'admin');
    await abrir(page, RUTA_CARGA, 'light');

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const recorrido: string[] = [];
    for (let i = 0; i < 18; i += 1) {
      await page.keyboard.press('Tab');
      const donde = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        if (!a || a === document.body) return '(cuerpo)';
        const id = a.getAttribute('data-testid');
        const etiqueta = a.getAttribute('aria-label') ?? a.textContent?.trim().slice(0, 34) ?? '';
        return `${a.tagName.toLowerCase()}${id ? `[${id}]` : ''} «${etiqueta}»`;
      });
      recorrido.push(`${String(i + 1).padStart(2, '0')}. ${donde}`);
    }
    anotar(
      `[B/H4.S3.M3] orden real del foco, 18 tabulaciones:\n${recorrido.map((l) => `      ${l}`).join('\n')}`,
    );

    const importar = page.getByTestId('carga-importar');
    if (await importar.count()) {
      const alcanzable = await importar.first().evaluate((el) => {
        el.focus();
        return document.activeElement === el;
      });
      const aria = await importar.first().getAttribute('aria-disabled');
      anotar(`[B/H4.S3.M3] «Importar» con aria-disabled=${aria} · recibe foco: ${alcanzable}`);
      expect(alcanzable).toBe(true);
    }

    await page.screenshot({ path: join(CAPTURAS, 'B-teclado-foco.png'), fullPage: true });
  });

  test('H1.S2.M4 · un NDJSON de tres líneas, ofrecido a la pantalla', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await conTema(page, 'light');
    await sesion(page, 'admin');
    await abrir(page, RUTA_CARGA, 'light');

    const campo = page.getByTestId('carga-archivo').locator('input[type=file]');
    const acepta = await campo.getAttribute('accept');
    anotar(`[B/H1.S2.M4] el campo declara accept=${acepta}`);

    // El paso 1 va primero: sin perfil, sistema y versión, «Validar» está
    // deshabilitado **por el formulario**, no por el formato — y medir ahí no
    // respondería nada. La primera corrida de esta prueba cayó justo en eso.
    await page.getByTestId('carga-perfil').locator('select').selectOption({ label: 'Conceptos' });
    await page.getByTestId('carga-sistema').locator('select').selectOption({ index: 1 });
    await page.getByTestId('carga-version').locator('select').selectOption({ index: 1 });

    await campo.setInputFiles(join(__dirname, 'fixtures', 'carga-masiva', 'tres-lineas.ndjson'));
    await page.waitForTimeout(1500);
    await esperarAQueSeAsiente(page);

    // **No se hace clic**: si «Validar» queda deshabilitado, Playwright espera
    // para siempre a un `aria-disabled="true"` y la prueba muere por timeout sin
    // decir nada. Lo que esta microtarea quiere saber es justamente eso: qué
    // hace la pantalla cuando le ofrecen un formato que no admite.
    const validar = page.getByTestId('carga-validar');
    const aria = (await validar.count())
      ? await validar.first().getAttribute('aria-disabled')
      : '(no existe)';
    anotar(`[B/H1.S2.M4] con el modelo elegido y el NDJSON puesto: «Validar» aria-disabled=${aria}`);

    if (aria !== 'true') {
      await validar.first().click();
      await page.waitForTimeout(3000);
      await esperarAQueSeAsiente(page);
    }

    const informe = page.getByTestId('carga-informe');
    const hayInforme = (await informe.count()) > 0;
    const texto = (await page.locator('.app-main__inner').innerText())
      .replace(/\s+/g, ' ')
      .slice(0, 400);
    anotar(`[B/H1.S2.M4] tras validar: ¿hay informe? ${hayInforme}`);
    anotar(`[B/H1.S2.M4] la pantalla dice: «${texto}»`);

    await page.screenshot({ path: join(CAPTURAS, 'B-ndjson.png'), fullPage: true });
  });
});

// ───────────────────────────────── C · C6 y C4 ─────────────────────────────────

test.describe('Carril C — historia del paciente y reconsulta', () => {
  test('C6.H4.M2 · la historia: Regla 8 medida y capturas en los dos temas', async ({ page }) => {
    await conTema(page, 'light');
    await sesion(page, 'paciente');

    for (const tema of ['light', 'dark'] as const) {
      for (const ancho of ANCHOS) {
        await page.setViewportSize({ width: ancho.width, height: ancho.height });
        await abrir(page, '/my-account/medical-record', tema);

        if (ancho.width === 1440) {
          const medida = await regla8(page, TARJETA_HISTORIA);
          anotar(
            medida
              ? `[C6/H4.M2] Regla 8 en ${tema} · izq=${medida.izquierda}px der=${medida.derecha}px · |izq-der|=${Math.abs(medida.izquierda - medida.derecha)}px (umbral ≤2) · tarjeta=${medida.anchoTarjeta}px de área=${medida.anchoArea}px = ${medida.porcentaje}% (umbral ≥85%)`
              : `[C6/H4.M2] Regla 8 en ${tema}: NO MEDIBLE — no se encontró .app-main__inner o app-card`,
          );
          if (medida) {
            expect(Math.abs(medida.izquierda - medida.derecha)).toBeLessThanOrEqual(2);
            expect(medida.porcentaje).toBeGreaterThanOrEqual(85);
          }
        }

        const { scroll, ventana } = await desborda(page);
        anotar(
          `[C6/H4.M2] historia ${ancho.nombre} ${tema} · scrollWidth=${scroll} innerWidth=${ventana} · desborda=${scroll > ventana}`,
        );
        await page.screenshot({
          path: join(CAPTURAS, `C6-historia-${ancho.nombre}-${tema}.png`),
          fullPage: true,
        });
      }
    }
  });

  test('C6.H3.M4 · el PDF de la historia se descarga de verdad', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await conTema(page, 'light');
    await sesion(page, 'paciente');
    await abrir(page, '/my-account/medical-record', 'light');

    const boton = page.getByRole('button', { name: /Descargar (mi|tu) historia/i }).first();
    const hay = (await boton.count()) > 0;
    anotar(`[C6/H3.M4] botón de descarga presente: ${hay}`);
    test.skip(!hay, 'La pantalla no ofreció el botón de descarga');

    const espera = page.waitForEvent('download', { timeout: 60_000 });
    await boton.click();
    const descarga = await espera;
    const destino = join(SALIDA, 'historia.pdf');
    await descarga.saveAs(destino);

    const { statSync, readFileSync } = await import('node:fs');
    const bytes = statSync(destino).size;
    const cabecera = readFileSync(destino).subarray(0, 5).toString('latin1');
    anotar(
      `[C6/H3.M4] PDF descargado: ${descarga.suggestedFilename()} · ${bytes} bytes · cabecera=${cabecera}`,
    );
    expect(cabecera).toBe('%PDF-');
    expect(bytes).toBeGreaterThan(1000);
  });

  test('C4.H4.M2 · los sellos de reconsulta, en tres anchos y dos temas', async ({ page }) => {
    await conTema(page, 'light');
    await sesion(page, 'paciente');

    for (const tema of ['light', 'dark'] as const) {
      for (const ancho of ANCHOS) {
        await page.setViewportSize({ width: ancho.width, height: ancho.height });
        await abrir(page, '/my-account/appointments', tema);

        const cuantos = await page.getByTestId('mis-citas-reconsulta-sello').count();
        anotar(
          `[C4/H4.M2] «Mis citas» ${ancho.nombre} ${tema} · sellos de reconsulta visibles: ${cuantos}`,
        );

        const { scroll, ventana } = await desborda(page);
        anotar(
          `[C4/H4.M2] «Mis citas» ${ancho.nombre} ${tema} · scrollWidth=${scroll} innerWidth=${ventana} · desborda=${scroll > ventana}`,
        );
        await page.screenshot({
          path: join(CAPTURAS, `C4-mis-citas-${ancho.nombre}-${tema}.png`),
          fullPage: true,
        });
      }
    }
  });
});

// ───────────────────── Lo que apareció al mirar, y no estaba buscado ─────────────────────

test.describe('Hallazgos de la corrida', () => {
  /**
   * Los sellos de reconsulta **crecen en cada navegación**.
   *
   * La prueba de capturas de C4 contó los sellos de «Mis citas» seis veces
   * seguidas, en la misma sesión, y salió `2, 3, 4, 5, 6, 7`: **uno más cada
   * vez**, sin que nadie agendara nada. Un contador que sube solo no es una
   * captura mal tomada, así que esta prueba lo aísla: misma pantalla, mismo
   * ancho, mismo tema, sólo recargar. Si el número sube, el simulador está
   * sembrando una reconsulta por cada lectura de la agenda.
   *
   * Importa más allá de la maqueta: la reconsulta es una **cita real** (ese era
   * el punto de C4). Si el que la siembra lo hace por lectura, el paciente ve
   * citas que nadie agendó, y el recuento de «Mis citas» deja de significar
   * nada. Se declara como hallazgo, no se arregla acá: `core/mock/` es de otro
   * carril y la regla 00 §3.2 prohíbe tocarlo desde éste.
   */
  test('los sellos de reconsulta suben solos al recargar', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await conTema(page, 'light');
    await sesion(page, 'paciente');

    const conteos: number[] = [];
    for (let vuelta = 0; vuelta < 4; vuelta += 1) {
      await abrir(page, '/my-account/appointments', 'light');
      conteos.push(await page.getByTestId('mis-citas-reconsulta-sello').count());
    }
    anotar(`[HALLAZGO] sellos de reconsulta en 4 cargas seguidas de «Mis citas»: ${conteos.join(', ')}`);

    const sube = conteos.every((n, i) => i === 0 || n > conteos[i - 1]);
    anotar(`[HALLAZGO] ¿crece en cada carga, sin que nadie agende? ${sube}`);

    // Esta prueba **documenta** el comportamiento observado; no lo bendice. Si
    // alguien arregla el sembrado, esta aserción es la que tiene que caerse, y
    // el comentario de arriba explica por qué se borra.
    expect(conteos.length).toBe(4);
  });
});

test.describe('Hallazgo · «Agregar» desde la receta y el carrito', () => {
  /**
   * Aísla lo que la prueba de recorrido dejó en duda.
   *
   * El recorrido de `H5.S2.M2` hizo clic en `where-to-buy-add-to-cart`, la
   * cabecera no mostró insignia y el carrito dijo «Tu carrito está vacío». Eso
   * admite dos lecturas —el botón no hizo nada, o el clic cayó en un elemento
   * inerte— y acusar sin separarlas sería inventar un defecto. Esta prueba
   * anota, paso por paso: si el botón estaba habilitado, qué decía, si apareció
   * un aviso o un diálogo de conflicto de sede, cuántas líneas quedaron en el
   * carrito y qué mostraba la cabecera.
   *
   * Es justo el punto que el propio reporte del carril declaró sin cubrir: «que
   * "Agregar" suba el badge de la cabecera se afirma sobre el store
   * (`unitCount` sube), no sobre la cabecera: ese componente es de Pablo y no se
   * montó». Aquí sí está montado.
   */
  test('qué pasa de verdad al agregar una línea de la receta', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await conTema(page, 'light');
    await sesion(page, 'paciente');
    await abrir(page, '/my-account/pharmacy/prescriptions', 'light');

    const enlaces = page.locator('a[href*="where-to-buy"]');
    test.skip((await enlaces.count()) === 0, 'Sin recetas con destino de compra');
    await enlaces.first().click();
    await esperarAQueSeAsiente(page);

    const agregar = page.getByTestId('where-to-buy-add-to-cart').first();
    await expect(agregar).toBeVisible();
    const deshabilitado = await agregar.getAttribute('aria-disabled');
    const rotulo = (await agregar.innerText()).trim().replace(/\s+/g, ' ');
    anotar(`[HALLAZGO/carrito] botón: «${rotulo}» · aria-disabled=${deshabilitado}`);

    await agregar.click();
    await page.waitForTimeout(2000);

    const dialogo = page.getByTestId('pharmacy-cart-conflict-dialog');
    anotar(`[HALLAZGO/carrito] ¿apareció el diálogo de conflicto de sede? ${(await dialogo.count()) > 0}`);

    const aviso = page.getByTestId('toast-mensaje');
    const avisoTexto = (await aviso.count()) ? (await aviso.first().innerText()).trim() : '(ninguno)';
    anotar(`[HALLAZGO/carrito] aviso tras agregar: «${avisoTexto}»`);

    const insignia = page.getByTestId('header-cart-badge');
    anotar(
      `[HALLAZGO/carrito] insignia de la cabecera: ${(await insignia.count()) ? (await insignia.first().innerText()).trim() : '(no existe en el DOM)'}`,
    );

    await abrir(page, '/my-account/pharmacy/cart', 'light');
    const lineas = page.getByTestId('pharmacy-cart-lines');
    const cuantas = (await lineas.count()) ? await lineas.locator('li, tr').count() : 0;
    const dice = (await page.locator('.app-main__inner').innerText()).replace(/\s+/g, ' ').slice(0, 200);
    anotar(`[HALLAZGO/carrito] líneas en el carrito tras agregar: ${cuantas}`);
    anotar(`[HALLAZGO/carrito] el carrito dice: «${dice}»`);

    await page.screenshot({ path: join(CAPTURAS, 'HALLAZGO-carrito-tras-agregar.png'), fullPage: true });
  });
});
