import { By } from 'selenium-webdriver';

import { BaseComponent } from '../core/base.component';
import { contar, esperarVisible } from '../core/wait.helpers';

/**
 * Avisos (toasts).
 *
 * ## Por qué se prueban sobre la vitrina y no sobre una cola viva
 *
 * En el artefacto de producción **no hay ninguna cola**: el aviso es una pieza
 * presentacional y el único disparador que existe hoy —el panel de desarrollo—
 * vive tras un `@defer (when isDev)`, así que su fragmento ni siquiera se
 * descarga. Montar una cola artificial para probarla sería probar el andamio.
 *
 * Lo que sí se puede fijar, y es lo que se rompe sin que nadie mire, es el
 * contrato de accesibilidad de cada aviso: **un error interrumpe
 * (`role="alert"`) y el resto espera turno (`role="status"`)**. Poner `alert`
 * en un aviso de éxito le pisa la frase a quien esté escuchando un lector de
 * pantalla, y eso no se ve en ninguna captura.
 */
export class ToastComponent extends BaseComponent {
  protected readonly raiz = By.css('.toast-gallery');

  private readonly avisos = By.css('.toast-gallery app-toast');

  async esperarAlguno(): Promise<void> {
    await esperarVisible(this.driver, this.avisos);
  }

  async cantidad(): Promise<number> {
    return contar(this.driver, this.avisos);
  }

  /** Mensajes visibles, en el orden en que están. */
  async mensajes(): Promise<string[]> {
    const nodos = await this.driver.findElements(By.css('.toast-gallery [data-testid="toast-mensaje"]'));
    const textos = await Promise.all(nodos.map(async (n) => (await n.getText()).trim()));
    return textos.filter((texto) => texto !== '');
  }

  /** El `role` de cada aviso: `alert` interrumpe, `status` espera turno. */
  async roles(): Promise<string[]> {
    const nodos = await this.driver.findElements(this.avisos);
    const roles = await Promise.all(nodos.map((n) => n.getAttribute('role')));
    return roles.map((rol) => rol ?? '');
  }

  /** El `role` del aviso de un tipo concreto, por su clase tonal. */
  async rolDelTipo(tipo: string): Promise<string | null> {
    const nodos = await this.driver.findElements(By.css(`.toast-gallery app-toast.toast--${tipo}`));
    const nodo = nodos[0];
    return nodo === undefined ? null : nodo.getAttribute('role');
  }

  /**
   * El tipo dicho en palabras, oculto a la vista.
   *
   * El color y el ícono no comunican solos: un aviso de error tiene que decir
   * «Error» para quien no ve ninguno de los dos.
   */
  async tipoEnPalabras(tipo: string): Promise<string> {
    const nodo = await esperarVisible(
      this.driver,
      By.css(`.toast-gallery app-toast.toast--${tipo}`),
    );
    const texto = await this.driver.executeScript<string>(
      "return arguments[0].querySelector('.sr-only')?.textContent ?? '';",
      nodo,
    );
    return texto.trim();
  }

  /** Cuántos avisos ofrecen cerrarse, y con qué nombre accesible. */
  async nombresDeCierre(): Promise<string[]> {
    const nodos = await this.driver.findElements(
      By.css('.toast-gallery [data-testid="toast-cerrar"]'),
    );
    const nombres = await Promise.all(nodos.map((n) => n.getAttribute('aria-label')));
    return nombres.map((nombre) => nombre ?? '');
  }
}
