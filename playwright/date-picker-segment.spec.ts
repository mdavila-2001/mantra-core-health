import { test, expect } from '@playwright/test';

test.describe('DatePicker — Comportamiento estilo HTML nativo de input type=date', () => {
  test('selección de segmentos y normalización de dígitos únicos a 01 y 0001', async ({ page }) => {
    await page.goto('/auth/register/patient');
    await expect(page.getByTestId('registro-form-paciente')).toBeVisible({ timeout: 20_000 });

    // Paso 1: Nombres
    await page.getByTestId('registro-nombre').fill('Carlos');
    await page.getByTestId('registro-apellido-paterno').fill('Mendoza');
    await page.getByTestId('paginated-form-continuar').click();

    // Paso 2: Documento
    await page.getByTestId('registro-documento').fill('7654321');
    await page.getByTestId('paginated-form-continuar').click();

    // Paso 3: Fecha de nacimiento
    const dateInput = page.getByPlaceholder('DD/MM/AAAA');
    await expect(dateInput).toBeVisible({ timeout: 10_000 });

    // 1. Al clickear al inicio del input de fecha se seleccionan los 2 dígitos del día [0, 2]
    await dateInput.click({ position: { x: 15, y: 15 } });
    await page.waitForTimeout(100);

    const selDay = await dateInput.evaluate((el: HTMLInputElement) => ({
      val: el.value,
      start: el.selectionStart,
      end: el.selectionEnd,
    }));
    expect(selDay.val).toBe('DD/MM/AAAA');
    expect(selDay.start).toBe(0);
    expect(selDay.end).toBe(2);

    // 2. Al presionar Tab se seleccionan los 2 dígitos del mes [3, 5]
    await page.keyboard.press('Tab');
    const selMonth = await dateInput.evaluate((el: HTMLInputElement) => ({
      start: el.selectionStart,
      end: el.selectionEnd,
    }));
    expect(selMonth.start).toBe(3);
    expect(selMonth.end).toBe(5);

    // 3. Al presionar Tab se seleccionan los dígitos del año [6, 10]
    await page.keyboard.press('Tab');
    const selYear = await dateInput.evaluate((el: HTMLInputElement) => ({
      start: el.selectionStart,
      end: el.selectionEnd,
    }));
    expect(selYear.start).toBe(6);
    expect(selYear.end).toBe(10);

    // 4. Shift+Tab regresa a Mes [3, 5]
    await page.keyboard.press('Shift+Tab');
    const selBackMonth = await dateInput.evaluate((el: HTMLInputElement) => ({
      start: el.selectionStart,
      end: el.selectionEnd,
    }));
    expect(selBackMonth.start).toBe(3);
    expect(selBackMonth.end).toBe(5);

    // 5. Shift+Tab regresa a Día [0, 2]
    await page.keyboard.press('Shift+Tab');
    const selBackDay = await dateInput.evaluate((el: HTMLInputElement) => ({
      start: el.selectionStart,
      end: el.selectionEnd,
    }));
    expect(selBackDay.start).toBe(0);
    expect(selBackDay.end).toBe(2);

    // 6. Si escribo solo 1 en el día y presiono Tab -> se convierte en 01 y pasa a Mes
    await page.keyboard.press('1');
    await page.keyboard.press('Tab');
    const valAfterDay = await dateInput.evaluate((el: HTMLInputElement) => ({
      val: el.value,
      start: el.selectionStart,
      end: el.selectionEnd,
    }));
    expect(valAfterDay.val.startsWith('01/')).toBe(true);
    expect(valAfterDay.start).toBe(3);
    expect(valAfterDay.end).toBe(5);

    // 7. Si escribo solo 1 en el mes y presiono Tab -> se convierte en 01 y pasa a Año
    await page.keyboard.press('1');
    await page.keyboard.press('Tab');
    const valAfterMonth = await dateInput.evaluate((el: HTMLInputElement) => ({
      val: el.value,
      start: el.selectionStart,
      end: el.selectionEnd,
    }));
    expect(valAfterMonth.val.startsWith('01/01/')).toBe(true);
    expect(valAfterMonth.start).toBe(6);
    expect(valAfterMonth.end).toBe(10);

    // 8. Si escribo solo 1 en el año y salgo del campo (blur) -> se convierte en 0001
    await page.keyboard.press('1');
    // Salir del foco haciendo blur
    await dateInput.evaluate((el: HTMLInputElement) => el.blur());
    const valFinal = await dateInput.inputValue();
    expect(valFinal).toBe('01/01/0001');

    // Captura de evidencia
    await page.screenshot({ path: 'evidencias/signup-wizard/date-picker-segment-verified.png' });
  });
});
