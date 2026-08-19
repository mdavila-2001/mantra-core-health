import { expect, test, type Page } from '@playwright/test';

import {
  p3InteraccionPersistida,
  p3PublicarYVerEnMuro,
} from '../src/testing/acceptance/core/journeys/p3.social.journey';
import { ACTORES } from '../src/testing/acceptance/core/contracts/actor.keys';
import { UI } from '../src/testing/acceptance/core/contracts/ui.contract';
import { journeyTest, runId } from './support/carril';
import { abrirComo } from './support/actores-carril';
import { esperarAplicacionLista, irA } from './support/sesion';

/**
 * Adaptador Playwright de los journeys del carril **P3**.
 *
 * El catálogo (`src/testing/acceptance/core/journeys/p3.social.journey.ts`) dice qué
 * pasa y qué tiene que ser cierto. Este archivo dice **cómo** se hace con esta
 * interfaz — qué se escribe, dónde se hace clic, cómo se espera— y nada más.
 *
 * ## Cómo se espera acá
 *
 * Nunca con esperas fijas. El muro del seguidor se llena por el fan-out del
 * worker, que tarda lo que tarda; se recarga y se vuelve a mirar hasta un tope,
 * y si se agota el mensaje dice qué servicio no produjo el efecto. Un `sleep`
 * generoso esconde exactamente el problema que este journey busca.
 *
 * ## Contextos separados por actor
 *
 * Cada persona abre su propio contexto de navegador. Compartir uno haría que la
 * sesión de la segunda pisara la de la primera, y el journey pasaría por un
 * motivo que no tiene nada que ver con lo que prueba.
 */

/**
 * Publica desde el muro y devuelve el texto exacto que quedó publicado.
 *
 * Espera la respuesta real del `POST`: es la única señal honesta de que el
 * servidor aceptó, y además da el id para localizar la tarjeta sin depender del
 * orden de la lista.
 */
async function publicar(
  page: Page,
  texto: string,
  visibilidad: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE',
): Promise<string> {
  await irA(page, '/app/comunidad');
  await esperarAplicacionLista(page);

  await page.getByTestId(UI.postComposerBody).fill(texto);
  await page
    .getByTestId(UI.postComposerVisibility)
    .selectOption(visibilidad);

  const respuesta = page.waitForResponse(
    (r) => r.url().includes('/posts') && r.request().method() === 'POST',
  );
  await page.getByTestId(UI.postComposerSubmit).click();
  const creado = await respuesta;
  expect(creado.ok()).toBe(true);

  const cuerpo = (await creado.json()) as { id: string };
  return cuerpo.id;
}

/**
 * Espera a que una publicación aparezca en el muro, recargando.
 *
 * El fan-out es asíncrono: la publicación existe antes de estar repartida. Se
 * consulta con tope y, si no llega, el error nombra al worker — que es el
 * culpable más probable y el que nadie mira primero.
 */
async function esperarEnMuro(page: Page, postId: string, tope = 30_000): Promise<void> {
  const limite = Date.now() + tope;
  for (;;) {
    await irA(page, '/app/comunidad');
    await esperarAplicacionLista(page);
    if (await page.getByTestId(UI.postCard(postId)).isVisible().catch(() => false)) {
      return;
    }
    if (Date.now() > limite) {
      throw new Error(
        `La publicación ${postId} no llegó al muro en ${tope} ms. ` +
          'Comprobar que `worker-community` esté corriendo: el reparto del feed ' +
          'lo hace él, y sin worker esto no es un fallo de la interfaz.',
      );
    }
    await page.waitForTimeout(1_000);
  }
}

test.describe('P3 · muro social', () => {
  journeyTest(p3PublicarYVerEnMuro, async ({ browser }) => {
    const marca = runId();
    const texto = `Hallazgo de guardia ${marca}`;

    const doctora = await abrirComo(browser, ACTORES.doctorOne);
    const postId = await publicar(doctora.page, texto, 'FOLLOWERS');

    // El autor la ve aunque sea FOLLOWERS: nadie se sigue a sí mismo, así que
    // esto sólo pasa si el servidor resuelve bien la identidad del lector.
    await expect(doctora.page.getByTestId(UI.postCard(postId))).toBeVisible();

    const seguidor = await abrirComo(browser, ACTORES.patientOne);
    await esperarEnMuro(seguidor.page, postId);
    await expect(seguidor.page.getByText(texto)).toBeVisible();

    await seguidor.page.reload();
    await esperarAplicacionLista(seguidor.page);
    await expect(seguidor.page.getByTestId(UI.postCard(postId))).toBeVisible();

    // El negativo va en el mismo journey: si esto apareciera, la regla de
    // visibilidad no existe aunque el journey feliz siga en verde.
    const ajeno = await abrirComo(browser, ACTORES.patientTwo);
    await irA(ajeno.page, '/app/comunidad');
    await esperarAplicacionLista(ajeno.page);
    await expect(ajeno.page.getByTestId(UI.postCard(postId))).toHaveCount(0);

    await Promise.all([
      doctora.contexto.close(),
      seguidor.contexto.close(),
      ajeno.contexto.close(),
    ]);
  });

  journeyTest(p3InteraccionPersistida, async ({ browser }) => {
    const marca = runId();
    const texto = `Consulta abierta ${marca}`;
    const comentario = `Coincido, ${marca}`;

    const doctora = await abrirComo(browser, ACTORES.doctorOne);
    const postId = await publicar(doctora.page, texto, 'PUBLIC');

    const paciente = await abrirComo(browser, ACTORES.patientOne);
    await esperarEnMuro(paciente.page, postId);

    const tarjeta = paciente.page.getByTestId(UI.postCard(postId));

    const reaccion = paciente.page.waitForResponse(
      (r) => r.url().includes('/community/reactions') && r.ok(),
    );
    await tarjeta.getByRole('button', { name: 'Me sirve' }).click();
    await reaccion;

    await tarjeta.getByTestId(UI.postCommentsToggle).click();
    await tarjeta.getByTestId(UI.postCommentBody).fill(comentario);
    const enviado = paciente.page.waitForResponse(
      (r) => r.url().includes('/community/comments') && r.ok(),
    );
    await tarjeta.getByTestId(UI.postCommentSubmit).click();
    await enviado;

    // Recargar es lo que separa «se pintó» de «se guardó». Antes de este carril
    // el contador volvía a cero acá, con la reacción guardada en la base.
    await paciente.page.reload();
    await esperarAplicacionLista(paciente.page);

    const trasRecargar = paciente.page.getByTestId(UI.postCard(postId));
    await expect(
      trasRecargar.getByRole('button', { name: 'Me sirve' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(trasRecargar.getByTestId(UI.postReactionCount)).toContainText('1');

    await trasRecargar.getByTestId(UI.postCommentsToggle).click();
    await expect(trasRecargar.getByText(comentario)).toBeVisible();

    // La notificación social del catálogo es CONDICIONAL: el contrato real no la
    // emite en este flujo todavía, así que no se afirma. Afirmar algo que nadie
    // prometió deja el journey rojo por una función que no existe.

    await Promise.all([doctora.contexto.close(), paciente.contexto.close()]);
  });
});
