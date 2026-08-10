import { ESCENARIO_POR_DEFECTO, type NombreEscenario } from '../fixtures/escenarios';
import type { AltaPaciente } from '../fixtures/usuarios';

/**
 * Alta de cuenta (`/auth/registro`).
 *
 * La pantalla tiene dos formularios excluyentes —paciente y profesional— que un
 * grupo de opciones intercambia. Son contratos distintos: el paciente entra con
 * su documento y el correo es opcional; el profesional entra con su correo y
 * necesita matrícula y credencial.
 */
export const RegisterPage = {
  ruta: '/auth/registro',

  abrir(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    cy.abrirEscenario(escenario, RegisterPage.ruta);
    RegisterPage.esperarCargada();
  },

  esperarCargada(): void {
    cy.porTestId('registro-tipo').should('be.visible');
  },

  /**
   * Cambia de tipo de cuenta.
   *
   * Se clica la etiqueta y no el `<input type="radio">`: el nativo está oculto
   * a la vista —lo dibuja el componente— y clicar lo que no se ve no es lo que
   * hace una persona. La etiqueta es la superficie real del control.
   */
  elegirProfesional(): void {
    cy.get('app-radio[value="profesional"] .radio-container').click();
    cy.porTestId('registro-form-profesional').should('be.visible');
  },

  elegirPaciente(): void {
    cy.get('app-radio[value="paciente"] .radio-container').click();
    cy.porTestId('registro-form-paciente').should('be.visible');
  },

  completarPaciente(datos: AltaPaciente, opciones: { conCorreo?: boolean } = {}): void {
    cy.porTestId('registro-documento').clear().type(datos.documento);
    cy.porTestId('registro-nombre').clear().type(datos.nombre);
    cy.porTestId('registro-password').clear().type(datos.password);
    if (opciones.conCorreo === true) {
      cy.porTestId('registro-correo').clear().type(datos.correo);
    }
  },

  enviarFormulario(): void {
    cy.porTestId('registro-submit').click();
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

  /** Mensajes de campo obligatorio que la pantalla muestra al intentar enviar. */
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
