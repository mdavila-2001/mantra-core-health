import { expect, test } from '@playwright/test';

import { administrador } from './support/actores';
import { entrar, esperarAplicacionLista, irA } from './support/sesion';
import { vigilar } from './support/salud-de-rutas';

/**
 * Baseline de la pantalla de carga masiva — humo corto, no el contrato.
 *
 * Ejercita lo mínimo que ya funciona hoy contra el backend simulado: entrar,
 * elegir sistema y versión, subir un NDJSON de 3 líneas (formato con el que
 * nació el importador — la pantalla lo sigue aceptando junto a CSV/XLSX) y
 * ver el bloque de resultado. `carga-masiva.spec.ts` es la suite larga
 * contra el contrato de §3/§7 de `CONTRATO-CARGA-MASIVA.md`; este archivo
 * es la evidencia de que "algo automatizable ya existía" antes de escribirla.
 *
 * Regla del repo (`CLAUDE.md` §5): nunca `networkidle` con `ng serve`, porque
 * el HMR no lo deja llegar y da verdes falsos.
 */

const RUTA = '/administration/terminology/import';

const NDJSON_TRES_LINEAS = [
  '{"code":"ZZ-B01","display":"Baseline uno"}',
  '{"code":"ZZ-B02","display":"Baseline dos","definition":"con definición"}',
  '{"code":"ZZ-B03","display":"Baseline tres"}',
].join('\n');

test.describe('Carga masiva · baseline (pantalla de hoy, backend simulado)', () => {
  test('login, ruta, sistema y versión, subir NDJSON, ver el resultado', async ({ page }, testInfo) => {
    const vigilante = vigilar(page);

    await entrar(page, administrador());
    await irA(page, RUTA);
    await esperarAplicacionLista(page);

    await expect(page.getByTestId('carga-perfil')).toBeVisible();

    // Perfil «Conceptos» es la única opción hoy (§1 del contrato: el segundo
    // perfil, «designaciones», está pendiente de Q-9).
    await page
      .getByTestId('carga-perfil')
      .locator('select')
      .selectOption({ label: 'Conceptos' });

    // El sistema y la versión los pone el simulador: hay uno solo que acepta
    // conceptos (`terminology.handlers.ts`, `acceptsConcepts: true`), así que
    // la primera opción real (índice 1, después del marcador vacío) es la
    // correcta sin necesitar su nombre.
    await page.getByTestId('carga-sistema').locator('select').selectOption({ index: 1 });
    await page.getByTestId('carga-version').locator('select').selectOption({ index: 1 });

    const rutaTemporal = testInfo.outputPath('baseline-tres-lineas.ndjson');
    await import('node:fs').then(({ writeFileSync }) => writeFileSync(rutaTemporal, NDJSON_TRES_LINEAS, 'utf8'));

    await page
      .getByTestId('carga-archivo')
      .locator('input[type=file]')
      .setInputFiles(rutaTemporal);

    await page.getByRole('button', { name: 'Validar sin guardar' }).click();

    await expect(page.getByTestId('carga-informe')).toBeVisible({ timeout: 15_000 });
    // El doble del simulador no lee el contenido real del NDJSON: cualquier
    // archivo sin un nombre especial (con-errores/vacio/error-red/grande) se
    // informa como 50 filas leídas (`terminology.handlers.ts:137`,
    // `FILAS_DEL_ARCHIVO_DE_PRUEBA`). Esto es del doble, no de la pantalla:
    // verificar que el informe apareció con formato NDJSON basta como humo.
    await expect(page.getByTestId('carga-informe')).toContainText('50');
    await expect(page.getByTestId('carga-informe')).toContainText('NDJSON');

    const { erroresDeConsola, peticionesFallidas } = vigilante;
    // El dev server inyecta sus propios scripts en línea (recarga en vivo y
    // el anti-parpadeo del tema) y la CSP de la aplicación los bloquea
    // (`src/server/security-headers.ts:222-223`; ya documentado por Justin en
    // `docs/trabajo/2026-09-25-justin-pantalla/REPORTE.md:130`). Es del
    // servidor de desarrollo, no de esta pantalla — clase ENVIRONMENT.
    const consolaInesperada = erroresDeConsola.filter(
      (e) => !/Content Security Policy/.test(e),
    );
    expect(consolaInesperada, `errores de consola: ${erroresDeConsola.join(' | ')}`).toEqual([]);
    expect(
      peticionesFallidas.filter((p) => /^5\d\d/.test(p)),
      `respuestas >=500: ${peticionesFallidas.join(' | ')}`,
    ).toEqual([]);
  });
});
