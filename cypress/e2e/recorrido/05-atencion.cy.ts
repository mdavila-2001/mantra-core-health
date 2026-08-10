import {
  CLAIMS_ADMIN,
  iniciarSesionEnRecorrido,
  simularApiTotal,
} from '../../support/recorrido/api-total';
import { capturar, esperarEstable, reiniciarContadores } from '../../support/recorrido/evidencia';
import { EVITAR_POR_DEFECTO, recorrer } from '../../support/recorrido/explorador';

/**
 * Las pantallas de **Atención**: agenda y archivo clínico.
 *
 * Son las dos que dejaron de ser un cartel en esta iteración, y las que más
 * estados tienen de todo el producto: cada una con datos y sin ellos, y el
 * expediente con ocho bloques que se dibujan **uno por vez** —el panel de una
 * pestaña inactiva no existe en el DOM—, así que una sola captura no probaría
 * ninguno de los otros siete.
 *
 * El rol es `SECURITY_ADMIN` como en el resto del recorrido: el explorador
 * necesita el menú entero, y las lecturas de agenda y expediente están
 * simuladas, así que el rol no cambia lo que se ve.
 */
describe('Recorrido · atención', () => {
  beforeEach(() => {
    reiniciarContadores();
  });

  it('agenda con citas y cupos', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    const pantalla = { carpeta: '40-agenda', titulo: 'Agenda' };

    cy.visit('/agenda');
    esperarEstable();
    capturar(pantalla, 'citas de la ventana por defecto');

    // La pestaña de cupos: sin este clic, la mitad de la pantalla no queda en
    // la evidencia.
    cy.get('[role="tab"]').contains(/cupos/i).click();
    esperarEstable();
    capturar(pantalla, 'cupos disponibles');

    // Las tres ventanas, que es el único filtro que cambia qué se le pide al
    // backend. Se llega por la URL y no por el desplegable porque el valor que
    // viaja es la clave, no la etiqueta.
    for (const [rango, nombre] of [
      ['hoy', 'ventana de hoy'],
      ['mes', 'ventana de 30 días'],
    ] as const) {
      cy.visit(`/agenda?rango=${rango}`);
      esperarEstable();
      capturar(pantalla, nombre);
    }

    cy.visit('/agenda?canceladas=si');
    esperarEstable();
    capturar(pantalla, 'incluyendo canceladas');
  });

  it('agenda de una organización sin recursos', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] }, sinAgenda: true });
    iniciarSesionEnRecorrido();

    // El estado de un tenant recién creado. No se alcanza con datos cargados:
    // hay que pedirle a la API simulada que no devuelva ningún recurso.
    recorrer(
      { ruta: '/agenda', carpeta: '41-agenda-sin-recursos', titulo: 'Agenda · sin recursos' },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 20 },
    );
  });

  it('archivo clínico: elegir a quién se mira', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    recorrer(
      { ruta: '/clinico', carpeta: '42-archivo-clinico', titulo: 'Archivo clínico' },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 25 },
    );
  });

  it('expediente clínico, bloque por bloque', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] } });
    iniciarSesionEnRecorrido();

    const pantalla = { carpeta: '43-expediente', titulo: 'Expediente clínico' };

    cy.visit('/clinico/p-001');
    esperarEstable();
    capturar(pantalla, 'al entrar');

    /**
     * Cada pestaña, una por una.
     *
     * Se vuelve a consultar el DOM en cada vuelta en vez de guardar la lista:
     * activar una pestaña vuelve a pintar la barra, y los nodos de la consulta
     * anterior quedarían obsoletos.
     */
    cy.get('[role="tab"]').then(($pestanas) => {
      const rotulos = $pestanas.toArray().map((nodo) => (nodo.textContent ?? '').trim());
      rotulos.forEach((rotulo, indice) => {
        cy.get('[role="tab"]').eq(indice).click();
        esperarEstable();
        capturar(pantalla, rotulo === '' ? `bloque ${indice}` : rotulo);
      });
    });
  });

  it('expediente clínico sin ningún registro', () => {
    simularApiTotal({ claims: { ...CLAIMS_ADMIN, tenants: ['t-1'] }, sinExpediente: true });
    iniciarSesionEnRecorrido();

    // Los ocho bloques vacíos a la vez: es lo que ve quien abre el expediente de
    // alguien que todavía no fue atendido, y el vacío de un bloque clínico
    // ofrece salir, no cargar — la pantalla es de lectura.
    recorrer(
      {
        ruta: '/clinico/p-001',
        carpeta: '44-expediente-vacio',
        titulo: 'Expediente · sin registros',
      },
      { evitar: EVITAR_POR_DEFECTO, maxAcciones: 20 },
    );
  });
});
