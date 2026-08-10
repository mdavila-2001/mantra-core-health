import { ResetPasswordPage } from '../../support/pages/reset-password.page';

/**
 * Elegir una contraseña nueva con el token del correo.
 *
 * Igual que la verificación, el token llega por la barra de direcciones. La
 * diferencia es que acá hay una **consecuencia que la pantalla tiene que decir
 * en palabras**: guardar la contraseña cierra las demás sesiones abiertas. Que
 * eso se anuncie —y con el número correcto— es lo que evita que alguien crea
 * que le hackearon la cuenta cuando se le cierra la sesión del teléfono.
 */
describe('Formularios · nueva contraseña', () => {
  it('sin token, ofrece pedir un enlace nuevo en vez de un formulario inútil', () => {
    ResetPasswordPage.abrirSinToken();

    ResetPasswordPage.esperarSinToken().should('match', /falta el código/i);
    ResetPasswordPage.sinFormulario();
  });

  it('con token, guardar la contraseña la actualiza', () => {
    ResetPasswordPage.abrirConToken('token-de-prueba');

    ResetPasswordPage.cambiarPassword('contrasena-nueva-de-prueba');

    ResetPasswordPage.esperarConfirmacion().should('match', /ya podés entrar con la nueva/i);
  });

  it('la pantalla dice cuántas sesiones se cerraron', () => {
    ResetPasswordPage.abrirConToken('token-de-prueba', 'clave-cambiada-con-sesiones');

    ResetPasswordPage.cambiarPassword('contrasena-nueva-de-prueba');

    ResetPasswordPage.esperarConfirmacion().should('match', /cerramos 2 sesiones abiertas/i);
  });

  it('una contraseña corta se rechaza sin llamar a la API', () => {
    // Con el token vencido: si el formulario llamara igual, veríamos el error
    // del servidor en lugar del mensaje del campo.
    ResetPasswordPage.abrirConToken('token-vencido', 'token-vencido');

    ResetPasswordPage.cambiarPassword('corta');

    ResetPasswordPage.mensajesDeValidacion().then((mensajes) => {
      expect(mensajes.join(' ')).to.match(/8 caracteres/i);
    });
    ResetPasswordPage.sinError();
  });

  it('con un token vencido, el error explica que hay que pedir otro enlace', () => {
    ResetPasswordPage.abrirConToken('token-vencido', 'token-vencido');

    ResetPasswordPage.cambiarPassword('contrasena-nueva-de-prueba');

    ResetPasswordPage.esperarError().should('match', /venció|ya se usó|revisá/i);
  });

  it('desde la confirmación se entra con la contraseña nueva', () => {
    ResetPasswordPage.abrirConToken('token-de-prueba');
    ResetPasswordPage.cambiarPassword('contrasena-nueva-de-prueba');
    ResetPasswordPage.esperarConfirmacion();

    ResetPasswordPage.irALogin();

    cy.location('pathname').should('match', /\/auth$/);
  });
});
