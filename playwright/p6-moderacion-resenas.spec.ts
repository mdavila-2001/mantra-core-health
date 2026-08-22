import { expect, test, type Page } from '@playwright/test';

import {
  p6CicloDeModeracion,
  p6ResenaVerificada,
} from '../src/testing/acceptance/core/journeys/p6.moderation-reviews.journey';
import { ACTORES } from '../src/testing/acceptance/core/contracts/actor.keys';
import { UI } from '../src/testing/acceptance/core/contracts/ui.contract';
import { abrirComo } from './support/actores-carril';
import { journeyTest, runId } from './support/carril';
import { esperarAplicacionLista, irA } from './support/sesion';

/**
 * Adaptador Playwright de los journeys del carril P6.
 *
 * ## La comprobación que no se hace por pantalla
 *
 * «La respuesta pública no expone identificadores clínicos» se comprueba sobre
 * el JSON de la lectura, no sobre lo que pinta la pantalla. Es la única forma
 * honesta: un campo puede viajar en la respuesta y no dibujarse, y en ese caso
 * la interfaz se ve bien mientras la API filtra qué paciente se atendió, qué día
 * y con quién. El contrato de testing lo admite como verificación de
 * postcondición por petición directa.
 *
 * ## Nada se siembra de lo que el journey produce
 *
 * Ni la decisión, ni la apelación, ni la reseña. Lo dice el catálogo de semillas
 * y es lo que hace que estos recorridos prueben algo.
 */

/** Va a la cola de moderación y espera a que termine de cargar. */
async function abrirModeracion(page: Page): Promise<void> {
  await irA(page, '/app/administration/moderation');
  await esperarAplicacionLista(page);
}

test.describe('P6 · moderación y reseñas', () => {
  journeyTest(p6CicloDeModeracion, async ({ browser }) => {
    const marca = runId();

    // 1. Alguien reporta una publicación real.
    const denunciante = await abrirComo(browser, ACTORES.patientOne);
    await irA(denunciante.page, '/app/comunidad');
    await esperarAplicacionLista(denunciante.page);

    const primeraTarjeta = denunciante.page
      .locator('[data-testid^="post-card-"]')
      .first();
    await expect(primeraTarjeta).toBeVisible();
    const contentRefId = (
      (await primeraTarjeta.getAttribute('data-testid')) ?? ''
    ).replace('post-card-', '');

    const reportado = denunciante.page.waitForResponse(
      (r) => r.url().includes('/community/reports') && r.ok(),
    );
    await primeraTarjeta.getByRole('button', { name: 'Reportar' }).click();
    await denunciante.page
      .getByRole('textbox', { name: /detalle|motivo/i })
      .fill('Reporte de prueba ' + marca);
    await denunciante.page
      .getByRole('button', { name: /enviar|reportar/i })
      .click();
    await reportado;

    // 2. El moderador la encuentra en una cola que ahora se puede leer.
    const moderador = await abrirComo(browser, ACTORES.adminSecurity);
    await abrirModeracion(moderador.page);

    const fila = moderador.page.getByTestId(UI.moderationQueueRow(contentRefId));
    await expect(fila).toBeVisible();

    // 3. Decide, con motivo. El motivo lleva la marca para poder ubicarlo.
    const motivo = 'Incumple la guia, ' + marca;
    await fila.getByRole('button', { name: 'Decidir' }).click();
    await fila.getByRole('button', { name: 'Dar de baja' }).click();
    await fila.getByTestId(UI.moderationRationale).fill(motivo);

    const decidido = moderador.page.waitForResponse(
      (r) => r.url().includes('/decision') && r.ok(),
    );
    await fila.getByRole('button', { name: 'Confirmar decisión' }).click();
    const respuestaDecision = await decidido;
    const { id: decisionId } = (await respuestaDecision.json()) as {
      id: string;
    };

    // 4. Recargar separa «cambió en pantalla» de «cambió en la base».
    await moderador.page.reload();
    await abrirModeracion(moderador.page);
    await expect(
      moderador.page.getByTestId(UI.moderationQueueRow(contentRefId)),
    ).toHaveCount(0);

    // 5. El sancionado apela. Va por API real y no por pantalla porque el punto
    //    de entrada de la apelación es de la fase B del carril; la regla que
    //    importa acá —que sólo apela el titular— la comprueba el servidor.
    const razon = 'No corresponde, ' + marca;
    const apelacion = await denunciante.page.request.post(
      '/api/community/moderation/decisions/' + decisionId + '/appeal',
      { data: { reasonText: razon } },
    );
    expect(apelacion.ok()).toBe(true);

    // 6. El moderador la ve, con la decisión que impugna.
    await abrirModeracion(moderador.page);
    await moderador.page.getByTestId(UI.moderationAppealsTab).click();
    await expect(moderador.page.getByText(razon)).toBeVisible();
    await expect(moderador.page.getByText(motivo)).toBeVisible();

    // 7. La resuelve, y el estado persiste.
    const contenedor = moderador.page.locator('li', { hasText: razon }).first();
    await contenedor.getByRole('button', { name: 'Resolver' }).click();
    await contenedor
      .getByRole('button', { name: 'Confirmar la decisión' })
      .click();

    const resuelto = moderador.page.waitForResponse(
      (r) => r.url().includes('/resolve') && r.ok(),
    );
    await contenedor
      .getByRole('button', { name: 'Confirmar resolución' })
      .click();
    await resuelto;

    await moderador.page.reload();
    await abrirModeracion(moderador.page);
    await moderador.page.getByTestId(UI.moderationAppealsTab).click();
    await expect(moderador.page.getByText(razon)).toHaveCount(0);

    await Promise.all([denunciante.contexto.close(), moderador.contexto.close()]);
  });

  journeyTest(p6ResenaVerificada, async ({ browser }) => {
    const marca = runId();
    const comentario = 'Muy buena atención, ' + marca;

    const paciente = await abrirComo(browser, ACTORES.patientOne);

    // La atención que respalda la reseña se resuelve desde el archivo del
    // paciente: es de donde sale el `verifiedEncounterId` real. Fabricarlo por
    // API sería inventar justamente el dato que el servidor tiene que validar.
    await irA(paciente.page, '/app/my-account/medical-record');
    await esperarAplicacionLista(paciente.page);

    const publicada = paciente.page.waitForResponse(
      (r) => r.url().includes('/reviews') && r.request().method() === 'POST',
    );
    await paciente.page
      .getByRole('button', { name: /calificar/i })
      .first()
      .click();
    await paciente.page
      .getByRole('textbox', { name: /comentario/i })
      .fill(comentario);
    await paciente.page.getByRole('button', { name: /enviar|publicar/i }).click();
    const respuesta = await publicada;
    expect(respuesta.ok()).toBe(true);
    const creada = (await respuesta.json()) as {
      id: string;
      verified: boolean;
    };
    expect(creada.verified).toBe(true);

    // El público, sin sesión.
    const anonimo = await browser.newContext();
    const publico = await anonimo.newPage();
    await publico.goto('/p/doctor-uno-e2e');
    await esperarAplicacionLista(publico);
    await expect(publico.getByText(comentario)).toBeVisible();

    // La comprobación que no se puede hacer mirando: el JSON de la lectura
    // pública no puede traer el encuentro clínico ni el perfil del paciente.
    const perfilPublico = await publico.request.get(
      '/api/public/p/doctor-uno-e2e',
    );
    const crudo = await perfilPublico.text();
    expect(crudo).not.toContain('verifiedEncounterId');
    expect(crudo).not.toContain('reviewerPatientProfileId');

    // El profesional contesta.
    const doctora = await abrirComo(browser, ACTORES.doctorOne);
    await irA(doctora.page, '/app/my-account');
    await esperarAplicacionLista(doctora.page);
    const contestado = doctora.page.waitForResponse(
      (r) => r.url().includes('/responses') && r.ok(),
    );
    await doctora.page
      .getByRole('button', { name: /responder/i })
      .first()
      .click();
    await doctora.page
      .getByRole('textbox', { name: /respuesta/i })
      .fill('Gracias, ' + marca);
    await doctora.page.getByRole('button', { name: /enviar|publicar/i }).click();
    await contestado;

    await publico.reload();
    await esperarAplicacionLista(publico);
    await expect(publico.getByText('Gracias, ' + marca)).toBeVisible();

    // El negativo, contra el servidor: patient.two no se atendió con doctor.one.
    const ajeno = await abrirComo(browser, ACTORES.patientTwo);
    const sinAtencion = await ajeno.page.request.post(
      '/api/community/profiles/doctor-uno-e2e/reviews',
      { data: { overallRating: 1, verifiedEncounterId: creada.id } },
    );
    expect(sinAtencion.ok()).toBe(false);

    await Promise.all([
      paciente.contexto.close(),
      anonimo.close(),
      doctora.contexto.close(),
      ajeno.contexto.close(),
    ]);
  });
});
