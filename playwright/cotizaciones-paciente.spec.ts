import { expect, test } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

test.describe('Cotizaciones del paciente', () => {
  test('compara resultados sin cargar ni mostrar documentos personales', async ({ page }) => {
    test.setTimeout(180_000);

    await entrar(page, PACIENTE);
    await irA(page, '/my-account/cotizaciones');
    await estable(page);

    await expect(page.getByRole('heading', { name: 'Cotizaciones' })).toBeVisible();
    await expect(page.getByText('Estudios en tus documentos actuales')).toHaveCount(0);

    const resultados = page.getByTestId('cotizaciones-resultados');
    await expect(resultados).toContainText('Paracetamol');
    await expect(resultados).toContainText('Tomografía');
    await expect(resultados).toContainText('Precio no publicado');
    await expect(resultados).toContainText('5 UMA');
    await expect(resultados).toContainText('Procedencia: Maqueta · referencia UMA');

    await page.getByTestId('cotizaciones-busqueda').fill('tomografía');
    await expect(resultados).toContainText('Tomografía');
    await expect(resultados).not.toContainText('Paracetamol');

    await page.getByTestId('cotizaciones-busqueda').fill('sin coincidencias');
    await expect(page.locator('main.cotizaciones p[role="status"]')).toHaveText(
      'No hay cotizaciones que coincidan con tu búsqueda.',
    );
  });
});
