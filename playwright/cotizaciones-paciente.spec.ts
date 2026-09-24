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
    const pedidosDeOrdenes: string[] = [];
    page.on('request', (pedido) => {
      if (new URL(pedido.url()).pathname === '/diagnostic-results/me/orders') {
        pedidosDeOrdenes.push(pedido.url());
      }
    });
    await irA(page, '/my-account/cotizaciones');
    await estable(page);

    await expect(page.getByRole('heading', { name: 'Cotizaciones' })).toBeVisible();
    await expect(page.getByText('Estudios en tus documentos actuales')).toHaveCount(0);
    expect(pedidosDeOrdenes).toEqual([]);

    // Sin término no se lista nada: se pide qué cotizar.
    await expect(page.getByTestId('cotizaciones-sin-termino')).toBeVisible();

    const busqueda = page.getByTestId('cotizaciones-busqueda').locator('input');
    const resultados = page.getByTestId('cotizaciones-resultados');

    // Servicios médicos: el arancel de referencia, en UMA y rotulado, sin convertir.
    await busqueda.fill('consulta medica general');
    await expect(resultados).toContainText('UMA');
    await expect(resultados).toContainText('Referencia del Colegio Médico de Santa Cruz 2025');
    await expect(resultados).not.toContainText(/Bs\.? ?\d/u);

    // Medicamentos: precio de la lista de cada farmacia, con su procedencia.
    await busqueda.fill('paracetamol');
    await expect(resultados).toContainText('Lista PUBLICO de');

    await busqueda.fill('sin coincidencias');
    await expect(resultados).toContainText('No encontramos cotizaciones para esa búsqueda.');
  });
});
