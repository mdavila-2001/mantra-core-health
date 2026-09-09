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
    // La guía de profesionales tampoco declara roles, y ahí la razón es más
    // simple: la usa sobre todo quien busca médico, o sea el paciente. Ocupó
    // el lugar del muro en el menú (carril R2-1) — el muro sigue existiendo
    // como ruta, pero ya no se ofrece desde acá.
    //
    // El glosario ya no está: desde el 18/08/2026 (feedback de la analista,
    // F-03) declara los roles de quien atiende — es herramienta de trabajo, no
    // una pantalla del paciente.
    //
    // La lista es la misma que fija `navigation.service.spec.ts` para una
    // sesión sin roles de gestión, más la Guía (que es sólo del paciente):
    // tutoriales, directorio de laboratorios, archivo clínico, resultados y
    // cuestionarios propios entraron después de que se escribiera esta prueba
    // y nadie la actualizó (la suite E2E no corre en el CI caído). Y la vitrina
    // (`/design-system`) no está: desde H-07 (#131) el grupo «Herramientas» no
    // se arma para el paciente.
    //
    // **Esta lista ya venía desactualizada, y este cambio no la pone al día.**
    // Le faltan destinos de agosto y septiembre —`/messaging`,
    // `/directories`, `/nearby-places`, `/my-account/pharmacy-orders`,
    // `/notification-center`— y le sobran las dos de identidad, que salieron
    // del menú con `fueraDelMenuPara`. Lo único que se toca acá es lo que el
    // cambio del 08/09/2026 vuelve falso: los cuatro directorios dejaron de
    // ocupar renglón y se entran por `/directories`, así que nombrarlos como
    // entradas del menú sería escribir una mentira nueva sobre una vieja. La
    // puesta al día completa pide correr la suite contra la API viva, que es
    // otro trabajo.
    SideNav.rutas().should('deep.equal', [
      '/dashboard',
      '/tutorials',
      '/my-account',
      '/my-account/appointments',
      '/my-account/medical-record',
      '/my-account/diagnostic-results',
      '/my-account/questionnaires',
      '/my-account/identity/verify',
      '/my-account/identity/cases',
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
    DashboardPage.esperarPanelDelPaciente();
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
