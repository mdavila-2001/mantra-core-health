import { capturar, reiniciarContadores } from '../../support/recorrido/evidencia';
import { apiViva, crearPaciente, tokenDe, type Actor } from '../../support/real/actores';
import { entrar, estable, irA } from '../../support/real/sesion';

/**
 * **Estados de un caso de verificación**, resueltos contra terminología.
 *
 * Hasta hace poco la interfaz traducía el estado con nueve UUID escritos a
 * mano. Ahora los resuelve contra el catálogo, y esta prueba es la única que
 * puede afirmar que la resolución **funciona de verdad**: necesita un caso real,
 * abierto por la API, y el catálogo real respondiendo.
 *
 * Lo que fija: que el titular ve el estado **en palabras** y no el uuid ni el
 * neutro «Desconocido». Si el prefijo de búsqueda cambiara, si el catálogo
 * dejara de traer los nueve, o si alguien quitara la inyección que dispara la
 * resolución, acá se ve — y en ningún otro lado, porque con el catálogo vacío la
 * pantalla sigue pintando, sólo que en neutro.
 */
describe('Recorrido real · estados de un caso de verificación', () => {
  let paciente: Actor;

  before(() => {
    apiViva().should('equal', true);
    crearPaciente().then((actor) => {
      paciente = actor;
    });
  });

  beforeEach(() => {
    reiniciarContadores();
  });

  it('el trámite se ve en palabras, no como uuid ni como «Desconocido»', () => {
    // 1. Abrir un caso por la API: subir un documento y pedir la verificación.
    //    Se hace por acá y no por la interfaz porque lo que se está probando es
    //    la traducción del estado, no el formulario que ya cubre otra prueba.
    cy.then(() => tokenDe(paciente.identificador, paciente.clave)).then((token) => {
      // El multipart se arma a mano y no con `FormData`: `cy.request` lo
      // serializa por su cuenta y el archivo llegaba vacío, así que la subida
      // respondía sin `id` y el fallo aparecía recién en la llamada siguiente.
      const limite = 'mantraE2E';
      const cuerpoMultipart =
        `--${limite}\r\n` +
        'Content-Disposition: form-data; name="file"; filename="documento.pdf"\r\n' +
        'Content-Type: application/pdf\r\n\r\n' +
        'documento de prueba\r\n' +
        `--${limite}\r\n` +
        'Content-Disposition: form-data; name="category"\r\n\r\nDOCUMENT\r\n' +
        `--${limite}\r\n` +
        'Content-Disposition: form-data; name="sensitivity"\r\n\r\nPHI\r\n' +
        `--${limite}--\r\n`;

      cy.request({
        method: 'POST',
        url: '/common/files/upload',
        body: cuerpoMultipart,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${limite}`,
        },
      })
        .then((subida) => {
          // El cuerpo puede llegar como texto según cómo negocie el tipo: se
          // normaliza acá para que el fallo, si lo hay, diga «no vino el id» y
          // no «400» tres líneas más abajo.
          const cuerpo =
            typeof subida.body === 'string'
              ? (JSON.parse(subida.body) as { id?: string })
              : (subida.body as { id?: string });
          expect(cuerpo.id, 'la subida tiene que devolver el id del archivo').to.be.a('string');

          return cy.request({
            method: 'POST',
            url: '/identity/me/identity-verification',
            body: { evidenceFileId: cuerpo.id },
            headers: { Authorization: `Bearer ${token}` },
          });
        })
        .then((caso) => {
          expect(caso.status, 'el caso tiene que abrirse').to.eq(201);
        });
    });

    // 2. Mirarlo con los ojos del titular.
    cy.then(() => entrar(paciente));
    estable();

    irA('/my-account/identity/cases');
    estable();
    capturar({ carpeta: 'estados-01-casos', titulo: 'Mis verificaciones' }, 'con-un-caso');

    // Abrir el caso lo deja en `CASE_IN_VERIFICATION` —no en `CASE_OPEN`: el
    // backend planifica la comprobación en el mismo acto—, y la interfaz llama
    // a eso «En revisión». Que aparezca prueba las tres piezas a la vez: la
    // búsqueda por prefijo, el mapeo por código y la reactividad de la señal.
    cy.get('app-badge', { timeout: 15000 }).should('contain.text', 'En revisión');
    // «Desconocido» es el neutro: aparecería si el catálogo no se resolviera.
    cy.contains(/desconocido/i).should('not.exist');
    // Y el estado nunca es el identificador del concepto.
    cy.get('app-badge')
      .invoke('text')
      .should('not.match', /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);

    // Nota deliberada: la columna «Caso» sí muestra el uuid del trámite, como
    // texto del enlace al detalle. Es una decisión de esa pantalla —el caso no
    // tiene código legible en su contrato— y no de esta resolución, así que no
    // se afirma acá.
  });
});
