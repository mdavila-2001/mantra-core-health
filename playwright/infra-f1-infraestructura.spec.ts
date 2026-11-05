import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * Franja F1 · Infraestructura hospitalaria — evidencia de navegador.
 *
 * Contra `ng serve` con la maqueta (`mockBackend: true`). **Nunca
 * `networkidle`**: con HMR no llega. Se espera siempre un selector concreto.
 *
 * Uso:
 *   E2E_BASE_URL=http://127.0.0.1:4371 yarn pw infra-f1-infraestructura --workers=1
 *
 * Deja capturas en `docs/refactor-profesional/trabajo/evidencias/infra-f1/`
 * y un `resultados.json` con mediciones, peticiones y errores de consola.
 */

const SALIDA = join(process.cwd(), 'docs', 'refactor-profesional', 'trabajo', 'evidencias', 'infra-f1');
const ANCHOS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '390', width: 390, height: 844 },
] as const;

const CONSOLA = '/administration/medical-organization';
const SAN_LUCAS = 'Hospital San Lucas';

interface Registro {
  readonly que: string;
  readonly datos: unknown;
}
const registro: Registro[] = [];
const erroresDeConsola: string[] = [];

test.describe.configure({ mode: 'serial' });

/* Un Chromium ya instalado en la máquina, si el de la versión de Playwright no
   está (contenedores sin red para `playwright install`). */
if (process.env['PW_CHROMIUM_PATH']) {
  test.use({ launchOptions: { executablePath: process.env['PW_CHROMIUM_PATH'] } });
}

test.beforeAll(() => {
  mkdirSync(SALIDA, { recursive: true });
});

test.afterAll(() => {
  writeFileSync(join(SALIDA, 'resultados.json'), JSON.stringify({ fecha: new Date().toISOString(), registro, erroresDeConsola }, null, 2));
});

async function entrar(page: Page): Promise<void> {
  page.on('console', (m) => {
    if (m.type() === 'error') erroresDeConsola.push(`${page.url()} :: ${m.text()}`);
  });
  page.on('pageerror', (e) => erroresDeConsola.push(`${page.url()} :: pageerror ${e.message}`));
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByTestId('login-identifier').fill('superadmin@alovida.mock');
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').filter({ hasText: SAN_LUCAS }).first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  // La maqueta responde dentro de Angular: Playwright no ve red. Con esto la
  // maqueta anota cada escritura (método, ruta, If-Match, cuerpo, estado).
  await page.evaluate(() => sessionStorage.setItem('mock:registrar', '1'));
}

interface Escritura {
  readonly method: string;
  readonly path: string;
  readonly query: string;
  readonly ifMatch: string | null;
  readonly body: unknown;
  readonly status: number;
}

/** La última escritura anotada por la maqueta que cumple el filtro. */
async function ultimaEscritura(page: Page, metodo: string, ruta: RegExp): Promise<Escritura> {
  let hallada: Escritura | undefined;
  await expect
    .poll(async () => {
      const lista = await page.evaluate(() => JSON.parse(sessionStorage.getItem('mock:registro') ?? '[]') as Escritura[]);
      hallada = [...lista].reverse().find((e) => e.method === metodo && ruta.test(e.path));
      return hallada !== undefined;
    }, { timeout: 30_000 })
    .toBe(true);
  return hallada!;
}

async function captura(page: Page, nombre: string, ancho: string): Promise<void> {
  // El riel de navegación se despliega al pasar el puntero: se lo saca de ahí
  // para que la captura muestre la página y no el menú encima.
  const vista = page.viewportSize();
  if (vista !== null) await page.mouse.move(vista.width - 8, Math.round(vista.height / 2));
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(SALIDA, `${nombre}-${ancho}.png`), fullPage: true });
}

/** Desborde horizontal de la página, en px (0 es lo esperado). */
async function desborde(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Regla 6: holgura izquierda ≈ derecha respecto de `.app-main__inner` y ancho ≥ 85 %. */
async function medirTarjeta(page: Page, selector: string): Promise<{ izquierda: number; derecha: number; proporcion: number }> {
  return page.evaluate((sel) => {
    const area = document.querySelector('.app-main__inner')!.getBoundingClientRect();
    const tarjeta = document.querySelector(sel)!.getBoundingClientRect();
    const estilo = getComputedStyle(document.querySelector('.app-main__inner')!);
    const izquierdaArea = area.left + parseFloat(estilo.paddingLeft);
    const derechaArea = area.right - parseFloat(estilo.paddingRight);
    return {
      izquierda: Math.round(tarjeta.left - izquierdaArea),
      derecha: Math.round(derechaArea - tarjeta.right),
      proporcion: Math.round((tarjeta.width / (derechaArea - izquierdaArea)) * 100),
    };
  }, selector);
}

async function irALaConsola(page: Page, query: string): Promise<void> {
  await page.goto(`${CONSOLA}?${query}`, { waitUntil: 'domcontentloaded' });
}

async function sitioDeSanLucas(page: Page): Promise<string> {
  await irALaConsola(page, 'tab=infrastructure');
  await expect(page.getByTestId('infra-arbol')).toBeVisible({ timeout: 60_000 });
  const href = await page.getByTestId('infra-nuevo').getAttribute('href');
  return new URL(href!, 'http://x').searchParams.get('site')!;
}

for (const ancho of ANCHOS) {
  test.describe(`F1 a ${ancho.nombre}`, () => {
    test.use({ viewport: { width: ancho.width, height: ancho.height } });

    test('consola, ficha, formularios y establecimiento', async ({ page }) => {
      test.setTimeout(600_000);
      await entrar(page);
      const sitio = await sitioDeSanLucas(page);

      // ---- árbol expandido hasta una cama, con el panel -------------------
      await page.getByTestId('infra-arbol').locator('[role=treeitem]').first().focus();
      await page.keyboard.press('*');
      for (const rotulo of ['Pabellón Norte', 'Piso 3', 'Sala de internación de medicina interna', 'Habitación 301']) {
        const fila = page.getByRole('treeitem', { name: new RegExp(`^${rotulo}`) }).first();
        await fila.focus();
        await page.keyboard.press('ArrowRight');
      }
      const cama = page.getByRole('treeitem', { name: /^Cama 301-A/ });
      await cama.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('infra-panel')).toContainText('Cama 301-A');
      expect(await desborde(page)).toBeLessThanOrEqual(0);
      await captura(page, '01-arbol-expandido', ancho.nombre);
      const niveles = await page.getByRole('treeitem', { name: /^Cama 301-A/ }).getAttribute('aria-level');
      registro.push({ que: `aria-level de la cama a ${ancho.nombre}`, datos: niveles });

      // Organizativo
      await irALaConsola(page, `tab=infrastructure&site=${sitio}&view=units`);
      await expect(page.getByTestId('infra-arbol-unidades')).toBeVisible();
      await page.getByRole('treeitem', { name: /^Imagenología/ }).locator('.tree__fila').click();
      await expect(page.getByText('Sala de tomografía')).toBeVisible();
      await captura(page, '02-arbol-organizativo', ancho.nombre);

      // ---- ficha: las cinco pestañas --------------------------------------
      await irALaConsola(page, `tab=infrastructure&site=${sitio}`);
      await page.getByRole('treeitem', { name: /^Edificio A/ }).focus();
      await page.keyboard.press('*');
      const href301 = await (async () => {
        await page.getByRole('treeitem', { name: /^Pabellón Norte/ }).focus();
        await page.keyboard.press('ArrowRight');
        await page.getByRole('treeitem', { name: /^Piso 3/ }).focus();
        await page.keyboard.press('ArrowRight');
        await page.getByRole('treeitem', { name: /^Sala de internación de medicina interna/ }).focus();
        await page.keyboard.press('ArrowRight');
        await page.getByRole('treeitem', { name: /^Habitación 301/ }).focus();
        await page.keyboard.press('Enter');
        return page.getByTestId('infra-abrir-ficha').getAttribute('href');
      })();
      const pestanas = ['general', 'technical', 'units', 'children', 'history'];
      for (const [i, clave] of pestanas.entries()) {
        await page.goto(`${href301}?tab=${clave}`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('ficha-espacio')).toBeVisible({ timeout: 60_000 });
        await expect(page.locator('[role=tab][aria-selected=true]')).toHaveText(['General', 'Atributos técnicos', 'Unidades', 'Hijos', 'Historial'][i]!);
        if (clave === 'history') await expect(page.getByTestId('ficha-historial')).toBeVisible();
        expect(await desborde(page)).toBeLessThanOrEqual(0);
        await captura(page, `03-ficha-${i + 1}-${clave}`, ancho.nombre);
      }
      const medida = await medirTarjeta(page, '[data-testid=ficha-espacio]');
      registro.push({ que: `regla 6 · ficha a ${ancho.nombre}`, datos: medida });
      expect(Math.abs(medida.izquierda - medida.derecha)).toBeLessThanOrEqual(2);
      expect(medida.proporcion).toBeGreaterThanOrEqual(85);

      // ---- alta: UI → request → response → persistencia → recarga → UI ----
      const codigo = `E2E-${ancho.nombre}`;
      const salaId = new URL(href301!, 'http://x').pathname.split('/').pop()!;
      await page.goto(`${CONSOLA}/spaces/new?site=${sitio}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('formulario-espacio')).toBeVisible({ timeout: 60_000 });
      await captura(page, '04-alta-paso-1', ancho.nombre);
      registro.push({ que: 'sala de referencia', datos: salaId });
      // El formulario se maneja por sus controles reales.
      await elegir(page, 'campo-padre', /^A-PB · Planta baja/);
      await elegir(page, 'campo-forma', /^Local$/);
      await elegir(page, 'campo-funcion', /^Sala de espera$/);
      await page.getByTestId('campo-codigo').fill(codigo);
      await siguiente(page);
      await page.getByTestId('campo-nombre').fill(`Sala de espera ${ancho.nombre}`);
      await captura(page, '05-alta-paso-2', ancho.nombre);
      await siguiente(page);
      await page.getByRole('button', { name: 'Registrar espacio' }).click();
      const req = await ultimaEscritura(page, 'POST', new RegExp(`/sites/${sitio}/care-spaces$`));
      await page.waitForURL(/\/spaces\/[^/?]+$/, { timeout: 30_000 });
      await expect(page.getByTestId('ficha-espacio')).toContainText(codigo);
      const persistido = await page.evaluate((c) => (sessionStorage.getItem('mock.infra.espacios') ?? '').includes(c), codigo);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('ficha-espacio')).toContainText(codigo, { timeout: 60_000 });
      expect(req.status).toBe(201);
      registro.push({
        que: `cadena alta a ${ancho.nombre}`,
        datos: { request: { metodo: req.method, ruta: req.path, cuerpo: req.body }, respuesta: req.status, persistidoEnSesion: persistido, trasRecarga: 'la ficha muestra el código' },
      });
      await captura(page, '06-alta-creada-tras-recarga', ancho.nombre);

      // ---- edición: PATCH con If-Match → recarga → UI ----------------------
      const fichaNueva = page.url();
      await page.getByTestId('ficha-editar').click();
      await expect(page.getByTestId('formulario-espacio')).toBeVisible();
      await siguiente(page);
      await page.getByTestId('campo-nombre').fill(`Sala de espera editada ${ancho.nombre}`);
      await captura(page, '07-edicion', ancho.nombre);
      await siguiente(page);
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      const reqPatch = await ultimaEscritura(page, 'PATCH', /\/care-spaces\//);
      await page.waitForURL(fichaNueva);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: `Sala de espera editada ${ancho.nombre}` })).toBeVisible({ timeout: 60_000 });
      registro.push({ que: `cadena edición a ${ancho.nombre}`, datos: { ruta: reqPatch.path, ifMatch: reqPatch.ifMatch, cuerpo: reqPatch.body, respuesta: reqPatch.status } });
      expect(reqPatch.ifMatch).not.toBeNull();
      expect(reqPatch.status).toBe(200);

      // ---- alta masiva -----------------------------------------------------
      await page.goto(`${CONSOLA}/spaces/bulk?site=${sitio}&parent=${salaId}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('masiva')).toBeVisible({ timeout: 60_000 });
      await elegirSelect(page, 'masiva-forma', /^Cama/);
      await elegirSelect(page, 'masiva-funcion', /^Cama de internación/);
      await page.getByTestId('masiva-codigo').locator('input').fill('301-{A..H}');
      await page.getByTestId('masiva-nombre').locator('input').fill('Cama 301-{A..H}');
      await expect(page.getByTestId('masiva-previa')).toContainText('301-H');
      await captura(page, '08-alta-masiva-vista-previa', ancho.nombre);

      // ---- importación con errores y ok ------------------------------------
      await page.goto(`${CONSOLA}/spaces/import?site=${sitio}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('importar')).toBeVisible({ timeout: 60_000 });
      await page.getByTestId('importar-texto').fill(
        `code,name,form,function,parent\nIMP-${ancho.nombre}-1,Depósito importado,ROOM,STORAGE,A-PB\nIMP-${ancho.nombre}-2,Cama mal ubicada,BED,BED_STANDARD,BLD-A\n301,Código repetido,ROOM,GENERIC,A-PB\nIMP-${ancho.nombre}-4,,ROOM,GENERIC,A-PB`,
      );
      await expect(page.getByTestId('importar-errores-forma')).toBeVisible();
      await captura(page, '09-import-errores-de-forma', ancho.nombre);
      await page.getByTestId('importar-texto').fill(
        `code,name,form,function,parent\nIMP-${ancho.nombre}-1,Depósito importado,ROOM,STORAGE,A-PB\nIMP-${ancho.nombre}-2,Cama mal ubicada,BED,BED_STANDARD,BLD-A\n301,Código repetido,ROOM,GENERIC,A-PB`,
      );
      await page.getByTestId('importar-validar').click();
      await expect(page.getByTestId('importar-hay-errores')).toBeVisible();
      await captura(page, '10-import-dry-run-con-errores', ancho.nombre);
      await page.getByTestId('importar-texto').fill(
        `code;name;form;function;parent\nIMP-${ancho.nombre}-1;Depósito importado;ROOM;STORAGE;A-PB\nIMP-${ancho.nombre}-1A;Estantería;ROOM;STORAGE;A-PB`,
      );
      await page.getByTestId('importar-validar').click();
      await expect(page.getByText('Todo en regla')).toBeVisible();
      await page.getByTestId('importar-confirmar').click();
      await expect(page.getByTestId('importar-ok')).toContainText('Se crearon 2');
      await captura(page, '11-import-ok', ancho.nombre);

      // ---- retiro bloqueado con lista ---------------------------------------
      await irALaConsola(page, `tab=infrastructure&site=${sitio}&view=units`);
      await page.getByRole('treeitem', { name: /^Imagenología/ }).locator('.tree__fila').click();
      await page.getByRole('link', { name: 'Sala de tomografía' }).click();
      await expect(page.getByTestId('ficha-espacio')).toBeVisible({ timeout: 60_000 });
      await page.getByTestId('ficha-ciclo-retire').click();
      await expect(page.getByTestId('ficha-bloqueos')).toContainText('Equipos instalados');
      await captura(page, '12-retiro-bloqueado', ancho.nombre);
      await page.keyboard.press('Escape');

      // ---- establecimiento con brechas --------------------------------------
      await irALaConsola(page, `tab=establishment&site=${sitio}`);
      await expect(page.getByTestId('estab-capacidad')).toContainText('Faltan', { timeout: 60_000 });
      expect(await desborde(page)).toBeLessThanOrEqual(0);
      await captura(page, '13-establecimiento-brechas', ancho.nombre);
    });

    test('estados M34: vacío, prohibido, no encontrado, error con requestId', async ({ page }) => {
      test.setTimeout(300_000);
      await entrar(page);
      const sitio = await sitioDeSanLucas(page);

      // S3: el formulario sin establecimiento ofrece volver a elegirlo.
      await page.goto(`${CONSOLA}/spaces/new`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('link', { name: 'Elegir el establecimiento en la consola' })).toBeVisible({ timeout: 60_000 });
      await captura(page, '20-estado-vacio-S3', ancho.nombre);

      // S5: la API niega la estructura.
      await page.evaluate(() => sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: '/structure', modo: 'forbidden' }])));
      await irALaConsola(page, `tab=infrastructure&site=${sitio}`);
      await expect(page.getByText('No tiene acceso a esta sección')).toBeVisible({ timeout: 60_000 });
      await captura(page, '21-estado-prohibido-S5', ancho.nombre);

      // S9: error inesperado con su código de petición.
      await page.evaluate(() => sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: '/structure', modo: 'error' }])));
      await irALaConsola(page, `tab=infrastructure&site=${sitio}`);
      await expect(page.getByText('mock-fallo')).toBeVisible({ timeout: 60_000 });
      await captura(page, '22-estado-error-S9', ancho.nombre);

      // S9 de la consola: UNA vez, arriba.
      await page.evaluate(() => sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: '/organization', modo: 'error' }])));
      await irALaConsola(page, 'tab=infrastructure');
      await expect(page.getByText('mock-fallo')).toHaveCount(1, { timeout: 60_000 });
      await captura(page, '23-consola-error-S9-una-vez', ancho.nombre);
      await page.evaluate(() => sessionStorage.removeItem('mock:fallos'));

      // S6: un espacio que no existe (o de otro tenant).
      await page.goto(`${CONSOLA}/spaces/no-existe`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('No encontramos lo que busca')).toBeVisible({ timeout: 60_000 });
      await captura(page, '24-estado-no-encontrado-S6', ancho.nombre);
    });
  });
}

/** Elige una opción de un `app-select` del formulario por partes. */
async function elegir(page: Page, testId: string, opcion: RegExp): Promise<void> {
  await elegirSelect(page, testId, opcion);
}

async function elegirSelect(page: Page, testId: string, opcion: RegExp): Promise<void> {
  const campo = page.getByTestId(testId);
  const nativo = campo.locator('select');
  if ((await nativo.count()) > 0) {
    const valores = await nativo.locator('option').evaluateAll((os) => os.map((o) => ({ v: (o as HTMLOptionElement).value, t: o.textContent?.trim() ?? '' })));
    const elegido = valores.find((o) => opcion.test(o.t));
    if (elegido === undefined) throw new Error(`Sin opción ${opcion} en ${testId}: ${valores.map((o) => o.t).join(' | ')}`);
    await nativo.selectOption(elegido.v);
    return;
  }
  await campo.click();
  await page.getByRole('option', { name: opcion }).first().click();
}

async function siguiente(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^Siguiente/ }).click();
}
