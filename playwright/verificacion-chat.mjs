/**
 * Verificación del chat estilo WhatsApp contra la maqueta (rama `mockup`).
 *
 * Entra como el paciente, mira la bandeja (buscador + chips + conversaciones),
 * abre un hilo (burbujas, ticks, composer con adjuntos/emojis/audio), manda un
 * mensaje y comprueba que aparece en el acto (envío optimista), abre el menú de
 * la cabecera, y en angosto comprueba que el cartel de la maqueta no tape el
 * campo de escribir y que la hora de la fila y la de la burbuja sean la misma.
 *
 * Uso: `node playwright/verificacion-chat.mjs [urlBase]`
 * El runner de Playwright sigue roto en este worktree; por eso es un script.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4328';
const SALIDA = new URL('../evidencias/chat-whatsapp/retoques-2026-09-09', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1');
const RUIDO = [/favicon/i, /Content Security Policy/i, /inline script/i, /socket\.io/i];

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond) });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const pagina = await (await navegador.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  const errores = [];
  pagina.on('console', (m) => {
    if (m.type() === 'error' && !RUIDO.some((p) => p.test(m.text()))) errores.push(m.text());
  });
  pagina.on('pageerror', (e) => errores.push(String(e)));
  const capturar = async (nombre) => {
    await pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, fullPage: false });
    process.stdout.write(`  · ${nombre}.png\n`);
  };
  const t = (id) => pagina.locator(`[data-testid="${id}"]`);

  await pagina.goto(`${BASE}/auth`);
  await pagina.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }

  await pagina.goto(`${BASE}/messaging`);
  await t('conversacion').first().waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(800);
  const conversaciones = await t('conversacion').count();
  ok('bandeja: buscador y chips (todos / no leídos / favoritos / grupos)',
    (await t('mensajeria-consulta').count()) > 0 && (await t('mensajeria-filtro-no-leidos').count()) > 0);
  ok('bandeja: lista de conversaciones a la izquierda', conversaciones > 0, `${conversaciones} conversaciones`);
  await capturar('01-bandeja');

  await t('conversacion').first().click();
  await t('mensaje').first().waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(800);
  const antes = await t('mensaje').count();
  ok('hilo: burbujas con hora y ticks', antes > 0 && (await t('hilo-ticks').count()) > 0, `${antes} mensajes`);
  ok('composer: adjuntos, emojis y nota de voz',
    (await t('composer-adjuntar').count()) > 0 && (await t('composer-emojis').count()) > 0 && (await t('composer-audio').count()) > 0);
  ok('una sola pantalla: bandeja e hilo conviven', (await t('conversacion').count()) > 0 && antes > 0);
  await capturar('02-hilo');

  // La hora de la fila (hoy) y la de la última burbuja tienen que ser la misma.
  const horaFila = (await pagina.locator('.conversaciones__fila.is-activa .conversaciones__cuando').first().textContent())?.trim();
  const horaBurbuja = (await pagina.locator('[data-testid="mensaje"] .hilo__hora').last().textContent())?.trim();
  ok('la hora de la fila y la de la burbuja coinciden', horaFila && horaFila === horaBurbuja, `fila «${horaFila}» · burbuja «${horaBurbuja}»`);

  await t('hilo-texto').fill('Mensaje de verificación desde Playwright');
  await t('hilo-enviar').click();
  await pagina.waitForTimeout(150);
  const enSeguida = await t('mensaje').count();
  await pagina.waitForTimeout(1500);
  const despues = await t('mensaje').count();
  ok('envío optimista: la burbuja aparece antes de que responda el servidor', enSeguida === antes + 1, `${antes} → ${enSeguida} → ${despues}`);
  await capturar('03-enviado');

  // El menú de la cabecera: ver perfil, favorito, archivar.
  await t('hilo-menu').click();
  await pagina.waitForTimeout(300);
  ok('cabecera: el menú ofrece ver perfil, favorito y archivar',
    (await t('hilo-ver-perfil').count()) > 0 && (await t('hilo-favorito').count()) > 0 && (await t('hilo-archivar').count()) > 0);
  await capturar('04-menu-cabecera');
  await t('hilo-favorito').click();
  await pagina.waitForTimeout(300);
  await t('mensajeria-filtro-favoritos').click();
  await pagina.waitForTimeout(300);
  ok('favorito desde la cabecera: la fila aparece en el filtro Favoritos', (await t('conversacion').count()) === 1, `${await t('conversacion').count()} fila(s)`);
  await capturar('05-favoritos');
  await t('mensajeria-filtro-todos').click();

  // Responder con cita, desde el menú del mensaje.
  const menu = t('hilo-menu-mensaje').first();
  if ((await menu.count()) > 0) {
    await menu.click();
    await pagina.waitForTimeout(300);
    const responder = t('hilo-responder').first();
    if ((await responder.count()) > 0) {
      await responder.click();
      await pagina.waitForTimeout(300);
      ok('responder con cita: el composer muestra el mensaje citado', (await t('composer-respuesta').count()) > 0);
      await capturar('06-cita');
    }
  }

  // Angosto: sin desborde y el cartel de la maqueta no tapa el campo de escribir.
  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.waitForTimeout(600);
  const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('móvil: sin desborde horizontal', desborde === 0, `${desborde}px`);
  const cajaCampo = await t('hilo-texto').boundingBox();
  const cajaCartel = await pagina.locator('.mock').boundingBox();
  const seTocan = cajaCampo && cajaCartel &&
    cajaCampo.x < cajaCartel.x + cajaCartel.width && cajaCartel.x < cajaCampo.x + cajaCampo.width &&
    cajaCampo.y < cajaCartel.y + cajaCartel.height && cajaCartel.y < cajaCampo.y + cajaCampo.height;
  ok('móvil: el cartel de la maqueta no tapa el campo de escribir', cajaCampo && cajaCartel && !seTocan,
    `campo y=${Math.round(cajaCampo?.y ?? -1)} · cartel y=${Math.round(cajaCartel?.y ?? -1)}`);
  await capturar('07-movil-hilo');

  process.stdout.write(`Errores de consola: ${errores.length}\n`);
  for (const e of [...new Set(errores)].slice(0, 8)) process.stdout.write(`  ! ${e.slice(0, 200)}\n`);
  const rojos = veredictos.filter((v) => !v.cond).length;
  process.stdout.write(`${veredictos.length - rojos}/${veredictos.length} en verde\n`);
  await navegador.close();
  process.exit(rojos === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(2);
});
