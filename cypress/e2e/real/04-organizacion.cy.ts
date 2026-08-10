import { capturar, reiniciarContadores } from '../../support/recorrido/evidencia';
import { admin, apiViva, crearOrganizacion, tokenDe, type Actor } from '../../support/real/actores';
import { entrar, estable, recorrer } from '../../support/real/sesion';
import { describirHallazgos, Vigilante } from '../../support/real/vigilante';

/**
 * **Organización** — se da de alta con su cuenta owner y entra de inmediato.
 *
 * Es el único actor cuyo tenant **no tiene datos**: catálogo sin poblar, agenda
 * sin recursos, padrón sin pacientes. Los estados vacíos sólo se ven así, y el
 * M34 los llama «Empty **with next action**»: un vacío mudo es un callejón, y
 * eso es lo que esta prueba mira.
 */
describe('Recorrido real · organización', () => {
  let owner: Actor;

  before(() => {
    apiViva().should('equal', true);

    // El alta de una organización pide `countryConceptId` y `jurisdictionConceptId`
    // que existan de verdad; se resuelven del catálogo con el token del admin,
    // porque los uuid de concepto no se escriben en el cliente.
    const cuenta = admin();
    tokenDe(cuenta.identificador, cuenta.clave)
      .then((token) => crearOrganizacion(token))
      .then((actor) => {
        owner = actor;
      });
  });

  beforeEach(() => {
    reiniciarContadores();
  });

  it('el owner entra y sus secciones vacías ofrecen una salida', () => {
    const vigilante = new Vigilante('organizacion');

    entrar(owner);
    estable();
    capturar({ carpeta: 'org-01-panel', titulo: 'Panel de la organización' }, 'al-entrar');
    cy.location('pathname').should('contain', '/panel');

    for (const [ruta, carpeta, titulo] of [
      ['/agenda', 'org-02-agenda-vacia', 'Agenda sin recursos'],
      ['/clinico', 'org-03-clinico-vacio', 'Archivo clínico sin pacientes'],
      ['/mi-cuenta', 'org-04-mi-cuenta', 'Mi perfil del owner'],
    ] as const) {
      recorrer(vigilante, { ruta, carpeta, titulo });
    }

    cy.then(() => {
      vigilante.recoger();
      expect(vigilante.hallazgos, describirHallazgos(vigilante.hallazgos)).to.deep.equal([]);
    });
  });
});
