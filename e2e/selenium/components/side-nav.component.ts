import { By } from 'selenium-webdriver';

import { BaseComponent } from '../core/base.component';

/**
 * Navegación lateral.
 *
 * En pantallas angostas se convierte en un cajón que se abre desde el
 * encabezado; en anchas es una columna fija. Es el mismo componente en los dos
 * casos, así que las pruebas responsive comprueban **el mismo** contrato de
 * navegación con el panel abierto de una forma o de la otra.
 */
export class SideNavComponent extends BaseComponent {
  protected readonly raiz = By.css('nav[aria-label="Navegación principal"]');

  private readonly enlaces = this.porTestId('nav-enlace');

  /** Etiquetas visibles de los ítems del menú, en orden. */
  async elementos(): Promise<string[]> {
    const nodos = await this.driver.findElements(this.enlaces);
    const textos = await Promise.all(nodos.map(async (n) => (await n.getText()).trim()));
    return textos.filter((texto) => texto !== '');
  }

  /** Las rutas a las que lleva el menú. Es el contrato que no puede romperse. */
  async rutas(): Promise<string[]> {
    const nodos = await this.driver.findElements(this.enlaces);
    const rutas = await Promise.all(nodos.map((n) => n.getAttribute('data-route')));
    return rutas.filter((ruta): ruta is string => ruta !== null && ruta !== '');
  }

  async irA(ruta: string): Promise<void> {
    await this.clic(By.css(`[data-testid="nav-enlace"][data-route="${ruta}"]`));
  }

  /**
   * La ruta marcada como actual.
   *
   * `aria-current="page"` es lo que anuncia un lector de pantalla; comprobarlo
   * verifica de paso que la marca de «acá estás» no sea solo un color.
   */
  async rutaActual(): Promise<string | null> {
    const activos = await this.driver.findElements(
      By.css('[data-testid="nav-enlace"][aria-current="page"]'),
    );
    return activos.length === 0 ? null : activos[0]!.getAttribute('data-route');
  }
}
