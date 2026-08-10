import { capturar, reiniciarContadores } from '../../support/recorrido/evidencia';
import { apiViva, crearMedico, type Actor } from '../../support/real/actores';
import { aparece, entrar, estable, irA, recorrer } from '../../support/real/sesion';
import { describirHallazgos, Vigilante } from '../../support/real/vigilante';

/**
 * **Médico** — se registra con su matrícula y recorre lo suyo.
 *
 * La idea que ordena el recorrido es la misma que ordena `medico.smoke.ts` del
 * backend: **registrarse no es estar habilitado.** La licencia nace PENDIENTE, y
 * lo que se comprueba acá es que la aplicación sea honesta sobre eso — que no le
 * prometa pantallas que su rol todavía no abre, y que las que sí abre no se
 * rompan.
 *
 * El archivo clínico es el caso que justifica su diseño: `GET /profiles/patients`
 * pide `SECURITY_ADMIN`, que un médico no tiene, así que el buscador le responde
 * `403` y el acceso por identificador es el único camino que le queda. Que ese
 * camino exista **es** la prueba.
 */
describe('Recorrido real · médico', () => {
  let medico: Actor;

  before(() => {
    apiViva().should('equal', true);
    crearMedico().then((actor) => {
      medico = actor;
    });
  });

  beforeEach(() => {
    reiniciarContadores();
  });

  /**
   * No es una comprobación de interfaz: fija el supuesto del que cuelga todo el
   * recorrido. Si el backend empezara a habilitar al registrarse, lo de abajo
   * estaría midiendo otra cosa sin avisar.
   */
  it('se registra con matrícula y su licencia nace pendiente', () => {
    expect(medico.datos['practitionerProfileId']).to.not.equal('');
    expect(medico.datos['verificationStatus']).to.match(/PENDING|PENDIENTE/i);
  });

  it('entra y recorre lo que su rol alcanza', () => {
    const vigilante = new Vigilante('medico');

    entrar(medico);
    estable();
    capturar({ carpeta: 'med-01-panel', titulo: 'Panel del médico' }, 'al-entrar');
    cy.location('pathname').should('contain', '/panel');

    recorrer(vigilante, {
      ruta: '/mi-cuenta',
      carpeta: 'med-02-mi-cuenta',
      titulo: 'Mi perfil',
    });
    recorrer(vigilante, {
      ruta: '/identidad/verificar',
      carpeta: 'med-03-identidad',
      titulo: 'Verificar identidad',
    });

    /* -- El archivo clínico de quien atiende ------------------------------- */

    recorrer(vigilante, {
      ruta: '/clinico',
      carpeta: 'med-04-archivo-clinico',
      titulo: 'Archivo clínico',
    });

    // Sin este campo la sección sería inútil justo para el único rol que puede
    // leer un expediente: el buscador de padrón le responde 403.
    cy.porEtiqueta(/identificador de perfil/i).should('be.visible');
    capturar(
      { carpeta: 'med-04-archivo-clinico', titulo: 'Archivo clínico' },
      'acceso-por-identificador',
    );

    // Un identificador bien formado y ajeno: uno mal formado probaría la
    // validación del backend, no la pantalla.
    vigilante.en('Expediente inexistente');
    irA('/clinico/00000000-0000-4000-8000-000000000000');
    estable();
    capturar(
      { carpeta: 'med-05-expediente-inexistente', titulo: 'Expediente · no encontrado' },
      'al-entrar',
    );
    cy.get('h1', { timeout: 15_000 }).first().invoke('text').should('match', /\S/);
    cy.get('main').invoke('text').should('match', /\S/);

    /* -- Su agenda ---------------------------------------------------------- */

    recorrer(vigilante, {
      ruta: '/agenda',
      carpeta: 'med-06-agenda',
      titulo: 'Agenda del médico',
    });

    aparece('[role="tab"]', 'med-06-agenda', 'la pestaña de cupos').then((hayPestanas) => {
      if (!hayPestanas) {
        return;
      }
      cy.get('[role="tab"]').contains(/cupos/i).click();
      estable();
      capturar({ carpeta: 'med-06-agenda', titulo: 'Agenda del médico' }, 'pestana-cupos');
    });

    cy.then(() => {
      vigilante.recoger();
      expect(vigilante.hallazgos, describirHallazgos(vigilante.hallazgos)).to.deep.equal([]);
    });
  });
});
