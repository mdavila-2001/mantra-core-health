/**
 * Mide «Agendar una cita» contra la regla de la casa del 09/09/2026
 * (`docs/components/composition-rules.md` §5): el formulario, que es lo único
 * de su pantalla, va **centrado y a lo ancho del área de contenido**.
 *
 * Los dos veredictos son los mismos que usa `mi-perfil-paciente.mjs`, que es
 * de donde sale la regla: la holgura izquierda y la derecha respecto de
 * `.app-main__inner` difieren en ≤ 2 px, y el bloque mide ≥ 85 % del área.
 *
 * Se mide con el navegador y no a ojo porque «se ve centrado» no es una
 * medida: antes de este cambio el formulario ocupaba 600 px de 1176 y dejaba
 * 536 px en blanco a la derecha, y a ojo pasaba por prolijo.
 *
 * Uso: `yarn node playwright/cita-a-lo-ancho.mjs [sufijo] [ancho]`
 * (con `yarn start` levantado en el 4200).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:4200';
const SUFIJO = process.argv[2] ?? 'antes';
const ANCHO = Number(process.argv[3] ?? 1440);
const SALIDA = new URL('../artifacts/cita-ancho', import.meta.url).pathname;

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: ANCHO, height: 1100 } });
const pagina = await contexto.newPage();
mkdirSync(SALIDA, { recursive: true });

await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
await pagina.getByTestId('login-password').fill('mockup');
await pagina.getByTestId('login-submit').click();
await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
if (pagina.url().includes('/auth/organization')) {
  await pagina.getByTestId('tenant-opcion').first().click();
  await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

await pagina.goto(`${BASE}/schedule/appointment/new`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await pagina.locator('form.cita').waitFor({ timeout: 30_000 });
await pagina.waitForTimeout(800);

const medir = async (sel) => pagina.locator(sel).first().boundingBox();
const area = await medir('.app-main__inner');
const bloque = await medir('form.cita');
const izq = bloque.x - area.x;
const der = area.x + area.width - (bloque.x + bloque.width);
const proporcion = bloque.width / area.width;
process.stdout.write(
  `[${SUFIJO} · ${ANCHO}px] área ${Math.round(area.width)} · bloque ${Math.round(bloque.width)} · ` +
    `izq ${Math.round(izq)} · der ${Math.round(der)} · ${(proporcion * 100).toFixed(1)} % del área\n`,
);
process.stdout.write(`  centrado (|izq-der| <= 2): ${Math.abs(izq - der) <= 2 ? 'SÍ' : 'NO'}\n`);
process.stdout.write(`  a lo ancho (>= 85 %): ${proporcion >= 0.85 ? 'SÍ' : 'NO'}\n`);

await pagina.screenshot({ path: `${SALIDA}/${SUFIJO}-${ANCHO}-buscando.png` });

// El mismo formulario con el alta abierta, que es donde más campos hay.
await pagina.getByTestId('cita-paciente-nuevo').click();
await pagina.waitForTimeout(1500);
const conAlta = await medir('form.cita');
process.stdout.write(`  con el alta abierta: bloque ${Math.round(conAlta.width)} px\n`);
await pagina.screenshot({ path: `${SALIDA}/${SUFIJO}-${ANCHO}-alta.png`, fullPage: true });

await navegador.close();
