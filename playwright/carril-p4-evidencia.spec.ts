import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * Capturas del carril P4, para el reporte.
 *
 * ## Qué es y qué no es
 *
 * **No es una prueba**: no afirma comportamiento, y por eso no vive junto a los
 * journeys. Recorre la superficie pública sin sesión y guarda una imagen por
 * pantalla en `artifacts/p4/`, que es lo que pide el carril para el reporte.
 *
 * Lo único que comprueba antes de disparar es que la pantalla **pintó** —el
 * `<h1>` visible—, para no guardar una captura de un cascarón vacío y adjuntarla
 * como evidencia de que algo funciona.
 *
 * Corre en el mismo origen que los journeys, así que las imágenes muestran lo
 * que muestra el producto y no una versión servida de otra forma.
 */

const CARPETA = join(process.cwd(), 'artifacts', 'p4');

test.beforeAll(() => {
  mkdirSync(CARPETA, { recursive: true });
});

/** Abre sin sesión, espera a que pinte y guarda la captura. */
async function capturar(page: Page, ruta: string, nombre: string): Promise<void> {
  await page.goto(ruta, { waitUntil: 'domcontentloaded' });
  await page.locator('h1').first().waitFor({ state: 'visible' });
  // La lista y las tarjetas entran por una lectura de red; sin esta espera la
  // captura sale con el esqueleto de carga, que es justo lo que no hay que
  // mostrar como evidencia.
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(CARPETA, `${nombre}.png`), fullPage: true });
}

test.describe('P4 · capturas de la superficie pública', () => {
  test('el recorrido completo, sin sesión', async ({ page }) => {
    await capturar(page, '/buscar', '01-buscador-unificado');
    await capturar(page, '/buscar?q=Mamani', '02-buscador-filtrado');
    await capturar(page, '/buscar/profesionales', '03-profesionales');
    await capturar(page, '/buscar/medicamentos', '04-medicamentos-vacio');
    await capturar(page, '/buscar/hospitales', '05-hospitales-vacio');
    await capturar(page, '/buscar/diagnostico', '06-diagnostico-vacio');
    await capturar(page, '/buscar/aseguradoras', '07-aseguradoras-vacio');
    await capturar(page, '/buscar/mapa', '08-mapa-consentimiento');
    await capturar(page, '/p/doctor-uno-e2e', '09-ficha-publica');
    await capturar(page, '/p/doctor-dos-e2e', '10-ficha-publica-dos');
    await capturar(page, '/p/doctor-oculto-e2e', '11-despublicado-404');
    await capturar(page, '/p/no-existe-jamas-e2e', '12-inexistente-404');

    // La captura sólo vale si la pantalla que muestra es la que se cree: se
    // comprueba el extremo del recorrido, que es el que la evidencia sostiene.
    await page.goto('/p/doctor-uno-e2e', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Marisol Quispe');

    // Y que el aviso de maqueta **no** esté acá: esta ficha trae el nombre, la
    // especialidad y la biografía de la API, y coronarla con «los filtros y
    // botones no consultan la API» sería decirle a un paciente que un dato
    // cierto es de mentira.
    await expect(page.getByText('Referencia de diseño')).toHaveCount(0);
  });

  test('el aviso de maqueta sigue marcando lo que sí es maqueta', async ({ page }) => {
    // La contracara del caso anterior, y la que impide que «quitar el aviso de
    // lo real» degenere en «quitar el aviso». Las 126 pantallas portadas de la
    // bóveda siguen siendo marcado estático y tienen que seguir dichas como
    // tales.
    await page.goto('/buscar/buscador-listado', { waitUntil: 'domcontentloaded' });
    await page.locator('h1').first().waitFor({ state: 'visible' });
    await expect(page.getByText('Referencia de diseño').first()).toBeVisible();
    await page.screenshot({
      path: join(CARPETA, '15-maqueta-sigue-marcada.png'),
      fullPage: true,
    });
  });

  test('la superficie pública a 390 px, que es como se la ve de verdad', async ({ browser }) => {
    // El teléfono no es un caso extremo del diseño: es el caso normal de alguien
    // que busca un médico. La ficha V65 entrega desde 320 px y el header público
    // pasa a dos filas por debajo de 640.
    const contexto = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await contexto.newPage();

    await capturar(page, '/buscar', '13-movil-buscador');
    await capturar(page, '/p/doctor-uno-e2e', '14-movil-ficha');

    await contexto.close();
  });
});
