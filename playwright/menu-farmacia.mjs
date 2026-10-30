/**
 * Evidencia de navegador del menú de la cuenta de farmacia (30/10/2026),
 * contra el simulador (`ng serve --configuration demo`).
 *
 * - Farmacia (`farmacia@alovida.mock`): la barra lateral tiene sólo sus seis
 *   renglones; la cabecera ya no ofrece «Mis solicitudes» (seguros) y conserva
 *   «Mis facturas»; escribir `/my-account/requests` a mano no abre la pantalla.
 * - Paciente y médica: siguen viendo «Mis solicitudes».
 *
 * Uso: `BASE=http://localhost:4313 CHROMIUM=/opt/pw-browsers/chromium node
 * playwright/menu-farmacia.mjs`. Capturas en `evidencias/menu-farmacia-2026-10-30/`.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env['BASE'] ?? 'http://localhost:4200';
const SALIDA = 'evidencias/menu-farmacia-2026-10-30';
mkdirSync(SALIDA, { recursive: true });

const MENU_DE_LA_FARMACIA = [
  '/administration/pharmacy',
  '/administration/pharmacy-catalog',
  '/administration/pharmacy-hours',
  '/administration/pharmacy-orders',
  '/administration/pharmacy-campaigns',
  '/administration/pharmacy-branches',
];

const resultados = [];
function comprobar(nombre, ok, detalle = '') {
  resultados.push({ nombre, ok });
  console.log(`${ok ? 'OK  ' : 'FALLA'} ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

const navegador = await chromium.launch(
  process.env['CHROMIUM'] ? { executablePath: process.env['CHROMIUM'] } : {},
);

async function entrar(cuenta) {
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill(cuenta);
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-password').press('Enter');
  // Una cuenta con varias organizaciones (la médica) pasa por el selector.
  await pagina.waitForURL(
    (url) => !url.pathname.startsWith('/auth') || url.pathname === '/auth/organization',
    { timeout: 60_000 },
  );
  if (new URL(pagina.url()).pathname === '/auth/organization') {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60_000 });
  }
  await pagina
    .locator('[data-testid="header-facturas"], [data-testid="header-gastos"]')
    .first()
    .waitFor({ timeout: 60_000 });
  // El título de la pantalla: que la captura muestre la página cargada.
  await pagina.locator('h1').first().waitFor({ timeout: 60_000 });
  return { contexto, pagina, errores };
}

const enCabecera = (pagina, testId) => pagina.locator(`[data-testid="${testId}"]`).count();

// ── Farmacia ──────────────────────────────────────────────────────────────
{
  const { contexto, pagina, errores } = await entrar('farmacia@alovida.mock');
  const lateral = await pagina
    .locator('#app-side-nav [data-testid="nav-enlace"]')
    .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  const propios = lateral.filter((ruta) => !['/my-account', '/notification-center'].includes(ruta));
  comprobar(
    'farmacia: la barra lateral tiene sólo sus seis renglones',
    JSON.stringify(propios) === JSON.stringify(MENU_DE_LA_FARMACIA),
    propios.join(', '),
  );
  comprobar(
    'farmacia: la cabecera no ofrece «Mis solicitudes»',
    (await enCabecera(pagina, 'header-solicitudes')) === 0,
  );
  comprobar(
    'farmacia: la cabecera conserva «Mis facturas»',
    (await enCabecera(pagina, 'header-facturas')) === 1,
  );
  await pagina.screenshot({ path: `${SALIDA}/01-farmacia-cabecera-y-menu-1440.png` });

  await pagina.goto(`${BASE}/my-account/requests`, { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(3000);
  const ruta = new URL(pagina.url()).pathname;
  comprobar(
    'farmacia: escribir /my-account/requests a mano no abre la pantalla',
    ruta !== '/my-account/requests' ||
      (await pagina.getByRole('heading', { name: 'Mis solicitudes' }).count()) === 0,
    `terminó en ${ruta}`,
  );
  await pagina.screenshot({ path: `${SALIDA}/02-farmacia-url-a-mano-1440.png` });
  comprobar('farmacia: sin errores de página', errores.length === 0, errores.join(' | '));
  await contexto.close();
}

// ── Paciente y médica ─────────────────────────────────────────────────────
for (const [quien, cuenta] of [
  ['paciente', 'paciente@alovida.mock'],
  ['médica', 'medica@alovida.mock'],
]) {
  const { contexto, pagina, errores } = await entrar(cuenta);
  comprobar(
    `${quien}: la cabecera sigue ofreciendo «Mis solicitudes»`,
    (await enCabecera(pagina, 'header-solicitudes')) === 1,
  );
  await pagina.screenshot({
    path: `${SALIDA}/03-${quien === 'paciente' ? 'paciente' : 'medica'}-cabecera-1440.png`,
  });
  comprobar(`${quien}: sin errores de página`, errores.length === 0, errores.join(' | '));
  await contexto.close();
}

await navegador.close();
const fallas = resultados.filter((r) => !r.ok).length;
console.log(`\n${resultados.length - fallas}/${resultados.length} comprobaciones`);
process.exit(fallas === 0 ? 0 : 1);
