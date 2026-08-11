import { VerifyEmailPage } from '../../support/pages/verify-email.page';

/**
 * Verificación de correo.
 *
 * El token llega **por la barra de direcciones**, y eso es lo que hace que esta
 * pantalla solo se pueda probar con un navegador de verdad: el componente lo lee
 * del snapshot de la ruta al construirse, así que hay que llegar navegando a la
 * dirección completa, como quien abre el enlace del correo.
 *
 * El detalle que hay que proteger es de **tono**: verificar el correo no
 * desbloquea nada —la cuenta funciona desde el registro— así que un enlace
 * vencido no puede presentarse como una alarma.
 */
describe('Formularios · verificación de correo', () => {
  it('con un token válido, el correo queda verificado', () => {
    VerifyEmailPage.abrirConToken('token-de-prueba');

    VerifyEmailPage.esperarVerificado().should('match', /correo verificado/i);
  });

  it('sin token, dice que el enlace está incompleto y no llama a la API', () => {
    // Con el escenario que hace fallar el canje: si la pantalla llamara igual,
    // el estado sería «ese enlace ya no sirve» y no «falta el código».
    VerifyEmailPage.abrirSinToken('token-vencido');

    VerifyEmailPage.esperarSinToken().should('match', /falta el código/i);
  });

  it('con un token vencido, el mensaje no alarma', () => {
    VerifyEmailPage.abrirConToken('token-vencido', 'token-vencido');

    VerifyEmailPage.esperarInvalido().should('match', /ya no sirve/i);

    // Y el cuerpo tiene que decir que la cuenta funciona igual. Si algún día
    // alguien lo convierte en un error rojo, esta prueba lo dice.
    VerifyEmailPage.mensajeTranquilizador().should('match', /tu cuenta funciona igual/i);
  });

  it('desde cualquier desenlace se puede ir a iniciar sesión', () => {
    VerifyEmailPage.abrirConToken('token-de-prueba');
    VerifyEmailPage.esperarVerificado();

    VerifyEmailPage.irALogin();

    cy.location('pathname').should('match', /\/auth$/);
  });
});
