import { expect, test, type Page } from '@playwright/test';

/**
 * B.1 · dependientes y tutor legal, en el navegador.
 *
 * ## Por qué contra el backend simulado
 *
 * Porque los endpoints de dependientes viven en una rama de la API que todavía
 * no está desplegada, y esta prueba no es sobre la API: es sobre lo que la
 * persona ve y puede hacer. La maqueta responde los mismos dos endpoints con la
 * misma forma, así que el recorrido —registrar, conmutar, ver el aviso— se
 * ejerce completo.
 *
 * ## Qué fija
 *
 * 1. Quien no tiene dependientes no ve el conmutador: un desplegable de un solo
 *    elemento es ruido.
 * 2. Registrar a un hijo lo deja elegido, y el aviso dice por quién se opera.
 * 3. El conmutador aparece en la cabecera y permite volver al perfil propio.
 * 4. La pantalla se ve entera en teléfono, tableta y escritorio.
 */

/** La cuenta de paciente de la maqueta. */
const PACIENTE = { documento: '7654321', clave: 'demo' };

/** Entra al portal como paciente y espera a que el armazón esté dibujado. */
async function entrarComoPaciente(page: Page): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel(/documento|cédula|correo/i).first().fill(PACIENTE.documento);
  await page.getByLabel(/contraseña/i).first().fill(PACIENTE.clave);
  await page.getByRole('button', { name: /ingresar|iniciar sesión|entrar/i }).first().click();
  await expect(page.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
}

/** Completa el formulario de alta con un dependiente. */
async function registrarDependiente(page: Page, nombre: string): Promise<void> {
  await page.getByTestId('dependents-nuevo').click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByTestId('dependent-name').fill(nombre);
  await page.getByTestId('dependent-last-name').fill('Quispe');

  // La fecha va por el selector propio del sistema, que escribe en su campo.
  const fecha = page.getByTestId('dependent-birth-date').getByRole('textbox');
  await fecha.fill('14/03/2018');
  await fecha.blur();

  // «Soy su madre»: el titular declara qué es él para el dependiente.
  await page
    .getByTestId('dependent-relationship')
    .getByRole('combobox')
    .selectOption({ label: 'Soy su madre' });

  await page.getByTestId('dependent-submit').click();
  await expect(page.getByRole('dialog')).toBeHidden({ timeout: 15_000 });
}

test.describe('B.1 · dependientes', () => {
  test('registrar a un hijo, conmutar y volver al perfil propio', async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') errores.push(mensaje.text());
    });

    await entrarComoPaciente(page);

    // 1 · sin dependientes no hay conmutador que ofrecer.
    await expect(page.getByTestId('header-paciente-activo')).toHaveCount(0);

    await page.goto('/my-account/dependents');
    await expect(page.getByRole('heading', { name: 'Dependientes' })).toBeVisible();
    await expect(page.getByText('Todavía no registraste a nadie')).toBeVisible();

    // 2 · el alta lo deja registrado, elegido y anunciado.
    await registrarDependiente(page, 'Mateo');

    await expect(page.getByTestId('dependents-lista')).toContainText('Mateo Quispe');
    // El parentesco se lee dado vuelta: la madre declaró ser su madre.
    await expect(page.getByTestId('dependents-lista')).toContainText('Hijo/a');
    await expect(page.getByTestId('aviso-paciente-activo')).toContainText(
      'Atendiéndose en representación de:',
    );
    await expect(page.getByTestId('aviso-paciente-activo')).toContainText('Mateo Quispe');

    // 3 · y ahora sí está el conmutador en la cabecera.
    const conmutador = page.getByTestId('header-paciente-activo');
    await expect(conmutador).toBeVisible();
    await expect(conmutador).toContainText('Mateo Quispe');

    await conmutador.click();
    await page.getByRole('menuitem', { name: /^Yo / }).click();

    await expect(page.getByTestId('aviso-paciente-activo')).toHaveCount(0);
    await expect(conmutador).not.toContainText('Mateo Quispe');

    // Ningún error de consola en todo el recorrido.
    expect(errores).toEqual([]);
  });

  test('la pantalla entra en teléfono, tableta y escritorio', async ({ page }) => {
    await entrarComoPaciente(page);
    await page.goto('/my-account/dependents');
    await registrarDependiente(page, 'Rosa');

    for (const [nombre, ancho, alto] of [
      ['telefono', 390, 844],
      ['tableta', 820, 1180],
      ['escritorio', 1440, 900],
    ] as const) {
      await page.setViewportSize({ width: ancho, height: alto });
      // Nada desborda a lo ancho: el cuerpo no scrollea en horizontal.
      const desborda = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(desborda, `desborde horizontal en ${nombre}`).toBe(false);
      await expect(page.getByTestId('dependents-lista')).toContainText('Rosa Quispe');
      await page.screenshot({
        path: `artifacts/playwright/b1-dependientes-${nombre}.png`,
        fullPage: true,
      });
    }
  });
});
