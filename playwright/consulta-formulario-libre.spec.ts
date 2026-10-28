import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * El modal del formulario médico que no se despega (28/09/2026).
 *
 * Recorrido contra el simulador: el modal del formulario médico no tiene una
 * segunda barra. El `<dialog>` no desborda y rodar sobre su encabezado no mueve
 * el panel. Antes, las etiquetas `.sr-only` de los campos obligatorios se medían
 * contra el `<dialog>` y lo estiraban; rodar ahí subía el modal entero.
 *
 * Este archivo probaba además el «Formulario libre — campo y valor». Desde el
 * 28/10/2026 el selector «Qué va a completar» ya no lo ofrece, así que esa
 * prueba se quitó; la del modal sigue valiendo para cualquier ficha.
 */
const SALIDA = join('artifacts', 'evidencia', '2026-09-28-formulario-libre-y-deslizable', 'evidencia');
const DOCTORA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

test.beforeEach(() => {
  test.setTimeout(240_000);
  mkdirSync(SALIDA, { recursive: true });
});

async function abrirLaConsulta(page: Page): Promise<void> {
  await entrar(page, DOCTORA);
  await irA(page, '/schedule');
  const tarjetas = page.locator('.dia__bloque[data-tipo="cita"]');
  await expect(tarjetas.first()).toBeVisible();
  const enCurso = tarjetas.filter({
    has: page.locator('.dia__estado').filter({ hasText: /en (curso|consulta)/i }),
  });
  const confirmadas = tarjetas.filter({
    has: page.locator('.dia__estado').filter({ hasText: /confirmad/i }),
  });
  const tarjeta = (await enCurso.count()) > 0 ? enCurso.first() : confirmadas.first();
  const atender = tarjeta.getByTestId('dia-ir-a-atender');
  await atender.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/medical-records\/[^/]+\/consultation\?/, { timeout: 30_000 });
  await entrarAlEncuentro(page);
}

async function entrarAlEncuentro(page: Page): Promise<void> {
  await expect(page.getByTestId('consulta-rejilla')).toBeVisible({ timeout: 30_000 });
  const abrir = page.getByTestId('consulta-abrir-encuentro');
  await expect(abrir.or(page.getByTestId('encuentros-en-curso')).first()).toBeVisible();
  if (await abrir.isVisible()) await abrir.click();
  await expect(page.getByTestId('encuentros-en-curso')).toBeVisible();
}

async function abrirElFormulario(page: Page): Promise<Locator> {
  await page.getByTestId('consulta-casilla-formulario').click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  return modal;
}

/** Lo que mide el defecto: el `<dialog>` no se recorre y el panel no se mueve. */
async function medirElModal(page: Page) {
  return page.evaluate(() => {
    const dialogo = document.querySelector<HTMLElement>('dialog.content-dialog')!;
    const panel = dialogo.querySelector<HTMLElement>('.content-dialog__panel')!;
    return {
      desborde: dialogo.scrollHeight - dialogo.clientHeight,
      recorrido: dialogo.scrollTop,
      arribaDelPanel: Math.round(panel.getBoundingClientRect().top),
    };
  });
}

test.describe('en una ventana baja y en oscuro, como la del reporte', () => {
  test.use({ viewport: { width: 1025, height: 560 }, colorScheme: 'dark' });

  test('el modal del formulario médico no se despega al rodar', async ({ page }) => {
    await abrirLaConsulta(page);
    const modal = await abrirElFormulario(page);
    await expect(modal.getByTestId('campo-especialidad').first()).toBeVisible({ timeout: 30_000 });

    const antes = await medirElModal(page);
    expect(antes.desborde).toBeLessThanOrEqual(0);

    // Sobre el encabezado: con el defecto, ahí el que se recorría era el <dialog>.
    const encabezado = await modal.locator('.content-dialog__encabezado').boundingBox();
    await page.mouse.move(encabezado!.x + 200, encabezado!.y + encabezado!.height / 2);
    for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 300);
    // Y sobre el cuerpo, hasta el fondo.
    const cuerpo = await modal.locator('.content-dialog__cuerpo').boundingBox();
    await page.mouse.move(cuerpo!.x + 200, cuerpo!.y + cuerpo!.height / 2);
    for (let i = 0; i < 30; i++) await page.mouse.wheel(0, 400);

    const despues = await medirElModal(page);
    expect(despues.recorrido).toBe(0);
    expect(despues.arribaDelPanel).toBe(antes.arribaDelPanel);
    await expect(modal.getByRole('button', { name: 'Completar formulario' })).toBeInViewport();
    await page.screenshot({ path: join(SALIDA, '1-modal-al-fondo-sin-despegarse.png') });
  });
});
