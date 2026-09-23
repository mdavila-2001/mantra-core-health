import { ESCENARIO_POR_DEFECTO, type NombreEscenario } from '../fixtures/escenarios';

/**
 * Panel (`/dashboard`), la primera pantalla con sesión.
 *
 * ## Qué cambió el 19/09/2026
 *
 * El panel abría con cuatro bloques de sistema —«Tu cuenta» con los roles del
 * token, el conteo del directorio público, y las cifras de secciones y de
 * organizaciones— y el propietario los mandó sacar: ninguno contestaba la
 * pregunta con la que se abre un panel a las siete de la mañana. En su lugar
 * está «Lo que toca hoy», la jornada de quien atiende.
 *
 * Esto se llevó puestos los ayudantes del directorio y de las insignias de rol,
 * y con ellos la regresión `panel-directorio.cy.ts`: una prueba de una tarjeta
 * que ya no existe no es cobertura, es ruido. Los nueve estados que aquella
 * comprobaba viven ahora en las pruebas de `agenda-de-hoy` y en las del propio
 * `view-state-host`.
 *
 * El ancla de «el panel de trabajo cargó» pasó a ser «Tus accesos», que es el
 * único bloque que ven TODOS los roles de trabajo: la jornada sólo la ve quien
 * tiene perfil profesional, y el listado de pacientes, quien administra.
 */
/** Fuera del objeto para que el valor por defecto de `abrir` no se autorreferencie. */
const RUTA = '/dashboard';

export const DashboardPage = {
  ruta: RUTA,

  abrir(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO, ruta = RUTA): void {
    cy.abrirEscenario(escenario, ruta);
  },

  /**
   * El panel de la ORGANIZACIÓN cargó.
   *
   * Desde que «Mi salud» existe, `/dashboard` dibuja dos pantallas distintas
   * según el rol: quien trabaja ve este panel y quien viene a atenderse ve el
   * suyo. Esto afirma el de la organización, así que la sesión de la prueba
   * tiene que ser de trabajo — si no, lo que se dibuja es el otro.
   */
  esperarCargada(): void {
    cy.porTestId('panel-accesos').should('be.visible');
  },

  /** El panel del PACIENTE cargó — «Mi salud». */
  esperarPanelDelPaciente(): void {
    cy.porTestId('mi-salud').should('be.visible');
  },

  /**
   * Llegó al panel, sea el que sea.
   *
   * Lo usa el ingreso, que no sabe con qué rol entra la prueba: lo que le
   * importa es que la sesión terminó en una pantalla con contenido y no en un
   * blanco.
   */
  esperarAlgunPanel(): void {
    cy.get('[data-testid="panel-accesos"], [data-testid="mi-salud"]').should('be.visible');
  },

  /** Afirma el encabezado de la pantalla. */
  esperarTitulo(titulo: string): void {
    cy.get('h1').should('have.text', titulo);
  },

  /** La franja «Lo que toca hoy» está a la vista. Sólo la ve quien atiende. */
  esperarJornada(): void {
    cy.porTestId('panel-hoy').should('be.visible');
  },

  /** A esta sesión no le corresponde jornada: no se le dibuja una franja vacía. */
  sinJornada(): void {
    cy.porTestId('panel-hoy').should('not.exist');
  },

  /**
   * Espera a que el esqueleto de la jornada se vaya.
   *
   * Es la afirmación que importa: un estado de carga que **no se resuelve** es
   * el defecto de verdad. Preguntarlo sin esperar mide el instante equivocado
   * —a veces antes de que la petición salga siquiera— y falla o pasa por azar.
   */
  esperarSinEsqueleto(): void {
    cy.get('[data-testid="panel-hoy"] .hoy__esqueleto').should('not.exist');
  },
};
