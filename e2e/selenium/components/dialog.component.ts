import { By, Key } from 'selenium-webdriver';

import { BaseComponent } from '../core/base.component';
import { clicSeguro, esperarAusente, esperarVisible } from '../core/wait.helpers';

/**
 * Diálogo de confirmación.
 *
 * Está montado sobre el `<dialog>` **nativo**, y eso es justo lo que hay que
 * verificar en un navegador de verdad: `showModal()` trae el fondo, la
 * inertización de lo que queda detrás y el cierre con `Escape` sin que nadie
 * escriba una línea. En jsdom nada de eso existe —`showModal` no está
 * implementado— así que ninguna prueba unitaria puede afirmarlo.
 *
 * La regla que estas pruebas fijan: **cerrar nunca es confirmar**. Ni con
 * `Escape`, ni tocando el fondo, ni con el botón de cancelar.
 */
export class DialogComponent extends BaseComponent {
  protected readonly raiz = this.porTestId('dialogo');

  private readonly titulo = this.porTestId('dialogo-titulo');
  private readonly confirmar = this.porTestId('dialogo-confirmar');
  private readonly cancelar = this.porTestId('dialogo-cancelar');

  async esperarAbierto(): Promise<void> {
    await esperarVisible(this.driver, this.raiz);
  }

  async tituloVisible(): Promise<string> {
    return (await esperarVisible(this.driver, this.titulo)).getText();
  }

  async confirmar_(): Promise<void> {
    await clicSeguro(this.driver, this.confirmar);
    await this.esperarCerrado();
  }

  async cancelar_(): Promise<void> {
    await clicSeguro(this.driver, this.cancelar);
    await this.esperarCerrado();
  }

  /** Cierra con `Escape`, que es el camino de teclado del `<dialog>` nativo. */
  async cerrarConEscape(): Promise<void> {
    await this.driver.actions().sendKeys(Key.ESCAPE).perform();
    await this.esperarCerrado();
  }

  async esperarCerrado(): Promise<void> {
    await esperarAusente(this.driver, this.raiz);
  }

  /**
   * `true` si el foco está dentro del diálogo.
   *
   * Un modal que no se lleva el foco deja a quien navega con teclado tabulando
   * por la página de atrás sin saber que hay algo abierto delante.
   */
  async tieneElFoco(): Promise<boolean> {
    const dentro = await this.driver.executeScript<boolean>(
      `const dialogo = document.querySelector('[data-testid="dialogo"]');
       return !!dialogo && dialogo.contains(document.activeElement);`,
    );
    return dentro === true;
  }

  /**
   * `true` si lo que quedó detrás no se puede usar.
   *
   * `showModal()` marca el resto del documento como inerte: cualquier elemento
   * de fuera deja de recibir eventos de puntero. Se comprueba preguntándole al
   * navegador qué elemento hay en un punto del fondo — si es el `<dialog>` o su
   * contenido, el fondo está tapado de verdad.
   */
  async elFondoEstaBloqueado(): Promise<boolean> {
    const bloqueado = await this.driver.executeScript<boolean>(
      `const dialogo = document.querySelector('[data-testid="dialogo"]');
       if (!dialogo) { return false; }
       const enLaEsquina = document.elementFromPoint(4, 4);
       return enLaEsquina === null || dialogo === enLaEsquina || dialogo.contains(enLaEsquina);`,
    );
    return bloqueado === true;
  }

  /** El primer elemento enfocable del diálogo, para comprobar dónde aterriza el foco. */
  async elementoEnfocado(): Promise<string> {
    const texto = await this.driver.executeScript<string>(
      `const activo = document.activeElement;
       return activo ? (activo.getAttribute('data-testid') || activo.tagName.toLowerCase()) : '';`,
    );
    return texto;
  }

  /** Los dos botones del diálogo, en el orden en que están en el DOM. */
  async accionesEnOrden(): Promise<string[]> {
    const botones = await this.todosDentro(By.css('button'));
    const textos = await Promise.all(botones.map(async (b) => (await b.getText()).trim()));
    return textos.filter((texto) => texto !== '');
  }
}
