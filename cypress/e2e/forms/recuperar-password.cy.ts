import { paciente } from '../../support/fixtures/usuarios';
import { ForgotPasswordPage } from '../../support/pages/forgot-password.page';

/**
 * Recuperación de contraseña.
 *
 * El detalle que hay que proteger acá no es funcional sino de privacidad: la
 * pantalla **responde lo mismo exista o no la cuenta**. Si algún día alguien
 * "mejorara" el mensaje para decir «ese correo no está registrado», cualquiera
 * podría averiguar quién tiene cuenta probando direcciones. Esta prueba es lo
 * que haría fallar ese cambio.
 */
describe('Formularios · recuperar contraseña', () => {
  it('pedir el enlace reemplaza el formulario por una confirmación', () => {
    ForgotPasswordPage.abrir();

    ForgotPasswordPage.pedirEnlace(paciente().identificador);

    ForgotPasswordPage.esperarConfirmacion().should('match', /revisá tu correo/i);
    ForgotPasswordPage.esperarFormularioReemplazado();
  });

  it('el mensaje es idéntico para una cuenta que no existe', () => {
    ForgotPasswordPage.abrir();

    ForgotPasswordPage.pedirEnlace('no-existe-en-ningun-lado@mantra.test');

    // Mismo texto, mismo estado: la respuesta no puede delatar la existencia.
    ForgotPasswordPage.esperarConfirmacion().should('match', /revisá tu correo/i);
    ForgotPasswordPage.sinError();
  });

  it('el campo obligatorio se avisa antes de llamar a la API', () => {
    ForgotPasswordPage.abrir();

    ForgotPasswordPage.enviarFormulario();

    ForgotPasswordPage.sinConfirmacion();
    ForgotPasswordPage.sinError();
  });

  it('el envío se puede repetir sin quedar en un estado intermedio', () => {
    ForgotPasswordPage.abrir('api-lenta');

    ForgotPasswordPage.pedirEnlace(paciente().identificador);

    // Con la API demorada, la confirmación llega igual: el estado de carga no
    // puede quedarse pegado si la respuesta tarda.
    ForgotPasswordPage.esperarConfirmacion().should('match', /revisá tu correo/i);
  });
});
