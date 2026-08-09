import { describe, expect, test } from 'vitest';

import { HeaderComponent } from '../../components/header.component';
import { SideNavComponent } from '../../components/side-nav.component';
import { VIEWPORTS } from '../../config/environment';
import { usarNavegador } from '../../core/test.lifecycle';
import { iniciarSesion } from '../../helpers/auth.helper';
import { hayDesbordeHorizontal } from '../../helpers/viewport.helper';
import { LoginPage } from '../../pages/login.page';

/**
 * Comportamiento por resolución.
 *
 * **No se duplica la suite entera por tamaño.** Eso multiplicaría el tiempo por
 * tres para volver a comprobar lo mismo. Se prueban las dos cosas que de verdad
 * cambian con el ancho —que la navegación se vuelva un cajón y que nada quede
 * fuera de la pantalla— sobre los dos flujos que no pueden fallar en un
 * teléfono: entrar y moverse.
 */
describe('Responsive · escritorio', () => {
  const navegador = usarNavegador({ viewport: VIEWPORTS.escritorio });

  test('en escritorio la navegación está siempre a la vista, sin botón de menú', async () => {
    await iniciarSesion(navegador());

    const encabezado = new HeaderComponent(navegador());
    expect(await encabezado.tieneBotonDeMenu()).toBe(false);

    const menu = new SideNavComponent(navegador());
    expect(await menu.estaVisible()).toBe(true);
  });

  test('el login entra en pantalla sin desborde horizontal', async () => {
    const login = new LoginPage(navegador());
    await login.abrir();

    expect(await hayDesbordeHorizontal(navegador())).toBe(false);
  });
});

describe('Responsive · tableta', () => {
  const navegador = usarNavegador({ viewport: VIEWPORTS.tableta });

  test('el panel se usa sin desborde horizontal', async () => {
    await iniciarSesion(navegador());

    expect(await hayDesbordeHorizontal(navegador())).toBe(false);
  });
});

describe('Responsive · móvil', () => {
  const navegador = usarNavegador({ viewport: VIEWPORTS.movil });

  test('en móvil la navegación se guarda en un cajón que se abre desde el encabezado', async () => {
    await iniciarSesion(navegador());

    const encabezado = new HeaderComponent(navegador());
    expect(await encabezado.tieneBotonDeMenu()).toBe(true);

    // El cajón es la única forma de navegar en un teléfono: si el botón no
    // abriera el panel, la aplicación quedaría sin menú en el 40 % de las
    // pantallas.
    await encabezado.abrirNavegacion();

    const menu = new SideNavComponent(navegador());
    await menu.esperarVisible();
    expect(await menu.rutas()).toContain('/panel');
  });

  test('se puede iniciar sesión en un teléfono', async () => {
    const panel = await iniciarSesion(navegador());

    expect(await panel.urlActual()).toMatch(/\/panel$/);
    expect(await hayDesbordeHorizontal(navegador())).toBe(false);
  });

  test('el formulario de login no se sale de la pantalla', async () => {
    const login = new LoginPage(navegador());
    await login.abrir();

    // El desborde horizontal en un teléfono no es un detalle estético: obliga a
    // desplazar de lado para llegar al botón, y mucha gente no lo descubre.
    expect(await hayDesbordeHorizontal(navegador())).toBe(false);
  });
});
