import type { Contadores } from '../../harness/api-simulada';
import { Header } from '../../support/components/header.component';
import { iniciarSesion } from '../../support/helpers/auth';
import { DashboardPage } from '../../support/pages/dashboard.page';
import { LoginPage } from '../../support/pages/login.page';

/**
 * Vida de la sesión: guard, persistencia y cierre.
 *
 * Son los caminos que **ninguna prueba unitaria puede cubrir**: hacen falta un
 * router real, un `F5` de verdad y un navegador que ejecute el arranque
 * completo. En jsdom no existe ninguna de las tres cosas.
 */
describe('Autenticación · sesión', () => {
  beforeEach(() => {
    cy.task('reiniciarContadores');
  });

  it('sin sesión, el guard manda al login', () => {
    DashboardPage.abrir('sesion-simple', '/dashboard');

    cy.location('pathname').should('match', /\/auth$/);
    LoginPage.esperarCargada();
  });

  /**
   * **El journey que más fácil se rompe.**
   *
   * Un cambio en el orden de los `provideAppInitializer` lo rompe sin que
   * ninguna prueba unitaria se entere: la recuperación de sesión corre ANTES de
   * que el router evalúe el guard, y si dejara de hacerlo, quien tiene sesión
   * válida vería un parpadeo al login en cada recarga.
   */
  it('la sesión sobrevive a una recarga', () => {
    iniciarSesion();

    cy.haySesionPersistida().should('equal', true);

    cy.recargar();

    cy.location('pathname').should('match', /\/dashboard$/);
    DashboardPage.esperarTitulo('Panel');

    /**
     * Que termine en el panel no alcanza: si el guard se volviera permisivo,
     * esta prueba pasaría con la recuperación de sesión rota. Lo que la hace
     * significar algo es que el arnés **haya visto el canje** del refresh token.
     */
    cy.task<Contadores>('contadores').then((contadores) => {
      expect(contadores.refrescos, 'la recarga canjeó el refresh token').to.be.greaterThan(0);
    });
  });

  it('con el refresh token muerto, la recarga lleva al login sin mostrar un error', () => {
    iniciarSesion({ escenario: 'refresco-vencido' });

    cy.recargar();
    cy.location('pathname').should('match', /\/auth$/);

    // Un refresh token vencido no es un error que mostrar: es, simplemente, no
    // haber iniciado sesión. Un cartel rojo acá asusta sin motivo.
    LoginPage.sinError();
  });

  it('cerrar sesión vuelve al login y no deja entrar hacia atrás', () => {
    iniciarSesion();

    Header.cerrarSesion();

    cy.location('pathname').should('match', /\/auth$/);
    cy.haySesionPersistida().should('equal', false);

    // Volver a escribir la dirección del panel no puede devolver la sesión.
    cy.irA('/dashboard');
    cy.location('pathname').should('match', /\/auth$/);
  });

  it('el encabezado muestra quién tiene la sesión', () => {
    iniciarSesion();

    Header.nombreDeUsuario().should('equal', 'Ana Salas');
  });

  it('el panel lee los roles del propio token, sin pedirlos a la API', () => {
    iniciarSesion();

    // El código viaja en `data-role`; lo visible es la etiqueta («Paciente»).
    DashboardPage.rolesVisibles().should('include', 'PATIENT');
  });
});
