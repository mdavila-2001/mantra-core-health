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
  await page.getByTestId('cotizaciones-busqueda').locator('input').fill('paracetamol');
  await page.getByLabel('Ordenar por').selectOption({ label: 'Cercanía' });
  // Con el origen elegido, cercanía ordena por los kilómetros que calculó la API.
  const distancias = resultados.locator('.cotizaciones__distancia');
  await expect(distancias.first()).toContainText(' km');
  const kilometros = (await distancias.allTextContents()).map((texto) =>
    Number(texto.replace(/[^\d,]/gu, '').replace(',', '.')),
  );
  expect(kilometros).toEqual([...kilometros].sort((a, b) => a - b));

  await page.getByLabel('Vertical').selectOption({ label: 'Análisis' });
  await page.getByTestId('cotizaciones-busqueda').locator('input').fill('hemograma');
  await expect(resultados).toContainText('Hemograma');
  await expect(resultados).not.toContainText('Paracetamol');

  expect(vigilante.erroresDeConsola).toEqual([]);
  expect(vigilante.peticionesFallidas).toEqual([]);
});
