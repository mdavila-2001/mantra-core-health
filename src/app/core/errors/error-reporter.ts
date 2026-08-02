import { inject, Injectable, isDevMode, signal } from '@angular/core';

import { ErrorTelemetry } from '../observability/errors/error-telemetry';

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
 * ## El destino remoto, y por qué éste sí
 *
 * Este archivo decía que elegir destino remoto era una decisión de privacidad
 * que no se toma escribiendo un servicio: un servicio de terceros vería la ruta
 * que cada persona visita, y **la sección visitada ya es información de salud**.
 *
 * El reparo era del *tercero*, no del envío. El destino que hay ahora es
 * propio: las trazas salen al mismo origen desde el que se sirvió la
 * aplicación, el servidor las reenvía a un Collector propio, y de ahí van a un
 * Jaeger propio. Ningún proveedor externo ve nada. Lo que este archivo dejaba
 * preparado —«un punto único al que enchufar el destino el día que se elija»—
 * es la llamada a {@link ErrorTelemetry} de {@link report}.
 *
 * La regla de qué viaja **no cambia**, y sigue fijada por las pruebas de este
 * archivo. La telemetría recibe el mismo error y aplica su propio saneado
 * encima, que es más estricto: ver `observability/errors/error-sanitizer.ts`.
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

  /**
   * El destino remoto. Con la telemetría apagada —el valor por defecto— este
   * servicio no hace nada y este archivo se comporta como antes.
   */
  private readonly telemetria = inject(ErrorTelemetry);

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

    /**
     * El identificador dictable viaja como atributo de la traza. Es lo que
     * cierra el circuito que hasta ahora solo funcionaba para los fallos de
     * API: quien recibe la llamada de soporte busca ese código y encuentra qué
     * pasó, también cuando el fallo fue de render y nunca hubo petición.
     *
     * Va al final y envuelto: un problema al exportar una traza no puede
     * impedir que el fallo original quede registrado.
     */
    try {
      this.telemetria.report(error, 'error-handler', id, context.route);
    } catch {
      // La observabilidad no puede ser el motivo de un fallo nuevo.
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
