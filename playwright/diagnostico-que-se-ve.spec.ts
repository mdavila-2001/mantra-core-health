import { test, type Page } from '@playwright/test';

/**
 * Diagnóstico: qué se ve de verdad en cada pantalla de datos.
 *
 * No afirma nada — recorre y **reporta**. Existe porque hubo una discrepancia
 * entre lo que las pruebas dirigidas decían y lo que veía una persona abriendo
 * el enlace, y la forma de resolverla es mirar todas las pantallas de datos,
 * no discutir sobre dos.
 *
 * Uso: `yarn pw --workers=1 diagnostico-que-se-ve`
 */

const RUTAS = [
  '/glossary',
  '/laboratory-directory?kind=LABORATORY',
  '/pharmacies-directory',
  '/clinics-directory',
  '/search/diagnostics',
  '/search/medications',
  '/search/hospitals',
  '/search/insurers',
  '/directories',
  '/directory',
  '/my-account/diagnostic-orders',
  '/my-account/pharmacy-orders',
] as const;

async function entrar(pagina: Page): Promise<void> {
  await pagina.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await pagina.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
}

test('qué muestra cada pantalla de datos', async ({ page }) => {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text().slice(0, 160));
  });
  page.on('response', (r) => {
    if (r.status() >= 500) errores.push(`${r.status()} ${r.url().slice(0, 100)}`);
  });

  await entrar(page);

  const informe: string[] = [];
  for (const ruta of RUTAS) {
    errores.length = 0;
    await page.goto(ruta, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    // Un respiro para que el simulador conteste; no `networkidle`.
    await page.waitForTimeout(2500);

    const texto = await page
      .locator('main')
      .innerText()
      .catch(() => '');
    const plano = texto.replace(/\s+/g, ' ').trim();
    const vacio = /no hay|sin resultados|todavía no|no encontramos|aún no/i.test(plano);

    informe.push(
      [
        `RUTA ${ruta}`,
        `  url final: ${page.url().replace(/^https?:\/\/[^/]+/, '')}`,
        `  caracteres: ${plano.length}${vacio ? '  [dice vacío]' : ''}`,
        `  primeros 220: ${plano.slice(0, 220)}`,
        errores.length === 0 ? '  consola: limpia' : `  consola: ${errores.slice(0, 2).join(' | ')}`,
      ].join('\n'),
    );
  }

  console.log('\n===== QUÉ SE VE =====\n' + informe.join('\n\n'));
});
