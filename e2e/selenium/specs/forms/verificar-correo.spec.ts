import { describe, expect, test } from 'vitest';

import { usarNavegador } from '../../core/test.lifecycle';
import { VerifyEmailPage } from '../../pages/verify-email.page';

/**
 * Verificación de correo.
 *
 * El token llega **por la barra de direcciones**, y eso es lo que hace que esta
 * pantalla solo se pueda probar con un navegador de verdad: el componente lo
 * lee del snapshot de la ruta al construirse, así que hay que llegar navegando
 * a la dirección completa, como quien abre el enlace del correo.
 *
 * El detalle que hay que proteger es de **tono**: verificar el correo no
 * desbloquea nada —la cuenta funciona desde el registro— así que un enlace
 * vencido no puede presentarse como una alarma.
 */
describe('Formularios · verificación de correo', () => {
  const navegador = usarNavegador();

  test('con un token válido, el correo queda verificado', async () => {
    const verificar = new VerifyEmailPage(navegador());
    await verificar.abrirConToken('token-de-prueba');

    expect(await verificar.esperarVerificado()).toMatch(/correo verificado/i);
  });

  test('sin token, dice que el enlace está incompleto y no llama a la API', async () => {
    const verificar = new VerifyEmailPage(navegador());
    // Con el escenario que hace fallar el canje: si la pantalla llamara igual,
    // el estado sería «ese enlace ya no sirve» y no «falta el código».
    await verificar.abrirSinToken('token-vencido');

    expect(await verificar.esperarSinToken()).toMatch(/falta el código/i);
  });

  test('con un token vencido, el mensaje no alarma', async () => {
    const verificar = new VerifyEmailPage(navegador());
    await verificar.abrirConToken('token-vencido', 'token-vencido');

    const mensaje = await verificar.esperarInvalido();
    expect(mensaje).toMatch(/ya no sirve/i);

    // Y el cuerpo tiene que decir que la cuenta funciona igual. Si algún día
    // alguien lo convierte en un error rojo, esta prueba lo dice.
    expect(await verificar.mensajeTranquilizador()).toMatch(/tu cuenta funciona igual/i);
  });

  test('desde cualquier desenlace se puede ir a iniciar sesión', async () => {
    const verificar = new VerifyEmailPage(navegador());
    await verificar.abrirConToken('token-de-prueba');
    await verificar.esperarVerificado();

    await verificar.irALogin();

    expect(await verificar.urlActual()).toMatch(/\/auth$/);
  });
});
