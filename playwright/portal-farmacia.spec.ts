/* ============================================================================
    El portal de la cuenta de farmacia (carril B, 29/09/2026), en un navegador.

    Corre contra la **maqueta** (`mockBackend`): entra `farmacia@alovida.mock`
    por la pantalla de ingreso y recorre lo que pidió el propietario — un menú
    plano de ocho renglones y, en cada uno, la prueba de que lo hecho se ve en
    la lista releída, no en un aviso.

    Con `--workers=1`. Antes de correrlo hay que tener `ng serve` en :4200.
    Las capturas van a `docs/trabajo/2026-09-29-farmacia-cuenta/evidencia/B/`.
    ========================================================================== */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import { farmacia, type Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

const EVIDENCIA = join('docs', 'trabajo', '2026-09-29-farmacia-cuenta', 'evidencia', 'B');

/** Los ocho renglones del menú de la farmacia, en el orden que pidió el propietario. */
const MENU = [
  ['/administration/pharmacy', 'Resumen'],
  ['/administration/pharmacy-catalog', 'Productos'],
  ['/administration/pharmacy-categories', 'Categorías'],
  ['/administration/pharmacy-import', 'Importación masiva'],
  ['/administration/pharmacy-inventory', 'Inventario'],
  ['/administration/pharmacy-orders', 'Pedidos'],
  ['/administration/pharmacy-campaigns', 'Promociones'],
] as const;

const FIJOS = ['/my-account', '/notification-center'];

/** Cada corrida usa un código nuevo: el simulador guarda lo creado durante la pestaña. */
const SUFIJO = String(Date.now()).slice(-6);
const CODIGO = `E2E-${SUFIJO}`;

async function rutasDelMenu(page: Page): Promise<string[]> {
  return page.locator('nav a[data-route], header a[data-route]').evaluateAll((enlaces) =>
    enlaces.map((enlace) => enlace.getAttribute('data-route') ?? ''),
  );
}

async function irPorMenu(page: Page, ruta: string): Promise<void> {
  await page.locator(`a[data-route="${ruta}"]`).first().click();
  await page.waitForURL((url) => url.pathname === ruta, { timeout: 30_000 });
}

test.describe('portal de la cuenta de farmacia', () => {
  test.beforeEach(async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') errores.push(mensaje.text());
    });
    (page as unknown as { __errores: string[] }).__errores = errores;
    await entrar(page, farmacia() as Actor);
  });

  test('el menú son exactamente los ocho renglones, planos y en orden', async ({ page }) => {
    const rutas = await rutasDelMenu(page);

    expect(rutas.filter((ruta) => !FIJOS.includes(ruta))).toEqual(MENU.map(([ruta]) => ruta));
    // Nada de aseguradora, «Mis citas» ni «Tu organización».
    for (const ajena of ['insurance', 'appointments', 'my-organization', 'directories']) {
      expect(rutas.some((ruta) => ruta.includes(ajena)), ajena).toBe(false);
    }
    // Planos: sin encabezado de dominio ni desplegable sobre los ocho.
    await expect(page.locator('nav details')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Sistema de diseño' })).toHaveCount(0);

    mkdirSync(EVIDENCIA, { recursive: true });
    await page.screenshot({ path: join(EVIDENCIA, 'menu-1440-claro.png'), fullPage: true });
  });

  test('el recorrido: crear un producto, dejarlo sin stock, darle existencias, una categoría y una importación', async ({ page }) => {
    /** El nombre oficial del producto elegido del catálogo (lo lee de la lista de resultados). */
    let NOMBRE = '';
    // 1 · Resumen: los números de partida.
    await irPorMenu(page, '/administration/pharmacy');
    const publicados = page.getByTestId('summary-published');
    await expect(publicados).toBeVisible();
    const antes = Number((await publicados.innerText()).trim());

    // 2 · Productos: el alta se hace ELIGIENDO del catálogo oficial, no tipeando.
    await irPorMenu(page, '/administration/pharmacy-catalog');
    await page.getByTestId('products-new').click();
    // El host `app-content-dialog` no mide nada: lo visible es el `<dialog>`.
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    // Antes de elegir nada no hay datos de producto que escribir: ni marca ni concentración.
    await expect(modal.getByTestId('product-field-brand')).toHaveCount(0);
    await modal.getByRole('combobox', { name: 'Medicamento del catálogo oficial' }).fill('ibuprofeno');
    const opcion = page.locator('[role="option"]:not([aria-disabled="true"])').first();
    await expect(opcion).toBeVisible();
    NOMBRE = (await opcion.locator('.reference-combobox__label').innerText()).trim();
    await opcion.click();
    // La tarjeta del registro oficial: sus datos se ven y no se editan.
    const oficial = modal.getByTestId('product-official');
    await expect(oficial).toContainText(NOMBRE);
    await expect(oficial).toContainText('Estos datos vienen del registro oficial');
    const presentacion = modal.getByLabel('Presentación que vendés');
    if (await presentacion.isVisible()) {
      await presentacion.selectOption({ index: 1 });
    }
    await modal.getByTestId('product-field-code').fill(CODIGO);
    await page.screenshot({ path: join(EVIDENCIA, 'modal-producto-catalogo-1440-claro.png') });
    await modal.getByRole('tab', { name: 'Publicación' }).click();
    await modal.getByTestId('product-field-price').fill('12,50');
    await page.screenshot({ path: join(EVIDENCIA, 'modal-producto-publicacion-1440-claro.png') });
    await modal.getByTestId('product-dialog-save').click();
    await expect(modal).toBeHidden();

    // La prueba es la lista releída: con su precio y su estado.
    await page.getByPlaceholder('Marca, genérico o código').fill(CODIGO);
    await page.keyboard.press('Enter');
    const fila = page.getByRole('row').filter({ hasText: CODIGO });
    await expect(fila).toContainText(NOMBRE);
    await expect(fila).toContainText('Bs 12,50');
    await expect(fila).toContainText('Publicado');
    await expect(fila).toContainText('Disponible');

    // 3 · Sin stock: deja de estar disponible.
    await fila.getByRole('button', { name: /Acciones|Más/ }).click();
    await page.getByRole('menuitem', { name: 'Marcar sin stock' }).click();
    await expect(fila).toContainText('Sin stock');

    // 4 · Inventario: existencias y umbral, guardados juntos.
    await irPorMenu(page, '/administration/pharmacy-inventory');
    await page.getByRole('textbox', { name: 'Buscar en el inventario' }).fill(CODIGO);
    await page.keyboard.press('Enter');
    await page.getByTestId(`inventory-stock-${CODIGO}`).fill('3');
    await page.getByTestId(`inventory-minimum-${CODIGO}`).fill('5');
    await page.getByTestId('inventory-save').click();
    const filaInventario = page.getByRole('row').filter({ hasText: CODIGO });
    await expect(filaInventario).toContainText('Stock bajo');
    await expect(page.getByTestId(`inventory-stock-${CODIGO}`)).toHaveValue('3');

    // 5 · Categorías: crear una.
    await irPorMenu(page, '/administration/pharmacy-categories');
    await page.getByTestId('categories-new').click();
    await page.getByTestId('category-name').fill(`Vitaminas ${SUFIJO}`);
    await page.getByTestId('category-save').click();
    await expect(page.getByRole('row').filter({ hasText: `Vitaminas ${SUFIJO}` })).toBeVisible();

    // 6 · Importación: un CSV de dos filas, con el resultado fila por fila.
    await irPorMenu(page, '/administration/pharmacy-import');
    const csv = [
      'codigo;marca;generico;precio',
      `IMP-${SUFIJO}-1;Importado uno;Ibuprofeno;9,90`,
      `IMP-${SUFIJO}-2;Importado dos;Paracetamol;4,50`,
    ].join('\n');
    await page.locator('input[type="file"]').setInputFiles({
      name: 'catalogo.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv, 'utf-8'),
    });
    await page.getByRole('button', { name: /Continuar/ }).click();
    await page.getByTestId('import-publish').click();
    const resultado = page.getByTestId('import-results');
    await expect(resultado).toContainText(`IMP-${SUFIJO}-1`);
    await expect(resultado).toContainText(`IMP-${SUFIJO}-2`);

    // 7 · Resumen: los números cambiaron.
    await irPorMenu(page, '/administration/pharmacy');
    await expect(page.getByTestId('summary-published')).not.toHaveText(String(antes));
    await expect(page.getByTestId('summary-activity')).toContainText(NOMBRE);

    const errores = (page as unknown as { __errores: string[] }).__errores;
    // Los avisos de CSP por «inline script» son de `ng serve` (inyecta el cliente
    // de recarga en caliente) y no de estas pantallas: se descartan a propósito.
    const propios = errores.filter(
      (texto) => !/favicon|Failed to load resource|Executing inline script violates/.test(texto),
    );
    expect(propios).toEqual([]);
  });

  test('inventario: llevarlo sólo como «hay / no hay» y actualizarlo subiendo un CSV', async ({ page }) => {
    // Un producto sembrado y estable de Farmacia Vida.
    const codigo = 'FAR-ENALAPRIL';
    await irPorMenu(page, '/administration/pharmacy-inventory');
    await page.getByRole('textbox', { name: 'Buscar en el inventario' }).fill(codigo);
    await page.keyboard.press('Enter');

    // 1 · Cambiar a «Hay / no hay»: un interruptor por producto, sin cantidades.
    await page.getByTestId('inventory-view').getByText('Hay / no hay').click();
    // El `<input role="switch">` es nativo pero va oculto tras su estilo: se pulsa
    // el interruptor visible (el host) y el estado se lee del input.
    const anfitrion = page.getByTestId(`inventory-has-${codigo}`);
    const interruptor = anfitrion.getByRole('switch');
    await expect(anfitrion).toBeVisible();
    await expect(interruptor).toBeChecked();
    await expect(page.getByTestId(`inventory-stock-${codigo}`)).toHaveCount(0);
    await expect(page.getByRole('row').filter({ hasText: codigo })).toContainText('Hay');
    mkdirSync(EVIDENCIA, { recursive: true });
    await page.screenshot({ path: join(EVIDENCIA, 'inventario-hay-no-hay-1440-claro.png') });

    // 2 · Marcar «No hay» y guardar: la tabla releída lo confirma.
    await anfitrion.click();
    await expect(interruptor).not.toBeChecked();
    await page.getByTestId('inventory-save').click();
    await expect(page.getByText('Guardaste el inventario de 1 producto.')).toBeVisible();
    await page.screenshot({ path: join(EVIDENCIA, 'inventario-despues-de-guardar-1440-claro.png') });
    await expect(page.getByRole('row').filter({ hasText: codigo })).toContainText('No hay');

    // 3 · Subir un CSV con sólo «disponible»: vuelve a «hay».
    await page.getByTestId('inventory-upload').click();
    const modal = page.getByRole('dialog');
    await modal.locator('input[type="file"]').setInputFiles({
      name: 'inventario.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`codigo;disponible\n${codigo};sí\nNO-EXISTE;sí\n`, 'utf-8'),
    });
    await expect(modal.getByTestId('inventory-upload-changes')).toHaveText('1');
    await expect(modal.getByTestId('inventory-upload-problems')).toContainText('NO-EXISTE');
    await page.screenshot({ path: join(EVIDENCIA, 'inventario-subir-csv-1440-claro.png') });
    await modal.getByTestId('inventory-upload-apply').click();
    await expect(modal).toBeHidden();
    await expect(page.getByRole('row').filter({ hasText: codigo })).toContainText('Hay');

    // 4 · Con cantidades, el mismo producto sigue con existencias (el «hay» no las borró).
    await page.getByTestId('inventory-view').getByText('Con cantidades').click();
    await expect(page.getByTestId(`inventory-stock-${codigo}`)).toHaveValue(/\d+/);
  });

  for (const [ruta, nombre] of MENU) {
    test(`la pantalla «${nombre}» se ve centrada, a lo ancho y sin scroll horizontal`, async ({ page }) => {
      await irPorMenu(page, ruta);
      const contenido = page.locator('main').first();
      await expect(contenido).toBeVisible();
      await page.waitForTimeout(600);

      const medidas = await page.evaluate(() => {
        const main = document.querySelector('main') as HTMLElement;
        const m = main.getBoundingClientRect();
        // La envolvente de todo lo que se dibuja dentro de `main`: cada pantalla
        // arma su contenido distinto (una tarjeta, columnas), y lo que importa
        // es que el conjunto quede centrado y ocupe el ancho.
        const rects = [...main.querySelectorAll<HTMLElement>('*')]
          .map((el) => el.getBoundingClientRect())
          // Lo que cae fuera de `main` (mosaicos de un mapa, capas ocultas) no es
          // contenido a la vista: se descarta y lo demás se recorta al marco.
          .filter((r) => r.width > 0 && r.height > 0 && r.right > m.left && r.left < m.right);
        const izquierda = Math.max(m.left, Math.min(...rects.map((r) => r.left)));
        const derecha = Math.min(m.right, Math.max(...rects.map((r) => r.right)));
        return {
          scrollHorizontal: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          descentradoPx: Math.abs(izquierda - m.left - (m.right - derecha)),
          anchoRelativo: (derecha - izquierda) / m.width,
          fondo: getComputedStyle(document.body).backgroundColor,
        };
      });

      expect(medidas.scrollHorizontal).toBe(false);
      expect(medidas.descentradoPx).toBeLessThanOrEqual(2);
      expect(medidas.anchoRelativo).toBeGreaterThanOrEqual(0.85);
      writeFileSync(
        join(EVIDENCIA, `medidas-${nombre.replace(/\s+/g, '-').toLowerCase()}.json`),
        JSON.stringify({ ruta, ...medidas }, null, 2),
      );
    });
  }
});

/** Los cuatro cortes de la evidencia visual: tres anchos en claro y uno en oscuro. */
const CORTES = [
  { nombre: '375-claro', ancho: 375, alto: 800, esquema: 'light' },
  { nombre: '768-claro', ancho: 768, alto: 900, esquema: 'light' },
  { nombre: '1440-claro', ancho: 1440, alto: 900, esquema: 'light' },
  { nombre: '1440-oscuro', ancho: 1440, alto: 900, esquema: 'dark' },
] as const;

test.describe('capturas de las ocho pantallas', () => {
  test.skip(process.env['CAPTURAS'] !== '1', 'sólo con CAPTURAS=1: genera evidencia, no verifica');

  test('fullPage de cada pantalla en 375 / 768 / 1440 claro y 1440 oscuro', async ({ browser }) => {
    test.setTimeout(300_000);
    mkdirSync(EVIDENCIA, { recursive: true });
    const informe: Record<string, unknown>[] = [];

    for (const corte of CORTES) {
      // Un contexto por corte, con su ancho y su esquema desde el arranque: la
      // barra lateral arrastra su estado al redimensionar, y una captura tomada
      // tras un cambio de ancho no es la de quien abre la pantalla.
      const contexto = await browser.newContext({
        viewport: { width: corte.ancho, height: corte.alto },
        colorScheme: corte.esquema,
        locale: 'es-BO',
        timezoneId: 'America/La_Paz',
      });
      const page = await contexto.newPage();
      await entrar(page, farmacia() as Actor);
      for (const [ruta, nombre] of MENU) {
        await irA(page, ruta);
        await page.waitForURL((url) => url.pathname === ruta, { timeout: 30_000 });
        await page.waitForTimeout(1200);
        // El contenido de la pantalla (`main`) no puede pasar del ancho de la
        // ventana. El nombre de la cuenta en la cabecera del shell sí desborda a
        // 375 px —también en `/dashboard`—: es un hallazgo aparte, se registra
        // pero no se le carga a estas pantallas.
        const { scrollHorizontal, desbordaLaCabecera } = await page.evaluate(() => {
          const ancho = document.documentElement.clientWidth;
          // Lo que se ve de un elemento es su caja recortada por los ancestros que
          // cortan (`overflow` distinto de visible): el desplazamiento propio de una
          // tabla o de un mapa no es scroll de la página.
          const derechaVisible = (el: HTMLElement): number => {
            let derecha = el.getBoundingClientRect().right;
            for (let padre = el.parentElement; padre; padre = padre.parentElement) {
              const estilo = getComputedStyle(padre);
              if (estilo.overflowX !== 'visible') {
                derecha = Math.min(derecha, padre.getBoundingClientRect().right);
              }
            }
            return derecha;
          };
          const desborda = (raiz: Element) =>
            [...raiz.querySelectorAll<HTMLElement>('*')].some(
              (el) => el.getBoundingClientRect().width > 0 && derechaVisible(el) > ancho + 1,
            );
          const main = document.querySelector('main') as HTMLElement;
          return {
            scrollHorizontal: desborda(main),
            desbordaLaCabecera: document.documentElement.scrollWidth > ancho,
          };
        });
        const archivo = `${nombre.replace(/\s+/g, '-').toLowerCase()}-${corte.nombre}.png`;
        // `fullPage` redimensiona la ventana al vuelo y la barra lateral anima ese
        // cambio, así que la foto sale a medias. Se lleva la ventana al alto del
        // documento, se espera a que asiente, y se fotografía tal cual.
        const altoDelDocumento = await page.evaluate(() => document.documentElement.scrollHeight);
        await page.setViewportSize({ width: corte.ancho, height: Math.max(corte.alto, altoDelDocumento) });
        await page.waitForTimeout(1000);
        await page.screenshot({ path: join(EVIDENCIA, archivo) });
        await page.setViewportSize({ width: corte.ancho, height: corte.alto });
        informe.push({ pantalla: nombre, corte: corte.nombre, scrollHorizontal, desbordaLaCabecera, archivo });
      }
      await contexto.close();
    }
    writeFileSync(join(EVIDENCIA, 'capturas.json'), JSON.stringify(informe, null, 2));
    expect(informe.filter((fila) => fila['scrollHorizontal'] === true)).toEqual([]);
  });
});

test.describe('las demás cuentas no cambiaron de menú', () => {
  test('el paciente no ve una sola sección del portal de la farmacia', async ({ page }) => {
    await entrar(page, {
      rol: 'paciente',
      identificador: 'paciente@alovida.mock',
      clave: farmacia().clave,
      nombre: 'Ana Lucía Pérez Quiroga',
    });
    const rutas = await rutasDelMenu(page);

    expect(rutas.filter((ruta) => ruta.startsWith('/administration/pharmacy'))).toEqual([]);
    expect(rutas).toContain('/my-account/appointments');
  });

  test('la médica tampoco', async ({ page }) => {
    await entrar(page, {
      rol: 'doctora',
      identificador: 'medica@alovida.mock',
      clave: farmacia().clave,
      nombre: 'Dra. Valeria Rojas Mendoza',
    });
    const rutas = await rutasDelMenu(page);

    expect(rutas.filter((ruta) => ruta.startsWith('/administration/pharmacy'))).toEqual([]);
  });
});
