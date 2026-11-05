import type { Page } from '@playwright/test';

import { irA } from './sesion';

/**
 * Entra al expediente de la primera persona de «Archivo clínico».
 *
 * La fila ya no tiene botón de expediente —sólo «Solicitar vinculación»—: el
 * expediente se abre desde la agenda o la consulta, no desde el buscador. Estos
 * recorridos sólo necesitan **llegar** a la ficha de una persona que ya tienen
 * encontrada, así que toman su perfil del enlace de la fila (`…/:id/request-access`)
 * y navegan dentro de la aplicación, sin recargar la sesión.
 */
export async function abrirExpedienteDelPrimero(page: Page): Promise<void> {
  const href = await page
    .getByTestId('paciente-solicitar-vinculacion')
    .first()
    .getAttribute('href', { timeout: 60_000 });
  if (href === null || !href.endsWith('/request-access')) {
    throw new Error(`El enlace de la fila no es el de solicitud de vínculo: ${String(href)}`);
  }
  await irA(page, href.slice(0, -'/request-access'.length));
}
