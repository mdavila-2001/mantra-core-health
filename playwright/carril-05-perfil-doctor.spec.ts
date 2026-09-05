import { test, expect, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, doctora } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 05 — el perfil del doctor: trayectoria, credenciales y vista previa.
 *
 * ## Qué comprueba que las unitarias no pueden
 *
 * `practitioner-profile-view.spec.ts` ya fija la estructura contra un perfil
 * fijo. Lo que ninguna prueba con dobles puede decir es si, **con la sesión de
 * verdad y los datos de verdad**, el perfil trae trayectoria y la vista previa
 * muestra lo mismo que ve un paciente. Es justo lo que estaba roto: la tabla
 * `practitioner_affiliations` no existía y el historial respondía 500, sin que
 * ninguna prueba lo notara.
 *
 * ## Un solo ingreso
 *
 * `POST /iam/auth/login` admite **diez por minuto y por IP**, así que todo el
 * recorrido va en una sola prueba con una sola sesión — mismo criterio que el
 * carril 02.
 *
 * ## Requiere backend
 *
 * Sin API no hay perfil que mirar, así que la prueba se salta con un motivo
 * legible en vez de fallar con un tiempo de espera agotado que no explica nada.
 */

const RUTA_PERFIL = '/my-account';

/** Los rótulos de las pestañas superiores del perfil. */
async function pestanas(page: Page): Promise<string[]> {
  return page
    .locator('app-practitioner-profile-view')
    .first()
    .locator('> .profesional > app-card app-tabs > .tabs__list [role="tab"]')
    .evaluateAll((nodos) => nodos.map((n) => (n.textContent ?? '').trim()));
}

/** Selecciona una pestaña superior por su texto. */
async function abrirPestana(page: Page, texto: string): Promise<void> {
  await page.getByRole('tab', { name: texto, exact: false }).first().click();
  await estable(page);
}

test.describe('Carril 05 · perfil del doctor', () => {
  test.beforeAll(async () => {
    const api = await contextoDeApi();
    const viva = await apiViva(api);
    await api.dispose();
    test.skip(!viva, 'La API no responde: el perfil no tiene de dónde salir.');
  });

  test('la doctora ve su trayectoria, sus credenciales y su perfil público', async ({
    page,
  }) => {
    await entrar(page, doctora());
    await irA(page, RUTA_PERFIL);
    await estable(page);

    const perfil = page.locator('app-practitioner-profile-view').first();
    await expect(perfil).toBeVisible();

    /* -- La cabecera: identidad fuera de las pestañas --------------------- */

    const portada = perfil.locator('.profesional__portada');
    await expect(portada).toBeVisible();
    // El código profesional es el dato que prueba que se leyó un perfil real y
    // no una pantalla vacía.
    await expect(portada.locator('.profesional__codigo')).not.toBeEmpty();

    /* -- Las tres pestañas del carril ------------------------------------- */

    const rotulos = await pestanas(page);
    expect(rotulos).toContain('Trayectoria');
    expect(rotulos).toContain('Credenciales y verificaciones');
    expect(rotulos).toContain('Vista previa del perfil público');

    /* -- Trayectoria: las tres fases, con datos reales -------------------- */

    await abrirPestana(page, 'Trayectoria');
    const trayectoria = perfil.locator('.profesional__fase');
    await expect(trayectoria.filter({ hasText: 'Actividad actual' })).toBeVisible();
    await expect(trayectoria.filter({ hasText: 'Experiencia histórica' })).toBeVisible();
    await expect(trayectoria.filter({ hasText: 'Formación' })).toBeVisible();

    // La cuenta sembrada tiene una afiliación vigente y una cerrada. Que la
    // línea de tiempo tenga hitos es lo que distingue «hay trayectoria» de
    // «la pestaña se dibuja vacía», que es como estaba antes de este carril.
    await expect(perfil.locator('.profesional__hito').first()).toBeVisible();

    // El bloque de ayuda de la pestaña (corrección #6).
    await expect(perfil.locator('app-tab-help-block').first()).toBeVisible();

    /* -- Credenciales: declarado vs verificado ---------------------------- */

    await abrirPestana(page, 'Credenciales y verificaciones');
    const grupos = perfil.locator('.profesional__seguimiento-grupo');
    await expect(grupos.filter({ hasText: 'Verificado' })).toBeVisible();
    await expect(grupos.filter({ hasText: 'Declarado' })).toBeVisible();

    /* -- Vista previa: el MISMO componente, en modo ajeno ----------------- */

    await abrirPestana(page, 'Vista previa del perfil público');

    // La vista previa reinstancia el propio componente: si esto no está, se
    // volvió a dibujar una maqueta aparte y puede divergir de lo que ve el
    // paciente — que es exactamente lo que el carril prohíbe.
    const anidado = perfil.locator('app-practitioner-profile-view').first();
    await expect(anidado).toBeVisible();

    // En modo previa no hay acciones de dueño.
    await expect(anidado.locator('.profesional__acciones')).toHaveCount(0);
  });

  /**
   * ALV-004 (2026-09-05): `/my-account/preview` dejó de ser una segunda
   * pantalla de configuración. «Ver cómo me ven» navega ahí y muestra la
   * MISMA tarjeta que el directorio, de sólo lectura: sin formulario. Lo que se
   * configura de la ficha pública vive en «Configurar mi perfil».
   *
   * Esta prueba afirmaba lo contrario (que el botón NO navegaba) y ya estaba
   * desalineada con el HTML antes de este carril; se corrige a propósito.
   */
  test('«Ver cómo me ven» navega a la vista previa de sólo lectura', async ({ page }) => {
    await entrar(page, doctora());
    await irA(page, RUTA_PERFIL);
    await estable(page);

    const perfil = page.locator('app-practitioner-profile-view').first();
    await perfil.getByRole('link', { name: /Ver cómo me ven/i }).click();
    await estable(page);

    expect(page.url()).toContain('/my-account/preview');
    const previa = page.locator('app-public-profile-preview').first();
    await expect(previa).toBeVisible();
    // Sólo lectura: ni un formulario ni un input en la vista previa.
    await expect(previa.locator('form')).toHaveCount(0);
    await expect(previa.locator('input')).toHaveCount(0);
    await expect(previa.getByTestId('previa-configurar')).toHaveAttribute('href', '/my-account/edit');
  });
});
