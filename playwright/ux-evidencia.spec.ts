import { test, expect, type Page } from '@playwright/test';

/**
 * Evidencia visual del plan de UX del 22/08/2026.
 *
 * No es una prueba de regresión: es el recorrido que deja las capturas con las
 * que se revisa lo entregado. Las aserciones son las mínimas para que una
 * captura en blanco falle en vez de guardarse como si fuera prueba de algo.
 *
 * Las cuentas salen del entorno (`E2E_*`): las siembra la propia API con sus
 * altas públicas, que es el camino que recorre cualquiera.
 */

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4201';
const CAPTURAS = process.env['E2E_SHOTS'] ?? '';

const MEDICO = {
  email: process.env['E2E_DOCTOR_EMAIL'] ?? '',
  clave: process.env['E2E_DOCTOR_PASSWORD'] ?? 'S3cret-passw0rd',
};
const PACIENTE = {
  documento: process.env['E2E_PATIENT_ID'] ?? '',
  clave: process.env['E2E_PATIENT_PASSWORD'] ?? 'S3cret-passw0rd',
};

async function entrar(page: Page, identificador: string, clave: string): Promise<void> {
  await page.goto(`${BASE}/auth`);
  await page.getByTestId('login-identifier').fill(identificador);
  await page.getByTestId('login-password').fill(clave);
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
}

async function capturar(page: Page, nombre: string): Promise<void> {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${CAPTURAS}/${nombre}.png`, fullPage: true });
}

test.describe('el panel del médico', () => {
  test('las ocho opciones, y las pantallas nuevas', async ({ page }) => {
    test.skip(MEDICO.email === '', 'sin cuenta de médico sembrada');
    await entrar(page, MEDICO.email, MEDICO.clave);

    // El menú entero, que es la evidencia de §4.H.
    const entradas = await page.getByTestId('nav-enlace').allTextContents();
    console.log('MENÚ DEL MÉDICO:', JSON.stringify(entradas.map((t) => t.trim())));
    await capturar(page, '01-menu-del-medico');

    await page.goto(`${BASE}/consultation`);
    await expect(page.getByRole('heading', { name: 'Consulta médica' })).toBeVisible();
    await capturar(page, '02-consulta-medica');

    await page.goto(`${BASE}/progress-notes`);
    await expect(page.getByRole('heading', { name: 'Evoluciones' })).toBeVisible();
    await capturar(page, '03-evoluciones');

    // Se publica un horario **desde la aplicación**: sin él, «Mi agenda» sólo
    // muestra su estado vacío y no habría nada que enseñar del bloqueo ni de
    // la edición. De paso, es el flujo de alta recorrido de punta a punta.
    //
    // El paso se saltea si la cuenta **ya** tiene horario: la misma cuenta se
    // reusa entre corridas, y una evidencia que sólo sirve la primera vez no
    // sirve. Que la pantalla se presente como cambio es, además, la prueba de
    // D2 que se captura dos pasos más abajo.
    await page.goto(`${BASE}/schedule/new`);
    // Se espera a que el encabezado exista **antes** de preguntarle cuál es:
    // `isVisible()` no espera, así que preguntar de entrada contesta siempre
    // «todavía no» y la rama de abajo elegía mal.
    const encabezado = page.getByRole('heading', {
      name: /Publicá tu agenda|Cambiá tu horario/,
    });
    await expect(encabezado).toBeVisible({ timeout: 20_000 });
    const yaTieneHorario = (await encabezado.textContent())?.includes('Cambiá') === true;

    if (!yaTieneHorario) {
      await capturar(page, '04-publicar-mi-agenda');
      await page.getByRole('button', { name: 'Martes', exact: true }).click();
      await page.getByRole('button', { name: 'Jueves', exact: true }).click();
      await page.getByRole('button', { name: 'Publicar mi agenda' }).click();
      await expect(page.getByText('Listo, tu agenda ya está publicada')).toBeVisible({
        timeout: 30_000,
      });
      await capturar(page, '05-agenda-publicada');
    }

    // D2 · la misma pantalla, reabierta: ahora es un cambio y viene cargada.
    await page.goto(`${BASE}/schedule/new`);
    await expect(page.getByRole('heading', { name: 'Cambiá tu horario' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('button', { name: 'Guardar mi horario' })).toBeVisible();
    // El aviso de «los turnos ya abiertos no se cierran solos» se retiró a
    // pedido del propietario (19/09/2026), junto con el de alcance.
    await expect(page.getByText('Los turnos ya abiertos no se cierran solos')).toHaveCount(0);
    await capturar(page, '06-cambiar-mi-horario-precargado');

    await page.goto(`${BASE}/schedule/mine`);
    await expect(page.getByRole('heading', { name: 'Mi agenda' })).toBeVisible();
    await capturar(page, '07-mi-agenda-con-horario');

    // D4/D5 · el bloqueo, a la vista en la solapa del mes.
    await page.getByRole('tab', { name: 'Cómo viene el mes' }).click();
    await expect(page.getByRole('button', { name: 'Bloquear días u horarios' })).toBeVisible();
    await capturar(page, '08-bloqueo-visible-en-el-mes');
    await page.getByRole('button', { name: 'Bloquear días u horarios' }).click();
    await expect(page.getByRole('heading', { name: 'Bloquear días u horarios' })).toBeVisible();
    await capturar(page, '09-bloqueo-por-rango-y-franja');

    await page.goto(`${BASE}/administration/accounting/libros`);
    await capturar(page, '20-mi-facturacion');

    await page.goto(`${BASE}/laboratory-directory`);
    await expect(page.getByRole('heading', { name: 'Directorio de laboratorios' })).toBeVisible();
    await capturar(page, '21-directorio-laboratorios-grilla');
  });
});

test.describe('el panel del paciente', () => {
  test('el flujo de síntomas y los cuatro directorios', async ({ page }) => {
    test.skip(PACIENTE.documento === '', 'sin cuenta de paciente sembrada');
    await entrar(page, PACIENTE.documento, PACIENTE.clave);

    await expect(page.getByRole('heading', { name: '¿Qué te pasa?' })).toBeVisible({
      timeout: 20_000,
    });
    await capturar(page, '10-panel-del-paciente-sintomas');

    // El corazón del flujo: los chips que se pintan mientras se escribe.
    await page.getByRole('textbox').first().fill('me duele la cabeza hace tres días y veo borroso');
    await expect(page.getByText('dolor de cabeza', { exact: true })).toBeVisible();
    await expect(page.getByText('visión borrosa', { exact: true })).toBeVisible();
    await capturar(page, '11-sintomas-reconocidos-y-recomendacion');

    // La derivación a urgencias (C6).
    await page.getByRole('textbox').first().fill('me duele el pecho y no puedo respirar');
    await expect(page.getByText('Esto no puede esperar a un turno')).toBeVisible();
    await capturar(page, '12-derivacion-a-urgencias');

    await page.goto(`${BASE}/directory`);
    await expect(page.getByRole('heading', { name: 'Directorio de médicos' })).toBeVisible();
    await capturar(page, '13-directorio-medicos');

    await page.goto(`${BASE}/clinics-directory`);
    await expect(page.getByRole('heading', { name: 'Directorio de clínicas' })).toBeVisible();
    await capturar(page, '14-directorio-clinicas');

    await page.goto(`${BASE}/pharmacies-directory`);
    await expect(page.getByRole('heading', { name: 'Directorio de farmacias' })).toBeVisible();
    await capturar(page, '15-directorio-farmacias');
  });
});
