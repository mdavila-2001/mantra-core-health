import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { elegirOpcion } from './support/registro-paciente';

/**
 * Field data kinds (`@shared/forms/field-kinds`) in the browser: what a field
 * does not accept is never painted, and what a filter cannot catch (an email
 * with no domain) is reported next to the field.
 *
 * Browser-level because the claim is about the DOM input: a validator unit
 * test says nothing about a rejected character staying on screen. Covers the
 * patient and the laboratory registrations; the others mount the same parts.
 * Runs against the in-memory mock (`yarn start:demo`): nothing is submitted.
 */

const EVIDENCIA = join(__dirname, '..', 'artifacts', 'tipos-de-dato-en-casillas');
const TITULO = '.paginated-form__titulo';

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(EVIDENCIA, { recursive: true });
  await page.screenshot({ path: join(EVIDENCIA, `${nombre}.png`), animations: 'disabled', fullPage: true });
}

async function enLaPagina(page: Page, titulo: string): Promise<void> {
  await expect(page.locator(TITULO)).toContainText(titulo, { timeout: 20_000 });
}

async function continuar(page: Page): Promise<void> {
  const boton = page.getByTestId('paginated-form-continuar');
  await expect(boton).toBeEnabled({ timeout: 20_000 });
  await boton.click();
}

/** Skips optional pages until `titulo` (see `altas-sin-cobertura.spec.ts`). */
async function continuarHasta(page: Page, titulo: string): Promise<void> {
  for (let intento = 0; intento < 6; intento++) {
    const actual = (await page.locator(TITULO).textContent())?.trim() ?? '';
    if (actual.includes(titulo)) return;
    await continuar(page);
    await expect(page.locator(TITULO)).not.toHaveText(actual, { timeout: 20_000 });
  }
  await enLaPagina(page, titulo);
}

/** Types like a person, key by key, and returns what stayed in the `<input>`. */
async function teclear(page: Page, testId: string, texto: string): Promise<string> {
  const campo = page.getByTestId(testId);
  await campo.click();
  await campo.pressSequentially(texto, { delay: 10 });
  return campo.inputValue();
}

test.describe('tipos de dato en las casillas de las altas', () => {
  test('paciente: nombres, apellidos y documento sólo admiten lo suyo', async ({ page }) => {
    await page.goto('/auth/register/patient', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('registro-form-paciente')).toBeVisible({ timeout: 30_000 });

    expect(await teclear(page, 'registro-nombre', 'María2 José*')).toBe('María José');
    // A compound surname keeps its space.
    expect(await teclear(page, 'registro-apellido-paterno', 'De la Quintana9')).toBe('De la Quintana');
    expect(await teclear(page, 'registro-apellido-materno', "D'Angelo-Rojas!")).toBe("D'Angelo-Rojas");
    expect(await teclear(page, 'registro-documento', '541984844*///*/*/ ñ')).toBe('541984844');

    await capturar(page, 'paciente-identidad-filtrada');
  });

  test('laboratorio: el NIT, y el representante legal (nombre, documento y correo)', async ({ page }) => {
    await page.goto('/auth/register/laboratory', { waitUntil: 'domcontentloaded' });
    await enLaPagina(page, 'La empresa');

    await page.getByTestId('registro-lab-razon-social').fill('Laboratorio Andino S.R.L.');
    await elegirOpcion(page, 'registro-lab-tipo-sociedad', { label: 'S.R.L.' });
    expect(await teclear(page, 'registro-lab-nit', '1023456789abc .*')).toBe('1023456789');
    await capturar(page, 'laboratorio-nit-filtrado');
    await continuar(page);

    await continuarHasta(page, 'Dónde está la central');
    const mapa = page.getByTestId('registro-lab-central-map');
    await expect(mapa.locator('.leaflet-container')).toBeVisible({ timeout: 15_000 });
    await mapa.locator('.leaflet-container').click();
    await page.getByTestId('registro-lab-central-location-confirm').click();
    await expect(page.getByTestId('registro-lab-central-location-confirmed')).toBeAttached({ timeout: 15_000 });
    await continuarHasta(page, 'Representante legal');

    expect(await teclear(page, 'registro-lab-representante-nombre', 'holaLTAD123')).toBe('holaLTAD');
    expect(await teclear(page, 'registro-lab-representante-apellido-paterno', 'fsdh*fdh-xfghgf')).toBe(
      'fsdhfdh-xfghgf',
    );
    expect(await teclear(page, 'registro-lab-representante-documento', '541984844*///*/*/ SC')).toBe(
      '541984844 SC',
    );
    expect(
      await teclear(page, 'registro-lab-representante-correo', 'ojpiojk mkl562651561--..(1)+.+@lab'),
    ).toBe('ojpiojkmkl562651561-1@lab');

    // What the filter cannot catch (no domain) shows on blur, with the screen's message.
    await page.getByTestId('registro-lab-representante-documento').click();
    await expect(page.getByText('Escriba un correo válido: es el usuario de la cuenta.')).toBeVisible();

    await capturar(page, 'laboratorio-representante-filtrado');
  });
});
