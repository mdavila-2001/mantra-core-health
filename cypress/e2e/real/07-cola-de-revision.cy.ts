import { capturar, reiniciarContadores } from '../../support/recorrido/evidencia';
import { admin, apiViva, crearPaciente, tokenDe, type Actor } from '../../support/real/actores';
import { entrar, estable, irA } from '../../support/real/sesion';
import { subirDocumento } from '../../support/real/tramites';

/**
 * **El Acto 3 de la demo, de punta a punta y contra la API viva.**
 *
 * Un paciente pide que verifiquen su identidad. Alguien tiene que revisarlo. Esta
 * prueba recorre ese trayecto entero —el caso aparece en la cola de quien revisa,
 * se resuelve, y el titular ve el resultado en palabras— porque es el único que
 * puede afirmar que las tres piezas encajan: el endpoint del backend, la pantalla
 * que lo consume y la terminología que traduce el estado.
 *
 * ## Qué se hace por la interfaz y qué por la API
 *
 * Por la **interfaz** van las dos puntas del trámite, que son las que se muestran
 * el día de la demo: el paciente sube su documento en `/identidad/verificar` y
 * lee ahí el código de su caso, y del otro lado la cola lo muestra, su enlace
 * llega con el identificador puesto, el caso resuelto desaparece y el titular ve
 * su estado en palabras.
 *
 * Por la **API** van sólo las dos transiciones intermedias —escalar y decidir—,
 * que ya cubren otras pruebas y que en la demo tampoco se hacen a mano:
 * repetirlas por formulario no agregaría evidencia y sí puntos de fallo ajenos.
 *
 * Es la misma división que usa `06-estados-de-caso`, corrida un paso: acá el
 * alta del caso **no** se ataja por la API, porque es el gesto que la persona
 * hace y lo único que puede probar que el formulario acepta el archivo.
 *
 * ## Sin un solo UUID escrito a mano
 *
 * El motivo de la revisión se resuelve **por su código** contra el catálogo, igual
 * que hace la interfaz con los estados. Fijar el identificador acá sería repetir
 * el error que el modelo ya corrigió: el código es la identidad del concepto, el
 * identificador se deriva de ella.
 */
describe('Recorrido real · la cola de revisión de identidad', () => {
  /**
   * Raíz de la API, **absoluta y siempre**.
   *
   * Una ruta relativa en `cy.request` se resuelve contra el `baseUrl` de
   * Cypress, que es el servidor del frontend: la petición nunca llega al backend
   * y vuelve `404`, con un mensaje que no menciona a quién le preguntó.
   *
   * Se lee con `Cypress.expose` y no con `Cypress.env`: la 15 deprecó el
   * segundo y esta suite ya apaga `allowCypressEnv`, así que `Cypress.env()` no
   * existe. Es el mismo camino que usa `support/real/actores.ts`.
   */
  function apiUrl(ruta: string): string {
    const raiz = Cypress.expose('E2E_API_URL') as unknown;
    const base = typeof raiz === 'string' && raiz !== '' ? raiz : 'http://localhost:3000';
    return `${base}${ruta}`;
  }

  let paciente: Actor;

  /** El administrador entra por la pantalla de ingreso, como cualquiera. */
  const revisor: Actor = { ...admin(), nombre: 'Administrador', datos: {} };

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
   * Escribe en el campo que tiene ese rótulo.
   *
   * Se llega al control por el `for` del `<label>` en vez de por posición: es el
   * vínculo que `FORM_CONTROL_CONTEXT` construye para los lectores de pantalla,
   * así que usarlo prueba de paso que sigue en pie. Por posición, agregar un
   * campo al formulario rompería la prueba sin que nada esté mal.
   */
  function campoDe(rotulo: string): Cypress.Chainable<JQuery<HTMLElement>> {
    return cy
      .contains('label', rotulo)
      .invoke('attr', 'for')
      .then((id) => cy.get(`#${id as string}`));
  }

  /** Escribe en el campo que tiene ese rótulo. Ver {@link campoDe}. */
  function escribirEnCampo(rotulo: string, texto: string): void {
    campoDe(rotulo).clear().type(texto);
  }

  /** El texto del `<dd>` que acompaña a ese `<dt>`. */
  function valorDe(rotulo: string): Cypress.Chainable<string> {
    return cy
      .contains('dt', rotulo)
      .siblings('dd')
      .find('code')
      .invoke('text')
      .then((texto) => cy.wrap(texto.trim(), { log: false }));
  }

  /** El `conceptId` de un código del catálogo, buscado y no inventado. */
  function conceptoPorCodigo(token: string, codigo: string): Cypress.Chainable<string> {
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
   * Vuelve a la cola **pasando por otra pantalla**.
   *
   * `irA` navega con `pushState` + `popstate`, y el router de Angular no
   * reactiva una ruta que ya está activa: pedirle la cola estando en la cola no
   * recrea el componente ni vuelve a leer, así que la lista se queda con lo que
   * trajo la primera vez. Es lo que hace un revisor de verdad —sale al panel y
   * vuelve por el menú— y es la única forma de que la pantalla demuestre que el
   * caso resuelto desapareció.
   */
  function volverALaCola(): void {
    irA('/panel');
    estable();
    irA('/administracion/verificacion-identidad/cola');
    estable();
  }

  /** Los identificadores que la cola devuelve ahora mismo. */
  function idsEnCola(token: string): Cypress.Chainable<string[]> {
    return cy
      .request({
        method: 'GET',
        url: apiUrl('/identity/verification-cases'),
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((respuesta) => {
        const cuerpo = respuesta.body as { cases?: { id: string }[] };
        return cy.wrap(
          (cuerpo.cases ?? []).map((kase) => kase.id),
          { log: false },
        );
      });
  }

  it('el caso del paciente llega a la cola, se resuelve, y el titular lo ve aprobado', () => {
    const contexto: { caso: string; token: string; revision: string } = {
      caso: '',
      token: '',
      revision: '',
    };

    // ── 1. El paciente sube su documento, por la pantalla ──────────────────
    cy.then(() => entrar(paciente));
    estable();
    irA('/identidad/verificar');
    estable();

    subirDocumento().then((caseId) => {
      expect(caseId, 'la pantalla tiene que mostrar el código del caso').to.match(
        /^[0-9a-f-]{36}$/,
      );
      contexto.caso = caseId;
    });
    capturar(
      { carpeta: 'cola-00-solicitud', titulo: 'Verificar identidad · la solicitud registrada' },
      'enviada',
    );

    cy.then(() => tokenDe(revisor.identificador, revisor.clave)).then((token) => {
      contexto.token = token;
    });

    // ── 2. El revisor lo encuentra sin que nadie le pase el identificador ──
    cy.then(() => entrar(revisor));
    estable();

    irA('/administracion/verificacion-identidad/cola');
    estable();

    // Que el caso esté acá es lo que la cola vino a resolver: antes, un caso
    // abierto por autoservicio no llegaba a quien revisa por ningún camino.
    cy.then(() => {
      cy.contains('app-data-table', contexto.caso, { timeout: 20_000 }).should('exist');
    });
    // En palabras, no como identificador de concepto: la terminología resolvió.
    cy.get('app-badge').first().should('contain.text', 'En revisión');
    cy.contains(/desconocido/i).should('not.exist');
    capturar(
      { carpeta: 'cola-01-pendiente', titulo: 'Cola de revisión · el caso esperando' },
      'con-el-caso',
    );

    // ── 3. El enlace de la fila lleva el identificador puesto ──────────────
    cy.then(() => {
      cy.get(`a[href*="caseId=${contexto.caso}"]`).first().click();
    });
    estable();
    cy.location('pathname').should('contain', '/revision/escalar');
    // Nadie copió nada: el formulario llegó con el caso cargado.
    //
    // Dentro de `cy.then` y no suelto: los argumentos de `should` se evalúan al
    // **encolar** el comando, y ahí `contexto.caso` todavía es la cadena vacía
    // con la que se declaró. El mensaje de fallo sale invertido —«expected to
    // have value ''»— y hace parecer que la pantalla no prellenó nada.
    cy.then(() => {
      campoDe('Caso de verificación').should('have.value', contexto.caso);
    });
    capturar(
      { carpeta: 'cola-02-escalar', titulo: 'Revisión manual · con el caso ya puesto' },
      'prellenado',
    );

    // ── 4. Escalar no lo saca de la cola: cambia de estado, no de situación ─
    // El motivo se busca por su código y se pega, que es lo que el propio
    // formulario pide: «El módulo todavía no expone listados: pegá el
    // identificador (UUID)». Es el gesto exacto de la demo, con la diferencia de
    // que acá el uuid no está escrito a mano en ningún lado.
    //
    // `ACTIVE` y no `state:active`: lo segundo es la **clave interna** con que el
    // backend indexa el concepto (`common/constants/concepts.ts`), y el catálogo
    // no la conoce. Lo que viaja por la API es el `code`, que es `ACTIVE`.
    cy.then(() => conceptoPorCodigo(contexto.token, 'ACTIVE')).then((motivo) => {
      escribirEnCampo('Motivo de la revisión (concepto)', motivo);
    });
    cy.contains('button', 'Escalar a revisión').click();
    estable();

    cy.contains('La revisión quedó abierta', { timeout: 20_000 }).should('exist');
    valorDe('Identificador').then((id) => {
      contexto.revision = id;
    });

    cy.then(() => idsEnCola(contexto.token)).then((ids) => {
      expect(ids, 'un caso en revisión manual sigue esperando a una persona').to.include(
        contexto.caso,
      );
    });

    irA('/administracion/verificacion-identidad/cola');
    estable();
    cy.then(() => {
      cy.contains('app-data-table', contexto.caso, { timeout: 20_000 }).should('exist');
    });
    capturar(
      { carpeta: 'cola-03-revision', titulo: 'Cola de revisión · escalado, y sigue' },
      'en-revision-manual',
    );

    // ── 5. Resolverlo sí lo saca. Es lo que hace de esto una cola ──────────
    irA('/administracion/verificacion-identidad/revision/decision');
    estable();
    cy.then(() => {
      escribirEnCampo('Revisión manual', contexto.revision);
    });
    cy.contains('label', 'Aprobar').click();
    escribirEnCampo('Motivo de la decisión', 'Documento legible');
    cy.contains('button', 'Registrar decisión').click();
    estable();

    cy.contains('La revisión quedó decidida', { timeout: 20_000 }).should('exist');
    capturar(
      { carpeta: 'cola-04-decision', titulo: 'Decidir revisión · aprobada' },
      'aprobada',
    );

    volverALaCola();
    cy.then(() => {
      cy.contains(contexto.caso).should('not.exist');
    });
    capturar(
      { carpeta: 'cola-05-resuelto', titulo: 'Cola de revisión · el trabajo hecho se va' },
      'sin-el-caso',
    );

    // ── 6. Y el titular lo ve, en su idioma y sin uuid ─────────────────────
    cy.then(() => entrar(paciente));
    estable();
    irA('/identidad/casos');
    estable();

    cy.get('app-badge', { timeout: 20_000 }).should('contain.text', 'Aprobado');
    cy.contains(/desconocido/i).should('not.exist');
    capturar(
      { carpeta: 'cola-06-titular', titulo: 'Mis verificaciones · aprobado' },
      'estado-final',
    );
  });
});
