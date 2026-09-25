/**
 * H3.S4.M2 — el radio de `app-filter-bar`: cada pantalla que la usa, vista después
 * de sumarle `searchParam`. Sin la entrada, la barra sigue escribiendo `q`.
 * Uso (desde la raíz del repo): yarn node docs/trabajo/<carpeta>/evidencia/h3/consumidores-barra.mjs <urlBase>
 * Sólo cuentas sintéticas. Escribe en `evidencia/h3/`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2];
if (!BASE) throw new Error('Falta la URL de la app como primer argumento.');
const DIR = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CAPS = `${DIR}capturas`;
mkdirSync(CAPS, { recursive: true });

// Cada consumidor con la cuenta que lo ve. Los de administración, con la cuenta de administración.
const PANTALLAS = [
  { ruta: '/administration/patients', cuenta: 'admin@alovida.mock', nombre: 'pacientes' },
  { ruta: '/administration/clinical-forms', cuenta: 'admin@alovida.mock', nombre: 'formularios-clinicos' },
  { ruta: '/administration/services-catalog/import', cuenta: 'admin@alovida.mock', nombre: 'importar-arancel' },
  { ruta: '/form-builder', cuenta: 'medica@alovida.mock', nombre: 'constructor-formularios' },
  { ruta: '/glossary', cuenta: 'medica@alovida.mock', nombre: 'glosario' },
  { ruta: '/my-services', cuenta: 'medica@alovida.mock', nombre: 'mis-servicios' },
  { ruta: '/progress-notes', cuenta: 'medica@alovida.mock', nombre: 'evoluciones' },
  // La guía abre en su portada de especialidades: la barra aparece al elegir una.
  { ruta: '/directory', cuenta: 'paciente@alovida.mock', nombre: 'guia-medicos', entrar: (p) => p.getByText('Cardiología', { exact: true }).first().click() },
  { ruta: '/directories', cuenta: 'paciente@alovida.mock', nombre: 'directorios' },
  { ruta: '/clinics-directory', cuenta: 'paciente@alovida.mock', nombre: 'centros-medicos' },
  { ruta: '/pharmacies-directory', cuenta: 'paciente@alovida.mock', nombre: 'farmacias' },
  { ruta: '/laboratory-directory', cuenta: 'paciente@alovida.mock', nombre: 'laboratorios' },
  { ruta: '/design-system', cuenta: 'medica@alovida.mock', nombre: 'vitrina' },
];

const lineas = [];
const log = (t) => {
  lineas.push(t);
  process.stdout.write(t + '\n');
};
const consola = [];

async function entrar(navegador, cuenta) {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => consola.push(`[pageerror] ${p.url()} — ${String(e).split('\n')[0]}`));
  p.on('console', (m) => {
    if (m.text().includes('Content Security Policy')) return;
    if (m.type() === 'error' || m.text().includes('[mock] sin manejador')) consola.push(`[${m.type()}] ${p.url()} — ${m.text().slice(0, 300)}`);
  });
  await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await p.getByTestId('login-identifier').fill(cuenta);
  await p.getByTestId('login-password').fill('mockup');
  await p.getByTestId('login-submit').click();
  await p.waitForURL((u) => !u.pathname.startsWith('/auth') || u.pathname.startsWith('/auth/organization'), { timeout: 90_000 }).catch(() => {});
  if (p.url().includes('/auth/organization')) {
    await p.getByTestId('tenant-opcion').first().click();
    await p.waitForTimeout(1500);
  }
  return p;
}

const claves = (p) => [...new URL(p.url()).searchParams.entries()].map(([k, v]) => `${k}=${v}`).join('&') || '(ninguna)';

async function main() {
  const navegador = await chromium.launch();
  const sesiones = new Map();
  const soloEstas = process.argv.slice(3);
  for (const { ruta, cuenta, nombre, entrar: previo } of PANTALLAS) {
    if (soloEstas.length && !soloEstas.includes(ruta)) continue;
    try {
      if (!sesiones.has(cuenta)) sesiones.set(cuenta, await entrar(navegador, cuenta));
      const p = sesiones.get(cuenta);
      await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
      if (previo) {
        await p.waitForTimeout(2500);
        await previo(p);
      }
      const barra = p.locator('app-filter-bar:visible').first();
      const hay = await barra.waitFor({ timeout: 25_000 }).then(() => true).catch(() => false);
      await p.waitForTimeout(1200);
      const final = new URL(p.url()).pathname;
      if (!hay) {
        log(`${ruta} (${cuenta}) → ${final}: sin barra a la vista`);
        await p.screenshot({ path: `${CAPS}/h3-barra-${nombre}.png` });
        continue;
      }
      const total = await p.locator('app-filter-bar:visible').count();
      const clave = await barra.evaluate((h) => window.ng?.getComponent(h)?.searchParam?.() ?? '(sin acceso)');
      await barra.scrollIntoViewIfNeeded();
      await barra.locator('input').first().fill('a');
      await p.waitForTimeout(1300);
      // Con la latencia del simulador, la lista puede seguir cargando: se espera a que no quede
      // ningún esqueleto a la vista antes de la captura.
      await p
        .waitForFunction(
          () => ![...document.querySelectorAll('app-skeleton')].some((e) => e.getBoundingClientRect().height > 0),
          null,
          { timeout: 20_000 },
        )
        .catch(() => {});
      log(`${ruta} (${cuenta}) → ${final}: barras=${total} · clave=${clave} · tras buscar «a» la URL dice ${claves(p)}`);
      await p.screenshot({ path: `${CAPS}/h3-barra-${nombre}.png` });
    } catch (e) {
      log(`${ruta}: FALLÓ — ${String(e?.message ?? e).split('\n')[0]}`);
    }
  }
  await navegador.close();
  writeFileSync(`${DIR}consumidores-barra.txt`, lineas.join('\n') + '\n');
  const unicos = [...new Set(consola)];
  writeFileSync(`${DIR}consumidores-barra-consola.txt`, `# Consola (error) — ${new Date().toISOString()}\n\n${unicos.length ? unicos.join('\n') : 'ninguno'}\n`);
  log(`consola: ${unicos.length} distintas`);
}
main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + '\n');
  process.exitCode = 2;
});
