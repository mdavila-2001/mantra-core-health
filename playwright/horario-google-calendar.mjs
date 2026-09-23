/**
 * Evidencia visual del horario como calendario semanal (solapa «Mi agenda»).
 *
 * Entra como la médica de la maqueta, abre Consultas → Mi agenda y captura:
 * el encabezado sin «Crear agenda», la grilla estilo calendario a todo el
 * ancho con la semana en curso y hoy marcado, el globo de detalle al pasar el
 * mouse por una franja, y el diálogo «así era» de un horario retirado.
 *
 * Uso: `node playwright/horario-google-calendar.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4328';
const SALIDA = fileURLToPath(new URL('../evidencias/horario-google-calendar-2026-09-09', import.meta.url));

const RUIDO = [/favicon/i, /Content Security Policy/i, /inline script/i];

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const pagina = await contexto.newPage();

  const errores = [];
  pagina.on('console', (m) => {
    if (m.type() !== 'error') return;
    const texto = m.text();
    if (RUIDO.some((p) => p.test(texto))) return;
    errores.push(texto);
  });
  pagina.on('pageerror', (e) => errores.push(String(e)));

  const capturar = async (nombre, opciones = {}) => {
    await pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, ...opciones });
    process.stdout.write(`  · ${nombre}.png\n`);
  };

  // Ingreso a mano: el runner está roto en este worktree.
  await pagina.goto(`${BASE}/auth`);
  await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }

  await pagina.goto(`${BASE}/schedule`);
  await pagina.getByRole('tab', { name: 'Mis horarios' }).waitFor({ timeout: 30_000 });

  // 1 · el encabezado, sin «Crear agenda».
  const crear = await pagina.getByRole('link', { name: 'Crear agenda' }).count();
  process.stdout.write(`· «Crear agenda» en el encabezado: ${crear === 0 ? 'no está ✔' : 'SIGUE ✘'}\n`);
  await capturar('01-consultas-sin-crear-agenda');

  // 2 · la solapa Mi agenda con la grilla.
  await pagina.getByRole('tab', { name: 'Mis horarios' }).click();
  await pagina.locator('[data-testid="horario-bloque"]').first().waitFor({ timeout: 30_000 });
  const bloques = await pagina.locator('[data-testid="horario-bloque"]').count();
  const semana = await pagina.locator('.grilla__semana').textContent();
  const hoy = await pagina.locator('.grilla__dia--hoy .grilla__dia-numero').textContent();
  process.stdout.write(`· ${bloques} franjas · ${semana?.trim()} · hoy = ${hoy?.trim()}\n`);

  const tarjeta = pagina.locator('.mi-agenda__tarjeta');
  const cajaTarjeta = await tarjeta.boundingBox();
  const cajaPanel = await pagina.locator('app-tabs').boundingBox();
  process.stdout.write(
    `· ancho tarjeta ${Math.round(cajaTarjeta.width)} / panel ${Math.round(cajaPanel.width)} px\n`,
  );
  await capturar('02-mi-agenda-grilla-calendario', { fullPage: true });
  await tarjeta.screenshot({ path: `${SALIDA}/03-tarjeta-recortada.png` });
  process.stdout.write('  · 03-tarjeta-recortada.png\n');

  // 3 · el globo al pasar el mouse.
  await pagina.locator('[data-testid="horario-bloque"]').nth(1).hover();
  await pagina.locator('[data-testid="horario-globo"]').waitFor({ timeout: 5_000 });
  const globo = (await pagina.locator('[data-testid="horario-globo"]').textContent())
    ?.replace(/\s+/g, ' ')
    .trim();
  process.stdout.write(`· globo: ${globo}\n`);
  await capturar('04-globo-detalle-hover');

  await pagina.mouse.move(5, 5);
  const globoCerrado = (await pagina.locator('[data-testid="horario-globo"]').count()) === 0;
  process.stdout.write(`· el globo se va con el mouse: ${globoCerrado ? '✔' : '✘'}\n`);

  // 4 · el diálogo «así era» de un horario retirado, sin fechas.
  const preview = pagina.getByTestId('historico-preview').first();
  if ((await preview.count()) > 0) {
    await preview.click();
    await pagina.locator('app-content-dialog [data-testid="horario-bloque"]').first().waitFor({ timeout: 10_000 });
    const numeros = await pagina.locator('app-content-dialog .grilla__dia-numero').count();
    process.stdout.write(`· diálogo «así era»: ${numeros === 0 ? 'sin fechas ✔' : 'con fechas ✘'}\n`);
    await capturar('05-historico-asi-era');
    await pagina.keyboard.press('Escape');
  }

  // 5 · en teléfono, la grilla scrollea adentro y la página no.
  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.waitForTimeout(300);
  const desborde = await pagina.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  process.stdout.write(`· desborde horizontal de la página en 390px: ${desborde}px\n`);
  await capturar('06-movil', { fullPage: true });

  process.stdout.write(`\nErrores de consola: ${errores.length}\n`);
  for (const e of errores) process.stdout.write(`  ! ${e}\n`);
  await navegador.close();
  process.exit(errores.length === 0 && crear === 0 && globoCerrado ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(1);
});
