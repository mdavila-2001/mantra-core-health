import { By } from 'selenium-webdriver';

import { BasePage } from '../core/base.page';

/**
 * Pantalla de dirección inexistente.
 *
 * No tiene ruta propia: la sirve el comodín del router para cualquier
 * dirección que no exista. Antes esto redirigía a la raíz, que mandaba al panel
 * —o al login— a quien escribiera mal una dirección **sin decirle que se había
 * equivocado**; que ahora lo diga es justo lo que esta pantalla prueba.
 */
export class NotFoundPage extends BasePage {
  protected readonly ruta = '/esta-ruta-no-existe';
  protected readonly marca = this.porTestId('no-encontrado');

  private readonly titulo_ = By.css('[data-testid="no-encontrado"] .empty-state__title');
  private readonly volver = By.css('[data-testid="no-encontrado"] a');

  async mensaje(): Promise<string> {
    return (await this.texto(this.titulo_)).trim();
  }

  async volverAlInicio(): Promise<void> {
    await this.clic(this.volver);
  }
}
