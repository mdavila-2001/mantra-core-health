/**
 * Verificación del flujo de adjuntar del chat contra la maqueta (rama `mockup`).
 *
 * Ejercita, como la paciente: el menú «+» flotante, la vista previa con varias
 * fotos (pie de foto, miniaturas, sumar y quitar), el editor de imagen (un
 * trazo y un texto, «Listo» reemplaza el archivo), el envío con el pie de foto
 * y la tarjeta de un documento. En claro y oscuro, escritorio y móvil.
 *
 * Uso: `node playwright/verificacion-adjuntos-whatsapp.mjs [urlBase] [carpetaDeMuestras]`
 * La carpeta tiene que traer `1792710466504_image.png`, `receta-farmacia.jpg`,
 * `herida-rodilla.jpg` y un PDF (`Historia clinica 2026-08-18.pdf`).
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4200';
const MUESTRAS = process.argv[3] ?? fileURLToPath(new URL('../evidencias/chat-adjuntos-whatsapp/muestras', import.meta.url));
const SALIDA = fileURLToPath(new URL('../evidencias/chat-adjuntos-whatsapp', import.meta.url));
const RUIDO = [/favicon/i, /Content Security Policy/i, /inline script/i, /socket\.io/i, /WebSocket/i];
const FOTOS = ['1792710466504_image.png', 'receta-farmacia.jpg', 'herida-rodilla.jpg'].map((f) => join(MUESTRAS, f));
const PDF = join(MUESTRAS, 'Historia clinica 2026-08-18.pdf');

let fallos = 0;
const ok = (nombre, cond, detalle = '') => {
  if (!cond) fallos += 1;
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

const PANTALLAS = [
  { nombre: 'escritorio', viewport: { width: 1440, height: 900 } },
  { nombre: 'movil', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

async function entrar(p, t) {
  await p.goto(`${BASE}/auth`);
  await t('login-identifier').fill('paciente@alovida.mock');
  await t('login-password').fill('mockup');
  await t('login-submit').click();
  await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 90_000 });
  if (p.url().includes('/auth/organization')) {
    await t('tenant-opcion').first().click();
    await p.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  await p.goto(`${BASE}/messaging`);
  await t('conversacion').first().waitFor({ timeout: 60_000 });
  await t('conversacion').first().click();
  await t('hilo-texto').waitFor({ timeout: 30_000 });
  await p.waitForTimeout(800);
}

async function elegir(p, t, opcion, archivos) {
  await t('composer-adjuntar').click();
  await t(opcion).waitFor();
  const [selector] = await Promise.all([p.waitForEvent('filechooser'), t(opcion).click()]);
  await selector.setFiles(archivos);
  await t('composer-vista-previa').waitFor();
  await p.waitForTimeout(500);
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  // `PW_CHROMIUM` apunta a otro Chromium cuando el del paquete no está bajado.
  const navegador = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const errores = [];

  for (const pantalla of PANTALLAS) {
    for (const tema of ['light', 'dark']) {
      const ctx = await navegador.newContext({
        viewport: pantalla.viewport,
        isMobile: pantalla.isMobile ?? false,
        hasTouch: pantalla.hasTouch ?? false,
        colorScheme: tema,
      });
      // El tema es del producto (`ThemeService`), no del sistema: se fija por
      // su clave antes de que arranque la app.
      await ctx.addInitScript((modo) => localStorage.setItem('mantra-core-health.theme', modo), tema);
      const p = await ctx.newPage();
      p.on('console', (m) => {
        if (m.type() === 'error' && !RUIDO.some((r) => r.test(m.text()))) errores.push(m.text());
      });
      p.on('pageerror', (e) => errores.push(String(e)));
      const t = (id) => p.locator(`[data-testid="${id}"]`);
      const foto = (n) => p.screenshot({ path: `${SALIDA}/${pantalla.nombre}-${tema === 'light' ? 'claro' : 'oscuro'}-${n}.png` });
      const pre = `[${pantalla.nombre} · ${tema}]`;
      process.stdout.write(`\n── ${pre} ──\n`);

      await entrar(p, t);
      const altoHilo = await t('mensaje').first().boundingBox();

      // 1 · El menú «+» flota y no empuja el hilo.
      await t('composer-adjuntar').click();
      await t('composer-fotos').waitFor();
      await p.waitForTimeout(300);
      const despues = await t('mensaje').first().boundingBox();
      ok(`${pre} el menú «+» no mueve el hilo`, altoHilo?.y === despues?.y, `${altoHilo?.y} → ${despues?.y}`);
      ok(`${pre} el menú trae Documento, Fotos y videos y Plantilla`,
        (await t('composer-documento').isVisible()) && (await t('composer-plantilla').isVisible()));
      await foto('01-menu');
      await p.keyboard.press('Escape');
      await p.waitForTimeout(200);
      ok(`${pre} Escape cierra el menú y devuelve el foco al «+»`,
        (await t('composer-fotos').count()) === 0 &&
          (await p.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'composer-adjuntar');

      // 2 · Vista previa con tres fotos.
      await elegir(p, t, 'composer-fotos', FOTOS);
      ok(`${pre} el tema pedido es el que se ve`,
        (await p.evaluate(() => document.documentElement.getAttribute('data-theme'))) === tema);
      ok(`${pre} la vista previa tapa el hilo, cabecera incluida`, await p.evaluate(() => {
        const cabecera = document.querySelector('.hilo__cabecera')?.getBoundingClientRect();
        if (!cabecera) return false;
        const arriba = document.elementFromPoint(cabecera.left + cabecera.width / 2, cabecera.top + cabecera.height / 2);
        return arriba?.closest('[data-testid="composer-vista-previa"]') != null;
      }));
      ok(`${pre} tres miniaturas y contador 3`,
        (await t('vista-miniatura').count()) === 3 && (await t('vista-cuenta').innerText()) === '3');
      ok(`${pre} el foco entra al pie de foto`,
        (await p.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'vista-comentario');
      await t('vista-comentario').fill('Así está el lunar hoy');
      await t('vista-miniatura').nth(1).click();
      await t('vista-comentario').fill('La receta de la farmacia');
      await t('vista-miniatura').nth(0).click();
      ok(`${pre} cada foto guarda su comentario`, (await t('vista-comentario').inputValue()) === 'Así está el lunar hoy');
      await foto('02-vista-previa-varias');

      // La capa atrapa el Tab: treinta vueltas y el foco sigue adentro.
      for (let i = 0; i < 30; i += 1) await p.keyboard.press('Tab');
      ok(`${pre} Tab no sale de la vista previa`, await p.evaluate(() =>
        document.activeElement?.closest('[data-testid="composer-vista-previa"]') != null));

      // Abierto con clic, el editor recibe el foco y Escape lo cierra sin
      // cerrar la vista previa.
      await t('vista-dibujar').click();
      await t('editor-lienzo').waitFor();
      ok(`${pre} el foco entra al editor`,
        (await p.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'editor-dibujar');
      await p.keyboard.press('Escape');
      await t('vista-escenario').waitFor();
      ok(`${pre} Escape cierra el editor y deja la vista previa`,
        (await t('editor-lienzo').count()) === 0 && (await t('composer-vista-previa').count()) === 1);

      // 3 · Editor: un trazo y un texto.
      await t('vista-dibujar').click();
      await t('editor-lienzo').waitFor();
      await p.waitForFunction(() => {
        const c = document.querySelector('[data-testid="editor-lienzo"]');
        return c instanceof HTMLCanvasElement && c.width > 300;
      }, null, { timeout: 15_000 });
      const caja = await t('editor-lienzo').boundingBox();
      const cx = caja.x + caja.width * 0.3;
      const cy = caja.y + caja.height * 0.6;
      await p.mouse.move(cx, cy);
      await p.mouse.down();
      for (let i = 1; i <= 20; i += 1) {
        await p.mouse.move(cx + i * caja.width * 0.02, cy - Math.sin(i / 3) * caja.height * 0.12);
      }
      await p.mouse.up();
      await t('editor-texto').click();
      await t('editor-texto-campo').fill('Mancha nueva');
      await t('editor-texto-agregar').click();
      await p.waitForTimeout(300);
      ok(`${pre} «Deshacer» se habilita tras editar`, (await t('editor-deshacer').getAttribute('aria-disabled')) === 'false');
      await foto('03-editor-trazo-y-texto');
      await t('editor-listo').click();
      await t('vista-escenario').waitFor();
      await p.waitForTimeout(400);
      const etiqueta = await t('vista-miniatura').nth(0).getAttribute('aria-label');
      ok(`${pre} la edición reemplaza el archivo con un nombre legible`, etiqueta?.includes('imagen-editada.png') ?? false, etiqueta ?? '');
      ok(`${pre} el comentario sobrevive a la edición`, (await t('vista-comentario').inputValue()) === 'Así está el lunar hoy');
      await foto('04-vista-previa-editada');

      // 4 · Enviar: tres burbujas, con su pie de foto.
      const antes = await t('mensaje').count();
      await t('vista-enviar').click();
      await t('composer-vista-previa').waitFor({ state: 'detached' });
      await p.waitForFunction((n) => document.querySelectorAll('[data-testid="mensaje"]').length >= n + 3, antes, { timeout: 20_000 })
        .then(() => ok(`${pre} salen tres mensajes`, true))
        .catch(() => ok(`${pre} salen tres mensajes`, false));
      ok(`${pre} los mensajes salen en el orden elegido`, await p.evaluate(() => {
        const textos = [...document.querySelectorAll('[data-testid="mensaje"]')].map((m) => m.textContent ?? '');
        const lunar = textos.findIndex((x) => x.includes('Así está el lunar hoy'));
        const receta = textos.findIndex((x) => x.includes('La receta de la farmacia'));
        return lunar >= 0 && receta > lunar;
      }));
      ok(`${pre} el pie de foto viaja con la foto`,
        (await t('mensaje').filter({ hasText: 'Así está el lunar hoy' }).count()) === 1 &&
          (await t('mensaje').filter({ hasText: 'La receta de la farmacia' }).count()) === 1);
      await p.waitForTimeout(1500);
      await foto('05-hilo-enviado');

      // 5 · Documento.
      await elegir(p, t, 'composer-documento', [PDF]);
      await p.waitForFunction(() => /página/.test(document.querySelector('[data-testid="vista-documento-detalle"]')?.textContent ?? ''), null, { timeout: 15_000 })
        .then(() => ok(`${pre} la tarjeta dice cuántas páginas tiene el PDF`, true))
        .catch(() => ok(`${pre} la tarjeta dice cuántas páginas tiene el PDF`, false));
      ok(`${pre} un documento no ofrece edición`, (await t('vista-dibujar').count()) === 0);
      await foto('06-documento');
      await p.keyboard.press('Escape');
      await t('composer-vista-previa').waitFor({ state: 'detached' });
      ok(`${pre} Escape descarta y el foco vuelve al «+»`,
        (await p.evaluate(() => document.activeElement?.getAttribute('data-testid'))) === 'composer-adjuntar');

      await ctx.close();
    }
  }

  await navegador.close();
  ok('sin errores de consola', errores.length === 0, errores.slice(0, 3).join(' | '));
  process.stdout.write(`\n${fallos === 0 ? 'TODO VERDE' : `${fallos} FALLO(S)`}\n`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
