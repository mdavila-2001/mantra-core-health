import { capturar, reiniciarContadores } from '../../support/recorrido/evidencia';
import { apiViva, crearPaciente, type Actor } from '../../support/real/actores';
import { entrar, estable, irA, recorrer } from '../../support/real/sesion';
import { subirDocumento } from '../../support/real/tramites';
import { describirHallazgos, Vigilante } from '../../support/real/vigilante';

/**
 * **Paciente** — se da de alta solo, entra con su documento y choca con la
 * puerta de la verificación de identidad.
 *
 * Es el recorrido que ninguna otra prueba hace, y el que más dice del producto:
 *
 * - **Entra con documento, no con correo.** La pantalla de ingreso lo resuelve
 *   por la ausencia de `@`. Con el simulador ese camino nunca se prueba, porque
 *   el simulador responde igual a los dos.
 * - **`403 IDENTITY_VERIFICATION_REQUIRED` es lo correcto.** Un paciente recién
 *   registrado *tiene* que recibirlo al pedir su resumen; lo que se juzga es que
 *   la pantalla lo convierta en una salida y no en un muro.
 * - **El menú se le achica.** Sin roles de administración no debería ver
 *   Pacientes, Usuarios ni Terminología, y las rutas escritas a mano tienen que
 *   responder algo legible en vez de romperse.
 *
 * Va en una sola prueba por el límite de diez ingresos por minuto del backend;
 * ver el encabezado de `01-administrador.cy.ts`.
 */
describe('Recorrido real · paciente', () => {
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

  it('se registra, entra con su documento y encuentra la puerta de verificación', () => {
    const vigilante = new Vigilante('paciente');

    /* -- Las dos pantallas públicas --------------------------------------- */

    vigilante.en('Crear cuenta');
    cy.visit('/auth/register');
    estable();
    capturar({ carpeta: 'pac-01-registro', titulo: 'Crear cuenta' }, 'formulario');
    cy.get('h1').first().invoke('text').should('match', /\S/);

    vigilante.en('Ingreso');
    cy.visit('/auth');
    estable();
    capturar({ carpeta: 'pac-02-ingreso', titulo: 'Ingreso' }, 'vacio');

    /* -- Su sesión --------------------------------------------------------- */

    cy.then(() => entrar(paciente));
    estable();
    capturar({ carpeta: 'pac-03-panel', titulo: 'Panel del paciente' }, 'al-entrar');
    cy.location('pathname').should('contain', '/dashboard');

    /* -- La puerta: 403 por identidad, con salida -------------------------- */

    recorrer(vigilante, {
      ruta: '/my-account',
      carpeta: 'pac-04-mi-perfil',
      titulo: 'Mi perfil',
    });

    // La salida hacia la verificación: un enlace o un botón. Se busca por lo que
    // dice y no por una clase, que es lo que se rompe primero en un rediseño.
    cy.contains('a, button', /verific/i, { timeout: 15_000 })
      .should('be.visible')
      .click();
    estable();
    capturar(
      { carpeta: 'pac-05-verificar-identidad', titulo: 'Verificar identidad' },
      'desde-mi-perfil',
    );

    recorrer(vigilante, {
      ruta: '/my-account/identity/verify',
      carpeta: 'pac-06-identidad',
      titulo: 'Verificar identidad',
    });

    /* -- Y hace el trámite: sube su documento ------------------------------ */

    // Es el gesto que abre el caso que después se revisa, y hasta acá el
    // recorrido del paciente llegaba a la pantalla y se iba sin tocarla: quien
    // lo leyera podía creer que el trámite estaba cubierto, y sólo lo ejercitaba
    // la prueba del revisor.
    vigilante.en('Verificar identidad · trámite');
    subirDocumento().then((caseId) => {
      expect(caseId, 'la pantalla tiene que devolverle el código de su caso').to.match(
        /^[0-9a-f-]{36}$/,
      );
    });
    capturar(
      { carpeta: 'pac-06b-solicitud', titulo: 'Verificar identidad · la solicitud registrada' },
      'enviada',
    );

    // El estado se dice en palabras. «Desconocido» es el neutro con que degrada
    // la pantalla si el catálogo no resuelve, así que su ausencia es lo que
    // prueba que resolvió; y el sello nunca puede ser el uuid del concepto.
    cy.get('app-status-seal').should('contain.text', 'En revisión');
    cy.contains(/desconocido/i).should('not.exist');

    /* -- Y lo ve después en su lista de trámites --------------------------- */

    irA('/my-account/identity/cases');
    estable();
    capturar({ carpeta: 'pac-06c-casos', titulo: 'Mis verificaciones' }, 'con-el-tramite');
    cy.get('app-badge').should('contain.text', 'En revisión');

    /* -- Lo que su rol no alcanza ------------------------------------------ */

    vigilante.en('Menú del paciente');
    irA('/dashboard');
    estable();
    capturar({ carpeta: 'pac-07-menu', titulo: 'Menú del paciente' }, 'navegacion-completa');

    // Filtrar el menú es **cortesía, no seguridad**: quien escriba la ruta llega
    // igual, y de eso se ocupa el backend. Lo que se comprueba es la cortesía.
    for (const seccion of ['Pacientes', 'Usuarios', 'Terminología']) {
      cy.get('nav[aria-label="Navegación principal"]').should('not.contain.text', seccion);
    }

    // Y escribiéndolas a mano: la pantalla tiene que ser legible —el estado S5 de
    // la sección— y no una en blanco ni una excepción. Los `403` de esas lecturas
    // están en la lista de esperados: lo que se juzga es que se sepan contar.
    for (const [ruta, carpeta, titulo] of [
      ['/administration/patients', 'pac-08-padron-denegado', 'Pacientes · sin permiso'],
      ['/medical-records', 'pac-09-clinico-denegado', 'Archivo clínico · sin permiso'],
    ] as const) {
      vigilante.en(titulo);
      irA(ruta);
      estable();
      capturar({ carpeta, titulo }, 'al-entrar');
      cy.get('h1', { timeout: 15_000 }).first().invoke('text').should('match', /\S/);
      cy.get('main').invoke('text').should('match', /\S/);
    }

    cy.then(() => {
      vigilante.recoger();
      expect(vigilante.hallazgos, describirHallazgos(vigilante.hallazgos)).to.deep.equal([]);
    });
  });
});
