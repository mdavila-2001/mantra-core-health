import type { Locator, WebDriver, WebElement } from 'selenium-webdriver';

import { configuracion } from '../config/environment';
import {
  COOKIE_ESCENARIO,
  ESCENARIO_POR_DEFECTO,
  RUTA_ESCENARIO,
  type NombreEscenario,
} from '../fixtures/escenarios';
import {
  clicSeguro,
  contar,
  escribir,
  esperarAplicacionLista,
  esperarAusente,
  esperarInteractivo,
  esperarPresente,
  esperarTexto,
  esperarUrl,
  esperarVisible,
  porTestId,
} from './wait.helpers';

/**
 * Base de todos los Page Objects.
 *
 * Concentra lo que toda pantalla necesita —abrirse, esperar a estar viva, leer
 * un elemento por su identificador de prueba— para que cada página concreta
 * solo declare **sus selectores y sus acciones de negocio**. Una página que
 * empieza a exponer `driver.findElement` hacia afuera deja de ser un Page
 * Object: la spec vuelve a saber de DOM y el patrón deja de servir.
 */
export abstract class BasePage {
  /** Ruta de la pantalla dentro de la aplicación, con barra inicial. */
  protected abstract readonly ruta: string;

  /** Algo que solo existe cuando la pantalla ya está pintada. */
  protected abstract readonly marca: Locator;

  constructor(protected readonly driver: WebDriver) {}

  /**
   * Abre la pantalla con un escenario de API elegido.
   *
   * La navegación pasa por `/__e2e__/escenario`, que deja la cookie del
   * escenario y redirige: así la elección viaja en **una sola navegación** y no
   * hay una ventana en la que la aplicación pida datos antes de que el arnés
   * sepa qué tiene que responder.
   */
  async abrir(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO, ruta = this.ruta): Promise<void> {
    const { baseUrl } = configuracion();
    const destino = encodeURIComponent(ruta);
    await this.driver.get(`${baseUrl}${RUTA_ESCENARIO}?id=${escenario}&destino=${destino}`);
    await esperarAplicacionLista(this.driver);
  }

  /** Navega dentro de la aplicación conservando el escenario ya elegido. */
  async ir(ruta: string): Promise<void> {
    await this.driver.get(`${configuracion().baseUrl}${ruta}`);
    await esperarAplicacionLista(this.driver);
  }

  /** Recarga la página: es el `F5` que ninguna prueba unitaria puede hacer. */
  async recargar(): Promise<void> {
    await this.driver.navigate().refresh();
    await esperarAplicacionLista(this.driver);
  }

  async volverAtras(): Promise<void> {
    await this.driver.navigate().back();
    await esperarAplicacionLista(this.driver);
  }

  /** Espera a que la pantalla esté pintada. Es la postcondición de `abrir`. */
  async esperarCargada(): Promise<void> {
    await esperarVisible(this.driver, this.marca);
  }

  /** `true` si la pantalla está a la vista, sin esperar por ella. */
  async estaVisible(): Promise<boolean> {
    return (await contar(this.driver, this.marca)) > 0;
  }

  async urlActual(): Promise<string> {
    return this.driver.getCurrentUrl();
  }

  async titulo(): Promise<string> {
    return this.driver.getTitle();
  }

  /** El escenario de API que está activo en este navegador. */
  async escenarioActivo(): Promise<string | null> {
    const cookie = await this.driver.manage().getCookie(COOKIE_ESCENARIO).catch(() => null);
    return cookie?.value ?? null;
  }

  // --- Utilidades para las páginas concretas --------------------------------

  protected async clic(locator: Locator): Promise<void> {
    await clicSeguro(this.driver, locator);
  }

  protected async escribirEn(locator: Locator, valor: string): Promise<void> {
    await escribir(this.driver, locator, valor);
  }

  protected async texto(locator: Locator): Promise<string> {
    return (await esperarVisible(this.driver, locator)).getText();
  }

  protected async textoSiExiste(locator: Locator): Promise<string | null> {
    const elementos = await this.driver.findElements(locator);
    return elementos.length === 0 ? null : (await elementos[0]!.getText()).trim();
  }

  protected async existe(locator: Locator): Promise<boolean> {
    return (await contar(this.driver, locator)) > 0;
  }

  protected async elemento(locator: Locator): Promise<WebElement> {
    return esperarVisible(this.driver, locator);
  }

  protected async elementos(locator: Locator): Promise<WebElement[]> {
    return this.driver.findElements(locator);
  }

  protected porTestId(testId: string): Locator {
    return porTestId(testId);
  }

  protected async esperarUrl(patron: RegExp, ms?: number): Promise<void> {
    await esperarUrl(this.driver, patron, ms);
  }

  protected async esperarTexto(locator: Locator, patron: RegExp, ms?: number): Promise<string> {
    return esperarTexto(this.driver, locator, patron, ms);
  }

  protected async esperarPresente(locator: Locator, ms?: number): Promise<WebElement> {
    return esperarPresente(this.driver, locator, ms);
  }

  protected async esperarInteractivo(locator: Locator, ms?: number): Promise<WebElement> {
    return esperarInteractivo(this.driver, locator, ms);
  }

  protected async esperarAusente(locator: Locator, ms?: number): Promise<void> {
    await esperarAusente(this.driver, locator, ms);
  }
}
