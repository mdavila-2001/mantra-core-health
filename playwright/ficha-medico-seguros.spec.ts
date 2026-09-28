import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Con qué seguros trabaja el médico, en la ficha que ve el paciente.
 *
 * ## Qué prueba
 *
 * La cadena entera, en el navegador: el padrón de la red de Alianza Seguros y
 * Nacional Seguros → el simulador de `GET /practitioners/:id/insurance-carriers`
 * → el cliente → la tarjeta proyectada en `/directory/:profileId`. Las
 * unitarias fijan cada eslabón; ésta mira que ninguno se corte.
 *
 * Se comprueba con nombres concretos —«AFI GOLD», «SALUD FLEXIBLE»— y no
 * contando filas: una lista de dos filas vacías pasaría un conteo.
 *
 * ## Los tres estados que un paciente puede encontrar
 *
 * 1. Con seguros: la médica de la red, con sus dos aseguradoras y sus planes.
 * 2. Sin seguros informados: la médica demo, que nadie dio de alta en una red.
 * 3. Falla la lectura: la tarjeta ofrece reintentar y el resto de la ficha
 *    sigue en pie (interruptor `mock:fallos` del simulador).
 *
 * Uso: `yarn pw --workers=1 ficha-medico-seguros`
 * Contra `E2E_BASE_URL`, o `http://localhost:4200`.
 */

const CAPTURAS = join(process.cwd(), 'artifacts', 'ficha-medico-seguros');

/** Abasto Vega Rosemary: en la red de Alianza (AFI GOLD, OASIS) y de Nacional (SALUD FLEXIBLE). */
const MEDICA_DE_LA_RED = '/directory/426b5d3e-4494-4582-af95-3004d04e9ae0';

/** La médica demo de la maqueta (`uuid('hpid-medica')`): ninguna aseguradora la tiene en su red. */
const MEDICA_SIN_RED = '/directory/be0f3a66-c03e-4eac-a416-c1068238d3d2';

const VISTAS = [
  { nombre: '375', width: 375, height: 812 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
] as const;

test.beforeAll(() => {
  mkdirSync(CAPTURAS, { recursive: true });
});

/** Sirve cualquier contraseña no vacía: el simulador no valida credenciales. */
async function entrarComoPaciente(pagina: Page): Promise<void> {
  await pagina.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await pagina.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

/** Abre la ficha y espera a la tarjeta de seguros. Nunca `networkidle`. */
async function abrirFicha(pagina: Page, ruta: string): Promise<Locator> {
  await pagina.goto(ruta, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  const tarjeta = pagina.getByTestId('practitioner-insurers');
  await expect(tarjeta.getByRole('heading', { name: 'Seguros con los que trabaja' })).toBeVisible({
    timeout: 60_000,
  });
  return tarjeta;
}

/**
 * El ruido conocido de `ng serve`: la CSP bloquea dos scripts en línea que el
 * servidor de desarrollo inyecta. Sale igual en `/dashboard`, que esta ficha no
 * toca (verificado el 27/09/2026), y otras suites lo filtran igual
 * (`carril-insurance-portability`). Se filtra **sólo** esa combinación: otra
 * violación de CSP sí haría fallar la prueba.
 */
function esRuidoDelServidorDeDesarrollo(texto: string): boolean {
  return texto.includes('Content Security Policy') && texto.includes('inline script');
}

/** Errores de consola de la página, sin el ruido conocido del servidor de desarrollo. */
function escucharErrores(pagina: Page): string[] {
  const errores: string[] = [];
  pagina.on('console', (mensaje) => {
    if (mensaje.type() === 'error' && !esRuidoDelServidorDeDesarrollo(mensaje.text())) {
      errores.push(mensaje.text());
    }
  });
  pagina.on('pageerror', (error) => errores.push(error.message));
  return errores;
}

/**
 * Nada de la tarjeta se sale de la pantalla: ni ella ni un chip de plan.
 *
 * Se mide la tarjeta y no `scrollWidth` de la página porque a 375 px la ficha
 * ya desborda **sin** esta tarjeta —el encabezado y la tira de pestañas
 * «Trayectoria / Credenciales»—: 443 px de ancho con ella y 443 sin ella,
 * medido el 27/09/2026. Ese defecto es previo y va por separado; esta prueba
 * no puede taparlo ni cargarlo a esta tarjeta.
 */
async function tarjetaDentroDeLaPantalla(tarjeta: Locator, ancho: number): Promise<void> {
  const derechaMaxima = await tarjeta.evaluate((nodo) =>
    Math.max(
      nodo.getBoundingClientRect().right,
      ...Array.from(nodo.querySelectorAll('*')).map((hijo) => hijo.getBoundingClientRect().right),
    ),
  );
  expect(derechaMaxima).toBeLessThanOrEqual(ancho);
}

test.describe('la ficha del médico dice con qué seguros trabaja', () => {
  test('con seguros: cada aseguradora con sus planes, pegada a la identidad', async ({ page }) => {
    const errores = escucharErrores(page);
    await entrarComoPaciente(page);
    const tarjeta = await abrirFicha(page, MEDICA_DE_LA_RED);

    const filas = tarjeta.getByTestId('practitioner-insurer');
    await expect(filas).toHaveCount(2);
    await expect(filas.nth(0)).toContainText('Alianza Seguros');
    await expect(filas.nth(0)).toContainText('AFI GOLD');
    await expect(filas.nth(0)).toContainText('OASIS');
    await expect(filas.nth(1)).toContainText('Nacional Seguros');
    await expect(filas.nth(1)).toContainText('SALUD FLEXIBLE');
    await expect(tarjeta.getByRole('list', { name: 'Planes de Alianza Seguros' })).toBeVisible();
    await expect(tarjeta).toContainText('Según la red médica que publica cada aseguradora');

    // Arriba, donde se decide: debajo de la portada y antes de la actividad.
    const portada = await page.locator('.profesional__portada').boundingBox();
    const seguros = await tarjeta.boundingBox();
    const actividad = await page
      .getByRole('heading', { name: 'Actividad en la plataforma' })
      .boundingBox();
    expect(portada!.y + portada!.height).toBeLessThanOrEqual(seguros!.y);
    expect(seguros!.y + seguros!.height).toBeLessThanOrEqual(actividad!.y);

    expect(errores).toEqual([]);
  });

  for (const vista of VISTAS) {
    test(`se lee sin desbordes en ${vista.nombre} px, en claro`, async ({ page }) => {
      await page.setViewportSize({ width: vista.width, height: vista.height });
      await page.addInitScript(() => localStorage.setItem('mantra-core-health.theme', 'light'));
      await entrarComoPaciente(page);
      const tarjeta = await abrirFicha(page, MEDICA_DE_LA_RED);
      await expect(tarjeta.getByTestId('practitioner-insurer')).toHaveCount(2);

      await tarjetaDentroDeLaPantalla(tarjeta, vista.width);
      const caja = await tarjeta.boundingBox();
      expect(caja!.x).toBeGreaterThanOrEqual(0);

      await tarjeta.scrollIntoViewIfNeeded();
      await tarjeta.screenshot({ path: join(CAPTURAS, `seguros-${vista.nombre}-claro.png`) });
      await page.screenshot({ path: join(CAPTURAS, `ficha-${vista.nombre}-claro.png`) });
    });
  }

  test('en oscuro mantiene la lectura', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('mantra-core-health.theme', 'dark'));
    await entrarComoPaciente(page);
    const tarjeta = await abrirFicha(page, MEDICA_DE_LA_RED);
    await expect(page.locator('html[data-theme="dark"]')).toHaveCount(1);
    await expect(tarjeta.getByTestId('practitioner-insurer')).toHaveCount(2);

    await tarjeta.scrollIntoViewIfNeeded();
    await tarjeta.screenshot({ path: join(CAPTURAS, 'seguros-1440-oscuro.png') });
    await page.screenshot({ path: join(CAPTURAS, 'ficha-1440-oscuro.png') });
  });

  test('sin seguros informados lo dice, y no que no acepte seguros', async ({ page }) => {
    await entrarComoPaciente(page);
    const tarjeta = await abrirFicha(page, MEDICA_SIN_RED);

    await expect(tarjeta).toContainText('Sin seguros informados');
    await expect(tarjeta).toContainText('Preguntá en el consultorio');
    await expect(tarjeta).not.toContainText(/no acepta/i);
    await expect(tarjeta.getByTestId('practitioner-insurer')).toHaveCount(0);

    await tarjeta.scrollIntoViewIfNeeded();
    await tarjeta.screenshot({ path: join(CAPTURAS, 'seguros-vacio-1440.png') });
  });

  test('si la lectura falla, sólo la tarjeta ofrece reintentar y la ficha sigue en pie', async ({
    page,
  }) => {
    await entrarComoPaciente(page);
    await page.evaluate(() =>
      sessionStorage.setItem(
        'mock:fallos',
        JSON.stringify([{ patron: '/insurance-carriers', modo: 'error' }]),
      ),
    );
    const tarjeta = await abrirFicha(page, MEDICA_DE_LA_RED);

    const reintentar = tarjeta.getByRole('button', { name: /reintentar/i });
    await expect(reintentar).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Actividad en la plataforma' })).toBeVisible();
    await tarjeta.scrollIntoViewIfNeeded();
    await tarjeta.screenshot({ path: join(CAPTURAS, 'seguros-error-1440.png') });

    // Se apaga el interruptor y el reintento trae los seguros sin recargar.
    await page.evaluate(() => sessionStorage.removeItem('mock:fallos'));
    await reintentar.click();
    await expect(tarjeta.getByTestId('practitioner-insurer')).toHaveCount(2);
  });
});
