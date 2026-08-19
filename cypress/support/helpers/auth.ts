import type { NombreEscenario } from '../fixtures/escenarios';
import { paciente, type UsuarioPrueba } from '../fixtures/usuarios';
import { DashboardPage } from '../pages/dashboard.page';
import { LoginPage } from '../pages/login.page';
import { TenantSelectionPage } from '../pages/tenant-selection.page';

/**
 * Atajos de sesión.
 *
 * Existen para las pruebas cuyo tema **no es** iniciar sesión: la navegación, el
 * panel, el cierre. Repetir los cuatro pasos del login en cada una las haría
 * fallar todas el día que el login cambie, escondiendo cuál se rompió de verdad.
 *
 * La sesión se abre **por la interfaz** y no escribiendo el token en el
 * almacenamiento: un atajo por debajo probaría un estado que la aplicación nunca
 * produce, y dejaría de avisar el día que el guard o el arranque cambien.
 *
 * ## Por qué sin `cy.session()`
 *
 * `cy.session()` cachea el estado y salta el login en las pruebas siguientes.
 * Sería más rápido y probaría menos: el arranque de la aplicación —el orden de
 * los `provideAppInitializer`, la recuperación de sesión antes del guard— es
 * justamente lo que estas pruebas existen para vigilar, y cachearlo lo saltea.
 */

export interface OpcionesSesion {
  readonly escenario?: NombreEscenario;
  readonly usuario?: UsuarioPrueba;
}

/**
 * Entra y deja el navegador en el panel.
 *
 * Sirve tanto con una organización como con varias: si la aplicación pide
 * elegir, elige la primera.
 */
export function iniciarSesion(opciones: OpcionesSesion = {}): void {
  const { escenario = 'sesion-simple', usuario = paciente() } = opciones;

  LoginPage.abrir(escenario);
  LoginPage.entrar(usuario);
  LoginPage.esperarSalidaDelLogin();

  cy.location('pathname').then((ruta) => {
    if (!/\/auth\/organization$/.test(ruta)) {
      return;
    }
    TenantSelectionPage.organizacionesOfrecidas().then((organizaciones) => {
      const primera = organizaciones[0];
      if (primera === undefined) {
        throw new Error('La cuenta no ofrece ninguna organización para entrar.');
      }
      TenantSelectionPage.elegir(primera);
    });
  });

  cy.location('pathname').should('match', /\/dashboard$/);
  // Cuál de los dos paneles se dibuja depende del rol del escenario; el ingreso
  // sólo afirma que se llegó a uno.
  DashboardPage.esperarAlgunPanel();
}

/** Entra y se queda en la elección de organización, sin elegir ninguna. */
export function iniciarSesionSinElegirOrganizacion(opciones: OpcionesSesion = {}): void {
  const { escenario = 'multi-organizacion', usuario = paciente() } = opciones;

  LoginPage.abrir(escenario);
  LoginPage.entrar(usuario);

  cy.location('pathname').should('match', /\/auth\/organization$/);
  TenantSelectionPage.esperarCargada();
}
