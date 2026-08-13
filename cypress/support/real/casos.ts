/**
 * Los trámites del caso de verificación que van **por la API viva**.
 *
 * Vive acá y no dentro de una spec por la misma razón que `tramites.ts`: lo
 * usan dos recorridos con propósitos distintos —el sello del titular (08), que
 * mira el ciclo completo; y el camino del consumidor (09), cuyo tramo N4
 * necesita decidir el caso que abrió por pantalla— y duplicarlo sería mantener
 * dos veces el mismo contrato HTTP.
 */

/**
 * Raíz de la API, absoluta y siempre: una ruta relativa en `cy.request` se
 * resuelve contra el servidor del frontend. Mismo camino que `07`.
 */
export function apiUrl(ruta: string): string {
  const raiz = Cypress.expose('E2E_API_URL') as unknown;
  const base = typeof raiz === 'string' && raiz !== '' ? raiz : 'http://localhost:3000';
  return `${base}${ruta}`;
}

/** El `conceptId` de un código del catálogo, buscado y no inventado (como en `07`). */
export function conceptoPorCodigo(token: string, codigo: string): Cypress.Chainable<string> {
  return cy
    .request({
      method: 'GET',
      url: apiUrl('/terminology/concepts'),
      qs: { q: codigo, limit: 20 },
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((respuesta) => {
      const cuerpo = respuesta.body as { items?: { conceptId: string; code: string }[] };
      const encontrado = (cuerpo.items ?? []).find((item) => item.code === codigo);
      expect(encontrado, `el catálogo tiene que traer «${codigo}»`).to.not.equal(undefined);
      return cy.wrap((encontrado as { conceptId: string }).conceptId, { log: false });
    });
}

/**
 * Escala el caso a revisión manual y lo decide. Las dos transiciones que en
 * `07` van por formulario, acá por la API: lo que se prueba es lo que el
 * titular ve después.
 */
export function escalarYDecidir(
  token: string,
  caseId: string,
  motivoConceptId: string,
  decision: 'APPROVED' | 'REJECTED',
  motivo: string,
): void {
  cy.request({
    method: 'POST',
    url: apiUrl(`/identity/verification-cases/${caseId}/manual-review`),
    body: { reviewReasonConceptId: motivoConceptId },
    headers: { Authorization: `Bearer ${token}` },
  })
    .then((abierta) => {
      const cuerpo = abierta.body as { id?: string };
      expect(cuerpo.id, 'escalar tiene que devolver el id de la revisión').to.be.a('string');
      return cy.request({
        method: 'POST',
        url: apiUrl(`/identity/manual-review/${cuerpo.id as string}/decision`),
        body: { decision, decisionReason: motivo },
        headers: { Authorization: `Bearer ${token}` },
      });
    })
    .then((decidida) => {
      const cuerpo = decidida.body as { caseStatus?: string };
      expect(cuerpo.caseStatus, 'la decisión tiene que mover el caso').to.be.a('string');
    });
}

/**
 * El resumen del propio titular — la puerta que `@RequiresVerifiedIdentity`
 * cierra con `403 IDENTITY_VERIFICATION_REQUIRED` mientras no exista una
 * aserción viva. No falla sola: el que llama decide qué estado espera, porque
 * el 403 de ANTES es tan dato como el 200 de DESPUÉS.
 */
export function resumenDelTitular(token: string): Cypress.Chainable<Cypress.Response<unknown>> {
  return cy.request({
    method: 'GET',
    url: apiUrl('/profiles/patients/me/summary'),
    headers: { Authorization: `Bearer ${token}` },
    failOnStatusCode: false,
  });
}
