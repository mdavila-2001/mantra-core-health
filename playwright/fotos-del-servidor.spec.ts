import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, type Page } from '@playwright/test';

/**
 * Fotos de lo que ve una persona al abrir cada pantalla de datos, sin tocar
 * ningún filtro.
 *
 * Es la diferencia que importa: una prueba que busca un texto en toda la
 * página lo encuentra aunque esté al fondo, detrás de un control que nadie
 * pulsó. Una foto de la primera pantalla muestra lo que la persona ve, que es
 * de lo que se estaba hablando.
 *
 * Uso: `yarn pw --workers=1 fotos-del-servidor`
 */

const SALIDA = join(process.cwd(), 'artifacts', 'servidor');

const RUTAS = [
  ['glosario', '/glossary'],
  ['laboratorios', '/laboratory-directory?kind=LABORATORY'],
  ['farmacias', '/pharmacies-directory'],
  ['clinicas', '/clinics-directory'],
  ['hospitales', '/search/hospitals'],
  ['medicamentos', '/search/medications'],
] as const;

async function entrar(pagina: Page): Promise<void> {
  await pagina.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await pagina.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
}

test('la primera pantalla de cada ruta de datos', async ({ page }) => {
  mkdirSync(SALIDA, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await entrar(page);

  for (const [nombre, ruta] of RUTAS) {
    await page.goto(ruta, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.waitForTimeout(2500);
    // Sin `fullPage`: lo que entra en la pantalla es lo que la persona ve.
    await page.screenshot({ path: `${SALIDA}/${nombre}.png` });
  }
});
