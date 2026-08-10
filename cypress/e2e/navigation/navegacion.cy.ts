import { SideNav } from '../../support/components/side-nav.component';
import { iniciarSesion } from '../../support/helpers/auth';
import { DashboardPage } from '../../support/pages/dashboard.page';
import { DesignSystemPage } from '../../support/pages/design-system.page';
import { ForgotPasswordPage } from '../../support/pages/forgot-password.page';
import { LoginPage } from '../../support/pages/login.page';
import { NotFoundPage } from '../../support/pages/not-found.page';
import { RegisterPage } from '../../support/pages/register.page';

/**
 * Navegación entre pantallas.
 *
 * Lo que se prueba acá no es que exista un enlace, sino que **llegue a donde
 * dice** y que el botón de atrás del navegador siga funcionando. Una aplicación
 * de una sola página rompe eso con facilidad: basta un `navigate` donde iba un
 * `routerLink` para que el historial deje de tener sentido.
 */
describe('Navegación', () => {
  it('el menú lateral lleva a las rutas que anuncia', () => {
    iniciarSesion();

    // La sesión simulada es de `PATIENT`, así que el menú trae lo que no exige
    // ningún rol —el panel y el autoservicio— y nada de gestión. Las secciones
    // administrativas existen en el registro pero no se le ofrecen: el menú se
    // arma con los roles del token.
    SideNav.rutas().should('deep.equal', [
      '/panel',
      '/mi-cuenta',
      '/identidad/verificar',
      '/identidad/casos',
      '/design-system',
    ]);
    SideNav.rutas().should('not.include', '/administracion/usuarios');

    SideNav.irA('/identidad/verificar');
    cy.location('pathname').should('match', /\/identidad\/verificar$/);

    SideNav.irA('/panel');
    cy.location('pathname').should('match', /\/panel$/);
  });

  it('la ruta activa se anuncia, y no solo se colorea', () => {
    iniciarSesion();

    // `aria-current="page"` es lo que oye quien usa lector de pantalla. Sin
    // esto, la marca de «acá estás» existe únicamente para quien ve el color.
    SideNav.esperarRutaActual('/panel');

    SideNav.irA('/identidad/verificar');
    SideNav.esperarRutaActual('/identidad/verificar');
  });

  it('el botón de atrás del navegador deshace la navegación', () => {
    iniciarSesion();

    SideNav.irA('/identidad/verificar');
    cy.location('pathname').should('match', /\/identidad\/verificar$/);

    cy.go('back');

    cy.location('pathname').should('match', /\/panel$/);
    DashboardPage.esperarTitulo('Panel');
  });

  it('la raíz redirige al panel cuando hay sesión', () => {
    iniciarSesion();

    cy.irA('/');

    cy.location('pathname').should('match', /\/panel$/);
  });

  it('una dirección inexistente muestra la pantalla de no encontrado y ofrece salida', () => {
    NotFoundPage.abrir('sesion-simple', '/ruta/que/no/existe');

    NotFoundPage.mensaje().should('match', /no encontramos/i);

    // Sin sesión, «Ir al inicio» pasa por el guard y termina en el login: lo
    // que importa es que la salida exista y no deje a nadie encerrado.
    NotFoundPage.volverAlInicio();
    cy.location('pathname').should('match', /\/auth$/);
  });

  it('desde el login se llega a recuperar contraseña y a crear cuenta', () => {
    LoginPage.abrir();

    LoginPage.irARecuperarPassword();
    ForgotPasswordPage.esperarCargada();
    cy.location('pathname').should('match', /\/auth\/recuperar$/);

    cy.go('back');
    LoginPage.esperarCargada();

    LoginPage.irARegistro();
    RegisterPage.esperarCargada();
    cy.location('pathname').should('match', /\/auth\/registro$/);
  });

  it('la vitrina diferida se descarga y se pinta', () => {
    /**
     * La ruta es `loadComponent` con un `catch`: si el fragmento no bajara
     * —despliegue nuevo, pestaña vieja, hash que ya no existe— el router
     * muestra la pantalla de recuperación en vez de dejar la navegación muerta.
     * Que acá se pinte la vitrina prueba el camino feliz de ese mecanismo, que
     * es el único que se puede provocar sin romper el artefacto.
     */
    DesignSystemPage.abrir();

    cy.location('pathname').should('match', /\/design-system$/);
  });

  it('el título de la pestaña cambia con la ruta', () => {
    LoginPage.abrir();
    cy.title().should('match', /Iniciar sesión/i);

    cy.irA('/auth/registro');
    cy.title().should('match', /Crear cuenta/i);
  });
});
