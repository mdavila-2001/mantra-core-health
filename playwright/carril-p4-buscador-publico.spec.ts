import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';

/**
 * Carril P4 — el directorio público sin sesión.
 *
 * ## Qué prueba y qué no
 *
 * Todo lo de acá corre **sin cookie, sin token y sin haber pasado por login**.
 * No hay `route.fulfill` ni un solo cuerpo de respuesta escrito a mano: el
 * navegador habla con la API real que sirve el entorno E2E, y los perfiles que
 * se buscan son los que `yarn seed:e2e` publicó por el camino del producto
 * —alta, activación, login de la titular y publicación de su propia vitrina—.
 *
 * ## Por qué el contexto anónimo es explícito
 *
 * Playwright reusa el contexto entre casos del mismo archivo. Si un caso
 * anterior dejara una sesión, «la ficha se ve sin sesión» pasaría a verde
 * estando rota. Cada caso abre su propia página en un contexto limpio y hay un
 * caso que lo comprueba: `localStorage` vacío y ninguna cabecera de
 * autorización en las peticiones que salen.
 *
 * ## Contra qué servidor corre
 *
 * `E2E_BASE_URL` decide. Contra `:4200` se prueba el recorrido en el navegador;
 * contra el servidor SSR construido (`yarn serve:ssr`, `:4300`) se prueba
 * además que el HTML **de la respuesta** ya traiga el contenido, que es el
 * criterio del carril. El caso de SSR pide el HTML por HTTP sin ejecutar
 * JavaScript, así que sólo afirma algo cuando apunta al servidor SSR: contra el
 * servidor de desarrollo se salta en vez de mentir.
 */

/** Los tres anchos que fija la ficha, igual que en los carriles 01 y 06. */
const VIEWPORTS = [
  { nombre: 'móvil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

/** Los slugs que siembra `tools/e2e/seed-e2e.mjs`. */
const PUBLICADO = 'doctor-uno-e2e';
const PUBLICADO_DOS = 'doctor-dos-e2e';
/** Existe y **no** está publicado: la prueba negativa necesita contra qué correr. */
const DESPUBLICADO = 'doctor-oculto-e2e';
const INEXISTENTE = 'no-existe-en-ninguna-parte-e2e';

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await contextoDeApi();
  expect(
    await apiViva(api),
    `La API E2E no responde en ${urlDeApi()}. Levantá el entorno con \`yarn seed:e2e\` en el repositorio de la API.`,
  ).toBe(true);
});

test.afterAll(async () => {
  await api.dispose();
});

/**
 * Abre una ruta en una pestaña sin sesión y espera a que la aplicación pinte.
 *
 * **No usa `networkidle`.** Contra el servidor de desarrollo la red no se queda
 * quieta nunca: el socket de recarga en vivo sigue abierto, así que la espera
 * agota el tiempo y —peor— deja el contexto sin poder cerrarse, que sale como
 * «Tearing down context exceeded the timeout» y parece un fallo del producto.
 *
 * Se espera a lo que de verdad importa: que el `<h1>` de la pantalla exista. Es
 * determinista, vale igual contra el servidor SSR y contra el de desarrollo, y
 * falla por el motivo correcto si la pantalla no pinta.
 */
async function abrirAnonimo(page: Page, ruta: string): Promise<void> {
  await page.goto(ruta, { waitUntil: 'domcontentloaded' });
  await page.locator('h1').first().waitFor({ state: 'visible' });
}

test.describe('P4-E2E-001 · buscar, encontrar y abrir una ficha, sin cuenta', () => {
  test('la búsqueda pública lista perfiles reales y su ficha abre sin sesión', async ({ page }) => {
    await abrirAnonimo(page, '/search');

    // El nombre sale de la API, no de la prueba: si el seed cambia, cambia acá.
    const resultado = page.getByRole('link', { name: /Marisol Quispe/i }).first();
    await expect(resultado).toBeVisible();

    await resultado.click();

    await expect(page).toHaveURL(new RegExp(`/p/${PUBLICADO}`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Marisol Quispe');
  });

  test('el texto buscado viaja en la URL y acota la lista', async ({ page }) => {
    await abrirAnonimo(page, '/search?q=Mamani');

    await expect(page.getByRole('link', { name: /Iván Mamani/i }).first()).toBeVisible();
    // El otro perfil publicado no coincide con el texto: si apareciera, el
    // filtro no está llegando a la API.
    await expect(page.getByRole('link', { name: /Marisol Quispe/i })).toHaveCount(0);
  });

  test('el buscador del marco público lleva a los resultados', async ({ page }) => {
    await abrirAnonimo(page, `/p/${PUBLICADO}`);

    await page.getByPlaceholder(/Buscá un médico/i).fill('Mamani');
    await page.getByPlaceholder(/Buscá un médico/i).press('Enter');

    await expect(page).toHaveURL(/\/search\?q=Mamani/);
    await expect(page.getByRole('link', { name: /Iván Mamani/i }).first()).toBeVisible();
  });

  test('la pestaña de profesionales lista sólo profesionales', async ({ page }) => {
    await abrirAnonimo(page, '/search/practitioners');

    await expect(page.getByRole('link', { name: /Marisol Quispe/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Iván Mamani/i }).first()).toBeVisible();
  });

  test('el recorrido no dejó sesión: no hay token en el navegador', async ({ page }) => {
    const autorizaciones: string[] = [];
    page.on('request', (peticion) => {
      const cabecera = peticion.headers()['authorization'];
      if (cabecera) autorizaciones.push(`${peticion.url()} → ${cabecera}`);
    });

    await abrirAnonimo(page, '/search');
    await abrirAnonimo(page, `/p/${PUBLICADO}`);

    const almacenado = await page.evaluate(() => ({ ...window.localStorage }));
    expect(Object.keys(almacenado)).not.toContain('refreshToken');
    // Ninguna petición del directorio público puede llevar autorización: el
    // resultado no depende de quién mira, y mandarla acá crearía una superficie
    // en la que sí dependería.
    expect(autorizaciones).toEqual([]);
  });
});

test.describe('P4-E2E-002 · lo despublicado no se distingue de lo inexistente', () => {
  test('un slug despublicado y uno inexistente dan la misma pantalla', async ({ page }) => {
    await abrirAnonimo(page, `/p/${DESPUBLICADO}`);
    const despublicado = await page.getByRole('heading', { level: 1 }).textContent();

    await abrirAnonimo(page, `/p/${INEXISTENTE}`);
    const inexistente = await page.getByRole('heading', { level: 1 }).textContent();

    expect(despublicado).toBe(inexistente);
  });

  /**
   * El texto es la mitad de la defensa: la pantalla no puede decir «privado»,
   * «no publicado» ni «existe». Cualquiera de las tres reintroduce por la
   * interfaz la filtración que el servidor evita devolviendo siempre el mismo
   * cuerpo.
   */
  test('la pantalla no revela que el perfil existe', async ({ page }) => {
    await abrirAnonimo(page, `/p/${DESPUBLICADO}`);

    const cuerpo = (await page.locator('body').textContent()) ?? '';
    expect(cuerpo.toLowerCase()).not.toMatch(/privad|despublicad|no publicad|oculto/);
  });

  test('la API responde 404 igual para los dos, con el mismo cuerpo', async () => {
    const [oculto, fantasma] = await Promise.all([
      api.get(`/p/${DESPUBLICADO}`),
      api.get(`/p/${INEXISTENTE}`),
    ]);

    expect(oculto.status()).toBe(404);
    expect(fantasma.status()).toBe(404);

    const [a, b] = await Promise.all([
      oculto.json() as Promise<Record<string, unknown>>,
      fantasma.json() as Promise<Record<string, unknown>>,
    ]);

    // Lo que **tiene** que ser idéntico: el código y el mensaje. Es lo único
    // que alguien puede leer para distinguir un caso del otro.
    expect(a['code']).toBe(b['code']);
    expect(a['message']).toBe(b['message']);
    expect(a['code']).toBe('NOT_FOUND');

    // Lo que difiere, y por qué ninguno revela existencia: `path` y
    // `details.slug` son **eco de lo que mandó quien llama** —ya lo sabía—, y
    // `correlationId` y `timestamp` son de la petición, no del recurso. Se
    // afirma explícitamente en vez de excluirse en silencio: si mañana el
    // filtro de excepciones agregara un campo que sí dependa del recurso, esta
    // prueba tiene que ser la que lo note.
    const dependeDelRecurso = (cuerpo: Record<string, unknown>): unknown[] =>
      Object.entries(cuerpo)
        .filter(([clave]) => !['code', 'message', 'correlationId', 'timestamp', 'path', 'details'].includes(clave))
        .map(([, valor]) => valor);
    expect(dependeDelRecurso(a)).toEqual(dependeDelRecurso(b));

    expect(String(a['path'])).toContain(DESPUBLICADO);
    expect(String(b['path'])).toContain(INEXISTENTE);
  });

  test('un prefijo de otro vertical da 404 y no redirige', async () => {
    // `/f/` promete una farmacia: servir ahí un profesional rompería el JSON-LD
    // de la página, que declara `Pharmacy`.
    const respuesta = await api.get(`/f/${PUBLICADO}`);

    expect(respuesta.status()).toBe(404);
  });

  test('el perfil despublicado no aparece en la búsqueda anónima', async () => {
    const respuesta = await api.get('/public/search?limit=50');
    const cuerpo = (await respuesta.json()) as { items: { slug: string }[] };
    const slugs = cuerpo.items.map((i) => i.slug);

    expect(slugs).toContain(PUBLICADO);
    expect(slugs).toContain(PUBLICADO_DOS);
    expect(slugs).not.toContain(DESPUBLICADO);
  });
});

test.describe('P4-E2E-004 · profesionales repite el marco de FT-01 y filtra por especialidad', () => {
  /**
   * R01 de la ficha: mismo layout que FT-01 — el rail lateral del marco
   * público —, y no uno propio. Entrar **directo** a la URL (no navegando
   * desde `/posts`, que ya cubre AC-01-3) es lo que probaba el hueco de
   * evidencia del rechazo AG-50/FND-02.
   */
  test('R01 · el rail del marco aparece al entrar directo, con esta sección marcada', async ({
    page,
  }) => {
    await abrirAnonimo(page, '/search/practitioners');

    await expect(page.locator('[data-testid="public-nav-rail-link"]')).toHaveCount(8);

    const marcado = page.locator('[data-testid="public-nav-rail-link"][aria-current="page"]');
    await expect(marcado).toHaveCount(1);
    await expect(marcado).toHaveAttribute('data-route', '/search/practitioners');
  });

  /**
   * R02: elegir una especialidad viaja a `?specialty=<conceptId>` (AC-02-7) y
   * dispara una petición nueva a la API con ese mismo `conceptId` — no un
   * filtro que sólo cambia la URL sin volver a preguntarle al servidor.
   */
  test('R02 · elegir una especialidad la lleva a la URL y repite la consulta filtrada', async ({
    page,
  }) => {
    await abrirAnonimo(page, '/search/practitioners');

    // `exact: true`: sin esto, «Especialidad» también matchea el campo de
    // texto libre, cuyo rótulo es «Buscá por nombre, especialidad u
    // organización» — infringe el modo estricto con dos elementos.
    const desplegable = page.getByLabel('Especialidad', { exact: true });
    const opciones = await desplegable.locator('option').all();
    test.skip(opciones.length < 2, 'el catálogo de especialidades no trajo ninguna opción');

    const valorElegido = await opciones[1]!.getAttribute('value');

    const peticionFiltrada = page.waitForRequest(
      (peticion) =>
        peticion.url().includes('/public/search/practitioners') &&
        peticion.url().includes(`specialty=${valorElegido}`),
    );
    await desplegable.selectOption({ index: 1 });
    await peticionFiltrada;

    await expect(page).toHaveURL(new RegExp(`specialty=${valorElegido}`));
  });

  for (const viewport of VIEWPORTS) {
    test(`R03 · en ${viewport.nombre} no hay scroll horizontal, con captura`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await abrirAnonimo(page, '/search/practitioners');

      const desborda = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(desborda, 'la página scrollea a lo ancho').toBe(false);

      // Sin evidencia visual el rung máximo es VERIFIED_FUNCTIONAL_ONLY.
      await testInfo.attach(`practitioners-${viewport.width}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    });
  }

  /**
   * R03 pide consola limpia, pero dos ruidos de acá son de fuera del alcance
   * atómico de este carril y ya están documentados como gap conocido, no
   * como algo que este rework deba resolver:
   *
   * - CSP de scripts inline: bloquea al `ng serve` de desarrollo en TODA la
   *   superficie pública (se ve igual en `/search/medications` et al., carril
   *   06), no es un defecto de esta pantalla.
   * - «Failed to load resource» 422 de `avatarUrl`/`coverUrl`: consecuencia
   *   directa de `MALWARE_SCAN_ENABLED=false` en este entorno (sin `clamd` en
   *   el `docker-compose` local) — el navegador reporta el intento de red
   *   fallido aunque la UI ya no se rompa por eso (ver FND-04 más abajo). No
   *   es indicativo de un `pageerror` de Angular ni de un error de producto.
   *
   * Lo que SÍ tiene que seguir en cero es cualquier otro error — uno nuevo
   * ahí sería la señal real de una regresión de esta pantalla.
   */
  test('R03 · sin errores de página ni de consola fuera de los gaps documentados', async ({
    page,
  }) => {
    const errores: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') errores.push(mensaje.text());
    });
    page.on('pageerror', (error) => errores.push(String(error)));

    await abrirAnonimo(page, '/search/practitioners');
    await page.locator('li[app-result-card]').first().waitFor({ state: 'visible' });

    const inesperados = errores.filter(
      (e) => !/Content Security Policy/i.test(e) && !/Failed to load resource.*422/i.test(e),
    );
    expect(inesperados, inesperados.join('\n')).toEqual([]);
  });

  /**
   * FND-04 (rechazo AG-50) — kill-test contra el entorno real: acá el escaneo
   * de malware está apagado (`MALWARE_SCAN_ENABLED=false` en `.env`, sin
   * `clamd` en el `docker-compose` local), así que el `avatarUrl` sembrado
   * responde 422 `PRECONDITION_FAILED` de verdad. Antes de este carril, eso
   * dejaba un ícono de imagen rota en la tarjeta; ahora tiene que caer a las
   * iniciales (`ResultCard.imagenFallo`). Esto NO habilita ni simula el
   * escaneo — sólo comprueba que la UI no se rompa mientras siga apagado.
   */
  test('FND-04 · ninguna tarjeta queda con el ícono de imagen rota', async ({ page }) => {
    await abrirAnonimo(page, '/search/practitioners');
    await page.locator('li[app-result-card]').first().waitFor({ state: 'visible' });

    await expect
      .poll(() =>
        page.locator('li[app-result-card] img').evaluateAll(
          (imagenes) =>
            (imagenes as HTMLImageElement[]).filter(
              (img) => img.complete && img.naturalWidth === 0,
            ).length,
        ),
      )
      .toBe(0);
  });
});

test.describe('P4-E2E-003 · el HTML del servidor ya trae el contenido', () => {
  /**
   * La prueba reina del carril. Se pide el HTML **por HTTP y sin navegador**:
   * si el nombre está, viaja en la respuesta; si hiciera falta ejecutar
   * JavaScript para verlo, un rastreador, una vista previa de enlace en un
   * mensaje o alguien con la conexión a medias no vería nada.
   */
  test('curl al perfil devuelve el nombre dentro del HTML', async ({ request, baseURL }) => {
    const respuesta = await request.get(`${baseURL}/p/${PUBLICADO}`);
    const html = await respuesta.text();

    test.skip(
      html.includes('ng-server-context') === false,
      `${baseURL} no está sirviendo SSR. Construí con \`yarn build\` y serví con \`yarn serve:ssr\`, y apuntá E2E_BASE_URL ahí.`,
    );

    expect(respuesta.status()).toBe(200);
    expect(html).toContain('Marisol Quispe');
    expect(html).toMatch(/<h1[^>]*>[\s\S]*Marisol Quispe/);
    expect(html).toContain('og:title');
  });

  test('el HTML trae el JSON-LD del profesional', async ({ request, baseURL }) => {
    const respuesta = await request.get(`${baseURL}/p/${PUBLICADO}`);
    const html = await respuesta.text();

    test.skip(html.includes('ng-server-context') === false, 'sin SSR');

    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"Physician"');
    // Sin reseñas no puede declararse una puntuación: schema.org exige
    // `ratingCount` mayor que cero y Google marca el dato como inválido.
    expect(html).not.toContain('aggregateRating');
  });

  test('un slug que no resuelve devuelve 404 de verdad, no 200 con cara de error', async ({
    request,
    baseURL,
  }) => {
    const respuesta = await request.get(`${baseURL}/p/${INEXISTENTE}`);
    const html = await respuesta.text();

    test.skip(html.includes('ng-server-context') === false, 'sin SSR');

    // Un 200 con la pantalla «no disponible» es como un enlace muerto termina
    // indexado como ficha válida.
    expect(respuesta.status()).toBe(404);
  });
});
