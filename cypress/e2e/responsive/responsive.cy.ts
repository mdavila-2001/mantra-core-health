import { VIEWPORTS } from '../../support/viewports';
import { Header } from '../../support/components/header.component';
import { SideNav } from '../../support/components/side-nav.component';
import { iniciarSesion } from '../../support/helpers/auth';
import { LoginPage } from '../../support/pages/login.page';

/**
 * Comportamiento por resolución.
 *
 * **No se duplica la suite entera por tamaño.** Eso multiplicaría el tiempo por
 * tres para volver a comprobar lo mismo. Se prueban las dos cosas que de verdad
 * cambian con el ancho —que la navegación se vuelva un cajón y que nada quede
 * fuera de la pantalla— sobre los dos flujos que no pueden fallar en un
 * teléfono: entrar y moverse.
 *
 * Cambiar de resolución es `cy.viewport()`: no hace falta abrir un navegador por
 * tamaño, como sí hacía la suite anterior.
 */
describe('Responsive · escritorio', () => {
  beforeEach(() => {
    cy.viewport(VIEWPORTS.escritorio.ancho, VIEWPORTS.escritorio.alto);
  });

  it('en escritorio la navegación está siempre a la vista, sin botón de menú', () => {
    iniciarSesion();

    Header.esperarBotonDeMenu(false);
    SideNav.esperarVisible();
  });

  it('el login entra en pantalla sin desborde horizontal', () => {
    LoginPage.abrir();

    cy.hayDesbordeHorizontal().should('equal', false);
  });
});

describe('Responsive · tableta', () => {
  beforeEach(() => {
    cy.viewport(VIEWPORTS.tableta.ancho, VIEWPORTS.tableta.alto);
  });

  it('el panel se usa sin desborde horizontal', () => {
    iniciarSesion();

    cy.hayDesbordeHorizontal().should('equal', false);
  });
});

describe('Responsive · móvil', () => {
  beforeEach(() => {
    cy.viewport(VIEWPORTS.movil.ancho, VIEWPORTS.movil.alto);
  });

  it('en móvil la navegación se guarda en un cajón que se abre desde el encabezado', () => {
    iniciarSesion();

    Header.esperarBotonDeMenu(true);

    // El cajón es la única forma de navegar en un teléfono: si el botón no
    // abriera el panel, la aplicación quedaría sin menú en el 40 % de las
    // pantallas.
    Header.abrirNavegacion();

    SideNav.esperarVisible();
    SideNav.rutas().should('include', '/panel');
  });

  it('se puede iniciar sesión en un teléfono', () => {
    iniciarSesion();

    cy.location('pathname').should('match', /\/panel$/);
    cy.hayDesbordeHorizontal().should('equal', false);
  });

  it('el formulario de login no se sale de la pantalla', () => {
    LoginPage.abrir();

    // El desborde horizontal en un teléfono no es un detalle estético: obliga a
    // desplazar de lado para llegar al botón, y mucha gente no lo descubre.
    cy.hayDesbordeHorizontal().should('equal', false);
  });
});
