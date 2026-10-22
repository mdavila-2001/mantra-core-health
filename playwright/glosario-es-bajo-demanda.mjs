/**
 * Evidencia del glosario en castellano con carga bajo demanda (2026-09-30),
 * contra la maqueta.
 *
 * Qué mira, a 1440 y a 390 de ancho:
 *
 * 1. La rejilla de categorías con conteos del manifiesto (no de un arreglo en
 *    memoria) y la regla del cliente: fondo blanco, a lo ancho y centrado,
 *    sin desplazamiento lateral.
 * 2. Una lista paginada por el servidor: la página 2 de una categoría, con la
 *    lista que se desplaza sólo en vertical y el paginador abajo.
 * 3. La ficha de un medicamento de CIMA con foto: miniatura con atribución y
 *    licencia, y la pestaña «Medicamento» con fotos, presentaciones, vía,
 *    forma, ATC, secciones de la ficha técnica y la cita.
 *
 * También cuenta los pedidos de red: la maqueta tiene que bajar shards, no el
 * glosario entero.
 *
 * Uso: `node playwright/glosario-es-bajo-demanda.mjs [urlBase] [carpeta] [slugDeMedicamento]`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

import { conceptIdOf } from '../scripts/lib/glossary-shards.mjs';

const BASE = process.argv[2] ?? 'http://localhost:4231';
const SALIDA = process.argv[3] ?? 'docs/trabajo/2026-09-30-glosario-es/evidencia';
const MEDICAMENTO = process.argv[4] ?? 'cima-vtm-1039008';

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

/** Fondo, ancho y centrado del bloque principal respecto de `.app-main__inner` (§5). */
async function medirRegla(pagina, selector, etiqueta) {
  const medida = await pagina.evaluate((sel) => {
    const bloque = document.querySelector(sel);
    const area = document.querySelector('.app-main__inner') ?? document.body;
    if (bloque === null) return null;
    const b = bloque.getBoundingClientRect();
    const a = area.getBoundingClientRect();
    // El fondo que se ve detrás del bloque: el del primer antepasado que pinta.
    let nodo = bloque.parentElement;
    let fondo = 'rgba(0, 0, 0, 0)';
    while (nodo !== null) {
      const color = getComputedStyle(nodo).backgroundColor;
      if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') {
        fondo = color;
        break;
      }
      nodo = nodo.parentElement;
    }
    return {
      ancho: b.width / a.width,
      izquierda: b.left - a.left,
      derecha: a.right - b.right,
      // Lo que sobresale del propio bloque (el encabezado de la aplicación se
      // mide aparte: a 390 px ya desbordaba antes de este cambio).
      desbordeLateral: Math.max(0, Math.round(b.right - document.documentElement.clientWidth)),
      desbordeDeLaPagina: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      fondo,
    };
  }, selector);
  if (medida === null) {
    ok(`${etiqueta}: existe ${selector}`, false);
    return;
  }
  ok(`${etiqueta}: ocupa ≥ 85 % del área`, medida.ancho >= 0.85, `${(medida.ancho * 100).toFixed(1)} %`);
  ok(
    `${etiqueta}: centrado (holguras ≤ 2 px de diferencia)`,
    Math.abs(medida.izquierda - medida.derecha) <= 2,
    `${medida.izquierda.toFixed(1)} / ${medida.derecha.toFixed(1)} px`,
  );
  ok(
    `${etiqueta}: el bloque no se sale de la pantalla`,
    medida.desbordeLateral <= 0,
    `${medida.desbordeLateral} px (página: ${medida.desbordeDeLaPagina} px)`,
  );
  ok(`${etiqueta}: fondo blanco`, /255, 255, 255/.test(medida.fondo), medida.fondo);
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();

  for (const ancho of [1440, 390]) {
    const contexto = await navegador.newContext({
      viewport: { width: ancho, height: ancho === 1440 ? 1000 : 844 },
      colorScheme: 'light',
    });
    const pagina = await contexto.newPage();
    const errores = [];
    const pedidos = [];
    pagina.on('pageerror', (e) => errores.push(String(e)));
    pagina.on('request', (r) => {
      const url = r.url();
      if (url.includes('glossary-data/') || url.includes('glossary-seed/')) pedidos.push(url);
    });
    const capturar = (nombre, opciones = {}) =>
      pagina.screenshot({ path: `${SALIDA}/${nombre}-${ancho}.png`, ...opciones });

    await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
    await pagina.getByTestId('login-password').fill('mockup');
    await pagina.getByTestId('login-submit').click();
    await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
    if (pagina.url().includes('/auth/organization')) {
      await pagina.getByTestId('tenant-opcion').first().click();
      await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
    }

    /* ── 1 · Rejilla ─────────────────────────────────────────────────────── */
    await pagina.goto(`${BASE}/glossary`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await pagina.locator('.glosario__tarjeta').first().waitFor({ timeout: 60_000 });
    await pagina.locator('.glosario__entrada').first().waitFor({ timeout: 60_000 });
    const conteos = await pagina.locator('.glosario__dato').allTextContents();
    ok(`[${ancho}] la rejilla muestra conteos`, conteos.length > 0, conteos.slice(0, 3).join(' | ').replace(/\s+/g, ' '));
    const rango = (await pagina.locator('.pagination__range').textContent())?.trim();
    ok(`[${ancho}] el paginador conoce el total del servidor`, /de [\d.]+/.test(rango ?? ''), rango);
    await medirRegla(pagina, '.glosario', `[${ancho}] glosario`);
    await capturar('01-grilla');
    await capturar('01-grilla-completa', { fullPage: true });

    /* ── 2 · Lista paginada de una categoría ─────────────────────────────── */
    await pagina.goto(`${BASE}/glossary?category=glossary-category-disease`, {
      waitUntil: 'domcontentloaded',
      timeout: 180_000,
    });
    await pagina.locator('.glosario__entrada').first().waitFor({ timeout: 60_000 });
    const primera = await pagina.locator('.glosario__entrada-enlace').first().textContent();
    await pagina.getByRole('button', { name: /siguiente/i }).first().click();
    await pagina.waitForFunction(
      (anterior) =>
        document.querySelector('.glosario__entrada-enlace')?.textContent !== anterior,
      primera,
      { timeout: 60_000 },
    );
    const rangoDos = (await pagina.locator('.pagination__range').textContent())?.trim();
    ok(`[${ancho}] la página 2 viene del servidor`, /^13–24 de/.test(rangoDos ?? ''), rangoDos);
    const lista = await pagina.locator('#glosario-lista').evaluate((el) => ({
      overflowY: getComputedStyle(el).overflowY,
      overflowX: getComputedStyle(el).overflowX,
      lateral: el.scrollWidth - el.clientWidth,
    }));
    ok(
      `[${ancho}] la lista se desplaza sólo en vertical`,
      lista.overflowY === 'auto' && lista.overflowX === 'hidden' && lista.lateral <= 0,
      JSON.stringify(lista),
    );
    await pagina.locator('#glosario-cuerpo-titulo').scrollIntoViewIfNeeded();
    await capturar('02-lista-paginada');

    /* ── 3 · Ficha de medicamento con foto ───────────────────────────────── */
    await pagina.goto(`${BASE}/glossary/${conceptIdOf(MEDICAMENTO)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 180_000,
    });
    await pagina.locator('.termino__tarjeta').waitFor({ timeout: 60_000 });
    const foto = pagina.locator('.termino__imagen img');
    const tieneFoto = (await foto.count()) > 0;
    ok(`[${ancho}] la ficha muestra la foto`, tieneFoto);
    if (tieneFoto) {
      await foto.evaluate((img) =>
        img.complete ? null : new Promise((r) => img.addEventListener('load', r, { once: true })),
      );
      const credito = (await pagina.locator('.termino__imagen-atribucion').first().textContent())?.trim();
      ok(`[${ancho}] con atribución y licencia visibles`, /licencia/.test(credito ?? ''), credito?.replace(/\s+/g, ' '));
    }
    await medirRegla(pagina, '.termino__tarjeta', `[${ancho}] ficha`);
    await capturar('03-ficha-medicamento');
    await pagina.getByRole('tab', { name: 'Medicamento' }).click();
    const cita = (await pagina.getByTestId('termino-cita-cima').textContent())?.trim();
    ok(`[${ancho}] la ficha técnica se cita`, /^Fuente: CIMA \(AEMPS\), ficha técnica nº \d+/.test(cita ?? ''), cita);
    await pagina.waitForTimeout(800);
    // La ficha técnica verbatim mide miles de píxeles: se captura la pantalla
    // desde las pestañas, que es lo que se ve al abrir «Medicamento».
    await pagina.getByRole('tab', { name: 'Medicamento' }).evaluate((el) =>
      el.scrollIntoView({ block: 'start' }),
    );
    await capturar('04-ficha-medicamento-pestana');

    ok(`[${ancho}] sin errores de página`, errores.length === 0, errores.join(' | '));
    const pesados = pedidos.filter((u) => /glosario\.generated|anatomia/.test(u));
    ok(`[${ancho}] no baja el glosario entero`, pesados.length === 0, `${pedidos.length} archivos de shards pedidos`);
    await contexto.close();
  }

  await navegador.close();
  writeFileSync(`${SALIDA}/veredictos.json`, JSON.stringify(veredictos, null, 2));
  const fallas = veredictos.filter((v) => !v.cond);
  process.stdout.write(`\n${veredictos.length - fallas.length}/${veredictos.length} en verde\n`);
  process.exit(fallas.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
