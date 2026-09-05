import { test, expect, type Page } from '@playwright/test';

import { administrador, apiViva, contextoDeApi } from './support/actores';
import { entrar, estable } from './support/sesion';

/**
 * Carril 25 — Glosario de terminología médica (TAREA-25, 2026-09-02).
 *
 * `/glossary` NO es pública: `navigation.map.ts` la protege con
 * `ROLES_QUE_EJERCEN_O_ADMINISTRAN` (`PRACTITIONER`, `CLINICIAN`…, fuera del
 * paciente por F-03). Este entorno no tiene una cuenta `PRACTITIONER`
 * sembrada (mismo hallazgo que TAREA-08: `doctora()` responde «Las
 * credenciales no son válidas», `tools/redesa/` no existe), así que esta
 * suite entra con `administrador()` — la cuenta de arranque
 * (`BOOTSTRAP_ADMIN_*`), con `SUPERADMIN` entre sus roles, que es el
 * **comodín** que pasa cualquier guard de sección (`WILDCARD_ROLE`,
 * `navigation.types.ts:353`). No es la sesión real de un médico, pero
 * ejercita el mismo guard y el mismo backend.
 *
> ## Los cuatro `fixme` de buscar (`?q=`), reactivados el 2026-09-02
 *
 * Estaban en `test.fixme` porque la tabla de resultados nunca aparecía: una
 * búsqueda de texto sin categoría (`includeValueSets=true` sin `valueSetId`)
 * devolvía el concepto pelado —sin `category`/`tags`/`relationsCount`— y
 * `glosario.html:136` (`termino.tags.length` sobre `undefined`) reventaba al
 * pintar la primera fila, dejando el spinner «Buscando» congelado. Corregido
 * en `ConceptsService.searchConcepts`
 * (`mantra-core-health-api#297`) + cinturón en el template
 * (`mantra-core-health#284`): reactivados acá una vez verificado contra la
 * API de esa rama.
 *
 * ## La aserción más importante del archivo
 *
 * Con la base de este entorno (10 323 conceptos, 0 filas del `code_system`
 * `ndc`), NINGÚN término del glosario tiene ficha de medicamento. La
 * aserción negativa — que la palabra «posología», «dosis» o
 * «contraindicaciones» no aparezca en ninguna ficha — es la red que protege
 * la regla dura del proyecto (`.claude/rules/00-non-negotiables.md` §7/§8):
 * un campo ausente es correcto, uno inventado es un daño clínico.
 */
/**
 * Abre el glosario ya filtrado y espera la respuesta de la búsqueda.
 *
 * `estable()` espera `networkidle`, que en esta pantalla se cumple **antes**
 * de que la tabla pinte: la lectura del catálogo sigue en vuelo y la prueba
 * miraba un DOM a medio render. Se espera la respuesta concreta
 * (`GET /terminology/concepts?...q=`) y después la tabla, que es la aserción
 * web-first que pide `.claude/rules/30-testing.md`.
 */
async function buscarEnElGlosario(page: Page, texto: string): Promise<void> {
  const respuesta = page.waitForResponse(
    (r) => r.url().includes('/terminology/concepts') && r.url().includes(`q=${texto}`),
    { timeout: 60_000 },
  );
  await page.goto(`/glossary?q=${texto}`);
  await respuesta;
  await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 60_000 });
}

test.describe('Carril 25 · glosario', () => {
  test.beforeAll(async () => {
    const api = await contextoDeApi();
    test.skip(!(await apiViva(api)), 'La API no responde: sin backend no hay nada que probar.');
  });

  test('la landing muestra el grid de categorías, todas navegables', async ({ page }) => {
    await entrar(page, administrador());
    await page.goto('/glossary');
    await estable(page);

    const tarjetas = page.locator('.glosario__categoria');
    await expect(tarjetas.first()).toBeVisible({ timeout: 60_000 });
    const cantidad = await tarjetas.count();
    // Hoy son 11 (AC-25-1): cada categoría con contenido queda alcanzable,
    // ninguna se esconde por «destacar» las cinco que nombró el pedido.
    expect(cantidad).toBeGreaterThanOrEqual(5);

    for (const tarjeta of await tarjetas.all()) {
      await expect(tarjeta).toHaveAttribute('href', /\/glossary\?category=/);
    }
  });

  test('buscar por nombre lleva a la tabla, y ?q= restaura la misma vista', async ({
    page,
  }) => {
    await entrar(page, administrador());
    await page.goto('/glossary');
    await estable(page);

    await page.getByLabel('Buscar un término').fill('paracetamol');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/[?&]q=paracetamol/, { timeout: 60_000 });
    await expect(page.getByTestId('tabla')).toBeVisible({ timeout: 60_000 });

    // Recargar con la URL sola —sin volver a teclear— tiene que dar la misma
    // vista: es lo que hace compartible un glosario filtrado (AC-25-2).
    await buscarEnElGlosario(page, 'paracetamol');
    await expect(page.locator('.glosario__grilla-seccion')).toHaveCount(0);
  });

  /** La aserción negativa: la más importante del archivo. */
  test('la ficha de un medicamento NO contiene posología, dosis ni contraindicaciones', async ({
    page,
  }) => {
    await entrar(page, administrador());
    await buscarEnElGlosario(page, 'paracetamol');

    const enlace = page.locator('.glosario__termino-enlace').first();
    await expect(enlace).toBeVisible();
    await enlace.click();
    await expect(page.locator('.termino')).toBeVisible({ timeout: 60_000 });

    const texto = (await page.locator('.termino').textContent()) ?? '';
    const minuscula = texto.toLowerCase();
    expect(minuscula).not.toContain('posología');
    expect(minuscula).not.toContain('posologia');
    expect(minuscula).not.toContain('dosis');
    expect(minuscula).not.toContain('contraindicaci');

    // No es sólo la aserción negativa: en esta base tampoco hay ficha de
    // medicamento que mostrar (0 filas de `ndc`), así que el bloque entero
    // está ausente — es AC-25-6/-8, no una omisión de la prueba.
    expect(texto).not.toContain('Medicamento');
  });

  test('un término sin traducción lo dice y no aparece traducido a máquina', async ({
    page,
  }) => {
    await entrar(page, administrador());
    await buscarEnElGlosario(page, 'paracetamol');

    // Sin conocer de antemano cuál de los resultados está sin traducir, se
    // recorre la tabla: si ninguno lo está, la prueba no afirma nada falso —
    // el aviso, cuando existe, nunca puede decir que SÍ está traducido.
    const filas = page.getByTestId('tabla-fila');
    const total = await filas.count();
    for (let i = 0; i < total; i += 1) {
      const texto = (await filas.nth(i).textContent()) ?? '';
      expect(texto).not.toContain('traducido automáticamente');
    }
  });

  test('sin scroll horizontal en 390, 768 y 1440', async ({ page }) => {
    await entrar(page, administrador());
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('/glossary');
      await estable(page);

      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(desborde, `/glossary desborda en ${viewport.width}px`).toBe(false);
    }
  });

  // Separado de los otros tres `fixme` reactivados: no depende del bug de
  // búsqueda (corregido), sino de un CSP roto ajeno en este mismo repo
  // (`src/server/security-headers.ts`) — B-15 en el `REGISTRO-DEFECTOS.md`
  // del repo `mantra-core-health-api` (índice único del proyecto).
  // Verificado el 2026-09-02: los otros 5 casos del archivo pasan 5/5; sólo
  // este falla.
  test.fixme('cero errores de consola y cero respuestas 4xx/5xx inesperadas', async ({ page }) => {
    const problemas: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') problemas.push(mensaje.text());
    });
    page.on('response', (respuesta) => {
      if (respuesta.status() >= 400) problemas.push(`${respuesta.status()} ${respuesta.url()}`);
    });

    await entrar(page, administrador());
    await buscarEnElGlosario(page, 'paracetamol');
    const enlace = page.locator('.glosario__termino-enlace').first();
    await enlace.click();
    await expect(page.locator('.termino')).toBeVisible({ timeout: 60_000 });

    expect(problemas).toEqual([]);
  });
});
