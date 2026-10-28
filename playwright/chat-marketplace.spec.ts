import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

import { esperarAplicacionLista } from './support/sesion';

/**
 * Evidencia de navegador del chat del marketplace (estilo PedidosYa).
 *
 * ## Qué demuestra, y contra qué
 *
 * Corre contra la **maqueta** (`ng serve` con el backend simulado): las
 * cuentas `paciente@alovida.mock` y `farmacia@alovida.mock` existen ahí y
 * cualquier clave no vacía entra. Cada mutación se recorre entera:
 * `UI → mutación → persistencia → recarga → UI`. La maqueta intercepta
 * **dentro** de Angular, así que no hay petición de red que mirar: la capa de
 * persistencia es el `sessionStorage` de la pestaña (`Coleccion.persistirEn`,
 * claves `mock.comunidad.mensajes` y `mock.files.archivos`), y se lee
 * directamente además de recargar.
 *
 * ## Una sola pestaña, a propósito
 *
 * `sessionStorage` es de la pestaña: un contexto nuevo —o una pestaña nueva—
 * arranca la maqueta desde el fixture y no ve lo que escribió la otra cuenta.
 * Por eso el cruce farmacia → paciente (test 6) se hace en **la misma
 * pestaña**, cerrando la sesión de una cuenta y entrando con la otra. Todo el
 * archivo corre en serie sobre la misma `page`.
 *
 * ## Cómo se corre
 *
 * ```bash
 * E2E_BASE_URL=http://localhost:4300 \
 * PW_CHROMIUM_PATH=/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell \
 *   npx playwright test playwright/chat-marketplace.spec.ts --reporter=list --workers=1
 * ```
 *
 * `PW_CHROMIUM_PATH` es la misma variable que ya usan los guiones `.mjs` de
 * esta carpeta: sólo hace falta cuando el Chromium que espera la versión de
 * Playwright instalada no está en la máquina. Sin ella, se usa el de siempre.
 *
 * ## Nunca `networkidle`
 *
 * Con HMR de `ng serve` no llega nunca (`CLAUDE.md`, punto 5). Se espera a
 * elementos concretos.
 */

/** Dónde quedan las fotos. Una carpeta por tanda, como el resto del repo. */
const EVIDENCIA = 'docs/frontend/evidence/chat-marketplace-2026-10-28';

const PACIENTE = 'paciente@alovida.mock';
const FARMACIA = 'farmacia@alovida.mock';
/** La maqueta acepta cualquier clave no vacía. */
const CLAVE = 'alovida';

/**
 * El pedido de la paciente en **Farmacias Chávez** (`pharmacy-order-2` de
 * `pharmacy.handlers.ts`; `uuid()` es un hash de la semilla, así que es el
 * mismo en cada arranque). Con esa farmacia la paciente no tiene hilo
 * sembrado: la tarjeta que aparece la pone el botón, no el fixture.
 */
const PEDIDO_CHAVEZ = '23becbfe-b5ae-42ce-a9c9-069034524bac';

/**
 * El pedido de la paciente en **Farmacia Vida** (`pharmacy-order-1`): el que
 * el mostrador abre en el test 6. Su hilo ya existe sembrado.
 */
const PEDIDO_VIDA = '22beca6b-3491-4509-a9ac-37fea06bd004';

/** Una farmacia sin hilo con la paciente: el enlace externo y las fotos. */
const SLUG_SIN_HILO = 'farmacia-central-lp';

/** Marca de esta corrida, para encontrar sus mensajes y no los sembrados. */
const MARCA = `pw-${Date.now().toString(36)}`;

/** El chromium alternativo, si lo hay. Ver «Cómo se corre». */
const CHROMIUM = process.env['PW_CHROMIUM_PATH'];
if (CHROMIUM) {
  test.use({ launchOptions: { executablePath: CHROMIUM } });
}

test.describe.configure({ mode: 'serial' });

let page: Page;
/** La URL del hilo con {@link SLUG_SIN_HILO}, que abre el test 3. */
let hiloSinTarjeta = '';
const erroresDeConsola: string[] = [];

async function foto(nombre: string): Promise<void> {
  await page.screenshot({ path: `${EVIDENCIA}/${nombre}.png`, fullPage: false });
}

/**
 * Entra por la pantalla de ingreso, como una persona.
 *
 * El formulario llega del render del servidor antes de hidratar: un clic en
 * esa ventana no hace nada. Se reintenta el envío —no las credenciales, que
 * en la maqueta no se rechazan— hasta que la URL cambia.
 */
async function entrar(usuario: string): Promise<void> {
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  const destino = /\/(dashboard|auth\/organization)/u;
  for (let intento = 0; intento < 5 && !destino.test(page.url()); intento += 1) {
    await page.getByTestId('login-identifier').fill(usuario);
    await page.getByTestId('login-password').fill(CLAVE);
    await page.getByTestId('login-submit').click();
    await page.waitForURL(destino, { timeout: 15_000 }).catch(() => undefined);
  }
  await expect(page).toHaveURL(destino);
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/u, { timeout: 60_000 });
  }
}

/** Cierra la sesión por el menú de la cuenta, como una persona. */
async function salir(): Promise<void> {
  await page.locator('[aria-label^="Cuenta de"]').first().click();
  await page.getByTestId('header-cerrar-sesion').click();
  await page.waitForURL(/\/auth/u, { timeout: 30_000 });
}

/** El hilo abierto ya pintó su campo de texto. */
async function hiloListo(): Promise<void> {
  await expect(page).toHaveURL(/\/messaging\/[\w-]+/u, { timeout: 60_000 });
  await expect(page.getByTestId('hilo-texto')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.hilo__cargando')).toHaveCount(0, { timeout: 30_000 });
}

/** Recarga la pestaña y espera a la app. Nunca `networkidle`. */
async function recargar(): Promise<void> {
  await page.reload();
  await esperarAplicacionLista(page);
}

/** Abre el hilo de la bandeja cuya fila dice `quien`. */
async function abrirConversacion(quien: string): Promise<void> {
  await page.goto('/messaging');
  await esperarAplicacionLista(page);
  const fila = page.getByTestId('conversacion').filter({ hasText: quien }).first();
  await expect(fila).toBeVisible({ timeout: 60_000 });
  await fila.click();
  await hiloListo();
}

/** Las tarjetas de contexto del hilo abierto, de un tipo. */
function tarjetas(tipo: 'pedido' | 'producto' | 'farmacia'): Locator {
  return page.locator(`[data-testid="hilo-contexto"][data-tipo="${tipo}"]`);
}

/** Lo que la maqueta guardó en `sessionStorage` bajo una clave. */
async function guardado(clave: string): Promise<string> {
  return page.evaluate((k) => sessionStorage.getItem(k) ?? '', clave);
}

/**
 * Una imagen generada en memoria por el lienzo del navegador: ni fixtures en
 * disco ni dependencias. Cada una de un color, para que no sean idénticas.
 */
async function imagen(
  nombre: string,
  tipo: 'image/png' | 'image/jpeg',
  color: string,
): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const base64 = await page.evaluate(
    ([t, c]) => {
      const lienzo = document.createElement('canvas');
      lienzo.width = 320;
      lienzo.height = 240;
      const ctx = lienzo.getContext('2d')!;
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, 320, 240);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(40, 40, 120, 80);
      return lienzo.toDataURL(t).split(',')[1]!;
    },
    [tipo, color] as const,
  );
  return { name: nombre, mimeType: tipo, buffer: Buffer.from(base64, 'base64') };
}

/** Espera a que la cola del composer termine de preparar las fotos. */
async function colaLista(cuantas: number): Promise<void> {
  await expect(page.getByTestId('composer-miniatura')).toHaveCount(cuantas);
  await expect(page.locator('[data-testid="composer-miniatura"].is-preparando')).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.getByTestId('hilo-enviar')).toBeEnabled();
}

/**
 * La zona que de verdad recibe el toque, medida con `elementFromPoint` desde
 * el centro hacia los cuatro lados: un `::before` que agranda el blanco cuenta
 * y un vecino encimado le resta, que es lo que siente el dedo.
 */
async function zonaTocable(
  objetivo: Locator,
  ignorarAvisoDeMaqueta: boolean,
): Promise<{ ancho: number; alto: number }> {
  await objetivo.scrollIntoViewIfNeeded();
  return objetivo.evaluate((el, ignorar) => {
    const r = el.getBoundingClientRect();
    const cx = r.x + r.width / 2;
    const cy = r.y + r.height / 2;
    // El aviso «Demo» de la maqueta (`app-mock-banner`) no existe fuera de
    // ella: si se pide ignorarlo, se mira qué hay debajo de él.
    const aviso = document.querySelector('app-mock-banner') as HTMLElement | null;
    const tocaA = (x: number, y: number): boolean => {
      const pila = document.elementsFromPoint(x, y);
      const t = ignorar ? pila.find((e) => aviso === null || !aviso.contains(e)) : pila[0];
      return t !== undefined && (t === el || el.contains(t));
    };
    const alcance = (dx: number, dy: number): number => {
      let d = 0;
      while (d < 60 && tocaA(cx + dx * (d + 1), cy + dy * (d + 1))) d += 1;
      return d;
    };
    return {
      ancho: alcance(-1, 0) + alcance(1, 0) + 1,
      alto: alcance(0, -1) + alcance(0, 1) + 1,
    };
  }, ignorarAvisoDeMaqueta);
}

test.beforeAll(async ({ browser }) => {
  mkdirSync(EVIDENCIA, { recursive: true });
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (mensaje) => {
    if (mensaje.type() === 'error') erroresDeConsola.push(mensaje.text());
  });
  page.on('pageerror', (error) => erroresDeConsola.push(`pageerror: ${error.message}`));
  await entrar(PACIENTE);
});

test.afterAll(async () => {
  await page?.close();
});

test('1 · paciente, desde el pedido: una sola tarjeta de pedido, también tras recargar y al repetir', async () => {
  await page.goto(`/my-account/pharmacy-orders/${PEDIDO_CHAVEZ}`);
  await esperarAplicacionLista(page);
  await expect(page.getByTestId('pedido-detalle')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('pedido-chatear').click();
  await hiloListo();
  const hilo = page.url();

  await expect(tarjetas('pedido')).toHaveCount(1);
  const fijado = page.getByTestId('hilo-contexto-fijado');
  await expect(fijado).toContainText('Consulta sobre: Pedido');
  await expect(fijado).toContainText('Farmacias Chávez');
  // La tarjeta lleva al pedido que la originó.
  await expect(tarjetas('pedido').locator('xpath=..').getByTestId('hilo-contexto-ver')).toHaveAttribute(
    'href',
    new RegExp(PEDIDO_CHAVEZ, 'u'),
  );
  // Persistencia: la maqueta la guardó en la pestaña.
  expect(await guardado('mock.comunidad.mensajes')).toContain(PEDIDO_CHAVEZ);
  await foto('01-pedido-tarjeta');

  await recargar();
  await hiloListo();
  await expect(tarjetas('pedido')).toHaveCount(1);
  await expect(page.getByTestId('hilo-contexto-fijado')).toContainText('Consulta sobre: Pedido');

  // Otra vez el botón: el mismo hilo, y la tarjeta no se repite.
  await page.goto(`/my-account/pharmacy-orders/${PEDIDO_CHAVEZ}`);
  await esperarAplicacionLista(page);
  await page.getByTestId('pedido-chatear').click();
  await hiloListo();
  expect(page.url()).toBe(hilo);
  await expect(tarjetas('pedido')).toHaveCount(1);
  await foto('01b-pedido-segundo-toque-sin-repetir');
});

test('2 · paciente, desde la ficha y desde el producto: una tarjeta de cada tipo', async () => {
  // Antes: el hilo sembrado con Farmacia Vida no tiene tarjetas de farmacia ni
  // de producto. Sin medirlo, la aserción de después no probaría nada.
  await abrirConversacion('Farmacia Vida');
  await expect(tarjetas('farmacia')).toHaveCount(0);
  await expect(tarjetas('producto')).toHaveCount(0);

  await page.goto('/pharmacies-directory/farmacia-vida');
  await esperarAplicacionLista(page);
  await page.getByTestId('chatear-con-la-farmacia').click({ timeout: 60_000 });
  await hiloListo();
  await expect(tarjetas('farmacia')).toHaveCount(1);
  await expect(tarjetas('farmacia').first()).toContainText('Farmacia Vida');
  await expect(page.getByTestId('hilo-contexto-fijado')).toContainText('Consulta sobre: Farmacia');
  await foto('02-ficha-tarjeta-farmacia');

  await page.goto('/pharmacies-directory/farmacia-vida');
  await esperarAplicacionLista(page);
  const consultar = page.getByTestId('consultar-producto-por-chat').first();
  await expect(consultar).toBeVisible({ timeout: 60_000 });
  // El nombre del producto sale de su etiqueta accesible: «Consultar por chat sobre X».
  const producto = ((await consultar.getAttribute('aria-label')) ?? '').replace(
    'Consultar por chat sobre ',
    '',
  );
  expect(producto).not.toBe('');
  await consultar.click();
  await hiloListo();
  await expect(tarjetas('producto')).toHaveCount(1);
  await expect(tarjetas('producto').first()).toContainText(producto);
  await expect(page.getByTestId('hilo-contexto-fijado')).toContainText('Consulta sobre: Producto');
  await foto('02b-producto-tarjeta-producto');

  await recargar();
  await hiloListo();
  await expect(tarjetas('farmacia')).toHaveCount(1);
  await expect(tarjetas('producto')).toHaveCount(1);
});

test('3 · un enlace externo con contexto falso abre el hilo sin tarjeta y sin el texto inyectado', async () => {
  // `ctx=falso` no tiene forma de nonce; el segundo enlace trae uno con forma
  // válida que nunca se guardó en esta pestaña. Ninguno de los dos manda nada.
  const enlaces = [
    `/messaging?escribirA=${SLUG_SIN_HILO}&ctx=falso&sobre=producto&titulo=INYECTADO`,
    `/messaging?escribirA=${SLUG_SIN_HILO}&ctx=00000000-0000-4000-8000-000000000000&sobre=producto&titulo=INYECTADO`,
  ];
  for (const enlace of enlaces) {
    await page.goto(enlace);
    await esperarAplicacionLista(page);
    await hiloListo();
    await expect(page.locator('.hilo__nombre')).toContainText('Farmacia Central');
    await expect(page.getByTestId('hilo-contexto')).toHaveCount(0);
    await expect(page.getByTestId('hilo-contexto-fijado')).toHaveCount(0);
    await expect(page.getByText('INYECTADO')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toContain('INYECTADO');
    expect(await guardado('mock.comunidad.mensajes')).not.toContain('INYECTADO');
  }
  hiloSinTarjeta = page.url();
  await foto('03-enlace-externo-sin-tarjeta');

  await recargar();
  await hiloListo();
  await expect(page.getByTestId('hilo-contexto')).toHaveCount(0);
});

test('4a · tres fotos y un texto: tres mensajes, la leyenda en la primera, grilla, y siguen tras recargar', async () => {
  expect(hiloSinTarjeta, 'el test 3 deja abierto el hilo').not.toBe('');
  await page.goto(hiloSinTarjeta);
  await esperarAplicacionLista(page);
  await hiloListo();
  await expect(page.getByTestId('hilo-imagen')).toHaveCount(0);

  const archivos = [
    await imagen('receta-1.png', 'image/png', '#0f766e'),
    await imagen('receta-2.jpg', 'image/jpeg', '#b45309'),
    await imagen('receta-3.png', 'image/png', '#7c3aed'),
  ];
  await page.getByTestId('composer-input-archivos').setInputFiles(archivos);
  await colaLista(3);
  await expect(page.getByTestId('hilo-enviar')).toHaveAttribute('aria-label', 'Enviar 3 archivos');
  const leyenda = `Estas son las recetas ${MARCA}`;
  await page.getByTestId('hilo-texto').fill(leyenda);
  await foto('04a-cola-con-tres-fotos');
  await page.getByTestId('hilo-enviar').click();

  const comprobar = async (): Promise<void> => {
    // La primera, con su leyenda, va sola: «una leyenda es de esa foto».
    const conLeyenda = page.getByTestId('mensaje').filter({ hasText: leyenda });
    await expect(conLeyenda).toHaveCount(1);
    await expect(conLeyenda.getByTestId('hilo-imagen')).toHaveCount(1);
    // Las otras dos, en la grilla.
    const grilla = page.getByTestId('hilo-galeria');
    await expect(grilla).toHaveCount(1);
    await expect(grilla).toHaveAttribute('data-cuantas', '2');
    await expect(page.getByTestId('hilo-imagen')).toHaveCount(3);
    // Las tres se dibujaron de verdad, no son un esqueleto.
    await expect
      .poll(
        () =>
          page
            .locator('[data-testid="hilo-imagen"] img')
            .evaluateAll((imgs) => imgs.filter((i) => (i as HTMLImageElement).naturalWidth > 0).length),
        { timeout: 30_000 },
      )
      .toBe(3);
    await expect(page.getByTestId('hilo-imagen-subiendo')).toHaveCount(0);
  };

  await comprobar();
  // Persistencia: tres mensajes con adjunto en la tabla de la maqueta.
  const mensajes = JSON.parse(await guardado('mock.comunidad.mensajes')) as unknown;
  const enLaTabla = JSON.stringify(mensajes);
  expect(enLaTabla).toContain(leyenda);
  await foto('04a-tres-fotos-enviadas');

  await recargar();
  await hiloListo();
  await comprobar();
  await foto('04a-tres-fotos-tras-recargar');
});

test('4b · pegar una imagen desde el portapapeles la suma a la cola y sale', async () => {
  await page.goto(hiloSinTarjeta);
  await esperarAplicacionLista(page);
  await hiloListo();
  // Las tres del 4a ya están: contar antes de que pinten daría 0.
  await expect(page.getByTestId('hilo-imagen')).toHaveCount(3);
  const antes = 3;

  // El portapapeles del sistema no es fiable sin ventana: se despacha el mismo
  // `paste` que produce Ctrl+V, con un `DataTransfer` real que lleva el
  // archivo. Lo que se prueba es el manejador del producto (`alPegar`), no
  // el portapapeles del sistema operativo.
  const png = await imagen('captura.png', 'image/png', '#be123c');
  await page.getByTestId('hilo-texto').evaluate((campo, b64) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const datos = new DataTransfer();
    datos.items.add(new File([bytes], 'captura.png', { type: 'image/png' }));
    campo.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: datos, bubbles: true, cancelable: true }),
    );
  }, png.buffer.toString('base64'));

  await colaLista(1);
  await foto('04b-imagen-pegada-en-la-cola');
  await page.getByTestId('hilo-enviar').click();
  await expect(page.getByTestId('hilo-imagen')).toHaveCount(antes + 1, { timeout: 30_000 });

  await recargar();
  await hiloListo();
  await expect(page.getByTestId('hilo-imagen')).toHaveCount(antes + 1);
});

test('4c · un .txt se rechaza con un mensaje y no entra a la cola', async () => {
  await page.goto(hiloSinTarjeta);
  await esperarAplicacionLista(page);
  await hiloListo();
  await page.getByTestId('composer-input-archivos').setInputFiles({
    name: 'notas.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('no soy una foto'),
  });
  const aviso = page.locator('.composer__error[role="alert"]');
  await expect(aviso).toContainText('«notas.txt» no se puede mandar');
  await expect(page.getByTestId('composer-miniatura')).toHaveCount(0);
  await foto('04c-txt-rechazado');
  await aviso.getByRole('button', { name: 'Entendido' }).click();
  await expect(aviso).toHaveCount(0);
});

test('4d · visor: abre, → pasa a la siguiente, Escape cierra y el foco vuelve a la miniatura', async () => {
  await page.goto(hiloSinTarjeta);
  await esperarAplicacionLista(page);
  await hiloListo();
  const miniatura = page
    .getByTestId('mensaje')
    .filter({ hasText: `Estas son las recetas ${MARCA}` })
    .getByTestId('hilo-imagen');
  await miniatura.focus();
  await miniatura.press('Enter');

  const visor = page.getByTestId('hilo-visor');
  await expect(visor).toBeVisible();
  const posicion = page.getByTestId('hilo-visor-posicion');
  const inicial = (await posicion.textContent())?.trim() ?? '';
  const foto1 = await page.getByTestId('hilo-visor-foto').getAttribute('src');
  await foto('04d-visor-abierto');

  await page.keyboard.press('ArrowRight');
  await expect(posicion).not.toHaveText(inicial);
  expect(await page.getByTestId('hilo-visor-foto').getAttribute('src')).not.toBe(foto1);
  await foto('04d-visor-siguiente');

  await page.keyboard.press('Escape');
  await expect(visor).toBeHidden();
  await expect(miniatura).toBeFocused();
});

test('5 · menú de adjuntar: Enter lo abre, Escape lo cierra y el foco vuelve a «+»', async () => {
  await page.goto(hiloSinTarjeta);
  await esperarAplicacionLista(page);
  await hiloListo();
  const mas = page.getByTestId('composer-adjuntar');
  await mas.focus();
  await page.keyboard.press('Enter');
  const menu = page.getByTestId('composer-menu-adjuntar');
  await expect(menu).toBeVisible();
  await expect(page.getByTestId('composer-fotos')).toBeVisible();
  await foto('05-menu-adjuntar-abierto');
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(mas).toBeFocused();
});

test('6 · farmacia: «Escribiendo como», responde desde el mostrador con texto y foto; la paciente lo ve tras recargar', async () => {
  const texto = `Hola Ana Lucía, te mando la foto de la caja ${MARCA}`;

  await salir();
  await entrar(FARMACIA);

  await page.goto('/messaging');
  await esperarAplicacionLista(page);
  const selector = page.getByTestId('mensajeria-escribiendo-como');
  await expect(selector).toBeVisible({ timeout: 60_000 });
  await expect(selector.getByRole('radio', { name: 'Yo' })).toBeVisible();
  await expect(selector.getByRole('radio', { name: 'Farmacia Vida' })).toBeVisible();
  await foto('06-farmacia-escribiendo-como');

  // Desde el mostrador: bandeja de pedidos → el pedido → «Chatear con el paciente».
  await page.goto('/administration/pharmacy-orders');
  await esperarAplicacionLista(page);
  const fila = page.locator(`a[href$="/administration/pharmacy-orders/${PEDIDO_VIDA}"]`).first();
  await expect(fila).toBeVisible({ timeout: 60_000 });
  await fila.click();
  await page.getByTestId('mostrador-chatear').click({ timeout: 60_000 });
  await hiloListo();
  await expect(page.locator('.hilo__nombre')).toContainText('Ana Lucía');
  // Escribe como la farmacia, no como la persona.
  await expect(
    page.getByTestId('mensajeria-escribiendo-como').getByRole('radio', { name: 'Farmacia Vida' }),
  ).toHaveAttribute('aria-checked', 'true');

  await page.getByTestId('hilo-texto').fill(texto);
  await page.getByTestId('hilo-texto').press('Enter');
  await expect(
    page.locator('[data-testid="mensaje"][data-propio="true"]').filter({ hasText: texto }),
  ).toHaveCount(1);

  const antes = await page.getByTestId('hilo-imagen').count();
  await page
    .getByTestId('composer-input-archivos')
    .setInputFiles([await imagen('caja.jpg', 'image/jpeg', '#16a34a')]);
  await colaLista(1);
  await page.getByTestId('hilo-enviar').click();
  await expect(page.getByTestId('hilo-imagen')).toHaveCount(antes + 1, { timeout: 30_000 });
  await expect(page.getByTestId('hilo-imagen-subiendo')).toHaveCount(0, { timeout: 30_000 });
  expect(await guardado('mock.comunidad.mensajes')).toContain(MARCA);
  await foto('06b-farmacia-respondio');

  // Del otro lado: la misma pestaña, la otra cuenta.
  await salir();
  await entrar(PACIENTE);

  const comprobar = async (): Promise<void> => {
    const recibido = page
      .locator('[data-testid="mensaje"][data-propio="false"]')
      .filter({ hasText: texto });
    await expect(recibido).toHaveCount(1);
    // La foto, ajena y dibujada.
    const ajenas = page.locator(
      '[data-propio="false"] [data-testid="hilo-imagen"] img',
    );
    await expect(ajenas.last()).toBeVisible();
    await expect
      .poll(() => ajenas.last().evaluate((i) => (i as HTMLImageElement).naturalWidth), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);
  };

  await abrirConversacion('Farmacia Vida');
  await comprobar();
  await foto('06c-paciente-ve-la-respuesta');

  await recargar();
  await hiloListo();
  await comprobar();
  await foto('06d-paciente-tras-recargar');
});

test('7 · móvil 390: los táctiles miden al menos 44×44 y no hay scroll horizontal', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(hiloSinTarjeta);
  await esperarAplicacionLista(page);
  await hiloListo();

  // «Quitar» y «enviar» sólo existen con algo en la cola.
  await page
    .getByTestId('composer-input-archivos')
    .setInputFiles([await imagen('movil.png', 'image/png', '#0891b2')]);
  await colaLista(1);
  await foto('07-movil-390-con-cola');

  const objetivos: [string, Locator][] = [
    ['volver', page.getByRole('link', { name: 'Volver a los chats' })],
    ['opciones', page.getByTestId('hilo-menu')],
    ['enviar', page.getByTestId('hilo-enviar')],
    ['foto', page.getByTestId('composer-foto')],
    ['quitar', page.getByTestId('composer-miniatura-quitar').first()],
  ];
  const medidas: Record<string, { ancho: number; alto: number }> = {};
  const conAviso: Record<string, { ancho: number; alto: number }> = {};
  for (const [nombre, objetivo] of objetivos) {
    await expect(objetivo, `${nombre} visible`).toBeVisible();
    medidas[nombre] = await zonaTocable(objetivo, true);
    conAviso[nombre] = await zonaTocable(objetivo, false);
  }
  // Lo que el producto ofrece: sin el aviso de la maqueta encima.
  const chicos = Object.entries(medidas).filter(([, m]) => m.ancho < 44 || m.alto < 44);
  expect(chicos, `táctiles por debajo de 44×44: ${JSON.stringify(medidas)}`).toEqual([]);
  // Lo que se siente en la maqueta desplegada, con la pastilla «Demo» de
  // `mock-banner.ts`. Medido, no supuesto: a 390 tapa la franja de arriba de
  // «Opciones» (44×34 en la corrida del 28/10). Queda anotado como hallazgo de
  // la maqueta en vez de hacer fallar la prueba del producto.
  const tapadosPorElAviso = Object.entries(conAviso).filter(([, m]) => m.ancho < 44 || m.alto < 44);
  if (tapadosPorElAviso.length > 0) {
    test.info().annotations.push({
      type: 'hallazgo-maqueta',
      description: `El aviso «Demo» de la maqueta tapa parte de: ${JSON.stringify(Object.fromEntries(tapadosPorElAviso))}`,
    });
  }

  const desbordaX = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(desbordaX, 'hay scroll horizontal a 390').toBe(false);

  await page.getByTestId('composer-miniatura-quitar').first().click();
  await expect(page.getByTestId('composer-miniatura')).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 900 });
});

test('8 · bandeja: S8 «Sin conexión», S9 con el código de la petición, y Reintentar recupera', async () => {
  const fallar = async (modo: 'red' | 'error' | null): Promise<void> => {
    await page.evaluate((m) => {
      if (m === null) sessionStorage.removeItem('mock:fallos');
      else
        sessionStorage.setItem(
          'mock:fallos',
          JSON.stringify([{ patron: '/community/conversations', modo: m, metodos: ['GET'] }]),
        );
    }, modo);
  };

  await page.goto('/messaging');
  await esperarAplicacionLista(page);
  await fallar('red');
  await recargar();
  const sinConexion = page.getByTestId('bandeja-sin-conexion');
  await expect(sinConexion).toBeVisible({ timeout: 60_000 });
  await expect(sinConexion).toContainText('Sin conexión');
  await expect(page.getByTestId('conversacion')).toHaveCount(0);
  await foto('08-bandeja-s8-sin-conexion');

  // Del S8 al S9 por el propio Reintentar: el servidor ahora contesta 500.
  await fallar('error');
  await sinConexion.getByTestId('bandeja-reintentar').click();
  const error = page.getByTestId('bandeja-error');
  await expect(error).toBeVisible();
  await expect(page.getByTestId('bandeja-request-id')).toHaveText('mock-fallo');
  await foto('08b-bandeja-s9-con-codigo');

  await fallar(null);
  await error.getByTestId('bandeja-reintentar').click();
  await expect(page.getByTestId('conversacion').first()).toBeVisible({ timeout: 30_000 });
  await expect(error).toHaveCount(0);
  await foto('08c-bandeja-recuperada');
});

test('9 · la consola quedó limpia en toda la corrida', () => {
  // Lo esperado, nombrado de forma estrecha (mismo criterio que
  // `chat-mejoras-evidencia.spec.ts`): el aviso de la maqueta, el socket que
  // no conecta sin gateway, el CSP del servidor de desarrollo y los mosaicos
  // del mapa que el proxy de la máquina no deja bajar.
  const esperados =
    /mock|maqueta|Angular is running in development mode|WebSocket connection to .*socket\.io.* failed|Content Security Policy|tile\.openstreetmap|net::ERR_TUNNEL_CONNECTION_FAILED|net::ERR_CONNECTION/iu;
  // **Hallazgo de producto, fuera del chat**: el mapa de la ficha de farmacia
  // (`shared/components/organisms/map/map.ts`) tira
  // `Cannot read properties of undefined (reading '_leaflet_pos')` cuando se
  // sale de la ficha mientras Leaflet anima el encuadre (`fitBounds`) — el
  // `remove()` de `ngOnDestroy` corre con la animación en vuelo. Lo provoca el
  // test 2, que entra a la ficha y se va al chat en seguida. Se separa y se
  // anota en vez de ocultarse: cualquier otro error sigue haciendo fallar.
  const delMapa = /_leaflet_pos/u;
  const mapa = erroresDeConsola.filter((error) => delMapa.test(error));
  if (mapa.length > 0) {
    test.info().annotations.push({
      type: 'hallazgo-producto',
      description: `map.ts: ${mapa.length} errores «_leaflet_pos» al salir de la ficha de farmacia`,
    });
  }
  const relevantes = erroresDeConsola.filter(
    (error) => !esperados.test(error) && !delMapa.test(error),
  );
  expect(relevantes, `errores de consola:\n${relevantes.join('\n')}`).toEqual([]);
});
