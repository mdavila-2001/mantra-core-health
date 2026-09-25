/**
 * Evidencia del correo de trabajo editable en «Contacto» del editor del perfil
 * médico (`/my-account/edit`), contra la maqueta (rama mockup), 24/09/2026:
 *
 * - Ya no es un renglón fijo: es un campo cargado con el guardado.
 * - Vacío o mal escrito no se guarda: se marca en rojo.
 * - Corregido, se guarda y sigue ahí al recargar.
 *
 * Uso: `yarn node playwright/correo-trabajo-editable.mjs [urlBase] [tema]`
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4263';
const TEMA = process.argv[3] ?? 'dark';
const SALIDA = new URL('../evidencias/correo-trabajo-editable-2026-09-24', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1');

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 1000 },
    colorScheme: TEMA,
  });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  pagina.on('console', (m) => {
    if (m.text().includes('Content Security Policy')) return;
    if (m.type() === 'error' || m.text().includes('[mock] sin manejador')) errores.push(m.text());
  });
  const capturar = (nombre, locator) =>
    (locator ?? pagina).screenshot({ path: `${SALIDA}/${TEMA}-${nombre}.png` });

  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  await pagina.evaluate(() => {
    for (const clave of Object.keys(sessionStorage)) {
      if (clave.startsWith('mock.perfil-medico.')) sessionStorage.removeItem(clave);
    }
  });

  await pagina.goto(`${BASE}/my-account/edit`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  const pestanas = pagina.locator('[data-testid="edicion-pestanas"] [role="tab"]');
  await pestanas.first().waitFor({ timeout: 60_000 });
  await pestanas.nth(1).click();
  const campo = pagina.locator('input[data-testid="edicion-correo-trabajo"]');
  await campo.waitFor({ timeout: 30_000 });
  await campo.scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(600);

  const bloque = pagina.locator('form').filter({ has: campo });
  const inicial = await campo.inputValue();
  ok('el correo de trabajo es un campo editable', await campo.isEditable(), inicial);
  ok('ya no está el renglón fijo «Tu correo de trabajo»', (await pagina.getByText('Tu correo de trabajo').count()) === 0);
  await capturar('01-campo', bloque);

  // Vacío: no viaja.
  await campo.fill('');
  await pagina.getByTestId('presentacion-acciones').getByRole('button', { name: 'Guardar cambios' }).click();
  await pagina.waitForTimeout(600);
  ok('vacío no se guarda', (await pagina.getByText('Tu perfil quedó actualizado.').count()) === 0);
  ok('vacío muestra el error', (await pagina.getByText('Escribí tu correo de trabajo.').count()) > 0);
  await capturar('02-vacio', bloque);

  // Mal escrito: tampoco.
  await campo.fill('valeria@consultorio');
  await pagina.getByTestId('presentacion-acciones').getByRole('button', { name: 'Guardar cambios' }).click();
  await pagina.waitForTimeout(600);
  ok('sin dominio con punto no se guarda', (await pagina.getByText('Revisá el correo: le falta algo, como la @ o el dominio.').count()) > 0);

  // Bien escrito: viaja como workEmail.
  await campo.fill('valeria.rojas@consultorio.bo');
  await pagina.getByTestId('presentacion-acciones').getByRole('button', { name: 'Guardar cambios' }).click();
  await pagina.waitForTimeout(1200);
  // Con `mockBackend` el simulador contesta dentro de la app y el PATCH no
  // sale a la red: se confirma por el aviso y por lo que queda al recargar.
  ok('corregido se guarda', (await pagina.getByText('Tu perfil quedó actualizado.').count()) > 0);
  await campo.scrollIntoViewIfNeeded();
  await capturar('03-guardado', bloque);
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pestanas.first().waitFor({ timeout: 60_000 });
  await pestanas.nth(1).click();
  await campo.waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(600);
  ok('al recargar sigue el valor nuevo', (await campo.inputValue()) === 'valeria.rojas@consultorio.bo', await campo.inputValue());

  // Móvil: el campo no desborda.
  await pagina.setViewportSize({ width: 390, height: 900 });
  await pagina.waitForTimeout(500);
  await campo.scrollIntoViewIfNeeded();
  const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('en 390px no hay scroll horizontal', desborde <= 0, `${desborde}px`);
  await capturar('04-movil');

  ok('sin errores de consola', errores.length === 0, errores.slice(0, 3).join(' | '));
  await navegador.close();
  process.exit(veredictos.every((v) => v.cond) ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
