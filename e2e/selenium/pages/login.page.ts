import { By, type Locator } from 'selenium-webdriver';

import { BasePage } from '../core/base.page';
import type { UsuarioPrueba } from '../fixtures/usuarios.fixture';

/**
 * Pantalla de inicio de sesión (`/auth`).
 *
 * Un solo campo de identificador porque el backend acepta correo **o**
 * documento y nunca los dos; la pantalla decide cuál es por la arroba. El Page
 * Object no repite esa regla: manda el texto tal cual y deja que la aplicación
 * la aplique, que es lo que hay que probar.
 */
export class LoginPage extends BasePage {
  protected readonly ruta = '/auth';
  protected readonly marca = this.porTestId('login-form');

  private readonly identificador = this.porTestId('login-identifier');
  private readonly password = this.porTestId('login-password');
  private readonly mfa = this.porTestId('login-mfa');
  private readonly enviar = this.porTestId('login-submit');
  private readonly error = this.porTestId('login-error');
  private readonly enlaceRecuperar = this.porTestId('login-recuperar');
  private readonly enlaceRegistro = this.porTestId('login-registro');

  /** El botón de mostrar/ocultar que vive dentro del campo de contraseña. */
  private readonly verPassword: Locator = By.css('[data-testid="login-password"] ~ button');

  async escribirIdentificador(valor: string): Promise<void> {
    await this.escribirEn(this.identificador, valor);
  }

  async escribirPassword(valor: string): Promise<void> {
    await this.escribirEn(this.password, valor);
  }

  async escribirCodigoMfa(valor: string): Promise<void> {
    await this.escribirEn(this.mfa, valor);
  }

  async enviarFormulario(): Promise<void> {
    await this.clic(this.enviar);
  }

  /** El camino completo: credenciales y envío. Es el que usan casi todas las pruebas. */
  async entrar(usuario: UsuarioPrueba): Promise<void> {
    await this.escribirIdentificador(usuario.identificador);
    await this.escribirPassword(usuario.password);
    await this.enviarFormulario();
  }

  /** Mensaje de error de la pantalla, o `null` si no hay ninguno. */
  async mensajeDeError(): Promise<string | null> {
    return this.textoSiExiste(this.error);
  }

  /** Espera a que aparezca un error y devuelve su texto. */
  async esperarError(): Promise<string> {
    return this.esperarTexto(this.error, /\S/);
  }

  /**
   * Mensajes de campo obligatorio, en orden de aparición.
   *
   * `.form-field-error` es la clase que pinta `app-form-field`, y esos nodos
   * llevan `role="alert"`: se localizan por la clase del sistema de diseño para
   * no arrastrar también el error general de la pantalla, que es otra cosa.
   */
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

  /** `true` mientras el envío está en curso: el botón se marca ocupado. */
  async estaEnviando(): Promise<boolean> {
    const boton = await this.esperarPresente(this.enviar);
    return (await boton.getAttribute('aria-busy')) === 'true';
  }

  async irARecuperarPassword(): Promise<void> {
    await this.clic(this.enlaceRecuperar);
  }

  async irARegistro(): Promise<void> {
    await this.clic(this.enlaceRegistro);
  }

  /** Tipo real del campo de contraseña: `password` oculta, `text` revela. */
  async tipoDelCampoPassword(): Promise<string> {
    // El atributo siempre está —lo pone la plantilla— pero el tipo lo declara
    // anulable: un `?? ''` deja el fallo en la afirmación de la prueba, con su
    // mensaje, en vez de en un error de nulo sin contexto.
    const campo = await this.elemento(this.password);
    return (await campo.getAttribute('type')) ?? '';
  }

  /**
   * Espera a que el campo llegue al tipo pedido y lo devuelve.
   *
   * Revelar la contraseña cambia un `computed` del componente, y el atributo
   * `type` del `<input>` se actualiza en el ciclo siguiente al clic: leerlo
   * enseguida devuelve el de antes. Hasta que las esperas dejaron de dormir de
   * más por las animaciones, esta carrera estaba tapada.
   */
  async esperarTipoDelCampoPassword(esperado: 'password' | 'text'): Promise<string> {
    let ultimo = '';
    await this.driver.wait(
      async () => {
        ultimo = await this.tipoDelCampoPassword();
        return ultimo === esperado;
      },
      15_000,
      `El campo de contraseña nunca pasó a «${esperado}»; quedó en «${ultimo}».`,
    );
    return ultimo;
  }

  async alternarVisibilidadPassword(): Promise<void> {
    await this.clic(this.verPassword);
  }

  /** Espera a haber salido del login: la señal de que la sesión se abrió. */
  async esperarSalidaDelLogin(): Promise<void> {
    await this.esperarUrl(/\/(panel|auth\/organizacion)$/);
  }
}
