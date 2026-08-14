import { paciente } from '../../support/fixtures/usuarios';
import { ResendVerificationPage } from '../../support/pages/resend-verification.page';

/**
 * Reenviar el correo de verificación.
 *
 * Dos reglas que se rompen sin que nadie mire, y ninguna es funcional:
 *
 * 1. **Privacidad.** Como en la recuperación de contraseña, la respuesta es la
 *    misma exista o no la cuenta. Un mensaje «mejorado» que dijera «ese correo
 *    no está registrado» convertiría la pantalla en un detector de cuentas.
 * 2. **Un límite de intentos no es un error.** El endpoint admite cinco por
 *    minuto; decirle «error» a quien simplemente fue rápido lo invita a
 *    insistir, que empeora exactamente lo que el límite quiere evitar.
 */
describe('Formularios · reenviar verificación', () => {
  it('pedir el reenvío confirma, sin decir si la cuenta existe', () => {
    ResendVerificationPage.abrir();

    ResendVerificationPage.pedirReenvio(paciente().identificador);

    ResendVerificationPage.esperarConfirmacion().should('match', /\S/);
    ResendVerificationPage.sinError();
  });

  it('el mensaje es idéntico para una cuenta que no existe', () => {
    ResendVerificationPage.abrir();

    ResendVerificationPage.pedirReenvio('no-existe-en-ningun-lado@mantra.test');

    ResendVerificationPage.esperarConfirmacion().should('match', /\S/);
    ResendVerificationPage.sinError();
  });

  it('el campo obligatorio se avisa antes de llamar a la API', () => {
    ResendVerificationPage.abrir();

    ResendVerificationPage.enviarFormulario();

    ResendVerificationPage.sinConfirmacion();
    ResendVerificationPage.sinError();
  });

  it('el límite de intentos se cuenta en segundos, no se presenta como error', () => {
    ResendVerificationPage.abrir('reenvio-limitado');

    ResendVerificationPage.pedirReenvio(paciente().identificador);

    /**
     * Los segundos salen de la cabecera `Retry-After` de la respuesta `429`.
     * Sin ella el estado seguiría siendo de validación pero **sin cifra**, y la
     * pantalla caería en el error genérico: la prueba mira el número justamente
     * porque es lo que distingue «esperá» de «algo salió mal».
     */
    ResendVerificationPage.esperarLimite().should('match', /45 segundos/);
    ResendVerificationPage.sinError();
    ResendVerificationPage.sinConfirmacion();
  });

  it('desde la confirmación se puede probar con otro identificador', () => {
    ResendVerificationPage.abrir();
    ResendVerificationPage.pedirReenvio(paciente().identificador);
    ResendVerificationPage.esperarConfirmacion();

    ResendVerificationPage.probarConOtro();

    // Vuelve el formulario, y vacío: si conservara el identificador anterior,
    // el segundo intento saldría con el dato equivocado sin que se note.
    ResendVerificationPage.esperarCargada();
    cy.porTestId('reenviar-identificador').should('have.value', '');
  });
});
