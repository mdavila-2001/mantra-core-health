// Verificación en navegador de la captura de interacciones (mapa de calor).
// Contra `ng serve --configuration real-api` y un DOBLE de la API en :3000
// (ver docs/trabajo/2026-10-21-mapa-de-calor-ux/REPORTE.md). Datos sintéticos.
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const errores = [];
const ingestas = [];

const navegador = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [nombre, viewport] of [
  ['escritorio', { width: 1440, height: 900 }],
  ['movil', { width: 390, height: 844 }],
]) {
  const contexto = await navegador.newContext({ viewport });
  const pagina = await contexto.newPage();
  pagina.on('console', (m) => m.type() === 'error' && errores.push(`[${nombre}] console: ${m.text()}`));
  pagina.on('pageerror', (e) => errores.push(`[${nombre}] pageerror: ${e.message}`));
  pagina.on('response', async (r) => {
    if (r.url().includes('/telemetry/activity-events')) {
      ingestas.push({ viewport: nombre, status: r.status(), body: await r.json().catch(() => null) });
    }
  });

  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill('paciente.sintetico@example.test');
  await pagina.getByTestId('login-password').fill('clave-sintetica-1');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 120_000 });

  // Interacción real: tres clics seguidos (clic repetido), desplazamiento y
  // navegación a otra ruta.
  const cuerpo = pagina.locator('main').first();
  await cuerpo.waitFor({ timeout: 60_000 });
  const caja = await cuerpo.boundingBox();
  for (let i = 0; i < 3; i++) {
    await pagina.mouse.click((caja?.x ?? 10) + 30, (caja?.y ?? 10) + 30);
  }
  await pagina.mouse.wheel(0, 2000);
  // Recarga completa: la pestaña vieja dispara `pagehide` (lote con keepalive)
  // y la nueva restaura la sesión con el refresh token.
  await pagina.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded' });
  await pagina.locator('main').first().waitFor({ timeout: 120_000 });
  await pagina.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 120_000 });
  const campo = pagina.locator('main input, main button').first();
  if (await campo.count()) await campo.click({ timeout: 30_000 }).catch(() => {});
  await pagina.screenshot({ path: `artifacts/ux-heatmap/${nombre}.png` });
  // Cerrar la página dispara `pagehide`: el último lote sale con keepalive.
  await pagina.close({ runBeforeUnload: true });
  await contexto.close();
}
await navegador.close();

console.log(JSON.stringify({ ingestas, errores }, null, 2));
