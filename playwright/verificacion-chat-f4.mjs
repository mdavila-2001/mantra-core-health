/**
 * Verificación de la F4 del chat contra la maqueta (rama `mockup`).
 *
 * Entra como el paciente, abre el hilo con Soporte y comprueba lo que la API
 * de F4 le da al front: «en línea» bajo el nombre (F4.2), fijar un mensaje y
 * la barra de arriba (F4.6), editar y eliminar un mensaje propio (F4.5),
 * favorito y fijado por API con la fila reordenada (F4.4), y el doble tilde
 * de la bandeja (F4.3). Deja capturas en `evidencias/chat-whatsapp/f4/`.
 *
 * Uso: `node playwright/verificacion-chat-f4.mjs [urlBase]`
 * El runner de Playwright sigue roto en este worktree; por eso es un script.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4328';
const SALIDA = new URL('../evidencias/chat-whatsapp/f4', import.meta.url).pathname.replace(
  /^\/([A-Za-z]:)/,
  '$1',
);
const RUIDO = [/favicon/i, /Content Security Policy/i, /inline script/i, /socket\.io/i, /websocket/i];

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond) });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const pagina = await (
    await navegador.newContext({ viewport: { width: 1440, height: 1000 } })
  ).newPage();
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

  /**
   * Vuelve a la lista y entra otra vez al hilo con Soporte.
   *
   * Reemplaza al `reload()`: la maqueta guarda sus tablas en memoria (ninguna
   * `Coleccion` recibe clave de `sessionStorage`), así que recargar borraría el
   * estado por culpa del simulador y no del código. Salir y volver a entrar sí
   * prueba lo que interesa — que lo que se ve viene de una lectura de la API y
   * no del estado que el componente tenía en la mano.
   */
  const volverYEntrar = async () => {
    // Navegación del router, no `goto`: `goto` recarga la aplicación entera y
    // con ella el simulador, así que borraría el estado que se quiere
    // comprobar. Se pasa por otra conversación para forzar que el hilo se
    // destruya y se vuelva a leer.
    const otra = t('conversacion').filter({ hasNotText: 'Soporte' }).first();
    await otra.click();
    await pagina.waitForTimeout(700);
    await t('conversacion').filter({ hasText: 'Soporte' }).first().click();
    await t('mensaje').first().waitFor({ timeout: 30_000 });
    await pagina.waitForTimeout(800);
  };

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
  await pagina.waitForTimeout(600);

  /* --- F4.3 · doble tilde en la fila -------------------------------------- */
  const ticks = await t('conversacion-tick').count();
  ok('F4.3 bandeja: la fila con último mensaje propio lleva tilde', ticks > 0, `${ticks} filas`);

  /* --- F4.2 · en línea ------------------------------------------------------ */
  await t('conversacion').filter({ hasText: 'Soporte' }).first().click();
  await t('mensaje').first().waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(600);
  const estado = (await t('hilo-estado').textContent())?.trim() ?? '';
  ok('F4.2 hilo: Soporte figura «en línea» bajo el nombre', estado === 'en línea', `«${estado}»`);
  await capturar('01-en-linea');

  /* --- envío + edición + eliminación (F4.5) -------------------------------- */
  const texto = `Prueba F4 ${Date.now().toString(36)}`;
  await t('hilo-texto').fill(texto);
  await t('hilo-enviar').click();
  await pagina.waitForTimeout(600);
  const propia = t('mensaje').filter({ hasText: texto }).last();
  ok('envío: la burbuja propia aparece', (await propia.count()) > 0);

  await propia.hover();
  await propia.locator('[data-testid="hilo-menu-mensaje"]').click();
  await pagina.waitForTimeout(200);
  ok('F4.5 menú: un mensaje propio ofrece Editar y Eliminar',
    (await t('hilo-editar').count()) > 0 && (await t('hilo-eliminar').count()) > 0);
  await t('hilo-editar').click();
  await pagina.waitForTimeout(200);
  ok('F4.5 editar: la tira «Editando el mensaje» aparece y el campo toma el texto',
    (await t('composer-edicion').count()) > 0 && (await t('hilo-texto').inputValue()) === texto);
  await capturar('02-editando');
  await t('hilo-texto').fill(`${texto} (corregido)`);
  await t('hilo-enviar').click();
  await pagina.waitForTimeout(600);
  const corregida = t('mensaje').filter({ hasText: `${texto} (corregido)` }).last();
  ok('F4.5 editar: la burbuja muestra el texto corregido y la marca «editado»',
    (await corregida.count()) > 0 && (await corregida.locator('[data-testid="hilo-editado"]').count()) > 0);
  await capturar('03-editado');

  /* --- F4.6 · fijar -------------------------------------------------------- */
  await corregida.hover();
  await corregida.locator('[data-testid="hilo-menu-mensaje"]').click();
  await pagina.waitForTimeout(200);
  await t('hilo-fijar').click();
  await pagina.waitForTimeout(600);
  ok('F4.6 fijar: la barra «Mensaje fijado» aparece con el texto',
    (await t('hilo-fijado').count()) > 0 && ((await t('hilo-fijado').textContent()) ?? '').includes('corregido'));
  await capturar('04-fijado');
  // Salir del hilo y volver, **no** recargar: ninguna colección de la maqueta
  // persiste entre recargas (`Coleccion` sólo guarda si se le pasa clave, y
  // ninguna la usa), así que un F5 borraría el fijado por el simulador y no
  // por el código. Volver a entrar sí prueba lo que importa: que el fijado
  // viene de la primera página de la API y no del estado del componente.
  await volverYEntrar();
  ok('F4.6 fijar: sigue ahí al volver a entrar (viaja en la primera página)', (await t('hilo-fijado').count()) > 0);
  await t('hilo-soltar-fijado').click();
  await pagina.waitForTimeout(400);
  ok('F4.6 soltar: la barra se va', (await t('hilo-fijado').count()) === 0);

  /* --- F4.5 · eliminar ------------------------------------------------------ */
  const aEliminar = t('mensaje').filter({ hasText: `${texto} (corregido)` }).last();
  await aEliminar.hover();
  await aEliminar.locator('[data-testid="hilo-menu-mensaje"]').click();
  await pagina.waitForTimeout(200);
  await t('hilo-eliminar').click();
  await pagina.waitForTimeout(600);
  ok('F4.5 eliminar: queda «Se eliminó este mensaje» y el texto ya no se ve',
    (await t('hilo-eliminado').count()) > 0 && (await t('mensaje').filter({ hasText: '(corregido)' }).count()) === 0);
  await capturar('05-eliminado');
  await volverYEntrar();
  ok('F4.5 eliminar: sigue eliminado al volver a entrar', (await t('hilo-eliminado').count()) > 0);

  /* --- F4.4 · favorito y fijado por API ------------------------------------ */
  const primeraAntes = (await t('conversacion').first().textContent()) ?? '';
  await t('hilo-menu').click();
  await pagina.waitForTimeout(200);
  await t('hilo-favorito').click();
  await pagina.waitForTimeout(500);
  await t('hilo-menu').click();
  await pagina.waitForTimeout(200);
  ok('F4.4 favorito: el menú ahora ofrece «Quitar de favoritos»',
    ((await t('hilo-favorito').textContent()) ?? '').includes('Quitar'));
  await t('hilo-fijar-chat').click();
  await pagina.waitForTimeout(600);
  const primeraDespues = (await t('conversacion').first().textContent()) ?? '';
  ok('F4.4 fijar arriba: la conversación sube al tope de la bandeja',
    primeraDespues.includes('Soporte') && (await t('conversacion-fijada').count()) > 0,
    `antes «${primeraAntes.slice(0, 30)}…», después «${primeraDespues.slice(0, 30)}…»`);
  await capturar('06-favorita-y-fijada');
  await volverYEntrar();
  ok('F4.4: favorito y fijado siguen al volver a entrar (vienen de la fila de la bandeja)',
    ((await t('conversacion').first().textContent()) ?? '').includes('Soporte') &&
      (await t('conversacion-fijada').count()) > 0);
  // Lo que sí se mira contra el navegador: que ya NO guarde ahí lo marcado.
  const guardado = await pagina.evaluate(() => localStorage.getItem('alovida.chat-preferencias') ?? '{}');
  ok('F4.4: el navegador ya no guarda favoritos ni archivados',
    !guardado.includes('"favoritos"') && !guardado.includes('"archivados"'), guardado.slice(0, 60));

  // Se deja como estaba.
  await t('hilo-menu').click();
  await pagina.waitForTimeout(200);
  await t('hilo-fijar-chat').click();
  await pagina.waitForTimeout(300);
  await t('hilo-menu').click();
  await pagina.waitForTimeout(200);
  await t('hilo-favorito').click();
  await pagina.waitForTimeout(300);

  /* --- móvil ------------------------------------------------------------------ */
  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.waitForTimeout(400);
  await capturar('07-movil-hilo');

  ok('sin errores de consola', errores.length === 0, errores.slice(0, 3).join(' | '));
  await navegador.close();

  const fallidos = veredictos.filter((v) => !v.cond);
  process.stdout.write(`\n${veredictos.length - fallidos.length}/${veredictos.length} verificaciones OK\n`);
  process.exit(fallidos.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
