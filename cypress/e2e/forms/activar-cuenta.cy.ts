import { ActivateAccountPage } from '../../support/pages/activate-account.page';

/**
 * Activación de una cuenta creada por otro.
 *
 * Es la salida del **alta asistida**: alguien —una recepcionista, un familiar—
 * crea la cuenta a nombre de quien no puede hacerlo solo, y le entrega un
 * código. Lo que se prueba acá es que esa persona pueda terminar el trámite por
 * los **dos** caminos que el producto le promete, y que el código que ya no
 * sirve no la deje encerrada.
 *
 * ## Por qué merece una prueba con navegador
 *
 * El token puede llegar por la barra de direcciones, y eso no lo puede cubrir
 * ninguna prueba unitaria: el componente lo lee del snapshot de la ruta al
 * construirse, así que hay que llegar navegando a la dirección completa.
 */
describe('Formularios · activar cuenta', () => {
  it('con el enlace, el código no se vuelve a pedir: solo falta la contraseña', () => {
    ActivateAccountPage.abrirConToken('codigo-de-prueba');

    // El campo **no se dibuja**, y esa es la decisión: el código ya está
    // resuelto, así que mostrarlo relleno sería pedirle a la persona que revise
    // algo hecho, y mostrarlo vacío la obligaría a copiarlo de la barra de
    // direcciones.
    ActivateAccountPage.esperarCampoDeToken(false);

    ActivateAccountPage.escribirPassword('contrasena-de-prueba');
    ActivateAccountPage.enviarFormulario();

    ActivateAccountPage.esperarConfirmacion().should('match', /cuenta quedó activa/i);
  });

  it('sin enlace, el código se puede escribir a mano', () => {
    ActivateAccountPage.abrirSinToken();

    // El alta asistida entrega el código en pantalla para pasarlo por teléfono o
    // en papel. Si esta pantalla exigiera el enlace, ese camino no existiría.
    ActivateAccountPage.esperarCampoDeToken(true);

    ActivateAccountPage.activar('codigo-dictado', 'contrasena-de-prueba');

    ActivateAccountPage.esperarConfirmacion().should('match', /cuenta quedó activa/i);
  });

  it('un código que ya no sirve pide otro, en vez de invitar a reintentar', () => {
    ActivateAccountPage.abrirConToken('codigo-vencido', 'token-vencido');

    ActivateAccountPage.escribirPassword('contrasena-de-prueba');
    ActivateAccountPage.enviarFormulario();

    /**
     * La API responde **401**, y ese código en cualquier otra pantalla significa
     * «se te venció la sesión». Acá significa «ese código no sirve», y la
     * diferencia no es de redacción: manda a pedirle otro a quien creó la
     * cuenta, en vez de a reintentar algo que nunca va a funcionar.
     */
    ActivateAccountPage.esperarTokenInvalido().should('match', /no sirve|pedile uno nuevo/i);
    // Y no puede salir además el error genérico: serían dos mensajes distintos
    // para el mismo hecho.
    ActivateAccountPage.sinErrorGenerico();
  });

  it('una contraseña corta se rechaza sin llamar a la API', () => {
    // Con el escenario que hace fallar el código: si el formulario llamara
    // igual, veríamos el aviso del servidor en lugar del mensaje del campo.
    ActivateAccountPage.abrirConToken('codigo-vencido', 'token-vencido');

    ActivateAccountPage.escribirPassword('corta');
    ActivateAccountPage.enviarFormulario();

    ActivateAccountPage.mensajesDeValidacion().then((mensajes) => {
      expect(mensajes.join(' ')).to.match(/8 caracteres/i);
    });
    cy.porTestId('activar-token-malo').should('not.exist');
  });

  it('desde la confirmación se entra con la contraseña recién elegida', () => {
    ActivateAccountPage.abrirConToken('codigo-de-prueba');
    ActivateAccountPage.escribirPassword('contrasena-de-prueba');
    ActivateAccountPage.enviarFormulario();
    ActivateAccountPage.esperarConfirmacion();

    ActivateAccountPage.irALogin();

    cy.location('pathname').should('match', /\/auth$/);
  });
});
