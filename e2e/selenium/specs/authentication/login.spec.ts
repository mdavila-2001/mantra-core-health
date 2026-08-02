import { describe, expect, test } from 'vitest';

import { usarNavegador } from '../../core/test.lifecycle';
import { PACIENTE, PACIENTE_CON_DOCUMENTO } from '../../fixtures/usuarios.fixture';
import { LoginPage } from '../../pages/login.page';
import { TenantSelectionPage } from '../../pages/tenant-selection.page';
import { DashboardPage } from '../../pages/dashboard.page';

/**
 * Inicio de sesión.
 *
 * La pantalla tiene **un solo campo de identificador** porque el backend acepta
 * correo *o* documento y nunca ambos; la arroba decide cuál es. Que los dos
 * caminos funcionen es lo primero que se prueba: es el punto por donde entra
 * absolutamente todo el mundo.
 */
describe('Autenticación · inicio de sesión', () => {
  const navegador = usarNavegador();

  test('con una sola organización se entra directo al panel', async () => {
    const login = new LoginPage(navegador());
    await login.abrir('sesion-simple');

    await login.entrar(PACIENTE);

    await login.esperarSalidaDelLogin();
    expect(await login.urlActual()).toMatch(/\/panel$/);

    const panel = new DashboardPage(navegador());
    expect(await panel.tituloVisible()).toBe('Panel');
  });

  test('el documento de identidad también es un identificador válido', async () => {
    const login = new LoginPage(navegador());
    await login.abrir('sesion-simple');

    // Sin arroba, la pantalla tiene que mandarlo como documento. Si mandara un
    // correo mal formado, el backend respondería 400 y no habría sesión.
    await login.entrar(PACIENTE_CON_DOCUMENTO);

    await login.esperarSalidaDelLogin();
    expect(await login.urlActual()).toMatch(/\/panel$/);
  });

  test('con varias organizaciones hay que elegir antes de entrar', async () => {
    const login = new LoginPage(navegador());
    await login.abrir('multi-organizacion');

    await login.entrar(PACIENTE);

    // La elección es una pantalla propia porque cambia **qué datos se ven**:
    // mezclarla con las credenciales invita a pasarla por alto.
    const eleccion = new TenantSelectionPage(navegador());
    await eleccion.esperarCargada();
    expect(await eleccion.organizacionesOfrecidas()).toEqual(['Clínica Norte', 'Centro Sur']);

    await eleccion.elegir('Centro Sur');
    expect(await eleccion.urlActual()).toMatch(/\/panel$/);
  });

  test('credenciales inválidas muestran un mensaje accionable, no uno genérico', async () => {
    const login = new LoginPage(navegador());
    await login.abrir('credenciales-invalidas');

    await login.entrar(PACIENTE);

    /**
     * En cualquier otra pantalla `UNAUTHENTICATED` significa «la sesión venció».
     * Acá significa «lo que acabás de escribir no sirve», y decir lo primero
     * mandaría a la persona a iniciar sesión… donde ya está.
     */
    expect(await login.esperarError()).toMatch(/credenciales/i);
    expect(await login.urlActual()).toMatch(/\/auth$/);
  });

  test('los campos obligatorios se avisan sin llamar a la API', async () => {
    const login = new LoginPage(navegador());
    await login.abrir('credenciales-invalidas');

    // Sin escribir nada: si el formulario dejara enviar, el escenario haría
    // fallar la petición y el mensaje sería el del servidor, no el del campo.
    await login.enviarFormulario();

    const mensajes = await login.esperarMensajesDeValidacion(2);
    expect(mensajes.length).toBeGreaterThanOrEqual(2);
    expect(mensajes.join(' ')).toMatch(/ingresá/i);
    expect(await login.mensajeDeError()).toBeNull();
  });

  test('la contraseña se puede revelar y volver a ocultar', async () => {
    const login = new LoginPage(navegador());
    await login.abrir();
    await login.escribirPassword('secreto');

    expect(await login.tipoDelCampoPassword()).toBe('password');

    await login.alternarVisibilidadPassword();
    expect(await login.esperarTipoDelCampoPassword('text')).toBe('text');

    await login.alternarVisibilidadPassword();
    expect(await login.esperarTipoDelCampoPassword('password')).toBe('password');
  });

  test('mientras la API responde, el botón queda ocupado y no admite un segundo envío', async () => {
    const login = new LoginPage(navegador());
    await login.abrir('api-lenta');

    await login.escribirIdentificador(PACIENTE.identificador);
    await login.escribirPassword(PACIENTE.password);
    await login.enviarFormulario();

    // El estado ocupado no es cosmético: es lo que impide que dos clics
    // seguidos abran dos sesiones y dejen una huérfana del lado del servidor.
    expect(await login.esperarEnviando()).toBe(true);

    await login.esperarSalidaDelLogin();
    expect(await login.urlActual()).toMatch(/\/panel$/);
  });
});
