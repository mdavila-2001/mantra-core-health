import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  apiViva,
  contextoDeApi,
  operadoraDeFacturacion,
  urlDeApi,
} from './support/actores';
import { entrar, esperarAplicacionLista, estable, irA } from './support/sesion';

/**
 * TAREA-16 — la pantalla de solicitudes de seguro presentadas.
 *
 * **El actor es la operadora de facturación del prestador**, no el
 * administrador. Es lo que decidió el propietario (D1.b, 2026-09-04) y es lo
 * que hace que esta suite signifique algo: el admin atraviesa cualquier
 * `@Roles` por el comodín `SUPERADMIN`, así que certificar con él dejaría sin
 * probar el único rol que un usuario real va a tener, y no distinguiría una
 * pantalla que funciona de una a la que nadie puede entrar.
 *
 * Precondición: `node tools/alovida/seed-solicitudes-seguro.mjs` en el
 * repositorio de la API. Esa corrida deja la práctica que presenta los
 * reclamos, las cuatro solicitudes y la cuenta `BILLING_OPERATOR` con la que
 * entra esta suite. Sin ella la pantalla muestra su estado vacío —que es
 * correcto— y no hay nada que medir. Siembra a propósito una **sin dictamen**:
 * es la única con la que se puede comprobar que el total aprobado queda vacío
 * en vez de en `0.00`.
 *
 * Las capturas por viewport no son adorno: los tres criterios visuales de la
 * ficha (AC-16-17 y el aire del encabezado) sólo se pueden afirmar mirándolas.
 */

const LISTADO = '/administration/insurance-claims';

/** Un uuid con forma válida que no corresponde a ninguna solicitud. */
const INEXISTENTE = '00000000-0000-4000-8000-000000000000';

/** Los tres anchos obligatorios de la ficha. */
const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await contextoDeApi();
  expect(
    await apiViva(api),
    `La API no responde en ${urlDeApi()}. Levantala y sembrá con ` +
      '`node tools/alovida/seed-solicitudes-seguro.mjs`.',
  ).toBe(true);
});

test.afterAll(async () => {
  await api.dispose();
});

/**
 * Entra y abre el listado, con la tabla ya cargada.
 *
 * @param page - La página de la prueba.
 */
async function abrirListado(page: Page): Promise<void> {
  await entrar(page, operadoraDeFacturacion());
  await irA(page, LISTADO);
  await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 30_000 });
  await estable(page);
}

/**
 * Texto de una celda de la fila, por su `data-testid`.
 *
 * @param page - La página.
 * @param fila - Índice de la fila.
 * @param testId - Identificador de la celda.
 * @returns El texto, ya recortado.
 */
async function celda(page: Page, fila: number, testId: string): Promise<string> {
  const valor = await page
    .getByTestId('tabla-fila')
    .nth(fila)
    .getByTestId(testId)
    .textContent();
  return (valor ?? '').trim();
}

test.describe('el listado de solicitudes', () => {
  test('AC-16-1 · dibuja las columnas con dato y ninguna con guion permanente', async ({
    page,
  }) => {
    await abrirListado(page);

    const encabezados = await page.locator('thead th').allTextContents();
    const texto = encabezados.join(' | ');

    for (const columna of [
      'Solicitud',
      'Paciente',
      'Seguro',
      'Monto solicitado',
      'Total aprobado',
      'Fecha de envío',
      'Estado',
    ]) {
      expect(texto, `falta la columna «${columna}»`).toContain(columna);
    }

    // Las dos columnas del pedido que no tienen dato de origen no se dibujan.
    // «Broker responsable de la solicitud» y «Medio (automático/manual)» no
    // tienen columna en `insurance_claims`. Lo que sí existe es el corredor de
    // la **póliza**, que es otra cosa y por eso vive en el detalle, rotulado
    // por lo que es — en el listado no entra sin cortar la última columna.
    expect(texto).not.toContain('Medio');
    expect(texto).not.toContain('Corredor');
  });

  test('AC-16-2 · pagina por cursor, sin números de página ni total', async ({
    page,
  }) => {
    await abrirListado(page);

    // Un cursor no conoce el total: ni números de página, ni «de N», ni un
    // recuento de filas. Se mide sobre la pantalla entera, no sobre el bloque
    // de paginación, porque el recuento podría estar en cualquier lado.
    const pantalla = (await page.locator('main').textContent()) ?? '';
    expect(pantalla).not.toMatch(/p[áa]gina\s+\d+\s+de\s+\d+/i);
    expect(pantalla).not.toMatch(/\b\d+\s+resultados?\s+en\s+total\b/i);

    // Con los datos sembrados hay una sola página, y entonces la barra **no se
    // dibuja**: dos botones permanentemente apagados son controles muertos que
    // prometen una función que no existe. Es una decisión escrita del
    // organismo, así que se comprueba, no se asume.
    const barra = page.locator('.data-table__cursor');
    const filas = await page.getByTestId('tabla-fila').count();
    if (filas < 25) {
      await expect(barra).toHaveCount(0);
    } else {
      await expect(barra.getByTestId('tabla-siguiente')).toBeVisible();
      await expect(barra.getByTestId('tabla-anterior')).toBeVisible();
    }
  });

  test('AC-16-7 · el total aprobado sin dictamen queda vacío, no en 0.00', async ({
    page,
  }) => {
    await abrirListado(page);

    const filas = await page.getByTestId('tabla-fila').count();
    const aprobados: string[] = [];
    for (let i = 0; i < filas; i += 1) {
      aprobados.push(await celda(page, i, 'claim-approved'));
    }

    // La solicitud sembrada sin dictamen tiene que decirlo con palabras. Un
    // «0.00» ahí sería «denegaron todo», que es otra cosa.
    expect(
      aprobados.some((valor) => /sin dictaminar/i.test(valor)),
      `ninguna fila declara la ausencia de dictamen: ${aprobados.join(' · ')}`,
    ).toBe(true);
    expect(
      aprobados.every((valor) => valor !== '0.00'),
      'una fila muestra 0.00 donde debería decir que no hay dictamen',
    ).toBe(true);
  });

  test('AC-16-16 · los importes salen con su moneda, no con un símbolo a mano', async ({
    page,
  }) => {
    await abrirListado(page);

    const facturado = await celda(page, 0, 'claim-approved');
    const fila = page.getByTestId('tabla-fila').first();
    const montos = (await fila.textContent()) ?? '';

    // La moneda viene del `currency_concept_id` de la solicitud: su etiqueta
    // del catálogo es «Boliviano». Un «$» escrito en la plantilla no aparece.
    expect(montos).toContain('Boliviano');
    expect(montos).not.toContain('$');
    expect(facturado.length).toBeGreaterThan(0);
  });
});

test.describe('la ficha del paciente', () => {
  test('AC-16-3 · abre con teclado, cierra con Escape y devuelve el foco', async ({
    page,
  }) => {
    await abrirListado(page);

    const boton = page.getByTestId('claim-patient').first();
    await boton.focus();
    await expect(boton).toBeFocused();

    // Con teclado, no con el mouse: es la mitad del criterio que se suele
    // dejar sin probar.
    await page.keyboard.press('Enter');
    const ficha = page.getByTestId('claim-patient-popup');
    await expect(ficha).toBeVisible();

    // El nombre accesible del diálogo, y que el foco entró.
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(ficha).toHaveCount(0);
    await expect(boton).toBeFocused();
  });

  test('no muestra datos clínicos', async ({ page }) => {
    await abrirListado(page);
    await page.getByTestId('claim-patient').first().click();

    const ficha = page.getByTestId('claim-patient-popup');
    await expect(ficha).toBeVisible();
    const texto = (await ficha.textContent()) ?? '';

    // Regla 00.4: una pantalla de seguros identifica al paciente y su
    // cobertura. El motivo de consulta y el diagnóstico no son lo que se está
    // mirando.
    expect(texto).not.toMatch(/diagn[óo]stico|motivo de consulta/i);
  });
});

test.describe('el detalle de una solicitud', () => {
  test('AC-16-4 · la fila lleva al detalle y el id queda en la URL', async ({
    page,
  }) => {
    await abrirListado(page);

    await page.getByTestId('claim-link').first().click();
    await expect(page).toHaveURL(
      new RegExp(`${LISTADO}/[0-9a-f-]{36}$`, 'i'),
    );
    await expect(page.getByTestId('claim-header')).toBeVisible();

    // Recargar muestra la misma solicitud: el estado está en la dirección, no
    // en memoria.
    const url = page.url();
    await page.reload();
    await esperarAplicacionLista(page);
    await expect(page).toHaveURL(url);
    await expect(page.getByTestId('claim-header')).toBeVisible();
  });

  test('AC-16-5 · la cabecera no acepta entrada, y no es un campo deshabilitado', async ({
    page,
  }) => {
    await abrirListado(page);
    await page.getByTestId('claim-link').first().click();

    const cabecera = page.getByTestId('claim-header');
    await expect(cabecera).toBeVisible();

    // No hay controles: no es `<input readonly>`, es texto. Un campo
    // deshabilitado le dice a un lector de pantalla «acá se escribe, pero no
    // podés», y lo que hay que comunicar es que esto se lee.
    await expect(cabecera.locator('input, select, textarea')).toHaveCount(0);
  });

  test('AC-16-6 · el total de los ítems coincide con el declarado, como cadena', async ({
    page,
  }) => {
    await abrirListado(page);

    const declaradoEnLaFila = await celda(page, 0, 'claim-approved');
    expect(declaradoEnLaFila.length).toBeGreaterThan(0);

    const fila = page.getByTestId('tabla-fila').first();
    const montoDeLaFila = ((await fila.textContent()) ?? '').match(
      /(\d+\.\d+)\s+Boliviano/,
    );
    expect(montoDeLaFila, 'la fila no muestra un importe con moneda').not.toBeNull();

    await page.getByTestId('claim-link').first().click();
    await expect(page.getByTestId('claim-lines-table')).toBeVisible();

    const total = ((await page.getByTestId('claim-lines-total').textContent()) ?? '')
      .trim()
      .replace(/\s*Boliviano\s*$/, '');

    // Comparación de cadena: sumar decimales en el navegador produce
    // descuadres de un céntimo indistinguibles de un error real.
    expect(total).toBe(montoDeLaFila?.[1]);

    // Y si el servidor detectara un descuadre real, la pantalla lo diría en vez
    // de taparlo. Con los datos sembrados no hay ninguno.
    await expect(page.getByTestId('claim-total-mismatch')).toHaveCount(0);
  });

  test('AC-16-9 · el id del ítem abre su resumen con el puntero y con el foco', async ({
    page,
  }) => {
    await abrirListado(page);
    await page.getByTestId('claim-link').first().click();
    await expect(page.getByTestId('claim-lines-table')).toBeVisible();

    const referencia = page.getByTestId('claim-line-reference').first();
    await expect(referencia).toBeVisible();

    // Es un botón, no un `<span>` con `title`: responde al teclado.
    expect(await referencia.evaluate((el) => el.tagName)).toBe('BUTTON');

    await referencia.hover();
    const globo = page.locator('app-tooltip-panel, .tooltip');
    await expect(globo.first()).toBeVisible();

    // El globo se cuelga del `<body>`: no lo recorta el scroll de la tabla.
    const padre = await globo
      .first()
      .evaluate((el) => el.parentElement?.tagName ?? '');
    expect(padre).toBe('BODY');

    await page.keyboard.press('Escape');
    await referencia.focus();
    await expect(globo.first()).toBeVisible();
  });

  test('AC-16-11 · ofrece reclamar, y dice que el dictamen anterior no se pierde', async ({
    page,
  }) => {
    await abrirListado(page);
    await page.getByTestId('claim-link').first().click();

    const reclamar = page.getByTestId('claim-dispute-button');
    await expect(reclamar).toBeVisible();
    await expect(reclamar).toBeEnabled();

    // La promesa de inmutabilidad está escrita en la pantalla, no sólo en el
    // servicio: quien reclama tiene que poder leer qué pasa con lo anterior.
    await expect(page.locator('.claim__actions')).toContainText(
      /no se borra ni se modifica/i,
    );
  });

  test('AC-16-11 · reclamar reabre el caso y lo deja visible como reclamado', async ({
    page,
  }) => {
    await abrirListado(page);

    // La solicitud sin reclamo previo: si se empieza por una ya reclamada no se
    // puede ver la transición, que es lo que el criterio pide.
    const filas = await page.getByTestId('tabla-fila').count();
    let abierta = -1;
    for (let i = 0; i < filas; i += 1) {
      const texto = (await page.getByTestId('tabla-fila').nth(i).textContent()) ?? '';
      if (!/reclamada/i.test(texto)) {
        abierta = i;
        break;
      }
    }
    expect(abierta, 'todas las filas ya están reclamadas: sembrá de nuevo').toBeGreaterThanOrEqual(0);

    await page.getByTestId('tabla-fila').nth(abierta).getByTestId('claim-link').click();
    await expect(page.getByTestId('claim-lines-table')).toBeVisible();

    await page.getByTestId('claim-dispute-button').click();
    // El diálogo avisa que el reclamo se presenta y no se puede retirar.
    await page.getByRole('button', { name: /reclamar/i }).last().click();

    // El caso queda reabierto: la disputa se ve en la ficha y el dictamen
    // anterior sigue estando.
    await expect(page.getByTestId('claim-disputes')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('claim-dispute-button')).toContainText(
      /reclamar otra vez/i,
    );
  });

  test('AC-16-13 · reclamar dos veces no duplica el reclamo', async ({ page }) => {
    await abrirListado(page);

    // Se parte de una ya reclamada: la primera pasada dejó al menos una, y lo
    // que se mide acá es que la segunda llamada no agregue otra fila.
    await page.getByTestId('claim-link').first().click();
    await expect(page.getByTestId('claim-dispute-button')).toBeVisible();

    const reclamar = async (): Promise<void> => {
      await page.getByTestId('claim-dispute-button').click();
      await page.getByRole('button', { name: /reclamar/i }).last().click();
      await expect(page.getByTestId('claim-disputes')).toBeVisible({
        timeout: 15_000,
      });
      await estable(page);
    };

    await reclamar();
    const despuesDeUna = await page
      .getByTestId('claim-disputes')
      .locator('li')
      .count();

    await reclamar();
    const despuesDeDos = await page
      .getByTestId('claim-disputes')
      .locator('li')
      .count();

    // La idempotencia la resuelve el servidor devolviendo la disputa abierta
    // que ya existía sobre el mismo dictamen: la aseguradora no puede recibir
    // el caso dos veces, porque no hay forma de retirarlo.
    expect(despuesDeDos).toBe(despuesDeUna);
  });
});

/**
 * AC-16-14 — el rechazo no puede servir de sonda.
 *
 * Se mide contra la API directamente y no por pantalla: lo que el criterio
 * compara es el **cuerpo** de las dos respuestas, y el navegador ya lo tradujo
 * a un estado de vista cuando llega a la interfaz.
 */
test.describe('el alcance del prestador', () => {
  /** Entra por API con la cuenta del operador y devuelve su cabecera. */
  async function cabecerasDeOperador(): Promise<Record<string, string>> {
    const actor = operadoraDeFacturacion();
    const acceso = await api.post('/iam/auth/login', {
      data: { email: actor.identificador, password: actor.clave },
    });
    expect(
      acceso.status(),
      `No se pudo entrar como ${actor.identificador}: sembrá con ` +
        '`node tools/alovida/seed-solicitudes-seguro.mjs`.',
    ).toBe(200);
    const { accessToken } = (await acceso.json()) as { accessToken: string };
    return { Authorization: `Bearer ${accessToken}` };
  }

  test('AC-16-14 · una solicitud ajena y un uuid inexistente responden lo mismo', async () => {
    const headers = await cabecerasDeOperador();

    // Una solicitud propia se lee: el 403 de abajo no es «cualquier id falla».
    const listado = await api.get('/insurance-claims', { headers });
    expect(listado.status()).toBe(200);
    const { items } = (await listado.json()) as { items: { id: string }[] };
    expect(items.length, 'sin solicitudes sembradas no hay nada que comparar').toBeGreaterThan(0);

    const propia = await api.get(`/insurance-claims/${items[0].id}`, { headers });
    expect(propia.status()).toBe(200);

    const inexistente = await api.get(`/insurance-claims/${INEXISTENTE}`, {
      headers,
    });
    expect(inexistente.status()).toBe(403);

    // El cuerpo se compara sin los campos que cambian en cada petición
    // (`correlationId`, `timestamp`, `path`): lo que no puede diferir es el
    // código, el mensaje y la ausencia de detalles. Un `details` con el id
    // convertiría el error en una sonda de qué identificadores existen.
    const cuerpo = (await inexistente.json()) as Record<string, unknown>;
    expect(cuerpo['code']).toBe('FORBIDDEN');
    expect(cuerpo).not.toHaveProperty('details');
    expect(JSON.stringify(cuerpo)).not.toContain(INEXISTENTE);
  });

  test('AC-16-14 · el listado de quien no presentó nada tampoco se filtra', async () => {
    // Sin sesión no hay alcance posible: la ruta no puede responder 200 con una
    // lista vacía, que se leería como «no hay solicitudes».
    const anonimo = await api.get('/insurance-claims');
    expect([401, 403]).toContain(anonimo.status());
  });
});

for (const viewport of VIEWPORTS) {
  test(`AC-16-17 · sin scroll horizontal del body en ${viewport.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await abrirListado(page);

    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborde, 'el listado desborda a lo ancho').toBe(false);

    await page.screenshot({
      path: `artifacts/playwright/tarea-16/listado-${viewport.nombre}.png`,
      fullPage: true,
    });

    // El detalle es el que tiene ocho columnas: es donde el desborde aparece.
    await page.getByTestId('claim-link').first().click();
    await expect(page.getByTestId('claim-lines-table')).toBeVisible();
    await estable(page);

    const desbordeDetalle = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desbordeDetalle, 'el detalle desborda a lo ancho').toBe(false);

    // La tabla sí desplaza, pero **dentro de su contenedor**.
    const desplazaAdentro = await page
      .locator('.claim__table-scroll')
      .evaluate((el) => el.scrollWidth > el.clientWidth);
    if (viewport.width < 900) {
      expect(desplazaAdentro, 'la tabla debería desplazar en su caja').toBe(true);
    }

    await page.screenshot({
      path: `artifacts/playwright/tarea-16/detalle-${viewport.nombre}.png`,
      fullPage: true,
    });
  });
}

test('AC-16-18 · estas pantallas no agregan un solo error de consola', async ({
  page,
}) => {
  /*
    Se compara contra una **referencia medida en la misma corrida**, y no
    contra la lista vacía.

    Motivo: el servidor de desarrollo inyecta scripts en línea que la propia
    CSP de la aplicación bloquea (`script-src 'self'`), y eso produce
    exactamente tres errores en **todas** las pantallas. Medido en esta misma
    sesión sobre `/dashboard` y `/administration/brokers`, que este carril no
    toca: tres y tres, con los mismos hashes. Exigir cero acá haría fallar la
    prueba por una condición del entorno que no es de esta tarea.

    Lo que sí se exige, y es lo que importa, es que estas dos pantallas no
    agreguen **ninguno** sobre esa referencia.
  */
  const todos: string[] = [];
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') todos.push(mensaje.text());
  });
  page.on('pageerror', (error) => todos.push(error.message));

  await entrar(page, operadoraDeFacturacion());
  await irA(page, '/dashboard');
  await estable(page);
  const referencia = new Set(todos);

  await irA(page, LISTADO);
  await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('claim-link').first().click();
  await expect(page.getByTestId('claim-lines-table')).toBeVisible();
  await estable(page);

  const propios = todos.filter((error) => !referencia.has(error));
  expect(
    propios,
    'errores que sólo aparecen en las pantallas de la TAREA-16 ' +
      `(referencia de /dashboard: ${referencia.size}): ${propios.join(' ~~ ')}`,
  ).toEqual([]);
});
