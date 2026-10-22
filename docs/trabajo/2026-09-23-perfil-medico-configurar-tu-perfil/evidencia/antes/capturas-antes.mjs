/**
 * H1.S2 — capturas y comportamiento previo del perfil del médico, ANTES de tocar.
 * Uso (desde la raíz del repo): yarn node docs/trabajo/<carpeta>/evidencia/antes/capturas-antes.mjs <urlBase>
 * Sólo cuenta sintética `medica@alovida.mock`. No escribe nada fuera de `evidencia/antes/`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2];
if (!BASE) throw new Error('Falta la URL de la app como primer argumento.');
const DIR = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CAPS = `${DIR}capturas`;
mkdirSync(CAPS, { recursive: true });

// Port de uuid() de core/mock/mock-store.ts, para armar /directory/<id> sin adivinar.
function uuid(seed) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const a = hex(h1);
  const b = hex(h2);
  const c = hex((h1 * 31 + h2) >>> 0);
  const d = hex((h2 * 17 + h1) >>> 0);
  const raw = `${a}${b}${c}${d}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}
const ID_MEDICA = uuid('hpid-medica');
const SLUG_MEDICA = 'valeria-rojas';

const lineas = [];
const log = (t) => {
  lineas.push(t);
  process.stdout.write(t + '\n');
};
const consola = [];
const red = [];

async function nuevaPagina(navegador, ancho) {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: ancho > 800 ? 1000 : 900 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => consola.push(`[pageerror] ${p.url()} — ${String(e).split('\n')[0]}`));
  p.on('console', (m) => {
    if (m.text().includes('Content Security Policy')) return;
    if (m.type() === 'error' || m.type() === 'warning' || m.text().includes('[mock] sin manejador')) {
      consola.push(`[${m.type()}] ${p.url()} — ${m.text().slice(0, 300)}`);
    }
  });
  p.on('response', (r) => {
    if (r.status() >= 400) red.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  p.on('requestfailed', (r) => red.push(`FAILED ${r.method()} ${r.url()} — ${r.failure()?.errorText}`));
  await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await p.getByTestId('login-identifier').fill('medica@alovida.mock');
  await p.getByTestId('login-password').fill('mockup');
  await p.getByTestId('login-submit').click();
  await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 90_000 });
  if (p.url().includes('/auth/organization')) {
    await p.getByTestId('tenant-opcion').first().click();
    await p.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  return p;
}
const tab = (p, nombre) => p.getByRole('tab', { name: nombre }).first();
const cap = (p, nombre) => p.screenshot({ path: `${CAPS}/${nombre}.png`, fullPage: true });
const asentar = async (p, ms = 900) => p.waitForTimeout(ms);
const MODAL = 'dialog[open], [role="dialog"], [role="alertdialog"]';
const hayModal = async (p) => {
  const loc = p.locator(MODAL);
  await loc.first().waitFor({ state: 'visible', timeout: 1500 }).catch(() => {});
  const n = await loc.count();
  if (n === 0) return null;
  return { n, texto: (await loc.first().innerText()).replace(/\s+/g, ' ').slice(0, 200) };
};
const cerrarModal = async (p) => {
  const cancelar = p.locator(MODAL).getByRole('button', { name: /cancelar|cerrar|no,|volver/i }).first();
  if (await cancelar.count()) await cancelar.click().catch(() => {});
  else await p.keyboard.press('Escape');
  await asentar(p, 400);
};
const sinAcentos = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '');

async function abrirEditor(p, pestana) {
  await p.goto(`${BASE}/my-account/edit`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await p.locator('[data-testid="edicion-pestanas"] [role="tab"]').first().waitFor({ timeout: 60_000 });
  await asentar(p);
  await tab(p, pestana).click();
  await asentar(p);
}

async function main() {
  const navegador = await chromium.launch();

  for (const [ancho, sufijo] of [
    [1440, 'escritorio'],
    [390, 'movil'],
  ]) {
    const p = await nuevaPagina(navegador, ancho);
    // M1: ficha
    await p.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await tab(p, /Datos personales/).waitFor({ timeout: 60_000 });
    await asentar(p);
    await cap(p, `01-ficha-datos-personales-${sufijo}`);
    await tab(p, /Contacto/).click();
    await asentar(p);
    await cap(p, `02-ficha-contacto-${sufijo}`);
    // M1: editor
    await abrirEditor(p, /Trayectoria/);
    await cap(p, `03-editor-trayectoria-${sufijo}`);
    await tab(p, /Credenciales/).click();
    await asentar(p);
    await cap(p, `04-editor-credenciales-${sufijo}`);
    await p.context().close();
  }

  // M2 · M3 · M4 · M5 en escritorio
  const p = await nuevaPagina(navegador, 1440);
  await abrirEditor(p, /Trayectoria/);

  // Los dos títulos del mock están verificados y en ese estado no hay «Editar» ni
  // «Retirar» (practitioner-profile-edit.html:842). Se agrega uno pendiente desde
  // el propio formulario, como cualquier médico, para poder ejercitar M2 y M3.
  log(`M2 · botones «Editar» en Trayectoria antes de agregar: ${await p.locator('[data-testid^="formacion-editar-"]').count()}`);
  const tipo = p.getByLabel(/Tipo de título/).first();
  const opcionesTipo = (await tipo.locator('option').all());
  const primeraReal = (await Promise.all(opcionesTipo.map(async (o) => [await o.getAttribute('value'), (await o.innerText()).trim()]))).find(([v, t]) => v && t && !/eleg/i.test(t));
  if (primeraReal) await tipo.selectOption(primeraReal[0]);
  await p.getByLabel(/Número \/ título obtenido/).first().fill('TIT-PRUEBA-H1');
  await p.getByRole('button', { name: 'Agregar título' }).click();
  await asentar(p, 1800);
  log(`M2 · título de prueba agregado (tipo «${primeraReal?.[1] ?? '?'}»); botones «Editar» ahora: ${await p.locator('[data-testid^="formacion-editar-"]').count()}`);

  // M2: Editar → ¿«Guardar cambios» habilitado sin tocar nada? (título, y de paso especialidad y matrícula)
  const ejercitarEditar = async (nombre, prefijo, captura) => {
    const editar = p.locator(`[data-testid^="${prefijo}"]`);
    if ((await editar.count()) === 0) {
      log(`M2 · «Editar» ${nombre}: sin botón visible`);
      return;
    }
    await editar.first().click();
    await asentar(p);
    const modalEditar = await hayModal(p);
    const ambito = modalEditar ? p.locator(MODAL) : p;
    const guardar = ambito.getByRole('button', { name: /guardar/i }).first();
    const hayGuardar = await guardar.count();
    const deshab = hayGuardar ? await guardar.evaluate((b) => b.disabled || b.getAttribute('aria-disabled') === 'true') : null;
    log(
      `M2 · «Editar» ${nombre}: abre modal: ${modalEditar ? 'SÍ' : 'NO (edición en la misma página)'} · botón: ${hayGuardar ? `«${(await guardar.innerText()).trim()}»` : 'no encontrado'} · habilitado sin tocar nada: ${hayGuardar ? (deshab ? 'NO' : 'SÍ') : 'n/a'}`,
    );
    await cap(p, captura);
    if (modalEditar) await cerrarModal(p);
  };
  await ejercitarEditar('título', 'formacion-editar-', '05-editar-titulo-sin-tocar');
  await abrirEditor(p, /Credenciales/);
  await ejercitarEditar('especialidad', 'especialidad-editar-', '05b-editar-especialidad-sin-tocar');
  await abrirEditor(p, /Credenciales/);
  await ejercitarEditar('matrícula', 'matricula-editar-', '05c-editar-matricula-sin-tocar');

  // M3: Retirar en las tres tablas → ¿confirmación?
  const tablas = [
    [/Trayectoria/, 'formacion-retirar-', 'título'],
    [/Credenciales/, 'especialidad-retirar-', 'especialidad'],
    [/Credenciales/, 'matricula-retirar-', 'matrícula'],
  ];
  for (const [pestana, prefijo, nombre] of tablas) {
    await abrirEditor(p, pestana);
    const botones = p.locator(`[data-testid^="${prefijo}"]`);
    const n = await botones.count();
    if (n === 0) {
      log(`M3 · ${nombre}: sin botón «Retirar» visible (${n})`);
      await cap(p, `06-retirar-${sinAcentos(nombre)}`);
      continue;
    }
    const filas = 'table tbody tr:not(.data-table__detail-row)';
    const filasAntes = await p.locator(filas).count();
    await botones.first().click();
    await asentar(p);
    const modal = await hayModal(p);
    const filasDespues = await p.locator(filas).count();
    log(`M3 · «Retirar» ${nombre}: confirmación: ${modal ? `SÍ — «${modal.texto}»` : 'NO'} · filas ${filasAntes} → ${filasDespues}`);
    await cap(p, `06-retirar-${sinAcentos(nombre)}`);
    if (modal) await cerrarModal(p);
  }

  // M4: insignia «principal» hoy — ficha, /directory, perfil público
  const buscarPrincipal = async (nombre, url, prep) => {
    await p.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await asentar(p, 2500);
    if (prep) await prep();
    const insignias = await p.locator('.specialty-badge__principal').count();
    const badges = await p.locator('app-badge', { hasText: /^Principal$/ }).count();
    const texto = await p.getByText(/^Principal$/).count();
    log(`M4 · ${nombre} (${url}): .specialty-badge__principal=${insignias} · app-badge «Principal»=${badges} · texto «Principal»=${texto}`);
    await cap(p, `07-principal-${nombre}`);
  };
  await buscarPrincipal('ficha', '/my-account', async () => {
    const tabs = p.getByRole('tab');
    const total = await tabs.count();
    for (let i = 0; i < total; i++) {
      await tabs.nth(i).click().catch(() => {});
      await asentar(p, 500);
      if (await p.locator('.specialty-badge__principal').count()) {
        log(`M4 · ficha: insignia en la pestaña «${(await tabs.nth(i).innerText()).trim()}»`);
        return;
      }
    }
    await tabs.first().click().catch(() => {});
    log('M4 · ficha: ninguna pestaña muestra .specialty-badge__principal');
  });
  await buscarPrincipal('directorio-detalle', `/directory/${ID_MEDICA}`);
  await buscarPrincipal('directorio-lista', '/directory');
  await buscarPrincipal('perfil-publico', `/p/${SLUG_MEDICA}`);

  await navegador.close();
  writeFileSync(`${DIR}comportamiento-observado.txt`, lineas.join('\n') + '\n');
  const unicos = (xs) => [...new Set(xs)];
  writeFileSync(
    `${DIR}consola-red.txt`,
    `# Consola y red ANTES de tocar — ${new Date().toISOString()} — ${BASE}\n\n## Consola (error/warning, sin la CSP de ng serve)\n${consola.length ? unicos(consola).join('\n') : 'ninguno'}\n\n## Red (>= 400 o fallida)\n${red.length ? unicos(red).join('\n') : 'ninguna'}\n`,
  );
  log(`consola: ${unicos(consola).length} distintas · red: ${unicos(red).length} distintas`);
}
main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + '\n');
  process.exitCode = 2;
});
