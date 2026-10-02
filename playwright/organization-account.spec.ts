/* ============================================================================
    La cuenta de una organización ES la organización (01/10/2026).

    Corre contra la **maqueta** (`mockBackend`) con `--workers=1` y `ng serve`
    en `E2E_BASE_URL`. Por cada tipo —farmacia, laboratorio, aseguradora— prueba
    lo que pidió el propietario:

      1. el menú no tiene ningún renglón «Ficha de …»;
      2. el avatar y el menú de la cuenta nombran a la organización, no a una
         persona;
      3. «Mi perfil» es la ficha de la organización, con sus datos a la vista;
      4. la dirección vieja de la ficha de la farmacia redirige a «Mi perfil».

    Las capturas van a `docs/progress/evidence/organization-account/`.
    ========================================================================== */

import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { CLAVE, type Actor } from './support/actores';
import { entrar } from './support/sesion';

const EVIDENCIA = join('docs', 'progress', 'evidence', 'organization-account');

interface CuentaDeOrganizacion {
  readonly clave: string;
  readonly correo: string;
  readonly organizacion: string;
  readonly iniciales: string;
  readonly titulo: string;
  readonly tipo: string;
}

const CUENTAS: readonly CuentaDeOrganizacion[] = [
  {
    clave: 'farmacia',
    correo: 'farmacia@alovida.mock',
    organizacion: 'Farmacia Vida',
    iniciales: 'FV',
    titulo: 'Perfil de la farmacia',
    tipo: 'Farmacia',
  },
  {
    clave: 'laboratorio',
    correo: 'laboratorio@alovida.mock',
    organizacion: 'Laboratorio Central',
    iniciales: 'LC',
    titulo: 'Perfil del laboratorio',
    tipo: 'Laboratorio o centro de diagnóstico',
  },
  {
    clave: 'aseguradora',
    correo: 'aseguradora@alovida.mock',
    organizacion: 'Seguros Andina',
    iniciales: 'SA',
    titulo: 'Perfil de la aseguradora',
    tipo: 'Aseguradora',
  },
];

function actorDe(cuenta: CuentaDeOrganizacion): Actor {
  return {
    rol: 'farmacia',
    identificador: cuenta.correo,
    clave: CLAVE,
    nombre: cuenta.organizacion,
  };
}

async function rutasDelMenu(page: Page): Promise<string[]> {
  return page
    .locator('nav a[data-route], header a[data-route]')
    .evaluateAll((enlaces) => enlaces.map((enlace) => enlace.getAttribute('data-route') ?? ''));
}

for (const cuenta of CUENTAS) {
  test.describe(`cuenta de organización · ${cuenta.clave}`, () => {
    test.beforeEach(async ({ page }) => {
      await entrar(page, actorDe(cuenta));
    });

    test('el menú no trae ninguna ficha: es «Mi perfil»', async ({ page }) => {
      const rutas = await rutasDelMenu(page);

      expect(rutas).toContain('/my-account');
      expect(rutas).not.toContain('/administration/pharmacy-profile');
      await expect(page.getByRole('link', { name: /^Ficha de/ })).toHaveCount(0);
    });

    test('el avatar y el menú de la cuenta nombran a la organización', async ({ page }) => {
      const avatar = page.getByTestId('header-cuenta');

      await expect(avatar).toHaveText(cuenta.iniciales);
      await expect(avatar).toHaveAttribute('aria-label', `Cuenta de ${cuenta.organizacion}`);

      await avatar.click();
      const menu = page.locator('#menu-cuenta');
      await expect(menu).toContainText(cuenta.organizacion);
      await expect(menu).toContainText(cuenta.tipo);
    });

    test('«Mi perfil» es la ficha de la organización', async ({ page }) => {
      await page.locator('a[data-route="/my-account"]').first().click();
      await page.waitForURL((url) => url.pathname === '/my-account', { timeout: 30_000 });

      await expect(page.getByRole('heading', { level: 1, name: cuenta.titulo })).toBeVisible();
      // No es el perfil de una persona.
      await expect(page.getByText('Tus datos, tu verificación de identidad')).toHaveCount(0);
      await expect(page.getByText(cuenta.organizacion).first()).toBeVisible();

      await page.screenshot({
        path: join(EVIDENCIA, `${cuenta.clave}-mi-perfil-1440.png`),
        fullPage: true,
      });
    });
  });
}

test.describe('la dirección vieja de la ficha de la farmacia', () => {
  test('redirige a «Mi perfil» y muestra sus tres pestañas', async ({ page }) => {
    await entrar(page, actorDe(CUENTAS[0]!));

    await page.goto('/administration/pharmacy-profile');
    await page.waitForURL((url) => url.pathname === '/my-account', { timeout: 30_000 });

    await expect(page.getByRole('tab', { name: 'Empresa' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Documentos' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Representante y gerentes' })).toBeVisible();
  });
});

test('control: el encabezado desborda a 375 px también en una pantalla que no se tocó', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await entrar(page, actorDe(CUENTAS[0]!));
  await page.goto('/administration/pharmacy');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();

  const encabezadoDesborda = await page.evaluate(() => {
    const derecha = document.querySelector('.app-header__derecha');
    return derecha !== null && derecha.getBoundingClientRect().right > window.innerWidth + 1;
  });
  // Se registra, no se exige: documenta que el desborde es del marco previo.
  console.log(`CONTROL encabezado desborda en /administration/pharmacy: ${encabezadoDesborda}`);
});

test.describe('responsive de «Mi perfil» de la farmacia', () => {
  for (const [nombre, ancho, alto] of [
    ['375', 375, 800],
    ['768', 768, 1024],
  ] as const) {
    test(`sin scroll horizontal a ${nombre}px`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: alto });
      await entrar(page, actorDe(CUENTAS[0]!));
      await page.goto('/my-account');
      await expect(page.getByRole('heading', { level: 1, name: 'Perfil de la farmacia' })).toBeVisible();

      // Con la ficha entera pintada: medir con el esqueleto da otra medida.
      await expect(page.getByRole('tab', { name: 'Empresa' })).toBeVisible();
      await page.evaluate(
        () =>
          new Promise<void>((listo) => {
            requestAnimationFrame(() => requestAnimationFrame(() => listo()));
          }),
      );

      // Se mide el contenido de la ficha, no el marco: el encabezado de la
      // aplicación desborda a 375 px con o sin esta ficha (ver la prueba de
      // control de abajo), y eso no es de este cambio.
      const medida = await page.evaluate(() => {
        const contenido = document.getElementById('contenido-principal');
        return {
          existe: contenido !== null,
          scroll: contenido?.scrollWidth ?? 0,
          cliente: contenido?.clientWidth ?? 0,
          derecha: contenido?.getBoundingClientRect().right ?? 0,
          ventana: window.innerWidth,
        };
      });
      expect(medida.existe).toBe(true);
      // El área de contenido no desborda por dentro ni se sale de la ventana.
      expect(medida.scroll, JSON.stringify(medida)).toBeLessThanOrEqual(medida.cliente + 1);
      expect(medida.derecha, JSON.stringify(medida)).toBeLessThanOrEqual(medida.ventana + 1);

      await page.screenshot({
        path: join(EVIDENCIA, `farmacia-mi-perfil-${nombre}.png`),
        fullPage: true,
      });
    });
  }
});
