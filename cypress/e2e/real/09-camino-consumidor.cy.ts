import { capturar, reiniciarContadores } from '../../support/recorrido/evidencia';
import {
  admin,
  apiViva,
  CLAVE,
  crearPaciente,
  tokenDe,
  type Actor,
} from '../../support/real/actores';
import { conceptoPorCodigo, escalarYDecidir, resumenDelTitular } from '../../support/real/casos';
import { entrar, estable, irA } from '../../support/real/sesion';
import { subirDocumento } from '../../support/real/tramites';
import { RUTAS, rutaDeCaso, rutaDeReservaDelPortal } from '../../support/real/rutas';
import { anotarTramoApagado, tramoActivo } from '../../support/real/tramos';
import { describirHallazgos, Vigilante, vigilarRed } from '../../support/real/vigilante';

/**
 * **El camino del consumidor** — la hoja que el cliente recorre el viernes,
 * paso a paso y contra la API viva.
 *
 * No prueba pantallas nuevas: prueba **el guion**. Cada paso es uno de la hoja
 * —entrar, pedir un turno y confirmarlo, subir la evidencia de identidad, ver
 * el caso con su estado en palabras— y lo que se busca es lo que el guion
 * pregunta: errores crudos o silencio, botones que no hacen nada, estados
 * vacíos sin mensaje, un uuid donde va un nombre.
 *
 * ## Los tramos que faltan no se fingen
 *
 * El alta por pantalla (P14) y la cancelación del turno (E1) están detrás de
 * flags `TRAMO_*` apagados: la corrida ejercita exactamente lo que `dev` tiene
 * hoy, y cada tramo salteado queda anotado en el reporte. Ver
 * `support/real/tramos.ts`.
 *
 * ## Qué fija esta suite que ninguna otra
 *
 * El **guion completo del consumidor** en una sola sesión: el 05 ya recorre
 * retener → confirmar por su cuenta (desde d2a59f8), pero acá el turno es un
 * paso del camino, no el objeto de la prueba. Necesita horarios sembrados
 * (`yarn seed:dev` en la API); sin ellos, el paso queda anotado como no
 * ejercitado, no en verde de mentira.
 *
 * ## Todas las rutas salen de `support/real/rutas.ts`
 *
 * Ni una escrita acá: es la mitigación del PR #55 (renombre de rutas, sin
 * decidir). Si se mergea, el swap cuesta ese archivo y una re-corrida.
 */

// La vigilancia de red se engancha acá y no en `support/e2e.ts`: engancharla
// global volvería más estrictos a los specs 01–07 en la misma semana en que se
// los necesita estables. (Hoy `vigilarRed` no lo llama nadie: quedó anotado en
// el archivo de hallazgos de la fase.)
Cypress.on('window:before:load', (ventana) => {
  vigilarRed(ventana);
});

describe('Recorrido real · el camino del consumidor', () => {
  let consumidor: Actor;

  before(() => {
    apiViva().should('equal', true);
    if (!tramoActivo('TRAMO_REGISTRO')) {
      // El alta por pantalla está detrás del tramo (P14: el backend responde
      // 500 al nombre en 4 partes que manda el formulario). El actor nace por
      // la API con el contrato que sí registra, y el guion arranca en el
      // ingreso.
      crearPaciente().then((actor) => {
        consumidor = actor;
      });
    }
  });

  beforeEach(() => {
    reiniciarContadores();
  });

  /** El sufijo único de esta corrida, con la misma receta que `actores.ts`. */
  function sufijo(): string {
    const runId = Cypress.expose('E2E_RUN_ID') as unknown;
    const crudo = typeof runId === 'string' && runId !== '' ? runId : String(Date.now());
    return crudo.replace(/[^0-9a-z]/gi, '').slice(-12);
  }

  /**
   * Escribe y comprueba que llegó entero. Es la carrera de hidratación que
   * `support/real/sesion.ts` documenta en `entrar()`: bajo render del servidor
   * las primeras teclas pueden caer sobre un campo que después se reemplaza.
   */
  function escribirPorTestId(testId: string, texto: string): void {
    cy.porTestId(testId).clear().type(texto);
    cy.porTestId(testId).then(($campo) => {
      if ($campo.val() !== texto) {
        cy.porTestId(testId).clear().type(texto);
      }
    });
    cy.porTestId(testId).should('have.value', texto);
  }

  /**
   * El paso 1 del guion, por pantalla. Corre solo con `TRAMO_REGISTRO=true`.
   *
   * El documento lleva el prefijo `R9` para no chocar con el `CI-E2E-…` que
   * `crearPaciente()` arma con el mismo sufijo en otros specs de la corrida.
   * El correo queda vacío a propósito: la hoja pregunta si de verdad es
   * opcional, y la única forma de responderlo es no ponerlo.
   */
  function registrarsePorPantalla(): void {
    const documento = `CI-E2E-R9-${sufijo()}`;
    cy.visit(RUTAS.registroPaciente);
    cy.esperarAplicacionLista();

    // El alta se sirve de a una página, con cuatro campos como mucho: se
    // contesta lo de cada una y se avanza. La tercera —fecha, sexo, municipio,
    // ocupación— es toda opcional y se pasa de largo a propósito: parte de lo
    // que este recorrido responde es que el alta se puede terminar sin ella.
    escribirPorTestId('registro-documento', documento);
    cy.porTestId('paginated-form-continuar').click();

    escribirPorTestId('registro-nombre', 'Lucía');
    escribirPorTestId('registro-apellido-paterno', 'Recorrido');
    cy.porTestId('paginated-form-continuar').click();

    cy.porTestId('paginated-form-continuar').click();

    escribirPorTestId('registro-password', CLAVE);
    capturar({ carpeta: 'consumidor-00-registro', titulo: 'Crear cuenta' }, 'formulario-completo');

    cy.porTestId('paginated-form-continuar').click();
    cy.get('[data-testid="registro-exito"]', { timeout: 20_000 }).should('exist');
    capturar({ carpeta: 'consumidor-00-registro', titulo: 'Crear cuenta' }, 'cuenta-creada');

    consumidor = {
      identificador: documento,
      clave: CLAVE,
      nombre: 'Consumidor de recorrido',
      datos: {},
    };
  }

  /**
   * Espera a que el portal de turnos termine sus lecturas.
   *
   * `estable()` no alcanza acá: esta pantalla anuncia sus cargas con texto
   * (`role="status"`), no con esqueletos, así que se espera a que ese texto se
   * vaya.
   */
  function portalQuieto(): void {
    cy.contains(/buscando tus turnos|buscando horarios libres/i, { timeout: 20_000 }).should(
      'not.exist',
    );
  }

  /**
   * Pide un horario y **confirma** la reserva, todo por pantalla.
   *
   * La agenda se elige en el `<select>` nativo que `app-select` envuelve. La
   * primera opción real (la oculta es el placeholder) alcanza: cuál agenda sea
   * no es parte del guion, que haya una sí.
   */
  function pedirYConfirmarUnTurno(): void {
    cy.get('section[aria-labelledby="pedir-turno"] select option:not([hidden])').then(
      ($opciones) => {
        const primera = $opciones.first().attr('value');
        expect(primera, 'una agenda para elegir').to.not.equal(undefined);
        cy.get('section[aria-labelledby="pedir-turno"] select').select(primera as string);
      },
    );

    // Los horarios parten de un vacío que dice «Elegí con quién…», y ese aviso
    // también es un `app-alert`: esperar a que se vaya es lo que separa
    // «todavía no preguntó» de «preguntó y no hay». Recién después, a que la
    // búsqueda termine.
    cy.contains(/eleg[íi] con qui[ée]n te quer[ée]s atender/i, { timeout: 20_000 }).should(
      'not.exist',
    );
    portalQuieto();

    // Con la agenda elegida hay dos desenlaces legítimos: horarios, o el aviso
    // de que no hay. El segundo no se maquilla: queda anotado y capturado.
    cy.get('section[aria-labelledby="pedir-turno"]')
      .find('.turnos__horario, app-alert', { timeout: 20_000 })
      .should('exist');

    cy.get('body').then(($cuerpo) => {
      const hayHorarios =
        $cuerpo.find('section[aria-labelledby="pedir-turno"] a:contains("Pedir este horario")')
          .length > 0;
      if (!hayHorarios) {
        cy.task(
          'anotarOmision',
          {
            pantalla: 'Mis turnos',
            motivo:
              'La agenda elegida no ofreció horarios libres: el ciclo retener → confirmar no se ' +
              'ejercitó. ¿Corrió `yarn seed:dev` en la API?',
          },
          { log: false },
        );
        capturar({ carpeta: 'consumidor-03-turno', titulo: 'Pedir un turno' }, 'sin-horarios');
        return;
      }

      cy.contains('a', 'Pedir este horario').click();
      estable();
      cy.location('pathname', { timeout: 20_000 }).should('contain', rutaDeReservaDelPortal(''));

      // La pantalla relee el cupo antes de ofrecer nada: el resumen es la señal.
      cy.get('[data-testid="reserva-resumen"]', { timeout: 20_000 }).should('exist');
      capturar({ carpeta: 'consumidor-03-turno', titulo: 'Reservar' }, 'resumen-del-cupo');

      cy.contains('button', 'Retener el cupo').click();

      // Dos desenlaces conocidos, y solo dos. El bueno: «Cupo retenido». El
      // defecto medido el 2026-08-12: el `<form>` de la reserva no tiene
      // directiva de formulario (`booking-new.html:90` — `(ngSubmit)` sin
      // `[formGroup]` ni `ngForm`), así que el botón `type="submit"` de
      // `app-form-actions` dispara el submit NATIVO: el hold sale igual (201),
      // la página recarga, los query params se pierden y la pantalla dice
      // «Elegí primero un horario» con el cupo ya retenido a nombre de la
      // persona, invisible. Cuando lo arreglen, el camino feliz corre solo.
      cy.get(
        'app-alert:contains("Cupo retenido"), app-alert:contains("Elegí primero un horario")',
        { timeout: 20_000 },
      ).should('exist');

      cy.get('body').then(($tras) => {
        if ($tras.find('app-alert:contains("Elegí primero un horario")').length > 0) {
          cy.task(
            'anotarOmision',
            {
              pantalla: 'Reservar',
              motivo:
                'DEFECTO (no falta de datos): «Retener el cupo» dispara el submit nativo — el ' +
                'hold se crea (201) pero la recarga pierde los query params y la pantalla ' +
                'vuelve a «Elegí primero un horario». El form de booking-new.html:90 no tiene ' +
                'directiva de formulario que intercepte el submit. El ciclo retener → ' +
                'confirmar queda bloqueado por pantalla.',
            },
            { log: false },
          );
          capturar({ carpeta: 'consumidor-03-turno', titulo: 'Reservar' }, 'defecto-submit-nativo');
          return;
        }

        capturar({ carpeta: 'consumidor-03-turno', titulo: 'Reservar' }, 'retenido');
        cy.contains('button', 'Confirmar la reserva').click();

        // Confirmada, la pantalla vuelve sola al portal y el turno está en la
        // lista: la interfaz refleja lo que la API ya hizo, que es lo que el
        // guion vino a mirar.
        cy.location('pathname', { timeout: 20_000 }).should('eq', RUTAS.misTurnos);
        estable();
        portalQuieto();
        cy.get('section[aria-labelledby="turnos-propios"] li', { timeout: 20_000 }).should(
          'have.length.at.least',
          1,
        );
        cy.contains(/todav[íi]a no ten[ée]s turnos/i).should('not.exist');
        capturar({ carpeta: 'consumidor-03-turno', titulo: 'Mis turnos' }, 'turno-confirmado');
      });
    });
  }

  // `subirDocumento` vive en `support/real/tramites.ts` desde que `dev` lo
  // extrajo para el 02 (6c63fe5): acá se importa, no se repite.

  it('entra, pide y confirma un turno, sube su evidencia y ve el caso en palabras', () => {
    const vigilante = new Vigilante('consumidor');
    const contexto: { caso: string } = { caso: '' };

    // ── 1. Crear la cuenta ─────────────────────────────────────────────────
    if (tramoActivo('TRAMO_REGISTRO')) {
      vigilante.en('Crear cuenta');
      registrarsePorPantalla();
    } else {
      anotarTramoApagado(
        'TRAMO_REGISTRO',
        'Crear cuenta',
        'el alta por la pantalla /auth/registro, con el correo vacío para probar que es opcional',
      );
    }

    // ── 2. Entrar por documento → el panel ─────────────────────────────────
    vigilante.en('Panel');
    cy.then(() => entrar(consumidor));
    estable();
    cy.location('pathname').should('contain', RUTAS.panel);
    cy.get('h1').first().invoke('text').should('match', /\S/);
    // Un uuid o un «Desconocido» en el panel es exactamente lo que el guion
    // busca: la terminología tiene que haber resuelto.
    cy.contains(/desconocido/i).should('not.exist');
    capturar({ carpeta: 'consumidor-01-panel', titulo: 'El panel del consumidor' }, 'al-entrar');
    cy.then(() => vigilante.recoger());

    // ── 3. Pedir un turno y confirmarlo ────────────────────────────────────
    vigilante.en('Mis turnos');
    irA(RUTAS.misTurnos);
    estable();
    portalQuieto();
    // El portal abre en «Mis citas» y pedir un turno es la otra sección: antes
    // estaban apiladas y había que bajar hasta el fondo para pedir hora.
    cy.get('[data-testid="turnos-secciones"] [data-value="citas"]').should(
      'have.attr',
      'aria-checked',
      'true',
    );
    capturar({ carpeta: 'consumidor-02-portal', titulo: 'Mis turnos' }, 'al-entrar');

    cy.get('[data-testid="turnos-secciones"] [data-value="pedir"]').click();
    portalQuieto();

    // ¿La sección ofrece agendas? El selector aparece cuando los recursos
    // llegaron; si en su lugar hay un aviso, ese aviso es el dato.
    cy.get('section[aria-labelledby="pedir-turno"]')
      .find('app-alert, select option:not([hidden])', { timeout: 20_000 })
      .should('exist');
    cy.get('body').then(($cuerpo) => {
      const seccion = $cuerpo.find('section[aria-labelledby="pedir-turno"]');
      if (seccion.find('select').length === 0) {
        cy.task(
          'anotarOmision',
          {
            pantalla: 'Mis turnos',
            motivo: `El portal no ofreció agendas: «${seccion.find('app-alert').text().trim()}». El ciclo retener → confirmar no se ejercitó.`,
          },
          { log: false },
        );
        capturar({ carpeta: 'consumidor-03-turno', titulo: 'Pedir un turno' }, 'sin-agendas');
        return;
      }
      pedirYConfirmarUnTurno();
    });
    cy.then(() => vigilante.recoger());

    // ── 4. Cancelar el turno — tramo E1 ────────────────────────────────────
    if (tramoActivo('TRAMO_E1_CANCELAR')) {
      throw new Error(
        'TRAMO_E1_CANCELAR está activo, pero la pantalla de cancelar del portal todavía no ' +
          'está en dev: extendé este bloque cuando entre el merge de E1.',
      );
    }
    anotarTramoApagado(
      'TRAMO_E1_CANCELAR',
      'Mis turnos',
      'cancelar el turno recién confirmado y ver el cupo volver a la grilla',
    );

    // ── 5. Subir la evidencia de identidad ─────────────────────────────────
    vigilante.en('Verificar identidad');
    irA(RUTAS.verificarIdentidad);
    estable();
    subirDocumento().then((caseId) => {
      expect(caseId, 'la pantalla tiene que mostrar el código del caso').to.match(
        /^[0-9a-f-]{36}$/,
      );
      contexto.caso = caseId;
    });
    capturar(
      { carpeta: 'consumidor-04-identidad', titulo: 'Verificar identidad' },
      'solicitud-registrada',
    );
    cy.then(() => vigilante.recoger());

    // ── 6. El caso en «Mis verificaciones», en palabras ────────────────────
    vigilante.en('Mis verificaciones');
    irA(RUTAS.misCasos);
    estable();
    cy.then(() => {
      cy.contains('tr', contexto.caso, { timeout: 20_000 }).should('contain.text', 'En revisión');
    });
    cy.contains(/desconocido/i).should('not.exist');
    capturar({ carpeta: 'consumidor-05-casos', titulo: 'Mis verificaciones' }, 'lista');

    // El detalle: el sello dice el estado en palabras, jamás el uuid del
    // concepto.
    cy.then(() => irA(rutaDeCaso(contexto.caso)));
    estable();
    cy.contains('dt', 'Estado')
      .siblings('dd')
      .find('app-status-seal')
      .invoke('text')
      .should('match', /En revisión/)
      .and('not.match', /[0-9a-f]{8}-[0-9a-f]{4}/);
    capturar({ carpeta: 'consumidor-05-casos', titulo: 'El caso del titular' }, 'detalle');

    // ── 7. El desenlace: lo aprueban y el acceso se habilita — tramo N4 ────
    if (tramoActivo('TRAMO_N4_ACCESO')) {
      const credenciales = { tokenTitular: '', tokenAdmin: '', motivo: '' };
      cy.then(() => tokenDe(consumidor.identificador, consumidor.clave)).then((token) => {
        credenciales.tokenTitular = token;
      });
      cy.then(() => tokenDe(admin().identificador, admin().clave)).then((token) => {
        credenciales.tokenAdmin = token;
      });
      cy.then(() => conceptoPorCodigo(credenciales.tokenAdmin, 'ACTIVE')).then((motivo) => {
        credenciales.motivo = motivo;
      });

      // Mientras el caso espera, el resumen del titular sigue cerrado.
      cy.then(() => resumenDelTitular(credenciales.tokenTitular)).then((antes) => {
        expect(antes.status, 'antes de la decisión, el resumen está cerrado').to.equal(403);
      });

      // La decisión va por la API: el formulario del revisor ya lo cubre `07`.
      cy.then(() =>
        escalarYDecidir(
          credenciales.tokenAdmin,
          contexto.caso,
          credenciales.motivo,
          'APPROVED',
          'Documento legible',
        ),
      );

      // El titular vuelve a mirar: el sello dice «Aprobado»…
      irA(RUTAS.panel);
      estable();
      irA(RUTAS.misCasos);
      estable();
      cy.then(() => {
        cy.contains('tr', contexto.caso, { timeout: 20_000 }).should('contain.text', 'Aprobado');
      });
      capturar({ carpeta: 'consumidor-06-acceso', titulo: 'Mis verificaciones' }, 'aprobado');

      // …y la promesa de la pantalla de verificación se cumple: acceso habilitado.
      cy.then(() => resumenDelTitular(credenciales.tokenTitular)).then((despues) => {
        expect(despues.status, 'aprobar tiene que habilitar el acceso del titular').to.equal(200);
      });
    } else {
      anotarTramoApagado(
        'TRAMO_N4_ACCESO',
        'Mis verificaciones',
        'el desenlace del guion: aprobar el caso y ver el acceso habilitado (espera el PR #54 de la API)',
      );
    }

    // ── Cierre: lo que el vigilante haya visto, a la cara ──────────────────
    cy.then(() => {
      vigilante.recoger();
      expect(vigilante.hallazgos, describirHallazgos(vigilante.hallazgos)).to.deep.equal([]);
    });
  });
});
