import { By } from 'selenium-webdriver';

import { BasePage } from '../core/base.page';

/**
 * Verificación de correo (`/auth/verificar?token=…`).
 *
 * El token llega por la barra de direcciones, así que la pantalla se prueba
 * **navegando con query string**: es la única forma de reproducir lo que hace
 * quien abre el enlace del correo. Ninguna prueba unitaria puede hacerlo, porque
 * el token se lee del snapshot de la ruta al construir el componente.
 *
 * Los cuatro estados son excluyentes y cada uno tiene su identificador, así que
 * afirmar sobre ellos no depende de la redacción del texto.
 */
export class VerifyEmailPage extends BasePage {
  protected readonly ruta = '/auth/verificar';
  protected readonly marca = this.porTestId('verificar-ir-login');

  private readonly enCurso = this.porTestId('verificar-en-curso');
  private readonly ok = this.porTestId('verificar-ok');
  private readonly sinToken = this.porTestId('verificar-sin-token');
  private readonly invalido = this.porTestId('verificar-invalido');
  private readonly irLogin = this.porTestId('verificar-ir-login');

  /** Abre el enlace tal como llega en el correo. */
  async abrirConToken(token: string, escenario?: Parameters<BasePage['abrir']>[0]): Promise<void> {
    await this.abrir(escenario, `${this.ruta}?token=${encodeURIComponent(token)}`);
  }

  /** Abre el enlace incompleto: sin token en la dirección. */
  async abrirSinToken(escenario?: Parameters<BasePage['abrir']>[0]): Promise<void> {
    await this.abrir(escenario, this.ruta);
  }

  async esperarVerificado(): Promise<string> {
    return this.esperarTexto(this.ok, /\S/);
  }

  async esperarSinToken(): Promise<string> {
    return this.esperarTexto(this.sinToken, /\S/);
  }

  async esperarInvalido(): Promise<string> {
    return this.esperarTexto(this.invalido, /\S/);
  }

  /** `true` mientras el canje está en vuelo. */
  async estaVerificando(): Promise<boolean> {
    return this.existe(this.enCurso);
  }

  /**
   * El cuerpo del mensaje, que es donde vive el tono.
   *
   * Se lee aparte del título porque es lo que se puede perder sin que nada más
   * cambie: el título seguiría diciendo «ya no sirve» aunque el texto de abajo
   * se hubiera convertido en una alarma.
   */
  async mensajeTranquilizador(): Promise<string> {
    return (await this.texto(By.css('.verificacion__text'))).trim();
  }

  async irALogin(): Promise<void> {
    await this.clic(this.irLogin);
  }
}
