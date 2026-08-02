import { describe, expect, test } from 'vitest';

import { HeaderComponent } from '../../components/header.component';
import { usarNavegador } from '../../core/test.lifecycle';
import { esperarUrl } from '../../core/wait.helpers';
import { haySesionPersistida, iniciarSesion } from '../../helpers/auth.helper';
import { DashboardPage } from '../../pages/dashboard.page';
import { LoginPage } from '../../pages/login.page';

/**
 * Vida de la sesión: guard, persistencia y cierre.
 *
 * Son los cuatro caminos que **ninguna prueba unitaria puede cubrir**: hacen
 * falta un router real, un `F5` de verdad y un navegador que ejecute el
 * arranque completo. En jsdom no existe ninguna de las tres cosas.
 */
describe('Autenticación · sesión', () => {
  const navegador = usarNavegador();

  test('sin sesión, el guard manda al login', async () => {
    const panel = new DashboardPage(navegador());
    await panel.abrir('sesion-simple', '/panel');

    await esperarUrl(navegador(), /\/auth$/);

    const login = new LoginPage(navegador());
    await login.esperarCargada();
  });

  /**
   * **El journey que más fácil se rompe.**
   *
   * Un cambio en el orden de los `provideAppInitializer` lo rompe sin que
   * ninguna prueba unitaria se entere: la recuperación de sesión corre ANTES de
   * que el router evalúe el guard, y si dejara de hacerlo, quien tiene sesión
   * válida vería un parpadeo al login en cada recarga.
   */
  test('la sesión sobrevive a una recarga', async () => {
    const panel = await iniciarSesion(navegador());

    expect(await haySesionPersistida(navegador())).toBe(true);

    await panel.recargar();

    expect(await panel.urlActual()).toMatch(/\/panel$/);
    expect(await panel.tituloVisible()).toBe('Panel');
  });

  test('con el refresh token muerto, la recarga lleva al login sin mostrar un error', async () => {
    const panel = await iniciarSesion(navegador(), { escenario: 'refresco-vencido' });

    await panel.recargar();
    await esperarUrl(navegador(), /\/auth$/);

    // Un refresh token vencido no es un error que mostrar: es, simplemente, no
    // haber iniciado sesión. Un cartel rojo acá asusta sin motivo.
    const login = new LoginPage(navegador());
    expect(await login.mensajeDeError()).toBeNull();
  });

  test('cerrar sesión vuelve al login y no deja entrar hacia atrás', async () => {
    await iniciarSesion(navegador());

    const encabezado = new HeaderComponent(navegador());
    await encabezado.cerrarSesion();

    await esperarUrl(navegador(), /\/auth$/);
    expect(await haySesionPersistida(navegador())).toBe(false);

    // Volver a escribir la dirección del panel no puede devolver la sesión.
    const panel = new DashboardPage(navegador());
    await panel.ir('/panel');
    await esperarUrl(navegador(), /\/auth$/);
  });

  test('el encabezado muestra quién tiene la sesión', async () => {
    await iniciarSesion(navegador());

    const encabezado = new HeaderComponent(navegador());
    expect(await encabezado.nombreDeUsuario()).toBe('Ana Salas');
  });

  test('el panel lee la identidad del propio token, sin pedirla a la API', async () => {
    const panel = await iniciarSesion(navegador());

    expect(await panel.identificadorDeSesion()).toBe('u-e2e');
    expect(await panel.rolesVisibles()).toContain('PATIENT');
  });
});
