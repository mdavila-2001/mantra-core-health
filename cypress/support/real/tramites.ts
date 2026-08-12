import { estable } from './sesion';

/**
 * Los trámites que una persona hace **por la pantalla**, con la API viva detrás.
 *
 * Vive acá y no dentro de una spec porque lo usan dos recorridos con propósitos
 * distintos —el del paciente, que demuestra que puede hacerlo solo; y el de la
 * cola de revisión, que necesita un caso real para revisarlo— y duplicarlo
 * significaría mantener dos veces los anclajes de una pantalla que **no tiene un
 * solo `data-testid`**: todo se localiza por su texto.
 */

/**
 * Sube el documento de identidad en `/identidad/verificar` y devuelve el código
 * del caso que la pantalla muestra.
 *
 * Da por sentado que ya se está en esa ruta y que la pantalla terminó de cargar.
 *
 * ## Por qué el archivo se arma en memoria
 *
 * No hay ningún PDF ni imagen en `cypress/fixtures/`, y agregarlo sería sumar un
 * binario al repositorio para transportar diecinueve bytes. `Cypress.Buffer` los
 * produce en el acto, y es lo que ya hace el explorador del recorrido visual.
 *
 * ## Por qué `force`
 *
 * El `<input type="file">` está oculto detrás de su zona de arrastre —es lo que
 * hace el componente para poder dibujarla—, así que sin `force` Cypress se niega
 * a interactuar con un elemento que no ve. Es la forma del componente, no un
 * atajo de la prueba.
 *
 * ## Por qué el código se lee de la pantalla
 *
 * El identificador sale del `<dd>` que acompaña a «Código del caso» y no de la
 * respuesta de la API. Así lo que se afirma después depende de **lo que el
 * titular ve**, que es exactamente lo que se está demostrando.
 *
 * @returns El código del caso, tal como aparece en pantalla.
 */
export function subirDocumento(): Cypress.Chainable<string> {
  cy.get('input[type=file]').selectFile(
    {
      contents: Cypress.Buffer.from('documento de prueba'),
      fileName: 'documento.pdf',
      mimeType: 'application/pdf',
    },
    { force: true },
  );

  cy.contains('button', 'Enviar para revisión').click();
  estable();

  // El alta encadena dos peticiones —subir el archivo y abrir el caso— y la
  // segunda espera a la primera, así que el margen es más ancho que el normal.
  cy.contains('Tu solicitud quedó registrada', { timeout: 20_000 }).should('exist');

  return cy
    .contains('dt', 'Código del caso')
    .siblings('dd')
    .find('code')
    .invoke('text')
    .then((texto) => cy.wrap(texto.trim(), { log: false }));
}
