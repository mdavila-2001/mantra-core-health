import { expect, test, type Page } from '@playwright/test';
import { empezarElAlta } from './support/registro-paciente';

/**
 * El bloque de mapa de las altas (`app-map-location-picker`): calle y distrito
 * siempre visibles, reintento cuando la calle no llega, y punto fuera de
 * Bolivia sin dibujar el mapa de Bolivia (mantra-core-health#1501).
 *
 * Corre contra `ng serve` en modo mock (`yarn start:demo`): la calle sale del
 * DOBLE de `POST /public/geo/reverse` (`address-book.handlers.ts`), que la
 * marca «(simulada)». La caída de la API se simula con `mock:fallos`
 * (`core/mock/simulated-failures.ts`), porque el mock responde dentro de
 * Angular y `page.route` no ve esas peticiones. No prueba
 * la API real ni el geocodificador: eso queda en mantra-core-health-api#1027.
 *
 * Deja capturas en `artifacts/playwright/mapa-calle-distrito/`, por viewport y
 * por tema.
 */

const MAPA = 'registro-mapa-domicilio';
const CARPETA = 'artifacts/playwright/mapa-calle-distrito';

const VIEWPORTS = [
  { nombre: 'movil', width: 375, height: 812 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

const TEMAS = ['light', 'dark'] as const;

async function ponerPinEnCoordenadas(page: Page, lat: string, lng: string): Promise<void> {
  const bloque = page
    .getByTestId(MAPA)
    .locator('xpath=ancestor::*[contains(@class,"registro__ubicacion")][1]');
  const toggle = bloque.getByTestId('location-coordinates-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await bloque.getByTestId('location-coordinates-lat').fill(lat);
  await bloque.getByTestId('location-coordinates-lng').fill(lng);
  await bloque.getByTestId('location-coordinates-apply').click();
}

function campo(page: Page, testId: string) {
  return page.locator(`[data-testid="${testId}"] textarea`).first();
}

async function capturar(page: Page, nombre: string): Promise<void> {
  // La botonera del modo demo flota encima del contenido y tapaba justo lo
  // que hay que mirar; en la captura no aporta nada.
  await page.addStyleTag({ content: 'app-mock-banner { display: none !important; }' });
  // El bloque entero, no la ventana: en móvil la ventana cortaba la ficha y
  // el aviso a la mitad (segunda pasada de la revisión visual).
  const bloque = page.locator(`[data-testid="${MAPA}-deducido"]`);
  await bloque.scrollIntoViewIfNeeded();
  await bloque.screenshot({ path: `${CARPETA}/${nombre}.png` });
  await page.screenshot({ path: `${CARPETA}/${nombre}-ventana.png`, fullPage: false });
}

for (const tema of TEMAS) {
  for (const vp of VIEWPORTS) {
    test.describe(`mapa — calle y distrito (${tema}, ${vp.nombre})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height }, colorScheme: tema });

      // El tema lo elige `ThemeService` desde `localStorage`, no el sistema:
      // por defecto es claro aunque el navegador pida oscuro.
      let errores: string[] = [];
      test.beforeEach(async ({ page }) => {
        await page.addInitScript((t) => {
          localStorage.setItem('mantra-core-health.theme', t);
        }, tema);
        errores = [];
        page.on('console', (m) => {
          if (m.type() === 'error') errores.push(m.text());
        });
      });

      // Consola limpia en los tres casos. Las teselas de OSM no se alcanzan
      // desde el entorno de prueba, y la caída simulada responde 503 a
      // propósito: esos errores de red no son del componente.
      test.afterEach(() => {
        expect(
          errores.filter(
            (e) =>
              !/tile\.openstreetmap|ERR_|Failed to load resource/.test(e) &&
              // El fallo que la prueba de la caída provoca a propósito, y sólo ése.
              !/^\[API\] POST \/public\/geo\/reverse → 500 .*correlationId=mock-fallo/.test(e),
          ),
        ).toEqual([]);
      });

      test('en Bolivia, calle y distrito salen del punto', async ({ page }) => {
        await empezarElAlta(page);
        await ponerPinEnCoordenadas(page, '-17,7833', '-63,1821');

        await expect(campo(page, 'registration-home-geocoding-notice')).toHaveValue(
          /Calle de demostración/,
        );
        await expect(campo(page, `${MAPA}-distrito`)).toHaveValue(/Distrito \d+ \(simulado\)/);
        await expect(page.getByTestId(`${MAPA}-localidad-ficha-municipio`)).toBeVisible();
        await expect(page.getByTestId(`${MAPA}-fuera-de-bolivia`)).toHaveCount(0);
        await capturar(page, `bolivia-${tema}-${vp.nombre}`);
      });

      test('mientras busca lo dice, y donde no hay calle ni distrito lo dice sin inventarlos', async ({
        page,
      }) => {
        await empezarElAlta(page);
        // Zona rural en La Guardia (Santa Cruz): el doble de demo
        // responde sin calle ni distrito.
        await ponerPinEnCoordenadas(page, '-17,92', '-63,31');
        await expect(campo(page, 'registration-home-geocoding-notice')).toHaveValue(/Buscando/);
        await expect(campo(page, `${MAPA}-distrito`)).toHaveValue(/Buscando/);
        await capturar(page, `buscando-${tema}-${vp.nombre}`);
        // La captura tiene que haber salido ANTES de la respuesta: si el estado
        // ya cambió, la imagen puede mostrar otro y la prueba no lo vería.
        await expect(campo(page, 'registration-home-geocoding-notice')).toHaveValue(/Buscando/, {
          timeout: 0,
        });

        await expect(campo(page, 'registration-home-geocoding-notice')).toHaveValue(
          /no tiene un nombre de calle/,
        );
        await expect(campo(page, `${MAPA}-distrito`)).toHaveValue(/no tiene un distrito/);
        await expect(page.getByTestId(`${MAPA}-fuera-de-bolivia`)).toHaveCount(0);
        await expect(page.getByTestId(`${MAPA}-localidad-ficha-municipio`)).toBeVisible();
        await capturar(page, `sin-distrito-${tema}-${vp.nombre}`);
      });

      test('fuera de Bolivia, avisa y no dibuja el mapa de Bolivia', async ({ page }) => {
        await empezarElAlta(page);
        await ponerPinEnCoordenadas(page, '40,4168', '-3,7038');

        const aviso = page.getByTestId(`${MAPA}-fuera-de-bolivia`);
        await expect(aviso).toBeVisible();
        await expect(aviso).toContainText('Por el momento sólo operamos en Bolivia');
        // El aviso dice «para continuar»: confirmar ese punto no se puede.
        const confirmar = page.getByTestId('registro-confirmar-direccion');
        await expect(confirmar).toHaveAttribute('aria-disabled', 'true');
        // Quien llega al botón con el teclado oye por qué está deshabilitado.
        await expect(confirmar).toHaveAccessibleDescription(/sólo operamos en Bolivia/);
        await expect(page.getByTestId(`${MAPA}-localidad-mapa`)).toHaveCount(0);
        await expect(campo(page, 'registration-home-geocoding-notice')).toHaveValue(
          /Calle de demostración/,
        );
        await expect(campo(page, `${MAPA}-distrito`)).toHaveValue(/Distrito/);
        await capturar(page, `fuera-${tema}-${vp.nombre}`);
      });

      test('si la API cae, la calle sale del respaldo del navegador (Nominatim)', async ({
        page,
      }) => {
        // Nominatim no se alcanza desde el entorno de prueba: se responde acá,
        // con la forma real de su `jsonv2`. Que el pedido salga del navegador
        // es justo lo que se prueba.
        const pedidos: string[] = [];
        await page.route('https://nominatim.openstreetmap.org/reverse**', (route) => {
          pedidos.push(route.request().url());
          return route.fulfill({
            json: {
              address: {
                road: 'Avenida Virgen de Cotoca',
                neighbourhood: 'Condominio Kerana I',
                city: 'Santa Cruz de la Sierra',
                state: 'Santa Cruz',
                country_code: 'bo',
              },
            },
          });
        });
        await empezarElAlta(page);
        await page.evaluate(() =>
          sessionStorage.setItem(
            'mock:fallos',
            JSON.stringify([{ patron: '/public/geo/reverse', modo: 'error' }]),
          ),
        );
        await ponerPinEnCoordenadas(page, '-17,7605', '-63,13');

        await expect(campo(page, 'registration-home-geocoding-notice')).toHaveValue(
          'Avenida Virgen de Cotoca, Condominio Kerana I',
        );
        await expect(page.getByTestId(`${MAPA}-calle-caida`)).toHaveCount(0);
        expect(pedidos).toHaveLength(1);
        expect(pedidos[0]).toContain('lat=-17.7605');
        await capturar(page, `respaldo-${tema}-${vp.nombre}`);
      });

      test('si la API cae, lo dice y deja volver a buscar', async ({ page }) => {
        // Caído es caído también para el respaldo del navegador.
        await page.route('https://nominatim.openstreetmap.org/reverse**', (route) =>
          route.fulfill({ status: 503, body: '' }),
        );
        await empezarElAlta(page);
        await page.evaluate(() =>
          sessionStorage.setItem(
            'mock:fallos',
            JSON.stringify([{ patron: '/public/geo/reverse', modo: 'error' }]),
          ),
        );
        await ponerPinEnCoordenadas(page, '-16,5', '-68,15');

        await expect(campo(page, 'registration-home-geocoding-notice')).toHaveValue(
          'No disponible por ahora.',
        );
        await expect(campo(page, `${MAPA}-distrito`)).toHaveValue('No disponible por ahora.');
        await expect(page.getByTestId(`${MAPA}-calle-caida`)).toContainText(
          'No pudimos traer la calle ni el distrito',
        );
        await capturar(page, `caida-${tema}-${vp.nombre}`);

        await page.evaluate(() => sessionStorage.removeItem('mock:fallos'));
        // Con teclado, como lo haría quien no usa puntero.
        await page
          .getByTestId(`${MAPA}-reintentar-calle`)
          .locator('button')
          .or(page.getByTestId(`${MAPA}-reintentar-calle`))
          .first()
          .focus();
        await page.keyboard.press('Enter');
        await expect(campo(page, 'registration-home-geocoding-notice')).toHaveValue(
          /Calle de demostración/,
        );
        await expect(campo(page, `${MAPA}-distrito`)).toHaveValue(/Distrito \d+ \(simulado\)/);
        await expect(page.getByTestId(`${MAPA}-calle-caida`)).toHaveCount(0);
      });
    });
  }
}
