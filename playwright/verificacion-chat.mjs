/**
 * Verificación del chat estilo WhatsApp contra la maqueta (rama `mockup`).
 *
 * Primera parte, como el paciente: bandeja (buscador + chips + conversaciones),
 * hilo (burbujas, ticks, cita, enlace, separador de no leídos), composer con
 * adjuntos/emojis/audio, envío optimista, menú de la cabecera, favorito,
 * responder con cita.
 *
 * Segunda parte, como la médica: el chat de grupo (nombre de quien habla,
 * documento, foto, citas), buscar dentro de la conversación, reenviar, el
 * contador de no leídos en el título de la pestaña y la vista en angosto.
 *
 * Uso: `node playwright/verificacion-chat.mjs [urlBase]`
 * El runner de Playwright sigue roto en este worktree; por eso es un script.
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4328';
const SALIDA = fileURLToPath(new URL('../evidencias/chat-whatsapp/retoques-2026-09-09', import.meta.url));
const RUIDO = [/favicon/i, /Content Security Policy/i, /inline script/i, /socket\.io/i];

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond) });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function entrar(navegador, email, errores) {
  const pagina = await (await navegador.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  pagina.on('console', (m) => {
    if (m.type() === 'error' && !RUIDO.some((p) => p.test(m.text()))) errores.push(m.text());
  });
  pagina.on('pageerror', (e) => errores.push(String(e)));
  await pagina.goto(`${BASE}/auth`);
  await pagina.getByTestId('login-identifier').fill(email);
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  return pagina;
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const errores = [];

  /* ── Como el paciente ─────────────────────────────────────────────────── */
  let pagina = await entrar(navegador, 'paciente@alovida.mock', errores);
  const capturar = async (nombre) => {
    await pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, fullPage: false });
    process.stdout.write(`  · ${nombre}.png\n`);
  };
  const t = (id) => pagina.locator(`[data-testid="${id}"]`);

  await pagina.goto(`${BASE}/messaging`);
  await t('conversacion').first().waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(800);
  const conversaciones = await t('conversacion').count();
  ok('bandeja: buscador y chips (todos / no leídos / favoritos / grupos)',
    (await t('mensajeria-consulta').count()) > 0 && (await t('mensajeria-filtro-no-leidos').count()) > 0);
  ok('bandeja: lista de conversaciones a la izquierda', conversaciones > 0, `${conversaciones} conversaciones`);
  ok('pestaña: el título lleva el contador de no leídos', /^\(\d+\) /.test(await pagina.title()), `«${await pagina.title()}»`);
  await capturar('01-bandeja');

  await t('conversacion').first().click();
  await t('mensaje').first().waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(800);
  const antes = await t('mensaje').count();
  ok('hilo: burbujas con hora y ticks', antes > 0 && (await t('hilo-ticks').count()) > 0, `${antes} mensajes`);
  ok('hilo: la respuesta de la médica muestra la cita y el enlace clicable',
    (await pagina.locator('.hilo__cita').count()) > 0 && (await pagina.locator('a.hilo__enlace').count()) > 0);
  ok('hilo: separador «1 mensaje no leído» al abrir', (await t('hilo-no-leidos').count()) > 0);
  ok('composer: adjuntos, emojis y nota de voz',
    (await t('composer-adjuntar').count()) > 0 && (await t('composer-emojis').count()) > 0 && (await t('composer-audio').count()) > 0);
  ok('una sola pantalla: bandeja e hilo conviven', (await t('conversacion').count()) > 0 && antes > 0);
  await capturar('02-hilo');

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

  const menu = t('hilo-menu-mensaje').first();
  await menu.click();
  await pagina.waitForTimeout(300);
  await t('hilo-responder').first().click();
  await pagina.waitForTimeout(300);
  ok('responder con cita: el composer muestra el mensaje citado', (await t('composer-respuesta').count()) > 0);
  await capturar('06-cita');
  await pagina.context().close();

  /* ── Como la médica: el grupo ─────────────────────────────────────────── */
  pagina = await entrar(navegador, 'medica@alovida.mock', errores);
  await pagina.goto(`${BASE}/messaging`);
  await t('conversacion').first().waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(800);
  await t('mensajeria-filtro-grupos').click();
  await pagina.waitForTimeout(300);
  ok('bandeja: el filtro Grupos deja el chat de equipo', (await t('conversacion').count()) === 1, `${await t('conversacion').count()} fila(s)`);
  ok('bandeja: la fila del grupo dice quién habló', /:/.test((await t('conversacion').first().textContent()) ?? ''));
  await t('conversacion').first().click();
  await t('mensaje').first().waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(1200);
  const autores = await pagina.locator('.hilo__autor').count();
  ok('grupo: el nombre de quien habla arriba de la burbuja, en su color', autores >= 2, `${autores} rótulos`);
  ok('grupo: el subtítulo lista a los participantes', /,/.test((await pagina.locator('.hilo__estado').textContent()) ?? ''));
  ok('grupo: documento adjunto, foto y citas',
    (await pagina.locator('.hilo__documento').count()) > 0 && (await t('hilo-imagen').count()) > 0 && (await pagina.locator('.hilo__cita').count()) >= 2,
    `doc=${await pagina.locator('.hilo__documento').count()} foto=${await t('hilo-imagen').count()} citas=${await pagina.locator('.hilo__cita').count()}`);
  ok('grupo: separador de no leídos', (await t('hilo-no-leidos').count()) > 0);
  await capturar('07-grupo');

  // Buscar en la conversación.
  const totalGrupo = await t('mensaje').count();
  await t('hilo-buscar-abrir').click();
  await t('hilo-buscar-texto').fill('holter');
  await pagina.waitForTimeout(300);
  const coinciden = await t('mensaje').count();
  ok('buscar en la conversación: quedan sólo las coincidencias, resaltadas',
    coinciden > 0 && coinciden < totalGrupo && (await pagina.locator('mark.hilo__marca').count()) > 0,
    `${coinciden} de ${totalGrupo} · ${(await t('hilo-buscar-cuenta').textContent())?.trim()}`);
  await capturar('08-buscar-en-chat');
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(300);
  ok('cerrar la búsqueda devuelve el hilo entero', (await t('mensaje').count()) === totalGrupo);

  // Reenviar.
  await t('hilo-menu-mensaje').first().click();
  await pagina.waitForTimeout(300);
  await t('hilo-reenviar').first().click();
  await pagina.waitForTimeout(300);
  const destinos = await t('hilo-reenviar-destino').count();
  ok('reenviar: se elige entre las otras conversaciones', destinos > 0, `${destinos} destinos`);
  await capturar('09-reenviar');
  await t('hilo-reenviar-destino').first().click();
  await pagina.waitForTimeout(500);
  ok('reenviar: confirma a quién se reenvió', /Reenviado a/.test((await t('hilo-aviso').textContent().catch(() => '')) ?? ''));
  ok('pestaña: el contador refleja lo que queda sin leer', /^\(\d+\) /.test(await pagina.title()), `«${await pagina.title()}»`);

  // Angosto.
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
  await capturar('10-movil-grupo');

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
