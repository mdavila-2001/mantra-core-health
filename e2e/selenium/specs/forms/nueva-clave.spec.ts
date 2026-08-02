import { describe, expect, test } from 'vitest';

import { usarNavegador } from '../../core/test.lifecycle';
import { ResetPasswordPage } from '../../pages/reset-password.page';

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
  const navegador = usarNavegador();

  test('sin token, ofrece pedir un enlace nuevo en vez de un formulario inútil', async () => {
    const nuevaClave = new ResetPasswordPage(navegador());
    await nuevaClave.abrirSinToken();

    expect(await nuevaClave.esperarSinToken()).toMatch(/falta el código/i);
    // Un formulario que no puede funcionar es peor que no mostrarlo: se
    // completa, se envía y falla sin explicar por qué.
    expect(await nuevaClave.tieneFormulario()).toBe(false);
  });

  test('con token, guardar la contraseña la actualiza', async () => {
    const nuevaClave = new ResetPasswordPage(navegador());
    await nuevaClave.abrirConToken('token-de-prueba');

    await nuevaClave.cambiarPassword('contrasena-nueva-de-prueba');

    expect(await nuevaClave.esperarConfirmacion()).toMatch(/ya podés entrar con la nueva/i);
  });

  test('la pantalla dice cuántas sesiones se cerraron', async () => {
    const nuevaClave = new ResetPasswordPage(navegador());
    await nuevaClave.abrirConToken('token-de-prueba', 'clave-cambiada-con-sesiones');

    await nuevaClave.cambiarPassword('contrasena-nueva-de-prueba');

    const mensaje = await nuevaClave.esperarConfirmacion();
    expect(mensaje).toMatch(/cerramos 2 sesiones abiertas/i);
  });

  test('una contraseña corta se rechaza sin llamar a la API', async () => {
    const nuevaClave = new ResetPasswordPage(navegador());
    // Con el token vencido: si el formulario llamara igual, veríamos el error
    // del servidor en lugar del mensaje del campo.
    await nuevaClave.abrirConToken('token-vencido', 'token-vencido');

    await nuevaClave.cambiarPassword('corta');

    expect((await nuevaClave.esperarMensajesDeValidacion()).join(' ')).toMatch(/8 caracteres/i);
    expect(await nuevaClave.mensajeDeError()).toBeNull();
  });

  test('con un token vencido, el error explica que hay que pedir otro enlace', async () => {
    const nuevaClave = new ResetPasswordPage(navegador());
    await nuevaClave.abrirConToken('token-vencido', 'token-vencido');

    await nuevaClave.cambiarPassword('contrasena-nueva-de-prueba');

    expect(await nuevaClave.esperarError()).toMatch(/venció|ya se usó|revisá/i);
  });

  test('desde la confirmación se entra con la contraseña nueva', async () => {
    const nuevaClave = new ResetPasswordPage(navegador());
    await nuevaClave.abrirConToken('token-de-prueba');
    await nuevaClave.cambiarPassword('contrasena-nueva-de-prueba');
    await nuevaClave.esperarConfirmacion();

    await nuevaClave.irALogin();

    expect(await nuevaClave.urlActual()).toMatch(/\/auth$/);
  });
});
