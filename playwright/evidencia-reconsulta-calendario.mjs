/**
 * Evidencia visual del calendario de la reconsulta (verde/rojo) y de las
 * tarjetas de horario. Suelto y no como spec porque el runner de Playwright
 * está caído en estos worktrees; `yarn node evidencia-reconsulta.mjs`.
 */
import { chromium } from 'playwright';

const BASE = process.env.PW_BASE_URL ?? 'http://localhost:4214';
const SALIDA = process.env.SALIDA ?? 'artifacts/evidencia-reconsulta';

async function asentarse(page) {
  let anterior = '';
  let iguales = 0;
  for (let i = 0; i < 20; i += 1) {
    await page.waitForTimeout(300);
    const ahora = await page.evaluate(
      () =>
        `${document.querySelectorAll('app-card').length}:${document.body.scrollHeight}:${
          document.querySelectorAll('app-skeleton, app-spinner').length
        }`,
    );
    iguales = ahora === anterior ? iguales + 1 : 0;
    anterior = ahora;
    if (iguales >= 2 && ahora.endsWith(':0')) return;
  }
}

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await contexto.newPage();
const problemas = [];
page.on('pageerror', (e) => problemas.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problemas.push(`console: ${m.text()}`);
});

await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
await page.getByTestId('login-identifier').fill('medica@alovida.mock');
await page.getByTestId('login-password').fill('cualquiera');
await page.getByTestId('login-submit').click();
await page.waitForURL((u) => !u.pathname.startsWith('/auth') || u.pathname.includes('organization'), {
  timeout: 60_000,
});
if (page.url().includes('/auth/organization')) {
  await page.getByRole('button').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
}

await page.goto(`${BASE}/schedule`, { waitUntil: 'domcontentloaded' });
await asentarse(page);
await page.getByRole('link', { name: /iniciar la consulta/i }).first().click();
await page.waitForURL((u) => u.searchParams.has('cita') || u.searchParams.has('booking'), {
  timeout: 60_000,
});
await asentarse(page);

await page.getByTestId('consulta-casilla-reconsulta').click();
await page.getByTestId('reconsulta-calendario').waitFor({ state: 'visible', timeout: 30_000 });
await asentarse(page);
await page.screenshot({ path: `${SALIDA}/01-calendario.png`, fullPage: true });

const verdes = page.locator('[data-testid="reconsulta-dia"][data-estado="libre"]');
const rojos = page.locator('[data-testid="reconsulta-dia"][data-estado="sin-cupos"]');
console.log('días verdes:', await verdes.count(), '· días rojos:', await rojos.count());

await verdes.first().click();
await page.getByTestId('reconsulta-cupo').waitFor({ state: 'visible', timeout: 30_000 });
await asentarse(page);
const tarjetas = page.locator('[data-testid="reconsulta-cupo-opcion"]');
console.log('tarjetas de horario:', await tarjetas.count());
await page.screenshot({ path: `${SALIDA}/02-horarios.png`, fullPage: true });

await tarjetas.first().click();
await page.waitForTimeout(300);
console.log(
  'tarjeta elegida (aria-pressed):',
  await tarjetas.first().getAttribute('aria-pressed'),
  '· botón habilitado:',
  (await page.getByTestId('reconsulta-guardar').getAttribute('aria-disabled')) !== 'true',
);
await page.screenshot({ path: `${SALIDA}/03-horario-elegido.png`, fullPage: true });

// Móvil: la grilla tiene que entrar en 390 px sin scroll horizontal.
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(500);
const desborde = await page.evaluate(
  () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
);
console.log('desborde horizontal en 390px:', desborde, 'px');
await page.screenshot({ path: `${SALIDA}/04-movil.png`, fullPage: true });

console.log(problemas.length === 0 ? 'sin errores de consola' : problemas.slice(0, 5).join('\n'));
await navegador.close();
