import { test, expect } from '@playwright/test';

import { administrador } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril Marcelo B, H2.S1 — baseline contra la pantalla **de hoy**
 * (`/administration/terminology/import`, antes del contrato §3 de
 * `CONTRATO-CARGA-MASIVA.md`). Fija lo que ya se puede automatizar sin
 * ningún `data-testid` de `carga-*`: es la línea de comparación que separa
 * lo que Justin agregó de lo que ya funcionaba.
 *
 * `[backend simulado]`: corre contra `yarn dev`, cuyo mock de
 * `POST /terminology/versions/:id/import-file` responde siempre lo mismo
 * (`terminology.handlers.ts`), sin importar el archivo.
 */
test.describe('carga masiva — baseline de hoy [backend simulado]', () => {
  test('flujo feliz: elegir versión, subir NDJSON y ver el resultado', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      // El propio servidor de desarrollo inyecta scripts en línea que violan
      // su CSP (ver `b1-dependientes.spec.ts`, `carril-06-directorios-salud.spec.ts`):
      // ruido conocido del dev-server, no del producto.
      if (msg.type() === 'error' && !msg.text().includes('Content Security Policy')) {
        consoleErrors.push(msg.text());
      }
    });
    const respuestas500: string[] = [];
    page.on('response', (res) => {
      if (res.status() >= 500) respuestas500.push(`${res.status()} ${res.url()}`);
    });

    await entrar(page, administrador());
    await irA(page, '/administration/terminology/import');
    await estable(page);

    await expect(page.getByRole('heading', { name: 'Importar terminología' })).toBeVisible();

    const selectorDeSistema = page.locator('app-select').first().locator('select');
    await expect(selectorDeSistema).toBeVisible();
    await selectorDeSistema.selectOption({ index: 1 });

    const selectorDeVersion = page.locator('app-select').nth(1).locator('select');
    await expect(selectorDeVersion).toBeVisible();
    await selectorDeVersion.selectOption({ index: 1 });

    await page
      .locator('app-file-input')
      .first()
      .locator('input')
      .setInputFiles({
        name: 'ok-3.ndjson',
        mimeType: 'application/x-ndjson',
        buffer: Buffer.from(
          '{"code":"ZZ-901","display":"Concepto baseline uno"}\n' +
            '{"code":"ZZ-902","display":"Concepto baseline dos"}\n' +
            '{"code":"ZZ-903","display":"Concepto baseline tres"}\n',
        ),
      });

    await expect(page.getByTestId('importar-tope')).toBeVisible();

    await page.getByRole('button', { name: 'Importar' }).click();

    const resultado = page.getByTestId('importar-resultado');
    await expect(resultado).toBeVisible();
    await expect(resultado).toContainText('Líneas leídas');
    await expect(resultado).toContainText('Conceptos nuevos');

    expect(respuestas500, `Respuestas ≥500: ${respuestas500.join(', ')}`).toHaveLength(0);
    expect(consoleErrors, `Errores de consola: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });
});
