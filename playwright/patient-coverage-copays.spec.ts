import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { entrarAlSimulador } from './support/simulador';

test.describe.configure({ mode: 'serial' });

async function screenshotWithoutOverflow(page: Page, info: TestInfo, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`patient coverage mocks ${viewport.width}`, () => {
    test.use({ viewport });

    test('policy, benefits, independent channels and keyboard access', async ({ page }, info) => {
      await entrarAlSimulador(page, 'paciente', '');
      await page.goto('/my-account');
      await page.getByRole('tab', { name: 'Seguros y tutores' }).click();
      const card = page.getByTestId('patient-coverage-card').first();
      await expect(card).toBeVisible();
      await expect(page.getByTestId('patient-coverage-card')).toHaveCount(3);
      const previousPolicy = page.getByTestId('patient-coverage-card').nth(1);
      const futurePolicy = page.getByTestId('patient-coverage-card').nth(2);
      await expect(previousPolicy).toContainText('Vencida');
      await expect(previousPolicy).not.toContainText('Cobertura activa');
      await expect(futurePolicy).toContainText('Vigencia futura');
      await expect(futurePolicy).not.toContainText('Cobertura activa');
      await expect(card).toContainText('80.50%');
      await expect(card).toContainText('0.00 Bs');
      await expect(card).toContainText('Consulta de seguimiento');
      const whatsapp = card.getByRole('link', { name: /WhatsApp/ });
      const href = await whatsapp.getAttribute('href');
      const target = new URL(href!);
      expect(target.hostname).toBe('wa.me');
      expect(target.searchParams.get('text')).toContain('Paciente:');
      expect(target.searchParams.get('text')).toContain('Póliza:');
      await expect(whatsapp).toHaveAttribute('target', '_blank');
      await expect(whatsapp).toHaveAttribute('rel', /noopener/);
      await whatsapp.focus();
      await page.keyboard.press('Tab');
      const phone = card.getByRole('link', { name: /Call center/ });
      await expect(phone).toBeFocused();
      // Antes de la Tarea 2 la maqueta usaba un número fijo (el call
      // center real de una aseguradora sembrada, sin marcarlo). Ahora
      // sale de la aseguradora ficticia de la titular ('Seguros Andina',
      // '800-10-0101' en insurance.handlers.ts).
      await expect(phone).toHaveAttribute('href', 'tel:800100101');
      expect((await phone.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      const focusVisible = await phone.evaluate((element) => {
        const style = getComputedStyle(element);
        return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
      });
      expect(focusVisible).toBe(true);
      await screenshotWithoutOverflow(page, info, `coverage-${viewport.width}`);
    });

    test('pharmacy publications, pending and separate logistics rejection', async ({
      page,
    }, info) => {
      await entrarAlSimulador(page, 'paciente', '');
      await page.goto('/my-account/pharmacy-orders');
      const links = page.locator('[data-testid="pedidos-lista"] a');
      await expect(links.first()).toBeVisible();
      const hrefs = await links.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute('href')!),
      );
      let approved = false,
        partial = false,
        denied = false,
        pending = false,
        logistical = false;
      for (const href of hrefs) {
        await page.goto(href);
        const settlement = page.getByTestId('patient-insurance-settlement');
        await expect(settlement).toBeVisible();
        const text = await settlement.innerText();
        approved ||= text.includes('Aprobado') && !text.includes('parcialmente');
        denied ||= text.includes('Rechazado por el seguro');
        pending ||= text.includes('todavía no publicó');
        if (text.includes('Aprobado parcialmente')) {
          partial = true;
          await expect(settlement).toContainText('Excluido sin asignar');
          await expect(settlement).toContainText('Cláusula 14.2');
          await expect(settlement).toContainText('2.40 Bs');
          await expect(settlement).toContainText('6.45 Bs');
          await screenshotWithoutOverflow(page, info, `pharmacy-partial-${viewport.width}`);
        }
        if (text.includes('Rechazado por el seguro')) {
          await expect(
            settlement.locator('dl > div').filter({ hasText: 'A tu cargo' }),
          ).toContainText('0.00 Bs');
        }
        if (await page.getByText('La receta adjunta está vencida.', { exact: false }).count()) {
          logistical = true;
          await expect(settlement).not.toContainText('Rechazado por el seguro');
        }
      }
      expect({ approved, partial, denied, pending, logistical }).toEqual({
        approved: true,
        partial: true,
        denied: true,
        pending: true,
        logistical: true,
      });
    });

    test('diagnostic order settlement keeps preparation and results', async ({ page }, info) => {
      await entrarAlSimulador(page, 'paciente', '');
      await page.goto('/my-account/diagnostic-orders');
      const settlements = page.getByTestId('patient-insurance-settlement');
      await expect(settlements).toHaveCount(4);
      await expect(page.getByText('Aprobado parcialmente', { exact: true })).toBeVisible();
      await expect(page.getByText('Rechazado por el seguro', { exact: true })).toBeVisible();
      await expect(
        page.getByText('La aseguradora todavía no publicó', { exact: false }),
      ).toBeVisible();
      await expect(page.getByText('Ayuno de 8 a 12 horas.', { exact: false })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Ver resultado' }).first()).toBeVisible();
      await screenshotWithoutOverflow(page, info, `diagnostics-${viewport.width}`);
    });
  });
}
