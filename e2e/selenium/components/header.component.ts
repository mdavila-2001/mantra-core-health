import { By, Key } from 'selenium-webdriver';

import { BaseComponent } from '../core/base.component';
import { esperarAusente, esperarVisible } from '../core/wait.helpers';

/**
 * Encabezado de la aplicación: cuenta, tema y organización activa.
 *
 * El cierre de sesión vive **dentro del menú de cuenta** y no suelto en la
 * barra: es una acción destructiva y no debe estar a un clic de distancia de
 * nada. Por eso `cerrarSesion()` abre el menú antes; una prueba que clicara
 * directo el elemento del menú pasaría aunque el menú estuviera roto.
 */
export class HeaderComponent extends BaseComponent {
  protected readonly raiz = By.css('header[app-header], .app-header');

  private readonly cuenta = this.porTestId('header-cuenta');
  private readonly cerrar = this.porTestId('header-cerrar-sesion');
  private readonly menuHamburguesa = this.porTestId('header-menu');
  private readonly organizacion = this.porTestId('header-organizacion');

  /** Nombre de quien tiene la sesión, tal como lo muestra el encabezado. */
  async nombreDeUsuario(): Promise<string> {
    return (await (await this.dentro(By.css('.app-header__account-name'))).getText()).trim();
  }

  async abrirMenuDeCuenta(): Promise<void> {
    await this.clic(this.cuenta);
    await esperarVisible(this.driver, this.cerrar);
  }

  async cerrarSesion(): Promise<void> {
    await this.abrirMenuDeCuenta();
    await this.clic(this.cerrar);
  }

  /** `true` si el botón de navegación en cajón está a la vista (pantalla angosta). */
  async tieneBotonDeMenu(): Promise<boolean> {
    return (await this.driver.findElements(this.menuHamburguesa)).length > 0;
  }

  async abrirNavegacion(): Promise<void> {
    await this.clic(this.menuHamburguesa);
  }

  /** `true` cuando hay más de una organización y el selector aparece. */
  async tieneSelectorDeOrganizacion(): Promise<boolean> {
    return (await this.driver.findElements(this.organizacion)).length > 0;
  }

  /** Cierra el menú de cuenta con Escape, que es como lo cierra el teclado. */
  async cerrarMenuConEscape(): Promise<void> {
    await this.driver.actions().sendKeys(Key.ESCAPE).perform();
    await esperarAusente(this.driver, this.cerrar);
  }
}
