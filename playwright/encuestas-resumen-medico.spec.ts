import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, esperarAplicacionLista, irA } from './support/sesion';

/**
 * «Cómo le va» (el resumen general del médico) y la asociación de una encuesta
 * a un servicio con un selector real.
 *
 * Corre contra el **backend simulado** (`ng serve --configuration
 * development,demo`), con la cuenta de la médica. Recorre:
 *
 *   1. Pestaña «Encuestas» de Formularios: el bloque «Cómo le va» sobre la lista.
 *   2. Cambiar de período (Este mes → 12 meses; el de abertura es «3 meses»): sólo
 *      presets de meses calendario, nunca rangos libres; cambia la petición y las cifras.
 *   3. Cambiar de servicio: la petición lleva `serviceId`; un servicio con pocas
 *      respuestas se marca «pocas respuestas» sin esconderse; uno sin envíos
 *      muestra el vacío con su próxima acción.
 *   4. Abrir la ficha de una encuesta publicada y asociarla a un servicio:
 *      UI → request (`POST /surveys/assignments`) → response (201) → persistencia
 *      (la ficha relee y lo muestra POR NOMBRE) → recarga de la página → UI.
 *   5. Repetir la asociación: el 409 se dice junto al selector.
 *
 * Nunca espera `networkidle`: contra `ng serve` con HMR no llega. Se espera por
 * elementos y por respuestas concretas.
 *
 * Las capturas (claro y oscuro; 1440 y 390 px) se guardan en `SALIDA`.
 */

const SALIDA = join('docs', 'frontend', 'evidence', 'encuestas-resumen-medico-mockup-2026-10-28');

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

type Tema = 'claro' | 'oscuro';

async function aplicarTema(page: Page, tema: Tema): Promise<void> {
  await page.evaluate((t) => {
    const raiz = document.documentElement;
    raiz.setAttribute('data-theme', t === 'oscuro' ? 'dark' : 'light');
    raiz.setAttribute('data-tema', t);
  }, tema);
}

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(SALIDA, { recursive: true });
  // La cabecera es `sticky`: en una captura de página entera queda flotando a
  // mitad de la imagen y tapa contenido. Se suelta sólo para la foto.
  const estilo = await page.addStyleTag({
    content: '.app-header { position: static !important; } * { scroll-behavior: auto !important; }',
  });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    for (const el of Array.from(document.querySelectorAll('*'))) {
      if (el.scrollTop > 0) el.scrollTop = 0;
    }
  });
  await page.screenshot({ path: join(SALIDA, `${nombre}.png`), fullPage: true });
  await estilo.evaluate((nodo) => (nodo as Element).remove());
}

/** Lo que el simulador atendió, según `window.__mockRequests` (no hay tráfico de red que escuchar). */
interface Atendida {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
}

async function atendidas(page: Page): Promise<readonly Atendida[]> {
  return page.evaluate(() => (window as unknown as { __mockRequests?: Atendida[] }).__mockRequests ?? []);
}

/** Las lecturas de `GET /surveys/insights` hechas hasta ahora, con sus parámetros. */
async function pedidosDeInsights(page: Page): Promise<readonly URL[]> {
  return (await atendidas(page))
    .filter((r) => r.method === 'GET' && r.url.startsWith('/surveys/insights'))
    .map((r) => new URL(r.url, 'http://simulador.local'));
}

/** El número grande de una tarjeta de cifra. */
async function cifra(page: Page, kpi: string): Promise<string> {
  const valor = page.getByTestId(`kpi-${kpi}`).locator('.metric-card__value');
  return ((await valor.textContent()) ?? '').trim();
}

/**
 * Hace algo que cambia el filtro y espera a que el resumen NUEVO esté pintado.
 *
 * Sin esto la espera pasa de largo: justo después del clic todavía se ve el
 * resumen anterior, sin esqueleto, y «asentado» daba verde sobre datos viejos.
 */
async function cambiandoElFiltro(page: Page, accion: () => Promise<void>): Promise<void> {
  const antes = (await pedidosDeInsights(page)).length;
  await accion();
  await expect.poll(async () => (await pedidosDeInsights(page)).length, { timeout: 15_000 }).toBeGreaterThan(antes);
  await resumenAsentado(page);
}

/** Espera a que el resumen termine de cargar (contenido, suprimido o vacío) y no haya esqueleto. */
async function resumenAsentado(page: Page): Promise<void> {
  await expect(page.getByTestId('resumen-cargando')).toHaveCount(0, { timeout: 20_000 });
  await expect(
    page.getByTestId('resumen-contenido').or(page.getByTestId('resumen-vacio')).or(page.getByTestId('resumen-suprimido')),
  ).toBeVisible();
}

/** Elige una opción de un `app-select` (en `mockup` es el `<select>` nativo o, si es buscable, su panel de búsqueda). */
async function elegirOpcion(page: Page, contenedor: string, nombre: string | RegExp): Promise<void> {
  const campo = page.getByTestId(contenedor);
  const buscable = campo.locator('button.searchable-display');
  if ((await buscable.count()) > 0) {
    await buscable.click();
    await campo.locator('li.select-search-item').filter({ hasText: nombre }).first().click();
    return;
  }
  await campo.locator('select.native-select').selectOption({ label: String(nombre) });
}

test.describe('Encuestas · «Cómo le va» y asociar a un servicio', () => {
  test('resumen general, filtros, ficha y asociación que sobrevive a recargar', async ({ page }) => {
    test.setTimeout(4 * 60_000);
    await page.setViewportSize({ width: 1440, height: 900 });

    await entrar(page, MEDICA);
    await irA(page, '/questionnaires');

    // ── 1. El bloque «Cómo le va» está ARRIBA de la lista ──────────────────────
    const bloque = page.getByTestId('resumen-medico');
    await expect(bloque).toBeVisible({ timeout: 30_000 });
    await resumenAsentado(page);
    await expect(page.getByTestId('resumen-kpis')).toBeVisible();

    const arriba = await bloque.boundingBox();
    const lista = await page.getByTestId('encuestas-lista').boundingBox();
    expect(arriba!.y).toBeLessThan(lista!.y);

    // Las cinco cifras y el desglose del NPS, con el n siempre a la vista.
    for (const kpi of ['respuestas', 'tasa', 'nps', 'satisfaccion', 'alertas']) {
      await expect(page.getByTestId(`kpi-${kpi}`)).toBeVisible();
    }
    await expect(page.getByTestId('kpi-nps')).toContainText(/n\s=\s\d+/);
    await expect(page.getByTestId('resumen-nps-desglose')).toContainText('Promotores');
    await expect(page.getByTestId('resumen-nps-desglose')).toContainText('Detractores');

    // Primer pedido: los últimos 3 meses calendario, sin serviceId y sin horas.
    const rango = (u: URL): { meses: number; from: string; to: string } => {
      const from = u.searchParams.get('from')!;
      const to = u.searchParams.get('to')!;
      // Meses calendario completos: día 1 hasta el último día del mes.
      expect(from).toMatch(/^\d{4}-\d{2}-01$/);
      const [ta, tm, td] = to.split('-').map(Number) as [number, number, number];
      expect(td).toBe(new Date(ta, tm, 0).getDate());
      const [fa, fm] = from.split('-').map(Number) as [number, number];
      return { meses: (ta - fa) * 12 + (tm - fm) + 1, from, to };
    };
    const inicial = await pedidosDeInsights(page);
    expect(inicial.length).toBeGreaterThan(0);
    const primero = inicial[0]!;
    expect(primero.searchParams.has('serviceId')).toBe(false);
    expect(rango(primero).meses).toBe(3);

    // Los comentarios van sin fecha ni mes y sin orden: sólo el texto.
    const comentarios = page.getByTestId('resumen-comentarios');
    await expect(comentarios).toContainText('Comentarios del período');
    expect(await comentarios.locator('.comentario').count()).toBeGreaterThanOrEqual(5);
    const textoComentarios = ((await comentarios.textContent()) ?? '').replace(/\s+/g, ' ');
    expect(textoComentarios).not.toMatch(/\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\b/i);
    expect(textoComentarios).not.toMatch(/\d{4}/);

    const respuestas3m = Number(await cifra(page, 'respuestas'));
    await capturar(page, '01-resumen-claro-1440');

    // ── 2. Cambiar el período: sólo tres presets, nunca rangos libres ──────────
    await expect(page.getByTestId('resumen-periodo').getByRole('radio')).toHaveText(['Este mes', '3 meses', '12 meses']);
    await cambiandoElFiltro(page, () => page.getByTestId('resumen-periodo').getByRole('radio', { name: 'Este mes' }).click());
    const traMes = await pedidosDeInsights(page);
    expect(rango(traMes[traMes.length - 1]!).meses).toBe(1);
    const respuestasMes = Number(await cifra(page, 'respuestas'));
    expect(respuestasMes).toBeLessThanOrEqual(respuestas3m);
    await capturar(page, '02-resumen-este-mes-claro-1440');

    await cambiandoElFiltro(page, () => page.getByTestId('resumen-periodo').getByRole('radio', { name: '12 meses' }).click());
    const tras12 = await pedidosDeInsights(page);
    expect(rango(tras12[tras12.length - 1]!).meses).toBe(12);
    const respuestas12m = Number(await cifra(page, 'respuestas'));
    expect(respuestas12m).toBeGreaterThanOrEqual(respuestas3m);
    expect(respuestas12m).toBeGreaterThanOrEqual(30);
    await capturar(page, '03-resumen-12-meses-claro-1440');

    // ── 3. Cambiar el servicio ─────────────────────────────────────────────────
    await cambiandoElFiltro(page, () => elegirOpcion(page, 'resumen-servicio', 'Prueba de esfuerzo'));
    const traServicio = await pedidosDeInsights(page);
    const delServicio = traServicio[traServicio.length - 1]!;
    expect(delServicio.searchParams.get('serviceId')).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
    // Menos de 5 respuestas: el servidor devuelve SÓLO los totales y la pantalla
    // lo dice (privacidad), sin dibujar gráficos vacíos que parezcan un resultado.
    const suprimida = (await atendidas(page)).filter((r) => r.url.startsWith('/surveys/insights')).pop()!;
    expect(suprimida.status).toBe(200);
    await expect(page.getByTestId('resumen-suprimido')).toBeVisible();
    await expect(page.getByTestId('resumen-suprimido-aviso')).toContainText('Todavía no hay suficientes respuestas para mostrar el resumen');
    await expect(page.getByTestId('resumen-suprimido-aviso')).toContainText('se necesitan al menos 5');
    await expect(page.getByTestId('resumen-suprimido-aviso')).toContainText('proteger la privacidad de sus pacientes');
    await expect(page.getByTestId('resumen-suprimido-aviso')).toContainText('llevan 2');
    await expect(page.getByTestId('kpi-respuestas')).toBeVisible();
    await expect(page.getByTestId('kpi-nps')).toHaveCount(0);
    for (const seccion of ['resumen-nps', 'resumen-preguntas', 'resumen-tendencia', 'resumen-comentarios']) {
      await expect(page.getByTestId(seccion)).toHaveCount(0);
    }
    await capturar(page, '04-suprimido-privacidad-claro-1440');

    // Su acción amplía el alcance: con todas las consultas el resumen sale completo.
    await cambiandoElFiltro(page, () => page.getByTestId('resumen-suprimido-accion').click());

    await cambiandoElFiltro(page, () => elegirOpcion(page, 'resumen-servicio', 'Electrocardiograma'));
    await expect(page.getByTestId('kpi-respuestas')).toBeVisible();
    expect(Number(await cifra(page, 'respuestas'))).toBeLessThan(respuestas12m);
    await capturar(page, '05-servicio-electrocardiograma-claro-1440');

    // Un servicio con 6 respuestas: el resumen sale, pero lo que tiene menos de 5
    // llega suprimido por el servidor y se dice «sin datos suficientes» (no un
    // cero, no un hueco): el NPS, tres preguntas y los comentarios.
    await cambiandoElFiltro(page, () => elegirOpcion(page, 'resumen-servicio', 'Ecocardiograma Doppler'));
    await expect(page.getByTestId('resumen-contenido')).toBeVisible();
    await expect(page.getByTestId('kpi-nps')).toContainText('Sin datos suficientes');
    await expect(page.getByTestId('resumen-nps-sin-datos')).toContainText('al menos 5 respuestas');
    expect(await page.getByTestId('resumen-pregunta-suprimida').count()).toBeGreaterThan(0);
    await expect(page.getByTestId('resumen-pregunta-suprimida').first()).toContainText('Sin datos suficientes');
    await expect(page.getByTestId('resumen-comentarios-reservados')).toContainText('al menos 5 comentarios');
    await expect(page.locator('.comentario')).toHaveCount(0);
    await capturar(page, '05b-sin-datos-suficientes-claro-1440');

    // Un servicio sin envíos: vacío con próxima acción (S3).
    await cambiandoElFiltro(page, () => page.getByTestId('resumen-periodo').getByRole('radio', { name: 'Este mes' }).click());
    await cambiandoElFiltro(page, () => elegirOpcion(page, 'resumen-servicio', 'Teleconsulta cardiológica'));
    await expect(page.getByTestId('resumen-vacio')).toContainText('Todavía no recibió respuestas');
    await expect(page.getByTestId('resumen-vacio')).toContainText('se envían solas al terminar cada consulta');
    await expect(page.getByTestId('resumen-vacio-accion')).toBeVisible();
    await capturar(page, '06-vacio-claro-1440');

    // La acción del vacío afloja el filtro y trae datos.
    await cambiandoElFiltro(page, () => page.getByTestId('resumen-vacio-accion').click());

    // Vuelta a «Todas mis consultas».
    await cambiandoElFiltro(page, () => elegirOpcion(page, 'resumen-servicio', 'Todas mis consultas'));
    await expect(page.getByTestId('resumen-contenido')).toBeVisible();

    // ── Modo oscuro ────────────────────────────────────────────────────────────
    await aplicarTema(page, 'oscuro');
    await capturar(page, '07-resumen-oscuro-1440');
    await aplicarTema(page, 'claro');

    // ── 4. La ficha de una encuesta publicada ──────────────────────────────────
    await page.getByRole('link', { name: 'Abrir: Experiencia de teleconsulta' }).click();
    await expect(page.getByTestId('asignacion-servicio')).toBeVisible({ timeout: 30_000 });

    // Hoy está asociada a la teleconsulta cardiológica, dicho POR NOMBRE.
    const vigentes = page.getByTestId('asignacion-vigentes');
    await expect(vigentes).toContainText('Teleconsulta cardiológica');
    await expect(vigentes).not.toContainText(/[0-9a-f]{8}-[0-9a-f]{4}-/i);
    await expect(page.getByTestId('asignacion-vigente')).toHaveCount(1);
    await capturar(page, '08-ficha-asociada-hoy-claro-1440');

    // Ya no hay un campo de texto para pegar un UUID.
    await expect(page.getByTestId('asignacion-servicio').locator('input[type="text"]')).toHaveCount(0);

    // UI → request → response.
    await elegirOpcion(page, 'asignacion-servicio', 'Electrocardiograma');
    await page.getByTestId('asignacion-guardar').click();
    await expect(page.getByTestId('asignacion-vigente')).toHaveCount(2);
    const posts = (await atendidas(page)).filter((r) => r.method === 'POST' && r.url === '/surveys/assignments');
    expect(posts).toHaveLength(1);
    const cuerpo = posts[0]!.body as { surveyVersionId: string; targetType: string; targetId: string };
    expect(cuerpo.targetType).toBe('SERVICE');
    // Lo que viaja es un id, no el texto del selector.
    expect(cuerpo.targetId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(cuerpo.surveyVersionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
    expect(posts[0]!.status).toBe(201);

    // Persistencia: la ficha relee y muestra las dos, por nombre.
    await expect(vigentes).toContainText('Electrocardiograma');
    await expect(vigentes).toContainText('Teleconsulta cardiológica');
    await capturar(page, '09-ficha-recien-asociada-claro-1440');

    // Recarga completa de la página → UI.
    await page.reload();
    await esperarAplicacionLista(page);
    await expect(page.getByTestId('asignacion-vigentes')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('asignacion-vigentes')).toContainText('Electrocardiograma');
    await expect(page.getByTestId('asignacion-vigente')).toHaveCount(2);

    // ── 5. Repetir lo mismo: 409, dicho junto al selector ───────────────────────
    await elegirOpcion(page, 'asignacion-servicio', 'Electrocardiograma');
    await page.getByTestId('asignacion-guardar').click();
    await expect(page.getByTestId('asignacion-error')).toContainText('Ya existe una asignación activa');
    const repetidas = (await atendidas(page)).filter((r) => r.method === 'POST' && r.url === '/surveys/assignments');
    expect(repetidas.map((r) => r.status)).toEqual([409]);
    await expect(page.getByTestId('asignacion-servicio')).toBeVisible();
    await capturar(page, '10-ficha-conflicto-claro-1440');

    // «Todas mis consultas» también es una opción real.
    const selector = page.getByTestId('asignacion-servicio');
    const buscable = selector.locator('button.searchable-display');
    if ((await buscable.count()) > 0) {
      await buscable.click();
      await expect(selector.locator('li.select-search-item').filter({ hasText: 'Todas mis consultas' })).toBeVisible();
      await page.keyboard.press('Escape');
    } else {
      await expect(selector.locator('select.native-select option', { hasText: 'Todas mis consultas' })).toHaveCount(1);
    }

    // ── 6. Celular, claro y oscuro ──────────────────────────────────────────────
    await page.setViewportSize({ width: 390, height: 844 });
    await capturar(page, '11-ficha-claro-390');
    await aplicarTema(page, 'oscuro');
    await capturar(page, '12-ficha-oscuro-390');
    await aplicarTema(page, 'claro');

    await irA(page, '/questionnaires');
    await expect(page.getByTestId('resumen-medico')).toBeVisible({ timeout: 30_000 });
    await resumenAsentado(page);
    await capturar(page, '13-resumen-claro-390');
    await aplicarTema(page, 'oscuro');
    await capturar(page, '14-resumen-oscuro-390');

    // El estado suprimido también en el celular, claro y oscuro.
    await aplicarTema(page, 'claro');
    await cambiandoElFiltro(page, () => page.getByTestId('resumen-periodo').getByRole('radio', { name: '12 meses' }).click());
    await cambiandoElFiltro(page, () => elegirOpcion(page, 'resumen-servicio', 'Prueba de esfuerzo'));
    await expect(page.getByTestId('resumen-suprimido')).toBeVisible();
    await capturar(page, '15-suprimido-claro-390');
    await aplicarTema(page, 'oscuro');
    await capturar(page, '16-suprimido-oscuro-390');

    // Ningún desborde horizontal en el celular.
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde).toBeLessThanOrEqual(1);
    await aplicarTema(page, 'claro');
  });
});
