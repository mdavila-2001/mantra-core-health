import { By } from 'selenium-webdriver';

import { BasePage } from '../core/base.page';

/**
 * Elección de organización (`/auth/organizacion`).
 *
 * Es una pantalla propia y no un paso del login porque **cambia qué datos se
 * ven**: mezclarla con las credenciales invita a pasarla por alto.
 */
export class TenantSelectionPage extends BasePage {
  protected readonly ruta = '/auth/organizacion';
  protected readonly marca = By.css('.tenant__card');

  private readonly opciones = this.porTestId('tenant-opcion');
  private readonly vacio = this.porTestId('tenant-vacio');

  /** Nombres de las organizaciones ofrecidas, en el orden en que aparecen. */
  async organizacionesOfrecidas(): Promise<string[]> {
    await this.esperarCargada();
    const botones = await this.elementos(this.opciones);
    return Promise.all(botones.map(async (b) => (await b.getText()).trim()));
  }

  /** Elige por nombre visible: es lo que hace una persona. */
  async elegir(nombre: string): Promise<void> {
    const botones = await this.elementos(this.opciones);
    for (const boton of botones) {
      if ((await boton.getText()).trim() === nombre) {
        await boton.click();
        return;
      }
    }
    throw new Error(`No hay ninguna organización llamada «${nombre}» para elegir.`);
  }

  /** Elige por identificador, cuando lo que importa es el dato y no la etiqueta. */
  async elegirPorId(tenantId: string): Promise<void> {
    await this.clic(By.css(`[data-testid="tenant-opcion"][data-tenant="${tenantId}"]`));
  }

  /** `true` cuando la cuenta no declara ninguna organización. */
  async estaVacia(): Promise<boolean> {
    return this.existe(this.vacio);
  }

  async mensajeDeVacio(): Promise<string | null> {
    return this.textoSiExiste(this.vacio);
  }
}
