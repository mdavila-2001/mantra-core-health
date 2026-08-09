import { By } from 'selenium-webdriver';

import { BasePage } from '../core/base.page';

/**
 * Recuperación de contraseña (`/auth/recuperar`).
 *
 * La confirmación dice lo mismo exista o no la cuenta: lo contrario permitiría
 * averiguar quién está registrado probando direcciones. El Page Object expone
 * las dos mitades —el formulario y la confirmación— porque la pantalla las
 * intercambia y una prueba tiene que poder distinguirlas.
 */
export class ForgotPasswordPage extends BasePage {
  protected readonly ruta = '/auth/recuperar';
  protected readonly marca = By.css('.recuperar__card');

  private readonly identificador = this.porTestId('recuperar-identifier');
  private readonly enviar = this.porTestId('recuperar-submit');
  private readonly exito = this.porTestId('recuperar-exito');
  private readonly error = this.porTestId('recuperar-error');

  async escribirIdentificador(valor: string): Promise<void> {
    await this.escribirEn(this.identificador, valor);
  }

  async enviarFormulario(): Promise<void> {
    await this.clic(this.enviar);
  }

  async pedirEnlace(identificador: string): Promise<void> {
    await this.escribirIdentificador(identificador);
    await this.enviarFormulario();
  }

  /** Espera la confirmación y devuelve su texto. */
  async esperarConfirmacion(): Promise<string> {
    return this.esperarTexto(this.exito, /\S/);
  }

  async hayConfirmacion(): Promise<boolean> {
    return this.existe(this.exito);
  }

  async mensajeDeError(): Promise<string | null> {
    return this.textoSiExiste(this.error);
  }

  /** El formulario ya no está: la pantalla pasó a su estado de confirmación. */
  async esperarFormularioReemplazado(): Promise<void> {
    await this.esperarAusente(this.porTestId('recuperar-form'));
  }
}
