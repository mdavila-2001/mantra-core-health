import { expect, test, type Locator, type Page } from '@playwright/test';
import { elegirOpcion, marcarYConfirmarCasa } from './support/registro-paciente';

/**
 * Carril 04 — correcciones visuales del alta de paciente (`/auth/register/patient`).
 *
 * Comprueba en el navegador cada requisito del carril sobre el formulario que
 * dejó el carril 03 (cinco pasos, multicampos con «+»):
 *
 * - REQ-04-001: glifo dentro de cada campo de texto y cada select.
 * - REQ-04-002: la descripción aparece al apuntar y al enfocar, y el rótulo sigue.
 * - REQ-04-003: «Siguiente» y «Atrás» son íconos con nombre accesible.
 * - REQ-04-004: «Quitar» es ícono con nombre accesible, y pregunta antes de
 *   borrar lo escrito.
 * - REQ-04-005: las tarjetas de aclaración van debajo del formulario.
 * - REQ-04-006/007/008: pasos como nodos conectados, punta de la barra como
 *   círculo, y pasos con ícono que se pueden pulsar sólo cuando vale.
 * - REQ-04-009: el flujo del carril 03 sigue llegando a la pantalla de éxito.
 * - Fecha de nacimiento escrita a mano fuera de 1910–hoy: dice el rango y no
 *   deja pasar (pedido en la revisión del carril).
 *
 * Corre contra `ng serve` en modo mock (`yarn start:demo`), igual que
 * `carril-03-alta-paciente.spec.ts`.
 */

const TITULOS = [
  'Identidad y ocupación',
  'Lugares donde vive',
  'Datos de contacto y emergencia',
  'Empresa y lugar de trabajo',
  'Resto de datos (acceso, seguros y facturación)',
];

async function escribirFecha(page: Page, digitos: string): Promise<void> {
  const fecha = page.getByPlaceholder('DD/MM/AAAA');
  await fecha.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await fecha.pressSequentially(digitos, { delay: 20 });
}

async function esperarPaso(page: Page, numero: number): Promise<void> {
  await expect(
    page.getByRole('progressbar', {
      name: `Crear cuenta: paso ${numero} de 5, ${TITULOS[numero - 1]}`,
    }),
  ).toBeVisible();
}

async function continuar(page: Page): Promise<void> {
  const boton = page.getByTestId('paginated-form-continuar');
  await expect(boton).toBeEnabled({ timeout: 15_000 });
  await boton.click();
}

async function abrir(page: Page): Promise<void> {
  await page.goto('/auth/register/patient');
  await expect(page.getByTestId('registro-form-paciente')).toBeVisible({ timeout: 60_000 });
  await esperarPaso(page, 1);
}

async function completarPaso1(page: Page): Promise<void> {
  await page.getByTestId('registro-nombre').fill('Ana');
  await page.getByTestId('registro-apellido-paterno').fill('Paz');
  await page.getByTestId('registro-documento').fill(`${Date.now()}`.slice(-7));
  await elegirOpcion(page, 'registro-departamento-ci', { index: 1 });
  await escribirFecha(page, '17051990');
  await elegirOpcion(page, 'registro-genero', { label: 'Femenino' });
  await continuar(page);
  await esperarPaso(page, 2);
}

async function completarPaso2(page: Page): Promise<void> {
  await page.getByTestId('registration-residence-mapa-SC').click();
  await elegirOpcion(page, 'registration-residence-municipio', { index: 1 });
  await marcarYConfirmarCasa(page);
  await continuar(page);
  await esperarPaso(page, 3);
}

/**
 * Los campos de texto y select visibles que NO llevan glifo dentro del marco.
 *
 * Quedan fuera, por contrato del motor (`icono` en `paginated-form.types.ts`),
 * el teléfono —su glifo es la bandera del país— y la fecha —el almanaque—.
 */
async function camposSinGlifo(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('app-form-field')]
      .filter((campo) => (campo as HTMLElement).offsetParent !== null)
      .filter((campo) => campo.querySelector(':scope app-input, :scope app-select') !== null)
      .filter((campo) => campo.querySelector('app-phone-input, app-date-picker') === null)
      .filter((campo) => campo.querySelector('[slot="icon-start"]') === null)
      .map((campo) => campo.querySelector('label')?.textContent?.trim() ?? '(sin rótulo)'),
  );
}

test.describe('Carril 04 — visuales del alta de paciente', () => {
  test('REQ-04-001: cada campo de texto y cada select lleva su glifo, en los cinco pasos', async ({
    page,
  }) => {
    await abrir(page);
    expect(await camposSinGlifo(page)).toEqual([]);
    await completarPaso1(page);
    expect(await camposSinGlifo(page)).toEqual([]);
    await completarPaso2(page);

    // El contacto sumado con «+» (carril 03) también: nombre y relación.
    await page.getByTestId('registro-agregar-contacto').click();
    await expect(page.getByTestId('registro-contacto-extra-0')).toBeVisible();
    expect(await camposSinGlifo(page)).toEqual([]);
    await page.getByTestId('registro-quitar-contacto-0').click();

    await page.getByTestId('registro-telefono').fill('70012345');
    await continuar(page);
    await esperarPaso(page, 4);
    expect(await camposSinGlifo(page)).toEqual([]);
    await continuar(page);
    await esperarPaso(page, 5);
    expect(await camposSinGlifo(page)).toEqual([]);
  });

  test('REQ-04-002: la descripción aparece al apuntar y al enfocar, sin quitar el rótulo', async ({
    page,
  }) => {
    await abrir(page);
    const campo = page.locator('app-form-field').filter({ has: page.getByTestId('registro-documento') });
    const descripcion = campo.locator('.form-field-description');

    await expect(campo.locator('label')).toContainText('Documento de identidad');
    await expect(descripcion).toHaveCSS('opacity', '0');

    await campo.hover();
    await expect(descripcion).toHaveCSS('opacity', '1');

    await page.mouse.move(0, 0);
    await expect(descripcion).toHaveCSS('opacity', '0');

    await page.getByTestId('registro-documento').focus();
    await expect(descripcion).toHaveCSS('opacity', '1');

    // La descripción también es parte del nombre accesible descrito del control.
    const idDescripcion = await descripcion.getAttribute('id');
    await expect(page.getByTestId('registro-documento')).toHaveAttribute(
      'aria-describedby',
      new RegExp(idDescripcion ?? 'sin-id'),
    );
    // Y el placeholder acompaña sin reemplazar al rótulo.
    await expect(page.getByTestId('registro-documento')).toHaveAttribute('placeholder', /.+/);
  });

  test('REQ-04-003: «Siguiente» y «Atrás» son íconos con nombre accesible', async ({ page }) => {
    await abrir(page);
    const siguiente = page.getByRole('button', { name: 'Siguiente', exact: true });
    await expect(siguiente).toBeVisible();
    await expect(siguiente).toHaveText('');
    await expect(siguiente.locator('app-nav-icon')).toHaveCount(1);
    await expect(page.getByTestId('paginated-form-atras')).toHaveCount(0);

    await completarPaso1(page);
    const atras = page.getByRole('button', { name: 'Atrás', exact: true });
    await expect(atras).toBeVisible();
    await expect(atras).toHaveText('');

    // El globo repite el nombre con el foco del teclado.
    await atras.focus();
    await expect(page.getByRole('tooltip').filter({ hasText: 'Atrás' })).toBeVisible();

    await atras.click();
    await esperarPaso(page, 1);
  });

  test('REQ-04-004: «Quitar» es ícono y pregunta antes de borrar lo escrito', async ({ page }) => {
    await abrir(page);
    await completarPaso1(page);
    await completarPaso2(page);

    await page.getByTestId('registro-agregar-contacto').click();
    const quitar: Locator = page.getByTestId('registro-quitar-contacto-0');
    await expect(quitar).toHaveAccessibleName('Quitar el contacto de emergencia 1');
    await expect(quitar).toHaveText('');
    await expect(quitar.locator('app-nav-icon')).toHaveCount(1);

    // Vacío: se quita sin preguntar.
    await quitar.click();
    await expect(page.getByTestId('registro-contacto-extra-0')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Con datos: pregunta. «Conservar» lo deja como estaba.
    await page.getByTestId('registro-agregar-contacto').click();
    await page.getByTestId('registro-contacto-extra-nombre-0').fill('Luis Paz');
    await page.getByTestId('registro-quitar-contacto-0').click();
    const dialogo = page.getByRole('dialog');
    await expect(dialogo).toBeVisible();
    await expect(dialogo).toContainText('Quitar el contacto de emergencia 1');
    await dialogo.getByRole('button', { name: 'Conservar' }).click();
    await expect(page.getByTestId('registro-contacto-extra-nombre-0')).toHaveValue('Luis Paz');

    // «Quitar» lo borra.
    await page.getByTestId('registro-quitar-contacto-0').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Quitar', exact: true }).click();
    await expect(page.getByTestId('registro-contacto-extra-0')).toHaveCount(0);

    // Los celulares sumados usan el mismo botón y la misma pregunta.
    await page.getByTestId('registro-agregar-telefono').click();
    await page.getByTestId('registro-telefono-extra-0').fill('71111111');
    const quitarCelular = page.getByTestId('registro-quitar-telefono-0');
    await expect(quitarCelular).toHaveAccessibleName('Quitar el celular 1');
    await expect(quitarCelular).toHaveText('');
    await quitarCelular.click();
    await page.getByRole('dialog').getByRole('button', { name: 'Quitar', exact: true }).click();
    await expect(page.getByTestId('registro-telefono-extra-0')).toHaveCount(0);
  });

  test('REQ-04-005: las tarjetas de aclaración van debajo del formulario', async ({ page }) => {
    for (const ancho of [1440, 768, 375]) {
      await page.setViewportSize({ width: ancho, height: 900 });
      await abrir(page);
      const formulario = await page.getByTestId('registro-form-paciente').boundingBox();
      const ayuda = await page.locator('app-registration-help').boundingBox();
      expect(formulario, `formulario @${ancho}`).not.toBeNull();
      expect(ayuda, `ayuda @${ancho}`).not.toBeNull();
      expect(ayuda!.y, `ayuda debajo @${ancho}`).toBeGreaterThan(formulario!.y + formulario!.height);
    }
  });

  test('REQ-04-006/007/008: pasos como nodos conectados, punta circular y pasos navegables', async ({
    page,
  }) => {
    await abrir(page);

    // Cinco nodos, cuatro conectores entre ellos.
    await expect(page.locator('.stepper__step')).toHaveCount(5);
    await expect(page.locator('.stepper__connector')).toHaveCount(4);

    // Cada paso pendiente o actual dibuja su glifo.
    await expect(page.locator('.stepper__marker app-nav-icon')).toHaveCount(5);

    // La punta de la barra es un círculo.
    const punta = page.locator('.progress__marker');
    await expect(punta).toBeVisible();
    await expect(punta).toHaveCSS('border-radius', /50%|9999px|999px/);

    // Un paso pendiente no se abre; dice por qué.
    const paso3 = page.getByTestId('stepper-paso-2');
    await expect(paso3).toHaveAttribute('aria-disabled', 'true');
    // `force`: Playwright no pulsa un `aria-disabled` por su cuenta, y lo que se
    // prueba es justamente que pulsarlo no lleva a ningún lado.
    await paso3.click({ force: true });
    await esperarPaso(page, 1);

    // Uno completado sí: se vuelve a él y lo escrito sigue.
    await completarPaso1(page);
    const paso1 = page.getByTestId('stepper-paso-0');
    await expect(paso1).not.toHaveAttribute('aria-disabled', 'true');
    await paso1.click();
    await esperarPaso(page, 1);
    await expect(page.getByTestId('registro-nombre')).toHaveValue('Ana');
  });

  test('REQ-04-009: el alta completa del carril 03 sigue llegando a la pantalla de éxito', async ({
    page,
  }) => {
    await abrir(page);
    await completarPaso1(page);
    await completarPaso2(page);
    await page.getByTestId('registro-telefono').fill('70012345');
    await page.getByTestId('registro-tutor-nombre').fill('Rosa Quispe');
    await elegirOpcion(page, 'registro-tutor-relacion', { index: 2 });
    await continuar(page);
    await esperarPaso(page, 4);
    await continuar(page);
    await esperarPaso(page, 5);

    await page.getByTestId('registro-correo').fill(`carril04.${Date.now()}@example.com`);
    await page.getByTestId('registro-password').fill('Clave-Segura-2026');
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 30_000 });
  });

  test('una fecha de nacimiento fuera de 1910–hoy dice el rango y no deja pasar', async ({ page }) => {
    await abrir(page);
    await page.getByTestId('registro-nombre').fill('Ana');
    await page.getByTestId('registro-apellido-paterno').fill('Paz');
    await page.getByTestId('registro-documento').fill(`${Date.now()}`.slice(-7));
    await elegirOpcion(page, 'registro-departamento-ci', { index: 1 });
    await elegirOpcion(page, 'registro-genero', { label: 'Femenino' });

    const fecha = page.getByPlaceholder('DD/MM/AAAA');
    const error = page.locator('app-form-field', { has: fecha }).locator('.form-field-error');

    // Antes decía «Ingrese su fecha de nacimiento.» sobre una fecha que sí estaba escrita.
    await escribirFecha(page, '20021800');
    await page.getByTestId('paginated-form-continuar').click();
    await expect(error).toHaveText('Ingrese una fecha desde 1910 hasta hoy.');
    await esperarPaso(page, 1);

    // Al corregirla el error se va y el paso avanza.
    await escribirFecha(page, '17051990');
    await expect(error).toHaveCount(0);
    await continuar(page);
    await esperarPaso(page, 2);
  });
});
