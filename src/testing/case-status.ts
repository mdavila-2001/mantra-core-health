import type { HttpTestingController } from '@angular/common/http/testing';

/**
 * Los nueve estados de caso, tal como los devuelve el catálogo.
 *
 * Los identificadores son los reales: UUIDv5 deterministas de
 * `identity_assurance`, comprobados contra la API viva. No están acá para que
 * la interfaz los conozca —justamente dejó de conocerlos— sino para que una
 * prueba pueda simular la respuesta del catálogo sin inventarse datos.
 */
export const ESTADOS_DE_CASO = Object.freeze({
  CASE_OPEN: '31f822ab-b48c-5570-a83c-cf16c37b5b9a',
  CASE_IN_VERIFICATION: 'ba5a0b9d-8a27-5379-8662-eea142b98a22',
  CASE_AT_RISK: 'c919c1c1-e013-5542-914e-1fe706203cd2',
  CASE_MANUAL_REVIEW: 'a02659b9-802a-5acb-ac8f-093e0ddcdbf0',
  CASE_VERIFIED: '6fb20fdf-1c92-502c-8e1f-54a9bb85ff98',
  CASE_ASSERTED: 'd41fde09-6752-5bb6-8237-b786fe062ab2',
  CASE_REJECTED: '05c426b8-86f5-5709-a939-d6baa864fd21',
  CASE_REVOKED: '235c658e-7679-5604-baba-764055398964',
  CASE_EXPIRED: '9d172ffe-1b1f-5318-9378-c924732d7967',
});

/**
 * Responde la búsqueda de estados de caso que dispara `CaseStatusCatalog`.
 *
 * Toda pantalla que muestre el sello de un trámite inyecta ese catálogo, y al
 * construirse pide los conceptos a terminología. Sin esta llamada la petición
 * queda abierta y `http.verify()` falla — con un mensaje que no menciona a los
 * estados de caso, así que conviene llamarla y olvidarse.
 *
 * Usa `match` y no `expectOne` a propósito: el catálogo se resuelve **una vez
 * por módulo**, así que a partir de la segunda prueba del mismo archivo ya no
 * hay petición que responder. Con `expectOne` el orden de las pruebas cambiaría
 * el resultado, que es la clase de fragilidad que nadie quiere depurar.
 *
 * @param http - El controlador de pruebas HTTP de la prueba en curso.
 */
export function resolverEstadosDeCaso(http: HttpTestingController): void {
  const pendientes = http.match((peticion) =>
    peticion.url.includes('/terminology/concepts'),
  );

  for (const peticion of pendientes) {
    peticion.flush({
      // `IDA_CASE_OPEN`, no `identity_assurance:CASE_OPEN`: es el prefijo que
      // el módulo declara de verdad (`identity_assurance.concepts.ts`). El
      // formato equivocado hacía que estas pruebas pasaran mientras la pantalla
      // no resolvía ni un solo estado contra la API real.
      items: Object.entries(ESTADOS_DE_CASO).map(([codigo, conceptId]) => ({
        conceptId,
        code: `IDA_${codigo}`,
        display: codigo,
        codeSystemVersionId: 'csv-terminologia',
      })),
      count: 9,
      limit: 50,
    });
  }
}
