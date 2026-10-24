/**
 * Verificación del chat completo contra la maqueta (rama `mockup`).
 *
 * Ejercita, como la paciente: reaccionar, «Info. del mensaje» (enviado /
 * entregado / leído con hora), editar (visible siempre, apagado tras 5 min),
 * subir un sticker desde el equipo, bloquear + «Bloqueados» y «Archivados»
 * siempre visibles.
 *
 * Uso: `node playwright/verificacion-chat-completo.mjs [urlBase]`
 * (el runner de Playwright sigue roto en este árbol; por eso es un script).
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4310';
const SALIDA = fileURLToPath(new URL('../evidencias/chat-completo', import.meta.url));
const RUIDO = [/favicon/i, /Content Security Policy/i, /inline script/i, /socket\.io/i];
let fallos = 0;
const ok = (nombre, cond, detalle = '') => {
  if (!cond) fallos += 1;
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const errores = [];
  for (const tema of ['dark', 'light']) {
    const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: tema });
    const p = await ctx.newPage();
    p.on('console', (m) => {
      if (m.type() === 'error' && !RUIDO.some((r) => r.test(m.text()))) errores.push(m.text());
    });
    p.on('pageerror', (e) => errores.push(String(e)));
    const t = (id) => p.locator(`[data-testid="${id}"]`);
    const foto = async (n) => p.screenshot({ path: `${SALIDA}/${tema}-${n}.png` });
    process.stdout.write(`\n── tema ${tema} ──\n`);

    await p.goto(`${BASE}/auth`);
    await t('login-identifier').fill('paciente@alovida.mock');
    await t('login-password').fill('mockup');
    await t('login-submit').click();
    await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
    if (p.url().includes('/auth/organization')) {
      await t('tenant-opcion').first().click();
      await p.waitForURL(/\/dashboard/, { timeout: 60_000 });
    }
    await p.goto(`${BASE}/messaging`);
    await t('conversacion').first().waitFor({ timeout: 30_000 });

    ok('«Archivados» y «Bloqueados» se ven aunque estén vacíos',
      (await t('mensajeria-archivados').count()) === 1 && (await t('mensajeria-bloqueados').count()) === 1);
    await foto('01-bandeja');

    await t('conversacion').first().click();
    await t('mensaje').first().waitFor({ timeout: 30_000 });
    await p.waitForTimeout(600);

    // Enviar y ver el recibo pasar de ✓ a ✓✓ (entregado).
    await t('hilo-texto').fill('Prueba del chat completo');
    await t('hilo-texto').press('Enter');
    const ultimo = () => t('mensaje').last();
    await ultimo().waitFor();
    await p.waitForFunction(
      () => [...document.querySelectorAll('[data-testid="mensaje"]')].some((m) =>
        m.textContent.includes('Prueba del chat completo') &&
        m.querySelector('[data-testid="hilo-ticks"]')?.dataset.estado === 'entregado'),
      null, { timeout: 15_000 },
    ).then(() => ok('el mensaje nuevo pasa de enviado a entregado (✓✓ gris)', true))
      .catch(() => ok('el mensaje nuevo pasa de enviado a entregado (✓✓ gris)', false));
    const propio = t('mensaje').filter({ hasText: 'Prueba del chat completo' });
    await propio.scrollIntoViewIfNeeded();

    // Menú: reacciones rápidas, Editar, Info.
    await propio.hover();
    await propio.locator('[data-testid="hilo-menu-mensaje"]').click();
    await t('hilo-reaccion-mas').waitFor();
    ok('el menú trae las 6 reacciones + «+»', (await t('hilo-reaccion-rapida').count()) === 6 && (await t('hilo-reaccion-mas').count()) === 1);
    ok('«Editar» se ofrece en un mensaje propio recién enviado', (await t('hilo-editar').isEnabled()));
    ok('«Info. del mensaje» se ofrece en el propio', (await t('hilo-info').count()) === 1);
    await foto('02-menu-mensaje');

    // Reaccionar.
    await t('hilo-reaccion-rapida').nth(1).click();
    await propio.locator('[data-testid="hilo-reaccion"]').waitFor({ timeout: 5000 });
    ok('la reacción ❤️ cuelga de la burbuja', (await propio.locator('[data-testid="hilo-reaccion"]').textContent())?.includes('❤️'));
    // Cambiar de emoji reemplaza la anterior (una por persona).
    await propio.locator('[data-testid="hilo-menu-mensaje"]').click();
    await t('hilo-reaccion-rapida').nth(2).click();
    await p.waitForTimeout(500);
    ok('elegir otro emoji reemplaza el anterior (una reacción por persona)',
      (await propio.locator('[data-testid="hilo-reaccion"]').count()) === 1 &&
      (await propio.locator('[data-testid="hilo-reaccion"]').textContent())?.includes('😂'));
    await foto('03-reaccion');

    // Info. del mensaje.
    await propio.locator('[data-testid="hilo-menu-mensaje"]').click();
    await t('hilo-info').click();
    await p.locator('[data-testid="thread-info-dialog"] .content-dialog__panel').waitFor();
    ok('«Info. del mensaje» dice cuándo se envió y se entregó',
      ((await t('info-enviado').textContent()) ?? '').trim() !== '' && ((await t('info-entregado').textContent()) ?? '').trim() !== '—');
    await p.waitForTimeout(500); // el modal termina su animación de entrada
    await foto('04-info-del-mensaje');
    await p.keyboard.press('Escape');

    // Editar.
    await propio.locator('[data-testid="hilo-menu-mensaje"]').click();
    await t('hilo-editar').click();
    // El composer carga el texto original en una microtarea: rellenar antes lo
    // pisaría y «guardar» vería el texto sin cambios.
    await p.waitForFunction(
      () => document.querySelector('[data-testid="hilo-texto"]')?.value === 'Prueba del chat completo',
    );
    await t('hilo-texto').fill('Prueba del chat completo (editado)');
    await t('composer-editar-guardar').click();
    await p.waitForTimeout(600);
    ok('editar deja el texto nuevo con la marca «editado»',
      (await t('mensaje').filter({ hasText: '(editado)' }).locator('[data-testid="hilo-editado"]').count()) === 1);
    await foto('05-editado');

    // «Editar» apagado en un mensaje viejo propio, con su motivo.
    const viejo = t('mensaje').filter({ hasText: 'Perfecto, gracias' });
    await viejo.scrollIntoViewIfNeeded();
    await viejo.locator('[data-testid="hilo-menu-mensaje"]').click();
    ok('en un mensaje propio viejo «Editar» queda visible pero apagado, con motivo',
      (await t('hilo-editar').isDisabled()) && ((await t('hilo-editar').textContent()) ?? '').includes('5 min'));
    await foto('06-editar-apagado');
    await p.keyboard.press('Escape');
    await p.mouse.click(700, 60);

    // Sticker/GIF desde el equipo.
    await t('composer-emojis').click();
    await t('composer-solapa-stickers').click();
    const png = await p.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 160; c.height = 160;
      const g = c.getContext('2d');
      g.fillStyle = '#23A455'; g.beginPath(); g.arc(80, 80, 76, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.fillText('¡Hola!', 80, 94);
      return c.toDataURL('image/png').split(',')[1];
    });
    await t('composer-sticker-archivo').setInputFiles({ name: 'hola.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
    await p.waitForFunction(() => document.querySelectorAll('[data-testid="hilo-sticker"]').length > 0, null, { timeout: 15_000 })
      .then(() => ok('un sticker subido desde el equipo se manda y se ve sin burbuja', true))
      .catch(() => ok('un sticker subido desde el equipo se manda y se ve sin burbuja', false));
    await t('composer-emojis').click();
    await t('composer-solapa-stickers').click();
    ok('queda en «Míos» para reusarlo', (await t('composer-sticker-propio').count()) >= 1);
    await foto('07-sticker-propio');
    await p.keyboard.press('Escape');
    await t('composer-emojis').click();

    // Emojis: catálogo grande y buscable.
    await t('composer-emojis').click();
    await t('composer-solapa-emojis').click();
    await p.waitForTimeout(500);
    await foto('08-emojis');
    await t('composer-emojis').click();

    // Bloquear.
    await t('hilo-menu').click();
    await t('hilo-bloquear').click();
    await p.locator('[data-testid="thread-block-dialog"] .content-dialog__panel').waitFor();
    await p.waitForTimeout(500);
    await foto('09-confirmar-bloqueo');
    await t('hilo-bloquear-confirmar').click();
    await t('hilo-bloqueado').waitFor({ timeout: 5000 });
    ok('bloqueada la persona, el campo de escribir se cambia por el aviso',
      (await t('hilo-texto').count()) === 0 && (await t('hilo-bloqueado').count()) === 1);
    await foto('10-bloqueado');

    // Lista de bloqueados y desbloqueo.
    await t('mensajeria-bloqueados').click();
    await t('mensajeria-bloqueado').first().waitFor();
    ok('«Bloqueados» lista a quién bloqueaste, con nombre', ((await t('mensajeria-bloqueado').first().textContent()) ?? '').includes('Valeria'));
    await foto('11-lista-bloqueados');
    await t('mensajeria-desbloquear').first().click();
    await t('mensajeria-sin-bloqueados').waitFor({ timeout: 5000 });
    ok('desbloquear la saca de la lista', (await t('mensajeria-bloqueado').count()) === 0);

    // Archivar y ver «Archivados».
    await t('mensajeria-bloqueados').click(); // volver
    await t('hilo-menu').click();
    await t('hilo-archivar').click();
    await p.waitForTimeout(400);
    ok('archivar suma a «Archivados»', ((await t('mensajeria-archivados-cuenta').textContent()) ?? '').trim() === '1');
    await t('mensajeria-archivados').click();
    await foto('12-archivados');
    ok('«Archivados» muestra la conversación archivada', (await t('conversacion').count()) === 1);

    await ctx.close();
  }
  await navegador.close();
  ok('sin errores de consola', errores.length === 0, errores.slice(0, 3).join(' | '));
  process.stdout.write(`\n${fallos === 0 ? 'TODO OK' : `${fallos} verificaciones fallaron`}\n`);
  process.exit(fallos === 0 ? 0 : 1);
}
main();
