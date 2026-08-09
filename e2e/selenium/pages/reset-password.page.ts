import { By } from 'selenium-webdriver';

import { BasePage } from '../core/base.page';

/**
 * Nueva contraseña (`/auth/nueva-clave?token=…`).
 *
 * Como la verificación de correo, el token viaja por la barra de direcciones.
 * A diferencia de aquélla, acá hay un formulario de por medio y una consecuencia
 * que la pantalla **tiene que decir en palabras**: guardar la contraseña cierra
 * las otras sesiones abiertas.
 */
export class ResetPasswordPage extends BasePage {
  protected readonly ruta = '/auth/nueva-clave';
  protected readonly marca = By.css('.nueva-clave__card');

  private readonly sinToken = this.porTestId('nueva-clave-sin-token');
  private readonly ok = this.porTestId('nueva-clave-ok');
  private readonly formulario = this.porTestId('nueva-clave-form');
  private readonly password = this.porTestId('nueva-clave-password');
  private readonly enviar = this.porTestId('nueva-clave-submit');
  private readonly error = this.porTestId('nueva-clave-error');
  private readonly irLogin = this.porTestId('nueva-clave-ir-login');

  async abrirConToken(token: string, escenario?: Parameters<BasePage['abrir']>[0]): Promise<void> {
    await this.abrir(escenario, `${this.ruta}?token=${encodeURIComponent(token)}`);
  }

  async abrirSinToken(escenario?: Parameters<BasePage['abrir']>[0]): Promise<void> {
    await this.abrir(escenario, this.ruta);
  }

  async esperarSinToken(): Promise<string> {
    return this.esperarTexto(this.sinToken, /\S/);
  }

  /** `true` si la pantalla ofrece el formulario (es decir, si hubo token). */
  async tieneFormulario(): Promise<boolean> {
    return this.existe(this.formulario);
  }

  async escribirPassword(valor: string): Promise<void> {
    await this.escribirEn(this.password, valor);
  }

  async enviarFormulario(): Promise<void> {
    await this.clic(this.enviar);
  }

  async cambiarPassword(nueva: string): Promise<void> {
    await this.escribirPassword(nueva);
    await this.enviarFormulario();
  }

  /** Espera la confirmación y devuelve su texto completo, con el aviso de sesiones. */
  async esperarConfirmacion(): Promise<string> {
    await this.esperarTexto(this.ok, /\S/);
    return (await this.texto(By.css('.nueva-clave__text'))).trim();
  }

  async esperarError(): Promise<string> {
    return this.esperarTexto(this.error, /\S/);
  }

  async mensajeDeError(): Promise<string | null> {
    return this.textoSiExiste(this.error);
  }

  async mensajesDeValidacion(): Promise<string[]> {
    const elementos = await this.elementos(By.css('.form-field-error'));
    const textos = await Promise.all(elementos.map(async (e) => (await e.getText()).trim()));
    return textos.filter((texto) => texto !== '');
  }

  /** Espera a que aparezcan los mensajes de campo. Ver `LoginPage`. */
  async esperarMensajesDeValidacion(minimo = 1): Promise<string[]> {
    await this.driver.wait(
      async () => (await this.elementos(By.css('.form-field-error'))).length >= minimo,
      15_000,
      `Nunca aparecieron ${minimo} mensajes de campo obligatorio.`,
    );
    return this.mensajesDeValidacion();
  }

  async irALogin(): Promise<void> {
    await this.clic(this.irLogin);
  }
}
