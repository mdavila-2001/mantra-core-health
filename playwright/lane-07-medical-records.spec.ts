import { test, expect } from '@playwright/test';

import { apiViva, contextoDeApi, doctora } from './support/actores';
import { entrar, estable } from './support/sesion';

/**
 * Carril 07 — Archivo clínico del doctor (TAREA-07, decisión del 2026-09-02).
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
 *    pantalla escondía la tabla tras un aviso. Ahora busca de verdad, acotada
 *    a la organización de quien pregunta — es la regresión más importante del
 *    carril, y la única que sólo se puede observar con una sesión real.
 * 2. **«Abrir expediente» y «Abrir por identificador» ya no están** (AC-07-5).
 * 3. **El buscador por documento existe y no rompe la pantalla** ante un
 *    documento que no encuentra a nadie.
 *
 * La coincidencia real de AC-07-1 (un CI exacto encuentra a la persona
 * correcta) se verificó por otro camino en este mismo carril: contra
 * `GET /profiles/patients?nationalId=…` con curl y contra la sentencia SQL
 * exacta del repositorio, con datos reales de `mantra_redesa_health` — no
 * hay, en este entorno, un documento conocido de antemano que la doctora
 * sembrada tenga en su organización para repetir esa coincidencia por UI.
 */
test.describe('Carril 07 · archivo clínico', () => {
  test.beforeAll(async () => {
    const api = await contextoDeApi();
    test.skip(!(await apiViva(api)), 'La API no responde: sin backend no hay nada que probar.');
  });

  test('la doctora busca sin que la pantalla se le cierre, y sin los caminos retirados', async ({
    page,
  }) => {
    await entrar(page, doctora());
    await page.goto('/medical-records');
    await estable(page);

    // Regresión central de P-07-2: antes esto era `app-alert` con «Entrás por
    // el identificador, no por el padrón» y la tabla ni se montaba.
    await expect(page.getByTestId('tabla')).toBeVisible();
    await expect(page.getByText('No tenés acceso a esta sección')).toHaveCount(0);

    // AC-07-5: el camino retirado no deja rastro en la pantalla.
    await expect(page.getByText('Abrir expediente')).toHaveCount(0);
    await expect(page.getByText('Abrir por identificador')).toHaveCount(0);

    // El buscador por nombre sigue ahí, y el de documento es nuevo.
    await expect(page.getByLabel('Buscar por nombre o código')).toBeVisible();
    await expect(page.getByTestId('clinical-record-national-id')).toBeVisible();
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
    await expect(page.getByText('Ningún paciente tiene el documento')).toBeVisible();
    expect(errores).toEqual([]);
  });
});
