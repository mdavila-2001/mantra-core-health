/**
 * Evidencia del pedido del 18/09/2026 sobre «Mi agenda» (/schedule?vista=agenda):
 * la primera solapa se llama «Mis horarios de atención» y «Cómo viene el mes»
 * es sólo un vistazo — cada día muestra en un globo el horario de atención y
 * lo bloqueado, y tocarlo no abre nada.
 *
 * Uso: `yarn node playwright/mi-agenda-mes-globo.mjs [base] [salida]`
 * (con `ng serve` levantado; por defecto en el 4200).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://localhost:4200';
const SALIDA = process.argv[3] ?? new URL('../artifacts/mi-agenda-mes', import.meta.url).pathname;
mkdirSync(SALIDA, { recursive: true });

const resultados = [];
const verificar = (nombre, ok, detalle = '') => {
  resultados.push(ok);
  process.stdout.write(`${ok ? 'SÍ' : 'NO'} · ${nombre}${detalle ? ` — ${detalle}` : ''}\n`);
};

const navegador = await chromium.launch();
const errores = [];

for (const { nombre, ancho, alto, tema } of [
  { nombre: 'escritorio', ancho: 1440, alto: 1000, tema: 'light' },
  { nombre: 'escritorio-oscuro', ancho: 1440, alto: 1000, tema: 'dark' },
  { nombre: 'movil', ancho: 375, alto: 900, tema: 'light' },
]) {
  const contexto = await navegador.newContext({
    viewport: { width: ancho, height: alto },
    colorScheme: tema,
  });
  const pagina = await contexto.newPage();
  pagina.on('console', (m) => m.type() === 'error' && errores.push(`${nombre}: ${m.text()}`));

  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }

  await pagina.goto(`${BASE}/schedule?vista=agenda`, {
    waitUntil: 'domcontentloaded',
    timeout: 180_000,
  });
  const solapaHorario = pagina.getByRole('tab', { name: 'Mis horarios de atención' });
  await solapaHorario.waitFor({ timeout: 60_000 });
  verificar(`${nombre} · la solapa se llama «Mis horarios de atención»`, true);
  await pagina.screenshot({ path: `${SALIDA}/${nombre}-horarios.png`, fullPage: true });

  await pagina.getByRole('tab', { name: 'Cómo viene el mes' }).click();
  const dias = pagina.getByTestId('mes-dia');
  await dias.first().waitFor({ timeout: 60_000 });
  await pagina.waitForTimeout(600);

  verificar(`${nombre} · sin botones en la grilla del mes`, (await pagina.locator('.mes__grilla button').count()) === 0);
  verificar(`${nombre} · sin «Bloquear días u horarios»`, (await pagina.getByText('Bloquear días u horarios').count()) === 0);
  verificar(`${nombre} · sin Mes/Semana`, (await pagina.getByTestId('ver-semana').count()) === 0);

  // Un día con atención (tiene «n/m») y, si hay, uno bloqueado.
  const conAtencion = pagina.locator('.mes__celda[data-estado="libre"] [data-testid="mes-dia"], .mes__celda[data-estado="con-reservas"] [data-testid="mes-dia"], .mes__celda[data-estado="lleno"] [data-testid="mes-dia"]').first();
  await conAtencion.hover();
  const globo = pagina.locator('app-tooltip-panel');
  await globo.waitFor({ timeout: 5_000 });
  const texto = (await globo.textContent()) ?? '';
  verificar(`${nombre} · el globo dice el horario`, /Atendés \d\d:\d\d–\d\d:\d\d/.test(texto), texto.trim());
  await pagina.screenshot({ path: `${SALIDA}/${nombre}-mes-globo.png`, fullPage: false });

  const urlAntes = pagina.url();
  await conAtencion.click();
  await pagina.waitForTimeout(400);
  verificar(`${nombre} · tocar el día no abre nada`, pagina.url() === urlAntes && (await pagina.locator('app-day-view').count()) === 0);

  const bloqueado = pagina.locator('.mes__celda[data-estado="bloqueado"] [data-testid="mes-dia"]').first();
  if ((await bloqueado.count()) > 0) {
    await pagina.mouse.move(0, 0);
    await bloqueado.hover();
    await pagina.waitForTimeout(400);
    const textoBloqueo = (await globo.last().textContent()) ?? '';
    verificar(`${nombre} · el globo de un día bloqueado lo dice`, /Bloqueado/.test(textoBloqueo), textoBloqueo.trim());
    await pagina.screenshot({ path: `${SALIDA}/${nombre}-mes-bloqueado.png`, fullPage: false });
  } else {
    process.stdout.write(`-- ${nombre} · el mes visible no tiene días bloqueados\n`);
  }

  const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  verificar(`${nombre} · sin scroll horizontal`, desborde <= 0, `${desborde} px`);
  await contexto.close();
}

await navegador.close();
verificar('consola sin errores', errores.length === 0, errores.slice(0, 3).join(' | '));
const fallos = resultados.filter((ok) => !ok).length;
process.stdout.write(`\n${resultados.length - fallos}/${resultados.length} comprobaciones\n`);
process.exit(fallos === 0 ? 0 : 1);
