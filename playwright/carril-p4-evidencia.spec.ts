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

test.beforeAll(async ({ request }, info) => {
  mkdirSync(CARPETA, { recursive: true });

  // **El directorio tiene que estar respondiendo antes de disparar nada.**
  // Sin esta comprobación una API caída no rompe la corrida: la deja pasar y
  // produce veinte capturas del estado de error, que después alguien adjunta al
  // reporte como si fueran la pantalla. Una evidencia equivocada es peor que no
  // tener evidencia, porque nadie la vuelve a mirar.
  const base = info.project.use.baseURL ?? '';
  const respuesta = await request.get(`${base}/public/search?limit=1`).catch(() => null);
  const cuerpo = respuesta === null ? '' : await respuesta.text();

  expect(
    respuesta?.ok() === true && cuerpo.includes('items'),
    `El directorio público no responde en ${base}/public/search. Las capturas ` +
      'saldrían del estado de error y no servirían como evidencia. Levantá la ' +
      'API E2E y el proxy antes de correr esto.',
  ).toBe(true);
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

  test('los estados que no son «con datos», que son los que más se ven', async ({ page }) => {
    // En un catálogo a medio poblar el estado vacío es la pantalla más vista, y
    // su texto es lo que más distingue una pantalla de otra. Vale capturarlos
    // aparte para poder compararlos entre sí de un vistazo.
    await capturar(page, '/buscar/medicamentos', '16-vacio-medicamentos');
    await capturar(page, '/buscar/diagnostico', '17-vacio-diagnostico');

    // Los dos negativos, uno al lado del otro: tienen que ser indistinguibles.
    await capturar(page, '/p/doctor-oculto-e2e', '18-negativo-despublicado');
    await capturar(page, '/p/no-existe-jamas-e2e', '19-negativo-inexistente');
  });

  test('el tema oscuro, que el marco público ofrece y nadie mira', async ({ browser }) => {
    // El conmutador está en el header de las catorce pantallas públicas. Si el
    // tema oscuro estuviera roto se vería recién en producción, y de noche.
    const contexto = await browser.newContext({ colorScheme: 'dark' });
    const page = await contexto.newPage();

    await capturar(page, '/buscar', '20-oscuro-buscador');
    await capturar(page, '/p/doctor-uno-e2e', '21-oscuro-ficha');

    await contexto.close();
  });

  test('la superficie pública a 390 px, que es como se la ve de verdad', async ({ browser }) => {
    // El teléfono no es un caso extremo del diseño: es el caso normal de alguien
    // que busca un médico. La ficha V65 entrega desde 320 px y el header público
    // pasa a dos filas por debajo de 640.
    const contexto = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await contexto.newPage();

    await capturar(page, '/buscar', '13-movil-buscador');
    await capturar(page, '/p/doctor-uno-e2e', '14-movil-ficha');
    await capturar(page, '/buscar/profesionales', '22-movil-profesionales');
    await capturar(page, '/buscar/mapa', '23-movil-mapa');

    // A 390 px el header público pasa a dos filas: colapsar el buscador a un
    // icono no es salida cuando es el único control de navegación de toda la
    // superficie. Se comprueba que el campo siga siendo alcanzable.
    // Se localiza **por su id** y no por el texto del marcador: la pantalla de
    // resultados tiene su propia caja con el mismo texto, y buscar por marcador
    // devuelve dos elementos —el localizador queda ambiguo y la aserción falla
    // por eso, no porque el campo falte—.
    await page.goto('/buscar', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#buscador-publico')).toBeVisible();

    await contexto.close();
  });
});
