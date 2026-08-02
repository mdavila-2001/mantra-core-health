import { describe, expect, test } from 'vitest';

import { SideNavComponent } from '../../components/side-nav.component';
import { usarNavegador } from '../../core/test.lifecycle';
import { esperarUrl } from '../../core/wait.helpers';
import { iniciarSesion } from '../../helpers/auth.helper';
import { DashboardPage } from '../../pages/dashboard.page';
import { LoginPage } from '../../pages/login.page';
import { NotFoundPage } from '../../pages/not-found.page';
import { ForgotPasswordPage } from '../../pages/forgot-password.page';
import { RegisterPage } from '../../pages/register.page';

/**
 * Navegación entre pantallas.
 *
 * Lo que se prueba acá no es que exista un enlace, sino que **llegue a donde
 * dice** y que el botón de atrás del navegador siga funcionando. Una aplicación
 * de una sola página rompe eso con facilidad: basta un `navigate` donde iba un
 * `routerLink` para que el historial deje de tener sentido.
 */
describe('Navegación', () => {
  const navegador = usarNavegador();

  test('el menú lateral lleva a las rutas que anuncia', async () => {
    await iniciarSesion(navegador());

    const menu = new SideNavComponent(navegador());
    expect(await menu.rutas()).toEqual(['/panel', '/identidad/verificar', '/design-system']);

    await menu.irA('/identidad/verificar');
    await esperarUrl(navegador(), /\/identidad\/verificar$/);

    await menu.irA('/panel');
    await esperarUrl(navegador(), /\/panel$/);
  });

  test('la ruta activa se anuncia, y no solo se colorea', async () => {
    await iniciarSesion(navegador());

    // `aria-current="page"` es lo que oye quien usa lector de pantalla. Sin
    // esto, la marca de «acá estás» existe únicamente para quien ve el color.
    const menu = new SideNavComponent(navegador());
    expect(await menu.rutaActual()).toBe('/panel');

    await menu.irA('/identidad/verificar');
    expect(await menu.rutaActual()).toBe('/identidad/verificar');
  });

  test('el botón de atrás del navegador deshace la navegación', async () => {
    const panel = await iniciarSesion(navegador());

    const menu = new SideNavComponent(navegador());
    await menu.irA('/identidad/verificar');
    await esperarUrl(navegador(), /\/identidad\/verificar$/);

    await panel.volverAtras();

    await esperarUrl(navegador(), /\/panel$/);
    expect(await panel.tituloVisible()).toBe('Panel');
  });

  test('la raíz redirige al panel cuando hay sesión', async () => {
    const panel = await iniciarSesion(navegador());

    await panel.ir('/');

    await esperarUrl(navegador(), /\/panel$/);
  });

  test('una dirección inexistente muestra la pantalla de no encontrado y ofrece salida', async () => {
    const noEncontrada = new NotFoundPage(navegador());
    await noEncontrada.abrir('sesion-simple', '/ruta/que/no/existe');

    expect(await noEncontrada.mensaje()).toMatch(/no encontramos/i);

    // Sin sesión, «Ir al inicio» pasa por el guard y termina en el login: lo
    // que importa es que la salida exista y no deje a nadie encerrado.
    await noEncontrada.volverAlInicio();
    await esperarUrl(navegador(), /\/auth$/);
  });

  test('desde el login se llega a recuperar contraseña y a crear cuenta', async () => {
    const login = new LoginPage(navegador());
    await login.abrir();

    await login.irARecuperarPassword();
    const recuperar = new ForgotPasswordPage(navegador());
    await recuperar.esperarCargada();
    expect(await recuperar.urlActual()).toMatch(/\/auth\/recuperar$/);

    await recuperar.volverAtras();
    await login.esperarCargada();

    await login.irARegistro();
    const registro = new RegisterPage(navegador());
    await registro.esperarCargada();
    expect(await registro.urlActual()).toMatch(/\/auth\/registro$/);
  });

  test('el título de la pestaña cambia con la ruta', async () => {
    const login = new LoginPage(navegador());
    await login.abrir();
    expect(await login.titulo()).toMatch(/Iniciar sesión/i);

    const panel = new DashboardPage(navegador());
    await panel.ir('/auth/registro');
    expect(await panel.titulo()).toMatch(/Crear cuenta/i);
  });
});
