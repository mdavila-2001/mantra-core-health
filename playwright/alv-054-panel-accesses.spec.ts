import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type APIRequestContext, type Page, type Response } from '@playwright/test';

import {
  administrador,
  apiViva,
  contextoDeApi,
  crearPaciente,
  doctora,
  type Actor,
} from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * ALV-054 — «Eliminar accesos muertos del panel».
 *
 * La auditoría del registro de navegación contra el árbol de rutas no encontró
 * ningún acceso muerto: cada sección ofrecida resuelve a una pantalla real, y
 * la única todavía sin construir se pinta **sin enlace** y con su sello. Las
 * pruebas unitarias ya fijan ese reparto leyendo las dos tablas.
 *
 * Lo que ninguna de ellas puede decir es lo que esta suite comprueba: que en la
 * aplicación de verdad, con la sesión de verdad y el router de verdad, **cada
 * acceso que el panel ofrece abre una pantalla con contenido** — ni el hueco
 * de una sección planificada, ni la pantalla de «no encontrada», ni la de
 * error, ni el rechazo por rol. Un acceso muerto no se detecta leyendo el
 * registro: se detecta entrando.
 *
 * ## Una prueba por actor, no una por afirmación
 *
 * `POST /iam/auth/login` admite diez por minuto y por IP. Partir el recorrido
 * en varias pruebas por rol multiplicaría los ingresos y la corrida se caería
 * contra una defensa que funciona bien; por eso cada rol entra una vez y
 * recorre todo lo suyo de un tirón.
 */

/** Dónde queda la evidencia del recorrido. `artifacts/` no se versiona. */
const SCREENSHOTS = join(__dirname, '..', 'artifacts', 'playwright', 'alv-054');

/**
 * Las tres formas de la pantalla vacía.
 *
 * El hueco de una sección planificada, la pantalla de «no encontrada» del
 * comodín de rutas y la de recuperación de errores. Ninguna de las tres puede
 * ser el destino de algo que el panel ofrece como disponible: eso es,
 * exactamente, un acceso muerto.
 */
const DEAD_END = 'app-section-placeholder, app-not-found, app-error-recovery';

/**
 * Cómo se identifica una pantalla real: por su encabezado o, cuando todavía no
 * tiene datos, por el estado vacío de la aplicación (`app-empty-state`), que
 * dice qué falta y qué hacer. Un estado vacío es una pantalla definida que
 * espera datos, no un acceso muerto.
 */
const SCREEN_IDENTITY = 'h1:visible, app-empty-state:visible';

/**
 * Techo por prueba, por encima del general de la configuración.
 *
 * El recorrido de quien administra pasa de treinta secciones, y cada una entra,
 * espera a que la pantalla deje de moverse y deja su captura: el techo de 180 s
 * del archivo de configuración no alcanza. Se sube acá en vez de partir la
 * prueba en varias porque partirla significa un ingreso más por pedazo, y los
 * ingresos son el recurso escaso — diez por minuto y por IP.
 */
const SWEEP_TIMEOUT_MS = 15 * 60_000;

/**
 * Cuánto se espera a que la pantalla cambie después de navegar.
 *
 * La navegación va por el router, sin recargar: hasta que la ruta nueva dibuja,
 * la pantalla sigue mostrando la anterior. Mirar antes de ese cambio es dar por
 * buena la ruta nueva con la evidencia de la vieja.
 */
const SCREEN_CHANGE_TIMEOUT_MS = 30_000;

/**
 * Las señales de carga de la aplicación: el andamio y lo marcado como ocupado.
 * Mientras estén, la captura muestra el esqueleto y no la pantalla.
 */
const LOADING = 'app-skeleton, [aria-busy="true"]';

/**
 * Cuánto se le da a la carga para terminar. Si no termina, ese es el estado de
 * la pantalla y la captura lo muestra tal cual: una carga que no acaba es un
 * hallazgo, no un acceso muerto.
 */
const LOADING_TIMEOUT_MS = 10_000;

/** Un acceso ofrecido por el panel, con de dónde salió. */
interface PanelAccess {
  readonly route: string;
  readonly label: string;
  readonly zone: string;
}

/** Los identificadores de las zonas de la primera pantalla del árbol. */
async function zoneIds(page: Page): Promise<string[]> {
  const ids = await page
    .getByTestId('panel-zona')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLElement).dataset['zona'] ?? ''));

  return ids.filter((id) => id !== '');
}

/** Abre una zona y espera a que aparezca el camino de vuelta. */
async function openZone(page: Page, id: string): Promise<void> {
  await page.locator(`[data-zona="${id}"]`).click();
  await page.getByTestId('panel-zona-volver').waitFor();
}

/** Vuelve a la primera pantalla del árbol. */
async function backToZones(page: Page): Promise<void> {
  await page.getByTestId('panel-zona-volver').click();
  await page.getByTestId('panel-zona').first().waitFor();
}

/**
 * Recorre el árbol entero y devuelve lo que ofrece, zona por zona.
 *
 * De paso comprueba, dentro de cada zona, las dos mitades de la regla:
 *
 * - lo **disponible** es un enlace con destino — un acceso sin `href` no lleva
 *   a ninguna parte por más que se dibuje;
 * - lo **planificado** no es enlace ni lo aparenta, y lo dice con palabras.
 *   Prometer una pantalla que no existe es peor que avisar que falta.
 */
async function collectAccesses(page: Page): Promise<PanelAccess[]> {
  const accesses: PanelAccess[] = [];

  for (const zone of await zoneIds(page)) {
    await openZone(page, zone);

    const offered = await page.getByTestId('panel-acceso').evaluateAll((nodes) =>
      nodes.map((node) => ({
        route: (node as HTMLElement).dataset['ruta'] ?? '',
        label: (node.textContent ?? '').trim(),
        href: node.getAttribute('href') ?? '',
        tag: node.tagName.toLowerCase(),
      })),
    );

    for (const access of offered) {
      expect(access.tag, `zona «${zone}»: el acceso «${access.label}» no es un enlace`).toBe('a');
      expect(
        access.href,
        `zona «${zone}»: el acceso «${access.label}» no lleva a ninguna parte (href vacío)`,
      ).not.toBe('');
      expect(
        access.route,
        `zona «${zone}»: el acceso «${access.label}» no declara la ruta a la que va`,
      ).not.toBe('');

      accesses.push({ route: access.route, label: access.label, zone });
    }

    const planned = await page.getByTestId('panel-acceso-planificado').evaluateAll((nodes) =>
      nodes.map((node) => ({
        label: (node.textContent ?? '').trim(),
        href: node.getAttribute('href') ?? '',
        tag: node.tagName.toLowerCase(),
      })),
    );

    for (const section of planned) {
      expect(
        section.tag,
        `zona «${zone}»: la sección sin construir «${section.label}» se ofrece como enlace`,
      ).not.toBe('a');
      expect(
        section.href,
        `zona «${zone}»: la sección sin construir «${section.label}» tiene destino`,
      ).toBe('');
      expect(
        section.label,
        `zona «${zone}»: la sección sin construir «${section.label}» no avisa que falta`,
      ).toContain('En construcción');
    }

    await backToZones(page);
  }

  return accesses;
}

/** El nombre del archivo de evidencia de una ruta: `/a/b` → `a-b`. */
function slugOf(route: string): string {
  const slug = route.replace(/^\//, '').replace(/\//g, '-');
  return slug === '' ? 'root' : slug;
}

/**
 * Entra a una ruta ofrecida y comprueba que haya pantalla del otro lado.
 *
 * Se navega por el router y no recargando: cada carga completa cuesta un canje
 * de refresh token, y ese también está limitado a diez por minuto.
 */
async function visitAccess(page: Page, actorFolder: string, access: PanelAccess): Promise<void> {
  // Las respuestas con error se anotan pero **no fallan por sí solas**: una
  // pantalla sin datos todavía puede recibir un 404 legítimo de la API y estar
  // perfectamente dibujada. Sirven para explicar un fallo, no para provocarlo.
  const httpErrors: string[] = [];
  const noteHttpError = (response: Response): void => {
    if (response.status() >= 400) {
      httpErrors.push(`${response.status()} ${response.url()}`);
    }
  };
  page.on('response', noteHttpError);

  const where = `«${access.label}» (${access.route}, zona «${access.zone}»)`;

  try {
    // Se recuerda qué había antes y se espera a que deje de estar: recién ahí
    // la red quieta habla de la pantalla nueva y no de la anterior.
    const previousScreen = await page.locator('main').innerText();
    await irA(page, access.route);
    await page
      .waitForFunction(
        (previous) => document.querySelector('main')?.innerText !== previous,
        previousScreen,
        { timeout: SCREEN_CHANGE_TIMEOUT_MS },
      )
      .catch((error: unknown) => {
        throw new Error(`${where}: la pantalla no cambió después de navegar`, { cause: error });
      });
    await estable(page);

    // La red quieta no siempre alcanza: hay bloques que piden después de
    // dibujar. Se espera a que la carga termine, con techo y sin fallar por
    // ella, para que la evidencia muestre la pantalla y no su andamio.
    await expect(page.locator(LOADING))
      .toHaveCount(0, { timeout: LOADING_TIMEOUT_MS })
      .catch(() => undefined);

    // La captura va antes de las aserciones: si algo cae, la evidencia de lo
    // que se vio es justamente lo que hace falta para entenderlo.
    const folder = join(SCREENSHOTS, actorFolder);
    mkdirSync(folder, { recursive: true });
    await page.screenshot({ path: join(folder, `${slugOf(access.route)}.png`), fullPage: true });

    // La ruta o una hija suya (`/a` admite `/a/b`, no `/ab`): una sección que
    // abre en su subruta sigue abriendo; un rebote a otra sección, no.
    const pathname = new URL(page.url()).pathname;
    expect(
      pathname === access.route || pathname.startsWith(`${access.route}/`),
      `${where}: el acceso no abre su ruta, la aplicación terminó en ${pathname}`,
    ).toBe(true);

    await expect(
      page.locator(DEAD_END),
      `${where}: el acceso cae en una pantalla vacía (hueco de sección, «no encontrada» o error)`,
    ).toHaveCount(0);

    // Una pantalla real se identifica: con su encabezado o, si todavía no tiene
    // datos que mostrar, con el estado vacío de la aplicación. Ese estado vacío
    // no es un acceso muerto (paso 3 de la tarjeta): es una pantalla definida
    // que espera datos. Caso encontrado: «Chats» sin perfil público ofrece crear
    // el perfil ahí mismo y no dibuja encabezado.
    const identity = page.locator(SCREEN_IDENTITY).first();
    await expect(
      identity,
      `${where}: la pantalla no muestra ni encabezado ni estado vacío`,
    ).toBeVisible();
    expect(
      (await identity.innerText()).trim(),
      `${where}: la pantalla se identifica con un texto vacío`,
    ).not.toBe('');

    // El rechazo por rol no se busca en el texto: la guarda de la sección
    // redirige, y eso ya lo atrapa la comprobación de la ruta. Un bloque que
    // recibe 403 dentro de una pantalla real («Tu organización» le muestra a la
    // médica sus datos y le niega solo las solicitudes de ingreso) no es un
    // acceso muerto; esos 403 quedan anotados y acompañan a cualquier fallo.
  } catch (failure) {
    const detail = failure instanceof Error ? failure.message : String(failure);
    const errors = httpErrors.length > 0 ? httpErrors.join(' · ') : 'ninguna';
    throw new Error(`${detail}\n\nRespuestas con error durante la visita: ${errors}`, {
      cause: failure,
    });
  } finally {
    page.off('response', noteHttpError);
  }
}

/** Entra con la sesión del actor y deja el panel a la vista. */
async function openPanel(page: Page, actor: Actor): Promise<void> {
  await entrar(page, actor);
  await irA(page, '/dashboard');
  await estable(page);
}

/** Recorre todo lo que el panel le ofrece a un actor, uno por uno. */
async function sweep(page: Page, actorFolder: string, accesses: PanelAccess[]): Promise<void> {
  for (const access of accesses) {
    await visitAccess(page, actorFolder, access);
  }
}

test.describe('ALV-054 · every panel access opens a real screen', () => {
  test.beforeAll(async () => {
    // Sin backend cada prueba falla por un motivo distinto y ninguno dice la
    // verdad, que es que no hay API. Se dice una vez y en voz alta.
    const api: APIRequestContext = await contextoDeApi();
    expect(await apiViva(api), 'la API tiene que estar viva').toBe(true);
    await api.dispose();
  });

  test('practitioner: every access of the tree opens a screen', async ({ page }) => {
    test.setTimeout(SWEEP_TIMEOUT_MS);

    await openPanel(page, doctora());

    const accesses = await collectAccesses(page);
    expect(accesses.length, 'la doctora no vio ni un acceso en el panel').toBeGreaterThan(0);

    await sweep(page, 'practitioner', accesses);
  });

  // Hasta el 23/09/2026 el panel del paciente sumaba su propia grilla de
  // accesos («Ir a lo tuyo»); se retiró a pedido del doctor (P-03), así que
  // los accesos del paciente son sólo los del árbol, como en los otros roles.
  test('patient: every access of the tree opens a screen', async ({ page }) => {
    test.setTimeout(SWEEP_TIMEOUT_MS);

    // El paciente se da de alta en la corrida: las cuentas de paciente de la
    // base de desarrollo no tienen contraseña conocida, y probar a ciegas gasta
    // intentos contra el bloqueo de cuenta.
    const api: APIRequestContext = await contextoDeApi();
    const patient = await crearPaciente(api);
    await api.dispose();

    await openPanel(page, patient);

    const accesses = await collectAccesses(page);
    expect(accesses.length, 'el paciente no vio ni un acceso en el panel').toBeGreaterThan(0);

    await sweep(page, 'patient', accesses);
  });

  test('administrator: every access of the tree opens a screen', async ({ page }) => {
    test.setTimeout(SWEEP_TIMEOUT_MS);

    await openPanel(page, administrador());

    const accesses = await collectAccesses(page);
    expect(accesses.length, 'quien administra no vio ni un acceso en el panel').toBeGreaterThan(0);

    await sweep(page, 'administrator', accesses);
  });
});
