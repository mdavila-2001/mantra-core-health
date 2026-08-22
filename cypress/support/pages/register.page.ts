import { ESCENARIO_POR_DEFECTO, type NombreEscenario } from '../fixtures/escenarios';
import type { AltaPaciente } from '../fixtures/usuarios';

/**
 * Alta de cuenta.
 *
 * Son **dos pantallas**, no una con un selector adentro: `/auth/register` es
 * una rejilla de tipos de cuenta y cada alta vive en su propia URL. El
 * contrato de cada una es distinto —el paciente entra con su documento y el
 * correo es opcional; el profesional entra con su correo y necesita matrícula
 * y credencial—, así que cambiar de tipo es navegar, no clicar una pestaña.
 *
 * ## Se contesta de a una página
 *
 * El formulario lo sirve `app-paginated-form`: cuatro campos como mucho por
 * página, con su barra de avance. Completar el alta es entonces escribir lo de
 * la página y tocar «Siguiente», hasta que el botón dice «Crear cuenta». Los
 * `data-testid` de los campos son los de siempre; los de la navegación son del
 * motor (`paginated-form-continuar`, `paginated-form-atras`), y por eso están
 * en un solo sitio: acá.
 */
export const RegisterPage = {
  ruta: '/auth/register',
  rutaPaciente: '/auth/register/patient',
  rutaProfesional: '/auth/register/practitioner',

  abrir(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    cy.abrirEscenario(escenario, RegisterPage.ruta);
    RegisterPage.esperarCargada();
  },

  /** La rejilla de tipos de cuenta, que es lo que hay en `/auth/register`. */
  esperarCargada(): void {
    cy.porTestId('tipo-paciente').should('be.visible');
  },

  /**
   * La rejilla y, desde ahí, el alta de paciente.
   *
   * Se entra clicando la tarjeta y no visitando la URL directamente: el enlace
   * de la rejilla es parte de lo que hay que probar — es la única forma que
   * tiene alguien de llegar a esta pantalla.
   */
  abrirPaciente(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    RegisterPage.abrir(escenario);
    RegisterPage.elegirPaciente();
  },

  elegirProfesional(): void {
    cy.porTestId('tipo-profesional').click();
    cy.porTestId('registro-form-profesional').should('be.visible');
  },

  elegirPaciente(): void {
    cy.porTestId('tipo-paciente').click();
    cy.porTestId('registro-form-paciente').should('be.visible');
  },

  /** El botón que avanza de página, y que en la última envía. */
  continuar(): void {
    cy.porTestId('paginated-form-continuar').click();
  },

  volver(): void {
    cy.porTestId('paginated-form-atras').click();
  },

  /**
   * Las cuatro páginas del alta de paciente, en orden.
   *
   * El nombre va en cuatro campos: dos obligatorios y dos que mucha gente no
   * tiene. Se completan los cuatro para ejercitar el camino completo; el de los
   * opcionales vacíos lo cubre la prueba de la API.
   *
   * La tercera página —fecha, sexo, municipio, ocupación— es toda opcional y se
   * pasa de largo: lo que prueba este recorrido es que el alta se puede
   * terminar sin ella.
   */
  completarPaciente(datos: AltaPaciente, opciones: { conCorreo?: boolean } = {}): void {
    cy.porTestId('registro-documento').clear().type(datos.documento);
    RegisterPage.continuar();

    cy.porTestId('registro-nombre').clear().type(datos.nombre);
    cy.porTestId('registro-segundo-nombre').clear().type(datos.segundoNombre);
    cy.porTestId('registro-apellido-paterno').clear().type(datos.apellidoPaterno);
    cy.porTestId('registro-apellido-materno').clear().type(datos.apellidoMaterno);
    RegisterPage.continuar();

    RegisterPage.continuar();

    cy.porTestId('registro-password').clear().type(datos.password);
    if (opciones.conCorreo === true) {
      cy.porTestId('registro-correo').clear().type(datos.correo);
    }
  },

  /** El botón de la última página. Ver `continuar`. */
  enviarFormulario(): void {
    RegisterPage.continuar();
  },

  /** El camino feliz completo. */
  registrarPaciente(datos: AltaPaciente, opciones: { conCorreo?: boolean } = {}): void {
    RegisterPage.completarPaciente(datos, opciones);
    RegisterPage.enviarFormulario();
  },

  esperarConfirmacion(): Cypress.Chainable<string> {
    return cy.porTestId('registro-exito').invoke('text').should('match', /\S/);
  },

  esperarError(): Cypress.Chainable<string> {
    return cy.porTestId('registro-error').invoke('text').should('match', /\S/);
  },

  sinError(): void {
    cy.porTestId('registro-error').should('not.exist');
  },

  /**
   * Mensajes de campo obligatorio que la pantalla muestra al intentar avanzar.
   *
   * Son los de **la página en la que se está**: el motor no marca lo que la
   * persona todavía no vio, así que pedir tres de una vez ya no tiene sentido —
   * lo que hay es el error del campo que falta acá.
   */
  mensajesDeValidacion(minimo = 1): Cypress.Chainable<string[]> {
    return cy
      .get('.form-field-error')
      .should('have.length.at.least', minimo)
      .then(($mensajes) =>
        $mensajes
          .toArray()
          .map((nodo) => (nodo.textContent ?? '').trim())
          .filter((texto) => texto !== ''),
      );
  },

  /** Vuelve al login desde la confirmación. */
  irALogin(): void {
    cy.porTestId('registro-ir-login').click();
  },

  esperarFormularioProfesional(): void {
    cy.porTestId('registro-form-profesional').should('exist');
  },
};
