/**
 * Verificación de «Responder con IA» contra la maqueta (rama `mockup`).
 *
 * Como la médica: abre Ajustes → Chats, recorre las tres opciones (no
 * responder, mensaje fijo, IA), mira la vista previa, abre «Más opciones»,
 * guarda y recarga. Como la paciente: le escribe a la médica —que en la
 * maqueta tiene la IA encendida— y espera la respuesta rotulada. En claro y
 * oscuro, escritorio y móvil.
 *
 * Uso: `node playwright/verificacion-respuesta-ia.mjs [urlBase]`
 * Con `PW_CHROMIUM=/ruta/a/chromium` si el navegador del paquete no está bajado.
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4200';
const SALIDA = fileURLToPath(new URL('../evidencias/chat-respuesta-ia', import.meta.url));
const RUIDO = [/favicon/i, /Content Security Policy/i, /inline script/i, /socket\.io/i, /WebSocket/i];

let fallos = 0;
const ok = (nombre, cond, detalle = '') => {
  if (!cond) fallos += 1;
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

const PANTALLAS = [
  { nombre: 'escritorio', viewport: { width: 1440, height: 900 } },
  { nombre: 'movil', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

async function entrar(p, t, correo) {
  await p.goto(`${BASE}/auth`);
  await t('login-identifier').fill(correo);
  await t('login-password').fill('mockup');
  await t('login-submit').click();
  await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 90_000 });
  if (p.url().includes('/auth/organization')) {
    await t('tenant-opcion').first().click();
    await p.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

/** Espera, con plazo, a que el elemento aparezca o se vaya. `isVisible()` no espera el render. */
const llega = (locator, state = 'visible') =>
  locator.waitFor({ state, timeout: 5_000 }).then(() => true, () => false);

async function main() {
  mkdirSync(SALIDA, { recursive: true });
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
      await ctx.addInitScript((modo) => localStorage.setItem('mantra-core-health.theme', modo), tema);
      const p = await ctx.newPage();
      p.on('console', (m) => {
        if (m.type() === 'error' && !RUIDO.some((r) => r.test(m.text()))) errores.push(m.text());
      });
      p.on('pageerror', (e) => errores.push(String(e)));
      const t = (id) => p.locator(`[data-testid="${id}"]`);
      const sufijo = `${pantalla.nombre}-${tema === 'light' ? 'claro' : 'oscuro'}`;
      // En móvil, página completa. En escritorio el encabezado y la barra
      // lateral son fijos y la página completa los repite: se desplaza hasta
      // lo que importa y se fotografía lo que se ve.
      const foto = async (n, enfocar) => {
        if (!pantalla.isMobile && enfocar) {
          await enfocar.evaluate((el, bloque) => el.scrollIntoView({ block: bloque }), enfocar === bloque ? 'start' : 'center');
          await p.waitForTimeout(250);
        }
        await p.screenshot({ path: `${SALIDA}/${sufijo}-${n}.png`, fullPage: pantalla.isMobile === true });
      };
      const pre = `[${pantalla.nombre} · ${tema}]`;
      process.stdout.write(`\n── ${pre} ──\n`);

      // ── La médica configura ───────────────────────────────────────────
      await entrar(p, t, 'medica@alovida.mock');
      await p.goto(`${BASE}/settings`);
      await p.getByRole('tab', { name: 'Chats' }).click();
      await t('chat-prefs-modo-apagado').waitFor({ state: 'attached', timeout: 30_000 });
      // Se espera a que llegue lo guardado en el servidor: el aviso lo dice.
      await p.locator('[data-testid="chat-prefs-limite"].is-ok').waitFor({ timeout: 30_000 });
      const bloque = p.locator('app-chat-preferences section').first();
      await bloque.scrollIntoViewIfNeeded();
      ok(`${pre} el tema pedido es el que se ve`,
        (await p.evaluate(() => document.documentElement.getAttribute('data-theme'))) === tema);

      // La maqueta trae a la médica con IA encendida: la pantalla lo refleja.
      ok(`${pre} abre con lo guardado en el servidor (IA)`, await t('chat-prefs-modo-ia').isChecked());
      ok(`${pre} tres opciones, una sola decisión`,
        (await p.locator('input[name="chat-prefs-modo"]').count()) === 3);

      await t('chat-prefs-modo-apagado').check();
      ok(`${pre} apagada: la vista previa dice que no se envía nada`, await llega(t('chat-prefs-previa-nada')));
      ok(`${pre} apagada: no ofrece configurar nada más`, await llega(t('chat-prefs-texto'), 'detached'));
      await foto('01-no-responder', bloque);

      await t('chat-prefs-modo-fijo').check();
      await t('chat-prefs-texto').fill('Estoy en consulta. Le respondo apenas termine.');
      ok(`${pre} fijo: la vista previa sigue lo que se escribe`,
        (await t('chat-prefs-previa-texto').innerText()) === 'Estoy en consulta. Le respondo apenas termine.');
      ok(`${pre} hay cambios sin guardar`, await llega(t('chat-prefs-sin-guardar')));
      await foto('02-mensaje-fijo', bloque);

      await t('chat-prefs-modo-ia').check();
      ok(`${pre} IA: dice lo que la IA no hace`,
        (await t('chat-prefs-ia-limites').innerText()).includes('no diagnostica, no indica medicamentos ni dosis'));
      ok(`${pre} IA: el respaldo se explica en una frase`,
        (await p.getByText('Si la IA no está disponible, se enviará este mensaje').count()) === 1);
      ok(`${pre} IA: la vista previa lleva la etiqueta`,
        (await t('chat-prefs-previa-etiqueta').innerText()).trim() === 'Respuesta automática generada por IA');
      await foto('03-responder-con-ia', bloque);

      await p.locator('[data-testid="chat-prefs-mas"] summary').click();
      ok(`${pre} «Más opciones» trae espera, descanso y horario`,
        (await t('chat-prefs-minutos').isVisible()) && (await t('chat-prefs-descanso').isVisible()) && (await t('chat-prefs-horario').isVisible()));
      await foto('04-mas-opciones', t('chat-prefs-mas'));

      await t('chat-prefs-guardar').click();
      const confirmacion = await t('chat-prefs-guardado').innerText();
      ok(`${pre} guardar confirma con palabras`,
        confirmacion === 'Cambios guardados. Cuando no esté, la IA responderá en nombre de su consultorio.', confirmacion);
      await foto('05-guardado', t('chat-prefs-guardado'));

      // Lo guardado persiste: primero con mensaje fijo, después con IA.
      const recargar = async () => {
        await p.reload();
        await p.getByRole('tab', { name: 'Chats' }).click();
        await t('chat-prefs-modo-ia').waitFor({ state: 'attached' });
        await p.locator('[data-testid="chat-prefs-limite"].is-ok').waitFor({ timeout: 30_000 });
      };
      await t('chat-prefs-modo-fijo').check();
      await t('chat-prefs-guardar').click();
      await llega(t('chat-prefs-guardado'));
      await recargar();
      ok(`${pre} guardado con mensaje fijo, al recargar sigue fijo`, await t('chat-prefs-modo-fijo').isChecked());
      await t('chat-prefs-modo-ia').check();
      await t('chat-prefs-guardar').click();
      await llega(t('chat-prefs-guardado'));

      await p.reload();
      await p.getByRole('tab', { name: 'Chats' }).click();
      await t('chat-prefs-modo-ia').waitFor({ state: 'attached' });
      await p.locator('[data-testid="chat-prefs-limite"].is-ok').waitFor({ timeout: 30_000 });
      ok(`${pre} al recargar sigue con IA`, await t('chat-prefs-modo-ia').isChecked());
      ok(`${pre} al recargar conserva el respaldo escrito`,
        (await t('chat-prefs-texto').inputValue()) === 'Estoy en consulta. Le respondo apenas termine.');

      // ── La paciente escribe y recibe la respuesta rotulada ────────────
      const ctxPaciente = await navegador.newContext({
        viewport: pantalla.viewport,
        isMobile: pantalla.isMobile ?? false,
        hasTouch: pantalla.hasTouch ?? false,
      });
      await ctxPaciente.addInitScript((modo) => localStorage.setItem('mantra-core-health.theme', modo), tema);
      const q = await ctxPaciente.newPage();
      q.on('pageerror', (e) => errores.push(String(e)));
      const u = (id) => q.locator(`[data-testid="${id}"]`);
      await entrar(q, u, 'paciente@alovida.mock');
      await q.goto(`${BASE}/messaging`);
      await u('conversacion').filter({ hasText: 'Valeria' }).first().click();
      await u('hilo-texto').waitFor({ timeout: 30_000 });
      await q.waitForTimeout(600);
      // Una pregunta con un signo de alarma: la IA no la contesta, deriva.
      await u('hilo-texto').fill('Buenas noches, tengo un dolor de pecho fuerte desde hace una hora.');
      await u('hilo-texto').press('Enter');
      await u('hilo-etiqueta-ia').last().waitFor({ timeout: 20_000 })
        .then(() => ok(`${pre} la respuesta de la IA llega rotulada`, true))
        .catch(() => ok(`${pre} la respuesta de la IA llega rotulada`, false));
      const respuesta = u('mensaje').filter({ has: u('hilo-etiqueta-ia') }).last();
      ok(`${pre} ante un signo de alarma la respuesta deriva a Emergencia`,
        (await respuesta.innerText()).includes('acuda de inmediato a Emergencia'));
      await respuesta.scrollIntoViewIfNeeded();
      await q.waitForTimeout(400);
      await q.screenshot({ path: `${SALIDA}/${sufijo}-06-chat-respuesta-ia.png` });
      await ctxPaciente.close();
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
