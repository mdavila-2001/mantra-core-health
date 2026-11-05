import { expect, test } from '@playwright/test';

import { entrar, irA } from './support/sesion';

/**
 * Empty chat inbox (S3): only the icon and «No tiene chats disponibles».
 * Client request (11/05/2026): no description and no search buttons.
 *
 * Runs against the mockup (`yarn start:demo`), where `medico.nuevo@alovida.mock`
 * has no conversations.
 */
test('la bandeja vacía muestra sólo el ícono y «No tiene chats disponibles»', async ({ page }) => {
  await entrar(page, { rol: 'doctora', identificador: 'medico.nuevo@alovida.mock', clave: 'mockup', nombre: 'Médico nuevo' });
  await irA(page, '/messaging');

  const vacia = page.getByTestId('bandeja-vacia');
  await expect(vacia).toBeVisible({ timeout: 30_000 });
  await expect(vacia).toContainText('No tiene chats disponibles');
  await expect(vacia).not.toContainText('Todavía no tiene chats');
  await expect(vacia.locator('a, button')).toHaveCount(0);
  await expect(vacia.locator('svg').first()).toBeVisible();
});
