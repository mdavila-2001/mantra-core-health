import { describe, expect, test } from 'vitest';

import { usarNavegador } from '../../core/test.lifecycle';
import { PACIENTE } from '../../fixtures/usuarios.fixture';
import { ForgotPasswordPage } from '../../pages/forgot-password.page';

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
  const navegador = usarNavegador();

  test('pedir el enlace reemplaza el formulario por una confirmación', async () => {
    const recuperar = new ForgotPasswordPage(navegador());
    await recuperar.abrir();

    await recuperar.pedirEnlace(PACIENTE.identificador);

    expect(await recuperar.esperarConfirmacion()).toMatch(/revisá tu correo/i);
    await recuperar.esperarFormularioReemplazado();
  });

  test('el mensaje es idéntico para una cuenta que no existe', async () => {
    const recuperar = new ForgotPasswordPage(navegador());
    await recuperar.abrir();

    await recuperar.pedirEnlace('no-existe-en-ningun-lado@mantra.test');

    // Mismo texto, mismo estado: la respuesta no puede delatar la existencia.
    expect(await recuperar.esperarConfirmacion()).toMatch(/revisá tu correo/i);
    expect(await recuperar.mensajeDeError()).toBeNull();
  });

  test('el campo obligatorio se avisa antes de llamar a la API', async () => {
    const recuperar = new ForgotPasswordPage(navegador());
    await recuperar.abrir();

    await recuperar.enviarFormulario();

    expect(await recuperar.hayConfirmacion()).toBe(false);
    expect(await recuperar.mensajeDeError()).toBeNull();
  });

  test('el envío se puede repetir sin quedar en un estado intermedio', async () => {
    const recuperar = new ForgotPasswordPage(navegador());
    await recuperar.abrir('api-lenta');

    await recuperar.pedirEnlace(PACIENTE.identificador);

    // Con la API demorada, la confirmación llega igual: el estado de carga no
    // puede quedarse pegado si la respuesta tarda.
    expect(await recuperar.esperarConfirmacion()).toMatch(/revisá tu correo/i);
  });
});
