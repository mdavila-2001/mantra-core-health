import { capturar, reiniciarContadores } from '../../support/recorrido/evidencia';
import { admin, apiViva, crearPaciente, tokenDe, type Actor } from '../../support/real/actores';
import {
  apiUrl,
  conceptoPorCodigo,
  escalarYDecidir,
  resumenDelTitular,
} from '../../support/real/casos';
import { entrar, estable, irA } from '../../support/real/sesion';
import { anotarTramoApagado, tramoActivo } from '../../support/real/tramos';

/**
 * **El sello del titular acompaña al caso durante todo su ciclo.**
 *
 * `06` fijó que un estado se ve en palabras y no como uuid; `07` recorrió la
 * cola de punta a punta y miró el estado final. Lo que ninguna fija es lo que
 * esta prueba viene a afirmar: que el **mismo caso** se ve «En revisión»
 * mientras espera y cambia a su veredicto cuando alguien lo decide, en las
 * **dos** vistas del titular —la lista de «Mis verificaciones» y el detalle— y
 * para los **dos** desenlaces, aprobado y rechazado. Es la promesa de IT2: cada
 * vez que el titular vuelve a mirar, la pantalla dice lo que la API ya hizo.
 *
 * ## Por qué los dos casos van en secuencia y no en paralelo
 *
 * El backend permite **una sola verificación en curso por sujeto**: abrir la
 * segunda con la primera abierta responde `409 · «Ya hay una verificación en
 * curso para este sujeto»` (comprobado contra la API viva). Así que el
 * recorrido es el de una persona real: la rechazan, **reintenta**, y la
 * aprueban. De paso queda fijado que el historial acumula —el caso rechazado
 * no desaparece cuando el nuevo se abre— y que cada sello se mueve solo.
 *
 * ## Qué va por la interfaz y qué por la API
 *
 * Por la **interfaz** va todo lo que el titular ve: la lista, el detalle y sus
 * sellos, antes y después de cada decisión. Por la **API** van el alta de los
 * casos y las dos transiciones —escalar y decidir—, porque el formulario de
 * subida ya lo cubre `07` por pantalla y los formularios de M27 también:
 * repetirlos acá no agregaría evidencia y sí duplicaría sus puntos de fallo.
 * Es la misma división que `06`, aplicada al ciclo completo.
 */
describe('Recorrido real · el sello del titular sigue al caso', () => {
  // `apiUrl`, `conceptoPorCodigo` y `escalarYDecidir` viven en
  // `support/real/casos.ts` desde que el tramo N4 del 09 los necesita también.
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

  /**
   * Sube un documento y abre un caso de verificación; devuelve su identificador.
   *
   * El multipart se arma a mano y no con `FormData`: `cy.request` lo serializa
   * por su cuenta y el archivo llegaba vacío (la lección quedó escrita en `06`).
   */
  function abrirCaso(token: string): Cypress.Chainable<string> {
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

    return cy
      .request({
        method: 'POST',
        url: apiUrl('/common/files/upload'),
        body: cuerpoMultipart,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/form-data; boundary=${limite}`,
        },
      })
      .then((subida) => {
        const cuerpo =
          typeof subida.body === 'string'
            ? (JSON.parse(subida.body) as { id?: string })
            : (subida.body as { id?: string });
        expect(cuerpo.id, 'la subida tiene que devolver el id del archivo').to.be.a('string');

        return cy.request({
          method: 'POST',
          url: apiUrl('/identity/me/identity-verification'),
          body: { evidenceFileId: cuerpo.id },
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then((caso) => {
        const cuerpo = caso.body as { caseId?: string };
        expect(cuerpo.caseId, 'la apertura tiene que devolver el id del caso').to.be.a('string');
        return cy.wrap(cuerpo.caseId as string, { log: false });
      });
  }

  /** La fila de la lista que muestra ese caso (la columna «Caso» trae el uuid). */
  function filaDelCaso(caseId: string): Cypress.Chainable<JQuery<HTMLTableRowElement>> {
    return cy.contains('tr', caseId, { timeout: 20_000 });
  }

  /** El sello del detalle: el `<dd>` de «Estado» dentro de los datos del trámite. */
  function selloDelDetalle(): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy.contains('dt', 'Estado', { timeout: 20_000 }).siblings('dd').find('app-status-seal');
  }

  /**
   * Vuelve a la lista pasando por el panel: el router no reactiva la ruta en la
   * que ya está, y sin re-crear el componente la pantalla no vuelve a leer. Es
   * la misma vuelta que documenta `07` para la cola.
   */
  function volverALaLista(): void {
    irA('/dashboard');
    estable();
    irA('/my-account/identity/cases');
    estable();
  }

  it('«En revisión» mientras espera; «Rechazado» y «Aprobado» cuando alguien decide', () => {
    const contexto = {
      tokenPaciente: '',
      tokenAdmin: '',
      motivo: '',
      casoRechazado: '',
      casoAprobado: '',
    };

    // ── 0. Los tokens y el motivo del catálogo, una sola vez ────────────────
    cy.then(() => tokenDe(paciente.identificador, paciente.clave)).then((token) => {
      contexto.tokenPaciente = token;
    });
    cy.then(() => tokenDe(admin().identificador, admin().clave)).then((token) => {
      contexto.tokenAdmin = token;
    });
    // `ACTIVE` es un código real del catálogo; el uuid se busca, no se escribe.
    cy.then(() => conceptoPorCodigo(contexto.tokenAdmin, 'ACTIVE')).then((motivo) => {
      contexto.motivo = motivo;
    });

    // ── 1. El primer caso, abierto por la API ───────────────────────────────
    cy.then(() => abrirCaso(contexto.tokenPaciente)).then((id) => {
      contexto.casoRechazado = id;
    });

    // ── 2. ANTES · «En revisión» en la lista y en el detalle ────────────────
    cy.then(() => entrar(paciente));
    estable();
    irA('/my-account/identity/cases');
    estable();

    cy.then(() => {
      filaDelCaso(contexto.casoRechazado).find('app-badge').should('contain.text', 'En revisión');
    });
    cy.contains(/desconocido/i).should('not.exist');
    capturar(
      { carpeta: 'sello-01-antes-lista', titulo: 'Mis verificaciones · el caso esperando' },
      'en-revision',
    );

    cy.then(() => irA(`/my-account/identity/cases/${contexto.casoRechazado}`));
    estable();
    selloDelDetalle().should('contain.text', 'En revisión');
    // El sello dice palabras, jamás el identificador del concepto.
    selloDelDetalle()
      .invoke('text')
      .should('not.match', /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
    capturar(
      { carpeta: 'sello-02-antes-detalle', titulo: 'Caso de verificación · esperando' },
      'en-revision',
    );

    // ── 3. Lo rechazan, y el titular lo ve sin tocar nada ───────────────────
    cy.then(() =>
      escalarYDecidir(
        contexto.tokenAdmin,
        contexto.casoRechazado,
        contexto.motivo,
        'REJECTED',
        'Documento ilegible',
      ),
    );

    volverALaLista();
    cy.then(() => {
      filaDelCaso(contexto.casoRechazado).find('app-badge').should('contain.text', 'Rechazado');
    });
    capturar(
      { carpeta: 'sello-03-rechazado-lista', titulo: 'Mis verificaciones · rechazado' },
      'rechazado',
    );

    cy.then(() => irA(`/my-account/identity/cases/${contexto.casoRechazado}`));
    estable();
    selloDelDetalle().should('contain.text', 'Rechazado');
    selloDelDetalle()
      .invoke('text')
      .should('not.match', /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
    capturar(
      { carpeta: 'sello-04-rechazado-detalle', titulo: 'Caso de verificación · rechazado' },
      'rechazado',
    );

    // ── 4. Reintenta: el caso nuevo espera y el rechazado no se borra ───────
    // Con el primero decidido, el `409` de «una verificación en curso por
    // sujeto» ya no aplica: reintentar es exactamente lo que haría la persona.
    cy.then(() => abrirCaso(contexto.tokenPaciente)).then((id) => {
      contexto.casoAprobado = id;
    });

    volverALaLista();
    cy.then(() => {
      filaDelCaso(contexto.casoAprobado).find('app-badge').should('contain.text', 'En revisión');
      filaDelCaso(contexto.casoRechazado).find('app-badge').should('contain.text', 'Rechazado');
    });
    cy.contains(/desconocido/i).should('not.exist');
    capturar(
      { carpeta: 'sello-05-reintento-lista', titulo: 'Mis verificaciones · el reintento espera' },
      'historial',
    );

    // ── 5. Lo aprueban: cada caso con su veredicto, cada sello el suyo ──────
    cy.then(() =>
      escalarYDecidir(
        contexto.tokenAdmin,
        contexto.casoAprobado,
        contexto.motivo,
        'APPROVED',
        'Documento legible',
      ),
    );

    volverALaLista();
    cy.then(() => {
      filaDelCaso(contexto.casoAprobado).find('app-badge').should('contain.text', 'Aprobado');
      filaDelCaso(contexto.casoRechazado).find('app-badge').should('contain.text', 'Rechazado');
    });
    cy.contains(/desconocido/i).should('not.exist');
    capturar(
      { carpeta: 'sello-06-final-lista', titulo: 'Mis verificaciones · el historial completo' },
      'veredictos',
    );

    cy.then(() => irA(`/my-account/identity/cases/${contexto.casoAprobado}`));
    estable();
    selloDelDetalle().should('contain.text', 'Aprobado');
    selloDelDetalle()
      .invoke('text')
      .should('not.match', /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/i);
    capturar(
      { carpeta: 'sello-07-aprobado-detalle', titulo: 'Caso de verificación · aprobado' },
      'aprobado',
    );
  });

  /**
   * **N4 · el desenlace del Acto 3: aprobar habilita el acceso.**
   *
   * El sello que la prueba de arriba fija es la mitad de la promesa; la otra
   * mitad es que el titular **deja de estar bloqueado**: su resumen pasa de
   * `403 IDENTITY_VERIFICATION_REQUIRED` a `200`. Hasta el fix H-01 del
   * backend (PR #54), aprobar dejaba el check abierto y la aserción jamás se
   * emitía — la pantalla decía «Aprobado» y el perfil seguía cerrado.
   *
   * Corre con un paciente propio: el de la prueba de arriba ya termina
   * aprobado, así que su `403` de ANTES no existiría.
   */
  it('N4 · aprobar deja al titular con acceso: el resumen pasa de 403 a 200', () => {
    if (!tramoActivo('TRAMO_N4_ACCESO')) {
      anotarTramoApagado(
        'TRAMO_N4_ACCESO',
        'Caso de verificación',
        'aprobar la revisión emite la aserción y el resumen del titular pasa de 403 a 200 (espera el PR #54 de la API)',
      );
      return;
    }

    const contexto = { tokenTitular: '', tokenAdmin: '', motivo: '', caso: '' };

    cy.then(() => crearPaciente()).then((titular) => {
      cy.then(() => tokenDe(titular.identificador, titular.clave)).then((token) => {
        contexto.tokenTitular = token;
      });
    });
    cy.then(() => tokenDe(admin().identificador, admin().clave)).then((token) => {
      contexto.tokenAdmin = token;
    });
    cy.then(() => conceptoPorCodigo(contexto.tokenAdmin, 'ACTIVE')).then((motivo) => {
      contexto.motivo = motivo;
    });

    // ── ANTES · la puerta está cerrada, y con el motivo correcto ────────────
    cy.then(() => resumenDelTitular(contexto.tokenTitular)).then((antes) => {
      expect(antes.status, 'sin verificación, el resumen tiene que estar cerrado').to.equal(403);
      expect(JSON.stringify(antes.body)).to.contain('IDENTITY_VERIFICATION_REQUIRED');
    });

    // ── El trámite completo: abrir → escalar → aprobar ──────────────────────
    cy.then(() => abrirCaso(contexto.tokenTitular)).then((id) => {
      contexto.caso = id;
    });
    cy.then(() =>
      escalarYDecidir(contexto.tokenAdmin, contexto.caso, contexto.motivo, 'APPROVED', 'Documento legible'),
    );

    // ── DESPUÉS · la aserción existe y la puerta se abre ────────────────────
    cy.then(() => resumenDelTitular(contexto.tokenTitular)).then((despues) => {
      expect(despues.status, 'aprobar tiene que habilitar el acceso del titular').to.equal(200);
    });
  });
});
