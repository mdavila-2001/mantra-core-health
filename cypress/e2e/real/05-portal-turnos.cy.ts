import { capturar, reiniciarContadores } from '../../support/recorrido/evidencia';
import { apiViva, crearPaciente, type Actor } from '../../support/real/actores';
import { entrar, estable, irA } from '../../support/real/sesion';

/**
 * **Portal de turnos** — el paciente pide un turno para sí mismo.
 *
 * Es el Acto 2 del recorrido de demo, y hasta ahora no existía: el paciente
 * podía registrarse y entrar, pero no había ninguna pantalla donde pedir hora.
 *
 * Lo que esta prueba fija y ninguna otra cubre:
 *
 * - **La sección «Mis turnos» le aparece.** Va sin `roles` en el mapa de
 *   navegación a propósito —el filtro real es tener perfil de paciente, que es
 *   un dato de la cuenta y no un rol—, así que si alguien le pusiera `roles`
 *   por costumbre, el paciente dejaría de verla y esto lo detecta.
 * - **La reserva es la MISMA pantalla del mostrador con la otra entrada.** Se
 *   comprueba por lo que se ve: entrando por el portal no hay buscador de
 *   paciente, porque ya se sabe quién es.
 * - **Sin agendas cargadas la pantalla lo dice.** Un portal que se queda mudo
 *   cuando la organización no publicó horarios se lee como un portal roto.
 *
 * No confirma la reserva: eso exige una agenda sembrada, y sembrarla desde una
 * prueba de interfaz mezclaría dos responsabilidades. El ciclo completo
 * hold → confirm está verificado contra la API.
 */
describe('Recorrido real · portal de turnos del paciente', () => {
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

  it('ve su sección de turnos y llega a la pantalla de pedir uno', () => {
    cy.then(() => entrar(paciente));
    estable();

    /* -- La sección existe para él ---------------------------------------- */

    cy.get('nav').contains(/mis turnos/i).should('exist');
    capturar({ carpeta: 'turnos-01-menu', titulo: 'El menú del paciente' }, 'con-turnos');

    /* -- La pantalla del portal ------------------------------------------- */

    irA('/mi-cuenta/turnos');
    estable();
    capturar({ carpeta: 'turnos-02-portal', titulo: 'Mis turnos' }, 'al-entrar');

    cy.get('h1').first().invoke('text').should('match', /\S/);
    // Los dos bloques que responden las dos preguntas de quien entra.
    cy.contains(/tus turnos/i).should('exist');
    cy.contains(/pedir un turno/i).should('exist');

    // Recién registrado no tiene ninguno, y el vacío lo dice en vez de quedar
    // en blanco.
    cy.contains(/todav[íi]a no ten[ée]s turnos|todav[íi]a no pediste/i).should('exist');

    /* -- La reserva sin contexto explica cómo se llega -------------------- */

    irA('/mi-cuenta/turnos/reservar/00000000-0000-0000-0000-000000000000');
    estable();
    capturar({ carpeta: 'turnos-03-reserva', titulo: 'Reserva sin horario' }, 'sin-contexto');

    // Entrando sin la franja en la URL, la pantalla manda de vuelta a elegir un
    // horario en lugar de mostrar un formulario que no puede completarse.
    cy.contains(/eleg[íi] primero un horario/i).should('exist');
    // Y por el portal jamás se pide elegir paciente: ya se sabe quién es.
    cy.contains(/buscá por nombre o por código de paciente/i).should('not.exist');
  });
});
