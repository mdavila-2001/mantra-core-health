import { By } from 'selenium-webdriver';

import { BasePage } from '../core/base.page';
import type { AltaPaciente } from '../fixtures/usuarios.fixture';

/**
 * Alta de cuenta (`/auth/registro`).
 *
 * La pantalla tiene dos formularios excluyentes —paciente y profesional— que un
 * grupo de opciones intercambia. Son contratos distintos: el paciente entra con
 * su documento y el correo es opcional; el profesional entra con su correo y
 * necesita matrícula y credencial.
 */
export class RegisterPage extends BasePage {
  protected readonly ruta = '/auth/registro';
  protected readonly marca = this.porTestId('registro-tipo');

  private readonly formPaciente = this.porTestId('registro-form-paciente');
  private readonly formProfesional = this.porTestId('registro-form-profesional');
  private readonly documento = this.porTestId('registro-documento');
  private readonly nombre = this.porTestId('registro-nombre');
  private readonly password = this.porTestId('registro-password');
  private readonly correo = this.porTestId('registro-correo');
  private readonly enviar = this.porTestId('registro-submit');
  private readonly exito = this.porTestId('registro-exito');
  private readonly error = this.porTestId('registro-error');

  /**
   * Cambia de tipo de cuenta.
   *
   * Se clica la etiqueta y no el `<input type="radio">`: el nativo está oculto
   * a la vista —lo dibuja el componente— y Selenium se niega a clicar lo que no
   * se ve. La etiqueta es además lo que toca una persona.
   */
  private async elegirTipo(valor: 'paciente' | 'profesional'): Promise<void> {
    await this.clic(By.css(`app-radio[value="${valor}"] .radio-container`));
  }

  async elegirProfesional(): Promise<void> {
    await this.elegirTipo('profesional');
    await this.elemento(this.formProfesional);
  }

  async elegirPaciente(): Promise<void> {
    await this.elegirTipo('paciente');
    await this.elemento(this.formPaciente);
  }

  async completarPaciente(datos: AltaPaciente, opciones: { conCorreo?: boolean } = {}): Promise<void> {
    await this.escribirEn(this.documento, datos.documento);
    await this.escribirEn(this.nombre, datos.nombre);
    await this.escribirEn(this.password, datos.password);
    if (opciones.conCorreo === true) {
      await this.escribirEn(this.correo, datos.correo);
    }
  }

  async enviarFormulario(): Promise<void> {
    await this.clic(this.enviar);
  }

  /** El camino feliz completo. */
  async registrarPaciente(datos: AltaPaciente, opciones: { conCorreo?: boolean } = {}): Promise<void> {
    await this.completarPaciente(datos, opciones);
    await this.enviarFormulario();
  }

  async esperarConfirmacion(): Promise<string> {
    return this.esperarTexto(this.exito, /\S/);
  }

  async esperarError(): Promise<string> {
    return this.esperarTexto(this.error, /\S/);
  }

  async mensajeDeError(): Promise<string | null> {
    return this.textoSiExiste(this.error);
  }

  /** Mensajes de campo obligatorio que la pantalla muestra al intentar enviar. */
  async mensajesDeValidacion(): Promise<string[]> {
    const elementos = await this.elementos(By.css('.form-field-error'));
    const textos = await Promise.all(elementos.map(async (e) => (await e.getText()).trim()));
    return textos.filter((texto) => texto !== '');
  }


  /**
   * Espera a que aparezcan los mensajes de campo y los devuelve.
   *
   * La espera **no es un detalle**: los mensajes los pinta Angular en el ciclo
   * siguiente al envío, así que leerlos justo después del clic devuelve una
   * lista vacía la mitad de las veces. Este es exactamente el tipo de carrera
   * que se arregla esperando por la condición, no subiendo una pausa.
   */
  async esperarMensajesDeValidacion(minimo = 1): Promise<string[]> {
    await this.driver.wait(
      async () => (await this.elementos(By.css('.form-field-error'))).length >= minimo,
      15_000,
      `Nunca aparecieron ${minimo} mensajes de campo obligatorio.`,
    );
    return this.mensajesDeValidacion();
  }

  /** Vuelve al login desde la confirmación. */
  async irALogin(): Promise<void> {
    await this.clic(this.porTestId('registro-ir-login'));
  }

  async estaEnFormularioProfesional(): Promise<boolean> {
    return this.existe(this.formProfesional);
  }
}
