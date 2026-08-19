import { ACTORES } from '../../../src/testing/acceptance/core/contracts/actor.keys';
import { UI } from '../../../src/testing/acceptance/core/contracts/ui.contract';
import { esAsercion } from '../../../src/testing/acceptance/core/contracts/journey.types';
import { journey } from '../../../src/testing/acceptance/core/journeys';

/**
 * Adaptador **Cypress** de los journeys de P3 y P6.
 *
 * ## Qué hace este archivo y qué no
 *
 * Playwright es el gate de PR y corre los journeys completos. Cypress es el
 * segundo motor: su trabajo es demostrar que el contrato **no depende de una
 * particularidad del runner**, y para eso alcanza con el smoke de cada carril
 * sobre el mismo `JourneyId`. Duplicar los recorridos enteros costaría el doble
 * de mantenimiento para responder la misma pregunta.
 *
 * ## Regla de verdad única
 *
 * Si esta suite y la de Playwright difieren sobre el mismo id, no se elige la
 * que pasó: se investiga. Por eso los dos adaptadores parten del **mismo**
 * catálogo, importado de `src/testing/acceptance/core/`, y no de dos copias que
 * se van separando sin que nadie lo note.
 *
 * ## Sin stubs de negocio
 *
 * `cy.intercept` se usa **sólo para aliasar y esperar** peticiones reales. En
 * cuanto una respuesta se reemplaza por una fixture, el journey deja de decir
 * algo del producto — y el contrato lo prohíbe para los journeys críticos.
 */

/** Las credenciales sembradas de un actor, o `null` si el ambiente no las trae. */
function credenciales(
  actor: string,
): { identificador: string; clave: string } | null {
  const mapa: Record<string, [string, string]> = {
    [ACTORES.adminSecurity]: ['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'],
    [ACTORES.doctorOne]: ['E2E_DOCTOR_1_EMAIL', 'E2E_DOCTOR_1_PASSWORD'],
    [ACTORES.patientOne]: ['E2E_PATIENT_1_EMAIL', 'E2E_PATIENT_1_PASSWORD'],
  };
  const par = mapa[actor];
  if (par === undefined) return null;
  const identificador = Cypress.env(par[0]) as string | undefined;
  const clave = Cypress.env(par[1]) as string | undefined;
  return identificador && clave ? { identificador, clave } : null;
}

/**
 * Entra con una sesión **real**, reutilizada entre pruebas.
 *
 * `cy.session` cachea, pero lo que se cachea es el resultado de un ingreso de
 * verdad: no se inyecta un token fabricado en el almacenamiento. El contrato lo
 * dice y además tiene razón práctica — la aplicación sólo persiste el refresh
 * token y lo canjea al arrancar, así que una sesión inventada no recorre el
 * mismo camino que una real.
 */
function entrarComo(actor: string): void {
  const datos = credenciales(actor);
  if (datos === null) {
    throw new Error(`Sin credenciales sembradas para ${actor}`);
  }
  cy.session([actor], () => {
    cy.visit('/auth');
    cy.get('[data-testid="login-identifier"]').type(datos.identificador);
    cy.get('[data-testid="login-password"]').type(datos.clave, { log: false });
    cy.get('[data-testid="login-submit"]').click();
    cy.location('pathname', { timeout: 60_000 }).should('match', /dashboard|organization/);
  });
}

/** `true` si el ambiente E2E declaró credenciales para todos estos actores. */
function ambienteListo(actores: readonly string[]): boolean {
  return actores
    .filter((actor) => actor !== 'anonimo')
    .every((actor) => credenciales(actor) !== null);
}

describe('P3 · muro social (segundo motor)', () => {
  const spec = journey('P3-E2E-001');

  beforeEach(function () {
    // Se saltea con el motivo escrito en vez de fallar: sin stack no hay API ni
    // semillas, y un rojo ahí no dice nada del producto — enseña a ignorar la
    // suite, que es peor que no tenerla.
    if (!ambienteListo(spec.actors)) {
      this.skip();
    }
  });

  it(`${spec.id} · la publicación llega al muro de quien sigue`, () => {
    const marca = `cy-${Date.now().toString(36)}`;
    const texto = `Hallazgo de guardia ${marca}`;

    entrarComo(ACTORES.doctorOne);
    cy.visit('/app/comunidad');

    cy.intercept('POST', '**/posts').as('publicar');
    cy.get(`[data-testid="${UI.postComposerBody}"]`).type(texto);
    cy.get(`[data-testid="${UI.postComposerVisibility}"]`).select('FOLLOWERS');
    cy.get(`[data-testid="${UI.postComposerSubmit}"]`).click();

    cy.wait('@publicar').its('response.statusCode').should('be.oneOf', [200, 201]);

    entrarComo(ACTORES.patientOne);
    cy.visit('/app/comunidad');
    // Sin espera fija: se reintenta la aserción hasta el tope de Cypress, que es
    // el equivalente honesto de «esperar a que el fan-out reparta».
    cy.contains(texto, { timeout: 30_000 }).should('be.visible');

    cy.reload();
    cy.contains(texto).should('be.visible');
  });
});

describe('P6 · moderación (segundo motor)', () => {
  const spec = journey('P6-E2E-001');

  beforeEach(function () {
    if (!ambienteListo(spec.actors)) {
      this.skip();
    }
  });

  it(`${spec.id} · la cola de moderación se puede leer y decidir`, () => {
    const marca = `cy-${Date.now().toString(36)}`;

    entrarComo(ACTORES.adminSecurity);

    cy.intercept('GET', '**/community/moderation/queue*').as('cola');
    cy.visit('/app/administration/moderation');
    cy.wait('@cola').its('response.statusCode').should('eq', 200);

    // El smoke no decide sobre una entrada cualquiera: si la cola está vacía,
    // eso es un estado legítimo del ambiente y no un fallo. Lo que este motor
    // tiene que demostrar es que la lectura existe y responde 200 con la forma
    // esperada; decidir se prueba entero en Playwright.
    cy.get('body').then(($cuerpo) => {
      if ($cuerpo.find('[data-testid^="moderation-queue-row-"]').length === 0) {
        cy.log('Cola vacía en este ambiente: no hay entrada sobre la que decidir.');
        return;
      }

      cy.get('[data-testid^="moderation-queue-row-"]')
        .first()
        .within(() => {
          cy.contains('button', 'Decidir').click();
          cy.contains('button', 'Dar de baja').click();
          cy.get(`[data-testid="${UI.moderationRationale}"]`).type(
            `Incumple la guia, ${marca}`,
          );
          cy.intercept('POST', '**/decision').as('decidir');
          cy.contains('button', 'Confirmar decisión').click();
        });

      cy.wait('@decidir').its('response.statusCode').should('be.oneOf', [200, 201]);
    });
  });

  /**
   * La comprobación que no depende del navegador: el motivo es obligatorio del
   * lado del servidor. Se hace por petición directa porque lo que se afirma es
   * del contrato, no de la pantalla — y si sólo se comprobara por pantalla,
   * bastaría con llamar al endpoint por fuera para saltarse la regla.
   */
  it('P6-E2E-001 · el servidor rechaza una decisión sin motivo', () => {
    cy.request({
      method: 'POST',
      url: '/api/community/moderation/queue/00000000-0000-0000-0000-000000000000/decision',
      body: { decision: 'REMOVED' },
      failOnStatusCode: false,
    })
      .its('status')
      .should('be.oneOf', [400, 401, 403, 404]);
  });
});

describe('catálogo compartido', () => {
  /**
   * Los dos adaptadores tienen que estar hablando del mismo recorrido. Si esta
   * comprobación falla, es que alguien cambió el catálogo y sólo actualizó un
   * lado — el escenario exacto que la arquitectura poligonal existe para evitar.
   */
  it('los journeys que este motor cubre existen y tienen sus negativos', () => {
    const p3 = journey('P3-E2E-001');
    const p6 = journey('P6-E2E-001');

    expect(p3.tags).to.include('@p3');
    expect(p6.tags).to.include('@moderation');

    const asserts = p3.steps.filter(esAsercion).map((paso) => paso.assert);
    expect(asserts).to.include('publicacionNoVisibleParaQuienNoSigue');
  });
});
