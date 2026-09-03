import { test, expect } from '@playwright/test';

import { apiViva, contextoDeApi, doctora } from './support/actores';
import { entrar, estable } from './support/sesion';

/**
 * Carril 07 — Archivo clínico del doctor (TAREA-07, P-07-10 — 2026-09-02).
 *
 * `/medical-records` es de `CLINICIAN`/`PRACTITIONER` en el nav
 * (`navigation.map.ts:326`): la sesión de `SECURITY_ADMIN` tiene su propia
 * pantalla (`/administration/patients`, `patient-list.ts`), fuera del alcance
 * de esta ficha. Por eso esta suite entra sólo como la doctora.
 *
 * Lo que fija:
 *
 * 1. **La búsqueda ya no responde 403 al rol clínico** (P-07-2): antes
 *    `GET /profiles/patients` era exclusivo de `SECURITY_ADMIN` y esta
 *    pantalla escondía la tabla tras un aviso. Ahora busca de verdad, sobre
 *    el padrón entero sin acotar (P-07-10 revirtió el acotamiento por
 *    actividad de la misma tarde) — es la regresión más importante del
 *    carril, y la única que sólo se puede observar con una sesión real.
 * 2. **Sin criterio no se pide nada** (mismo P-07-10): al entrar sin `q` ni
 *    `nationalId` la pantalla no llama a `/profiles/patients` — muestra un
 *    vacío que invita a escribir, no la tabla. `getByTestId('tabla')` sólo
 *    aparece **después** de buscar.
 * 3. **«Abrir expediente» y «Abrir por identificador» ya no están** (AC-07-5).
 * 4. **El buscador por documento existe y no rompe la pantalla** ante un
 *    documento que no encuentra a nadie.
 *
 * Esta base tiene **0 filas** en `profiles.patient_profiles` (verificado
 * contra `mantra_redesa_health` el 02/09), así que ninguna búsqueda por texto
 * puede afirmarse `ready`: el criterio de PASS es «no hay 403 ni error», no
 * «aparecen resultados». La coincidencia real de AC-07-1 (un CI exacto
 * encuentra a la persona correcta) se verificó por otro camino en este mismo
 * carril: contra `GET /profiles/patients?nationalId=…` con curl y contra la
 * sentencia SQL exacta del repositorio.
 */
test.describe('Carril 07 · archivo clínico', () => {
  test.beforeAll(async () => {
    const api = await contextoDeApi();
    test.skip(!(await apiViva(api)), 'La API no responde: sin backend no hay nada que probar.');
  });

  test('al entrar sin criterio no pide el padrón: invita a escribir', async ({ page }) => {
    await entrar(page, doctora());
    await page.goto('/medical-records');
    await estable(page);

    // P-07-10: sin `q` ni `nationalId` en la URL, la pantalla no llama a
    // `/profiles/patients` — la tabla del M34 no se monta con datos, y el
    // vacío inicial invita a escribir en vez de listar el padrón entero.
    await expect(page.getByTestId('tabla')).toHaveCount(0);
    await expect(page.getByText('Buscá por nombre, código o documento')).toBeVisible();
    await expect(page.getByText('No tenés acceso a esta sección')).toHaveCount(0);

    // AC-07-5: el camino retirado no deja rastro en la pantalla.
    await expect(page.getByText('Abrir expediente')).toHaveCount(0);
    await expect(page.getByText('Abrir por identificador')).toHaveCount(0);

    // El buscador por nombre sigue ahí, y el de documento es nuevo.
    await expect(page.getByLabel('Buscar por nombre o código')).toBeVisible();
    await expect(page.getByTestId('clinical-record-national-id')).toBeVisible();
  });

  test('la doctora busca sin que la pantalla se le cierre (regresión de P-07-2)', async ({
    page,
  }) => {
    const errores: string[] = [];
    page.on('response', (respuesta) => {
      if (respuesta.status() >= 400 && respuesta.status() !== 404) {
        errores.push(`${respuesta.status()} ${respuesta.url()}`);
      }
    });

    await entrar(page, doctora());
    await page.goto('/medical-records?q=a');
    await estable(page);

    // Regresión central de P-07-2: antes esto era `app-alert` con «Entrás por
    // el identificador, no por el padrón» — un 403 explícito. Con 0 filas de
    // pacientes en esta base el resultado real es el vacío «Nadie coincide»
    // (S3 del M34, no `ready` ni `forbidden`) — el `view-state-host` sólo
    // monta `data-testid="tabla"` en `ready`/`stale`, así que lo que hay que
    // comprobar es la AUSENCIA del aviso de acceso y de cualquier error, no
    // la presencia de la tabla.
    await expect(page.getByText('Nadie coincide con')).toBeVisible();
    await expect(page.getByText('No tenés acceso a esta sección')).toHaveCount(0);
    expect(errores).toEqual([]);
  });

  test('buscar un documento que no existe no rompe la pantalla', async ({ page }) => {
    await entrar(page, doctora());
    await page.goto('/medical-records');
    await estable(page);

    const errores: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') errores.push(mensaje.text());
    });
    page.on('response', (respuesta) => {
      if (respuesta.status() >= 400 && respuesta.status() !== 404) {
        errores.push(`${respuesta.status()} ${respuesta.url()}`);
      }
    });

    await page.getByTestId('clinical-record-national-id').fill('CI-INEXISTENTE-000000');
    await page.getByTestId('clinical-record-search-by-document').click();
    await estable(page);

    // Ningún documento coincide: la tabla queda vacía, con el texto que lo
    // explica — no un error, y no la lista completa de pacientes.
    await expect(page.getByText('Nadie tiene el documento')).toBeVisible();
    expect(errores).toEqual([]);
  });
});
