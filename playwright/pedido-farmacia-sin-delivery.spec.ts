/* ============================================================================
    El pedido de farmacia no ofrece envío a domicilio (3/10/2026), en un navegador.

    Corre contra la **maqueta** (`yarn start:demo`, `mockBackend`): entra con la
    cuenta simulada de paciente, va de la receta a «Dónde comprarla», y recorre
    «Confirmá tu pedido» y los tres pasos del checkout. En cada pantalla exige
    que no aparezca ni «delivery», ni «domicilio», ni «envío a mi trabajo», y
    que no haya un selector de modalidad que elegir.

    Con `--workers=1` y `ng serve` en :4200. Capturas a `artifacts/pedido-sin-delivery/`.
    ========================================================================== */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { CLAVE, type Actor } from './support/actores';
import { entrar } from './support/sesion';

const EVIDENCIA = join(__dirname, '..', 'artifacts', 'pedido-sin-delivery');
const SIN_DELIVERY = /delivery|domicilio|envío a mi trabajo/i;

function paciente(): Actor {
  return {
    rol: 'paciente',
    identificador: process.env['E2E_PATIENT_EMAIL'] ?? 'paciente@alovida.mock',
    clave: process.env['E2E_PATIENT_PASSWORD'] ?? CLAVE,
    nombre: 'Paciente de la maqueta',
  };
}

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), animations: 'disabled', fullPage: true });
}

async function textoDeLaPantalla(page: Page): Promise<string> {
  return (await page.locator('main').innerText()).replace(/\s+/g, ' ');
}

async function irAlPedido(page: Page): Promise<void> {
  await page.goto('/my-account/medical-record?seccion=recetas', { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Dónde comprarla' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: /Dónde conseguir lo de mi receta/ })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Enviar pedido' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Confirme su pedido' })).toBeVisible({
    timeout: 30_000,
  });
}

for (const vista of [
  { nombre: 'movil', ancho: 390, alto: 844 },
  { nombre: 'escritorio', ancho: 1440, alto: 900 },
]) {
  test.describe(`pedido de farmacia sin delivery · ${vista.nombre}`, () => {
    test.describe.configure({ mode: 'serial' });

    test('de la receta al resumen no hay envío a domicilio en ninguna pantalla', async ({ page }) => {
      await page.setViewportSize({ width: vista.ancho, height: vista.alto });
      await entrar(page, paciente());
      await irAlPedido(page);

      // 1 · «Confirmá tu pedido»: la entrega se informa, no se elige.
      await expect(page.getByTestId('pedido-modalidad-retiro')).toHaveText(/Retirás el pedido en la farmacia/);
      await expect(page.locator('main input[type="radio"]')).toHaveCount(0);
      expect(await textoDeLaPantalla(page)).not.toMatch(SIN_DELIVERY);
      await capturar(page, `${vista.nombre}-1-confirma-tu-pedido`);

      // 2 · Checkout, paso «Entrega».
      await page.getByRole('button', { name: /^Continuar/ }).click();
      await expect(page.locator('#checkout-paso-titulo')).toHaveText('Cómo lo recibe');
      await expect(page.getByTestId('checkout-entrega-retiro')).toContainText('Retira su pedido en');
      expect(await textoDeLaPantalla(page)).not.toMatch(SIN_DELIVERY);
      await capturar(page, `${vista.nombre}-2-checkout-entrega`);

      // 3 · Medio de pago: tres pasos en total, ninguno de dirección.
      await page.getByTestId('checkout-siguiente').click();
      await expect(page.locator('#checkout-paso-titulo')).toHaveText('Medio de pago');
      expect(await textoDeLaPantalla(page)).not.toMatch(SIN_DELIVERY);

      // 4 · Resumen: sin línea de envío, y se puede confirmar.
      await page.getByTestId('checkout-siguiente').click();
      await expect(page.locator('#checkout-paso-titulo')).toHaveText('Revise y confirme');
      await expect(page.getByTestId('resumen-envio')).toHaveCount(0);
      await expect(page.getByTestId('checkout-resumen-entrega')).toContainText('Recojo en');
      await expect(page.getByTestId('checkout-confirmar')).toBeEnabled();
      expect(await textoDeLaPantalla(page)).not.toMatch(SIN_DELIVERY);
      // Se mide el contenido del checkout (`main`), no el documento: en `mockup` el
      // encabezado (`.app-header__derecha`) ya desbordaba en móvil —604 px a 390— antes
      // de este cambio, en todas las pantallas (medido sobre origin/mockup limpio).
      expect(await page.evaluate(() => document.querySelector('main')?.scrollWidth ?? 0)).toBeLessThanOrEqual(
        vista.ancho,
      );
      await capturar(page, `${vista.nombre}-3-checkout-resumen`);

      // El stepper tiene exactamente tres pasos: Entrega, Medio de pago, Resumen.
      await expect(page.getByTestId('stepper-paso-2')).toBeVisible();
      await expect(page.getByTestId('stepper-paso-3')).toHaveCount(0);
    });
  });
}
