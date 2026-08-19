/* ============================================================================
    Carriles de fixes del 18/08/2026 — lo que se comprueba contra el stack vivo.

    Las pruebas unitarias ya fijan las reglas (`navigation.map.spec.ts`,
    `subtitulo-profesional.spec.ts`). Acá se comprueba lo que sólo se ve con la
    aplicación andando y datos reales: que el menú del paciente no ofrezca los
    foros profesionales, que la URL directa tampoco entre, y que ninguna tarjeta
    de la Guía —con los datos que hoy tiene la base, cruzados incluidos— muestre
    el nombre de otra persona.

    Se corre con la API publicada en `E2E_API_URL` (el stack `mantra-redesa` la
    publica en 3000) y el front en `E2E_BASE_URL`.
    ========================================================================== */

import { test, expect, type Page } from '@playwright/test';

import { contextoDeApi, crearPaciente } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

async function rutasDelMenu(page: Page): Promise<string[]> {
  return page
    .getByTestId('nav-enlace')
    .evaluateAll((nodos) => nodos.map((n) => (n as HTMLElement).dataset['route'] ?? ''));
}

test('F-20 · el paciente no ve «Grupos y foros» y la URL directa no entra', async ({ page }) => {
  const api = await contextoDeApi();
  const paciente = await crearPaciente(api);
  await api.dispose();

  await entrar(page, paciente);
  await irA(page, '/dashboard');
  await estable(page);

  expect(await rutasDelMenu(page)).not.toContain('/groups');

  await irA(page, '/groups');
  await estable(page);
  expect(page.url()).not.toContain('/groups');
});

test('F-25 · ninguna tarjeta de la Guía muestra el nombre de otra', async ({ page }) => {
  const api = await contextoDeApi();
  const paciente = await crearPaciente(api);
  await api.dispose();

  await entrar(page, paciente);
  await irA(page, '/directory');
  await estable(page);

  const tarjetas = await page
    .locator('li[app-search-result]')
    .evaluateAll((nodos) =>
      nodos.map((n) => ({
        titulo: (n.querySelector('.app-resultado__titulo a')?.textContent ?? '').trim(),
        texto: (n.querySelector('.app-resultado__meta')?.textContent ?? '').trim(),
      })),
    );

  const nombres = [...new Set(tarjetas.map((t) => t.titulo).filter((t) => t !== ''))];
  const cruces = tarjetas.filter((t) =>
    nombres.some((otro) => otro !== t.titulo && t.texto.includes(otro)),
  );

  expect(nombres.length, 'la guía debería traer profesionales').toBeGreaterThan(0);
  expect(cruces.map((c) => c.texto)).toEqual([]);
});

test('F-15 · el directorio de laboratorios tiene qué mostrar', async ({ page }) => {
  const api = await contextoDeApi();
  const paciente = await crearPaciente(api);
  await api.dispose();

  await entrar(page, paciente);
  await irA(page, '/laboratory-directory');
  await estable(page);

  const texto = (await page.locator('app-root').textContent()) ?? '';
  // Los nombres los siembra `tools/redesa/seed-diagnostic-units.mjs`.
  expect(texto).toContain('Laboratorio');
});
