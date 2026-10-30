import { expect, test, type Page, type Route } from '@playwright/test';

import type { Actor } from './support/actores';
import { esperarAplicacionLista, entrar } from './support/sesion';

/**
 * El distrito del profesional, de punta a punta contra la **API real**
 * (mantra-core-health-api#1036, ADR-0028).
 *
 * 1. **Alta con consultorio propio**: el distrito del consultorio viaja en
 *    `ownSite.address.district`, aparte de la calle; la API responde 201 y la
 *    pestaña «Dónde atiendo» muestra la sede con su distrito.
 * 2. **Perfil**: el distrito del domicilio sale del punto del mapa, viaja como
 *    `homeDistrict` en el `PATCH`, y al recargar la lectura lo devuelve.
 *
 * Exige el front en `start:real-api` y la API levantada:
 *
 *   E2E_API_REAL=1 E2E_BASE_URL=http://localhost:4289
 *
 * **Lo único simulado es el geocodificador** (`POST /public/geo/reverse`),
 * porque detrás está Nominatim, un tercero que el entorno de prueba no
 * alcanza (la API real responde `GEOCODING_PROVIDER_UNAVAILABLE`). El doble
 * respeta `ReverseGeocodingResponseDto` y cubre los tres niveles del contrato
 * (regla 65): con distrito (correcto), sin distrito (límite) y caído
 * (inválido). Alta, sesión, `PATCH`, persistencia y lecturas son reales.
 *
 * Deja capturas en `artifacts/playwright/distrito-profesional/`.
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
const CARPETA = 'artifacts/playwright/distrito-profesional';
const RUN = Date.now().toString(36).toUpperCase();
const CORREO = `medico.distrito.${RUN}@alovida.test`.toLowerCase();
const CLAVE = 'Medico-2026!';
const TITULO = '.paginated-form__titulo';

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL,
  'Omitido: hace falta E2E_API_REAL=1 con la API y el front en modo real-api. No es un verde.',
);
test.setTimeout(240_000);

/* ----------------------------------------------------- doble del geocodificador */

/** Un punto del mapa y lo que el doble responde para él. */
interface PuntoDePrueba {
  readonly lat: number;
  readonly lng: number;
  readonly calle: string;
  /** `undefined`: el proveedor no conoce distrito en ese punto (límite). */
  readonly distrito?: string;
}

// Puntos dentro de Santa Cruz de la Sierra: la geometría de municipios del
// front los ubica sin red, así que el municipio sale igual que en producción.
const CONSULTORIO: PuntoDePrueba = {
  lat: -17.765,
  lng: -63.199,
  calle: 'Calle Warnes 45',
  distrito: 'Equipetrol',
};
const DOMICILIO_ALTA: PuntoDePrueba = {
  lat: -17.7833,
  lng: -63.1821,
  calle: 'Calle Sucre 120',
  distrito: 'Centro',
};
// Uno por viewport: cada prueba tiene que ser un cambio real, o el editor —con
// razón— no manda lo que ya está guardado.
const DOMICILIOS_NUEVOS = {
  'light-movil': {
    lat: -17.8,
    lng: -63.17,
    calle: 'Av. Santos Dumont 800',
    distrito: 'Las Palmas',
  },
  'light-tablet': { lat: -17.755, lng: -63.195, calle: 'Calle Los Pinos 15', distrito: 'Sirari' },
  'light-escritorio': {
    lat: -17.79,
    lng: -63.21,
    calle: 'Av. Piraí 450',
    distrito: 'Barrio Lindo',
  },
  'dark-movil': {
    lat: -17.775,
    lng: -63.175,
    calle: 'Calle Ayacucho 300',
    distrito: 'Casco Viejo',
  },
  'dark-tablet': { lat: -17.76, lng: -63.18, calle: 'Av. Beni 1200', distrito: 'Urbarí' },
  'dark-escritorio': {
    lat: -17.795,
    lng: -63.185,
    calle: 'Calle Libertad 77',
    distrito: 'Plan 3000',
  },
} as const satisfies Record<string, PuntoDePrueba>;
const DOMICILIO_SIN_DISTRITO: PuntoDePrueba = {
  lat: -17.81,
  lng: -63.16,
  calle: 'Calle 4 Oeste 12',
};
const DOMICILIO_CAIDO = { lat: -17.77, lng: -63.19 };

const PUNTOS = [
  CONSULTORIO,
  DOMICILIO_ALTA,
  ...Object.values(DOMICILIOS_NUEVOS),
  DOMICILIO_SIN_DISTRITO,
];

function cerca(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-4;
}

/**
 * Responde `POST /public/geo/reverse` con la forma de
 * `ReverseGeocodingResponseDto`. El punto «caído» devuelve el 503 que la API
 * real da cuando el proveedor no responde.
 */
async function geocodificadorDeDoble(page: Page): Promise<void> {
  await page.route('**/public/geo/reverse', async (route: Route) => {
    const { latitude, longitude } = route.request().postDataJSON() as {
      latitude: number;
      longitude: number;
    };
    if (cerca(latitude, DOMICILIO_CAIDO.lat) && cerca(longitude, DOMICILIO_CAIDO.lng)) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'DEPENDENCY_UNAVAILABLE',
          reason: 'GEOCODING_PROVIDER_UNAVAILABLE',
          message: 'No pudimos traer el nombre de la calle. Puede escribirla a mano.',
          correlationId: 'doble-geocodificador',
        }),
      });
      return;
    }
    const punto = PUNTOS.find((p) => cerca(p.lat, latitude) && cerca(p.lng, longitude));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        punto === undefined
          ? { found: false, attribution: '© OpenStreetMap (doble de prueba)' }
          : {
              found: true,
              line: [punto.calle, punto.distrito].filter(Boolean).join(', '),
              road: punto.calle.replace(/\s\d+$/, ''),
              houseNumber: punto.calle.match(/\d+$/)?.[0],
              city: 'Santa Cruz de la Sierra',
              countryCode: 'BO',
              adminAreas: {
                level1: 'Santa Cruz',
                level2: 'Provincia Andrés Ibáñez',
                level3: 'Santa Cruz de la Sierra',
                ...(punto.distrito === undefined ? {} : { district: punto.distrito }),
              },
              attribution: '© OpenStreetMap (doble de prueba)',
            },
      ),
    });
  });
}

/* ------------------------------------------------------------------- utilidades */

/** Las coordenadas como las escribe una persona en la configuración regional del país. */
function coma(n: number): string {
  return String(n).replace('.', ',');
}

/**
 * Pone el pin por coordenadas en el selector cuyo mapa es `mapaId` y lo
 * confirma con el botón `confirmarId`.
 */
async function ponerYConfirmar(
  page: Page,
  mapaId: string,
  confirmarId: string,
  punto: { lat: number; lng: number },
): Promise<void> {
  const bloque = page
    .getByTestId(mapaId)
    .locator('xpath=ancestor::*[contains(@class,"registro__ubicacion")][1]');
  const toggle = bloque.getByTestId('location-coordinates-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await bloque.getByTestId('location-coordinates-lat').fill(coma(punto.lat));
  await bloque.getByTestId('location-coordinates-lng').fill(coma(punto.lng));
  await bloque.getByTestId('location-coordinates-apply').click();
  const confirmar = page.getByTestId(confirmarId);
  await expect(confirmar).not.toHaveAttribute('aria-disabled', 'true', { timeout: 20_000 });
  await confirmar.click();
}

function deducido(page: Page, mapaId: string, cual: 'distrito' | 'calle', avisoId: string) {
  const testId = cual === 'distrito' ? `${mapaId}-distrito` : avisoId;
  return page.locator(`[data-testid="${testId}"] textarea`).first();
}

async function continuar(page: Page): Promise<void> {
  const boton = page.getByTestId('paginated-form-continuar').last();
  await expect(boton).toBeEnabled({ timeout: 20_000 });
  await boton.click();
}

async function enLaPagina(page: Page, titulo: string): Promise<void> {
  await expect(page.locator(TITULO).first()).toContainText(titulo, { timeout: 20_000 });
}

/** Abre un desplegable por su nombre accesible y elige la opción, como una persona. */
async function elegir(page: Page, nombre: RegExp, opcion: string | RegExp): Promise<void> {
  const combo = page.getByRole('combobox', { name: nombre });
  await combo.click();
  await page.getByRole('option', { name: opcion }).first().click();
  await expect(combo).not.toHaveText(/^Elija/);
}

async function sinBanner(page: Page): Promise<void> {
  await page.addStyleTag({ content: 'app-mock-banner { display: none !important; }' });
}

/** Errores de consola que no son del producto: las teselas de OSM no se alcanzan. */
function erroresPropios(errores: readonly string[]): string[] {
  return errores.filter(
    (e) =>
      !/tile\.openstreetmap|ERR_|Failed to load resource/.test(e) &&
      // El 503 del geocodificador caído, provocado a propósito por el doble.
      !/public\/geo\/reverse.*(503|correlationId=doble-geocodificador)/.test(e),
  );
}

/* ------------------------------------------------------------------------ alta */

test('alta: el distrito del consultorio viaja aparte de la calle y la sede lo muestra', async ({
  page,
}) => {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await geocodificadorDeDoble(page);

  await page.goto('/auth/register/practitioner');
  await esperarAplicacionLista(page);

  await enLaPagina(page, 'Su nombre y su cédula');
  await page.getByTestId('registro-pro-nombre').fill('Ana');
  await page.getByTestId('registro-pro-apellido-paterno').fill('Paz');
  await page.getByTestId('registro-pro-documento').fill(`D${RUN}`);
  await elegir(page, /Departamento de emisión/, 'Santa Cruz');
  await continuar(page);

  await enLaPagina(page, 'Sus datos y su acceso');
  await elegir(page, /Sexo/, /Femenino|Mujer/);
  const fecha = page.getByPlaceholder('DD/MM/AAAA');
  await fecha.click();
  await page.keyboard.type('12051985', { delay: 60 });
  await expect(fecha).toHaveValue('12/05/1985');
  await page.getByTestId('registro-pro-celular-personal').fill('70012345');
  await page.getByTestId('registro-pro-correo-personal').fill(CORREO);
  await page.getByTestId('registro-pro-password').fill(CLAVE);
  await continuar(page);

  await enLaPagina(page, '¿Dónde vive?');
  await ponerYConfirmar(
    page,
    'registration-practitioner-home-map',
    'registration-practitioner-home-location-confirm',
    DOMICILIO_ALTA,
  );
  await continuar(page);

  await enLaPagina(page, 'Su trabajo');
  await continuar(page);

  await enLaPagina(page, 'Su consultorio propio');
  await page.getByTestId('registration-practitioner-office-name').fill('Consultorio Paz');
  await ponerYConfirmar(
    page,
    'registration-practitioner-office-map',
    'registration-practitioner-office-location-confirm',
    CONSULTORIO,
  );
  await expect(deducido(page, 'registration-practitioner-office-map', 'distrito', '')).toHaveValue(
    'Equipetrol',
  );
  await sinBanner(page);
  await page
    .getByTestId('registration-practitioner-office-map-deducido')
    .screenshot({ path: `${CARPETA}/alta-consultorio-distrito.png` });
  await continuar(page);

  await enLaPagina(page, 'Su título profesional');
  await page.getByTestId('registro-pro-titulo').getByRole('combobox').fill('Médico');
  await page.getByRole('option').first().click();
  await continuar(page);

  await enLaPagina(page, 'Su habilitación');
  await page.getByTestId('registro-pro-matricula').fill(`MP-${RUN}`);
  await page.getByTestId('registro-pro-credencial').fill(`T.I. ${RUN}`);
  // Para «Médico» el registro en el Colegio Médico es obligatorio.
  await page.getByTestId('registro-pro-colegio').fill(`CMB-${RUN}`);

  // Hasta la última página: lo que queda es opcional.
  const alta = page.waitForRequest(
    (r) => r.url().includes('/iam/auth/register-practitioner') && r.method() === 'POST',
    { timeout: 90_000 },
  );
  const respuesta = page.waitForResponse(
    (r) => r.url().includes('/iam/auth/register-practitioner') && r.request().method() === 'POST',
    { timeout: 90_000 },
  );
  for (let paso = 0; paso < 6; paso++) {
    const enviada = await Promise.race([
      alta.then(() => true),
      page.waitForTimeout(1_500).then(() => false),
    ]);
    if (enviada) break;
    await continuar(page);
  }

  const cuerpo = (await alta).postDataJSON() as {
    ownSite?: { address?: { lines?: string[]; district?: string; municipalityConceptId?: string } };
  };
  // UI → request: el distrito viaja en su campo y NO pegado a la calle.
  expect(cuerpo.ownSite?.address?.district).toBe('Equipetrol');
  expect(cuerpo.ownSite?.address?.lines).toEqual(['Calle Warnes 45']);
  expect(cuerpo.ownSite?.address?.municipalityConceptId).toBeTruthy();
  const r = await respuesta;
  expect(r.status(), await r.text()).toBe(201);
  await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 20_000 });

  expect(erroresPropios(errores)).toEqual([]);
});

/* ---------------------------------------------------------------------- perfil */

const MEDICO: Actor = {
  rol: 'doctora',
  identificador: CORREO,
  clave: CLAVE,
  nombre: 'Ana Paz (prueba)',
};

const MAPA_CASA = 'edicion-domicilio-mapa';

/** Abre «Editar perfil» en «Contacto». */
async function abrirContacto(page: Page): Promise<void> {
  await page.goto('/my-account/edit');
  await esperarAplicacionLista(page);
  await page
    .getByTestId('edicion-pestanas')
    .getByRole('tab', { name: /Contacto/ })
    .click();
  await expect(page.getByTestId(MAPA_CASA)).toBeAttached({ timeout: 20_000 });
}

/** Guarda «Contacto» y devuelve el cuerpo del `PATCH` y su estado. */
async function guardar(page: Page): Promise<{ cuerpo: Record<string, unknown>; estado: number }> {
  const [peticion, respuesta] = await Promise.all([
    page.waitForRequest(
      (r) => r.url().endsWith('/profiles/practitioners/me') && r.method() === 'PATCH',
    ),
    page.waitForResponse(
      (r) => r.url().endsWith('/profiles/practitioners/me') && r.request().method() === 'PATCH',
    ),
    page
      .getByTestId('presentacion-acciones')
      .getByRole('button', { name: 'Guardar cambios' })
      .click(),
  ]);
  return { cuerpo: peticion.postDataJSON() as Record<string, unknown>, estado: respuesta.status() };
}

/** Recarga y devuelve el domicilio que la API lee de la base. */
async function recargarYLeer(page: Page): Promise<{ lines?: string; district?: string }> {
  const [lectura] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/profiles/practitioners/me/summary') && r.status() === 200,
      { timeout: 30_000 },
    ),
    page.reload(),
  ]);
  await esperarAplicacionLista(page);
  const perfil = (await lectura.json()) as { homeAddress?: { lines?: string; district?: string } };
  return perfil.homeAddress ?? {};
}

test.describe('perfil: el distrito del domicilio', () => {
  let errores: string[] = [];
  test.beforeEach(async ({ page }) => {
    errores = [];
    page.on('console', (m) => {
      if (m.type() === 'error') errores.push(m.text());
    });
    await geocodificadorDeDoble(page);
  });
  test.afterEach(() => {
    expect(erroresPropios(errores)).toEqual([]);
  });

  test('lo que guardó el alta se lee de vuelta: domicilio y consultorio con su distrito', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page, MEDICO);
    await page.goto('/my-account/edit');
    await esperarAplicacionLista(page);
    const casa = await recargarYLeer(page);
    expect(casa).toMatchObject({ lines: 'Calle Sucre 120', district: 'Centro' });

    // «Dónde atiendo»: la sede lleva el distrito en su texto (API #1036).
    const [sedes] = await Promise.all([
      page.waitForResponse((r) => /\/practitioners\/[^/]+\/sites$/.test(new URL(r.url()).pathname)),
      page
        .getByTestId('edicion-pestanas')
        .getByRole('tab', { name: /Dónde atiendo/ })
        .click(),
    ]);
    const lista = (await sedes.json()) as
      { items?: { addressText?: string }[] } | { addressText?: string }[];
    const items = Array.isArray(lista) ? lista : (lista.items ?? []);
    // Calle y distrito; sin ciudad, porque el alta no la manda para el
    // consultorio (el municipio va por concepto, no por texto).
    expect(items.map((s) => s.addressText)).toContain('Calle Warnes 45, Equipetrol');
    await expect(page.getByText('Equipetrol').first()).toBeVisible();
    await sinBanner(page);
    await page.screenshot({ path: `${CARPETA}/donde-atiendo-escritorio.png`, fullPage: false });
  });

  for (const tema of ['light', 'dark'] as const)
    for (const vp of [
      { nombre: 'movil', width: 375, height: 812 },
      { nombre: 'tablet', width: 768, height: 1024 },
      { nombre: 'escritorio', width: 1440, height: 900 },
    ] as const) {
      test(`correcto (${tema}, ${vp.nombre}): un punto con distrito lo guarda y la recarga lo trae`, async ({
        page,
      }) => {
        // El tema lo elige `ThemeService` desde `localStorage`, no el sistema.
        await page.addInitScript((t) => localStorage.setItem('mantra-core-health.theme', t), tema);
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await entrar(page, MEDICO);
        await abrirContacto(page);
        const nuevo = DOMICILIOS_NUEVOS[`${tema}-${vp.nombre}`];
        await ponerYConfirmar(page, MAPA_CASA, 'edicion-domicilio-confirmar', nuevo);
        await expect(deducido(page, MAPA_CASA, 'distrito', '')).toHaveValue(nuevo.distrito);

        const { cuerpo, estado } = await guardar(page);
        expect(estado).toBe(200);
        // Calle sola y distrito aparte: el distrito no viaja dos veces.
        expect(cuerpo).toMatchObject({
          homeAddressLines: nuevo.calle,
          homeDistrict: nuevo.distrito,
        });

        const leido = await recargarYLeer(page);
        expect(leido).toEqual(
          expect.objectContaining({ lines: nuevo.calle, district: nuevo.distrito }),
        );
        await page
          .getByTestId('edicion-pestanas')
          .getByRole('tab', { name: /Contacto/ })
          .click();
        await expect(deducido(page, MAPA_CASA, 'distrito', '')).toHaveValue(nuevo.distrito, {
          timeout: 20_000,
        });
        await sinBanner(page);
        const bloque = page.getByTestId(`${MAPA_CASA}-deducido`);
        await bloque.scrollIntoViewIfNeeded();
        await bloque.screenshot({ path: `${CARPETA}/perfil-distrito-${tema}-${vp.nombre}.png` });
        await page.screenshot({
          path: `${CARPETA}/perfil-distrito-${tema}-${vp.nombre}-ventana.png`,
        });
      });
    }

  test('límite: un punto sin distrito lo quita, y la recarga ya no lo trae', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page, MEDICO);
    await abrirContacto(page);
    await ponerYConfirmar(page, MAPA_CASA, 'edicion-domicilio-confirmar', DOMICILIO_SIN_DISTRITO);
    await expect(deducido(page, MAPA_CASA, 'distrito', '')).toHaveValue(/no tiene un distrito/);

    const { cuerpo, estado } = await guardar(page);
    expect(estado).toBe(200);
    expect(cuerpo).toMatchObject({ homeDistrict: '' });

    const leido = await recargarYLeer(page);
    expect(leido.lines).toBe('Calle 4 Oeste 12');
    expect(leido.district).toBeUndefined();
    await sinBanner(page);
    await page
      .getByTestId('edicion-pestanas')
      .getByRole('tab', { name: /Contacto/ })
      .click();
    const bloque = page.getByTestId(`${MAPA_CASA}-deducido`);
    await bloque.scrollIntoViewIfNeeded();
    await bloque.screenshot({ path: `${CARPETA}/perfil-sin-distrito.png` });
  });

  test('inválido: con el geocodificador caído no se puede confirmar ni se toca el distrito', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrar(page, MEDICO);
    await abrirContacto(page);
    const bloque = page
      .getByTestId(MAPA_CASA)
      .locator('xpath=ancestor::*[contains(@class,"registro__ubicacion")][1]');
    const toggle = bloque.getByTestId('location-coordinates-toggle');
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await bloque.getByTestId('location-coordinates-lat').fill(coma(DOMICILIO_CAIDO.lat));
    await bloque.getByTestId('location-coordinates-lng').fill(coma(DOMICILIO_CAIDO.lng));
    await bloque.getByTestId('location-coordinates-apply').click();

    await expect(deducido(page, MAPA_CASA, 'distrito', '')).toHaveValue('No disponible por ahora.');
    await expect(page.getByTestId(`${MAPA_CASA}-calle-caida`)).toBeVisible();
    await sinBanner(page);
    const ficha = page.getByTestId(`${MAPA_CASA}-deducido`);
    await ficha.scrollIntoViewIfNeeded();
    await ficha.screenshot({ path: `${CARPETA}/perfil-geocodificador-caido.png` });

    // Lo guardado sigue igual: nadie mandó un `PATCH`.
    const leido = await recargarYLeer(page);
    expect(leido.lines).toBe('Calle 4 Oeste 12');
    expect(leido.district).toBeUndefined();
  });
});
