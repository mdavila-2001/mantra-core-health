/* ============================================================================
    Promociones de farmacia con las 14 mecánicas, en un navegador.

    Corre contra la **maqueta** (`mockBackend`): entra `farmacia@alovida.mock`
    por la pantalla de ingreso, arma campañas de cada familia en el formulario
    nuevo y comprueba que lo publicado se ve en la lista releída y en la ficha
    pública. No necesita API ni Docker.

    Con `--workers=1` y `E2E_BASE_URL` apuntando al `ng serve` que esté arriba.
    Las capturas van a `docs/progress/evidence/promociones-mecanicas/`.
    ========================================================================== */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Locator, type Page } from '@playwright/test';

import { farmacia, type Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

const EVIDENCIA = join('docs', 'progress', 'evidence', 'promociones-mecanicas');

/**
 * En una máquina sin el Chromium de Playwright, `E2E_CHANNEL=chrome` usa el
 * Google Chrome instalado en vez de pedir una descarga. Sin la variable, el
 * comportamiento es el de siempre.
 */
test.use({ channel: process.env['E2E_CHANNEL'] || undefined });
const RUTA = '/administration/pharmacy-campaigns';

/** Los anchos que se miran: móvil estrecho, tableta, escritorio y una ventana baja. */
const VISTAS = [
  { nombre: '375', width: 375, height: 800 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '1280x680', width: 1280, height: 680 },
] as const;

const FAMILIAS = ['PRICE', 'QUANTITY', 'ORDER_TOTAL', 'COMBO', 'LOYALTY'] as const;

function seccionNueva(page: Page): Locator {
  return page.locator('section[aria-labelledby="campanas-nueva"]');
}

/** El nombre completo de cada familia, tal como lo dice el desplegable de pantalla angosta. */
const NOMBRE_DE_FAMILIA = {
  PRICE: 'Precio',
  QUANTITY: 'Cantidad',
  ORDER_TOTAL: 'Total de la compra',
  COMBO: 'Combos y regalos',
  LOYALTY: 'Fidelización',
} as const;

/** Debajo de 640 px (40 rem) el editor ofrece un desplegable; desde ahí, el control segmentado. */
const ANCHO_DEL_DESPLEGABLE = 640;

async function elegirFamilia(page: Page, familia: (typeof FAMILIAS)[number]): Promise<void> {
  const ancho = page.viewportSize()?.width ?? 1440;
  if (ancho < ANCHO_DEL_DESPLEGABLE) {
    await page
      .locator('[data-testid="regla-familias-select"] select')
      .selectOption({ label: NOMBRE_DE_FAMILIA[familia] });
    return;
  }
  await page.locator(`[data-testid="segmentado-${familia}"]`).click();
  await expect(page.locator(`[data-testid="segmentado-${familia}"]`)).toHaveAttribute('aria-checked', 'true');
}

/**
 * Los elementos **de la sección dada** que se salen del ancho de la ventana, con
 * lo justo para encontrarlos. Vacío = no desborda. Decir *cuál* desborda ahorra
 * el paso de adivinarlo.
 *
 * Se acota a la sección y no al documento entero a propósito: a 375 px la barra
 * superior de la cuenta de farmacia (`app-header__derecha`, 387 px) se sale por
 * sí sola, y eso no es del formulario que se está midiendo (ver el cierre del
 * carril: hallazgo ajeno, anotado).
 */
async function desbordes(page: Page, seccion: string): Promise<string[]> {
  return page.evaluate((selector) => {
    const ancho = window.innerWidth;
    const raiz = document.querySelector(selector);
    return Array.from(raiz?.querySelectorAll<HTMLElement>('*') ?? [])
      .filter((nodo) => {
        const caja = nodo.getBoundingClientRect();
        return caja.width > 0 && caja.right > ancho + 1;
      })
      .slice(0, 6)
      .map((nodo) => {
        const caja = nodo.getBoundingClientRect();
        return `${nodo.tagName.toLowerCase()}.${String(nodo.className).split(' ').slice(0, 2).join('.')} right=${Math.round(caja.right)} w=${Math.round(caja.width)}`;
      });
  }, seccion);
}

/**
 * El ruido conocido de `ng serve`: la CSP bloquea dos scripts en línea que el
 * servidor de desarrollo inyecta. Sale igual en `/auth`, que estas pantallas no
 * tocan, y otras suites lo filtran igual (`ficha-medico-seguros`). Se filtra
 * **sólo** esa combinación: otra violación de CSP sí haría fallar la prueba.
 */
function esRuidoDelServidorDeDesarrollo(texto: string): boolean {
  return texto.includes('Content Security Policy') && texto.includes('inline script');
}

test.describe('promociones: formulario con todas las mecánicas', () => {
  const errores: string[] = [];

  test.beforeEach(async ({ page }) => {
    mkdirSync(EVIDENCIA, { recursive: true });
    errores.length = 0;
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error' && !esRuidoDelServidorDeDesarrollo(mensaje.text())) {
        errores.push(mensaje.text());
      }
    });
    await entrar(page, farmacia() as Actor);
    await irA(page, RUTA);
    await expect(seccionNueva(page)).toBeVisible({ timeout: 30_000 });
  });

  test('el selector de dos opciones ya no está: hay cinco familias y catorce mecánicas', async ({ page }) => {
    await expect(page.getByText('Cómo se calcula el descuento')).toHaveCount(0);
    for (const familia of FAMILIAS) {
      await expect(page.locator(`[data-testid="segmentado-${familia}"]`)).toBeVisible();
    }
    // Recorrer las familias deja ver cada mecánica: 4 + 3 + 3 + 3 + 1 = 14.
    let total = 0;
    for (const familia of FAMILIAS) {
      await elegirFamilia(page, familia);
      total += await page.locator('[data-testid="regla-mecanicas"] input[type="radio"]').count();
    }
    expect(total).toBe(14);
  });

  for (const vista of VISTAS) {
    test(`se ve bien a ${vista.nombre} en claro`, async ({ page }) => {
      await page.setViewportSize({ width: vista.width, height: vista.height });
      await irA(page, RUTA);
      await expect(seccionNueva(page)).toBeVisible();
      for (const familia of FAMILIAS) {
        await elegirFamilia(page, familia);
        // Página completa y no el elemento: la barra superior es fija y recortaba
        // el borde del formulario en la captura.
        await page.screenshot({
          path: join(EVIDENCIA, `formulario-${familia}-${vista.nombre}-claro.png`),
          fullPage: true,
        });
        expect(
          await desbordes(page, 'section[aria-labelledby="campanas-nueva"]'),
          `desborde horizontal del formulario en ${familia} a ${vista.nombre}`,
        ).toEqual([]);
      }
    });
  }

  test('se ve bien en oscuro a 1440', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await irA(page, RUTA);
    await expect(seccionNueva(page)).toBeVisible();
    for (const familia of FAMILIAS) {
      await elegirFamilia(page, familia);
      await page.screenshot({ path: join(EVIDENCIA, `formulario-${familia}-1440-oscuro.png`), fullPage: true });
    }
  });

  test('la consola queda limpia', async () => {
    expect(errores).toEqual([]);
  });
});

/* ─── Publicar y releer: UI → lista → ficha pública ───────────────────────── */

const SUFIJO = String(Date.now()).slice(-6);

/** El campo de búsqueda del catálogo (el `placeholder` también lo lleva el host). */
function buscador(page: Page): Locator {
  return page.getByRole('textbox', { name: 'Buscar en tu catálogo' });
}

async function escribirTitulo(page: Page, titulo: string): Promise<void> {
  await page.getByRole('textbox', { name: /Título/ }).fill(titulo);
}

/** Busca en el catálogo de la farmacia y agrega el primer resultado. */
async function agregarPrimerProducto(page: Page, precioNormal: string): Promise<void> {
  await buscador(page).fill('a');
  await buscador(page).press('Enter');
  const candidatos = page.locator('[data-testid="campanas-candidatos"]');
  await expect(candidatos).toBeVisible({ timeout: 30_000 });
  await candidatos.getByRole('button', { name: 'Agregar' }).first().click();
  await page.getByRole('textbox', { name: 'Precio normal' }).first().fill(precioNormal);
}

async function publicar(page: Page): Promise<void> {
  await page.locator('[data-testid="campanas-publicar"]').click();
}

test.describe('promociones: publicar cada familia y verla como la ve el paciente', () => {
  test.beforeEach(async ({ page }) => {
    mkdirSync(EVIDENCIA, { recursive: true });
    await entrar(page, farmacia() as Actor);
    await irA(page, RUTA);
    await expect(seccionNueva(page)).toBeVisible({ timeout: 30_000 });
  });

  test('un 2x1: se publica, aparece en la lista con su etiqueta y la ficha lo explica', async ({ page }) => {
    const titulo = `2x1 E2E ${SUFIJO}`;
    await escribirTitulo(page, titulo);
    await elegirFamilia(page, 'QUANTITY');
    await agregarPrimerProducto(page, '50');
    await publicar(page);

    const lista = page.locator('[data-testid="campanas-lista"]');
    await expect(lista).toContainText(titulo, { timeout: 30_000 });
    await expect(lista).toContainText('2x1');

    await lista.getByRole('link', { name: titulo }).click();
    await page.waitForURL(/\/promotions\//);
    await expect(page.locator('[data-testid="promo-mecanica-etiqueta"]')).toHaveText('2x1');
    await expect(page.locator('[data-testid="promo-mecanica-frase"]')).toContainText('Llevá 2 y pagá 1.');
    await expect(page.locator('[data-testid="promo-ejemplo"]')).toContainText('pagás Bs 50 en vez de Bs 100');
    await page.screenshot({ path: join(EVIDENCIA, 'ficha-2x1-1440.png'), fullPage: true });
  });

  test('una compra mínima: no pide productos y la ficha lo dice', async ({ page }) => {
    const titulo = `Total E2E ${SUFIJO}`;
    await escribirTitulo(page, titulo);
    await elegirFamilia(page, 'ORDER_TOTAL');

    // Sin productos que elegir: el buscador desaparece y el formulario lo explica.
    await expect(buscador(page)).toHaveCount(0);
    await expect(page.locator('[data-testid="campanas-sin-productos"]')).toContainText('total de la compra');
    await publicar(page);

    const lista = page.locator('[data-testid="campanas-lista"]');
    await expect(lista).toContainText(titulo, { timeout: 30_000 });
    await lista.getByRole('link', { name: titulo }).click();
    await page.waitForURL(/\/promotions\//);
    await expect(page.locator('[data-testid="promo-sin-productos"]')).toContainText('vale sobre toda tu compra');
    await expect(page.locator('[data-testid="promo-ejemplo"]')).toContainText('En una compra justo en el mínimo');
  });

  test('un combo con dos productos: precio conjunto menor que la suma', async ({ page }) => {
    const titulo = `Combo E2E ${SUFIJO}`;
    await escribirTitulo(page, titulo);
    await elegirFamilia(page, 'COMBO');
    await buscador(page).fill('a');
    await buscador(page).press('Enter');
    const candidatos = page.locator('[data-testid="campanas-candidatos"]');
    await expect(candidatos).toBeVisible({ timeout: 30_000 });
    // Cada «Agregar» saca al producto de los candidatos: se agrega el primero dos veces.
    await candidatos.getByRole('button', { name: 'Agregar' }).first().click();
    await candidatos.getByRole('button', { name: 'Agregar' }).first().click();
    const precios = page.getByRole('textbox', { name: 'Precio normal' });
    await precios.nth(0).fill('30');
    await precios.nth(1).fill('20');
    await page.getByRole('spinbutton', { name: /Precio del combo/ }).fill('40');
    await publicar(page);

    const lista = page.locator('[data-testid="campanas-lista"]');
    await expect(lista).toContainText(titulo, { timeout: 30_000 });
    await expect(lista).toContainText('Combo');
    await lista.getByRole('link', { name: titulo }).click();
    await page.waitForURL(/\/promotions\//);
    await expect(page.locator('[data-testid="promo-ejemplo"]')).toContainText('pagás Bs 40 en vez de Bs 50');
  });

  test('un error se marca en su campo y se dice todo junto', async ({ page }) => {
    await escribirTitulo(page, `Error E2E ${SUFIJO}`);
    await page.locator('[data-testid="regla-porcentaje"] input').fill('0');
    await publicar(page);

    await expect(page.locator('[data-testid="campanas-fallos"]')).toContainText('producto');
    await expect(page.locator('[data-testid="regla-porcentaje"] input')).toHaveAttribute('aria-invalid', 'true');
    await expect(seccionNueva(page)).toContainText('El porcentaje tiene que ser un número entero entre 1 % y 99 %.');
  });

  test('las condiciones se guardan con la campaña y la ficha no regala el cupón', async ({ page }) => {
    const titulo = `Cupón E2E ${SUFIJO}`;
    await escribirTitulo(page, titulo);
    await agregarPrimerProducto(page, '40');
    await page.getByRole('button', { name: 'Condiciones opcionales' }).click();
    await page.getByRole('textbox', { name: /Código de cupón/ }).fill(`SECRETO${SUFIJO}`);
    await page.getByRole('spinbutton', { name: /Tope de descuento/ }).fill('15');
    await publicar(page);

    const lista = page.locator('[data-testid="campanas-lista"]');
    await expect(lista).toContainText(titulo, { timeout: 30_000 });
    await lista.getByRole('link', { name: titulo }).click();
    await page.waitForURL(/\/promotions\//);
    const condiciones = page.locator('[data-testid="promo-condiciones"]');
    await expect(condiciones).toContainText('Se necesita un cupón');
    await expect(condiciones).toContainText('Descuento máximo de Bs 15 por pedido.');
    await expect(page.locator('body')).not.toContainText(`SECRETO${SUFIJO}`);
  });
});
