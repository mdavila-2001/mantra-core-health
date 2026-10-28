import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * Comprobantes de pago (v4.2.64), de punta a punta sobre la maqueta.
 *
 * El paciente sube el comprobante de una cita desde «Mis citas»; la médica lo
 * mira en su agenda y lo rechaza con motivo; el paciente ve el motivo y sube
 * otro; la médica lo confirma y la cita queda pagada; el paciente lo ve.
 *
 * ## Una sola pestaña, a propósito
 *
 * La maqueta guarda sus datos en `sessionStorage`, que es de la pestaña: dos
 * contextos serían dos maquetas distintas y lo que sube el paciente nunca le
 * llegaría a la médica. Los dos actores se turnan en la misma.
 *
 * Exige el front en `start:demo` (backend simulado). El simulador responde
 * dentro de la aplicación, así que no hay respuestas de red que esperar: cada
 * paso se comprueba en pantalla y, lo que tiene que persistir, **después de
 * recargar** —la maqueta lo relee de su almacenamiento, no de la pantalla—.
 */
const SALIDA = join('artifacts', 'evidencia', '2026-10-28-comprobantes-de-pago');
const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};
const DOCTORA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

/** Un PNG de 1×1: lo que importa es que sea una imagen de verdad. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function foto(page: Page, archivo: string): Promise<void> {
  await page.screenshot({ path: join(SALIDA, archivo) });
}

test.beforeEach(() => {
  test.setTimeout(180_000);
  mkdirSync(SALIDA, { recursive: true });
});

/** La fila de «Mis citas» de la reconsulta con la Dra. Rojas. */
function filaDelPaciente(page: Page) {
  return page
    .locator('.turnos__item', { hasText: 'Valeria Rojas' })
    .filter({ hasText: 'Reconsulta' })
    .first();
}

/** La fila de la agenda de la médica con la cita de Ana Lucía. */
function filaDeLaMedica(page: Page) {
  return page
    .locator('div, li, article')
    .filter({ hasText: 'Ana Lucía Pérez Quiroga' })
    .filter({ has: page.getByTestId('agenda-comprobantes') })
    .last();
}

/**
 * La médica busca en su agenda, día por día, la cita de Ana Lucía.
 *
 * La reconsulta del simulador se siembra a partir de mañana y según la hora
 * cae un día u otro: suponer cuál sería una prueba que falla de noche.
 */
async function irALaCitaDeLaMedica(page: Page): Promise<void> {
  await entrar(page, DOCTORA);
  await irA(page, '/schedule');
  await expect(page.getByTestId('dia-siguiente')).toBeVisible({ timeout: 30_000 });
  for (let dia = 0; dia < 7; dia += 1) {
    await page.getByTestId('dia-siguiente').click();
    // `waitFor` y no `isVisible`: éste responde al instante, sin esperar a que
    // el día termine de dibujarse, y pasaba de largo el día de la cita.
    const esta = await filaDeLaMedica(page)
      .getByTestId('agenda-comprobantes')
      .waitFor({ state: 'visible', timeout: 4_000 })
      .then(() => true)
      .catch(() => false);
    if (esta) {
      return;
    }
  }
  throw new Error('La cita de Ana Lucía no aparece en la agenda de la próxima semana');
}

/** La médica abre los comprobantes de la cita de Ana Lucía. */
async function abrirComprobantesDeLaMedica(page: Page): Promise<void> {
  await irALaCitaDeLaMedica(page);
  await filaDeLaMedica(page).getByTestId('agenda-comprobantes').click();
  await expect(page.getByTestId('comprobantes')).toBeVisible();
}

test('el paciente sube, la médica rechaza y confirma, y la cita queda pagada', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));

  /* ---- 1. El paciente sube el comprobante ---------------------------- */
  await entrar(page, PACIENTE);
  await irA(page, '/my-account/appointments');
  await expect(filaDelPaciente(page)).toBeVisible({ timeout: 30_000 });
  await filaDelPaciente(page).getByTestId('turnos-comprobante').click();
  await expect(page.getByTestId('comprobante-archivo')).toBeAttached();

  await page.getByTestId('comprobante-archivo').setInputFiles({
    name: 'pago-qr.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await page.getByTestId('comprobante-monto').fill('150.00');
  await page.getByTestId('comprobante-nota').locator('textarea').fill('Pagué por QR desde el Banco Unión');
  await foto(page, '01-paciente-formulario-1440.png');

  await page.getByTestId('comprobante-enviar').click();
  await expect(page.getByTestId('comprobante-pendiente')).toBeVisible();
  await expect(page.getByTestId('comprobante-PENDING')).toContainText('150.00');
  await foto(page, '02-paciente-enviado-1440.png');

  // Persistencia: recargar y volver a abrir lo sigue mostrando.
  await page.reload();
  await expect(filaDelPaciente(page)).toBeVisible({ timeout: 30_000 });
  await filaDelPaciente(page).getByTestId('turnos-comprobante').click();
  await expect(page.getByTestId('comprobante-PENDING')).toContainText('Pagué por QR desde el Banco Unión');

  /* ---- 2. La médica lo mira y lo rechaza con motivo ------------------- */
  await abrirComprobantesDeLaMedica(page);
  await expect(page.getByTestId('comprobante-PENDING')).toContainText('Ana Lucía Pérez Quiroga');
  await page.getByTestId('comprobante-ver').click();
  await expect(page.getByTestId('comprobante-vista').locator('img, canvas')).toBeVisible();
  await foto(page, '03-medica-revisa-1440.png');

  await page.getByTestId('comprobante-rechazar').click();
  await page.getByTestId('comprobante-motivo-campo').locator('textarea').fill('No se lee el monto');
  await page.getByTestId('comprobante-rechazar-confirmar').click();
  await expect(page.getByTestId('comprobante-REJECTED')).toContainText('No se lee el monto');
  await foto(page, '04-medica-rechazo-1440.png');

  /* ---- 3. El paciente ve el motivo y sube otro ------------------------ */
  await entrar(page, PACIENTE);
  await irA(page, '/my-account/appointments');
  await expect(filaDelPaciente(page)).toBeVisible({ timeout: 30_000 });
  await filaDelPaciente(page).getByTestId('turnos-comprobante').click();
  await expect(page.getByTestId('comprobante-motivo')).toContainText('No se lee el monto');
  await page.getByTestId('comprobante-archivo').setInputFiles({
    name: 'pago-qr-nitido.png',
    mimeType: 'image/png',
    buffer: PNG,
  });
  await foto(page, '05-paciente-ve-motivo-1440.png');
  await page.getByTestId('comprobante-enviar').click();
  await expect(page.getByTestId('comprobante-PENDING')).toBeVisible();

  /* ---- 4. La médica confirma: la cita queda pagada -------------------- */
  await abrirComprobantesDeLaMedica(page);
  await page.getByTestId('comprobante-confirmar').click();
  await expect(page.getByTestId('comprobante-CONFIRMED')).toBeVisible();
  // El rechazado queda en la historia, con su motivo.
  await expect(page.getByTestId('comprobante-REJECTED')).toContainText('No se lee el monto');
  await foto(page, '06-medica-confirmo-1440.png');
  await page.getByRole('dialog', { name: 'Comprobantes de pago' }).getByRole('button', { name: 'Cerrar' }).click();
  await expect(page.getByTestId('comprobantes')).toHaveCount(0);
  // La agenda relee: la insignia de pago de la cita es la del servidor.
  await expect(filaDeLaMedica(page)).toContainText('Pagada');
  await foto(page, '07-medica-agenda-pagada-1440.png');
  // Persistencia del lado de la médica: entrar de nuevo (recarga completa) y
  // la cita sigue pagada.
  await irALaCitaDeLaMedica(page);
  await expect(filaDeLaMedica(page)).toContainText('Pagada');

  /* ---- 5. El paciente ve la cita pagada, también tras recargar -------- */
  await entrar(page, PACIENTE);
  await irA(page, '/my-account/appointments');
  await expect(filaDelPaciente(page).getByTestId('turnos-pagada')).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(filaDelPaciente(page).getByTestId('turnos-pagada')).toBeVisible({ timeout: 30_000 });
  await filaDelPaciente(page).getByTestId('turnos-comprobante').click();
  await expect(page.getByTestId('comprobante-confirmado')).toBeVisible();
  await expect(page.getByTestId('comprobante-archivo')).toHaveCount(0);
  await foto(page, '08-paciente-pagada-1440.png');

  expect(errores).toEqual([]);
});

test('el modal del paciente entra en un celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrar(page, PACIENTE);
  await irA(page, '/my-account/appointments');
  const fila = page.locator('.turnos__item', { hasText: 'Valeria Rojas' }).first();
  await expect(fila).toBeVisible({ timeout: 30_000 });
  await fila.getByTestId('turnos-comprobante').click();
  await expect(page.getByTestId('comprobante-archivo')).toBeAttached();
  // Sin desplazamiento horizontal: el modal entra en el ancho.
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(desborda).toBe(false);
  await foto(page, '09-paciente-formulario-390.png');
});

test('la agenda de la médica con «Comprobantes» entra en un celular', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrar(page, DOCTORA);
  await irA(page, '/schedule');
  await expect(page.getByTestId('agenda-comprobantes').first()).toBeVisible({ timeout: 30_000 });
  const desborda = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(desborda).toBe(false);
  await page.getByTestId('agenda-comprobantes').first().scrollIntoViewIfNeeded();
  await foto(page, '10-medica-agenda-390.png');
});
