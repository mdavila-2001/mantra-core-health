import type { WebDriver } from 'selenium-webdriver';

import { esperarUrl } from '../core/wait.helpers';
import type { NombreEscenario } from '../fixtures/escenarios';
import { PACIENTE, type UsuarioPrueba } from '../fixtures/usuarios.fixture';
import { DashboardPage } from '../pages/dashboard.page';
import { LoginPage } from '../pages/login.page';
import { TenantSelectionPage } from '../pages/tenant-selection.page';

/**
 * Atajos de sesión.
 *
 * Existen para las pruebas cuyo tema **no es** iniciar sesión: la navegación,
 * el panel, el cierre. Repetir los cuatro pasos del login en cada una las haría
 * fallar todas el día que el login cambie, escondiendo cuál se rompió de verdad.
 *
 * La sesión se abre **por la interfaz** y no escribiendo el token en el
 * almacenamiento: un atajo por debajo probaría un estado que la aplicación
 * nunca produce, y dejaría de avisar el día que el guard o el arranque cambien.
 */

export interface OpcionesSesion {
  readonly escenario?: NombreEscenario;
  readonly usuario?: UsuarioPrueba;
}

/**
 * Entra y deja el navegador en el panel.
 *
 * Sirve tanto con una organización como con varias: si la aplicación pide
 * elegir, elige la primera. Devolver el panel ya construido evita que cada
 * prueba lo instancie a mano.
 */
export async function iniciarSesion(
  driver: WebDriver,
  opciones: OpcionesSesion = {},
): Promise<DashboardPage> {
  const { escenario = 'sesion-simple', usuario = PACIENTE } = opciones;

  const login = new LoginPage(driver);
  await login.abrir(escenario);
  await login.entrar(usuario);
  await login.esperarSalidaDelLogin();

  if (/\/auth\/organizacion$/.test(await driver.getCurrentUrl())) {
    const eleccion = new TenantSelectionPage(driver);
    const organizaciones = await eleccion.organizacionesOfrecidas();
    const primera = organizaciones[0];
    if (primera === undefined) {
      throw new Error('La cuenta no ofrece ninguna organización para entrar.');
    }
    await eleccion.elegir(primera);
  }

  await esperarUrl(driver, /\/panel$/);
  const panel = new DashboardPage(driver);
  await panel.esperarCargada();
  return panel;
}

/** Entra y se queda en la elección de organización, sin elegir ninguna. */
export async function iniciarSesionSinElegirOrganizacion(
  driver: WebDriver,
  opciones: OpcionesSesion = {},
): Promise<TenantSelectionPage> {
  const { escenario = 'multi-organizacion', usuario = PACIENTE } = opciones;

  const login = new LoginPage(driver);
  await login.abrir(escenario);
  await login.entrar(usuario);
  await esperarUrl(driver, /\/auth\/organizacion$/);

  const eleccion = new TenantSelectionPage(driver);
  await eleccion.esperarCargada();
  return eleccion;
}

/** `true` si el navegador tiene una sesión persistida (el refresh token). */
export async function haySesionPersistida(driver: WebDriver): Promise<boolean> {
  const valor = await driver.executeScript<string | null>(
    "return window.localStorage.getItem('mantra.refresh-token');",
  );
  return valor !== null && valor !== '';
}
