import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { vigilar } from './support/salud-de-rutas';
import { entrar, estable, irA } from './support/sesion';

const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

async function abrir(page: Page, ruta: string, titulo: string): Promise<void> {
  await irA(page, ruta);
  await estable(page);
  await expect(page.locator('#contenido-principal')).toBeVisible();
  await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
}

test('paciente recorre directorio y cotizaciones sin errores de navegador', async ({ page }) => {
  test.setTimeout(180_000);
  const vigilante = vigilar(page);

  await entrar(page, PACIENTE);
  // El ingreso en desarrollo emite advertencias de CSP de su propio HTML
  // servidor. Se mide sólo lo que provocan las dos rutas de este recorrido.
  vigilante.limpiar();
  await abrir(page, '/directory', 'Directorio de médicos');

  await abrir(page, '/my-account/cotizaciones', 'Cotizaciones');
  const resultados = page.getByTestId('cotizaciones-resultados');
  await page.getByLabel('Ordenar por').selectOption('CERCANIA');
  const titulos = resultados.locator('h2');
  await expect.poll(() => titulos.allTextContents()).toEqual([
    'Tomografía',
    'Paracetamol',
    'Hemograma',
    'Consulta médica',
  ]);
  await page.getByLabel('Vertical').selectOption('ANALISIS');
  await expect.poll(() => titulos.allTextContents()).toEqual(['Hemograma']);

  expect(vigilante.erroresDeConsola).toEqual([]);
  expect(vigilante.peticionesFallidas).toEqual([]);
});
