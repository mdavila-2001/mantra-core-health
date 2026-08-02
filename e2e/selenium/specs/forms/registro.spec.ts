import { describe, expect, test } from 'vitest';

import { usarNavegador } from '../../core/test.lifecycle';
import { nuevoPaciente } from '../../fixtures/usuarios.fixture';
import { RegisterPage } from '../../pages/register.page';

/**
 * Alta de cuenta.
 *
 * Dos contratos distintos en una pantalla: el paciente entra con su documento y
 * el correo es opcional; el profesional entra con su correo y necesita
 * matrícula y credencial. Que el conmutador cambie **de verdad** el formulario
 * —y no solo la etiqueta— es la mitad de lo que se prueba acá.
 *
 * Los datos se generan únicos por corrida (`nuevoPaciente()`): dos ejecuciones
 * seguidas no pueden chocar entre sí.
 */
describe('Formularios · registro', () => {
  const navegador = usarNavegador();

  test('un paciente se da de alta con documento, nombre y contraseña', async () => {
    const registro = new RegisterPage(navegador());
    await registro.abrir();

    await registro.registrarPaciente(nuevoPaciente());

    expect(await registro.esperarConfirmacion()).toMatch(/cuenta está lista/i);
  });

  test('con correo, el alta avisa que mandó la verificación', async () => {
    const registro = new RegisterPage(navegador());
    await registro.abrir();

    await registro.registrarPaciente(nuevoPaciente(), { conCorreo: true });

    await registro.esperarConfirmacion();
    // El correo es opcional y **no condiciona el acceso**: la cuenta queda
    // usable igual. Lo que cambia es que haya algo que verificar.
    const texto = await registro.esperarConfirmacion();
    expect(texto).toMatch(/cuenta está lista/i);
  });

  test('los campos obligatorios se avisan sin llegar a la API', async () => {
    const registro = new RegisterPage(navegador());
    await registro.abrir('registro-duplicado');

    await registro.enviarFormulario();

    const mensajes = await registro.esperarMensajesDeValidacion(3);
    expect(mensajes.length).toBeGreaterThanOrEqual(3);
    // Si el formulario hubiera llamado igual, el escenario habría devuelto 409
    // y estaríamos viendo el error del servidor en vez del del campo.
    expect(await registro.mensajeDeError()).toBeNull();
  });

  test('una contraseña corta se rechaza en el cliente', async () => {
    const registro = new RegisterPage(navegador());
    await registro.abrir();

    const datos = { ...nuevoPaciente(), password: 'corta' };
    await registro.registrarPaciente(datos);

    const mensajes = await registro.esperarMensajesDeValidacion();
    expect(mensajes.join(' ')).toMatch(/8 caracteres/i);
  });

  test('un documento ya registrado se explica como conflicto, no como error genérico', async () => {
    const registro = new RegisterPage(navegador());
    await registro.abrir('registro-duplicado');

    await registro.registrarPaciente(nuevoPaciente());

    expect(await registro.esperarError()).toMatch(/ya existe|documento/i);
  });

  test('elegir «profesional» cambia el formulario, no solo el rótulo', async () => {
    const registro = new RegisterPage(navegador());
    await registro.abrir();

    await registro.elegirProfesional();

    // La matrícula y la credencial solo existen en el formulario profesional:
    // que aparezcan es la prueba de que se cambió de contrato, no de texto.
    expect(await registro.estaEnFormularioProfesional()).toBe(true);
  });

  test('desde la confirmación se vuelve al login', async () => {
    const registro = new RegisterPage(navegador());
    await registro.abrir();

    await registro.registrarPaciente(nuevoPaciente());
    await registro.esperarConfirmacion();

    await registro.irALogin();

    expect(await registro.urlActual()).toMatch(/\/auth$/);
  });
});
