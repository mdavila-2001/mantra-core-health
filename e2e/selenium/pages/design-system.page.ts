import { By } from 'selenium-webdriver';

import { BasePage } from '../core/base.page';

/**
 * Vitrina del sistema de diseño (`/design-system`).
 *
 * Es la única pantalla donde hoy existen, con datos y funcionando, el diálogo
 * de confirmación, los avisos flotantes y la tabla de datos. Probarlos acá no
 * es probar una demo: son **los mismos componentes** que van a usar las
 * pantallas de producto, y el contrato que se fija ahora es el que heredarán.
 *
 * La ruta además está **diferida**: entrar verifica de paso que el fragmento se
 * descargue: si no bajara, el router muestra la pantalla de recuperación en vez
 * de dejar la navegación muerta.
 */
export class DesignSystemPage extends BasePage {
  protected readonly ruta = '/design-system';
  protected readonly marca = By.css('app-design-system-sample');

  private readonly confirmarGuardado = this.porTestId('demo-confirmar-guardado');
  private readonly confirmarAnulacion = this.porTestId('demo-confirmar-anulacion');

  /** Abre el diálogo de confirmación no destructivo. */
  async pedirConfirmacionDeGuardado(): Promise<void> {
    await this.clic(this.confirmarGuardado);
  }

  /** Abre el diálogo de una acción destructiva, que se ve distinto y enfoca distinto. */
  async pedirConfirmacionDestructiva(): Promise<void> {
    await this.clic(this.confirmarAnulacion);
  }

  /** Lo que la vitrina dice que pasó con la última confirmación. */
  async ultimaConfirmacion(): Promise<string> {
    return (await this.texto(this.porTestId('demo-ultima-confirmacion'))).trim();
  }

  /**
   * Espera a que la vitrina anote la respuesta del diálogo.
   *
   * Cerrar el `<dialog>` y anotar el resultado son dos cosas distintas: la
   * segunda ocurre cuando se resuelve la promesa de `confirm()`, en el ciclo
   * siguiente. Leerla justo después de que el diálogo desaparece devuelve el
   * valor inicial —«—»— una de cada tantas veces. Es la misma carrera de
   * siempre y se arregla igual: esperando por la condición.
   */
  async esperarUltimaConfirmacion(patron: RegExp): Promise<string> {
    return this.esperarTexto(this.porTestId('demo-ultima-confirmacion'), patron);
  }

  /**
   * Baja hasta los avisos de muestra.
   *
   * El panel de desarrollo que los lanzaba **no existe en el artefacto**: vive
   * tras un `@defer (when isDev)` y su fragmento no se descarga en producción.
   * Lo que sí está, y es lo que se prueba, son las muestras de los cuatro tipos.
   */
  async irALosAvisos(): Promise<void> {
    await this.desplazarHasta(By.css('.toast-gallery'));
  }

  /** Baja hasta la tabla: sin esto queda fuera de la ventana y el clic no llega. */
  async irALaTabla(): Promise<void> {
    await this.desplazarHasta(this.porTestId('tabla'));
  }

  /** La vitrina es larguísima: sin desplazarse, medio contenido queda fuera. */
  private async desplazarHasta(locator: Parameters<BasePage['esperarPresente']>[0]): Promise<void> {
    const destino = await this.esperarPresente(locator);
    await this.driver.executeScript(
      'arguments[0].scrollIntoView({ block: "center", inline: "nearest" });',
      destino,
    );
  }
}
