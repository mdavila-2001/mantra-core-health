import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, esperarAplicacionLista, irA } from './support/sesion';

/**
 * «Cómo le va» (the practitioner's overall summary) in the read-only «Buzón»,
 * and reading the answers of one survey.
 *
 * Runs against the **mock backend** (`ng serve --configuration
 * development,demo`), with the doctor's account. It walks through:
 *
 *   1. The «Encuestas» tab of Formularios: the «Cómo le va» block above the list.
 *   2. Changing the period (Este mes → 12 meses; it opens on «3 meses»): only
 *      calendar-month presets, never free ranges; the request and the figures change.
 *   3. Changing the service: the request carries `serviceId`; a service with few
 *      answers is marked «pocas respuestas» without hiding; one with no sends
 *      shows the empty state with its next action.
 *   4. Read-only Buzón (06/11/2026): a hand-made survey is «anterior», without
 *      «Abrir»; «Ver respuestas» leads to its sheet, which reads (questionnaire
 *      and answers, `GET …/responses` → 200) without managing anything — free
 *      association no longer exists: the API rejects it —, survives a reload
 *      and points to «Encuestas por servicio».
 *
 * Never waits for the network to go quiet: against `ng serve` with HMR it never
 * does. It waits on elements and on concrete responses.
 *
 * The captures (light and dark; 1440 and 390 px; viewport only) go to `SALIDA`.
 */

const SALIDA = join('docs', 'frontend', 'evidence', 'encuestas-resumen-medico-2026-10-28');

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

/**
 * Viewport-only capture (a full-page one lets the side rail cover content),
 * without the demo chip, once fonts and icons are in and two frames painted
 * (transitions are instant: the test runs with reduced motion). A scrolled page
 * is framed from under the sticky top bar, so nothing shows through its glass.
 */
async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(SALIDA, { recursive: true });
  const estilo = await page.addStyleTag({ content: 'aside.mock { display: none !important; } * { scroll-behavior: auto !important; }' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    await new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));
  });
  const top = await page.evaluate(() => (window.scrollY > 0 ? Math.ceil(document.querySelector('header[app-header]')?.getBoundingClientRect().bottom ?? 0) : 0));
  const { width, height } = page.viewportSize()!;
  await page.screenshot({ path: join(SALIDA, `${nombre}.png`), ...(top > 0 ? { clip: { x: 0, y: top, width, height: height - top } } : {}) });
  await estilo.evaluate((nodo) => (nodo as Element).remove());
}

/** Scrolls so `target` starts just under the sticky top bar. */
async function scrollToTopOf(page: Page, target: Locator): Promise<void> {
  await target.evaluate((node) => {
    const bar = document.querySelector('header[app-header]')?.getBoundingClientRect().bottom ?? 0;
    window.scrollBy(0, node.getBoundingClientRect().top - bar - 16);
  });
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

/** Elige una opción de un `app-select` (abre su diálogo y toca la opción por nombre). */
async function elegirOpcion(page: Page, contenedor: string, nombre: string | RegExp): Promise<void> {
  await page.getByTestId(contenedor).getByRole('combobox').click();
  await page.getByRole('option', { name: nombre }).click();
}

test.describe('Encuestas · «Cómo le va» y el Buzón de solo lectura', () => {
  test('resumen general, filtros, privacidad y lectura de las respuestas de una encuesta', async ({ page }) => {
    test.setTimeout(4 * 60_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    // Theme and route transitions finish at once: captures never catch a cross-fade.
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await entrar(page, MEDICA);
    await irA(page, '/questionnaires');

    // ── 1. El bloque «Cómo le va» está ARRIBA de la lista ──────────────────────
    const bloque = page.getByTestId('resumen-medico');
    await expect(bloque).toBeVisible({ timeout: 30_000 });
    await resumenAsentado(page);
    await expect(page.getByTestId('resumen-kpis')).toBeVisible();

    const arriba = await bloque.boundingBox();
    const lista = await page.getByTestId('surveys-inbox-list').boundingBox();
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

    // «Por pregunta»: las sin datos suficientes van al final (no dejan un hueco por
    // igualar la altura de la grilla) y, sin filtro de servicio, ninguna lectura
    // dice «servicio»: rótulo de la dimensión y pregunta neutra. («esta consulta» sí puede
    // aparecer en una pregunta que sólo existe en la encuesta de consulta: es verdad.)
    const marcasDeSuprimida = await page
      .getByTestId('resumen-pregunta')
      .evaluateAll((items) => items.map((i) => i.querySelector('[data-testid="resumen-pregunta-suprimida"]') !== null));
    expect(marcasDeSuprimida.length).toBeGreaterThan(0);
    const primeraSuprimida = marcasDeSuprimida.indexOf(true);
    if (primeraSuprimida >= 0) {
      expect(marcasDeSuprimida.slice(primeraSuprimida).every(Boolean), 'las suprimidas van juntas al final').toBe(true);
    }
    const bloquePreguntas = ((await page.getByTestId('resumen-preguntas').textContent()) ?? '').replace(/\s+/g, ' ');
    expect(bloquePreguntas).not.toMatch(/servicio(?!s juntos)/i);

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
    // The «Cómo le va» card from its top, just under the sticky bar: the whole notice in frame.
    await scrollToTopOf(page, page.getByTestId('resumen-medico'));
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

    // ── 4. Read-only Buzón → one survey's answers ──────────────────────────────
    const tarjeta = page.getByTestId('surveys-inbox-list').locator('li', { hasText: 'Experiencia de teleconsulta' });
    await expect(tarjeta).toContainText('Encuesta anterior (ya no se envía)');
    await expect(tarjeta.getByRole('link', { name: /^Abrir/ })).toHaveCount(0);
    await tarjeta.getByRole('link', { name: 'Ver las respuestas de Experiencia de teleconsulta' }).click();
    await expect(page).toHaveURL(/\/questionnaires\/[0-9a-f-]{36}#respuestas$/);

    // The sheet reads. ONE card with tabs; `#respuestas` opens the answers tab, with the answers.
    await expect(page.getByRole('tab', { name: 'Respuestas', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
    await expect(page.getByTestId('survey-detail-answer-list')).toBeVisible({ timeout: 30_000 });
    const lecturas = async (): Promise<readonly number[]> =>
      (await atendidas(page)).filter((r) => r.method === 'GET' && /^\/surveys\/templates\/[^/?]+\/responses/.test(r.url)).map((r) => r.status);
    await expect.poll(lecturas, { timeout: 15_000 }).toEqual([200]);

    // Nothing that manages the survey: no attach, publish, edit or deactivate.
    for (const testId of ['asignacion-vigentes', 'asignacion-servicio', 'asignacion-guardar', 'encuesta-publicar', 'encuesta-agregar-pregunta']) {
      await expect(page.getByTestId(testId)).toHaveCount(0);
    }
    await expect(page.getByText(/Asociar a un servicio|Desactivar encuesta|nueva versión/)).toHaveCount(0);
    expect((await atendidas(page)).filter((r) => r.method !== 'GET' && r.url.startsWith('/surveys/'))).toEqual([]);
    await capturar(page, '08-ficha-solo-lectura-claro-1440');

    // Full reload → still readable, on the same tab.
    await page.reload();
    await esperarAplicacionLista(page);
    await expect(page.getByTestId('survey-detail-answer-list')).toBeVisible({ timeout: 30_000 });

    // «Resumen»: the tab writes its fragment and shows the summary of the answers.
    await page.getByRole('tab', { name: 'Resumen', exact: true }).click();
    await expect(page).toHaveURL(/#resumen$/);
    await expect(page.getByTestId('survey-detail-summary-bars').or(page.getByTestId('survey-detail-summary-below-minimum'))).toBeVisible();

    // ── 5. The sheet leads to where each service's survey is chosen today ──────
    await page.getByRole('tab', { name: 'Preguntas', exact: true }).click();
    await expect(page.getByTestId('survey-detail-read-only')).toContainText('Solo lectura');
    await page.getByTestId('survey-detail-go-to-services').click();
    await expect(page).toHaveURL(/\/questionnaires\?encuestas=servicios$/);
    await expect(page.getByTestId('service-surveys-list')).toBeVisible({ timeout: 30_000 });
    await page.goBack();
    await expect(page.getByTestId('survey-detail-read-only')).toBeVisible({ timeout: 30_000 });

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

    // At 390 px the Buzón only has the search box (no status filter) and is not cut.
    const barra = page.getByTestId('surveys-inbox-toolbar');
    await barra.scrollIntoViewIfNeeded();
    await expect(barra.locator('app-segmented-control')).toHaveCount(0);
    const cajaBarra = await barra.boundingBox();
    expect(cajaBarra!.x + cajaBarra!.width, 'el buscador entra en 390 px').toBeLessThanOrEqual(390);
    await capturar(page, '17-buscador-claro-390');
    await aplicarTema(page, 'oscuro');
    await capturar(page, '14-resumen-oscuro-390');

    // El estado suprimido también en el celular, claro y oscuro.
    await aplicarTema(page, 'claro');
    await cambiandoElFiltro(page, () => page.getByTestId('resumen-periodo').getByRole('radio', { name: '12 meses' }).click());
    await cambiandoElFiltro(page, () => elegirOpcion(page, 'resumen-servicio', 'Prueba de esfuerzo'));
    await expect(page.getByTestId('resumen-suprimido')).toBeVisible();
    await scrollToTopOf(page, page.getByTestId('resumen-medico'));
    await capturar(page, '15-suprimido-claro-390');
    await aplicarTema(page, 'oscuro');
    await capturar(page, '16-suprimido-oscuro-390');

    // Ningún desborde horizontal en el celular.
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde).toBeLessThanOrEqual(1);
    await aplicarTema(page, 'claro');
  });
});
