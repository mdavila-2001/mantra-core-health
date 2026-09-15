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

/**
 * Entra al portal como paciente y espera a que el armazón esté dibujado.
 *
 * La pantalla de acceso vive en `/auth` y no en `/auth/login`: esta última es un
 * 404, y buscar el campo en ella agota el plazo sin decir por qué.
 */
async function entrarComoPaciente(page: Page): Promise<void> {
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill(PACIENTE.documento);
  await page.getByTestId('login-password').fill(PACIENTE.clave);
  await page.getByTestId('login-submit').click();
  await expect(page.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
}

/** Completa el formulario de alta con un dependiente. */
async function registrarDependiente(page: Page, nombre: string): Promise<void> {
  await page.getByTestId('dependents-nuevo').click();
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByTestId('dependent-name').fill(nombre);
  await page.getByTestId('dependent-last-name').fill('Quispe');

  // El selector de fecha se maneja **tecla por tecla**: su campo está
  // enmascarado y el valor lo arma `handleInputKeydown` segmento a segmento.
  // `fill()` escribe el valor de golpe sin pasar por ahí, así que el componente
  // lo descarta al perder el foco y el formulario queda sin fecha.
  const fecha = page.getByTestId('dependent-birth-date').getByRole('textbox');
  await fecha.click();
  // `Home` antes de teclear: el clic deja el cursor donde cayó, y si cae al
  // final los primeros dígitos se escriben en el AÑO. El componente maneja esa
  // tecla y vuelve al segmento del día.
  await fecha.press('Home');
  await fecha.pressSequentially('14032018');
  await fecha.blur();
  await expect(fecha).toHaveValue('14/03/2018');

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
      if (mensaje.type() !== 'error') return;
      // La política de contenido del servidor sólo admite dos hashes de script
      // en línea, y el servidor de desarrollo inyecta los suyos para recargar en
      // caliente. Ese rechazo aparece al cargar cualquier ruta de la aplicación
      // y es anterior a esta pantalla: no se puede tomar como error del carril.
      if (mensaje.text().includes('Content Security Policy')) return;
      errores.push(mensaje.text());
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

  /**
   * Los tres anchos, cada uno en su propia ventana.
   *
   * **No se redimensiona una ventana ya dibujada**: el armazón decide al
   * montarse si el menú es una columna fija o un cajón, y cambiar el tamaño
   * después lo deja en el modo anterior tapando el contenido. Lo que vive una
   * persona es abrir la aplicación en su teléfono, así que cada medida abre su
   * propio contexto y recorre el alta entera ahí.
   */
  for (const [nombre, ancho, alto] of [
    ['telefono', 390, 844],
    ['tableta', 820, 1180],
    ['escritorio', 1440, 900],
  ] as const) {
    test(`la pantalla entra en ${nombre}`, async ({ browser }) => {
      const contexto = await browser.newContext({
        viewport: { width: ancho, height: alto },
        locale: 'es-BO',
      });
      const page = await contexto.newPage();
      try {
        await entrarComoPaciente(page);
        await page.goto('/my-account/dependents');
        await registrarDependiente(page, 'Rosa');

        await expect(page.getByTestId('dependents-lista')).toContainText('Rosa Quispe');

        // Nada desborda a lo ancho: el cuerpo no scrollea en horizontal.
        await expect
          .poll(
            () =>
              page.evaluate(
                () =>
                  document.documentElement.scrollWidth -
                  document.documentElement.clientWidth,
              ),
            { message: `desborde horizontal en ${nombre}` },
          )
          .toBeLessThanOrEqual(1);

        // Y el nombre del dependiente se lee entero, sin quedar tapado por el
        // menú: se compara su caja con la del contenido principal.
        const tarjeta = page.getByTestId('dependents-lista').getByText('Rosa Quispe');
        const caja = await tarjeta.boundingBox();
        expect(caja, `sin caja visible en ${nombre}`).not.toBeNull();
        expect(caja!.x, `nombre cortado por la izquierda en ${nombre}`).toBeGreaterThanOrEqual(0);
        expect(
          caja!.x + caja!.width,
          `nombre cortado por la derecha en ${nombre}`,
        ).toBeLessThanOrEqual(ancho);

        await page.screenshot({
          path: `artifacts/playwright/b1-dependientes-${nombre}.png`,
          fullPage: true,
        });
      } finally {
        await contexto.close();
      }
    });
  }
});
