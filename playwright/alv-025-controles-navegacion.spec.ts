import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, crearPaciente, doctora } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * ALV-025 — «Volver» en las pantallas profundas.
 *
 * Son las pantallas a las que se llega desde otra y que hasta ahora no tenían
 * ninguna salida que no fuera el botón del navegador. Lo que ninguna prueba
 * unitaria puede decir es lo que se comprueba acá: que en la aplicación de
 * verdad, con la sesión del rol que las ve, el control **está**, dice a dónde
 * lleva y hace lo que promete en los dos caminos de llegada.
 *
 * ## Los dos caminos, y por qué se miran los dos
 *
 * - **Se llegó navegando**: volver es *deshacer el paso*, así que la pila del
 *   navegador no crece. Es lo que distingue el control de un enlace más.
 * - **Se llegó de afuera** —enlace de un correo, marcador, recarga—: no hay paso
 *   propio que deshacer, así que se navega al destino de reserva y la pila sí
 *   crece. Sin esto, «Volver» sacaría a la persona de la aplicación.
 *
 * Por eso las aserciones miran `history.length` además de la dirección: las dos
 * llegadas terminan en la misma pantalla y sólo el largo de la pila las separa.
 *
 * ## Una prueba por actor, no una por pantalla
 *
 * `POST /iam/auth/login` admite diez por minuto y por IP. Cada rol entra una
 * vez y recorre de un tirón todo lo suyo.
 */

/** Dónde queda la evidencia del recorrido. `artifacts/` no se versiona. */
const SCREENSHOTS = join(__dirname, '..', 'artifacts', 'playwright', 'alv-025');

/** El control, tal como lo dibuja el átomo en el encabezado de la pantalla. */
const VOLVER = '[data-testid="volver"]';

/** Techo por prueba: cada pantalla entra dos veces y deja su captura. */
const RECORRIDO_TIMEOUT_MS = 10 * 60_000;

/** Una pantalla profunda y de dónde vino. */
interface PantallaProfunda {
  /** La dirección de la pantalla. */
  readonly ruta: string;
  /** El destino de reserva que el control promete. */
  readonly reserva: string;
  /** El texto que se lee en el control. */
  readonly texto: string;
}

/** Guarda la captura de lo que se está mirando. */
async function evidencia(page: Page, carpeta: string, nombre: string): Promise<void> {
  const destino = join(SCREENSHOTS, carpeta);
  mkdirSync(destino, { recursive: true });
  await page.screenshot({ path: join(destino, `${nombre}.png`), fullPage: true });
}

/** El nombre del archivo de evidencia de una ruta: `/a/b` → `a-b`. */
function slugDe(ruta: string): string {
  return ruta.replace(/^\//, '').replace(/\//g, '-') || 'raiz';
}

/** La dirección actual, sin origen ni parámetros. */
function rutaActual(page: Page): string {
  return new URL(page.url()).pathname;
}

/** Cuántas entradas tiene la pila del navegador ahora mismo. */
async function largoDeLaPila(page: Page): Promise<number> {
  return page.evaluate(() => window.history.length);
}

/**
 * El control existe, se lee y promete el destino de reserva.
 *
 * El `href` es la mitad que no depende del JavaScript: es lo que hace que el
 * clic con la rueda, «abrir en pestaña nueva» y el HTML del servidor sigan
 * llevando a algún lado.
 */
async function controlVisible(page: Page, pantalla: PantallaProfunda): Promise<void> {
  const control = page.locator(VOLVER).first();

  await expect(control, `${pantalla.ruta}: no hay salida en el encabezado`).toBeVisible();
  await expect(control, `${pantalla.ruta}: la salida no dice a dónde lleva`).toHaveText(
    pantalla.texto,
  );

  const destino = await control.getAttribute('href');
  expect(destino, `${pantalla.ruta}: la salida no tiene destino escrito`).not.toBeNull();
  expect(
    new URL(destino ?? '', page.url()).pathname,
    `${pantalla.ruta}: la salida promete un destino distinto del de reserva`,
  ).toBe(pantalla.reserva);
}

/**
 * Se llega **desde la pantalla de reserva** y se vuelve: tiene que deshacer el
 * paso, no apilar otro.
 */
async function vuelveDeshaciendoElPaso(
  page: Page,
  carpeta: string,
  pantalla: PantallaProfunda,
): Promise<void> {
  await irA(page, pantalla.reserva);
  await estable(page);

  await irA(page, pantalla.ruta);
  await estable(page);

  await controlVisible(page, pantalla);
  await evidencia(page, carpeta, slugDe(pantalla.ruta));

  const antes = await largoDeLaPila(page);
  await page.locator(VOLVER).first().click();
  await page.waitForURL((url) => new URL(url).pathname === pantalla.reserva, { timeout: 30_000 });
  await estable(page);

  expect(
    rutaActual(page),
    `${pantalla.ruta}: la salida no llevó a la pantalla de la que se vino`,
  ).toBe(pantalla.reserva);
  expect(
    await largoDeLaPila(page),
    `${pantalla.ruta}: volver apiló una entrada más en vez de deshacer el paso`,
  ).toBe(antes);
}

/**
 * Se llega **de afuera**, con la pantalla recién cargada: no hay paso propio que
 * deshacer, así que la salida navega a la reserva y la pila crece.
 */
async function vuelveALaReservaAlLlegarDeAfuera(
  page: Page,
  carpeta: string,
  pantalla: PantallaProfunda,
): Promise<void> {
  await page.goto(pantalla.ruta);
  await estable(page);

  await controlVisible(page, pantalla);
  await evidencia(page, carpeta, `${slugDe(pantalla.ruta)}-de-afuera`);

  const antes = await largoDeLaPila(page);
  await page.locator(VOLVER).first().click();
  await page.waitForURL((url) => new URL(url).pathname === pantalla.reserva, { timeout: 30_000 });
  await estable(page);

  expect(
    rutaActual(page),
    `${pantalla.ruta}: llegando de afuera la salida no llevó al destino de reserva`,
  ).toBe(pantalla.reserva);
  expect(
    await largoDeLaPila(page),
    `${pantalla.ruta}: llegando de afuera se retrocedió fuera de la aplicación en vez de navegar`,
  ).toBeGreaterThan(antes);
}

/**
 * Entra a la primera ficha del listado, si hay alguna.
 *
 * Las dos pantallas que se abren sobre un elemento concreto —la ficha de una
 * encuesta y el cuestionario que se responde— sólo existen cuando hay algo en
 * su listado. Cuando no lo hay, se anota y se sigue: inventar un identificador
 * probaría la pantalla de «no encontrada», no la pantalla.
 */
async function abrirPrimeraFicha(page: Page, listado: string): Promise<string | null> {
  await irA(page, listado);
  await estable(page);

  const fichas = page.locator(`a[href^="${listado}/"]`);
  if ((await fichas.count()) === 0) {
    test.info().annotations.push({
      type: 'sin-datos',
      description: `${listado} no ofrece ninguna ficha en este entorno: su pantalla de detalle no se pudo mirar`,
    });
    return null;
  }

  await fichas.first().click();
  await estable(page);

  const abierta = rutaActual(page);
  return abierta === listado ? null : abierta;
}

test.describe('ALV-025 · las pantallas profundas tienen salida', () => {
  test.beforeAll(async () => {
    const api: APIRequestContext = await contextoDeApi();
    expect(await apiViva(api), 'la API tiene que estar viva').toBe(true);
    await api.dispose();
  });

  test('practitioner: cada pantalla profunda suya tiene su vuelta', async ({ page }) => {
    test.setTimeout(RECORRIDO_TIMEOUT_MS);

    await entrar(page, doctora());

    const bloqueos: PantallaProfunda = {
      ruta: '/schedule/blocks',
      reserva: '/schedule',
      texto: 'Volver a mi agenda',
    };
    const pantallas: readonly PantallaProfunda[] = [
      bloqueos,
      { ruta: '/my-account/preview', reserva: '/my-account', texto: 'Volver a tu perfil' },
      { ruta: '/my-account/articles', reserva: '/my-account', texto: 'Volver a tu perfil' },
    ];

    for (const pantalla of pantallas) {
      await vuelveDeshaciendoElPaso(page, 'practitioner', pantalla);
    }

    // La llegada de afuera se mira una vez por rol: cada carga completa cuesta
    // un canje de refresh token, y ése está limitado a diez por minuto y por IP.
    await vuelveALaReservaAlLlegarDeAfuera(page, 'practitioner', bloqueos);

    const encuesta = await abrirPrimeraFicha(page, '/questionnaires');
    if (encuesta !== null) {
      await controlVisible(page, {
        ruta: encuesta,
        reserva: '/questionnaires',
        texto: 'Volver a las encuestas',
      });
      await evidencia(page, 'practitioner', 'questionnaires-detalle');

      const antes = await largoDeLaPila(page);
      await page.locator(VOLVER).first().click();
      await page.waitForURL((url) => new URL(url).pathname === '/questionnaires', {
        timeout: 30_000,
      });

      expect(
        await largoDeLaPila(page),
        'la ficha de la encuesta apiló una entrada en vez de deshacer el paso',
      ).toBe(antes);
    }
  });

  test('patient: cada pantalla profunda suya tiene su vuelta', async ({ page }) => {
    test.setTimeout(RECORRIDO_TIMEOUT_MS);

    // Se da de alta en la corrida: las cuentas de paciente de la base de
    // desarrollo no tienen contraseña conocida, y probar a ciegas gasta
    // intentos contra el bloqueo de cuenta.
    const api: APIRequestContext = await contextoDeApi();
    const paciente = await crearPaciente(api);
    await api.dispose();

    await entrar(page, paciente);

    const edicion: PantallaProfunda = {
      ruta: '/my-account/profile/edit',
      reserva: '/my-account',
      texto: 'Volver a tu perfil',
    };

    await vuelveDeshaciendoElPaso(page, 'patient', edicion);
    await vuelveALaReservaAlLlegarDeAfuera(page, 'patient', edicion);

    const cuestionario = await abrirPrimeraFicha(page, '/my-account/questionnaires');
    if (cuestionario !== null) {
      await controlVisible(page, {
        ruta: cuestionario,
        reserva: '/my-account/questionnaires',
        texto: 'Volver a mis cuestionarios',
      });
      await evidencia(page, 'patient', 'my-account-questionnaires-detalle');
    }
  });
});
