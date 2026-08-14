import { capturar, reiniciarContadores } from '../../support/recorrido/evidencia';
import { admin, apiViva, crearMedico, type Actor } from '../../support/real/actores';
import { aparece, entrar, estable, irA } from '../../support/real/sesion';
import { RUTAS } from '../../support/real/rutas';
import { anotarTramoApagado, tramoActivo } from '../../support/real/tramos';
import { describirHallazgos, Vigilante, vigilarRed } from '../../support/real/vigilante';

/**
 * **El camino del médico** — la hoja del doctor del viernes, contra la API
 * viva: la agenda de hoy, la llegada del primer turno, el expediente con sus
 * bloques, y el encuentro que se abre y se cierra.
 *
 * ## Por qué dos pruebas y dos actores
 *
 * Un médico **recién registrado no pertenece a ninguna organización**, y la
 * agenda se lo dice como paso pendiente, no como error. Eso es configuración
 * de la cuenta —las cuentas del viernes las prepara J3—, así que la primera
 * prueba fija esa honestidad y no la pelea. El guion con datos corre con la
 * cuenta de administración, que es la que hoy tiene la organización sembrada
 * (`yarn seed:dev` crea los perfiles y la agenda bajo su organización); lo que
 * se está probando son las **pantallas del guion**, no el rol.
 *
 * ## Los pasos que dependen de datos no se fingen
 *
 * Registrar llegada necesita una cita de hoy sin marcar; abrir el expediente,
 * una cita que lo ofrezca. Si el dato no está, el paso queda **anotado en el
 * reporte** y la suite sigue con lo que pueda — el patrón `aparece()` del
 * repo. Los formularios clínicos (M1) y la receta (P1) esperan merges ajenos
 * detrás de sus flags `TRAMO_*`.
 *
 * ## Todas las rutas salen de `support/real/rutas.ts`
 *
 * Ni una escrita acá: es la mitigación del PR #55 (renombre de rutas, sin
 * decidir).
 */

// Igual que en el 09: la vigilancia de red se engancha localmente para no
// volver más estrictos a los specs 01–07 (hoy `vigilarRed` no lo llama nadie).
Cypress.on('window:before:load', (ventana) => {
  vigilarRed(ventana);
});

describe('Recorrido real · el camino del médico', () => {
  let medico: Actor;

  /** Quien hoy tiene organización activa y la agenda sembrada. */
  const operador: Actor = { ...admin(), nombre: 'Administrador', datos: {} };

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
   * Va a la agenda de hoy y **comprueba que llegó**.
   *
   * El primer `pushState` después del login puede perderse: el router todavía
   * está terminando la redirección al panel y la navegación queda superada. Es
   * la misma familia de carreras que `entrar()` documenta, con el mismo
   * remedio: comprobar y rehacer una vez. La aserción final del `h1` es lo que
   * convierte un «me quedé en el panel» en un fallo que se ve, no en una
   * corrida hueca.
   */
  function irALaAgendaDeHoy(): void {
    irA(RUTAS.agendaDeHoy);
    estable();
    cy.get('body').then(($cuerpo) => {
      if ($cuerpo.find('h1:contains("Agenda")').length === 0) {
        irA(RUTAS.agendaDeHoy);
        estable();
      }
    });
    cy.contains('h1', 'Agenda', { timeout: 20_000 }).should('exist');
  }

  /**
   * Recorre los recursos de la agenda hasta encontrar uno con una cita de hoy
   * **confirmada y sin llegada**, y ahí ejecuta la acción.
   *
   * Las citas se listan por recurso —el backend no admite pedirlas todas
   * juntas— así que «la agenda de hoy» del guion puede vivir en cualquiera de
   * las agendas sembradas. Se prefiere una fila confirmada porque el check-in
   * de una cita cancelada o atendida no es el gesto del guion. Si ningún
   * recurso tiene una, la omisión queda anotada: es el estado de los datos, no
   * un fallo de la pantalla.
   */
  function conCitaAccionable(accion: () => void): void {
    // La agenda elige sola un recurso al cargar, y el rótulo de la pestaña
    // gana el conteo — «Citas (N)» — recién cuando la consulta terminó: esa es
    // la señal de que las filas que se miran son las de verdad, no el
    // esqueleto ni la tabla del render anterior.
    cy.contains('[role="tab"]', /citas \(\d+\)/i, { timeout: 20_000 }).should('exist');
    cy.get('body').then(($cuerpo) => {
      if (filaAccionable($cuerpo).length > 0) {
        accion();
        return;
      }
      // El recurso auto-elegido no tenía: probar los demás. Se arranca en 1
      // porque volver a elegir la opción ya seleccionada no dispara `change`.
      cy.get('.agenda__filtros select')
        .first()
        .find('option:not([hidden])')
        .then(($opciones) => {
          probarRecurso($opciones.length, 1, accion);
        });
    });
  }

  function filaAccionable($cuerpo: JQuery<HTMLElement>): JQuery<HTMLElement> {
    return $cuerpo.find('tr').filter((_, fila) => {
      const texto = fila.textContent ?? '';
      // «Booking confirmed» es lo que el catálogo muestra hoy (2026-08-12):
      // inglés técnico delante del cliente — anotado como hallazgo del guion.
      // Se acepta también «Confirmada» para que el arreglo del catálogo no
      // rompa esta suite.
      return (
        /booking confirmed|confirmada/i.test(texto) &&
        Cypress.$(fila).find('button:contains("Registrar llegada")').length > 0
      );
    });
  }

  function probarRecurso(total: number, indice: number, accion: () => void): void {
    if (indice >= total) {
      cy.task(
        'anotarOmision',
        {
          pantalla: 'Agenda de hoy',
          motivo:
            'Ningún recurso tenía hoy una cita confirmada sin llegada: el check-in no se ' +
            'ejercitó. ¿Corrió `yarn seed:dev`? ¿Las corridas anteriores ya marcaron todas?',
        },
        { log: false },
      );
      return;
    }

    // Los `<option>` del `app-select` llevan el índice, no el id del recurso:
    // el id real solo se ve cuando la pantalla lo publica en la URL. Verla
    // cambiar es saber que la agenda ya consulta el recurso elegido, pero las
    // filas del recurso anterior siguen pintadas mientras llega la respuesta:
    // el espía de red —observa el tráfico real, no lo reemplaza— es lo que
    // dice cuándo la tabla que se mira es la del recurso nuevo.
    cy.intercept({ method: 'GET', url: '**/scheduling/bookings*' }).as('citasDelRecurso');
    cy.location('search').then((busquedaAnterior) => {
      cy.get('.agenda__filtros select').first().select(String(indice));
      cy.location('search', { timeout: 20_000 }).should((busquedaActual) => {
        expect(busquedaActual).to.match(/recurso=/);
        expect(busquedaActual).to.not.equal(busquedaAnterior);
      });
      // La respuesta esperada es LA de este recurso: su id viaja en `recurso=`
      // y la consulta lo repite. Un cruce con una respuesta rezagada del
      // recurso anterior falla acá, a la vista, en vez de decidir la rama con
      // la tabla vieja.
      cy.location('search').then((busqueda) => {
        const idRecurso = new URLSearchParams(busqueda).get('recurso') ?? '';
        cy.wait('@citasDelRecurso', { timeout: 20_000 })
          .its('request.url')
          .should('include', idRecurso);
      });
      estable();
      cy.get('body').then(($cuerpo) => {
        if (filaAccionable($cuerpo).length > 0) {
          accion();
        } else {
          probarRecurso(total, indice + 1, accion);
        }
      });
    });
  }

  /**
   * Registra la llegada de una cita confirmada y comprueba que la fila cambia
   * el botón por la palabra — la pantalla refleja lo que la API ya hizo, sin
   * recargar a mano. El conteo se toma antes porque las corridas anteriores
   * dejan sus propias llegadas marcadas.
   */
  function registrarLlegada(): void {
    cy.get('body').then(($cuerpo) => {
      const llegadasAntes = $cuerpo.find('tr:contains("Llegó")').length;
      cy.wrap(filaAccionable($cuerpo).first())
        .contains('button', 'Registrar llegada')
        .click();
      estable();
      cy.get('tr:contains("Llegó")', { timeout: 20_000 }).should(
        'have.length',
        llegadasAntes + 1,
      );
      capturar({ carpeta: 'medico-04-llegada', titulo: 'Llegada registrada' }, 'llego');
    });
  }

  /**
   * Abre y cierra un encuentro en el expediente.
   *
   * Es la única escritura de la pantalla, y el ciclo completo es el paso final
   * de la hoja del doctor. El conteo de «en curso» se toma antes para que las
   * corridas anteriores —o un encuentro que otro dejó abierto— no confundan la
   * aserción.
   */
  function cicloDeEncuentro(): void {
    cy.contains('h2', 'Encuentro').should('exist');
    cy.get('body').then(($cuerpo) => {
      if ($cuerpo.find('form.expediente__registro').length === 0) {
        cy.task(
          'anotarOmision',
          {
            pantalla: 'Expediente',
            motivo:
              'El registro de encuentro no estaba disponible (la pantalla pide elegir una ' +
              'organización): abrir y cerrar el encuentro no se ejercitó.',
          },
          { log: false },
        );
        return;
      }

      const enCursoAntes = $cuerpo.find('[data-testid="encuentros-en-curso"] li').length;

      // El motivo no se escribe: llegar desde la agenda lo trae puesto —la
      // pantalla lo avisa con «Se registra sobre el turno de la agenda»— y ese
      // es exactamente el gesto del guion: leer la historia y registrar.
      cy.contains('button', 'Registrar encuentro').click();
      estable();

      cy.get('body').then(($tras) => {
        const rechazo = $tras.find('[data-testid="encuentro-error"]');
        if (rechazo.length > 0) {
          cy.task(
            'anotarOmision',
            {
              pantalla: 'Expediente',
              motivo: `Registrar el encuentro falló: «${rechazo.text().trim()}». El ciclo abrir → cerrar no se ejercitó.`,
            },
            { log: false },
          );
          capturar({ carpeta: 'medico-06-encuentro', titulo: 'Encuentro' }, 'rechazado');
          return;
        }

        cy.get('[data-testid="encuentros-en-curso"] li', { timeout: 20_000 }).should(
          'have.length',
          enCursoAntes + 1,
        );
        capturar({ carpeta: 'medico-06-encuentro', titulo: 'Encuentro' }, 'abierto');

        cy.contains('button', 'Cerrar').click();
        // Cerrar es destructivo —«un encuentro cerrado no se puede volver a
        // abrir»— y el sistema pide confirmación explícita en un diálogo.
        cy.contains('button', 'Cerrar encuentro', { timeout: 10_000 }).click();
        estable();
        if (enCursoAntes === 0) {
          cy.get('[data-testid="encuentros-en-curso"]', { timeout: 20_000 }).should('not.exist');
        } else {
          cy.get('[data-testid="encuentros-en-curso"] li', { timeout: 20_000 }).should(
            'have.length',
            enCursoAntes,
          );
        }
        capturar({ carpeta: 'medico-06-encuentro', titulo: 'Encuentro' }, 'cerrado');
      });
    });
  }

  /**
   * Del turno de la agenda al expediente de esa persona, por el enlace de la
   * fila. Adentro: los bloques de la historia y el ciclo del encuentro.
   */
  function abrirExpedienteDesdeLaAgenda(vigilante: Vigilante): void {
    cy.get('body').then(($cuerpo) => {
      if ($cuerpo.find('a:contains("Abrir expediente")').length === 0) {
        cy.task(
          'anotarOmision',
          {
            pantalla: 'Agenda de hoy',
            motivo:
              'Ninguna cita ofreció «Abrir expediente» a esta sesión: la ficha no se abrió ' +
              'desde la agenda.',
          },
          { log: false },
        );
        return;
      }

      vigilante.en('Expediente');
      cy.contains('a', 'Abrir expediente').click();
      estable();
      cy.location('pathname', { timeout: 20_000 }).should(
        'contain',
        `${RUTAS.archivoClinico}/`,
      );
      capturar(
        { carpeta: 'medico-05-expediente', titulo: 'Expediente desde la agenda' },
        'al-entrar',
      );

      // Los ocho bloques de la historia, cada uno con su pestaña. Si la
      // lectura cayó a un estado de error, la ausencia queda anotada.
      aparece('[role="tab"]', 'Expediente', 'las pestañas de los bloques del expediente').then(
        (hayBloques) => {
          if (!hayBloques) {
            return;
          }
          cy.get('[role="tab"]').should('have.length', 8);
          capturar({ carpeta: 'medico-05-expediente', titulo: 'Expediente' }, 'bloques');
        },
      );

      cicloDeEncuentro();
    });
  }

  it('un médico recién registrado ve una agenda honesta: sin rol de agenda, no hay error crudo', () => {
    const vigilante = new Vigilante('medico');

    cy.then(() => entrar(medico));
    estable();
    capturar({ carpeta: 'medico-01-panel', titulo: 'El panel del médico' }, 'al-entrar');

    vigilante.en('Agenda de hoy');
    irALaAgendaDeHoy();
    // Medido el 2026-08-12: el médico recién registrado cae en la organización
    // por defecto pero **sin rol de agenda**, y la pantalla separa «no hay» de
    // «no podés ver» (S3 vs S5): dice «No tenés acceso a esta sección · Rol
    // insuficiente», no un error crudo ni una lista vacía mentirosa. Es
    // configuración de la cuenta — las del viernes las prepara J3 — así que se
    // anota y no se pelea.
    cy.contains(/no ten[ée]s acceso a esta secci[óo]n/i, { timeout: 20_000 }).should('exist');
    cy.contains(/rol insuficiente/i).should('exist');
    cy.task(
      'anotarOmision',
      {
        pantalla: 'Agenda de hoy',
        motivo:
          'El médico recién registrado no tiene rol de agenda en la organización por defecto: ' +
          'la pantalla responde con su estado S5. El guion del viernes necesita las cuentas ' +
          'habilitadas de J3.',
      },
      { log: false },
    );
    capturar({ carpeta: 'medico-02-agenda', titulo: 'Agenda sin rol' }, 'honesta');

    cy.then(() => {
      vigilante.recoger();
      expect(vigilante.hallazgos, describirHallazgos(vigilante.hallazgos)).to.deep.equal([]);
    });
  });

  it('la agenda de hoy con datos: llegada, expediente y encuentro', () => {
    const vigilante = new Vigilante('operador');

    cy.then(() => entrar(operador));
    estable();

    // ── La agenda de hoy ───────────────────────────────────────────────────
    vigilante.en('Agenda de hoy');
    irALaAgendaDeHoy();
    capturar({ carpeta: 'medico-03-agenda-hoy', titulo: 'Agenda de hoy' }, 'al-entrar');

    // ── Con una cita accionable: la llegada y el expediente ────────────────
    conCitaAccionable(() => {
      registrarLlegada();
      abrirExpedienteDesdeLaAgenda(vigilante);
    });

    // ── Diagnóstico y observación — tramo M1 ───────────────────────────────
    if (tramoActivo('TRAMO_M1_CLINICA')) {
      throw new Error(
        'TRAMO_M1_CLINICA está activo, pero los formularios clínicos todavía no están en dev: ' +
          'extendé este bloque cuando entre el merge de M1.',
      );
    }
    anotarTramoApagado(
      'TRAMO_M1_CLINICA',
      'Expediente',
      'registrar un diagnóstico y una observación y verlos aparecer sin recargar a mano',
    );

    // ── La receta — tramo P1 ───────────────────────────────────────────────
    if (tramoActivo('TRAMO_P1_RECETA')) {
      throw new Error(
        'TRAMO_P1_RECETA está activo, pero el flujo de receta todavía no está en dev: ' +
          'extendé este bloque cuando entre el merge de P1.',
      );
    }
    anotarTramoApagado(
      'TRAMO_P1_RECETA',
      'Expediente',
      'crear, firmar y emitir la receta — y el aviso amable del 422 al emitir sin firmar',
    );

    // ── Cierre: lo que el vigilante haya visto, a la cara ──────────────────
    cy.then(() => {
      vigilante.recoger();
      expect(vigilante.hallazgos, describirHallazgos(vigilante.hallazgos)).to.deep.equal([]);
    });
  });
});
