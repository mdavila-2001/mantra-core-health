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
    //
    // «Mis turnos» entra por lo mismo: no declara roles, porque el filtro real
    // es tener perfil de paciente —un dato de la cuenta, no un rol—, y eso la
    // pantalla lo resuelve por su cuenta.
    //
    // El muro, igual: su filtro es tener **perfil público** de `community`, que
    // es otra entidad distinta del `pid` de la sesión y sólo se sabe
    // preguntándole al backend. Un rol no puede expresarlo.
    //
    // El glosario tampoco declara roles: el cliente lo pidió accesible por
    // cada profesional, no sólo por quien administra.
    SideNav.rutas().should('deep.equal', [
      '/dashboard',
      '/feed',
      '/glossary',
      '/my-account',
      '/my-account/appointments',
      '/my-account/identity/verify',
      '/my-account/identity/cases',
      '/design-system',
    ]);
    SideNav.rutas().should('not.include', '/administration/users');

    SideNav.irA('/my-account/identity/verify');
    cy.location('pathname').should('match', /\/my-account\/identity\/verify$/);

    SideNav.irA('/dashboard');
    cy.location('pathname').should('match', /\/dashboard$/);
  });

  it('la ruta activa se anuncia, y no solo se colorea', () => {
    iniciarSesion();

    // `aria-current="page"` es lo que oye quien usa lector de pantalla. Sin
    // esto, la marca de «acá estás» existe únicamente para quien ve el color.
    SideNav.esperarRutaActual('/dashboard');

    SideNav.irA('/my-account/identity/verify');
    SideNav.esperarRutaActual('/my-account/identity/verify');
  });

  it('el botón de atrás del navegador deshace la navegación', () => {
    iniciarSesion();

    SideNav.irA('/my-account/identity/verify');
    cy.location('pathname').should('match', /\/my-account\/identity\/verify$/);

    cy.go('back');

    cy.location('pathname').should('match', /\/dashboard$/);
    DashboardPage.esperarTitulo('Panel');
  });

  it('la raíz redirige al panel cuando hay sesión', () => {
    iniciarSesion();

    cy.irA('/');

    cy.location('pathname').should('match', /\/dashboard$/);
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
    cy.location('pathname').should('match', /\/auth\/forgot-password$/);

    cy.go('back');
    LoginPage.esperarCargada();

    LoginPage.irARegistro();
    RegisterPage.esperarCargada();
    cy.location('pathname').should('match', /\/auth\/register$/);
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

    cy.irA('/auth/register');
    cy.title().should('match', /Crear cuenta/i);
  });
});
