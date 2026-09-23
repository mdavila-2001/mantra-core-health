import { expect, test } from '@playwright/test';

/**
 * Una pestaña que viene de un despliegue anterior ve los datos nuevos.
 *
 * ## Por qué existe
 *
 * Es la prueba del defecto que hizo perder una tarde entera. La maqueta guarda
 * sus tablas en `sessionStorage` y lo guardado gana sobre el fixture; cuando el
 * fixture cambiaba, quien tenía la pestaña abierta seguía viendo lo viejo en
 * cada recarga, **sin error ni aviso**, y desde el navegador era idéntico a un
 * despliegue que no había llegado.
 *
 * Ninguna prueba lo veía, y no por descuido: cada prueba abre una pestaña
 * limpia, que es justo el caso que funcionaba. Ésta hace lo contrario —ensucia
 * el almacenamiento a propósito, como lo tendría una persona real— y por eso
 * es la única que puede fallar si el sello del build se rompe.
 *
 * Uso: `yarn pw --workers=1 pestana-vieja-ve-lo-nuevo`
 */

/** Lo que dejaría en la pestaña el despliegue anterior: las vitrinas de antes. */
const VITRINAS_DE_ANTES = [
  {
    id: 'vieja-1',
    tenantId: 'tenant-viejo',
    targetId: 'target-viejo',
    kind: 'PHARMACY',
    slug: 'farmacia-inventada',
    displayName: 'Farmacia Inventada',
    headline: 'La que se veía antes',
    biography: '',
    avatarUrl: '',
    coverUrl: '',
    avatarFileId: '',
    coverFileId: '',
    verified: true,
    acceptsReviews: false,
    visibility: 'PUBLIC',
    city: 'Santa Cruz de la Sierra',
    address: '',
    lat: -17.78,
    lng: -63.18,
    specialties: [],
    ratingAverage: null,
    ratingCount: 0,
    hasPublishedAgenda: false,
    seguidores: 0,
  },
];

test('los laboratorios reales aparecen aunque la pestaña traiga datos del build anterior', async ({
  page,
}) => {
  // 1 · Entrar, que es lo que hace cualquiera.
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });

  // 2 · Ensuciar el almacenamiento como lo tendría una pestaña vieja. Se
  //     escriben las dos formas: la del sello con otro commit, y el array
  //     pelado de antes de que el sello existiera.
  await page.evaluate((vitrinas) => {
    sessionStorage.setItem(
      'mock.comunidad.vitrinas',
      JSON.stringify({ build: 'commit-de-otro-despliegue', filas: vitrinas }),
    );
    sessionStorage.setItem('mock.diagnostics.informes', JSON.stringify(vitrinas));
  }, VITRINAS_DE_ANTES);

  // 3 · Recargar. Antes del sello, acá volvían los datos viejos.
  await page.goto('/laboratory-directory?kind=LABORATORY', {
    waitUntil: 'domcontentloaded',
    timeout: 120_000,
  });

  await expect(page.getByText('SELADIS', { exact: false }).first()).toBeVisible({
    timeout: 60_000,
  });

  const texto = await page.locator('main').innerText();
  expect(texto).toContain('SELADIS');
  expect(texto).toContain('CENETROP');
  expect(texto).not.toContain('Farmacia Inventada');
});
