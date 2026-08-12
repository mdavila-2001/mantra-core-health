import { anotarOmision, capturar, reiniciarContadores } from '../../support/recorrido/evidencia';
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
 * - **El ciclo retener → confirmar cierra desde la pantalla**, y el turno
 *   aparece después en «Tus turnos» con su estado en castellano.
 *
 * ## Por qué la reserva completa puede omitirse y no fallar
 *
 * Reservar exige que la organización tenga agenda publicada, y eso no lo puede
 * crear una prueba de interfaz sin mezclar dos responsabilidades: los datos los
 * siembra `yarn seed:dev` del backend. Cuando no hay agendas, el caso **anota la
 * omisión** en vez de fallar —un rojo ahí acusaría a la aplicación de algo que
 * es del entorno— y sigue comprobando lo que sí depende de la pantalla.
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

  it('elige agenda, retiene y confirma: el turno queda en su lista', () => {
    cy.then(() => entrar(paciente));
    irA('/mi-cuenta/turnos');
    estable();

    // Sin agenda publicada no hay nada que reservar; se deja constancia y se
    // corta, que es distinto de fallar.
    cy.get('body').then(($portal) => {
      if (/todav[íi]a no hay agendas publicadas/i.test($portal.text())) {
        anotarOmision(
          'Mis turnos · reserva',
          'La organización no tiene agendas publicadas: correr `yarn seed:dev` en el backend.',
        );
        return;
      }

      elegirLaPrimeraAgenda();

      cy.get('body').then(($conHorarios) => {
        if ($conHorarios.find('a:contains("Pedir este horario")').length === 0) {
          anotarOmision(
            'Mis turnos · reserva',
            'La agenda elegida no tiene horarios libres en las próximas dos semanas.',
          );
          return;
        }

        reservarElPrimerHorario();
        comprobarQueElTurnoQuedo();
      });
    });
  });

  /**
   * Elige una agenda cualquiera del desplegable.
   *
   * Se toma la primera opción real —saltando el `<option hidden>` que hace de
   * marcador— y no una por nombre: los nombres los siembra el backend y atarse
   * a uno haría fallar la prueba cada vez que cambien los datos de desarrollo.
   */
  function elegirLaPrimeraAgenda(): void {
    cy.get('app-select select').should('exist');
    cy.get('app-select select option:not([hidden])')
      .first()
      .then(($opcion) => {
        cy.get('app-select select').select(String($opcion.val()));
      });
    estable();
    capturar({ carpeta: 'turnos-04-horarios', titulo: 'Horarios libres' }, 'con-agenda');
  }

  /** Abre el primer horario libre y recorre el ciclo retener → confirmar. */
  function reservarElPrimerHorario(): void {
    cy.contains('a', 'Pedir este horario').first().click();
    estable();
    capturar({ carpeta: 'turnos-05-reserva', titulo: 'Reservar un turno' }, 'antes-de-retener');

    // La misma pantalla del mostrador, con la otra entrada: acá no se elige
    // paciente porque la sesión ya dice quién es.
    cy.contains(/buscá por nombre o por código de paciente/i).should('not.exist');
    cy.get('[data-testid="reserva-resumen"]').should('exist');

    cy.contains('button', 'Retener el cupo').click();
    estable();

    // El paso 2 se anuncia: el cupo está guardado y con hora de vencimiento.
    cy.contains(/cupo retenido/i).should('exist');
    capturar({ carpeta: 'turnos-06-retenido', titulo: 'Cupo retenido' }, 'antes-de-confirmar');

    cy.contains('button', 'Confirmar la reserva').click();
    estable();
  }

  /** Comprueba lo que ve el paciente al volver: su turno, dicho en castellano. */
  function comprobarQueElTurnoQuedo(): void {
    // Confirmar devuelve a «Mis turnos», y el vacío ya no está.
    cy.location('pathname').should('include', '/mi-cuenta/turnos');
    cy.contains(/todav[íi]a no ten[ée]s turnos|todav[íi]a no pediste/i).should('not.exist');

    // El estado sale de terminología y lo nombra la interfaz: si volviera el
    // `display` del catálogo, acá se leería «Booking confirmed».
    cy.get('app-badge').first().should('contain.text', 'Confirmado');
    capturar({ carpeta: 'turnos-07-confirmado', titulo: 'Turno confirmado' }, 'en-mis-turnos');
  }
});
