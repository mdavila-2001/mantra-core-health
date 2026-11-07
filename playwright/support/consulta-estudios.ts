import { expect, type Locator, type Page } from '@playwright/test';

import type { Actor } from './actores';
import { elegirOpcion } from './desplegable';
import { abrirExpedienteDelPrimero } from './expediente';
import { irA, estable } from './sesion';

/**
 * Llegar a la casilla «Laboratorio e imagenología» de la consulta de la
 * maqueta: buscar a la persona sembrada, abrir su expediente y su consulta,
 * abrir el encuentro y contestar el formulario médico, que es lo que habilita
 * «Pedir estudio». Es el recorrido de `carril-insurance-antifraud-duplicates`
 * reunido en un módulo para que otras pruebas lo usen sin copiarlo.
 */

export const MEDICA_MOCK: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'cualquiera',
  nombre: 'Médica (maqueta)',
};

/** `PACIENTES_ESCRITOS` numera desde 5000000 (`fixtures/people.ts`). */
const DOCUMENTO_PACIENTE = '5000000';

export async function abrirConsultaDelPaciente(page: Page): Promise<void> {
  await irA(page, '/medical-records');
  await estable(page);
  await page.getByTestId('clinical-record-national-id').fill(DOCUMENTO_PACIENTE);
  await page.getByTestId('clinical-record-search-by-document').click();
  await estable(page);
  await abrirExpedienteDelPrimero(page);
  await page.waitForURL(/\/medical-records\/[^/]+$/, { timeout: 60_000 });
  await irA(page, `${new URL(page.url()).pathname}/consultation`);
  await expect(page.getByTestId('consulta-rejilla')).toBeVisible({ timeout: 30_000 });
  const abrir = page.getByTestId('consulta-abrir-encuentro');
  await expect(abrir.or(page.getByTestId('encuentros-en-curso')).first()).toBeVisible({
    timeout: 30_000,
  });
  if (await abrir.isVisible()) await abrir.click();
  await expect(page.getByTestId('encuentros-en-curso')).toBeVisible({ timeout: 30_000 });
}

async function abrirCasilla(page: Page, clave: string): Promise<Locator> {
  await page.getByTestId(`consulta-casilla-${clave}`).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  return modal;
}

async function cerrar(page: Page, modal: Locator): Promise<void> {
  await modal.getByTestId('content-dialog-close').click();
  await expect(page.getByTestId('consulta-modal')).toHaveCount(0);
}

async function contestarCampo(campo: Locator): Promise<boolean> {
  const no = campo.getByRole('radio', { name: 'No' }).or(campo.getByRole('button', { name: 'No' }));
  if ((await no.count()) > 0) {
    await no.first().click();
    return true;
  }
  const desplegable = campo.getByRole('combobox');
  if ((await desplegable.count()) > 0) {
    await desplegable.first().click();
    const lista = campo.locator('dialog.select-dialog[open]');
    await expect(lista).toBeVisible();
    await lista.getByRole('option', { disabled: false }).first().click();
    await expect(lista).toHaveCount(0);
    return true;
  }
  const texto = campo.locator('textarea, input:not([type="number"]):not([type="hidden"])');
  if ((await texto.count()) > 0 && (await texto.first().isEditable())) {
    await texto.first().fill('Sin particularidades');
    return true;
  }
  const numero = campo.locator('input[type="number"]');
  if ((await numero.count()) > 0) {
    await numero.first().fill('1');
    return true;
  }
  return false;
}

/** Deja respondido el «Formulario médico» del encuentro (sin él «Pedir estudio» no se habilita). */
export async function responderFormularioMedico(page: Page): Promise<void> {
  const modal = await abrirCasilla(page, 'formulario');
  const respondido = modal.getByTestId('formulario-respondido');
  await expect(respondido.or(modal.getByTestId('campo-especialidad')).first()).toBeVisible({
    timeout: 30_000,
  });
  if (!(await respondido.isVisible())) {
    const campos = modal.getByTestId('campo-especialidad');
    for (let i = 0; i < (await campos.count()); i += 1) await contestarCampo(campos.nth(i));
    const completar = modal.getByRole('button', { name: 'Completar formulario' });
    await expect(completar).toBeEnabled();
    await completar.click();
    await expect(respondido).toBeVisible({ timeout: 30_000 });
  }
  await cerrar(page, modal);
}

/** Abre la casilla «Orden de análisis» de la consulta. */
export async function abrirOrdenDeEstudios(page: Page): Promise<Locator> {
  const modal = await abrirCasilla(page, 'ordenes');
  await expect(modal.getByRole('heading', { name: 'Laboratorio e imagenología' })).toBeVisible();
  await expect(modal.getByTestId('respuesta-del-formulario')).toBeVisible({ timeout: 30_000 });
  return modal;
}

/** Elige el tipo de orden («Laboratorio», «Imagenología» u «Otro estudio»): lo primero que pregunta el formulario. */
export async function elegirTipoDeOrden(
  modal: Locator,
  tipo: 'Laboratorio' | 'Imagenología' | 'Otro estudio',
): Promise<void> {
  await elegirOpcion(modal.getByRole('combobox', { name: /^Tipo de orden\b/ }), tipo);
}

/** Elige el estudio por su nombre en el selector «Estudio» (el de «Otro estudio», que ofrece todo el catálogo). */
export async function elegirEstudio(modal: Locator, estudio: string): Promise<void> {
  await elegirTipoDeOrden(modal, 'Otro estudio');
  await elegirOpcion(modal.getByRole('combobox', { name: /^Estudio\b/ }), estudio);
  await expect(modal.getByText(/^\s*Tipo: /)).toBeVisible();
}

export { cerrar as cerrarCasilla };
