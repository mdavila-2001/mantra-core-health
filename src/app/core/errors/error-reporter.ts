import { Injectable, isDevMode, signal } from '@angular/core';

/** Contexto mínimo que acompaña a un fallo. */
export interface ErrorContext {
  readonly version: string;
  readonly commit: string;
  readonly route: string;
}

/** Un fallo ya registrado, con su identificador. */
export interface ReportedError {
  readonly id: string;
  readonly message: string;
  readonly context: ErrorContext;
  readonly at: Date;
}

/**
 * Registro de fallos del cliente.
 *
 * ## Por qué no manda nada a ningún lado (todavía)
 *
 * Elegir destino remoto es una decisión con consecuencias de privacidad que en
 * un sistema de salud no son menores: un servicio de terceros vería la ruta que
 * cada persona visita, y **la sección visitada ya es información de salud**.
 * Esa decisión no se toma escribiendo un servicio.
 *
 * Lo que sí se puede hacer sin decidirla —y es lo que falta hoy— es que el
 * fallo **deje de ser invisible para quien lo sufre**: que tenga identificador,
 * que se pueda reportar, y que exista un punto único al que enchufar el destino
 * el día que se elija. Ese punto es {@link report}.
 *
 * ## Qué se registra, y qué no
 *
 * El mensaje del error, la versión, el commit y la ruta. **Nada más.**
 *
 * No se registra el `stack` —puede contener valores interpolados en plantillas—
 * ni el usuario, ni el tenant, ni nada del formulario. La regla es la misma que
 * para cualquier telemetría de este proyecto: lo que no se puede demostrar que
 * no lleva datos de salud, no viaja.
 */
@Injectable({
  providedIn: 'root',
})
export class ErrorReporter {
  /**
   * Los últimos fallos, para que la pantalla de recuperación pueda mostrar el
   * identificador del que la provocó.
   *
   * Se acota a los últimos {@link MAX_REGISTRADOS}: es un registro para
   * reportar, no un historial.
   */
  private readonly registrados = signal<readonly ReportedError[]>([]);

  readonly ultimo = signal<ReportedError | null>(null);

  private contador = 0;

  /**
   * Registra un fallo y devuelve su identificador.
   *
   * El identificador es local y legible por teléfono: no pretende ser único en
   * el mundo, pretende que alguien lo pueda dictar. Se combina con la versión
   * del artefacto, que es lo que lo hace rastreable.
   */
  report(error: unknown, context: ErrorContext): string {
    this.contador += 1;
    const id = `E-${context.commit}-${String(this.contador).padStart(3, '0')}`;

    const registrado: ReportedError = {
      id,
      message: mensajeDe(error),
      context,
      at: new Date(),
    };

    this.ultimo.set(registrado);
    this.registrados.update((previos) =>
      [...previos, registrado].slice(-MAX_REGISTRADOS),
    );

    // Hasta que exista destino remoto, la consola es el único registro. Se
    // emite siempre —también en producción— porque un fallo sin rastro es
    // indistinguible de un fallo que no ocurrió.
    console.error(`[${id}] ${registrado.message} · ${context.version} · ${context.route}`);

    if (isDevMode()) {
      // El objeto original solo en desarrollo: en producción su contenido es
      // impredecible y podría arrastrar datos a la consola de quien mire.
      console.error(error);
    }

    return id;
  }

  /** Los fallos registrados en esta sesión, del más viejo al más nuevo. */
  historial(): readonly ReportedError[] {
    return this.registrados();
  }
}

const MAX_REGISTRADOS = 20;

/**
 * Un mensaje legible, sin la traza.
 *
 * `Error` cubre el caso normal; el resto se convierte con cuidado porque un
 * `throw 'texto'` o un `throw { … }` son legales en JavaScript y llegan acá.
 */
function mensajeDe(error: unknown): string {
  if (error instanceof Error) {
    return error.message === '' ? error.name : error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Error sin mensaje';
}
