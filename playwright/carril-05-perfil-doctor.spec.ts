import { test, expect, type Locator, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, doctora } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 05 — el perfil del doctor, con la sesión y los datos de verdad.
 *
 * ## Qué comprueba que las unitarias no pueden
 *
 * `practitioner-profile-view.spec.ts` ya fija la estructura contra un perfil
 * fijo. Lo que ninguna prueba con dobles puede decir es si, **con la sesión de
 * verdad**, cada pestaña llega a dibujar su contenido en vez de un error. Es lo
 * que estaba roto cuando nació el carril: `practitioner_affiliations` no
 * existía y la trayectoria respondía 500 sin que ninguna prueba lo notara.
 *
 * ## Qué cambió desde que se escribió (y por qué esta prueba se reescribió)
 *
 * - **10/09/2026, `765084431` (carril 37):** la ficha propia del médico pasó a
 *   ser la MISMA tarjeta del paciente: cabecera «Sus datos» y una sola tira de
 *   pestañas (`DOCTOR_PROFILE_TABS` en `doctor-profile-tabs.ts`). La portada
 *   `.profesional__portada` sólo queda en la ficha AJENA (el directorio).
 * - **10/09/2026, `0e3da9fc2` (carril 40):** se sacó la configuración del
 *   perfil público de todos lados: ni «Ver cómo me ven» ni la pestaña «Vista
 *   previa del perfil público». La segunda prueba ahora fija esa ausencia.
 *
 * ## Un solo ingreso por prueba
 *
 * `POST /iam/auth/login` admite **diez por minuto y por IP**.
 */

const RUTA_PERFIL = '/my-account';

/** Copia literal de `DOCTOR_PROFILE_TABS`: si el orden cambia, esto debe fallar. */
const PESTANAS_DEL_MEDICO = [
  'Datos personales',
  'Contacto',
  'Facturación',
  'Dónde atiendo',
  'Trayectoria',
  'Credenciales',
  'Actividad',
];

function fichaPropia(page: Page): Locator {
  return page.locator('app-practitioner-profile-view').first();
}

async function abrirPestana(ficha: Locator, page: Page, texto: string): Promise<void> {
  await ficha.getByTestId('mi-perfil-pestanas').getByRole('tab', { name: texto, exact: true }).click();
  await estable(page);
}

test.describe('Carril 05 · perfil del doctor', () => {
  test.beforeAll(async () => {
    const api = await contextoDeApi();
    const viva = await apiViva(api);
    await api.dispose();
    test.skip(!viva, 'La API no responde: el perfil no tiene de dónde salir.');
  });

  test('la doctora ve su ficha en una tarjeta con sus siete pestañas, y cada una carga', async ({
    page,
  }) => {
    await entrar(page, doctora());
    await irA(page, RUTA_PERFIL);
    await estable(page);

    const ficha = fichaPropia(page);
    await expect(ficha).toBeVisible();
    await expect(ficha.getByRole('heading', { name: 'Sus datos' })).toBeVisible();

    /* -- Las pestañas, en el orden del perfil del paciente ------------------ */

    const rotulos = await ficha
      .getByTestId('mi-perfil-pestanas')
      .getByRole('tab')
      .evaluateAll((nodos) => nodos.map((n) => (n.textContent ?? '').trim()));
    expect(rotulos).toEqual(PESTANAS_DEL_MEDICO);

    /* -- Datos personales: el código prueba que se leyó un perfil real ------ */

    const codigo = ficha
      .locator('.mi-perfil__dato')
      .filter({ has: page.getByText('Código profesional', { exact: true }) })
      .locator('dd');
    await expect(codigo).toHaveText(/^PRC-/);

    /* -- Trayectoria, Credenciales y Actividad dibujan su contenido -------- */

    await abrirPestana(ficha, page, 'Trayectoria');
    await expect(ficha.locator('app-work-history, .profesional__fase').first()).toBeVisible();

    await abrirPestana(ficha, page, 'Credenciales');
    await expect(ficha.locator('app-credentials-panel')).toBeVisible();

    await abrirPestana(ficha, page, 'Actividad');
    await expect(ficha.locator('app-practitioner-activity')).toBeVisible();

    // Ninguna lectura falló a la vista: ni el aviso de lecturas incompletas ni
    // un `role="alert"` dentro de la ficha.
    await expect(page.getByTestId('perfil-lecturas-incompletas')).toHaveCount(0);
    await expect(ficha.getByRole('alert')).toHaveCount(0);
  });

  test('sin perfil público que configurar (carril 40) y «Editar perfil» abre el editor', async ({
    page,
  }) => {
    await entrar(page, doctora());
    await irA(page, RUTA_PERFIL);
    await estable(page);

    const ficha = fichaPropia(page);
    await expect(ficha).toBeVisible();
    await expect(page.getByRole('link', { name: /Ver cómo me ven/i })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Vista previa/i })).toHaveCount(0);

    await ficha.getByTestId('mi-perfil-editar').click();
    await page.waitForURL(/\/my-account\/edit/);
    await estable(page);
    await expect(page.locator('app-practitioner-profile-edit')).toBeVisible();
  });
});
