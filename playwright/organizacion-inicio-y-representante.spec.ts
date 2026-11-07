import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, esperarAplicacionLista, irA } from './support/sesion';

/**
 * La cuenta de una organización (05/11/2026), cinco pedidos de Marcelo:
 *
 * 1. «Su gente» muestra nombres y roles en palabras, no uuid;
 * 3. el menú de la cuenta de organización no ofrece nada de paciente;
 * 4. el administrador corrige el nombre del representante legal desde la ficha;
 * 5. el inicio muestra el estado de la organización, el equipo y la actividad.
 *
 * Corre contra la maqueta (`yarn start:demo`): la persistencia y la recarga de
 * la corrección se prueban con la API real, no acá.
 */
const SALIDA = join('artifacts', 'evidencia', '2026-11-05-organizacion-inicio', 'evidencia');
const LABORATORIO: Actor = {
  rol: 'administrador',
  identificador: 'laboratorio@alovida.mock',
  clave: 'mock',
  nombre: 'Laboratorio',
};
const ASEGURADORA: Actor = {
  rol: 'administrador',
  identificador: 'aseguradora@alovida.mock',
  clave: 'mock',
  nombre: 'Seguros Andina',
};

/** Lo que es de un paciente y una organización no ve en su menú. */
const RUTAS_DE_PACIENTE = [
  'my-account/dependents',
  'my-account/appointments',
  'my-account/medical-record',
  'my-account/diagnostic-results',
  'my-account/diagnostic-orders',
  'my-account/quotations',
];

/**
 * Entra con la cuenta de una organización y se queda donde la deja la aplicación: el laboratorio aterriza en su
 * portal (`/administration/laboratory`), no en `/dashboard`, y `entrar` sólo acepta ese destino.
 */
async function entrarComoOrganizacion(page: Page, actor: Actor): Promise<void> {
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  const identificador = page.getByTestId('login-identifier');
  await identificador.fill(actor.identificador);
  await expect(identificador).toHaveValue(actor.identificador);
  const clave = page.getByTestId('login-password');
  await clave.fill(actor.clave);
  await expect(clave).toHaveValue(actor.clave);
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60_000 });
}

test.beforeEach(() => {
  test.setTimeout(240_000);
  mkdirSync(SALIDA, { recursive: true });
});

test('la cuenta de una organización: menú sin opciones de paciente, inicio propio y representante editable', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });

  await entrarComoOrganizacion(page, LABORATORIO);

  // 3 · el menú: ninguna ruta de paciente.
  await expect(page.getByTestId('nav-enlace').first()).toBeVisible();
  const rutas = await page
    .getByTestId('nav-enlace')
    .evaluateAll((enlaces) => enlaces.map((a) => a.getAttribute('data-route') ?? ''));
  for (const ruta of RUTAS_DE_PACIENTE) {
    expect(rutas.map((r) => r.replace(/^\//, '')), `el menú ofrece ${ruta}`).not.toContain(ruta);
  }

  // 5 · el inicio: estado, equipo y la lista de qué está en orden.
  await irA(page, '/dashboard');
  await expect(page.getByTestId('inicio-organizacion')).toBeVisible();
  await expect(page.getByTestId('inicio-verificacion')).toBeVisible();
  await expect(page.getByTestId('inicio-estado-lista')).toContainText('Representante legal');
  await expect(page.getByTestId('inicio-equipo-total')).toBeVisible();
  await page.screenshot({ path: join(SALIDA, 'inicio-organizacion.png'), fullPage: true, animations: 'disabled' });

  // 4 · la ficha: cambiar el nombre del representante.
  await irA(page, '/my-account');
  await page.getByRole('tab', { name: 'Representante y gerentes' }).click();
  await expect(page.getByTestId('ficha-representante')).toContainText('Mariana Siles');
  await page.getByTestId('representante-cambiar-nombre').click();
  // La ficha del alta de la maqueta sólo trae el nombre completo: las partes se escriben.
  // Same block as the registration: third name and any number of further names.
  await page.getByTestId('representante-nombre').fill('Mariana');
  await page.getByTestId('representante-segundo-nombre').fill('Elena');
  await page.getByTestId('representante-tercer-nombre').fill('Lucía');
  await page.getByTestId('representante-agregar-nombre').click();
  await page.getByTestId('representante-nombre-extra-0').fill('Paz');
  await page.getByTestId('representante-apellido-paterno').fill('Siles');
  await page.getByRole('button', { name: 'Guardar nombre' }).click();
  await expect(page.getByTestId('ficha-representante')).toContainText('Mariana Elena Lucía Paz Siles');
  await expect(page.getByTestId('representante-editor')).toHaveCount(0);
  await page.screenshot({ path: join(SALIDA, 'representante-editado.png'), fullPage: true, animations: 'disabled' });

  expect(errores, errores.join('\n')).toEqual([]);
});

test('«Su gente» dice quién es cada persona y qué rol tiene, sin identificadores', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page, ASEGURADORA);

  await irA(page, '/administration/my-organization');
  await page.getByRole('tab', { name: 'Su gente' }).click();

  const gente = page.locator('app-data-table').first();
  await expect(gente).toContainText('Seguros Andina');
  await expect(gente).toContainText('Dueño');
  const texto = (await gente.textContent()) ?? '';
  expect(texto, 'aparece un uuid en la tabla').not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  await page.screenshot({ path: join(SALIDA, 'su-gente.png'), fullPage: true, animations: 'disabled' });
});
