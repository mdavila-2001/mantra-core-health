import { expect, test, type Page } from '@playwright/test';
import { elegirOpcion } from './support/registro-paciente';

/**
 * Carril 03 — el alta de paciente de punta a punta, en sus cinco pasos.
 *
 * Recorre el formulario tal como está hoy (identidad → residencia → contacto →
 * trabajo → resto) y comprueba lo que el carril corrige:
 *
 * - un correo sin terminación de dominio (`ana@gmail`) no sale: la API lo
 *   rechazaría con un 400 recién al enviar;
 * - el alta completa viaja con el parentesco del contacto de emergencia y la
 *   razón social, y llega a la pantalla de éxito.
 *
 * Corre contra `ng serve` en modo mock. El mock es un interceptor de Angular:
 * la petición no sale a la red y Playwright no la ve. Lo que sí hace es aplicar
 * la misma lista blanca de claves que el DTO de la API
 * (`api-contract.generated.ts`), así que llegar a la pantalla de éxito prueba
 * que ninguna clave del cuerpo es desconocida. El cuerpo exacto lo fija
 * `register-patient.spec.ts`.
 */

/** Escribe una fecha en `app-date-picker`, que arma DD/MM/AAAA dígito por dígito. */
async function escribirFecha(page: Page, digitos: string): Promise<void> {
  const fecha = page.getByPlaceholder('DD/MM/AAAA');
  await fecha.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await fecha.pressSequentially(digitos, { delay: 20 });
}

/** El paso visible, por el título de su encabezado de progreso. */
async function esperarPaso(page: Page, numero: number, titulo: string): Promise<void> {
  await expect(
    page.getByRole('progressbar', { name: `Crear cuenta: paso ${numero} de 5, ${titulo}` }),
  ).toBeVisible();
}

async function continuar(page: Page): Promise<void> {
  const boton = page.getByTestId('paginated-form-continuar');
  await expect(boton).toBeEnabled({ timeout: 15_000 });
  await boton.click();
}

/** Completa los dos primeros pasos y deja la pantalla en «Datos de contacto y emergencia». */
async function llegarAlContacto(page: Page, documento: string): Promise<void> {
  await page.goto('/auth/register/patient');
  await expect(page.getByTestId('registro-form-paciente')).toBeVisible();

  await esperarPaso(page, 1, 'Identidad y ocupación');
  await page.getByTestId('registro-nombre').fill('Ana');
  await page.getByTestId('registro-apellido-paterno').fill('Paz');
  await page.getByTestId('registro-documento').fill(documento);
  await elegirOpcion(page, 'registro-departamento-ci', { index: 1 });
  await escribirFecha(page, '17051990');
  await elegirOpcion(page, 'registro-genero', { label: 'Femenino' });
  await continuar(page);

  await esperarPaso(page, 2, 'Lugares donde vive');
  // Por la salida «completar a mano» de la dirección: el toque sobre el plano
  // lo prueba `direccion-por-mapa.spec.ts`.
  await page.getByTestId('registration-residence-a-mano').click();
  await elegirOpcion(page, 'registration-residence-departamento', { label: 'Santa Cruz' });
  await expect(page.getByTestId('registration-residence-municipio')).toBeVisible();
  await elegirOpcion(page, 'registration-residence-municipio', { index: 1 });
  await continuar(page);

  await esperarPaso(page, 3, 'Datos de contacto y emergencia');
}

/** Completa los cuatro primeros pasos y deja la pantalla en «Resto de datos». */
async function llegarAlUltimoPaso(page: Page, documento: string): Promise<void> {
  await llegarAlContacto(page, documento);
  await page.getByTestId('registro-telefono').fill('70012345');
  await page.getByTestId('registro-tutor-nombre').fill('Rosa Quispe');
  await elegirOpcion(page, 'registro-tutor-relacion', { index: 2 });
  await continuar(page);

  await esperarPaso(page, 4, 'Empresa y lugar de trabajo');
  await continuar(page);

  await esperarPaso(page, 5, 'Resto de datos (acceso, seguros y facturación)');
}

test.describe('carril 03 — alta de paciente', () => {
  test.describe.configure({ mode: 'serial' });

  test('un correo sin terminación de dominio no sale', async ({ page }) => {
    await llegarAlUltimoPaso(page, `C03-${Date.now()}`);

    await page.getByTestId('registro-correo').fill('ana@gmail');
    await page.getByTestId('registro-password').fill('Secreto123!');
    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.getByText('Ingrese un correo válido.')).toBeVisible();
    await esperarPaso(page, 5, 'Resto de datos (acceso, seguros y facturación)');
    await expect(page.getByTestId('registro-exito')).toHaveCount(0);

    await page.screenshot({
      path: 'artifacts/playwright/carril-03-correo-sin-dominio.png',
      fullPage: true,
    });
  });

  test('el alta completa viaja con parentesco y razón social', async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (msg) => {
      // El dev server inyecta scripts en línea que su propia CSP bloquea (ver
      // `carga-masiva-baseline.spec.ts`). No es de esta pantalla.
      // El simulador busca primero el glosario completo (`public/glossary-data/`,
      // en `.gitignore`) y, si no está, cae a la semilla (`glossary-shards.ts`):
      // ese 404 es el sondeo previsto de un checkout sin el glosario pesado.
      const glossaryProbe = msg.location().url.includes('/glossary-data/');
      if (msg.type() === 'error' && !/Content Security Policy/.test(msg.text()) && !glossaryProbe) {
        errores.push(msg.text());
      }
    });

    await llegarAlUltimoPaso(page, `C03-${Date.now()}`);

    await page.getByTestId('registro-correo').fill('ana.paz@correo.umsa.bo');
    await page.getByTestId('registro-password').fill('Secreto123!');
    await page.getByTestId('registro-nit').fill('1234567019');
    await page.getByTestId('registro-razon-social').fill('Ana Paz');

    await page.getByTestId('paginated-form-continuar').click();

    await expect(page.getByTestId('registro-exito')).toBeVisible();
    await expect(page.getByTestId('registro-error')).toHaveCount(0);
    expect(errores).toEqual([]);

    await page.screenshot({
      path: 'artifacts/playwright/carril-03-alta-completa.png',
      fullPage: true,
    });
  });

  test('el «+» suma celulares y contactos de emergencia, y una casilla vacía frena el paso', async ({
    page,
  }) => {
    await llegarAlContacto(page, `C03-${Date.now()}`);
    await page.getByTestId('registro-telefono').fill('70012345');

    // Una casilla de celular agregada y vacía no deja avanzar.
    await page.getByTestId('registro-agregar-telefono').click();
    await continuar(page);
    await esperarPaso(page, 3, 'Datos de contacto y emergencia');
    await expect(page.getByText('Ingrese un número completo para el país elegido, o quite la casilla.')).toBeVisible();

    await page.getByTestId('registro-telefono-extra-0').fill('71111111');
    await page.getByTestId('registro-agregar-telefono').click();
    await page.getByTestId('registro-telefono-extra-1').fill('72222222');

    // Un contacto de emergencia más, con su parentesco.
    await page.getByTestId('registro-tutor-nombre').fill('Rosa Quispe');
    await page.getByTestId('registro-agregar-contacto').click();
    await page.getByTestId('registro-contacto-extra-nombre-0').fill('Luis Paz');
    await page.getByTestId('registro-contacto-extra-telefono-0').fill('73333333');
    await elegirOpcion(page, 'registro-contacto-extra-relacion-0', { index: 2 });

    await page.screenshot({
      path: 'artifacts/playwright/carril-03-multicampos.png',
      fullPage: true,
    });

    // Quitar la primera casilla de celular deja la otra.
    await page.getByTestId('registro-quitar-telefono-0').click();
    // Carril 04: con un número escrito, el «Quitar» de ícono pregunta antes.
    await page.getByRole('dialog').getByRole('button', { name: 'Quitar', exact: true }).click();
    await expect(page.getByTestId('registro-telefono-extra-0')).toHaveValue(/72222222|7222 2222/);
    await expect(page.getByTestId('registro-telefono-extra-1')).toHaveCount(0);

    await continuar(page);
    await esperarPaso(page, 4, 'Empresa y lugar de trabajo');
    await continuar(page);
    await esperarPaso(page, 5, 'Resto de datos (acceso, seguros y facturación)');

    await page.getByTestId('registro-correo').fill('luis.paz@correo.umsa.bo');
    await page.getByTestId('registro-password').fill('Secreto123!');
    await page.getByTestId('paginated-form-continuar').click();

    // El validador de contrato del mock rechazaría una clave que la API no conoce.
    await expect(page.getByTestId('registro-exito')).toBeVisible();
    await expect(page.getByTestId('registro-error')).toHaveCount(0);
  });
});
