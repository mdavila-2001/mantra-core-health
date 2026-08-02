import type { Locator, WebDriver, WebElement } from 'selenium-webdriver';

import { clicSeguro, contar, esperarAusente, esperarVisible, porTestId } from './wait.helpers';

/**
 * Base de los componentes compartidos.
 *
 * Un componente es lo que aparece en **varias** pantallas —el encabezado, la
 * navegación, un modal, una notificación— y por eso no puede vivir dentro de un
 * Page Object: se duplicaría en cada pantalla que lo muestre, y el día que
 * cambie habría que corregirlo en todas.
 *
 * La diferencia con una página es el alcance: un componente busca **dentro de
 * su raíz**, no en todo el documento. Así dos instancias del mismo componente
 * en la misma pantalla no se confunden entre sí.
 */
export abstract class BaseComponent {
  /** Raíz del componente en el DOM. Todo lo demás se busca adentro. */
  protected abstract readonly raiz: Locator;

  constructor(protected readonly driver: WebDriver) {}

  /** `true` si el componente está en pantalla, sin esperar por él. */
  async estaVisible(): Promise<boolean> {
    return (await contar(this.driver, this.raiz)) > 0;
  }

  async esperarVisible(): Promise<WebElement> {
    return esperarVisible(this.driver, this.raiz);
  }

  async esperarAusente(): Promise<void> {
    await esperarAusente(this.driver, this.raiz);
  }

  protected async dentro(locator: Locator): Promise<WebElement> {
    const raiz = await esperarVisible(this.driver, this.raiz);
    return raiz.findElement(locator);
  }

  protected async todosDentro(locator: Locator): Promise<WebElement[]> {
    const raiz = await esperarVisible(this.driver, this.raiz);
    return raiz.findElements(locator);
  }

  protected async clic(locator: Locator): Promise<void> {
    await clicSeguro(this.driver, locator);
  }

  protected porTestId(testId: string): Locator {
    return porTestId(testId);
  }
}
