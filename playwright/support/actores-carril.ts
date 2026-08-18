import type { Browser, BrowserContext, Page } from '@playwright/test';

import { credenciales } from './carril';
import { entrar } from './sesion';

/**
 * Abre un contexto de navegador propio y entra con la identidad sembrada.
 *
 * ## Por qué un contexto por persona
 *
 * Los journeys de estos dos carriles mueven a tres o cuatro personas en la misma
 * corrida. Compartir un contexto haría que la sesión de la segunda pisara la de
 * la primera, y el recorrido pasaría —o fallaría— por un motivo que no tiene
 * nada que ver con lo que prueba.
 *
 * ## El rol que se pasa a `entrar` es indiferente
 *
 * `entrar` sólo lo usa para rotular la evidencia; quien decide qué puede hacer
 * la sesión es el backend, a partir de las credenciales reales. Se pasa la clave
 * del actor como nombre para que el informe diga «patient.one» y no «paciente».
 */
export async function abrirComo(
  browser: Browser,
  actorKey: string,
): Promise<{ contexto: BrowserContext; page: Page }> {
  const datos = credenciales(actorKey);
  if (datos === null) {
    throw new Error(
      `Sin credenciales sembradas para ${actorKey}. ` +
        'El contrato de semillas exige autenticación real: no se fabrica sesión.',
    );
  }
  const contexto = await browser.newContext();
  const page = await contexto.newPage();
  await entrar(page, {
    rol: 'paciente',
    identificador: datos.identificador,
    clave: datos.clave,
    nombre: actorKey,
  });
  return { contexto, page };
}
