import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, doctora, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * TAREA-10 (horario de atención) y TAREA-11 (bloqueo de agenda) — revisión
 * visual y de convivencia de diseño de las tres pantallas exclusivas de este
 * carril:
 *
 *  - `/schedule/new`    — publicar mi agenda
 *  - `/schedule/edit`   — cambiar mi horario
 *  - `/schedule/blocks` — bloqueos de agenda
 *
 * No se tocan `/schedule` (tablero de citas/cupos) ni `/schedule/mine» (otro
 * agente), aunque ambas fichas las describan: son de otras carpetas.
 *
 * Cada `test()` entra **una sola vez** y navega con `irA` (sin recargar) entre
 * rutas y anchos: `POST /iam/auth/login` está limitado a diez por minuto y
 * por IP, y un login por caso agotaba el cupo antes de terminar la corrida.
 */

const NUEVO = '/schedule/new';
const EDITAR = '/schedule/edit';
const BLOQUEOS = '/schedule/blocks';

const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

const RUTAS = [
  // `titulo` es el `<h1>` que cada ruta pinta: se espera antes de medir para
  // no leer el DOM de la ruta anterior a mitad de la transición del router
  // (`irA` navega sin recargar, y una medición apurada agarraba el `<h1>` y
  // los botones de la pantalla vieja con el viewport de la nueva).
  { nombre: 'horario-nuevo', ruta: NUEVO, titulo: /agenda|horario/i },
  { nombre: 'horario-editar', ruta: EDITAR, titulo: /agenda|horario/i },
  { nombre: 'bloqueos', ruta: BLOQUEOS, titulo: /bloqueos/i },
] as const;

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await contextoDeApi();
  expect(
    await apiViva(api),
    `La API no responde en ${urlDeApi()}. Levantala y sembrá con ` +
      '`node tools/redesa/seed-dev-data.mjs`.',
  ).toBe(true);
});

test.afterAll(async () => {
  await api.dispose();
});

async function irComoDoctora(page: Page, ruta: string): Promise<void> {
  await irA(page, ruta);
  await estable(page);
}

test('aviso legal «consulta y cita, no cirugías» — visible en las tres rutas sin abrir nada', async ({
  page,
}) => {
  await entrar(page, doctora());

  for (const { nombre, ruta, titulo } of RUTAS) {
    await irComoDoctora(page, ruta);
    // El aviso está fuera del `@if` de carga, pero el `<h1>` es la señal más
    // barata de que la ruta terminó de asentar tras la navegación por router.
    await expect(page.locator('h1')).toHaveText(titulo);
    const texto = (await page.locator('body').innerText()).toLowerCase();
    const dice =
      /consulta y cita/.test(texto) &&
      /(cirug|intervenci[oó]n quir|procedimientos prolongados)/.test(texto);

    test.info().annotations.push({
      type: 'AC-10-2',
      description: dice ? `presente en ${ruta}` : `AUSENTE en ${ruta}`,
    });
    expect(dice, `El aviso de «consulta y cita, no cirugías» falta en ${ruta} (${nombre})`).toBe(
      true,
    );
  }
});

test('las tres rutas resuelven una pantalla propia; el botón de crear bloqueo no cae en el 404', async ({
  page,
}) => {
  await entrar(page, doctora());

  for (const { nombre, ruta, titulo } of RUTAS) {
    await irComoDoctora(page, ruta);
    await expect(page, `${nombre} (${ruta}) no resolvió`).toHaveURL(new RegExp(`${ruta}$`));
    await expect(page.locator('h1')).toHaveText(titulo);
    const texto = await page.locator('body').innerText();
    expect(
      /p[aá]gina no encontrada|404|no existe esta direcci[oó]n/i.test(texto),
      `${nombre} (${ruta}) muestra una pantalla de error/404`,
    ).toBe(false);
  }

  await irComoDoctora(page, BLOQUEOS);
  const boton = page.getByRole('button', { name: /bloquear d[ií]as u horarios/i });
  await expect(boton).toBeVisible();
  const destino = await boton.getAttribute('href');
  await boton.click();
  await estable(page);

  const textoDespues = await page.locator('body').innerText();
  const es404 = /p[aá]gina no encontrada|404|no existe esta direcci[oó]n/i.test(textoDespues);
  test.info().annotations.push({
    type: 'ruta-bloqueo-nuevo',
    description: `href="${destino}" · url final=${page.url()} · 404=${es404}`,
  });
  expect(es404, `El botón de crear bloqueo (${destino}) cae en una pantalla de error`).toBe(false);
});

test('convivencia de diseño: tabla vs. lista, e iconos vs. botones de texto', async ({ page }) => {
  await entrar(page, doctora());

  await irComoDoctora(page, NUEVO);
  const tablaHorarios = await page.locator('table').count();

  await irComoDoctora(page, BLOQUEOS);
  const tablaBloqueos = await page.locator('table').count();
  const listaBloqueos = await page.locator('ul').count();

  test.info().annotations.push({
    type: 'convivencia-diseño',
    description:
      `<table> en /schedule/new: ${tablaHorarios} · ` +
      `<table> en /schedule/blocks: ${tablaBloqueos} · <ul> en /schedule/blocks: ${listaBloqueos}`,
  });

  const editar = page.getByTestId('bloqueo-editar').first();
  const quitar = page.getByTestId('bloqueo-quitar').first();

  if ((await editar.count()) > 0) {
    const textoEditar = (await editar.innerText()).trim();
    const ariaEditar = await editar.getAttribute('aria-label');
    test.info().annotations.push({
      type: 'bloqueo-editar',
      description: `texto visible="${textoEditar}" aria-label=${ariaEditar ?? '(ninguno)'}`,
    });
  }
  if ((await quitar.count()) > 0) {
    const textoQuitar = (await quitar.innerText()).trim();
    const ariaQuitar = await quitar.getAttribute('aria-label');
    test.info().annotations.push({
      type: 'bloqueo-quitar',
      description: `texto visible="${textoQuitar}" aria-label=${ariaQuitar ?? '(ninguno)'}`,
    });
  }
});

test('el formulario de bloqueo no pide tamaño de slot ni slots dinámicos (AC-11-3)', async ({
  page,
}) => {
  await entrar(page, doctora());
  await irComoDoctora(page, BLOQUEOS);

  const boton = page.getByRole('button', { name: /bloquear d[ií]as u horarios/i });
  await expect(boton).toBeVisible();
  await boton.click();
  await estable(page);

  const texto = (await page.locator('body').innerText()).toLowerCase();
  expect(texto).not.toMatch(/tama[nñ]o del slot/);
  expect(texto).not.toMatch(/slots din[aá]micos/);
});

test('sin scroll horizontal en 390/768/1440 px, en las tres rutas — con capturas', async ({
  page,
}) => {
  await entrar(page, doctora());

  for (const { nombre, ruta, titulo } of RUTAS) {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await irComoDoctora(page, ruta);
      await expect(page.locator('h1')).toHaveText(titulo);
      // `estable()` espera la red quieta ANTES de este punto; acá se espera
      // una vez más porque la lectura del horario vigente (`vigente()`) puede
      // arrancar recién cuando cambia la ruta, después de que el título ya
      // pintó — una carrera real que una corrida completa mostró: la tabla
      // llegó a capturarse vacía una vez, con las siete filas en «No atendés».
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
      // Bloqueos encadena DOS pedidos (catálogo, después lista): a veces la
      // red se ve «quieta» entre uno y el otro y la captura agarraba el
      // esqueleto de carga en vez del estado vacío real.
      await page
        .locator('.view-state-host__loading')
        .waitFor({ state: 'detached', timeout: 10000 })
        .catch(() => undefined);

      const medida = await page.evaluate(() => {
        const doc = document.documentElement;
        const ancho = doc.clientWidth;
        let culpable = '';
        if (doc.scrollWidth > ancho) {
          // El elemento cuyo borde derecho cae más lejos del viewport, EXCEPTO
          // dentro de una caja que ya scrollea sola (`overflow-x` no visible):
          // ésas están haciendo lo que tienen que hacer.
          let peor: Element | null = null;
          let peorBorde = ancho;
          for (const el of document.querySelectorAll('body *')) {
            let dentroDeScrollPropio = false;
            for (let p = el.parentElement; p !== null; p = p.parentElement) {
              const o = getComputedStyle(p).overflowX;
              if (o === 'auto' || o === 'scroll') {
                dentroDeScrollPropio = true;
                break;
              }
            }
            if (dentroDeScrollPropio) continue;
            const r = el.getBoundingClientRect();
            if (r.right > peorBorde && r.width < 10000) {
              peorBorde = r.right;
              peor = el;
            }
          }
          if (peor !== null) {
            const clase =
              peor.className && typeof peor.className === 'string'
                ? `.${peor.className.split(' ').join('.')}`
                : '';
            const r = peor.getBoundingClientRect();
            culpable = `${peor.tagName.toLowerCase()}${clase} (right=${Math.round(r.right)}, width=${Math.round(r.width)})`;
          }
        }
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: ancho,
          culpable,
        };
      });

      const resumenOverflow = `${nombre}@${viewport.width}px → scrollWidth=${medida.scrollWidth} clientWidth=${medida.clientWidth}${medida.culpable ? ' · culpable=' + medida.culpable : ''}`;
      test.info().annotations.push({ type: 'overflow', description: resumenOverflow });
      console.log(`[overflow] ${resumenOverflow}`);

      await page.screenshot({
        path: `artifacts/playwright/tarea-10-11/${nombre}-${viewport.nombre}-${viewport.width}px.png`,
        fullPage: true,
      });

      // `expect.soft`: si un ancho desborda, se sigue igual con los demás —
      // así la corrida deja las nueve capturas en vez de cortar en la primera.
      expect
        .soft(
          medida.scrollWidth,
          `${nombre} desborda a lo ancho en ${viewport.width}px (scrollWidth=${medida.scrollWidth} > clientWidth=${medida.clientWidth})`,
        )
        .toBeLessThanOrEqual(medida.clientWidth);
    }
  }
});


/**
 * NOTA — no incluido en la corrida final: un intento de crear un bloqueo real
 * (calendario → confirmar → verificar fila con badge/iconos → quitar) chocó
 * dos veces con `date-picker` (el HALLAZGO de carril-14: abre siempre en
 * enero de 2000, hay que navegar por año) y una tercera con un overlay de
 * error de compilación de OTRO módulo (`accounting.ts`, ajeno a este carril)
 * que un agente concurrente dejó momentáneamente roto mientras corría esta
 * prueba — el dev-server de Angular es un único bundle y ese error se ve
 * desde cualquier pantalla. Se comprobó con un chequeo aparte que ningún
 * intento fallido dejó basura en la base (0 bloqueos con la descripción de
 * prueba). La fila poblada (badge «Vigente», iconos con aria-label) quedó
 * verificada por lectura de código y por el `tsc`/build limpios, no por
 * captura — se dice así en el informe en vez de darla por vista.
 */
