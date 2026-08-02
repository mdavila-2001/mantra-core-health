import { By, type WebElement } from 'selenium-webdriver';

import { BaseComponent } from '../core/base.component';
import { clicSeguro, contar, esperarVisible } from '../core/wait.helpers';

/**
 * Tabla de datos.
 *
 * Se prueba sobre la vitrina del sistema de diseño, que es donde hoy vive la
 * única instancia con datos: ninguna pantalla de producto la usa todavía. Que
 * la prueba exista antes que la pantalla es deliberado — el día que se escriba
 * el primer listado real, el contrato de la tabla ya está fijado.
 *
 * Lo que se afirma es el contrato **observable**: qué filas hay, cómo se
 * anuncia el orden (`aria-sort`, no un color) y que la paginación por cursor
 * solo ofrezca anterior y siguiente, porque un cursor no conoce el total.
 */
export class DataTableComponent extends BaseComponent {
  protected readonly raiz = this.porTestId('tabla');

  private readonly filas = this.porTestId('tabla-fila');
  private readonly ordenar = this.porTestId('tabla-ordenar');
  private readonly anterior = this.porTestId('tabla-anterior');
  private readonly siguiente = this.porTestId('tabla-siguiente');

  async esperarCargada(): Promise<void> {
    await esperarVisible(this.driver, this.raiz);
  }

  async cantidadDeFilas(): Promise<number> {
    return contar(this.driver, this.filas);
  }

  /** El texto de cada fila, útil para comprobar que el orden cambió de verdad. */
  async filasVisibles(): Promise<string[]> {
    const nodos = await this.driver.findElements(this.filas);
    return Promise.all(nodos.map(async (n) => (await n.getText()).replace(/\s+/g, ' ').trim()));
  }

  /** Encabezados de columna que ofrecen ordenar. */
  async columnasOrdenables(): Promise<string[]> {
    const nodos = await this.driver.findElements(this.ordenar);
    const claves = await Promise.all(nodos.map((n) => n.getAttribute('data-columna')));
    return claves.filter((clave): clave is string => clave !== null && clave !== '');
  }

  async ordenarPor(columna: string): Promise<void> {
    await clicSeguro(this.driver, By.css(`[data-testid="tabla-ordenar"][data-columna="${columna}"]`));
  }

  /**
   * Cómo se anuncia el orden de una columna.
   *
   * `aria-sort` es lo que oye quien usa lector de pantalla. Sin él, la flechita
   * de la cabecera solo existe para quien ve.
   */
  async ordenAnunciado(columna: string): Promise<string | null> {
    const celda = await this.celdaDeCabecera(columna);
    return celda === null ? null : celda.getAttribute('aria-sort');
  }

  /**
   * Espera a que el orden anunciado cambie respecto del anterior.
   *
   * La cabecera **no decide** el orden: emite el pedido, el contenedor actualiza
   * su estado y la tabla lo vuelve a recibir por `input`. Ese viaje de ida y
   * vuelta pasa en el ciclo siguiente al clic, así que leer `aria-sort`
   * inmediatamente devuelve el valor de antes.
   */
  async esperarOrdenAnunciado(columna: string, distintoDe: string | null): Promise<string | null> {
    let ultimo: string | null = null;
    await this.driver.wait(
      async () => {
        ultimo = await this.ordenAnunciado(columna);
        return ultimo !== null && ultimo !== 'none' && ultimo !== distintoDe;
      },
      15_000,
      `El orden anunciado de «${columna}» nunca dejó de ser ${distintoDe ?? 'nulo'}.`,
    );
    return ultimo;
  }

  private async celdaDeCabecera(columna: string): Promise<WebElement | null> {
    const botones = await this.driver.findElements(
      By.css(`[data-testid="tabla-ordenar"][data-columna="${columna}"]`),
    );
    const boton = botones[0];
    if (boton === undefined) {
      return null;
    }
    return boton.findElement(By.xpath('./ancestor::th[1]'));
  }

  async puedeIrAlSiguiente(): Promise<boolean> {
    return this.estaHabilitado(this.siguiente);
  }

  async puedeIrAlAnterior(): Promise<boolean> {
    return this.estaHabilitado(this.anterior);
  }

  async irAlSiguiente(): Promise<void> {
    await clicSeguro(this.driver, this.siguiente);
  }

  private async estaHabilitado(locator: Parameters<typeof contar>[1]): Promise<boolean> {
    const nodos = await this.driver.findElements(locator);
    const boton = nodos[0];
    if (boton === undefined) {
      return false;
    }
    // El sistema deshabilita con `aria-disabled`, no con el atributo nativo: el
    // botón sigue siendo enfocable y el lector anuncia el estado en vez de
    // hacer desaparecer el control.
    return (await boton.getAttribute('aria-disabled')) !== 'true';
  }

  /**
   * Espera a que el botón de volver quede habilitado.
   *
   * Mover el cursor pide datos, así que el estado del botón cambia un momento
   * después del clic: preguntarlo enseguida devolvería el valor anterior.
   */
  async esperarPuedaVolver(): Promise<boolean> {
    await this.driver.wait(
      async () => this.puedeIrAlAnterior(),
      15_000,
      'El botón «Anterior» nunca se habilitó tras avanzar el cursor.',
    );
    return true;
  }

  /** Cuántas filas están marcadas. */
  async filasSeleccionadas(): Promise<number> {
    const marcadas = await this.driver.findElements(
      By.css('[data-testid="tabla-fila"] .data-table__select-cell input:checked'),
    );
    return marcadas.length;
  }

  /** Casillas de selección de fila, cuando la tabla es seleccionable. */
  async seleccionarFila(indice: number): Promise<void> {
    const casillas = await this.driver.findElements(
      By.css('[data-testid="tabla-fila"] .data-table__select-cell label'),
    );
    const casilla = casillas[indice];
    if (casilla === undefined) {
      throw new Error(`No hay fila ${indice} para seleccionar.`);
    }
    await casilla.click();
  }
}
