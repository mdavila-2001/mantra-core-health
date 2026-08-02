import { By } from 'selenium-webdriver';

import { BasePage } from '../core/base.page';

/**
 * Panel (`/panel`), la primera pantalla con sesión.
 *
 * Tiene dos mitades que se prueban por separado: los datos que salen del propio
 * token —sin ninguna petición detrás— y la lectura real del directorio público,
 * que cruza el interceptor y la traducción de errores y se pinta con los
 * estados de vista.
 */
export class DashboardPage extends BasePage {
  protected readonly ruta = '/panel';
  protected readonly marca = this.porTestId('panel-sesion');

  private readonly userId = this.porTestId('panel-user-id');
  private readonly roles = this.porTestId('panel-roles');
  private readonly directorio = this.porTestId('panel-directorio');
  private readonly conteo = this.porTestId('panel-directorio-conteo');
  private readonly encabezado = By.css('h1');

  /** El identificador de la sesión, tal como lo declara el token. */
  async identificadorDeSesion(): Promise<string> {
    return (await this.texto(this.userId)).trim();
  }

  /** Roles mostrados como insignias. */
  async rolesVisibles(): Promise<string[]> {
    const insignias = await this.elementos(By.css('[data-testid="panel-roles"] app-badge'));
    const textos = await Promise.all(insignias.map(async (b) => (await b.getText()).trim()));
    return textos.filter((texto) => texto !== '');
  }

  async tituloVisible(): Promise<string> {
    return (await this.texto(this.encabezado)).trim();
  }

  async esperarDirectorio(): Promise<void> {
    await this.elemento(this.directorio);
  }

  /** Cuántos registros dice el panel que hay, o `null` si no lo dice. */
  async registrosDelDirectorio(): Promise<number | null> {
    const texto = await this.textoSiExiste(this.conteo);
    if (texto === null) {
      return null;
    }
    const numero = Number(/(\d+)/.exec(texto)?.[1] ?? NaN);
    return Number.isFinite(numero) ? numero : null;
  }

  /** Espera al conteo del directorio: la señal de que la lectura terminó bien. */
  async esperarConteoDelDirectorio(): Promise<number> {
    const texto = await this.esperarTexto(this.conteo, /\d+ registro/);
    return Number(/(\d+)/.exec(texto)?.[1] ?? 0);
  }

  /**
   * Espera a que el directorio muestre su estado de error.
   *
   * El estado de error de la aplicación es una región con `role="alert"` dentro
   * de la tarjeta: se localiza por rol y no por su texto, que puede cambiar de
   * redacción sin que el comportamiento cambie.
   */
  async esperarErrorDelDirectorio(): Promise<string> {
    return this.esperarTexto(By.css('[data-testid="panel-directorio"] [role="alert"]'), /\S/);
  }

  /**
   * El botón de reintentar del estado de error.
   *
   * La tarjeta ofrece dos botones —copiar el código de soporte y reintentar— y
   * se elige por su texto porque es lo único que los distingue; el orden dentro
   * del bloque de acciones no es un contrato.
   */
  async reintentarDirectorio(): Promise<void> {
    await this.clic(
      By.xpath('//*[@data-testid="panel-directorio"]//button[normalize-space()="Reintentar"]'),
    );
  }

  /** `true` mientras el directorio muestra su esqueleto de carga. */
  async estaCargandoDirectorio(): Promise<boolean> {
    return this.existe(By.css('[data-testid="panel-directorio"] app-skeleton'));
  }
}
