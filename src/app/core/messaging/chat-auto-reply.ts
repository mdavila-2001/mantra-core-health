import { DOCUMENT, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Dónde se guarda la configuración, en este navegador. */
const CLAVE = 'alovida.chat-respuesta-automatica';

/** Dónde se anota la última vez que se estuvo en la mensajería. */
const CLAVE_ACTIVIDAD = 'alovida.chat-ultima-actividad';

/** El texto por defecto. Se puede cambiar entero; esto es sólo el arranque. */
export const RESPUESTA_POR_DEFECTO =
  'Gracias por escribir. En este momento no estoy disponible; te respondo apenas pueda. Si es una urgencia, llamá al servicio de emergencias.';

/** Entre cuánto y cuánto se puede pedir la espera, en minutos. */
export const MINUTOS_MINIMO = 1;
export const MINUTOS_MAXIMO = 1440;

/** Entre cuánto y cuánto puede valer el descanso entre avisos, en horas. */
export const HORAS_MINIMO = 1;
export const HORAS_MAXIMO = 168;

/** Lo más largo que puede ser el texto — el mismo tope que un mensaje. */
export const LARGO_MAXIMO = 4000;

/** La configuración, tal como se guarda y como la lee la pantalla. */
export interface RespuestaAutomatica {
  /** Si está encendida. Apagada, nada de lo demás importa. */
  readonly activa: boolean;
  /**
   * Cuántos minutos sin actividad tuya hacen falta para que conteste sola.
   *
   * «Actividad» es haber abierto la mensajería, leído un chat o escrito algo:
   * lo que demuestra que estás. Si estás, nadie tiene que contestar por vos.
   */
  readonly minutosDeInactividad: number;
  /** Lo que contesta. */
  readonly texto: string;
  /**
   * Cuántas horas espera antes de volver a contestarle a la **misma persona**.
   *
   * Sin esto, cinco mensajes seguidos de alguien que no obtiene respuesta se
   * convierten en cinco avisos idénticos, que es peor que ninguno.
   */
  readonly horasEntreAvisos: number;
  /**
   * Si sólo contesta fuera del horario declarado abajo.
   *
   * Apagado, la inactividad alcanza. Encendido, además tiene que estar fuera de
   * la franja: dentro del horario de atención se supone que vas a contestar.
   */
  readonly soloFueraDeHorario: boolean;
  /** Desde qué hora atendés, en formato `HH:MM`. */
  readonly horarioDesde: string;
  /** Hasta qué hora atendés, en formato `HH:MM`. */
  readonly horarioHasta: string;
}

export const CONFIGURACION_POR_DEFECTO: RespuestaAutomatica = {
  activa: false,
  minutosDeInactividad: 30,
  texto: RESPUESTA_POR_DEFECTO,
  horasEntreAvisos: 4,
  soloFueraDeHorario: false,
  horarioDesde: '08:00',
  horarioHasta: '18:00',
};

/**
 * La respuesta automática por inactividad, y cuándo estuviste por última vez.
 *
 * ## Qué regla implementa
 *
 * «Si alguien me escribe y hace **N minutos** que no aparezco por la
 * mensajería, se le contesta sola con mi texto — y no más de una vez cada
 * **M horas** por persona.»
 *
 * Las tres cosas son configurables, más el texto y una franja horaria
 * opcional: es lo que pidió el propietario —«todo configurable»—.
 *
 * ## Por qué en el navegador, y qué falta para que no lo esté
 *
 * Porque **no hay dónde guardarlo**: `community.conversation_participants`
 * sólo tiene `muted_until`, y no existe ninguna tabla de preferencias de chat
 * por perfil. Igual que las plantillas y los favoritos, esto vive en
 * `localStorage` hasta que el modelo declare su tabla —ver `[[S6]]` del plan:
 * `community.chat_auto_replies` (perfil, activa, minutos, texto, descanso,
 * franja)—. El día que exista, esta clase cambia de origen y ninguna pantalla
 * se entera: por eso expone señales y no acceso al almacenamiento.
 *
 * Mientras viva acá tiene un límite que conviene decir en voz alta: **sólo
 * contesta con la aplicación abierta**. Una respuesta automática de verdad la
 * manda el servidor aunque tengas el navegador cerrado, y eso es exactamente
 * lo que el carril de backend viene a resolver.
 *
 * ## SSR
 *
 * Sin `localStorage` en el servidor la configuración es la de fábrica —apagada—
 * y no hay actividad registrada. Es la respuesta correcta: el servidor no sabe
 * de quién es la sesión que va a hidratar.
 */
@Injectable({ providedIn: 'root' })
export class ChatAutoReply {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly configuracion = signal<RespuestaAutomatica>(this.leer());

  /** Guarda la configuración, con sus valores acotados a lo que se admite. */
  guardar(cambios: Partial<RespuestaAutomatica>): void {
    const siguiente = sanear({ ...this.configuracion(), ...cambios });
    this.configuracion.set(siguiente);
    this.escribir(CLAVE, JSON.stringify(siguiente));
  }

  /** Vuelve a lo de fábrica. */
  restablecer(): void {
    this.configuracion.set(CONFIGURACION_POR_DEFECTO);
    this.escribir(CLAVE, JSON.stringify(CONFIGURACION_POR_DEFECTO));
  }

  /**
   * Anota que estuviste.
   *
   * Lo llama el store al cargar la bandeja, al abrir un hilo y al escribir. Se
   * guarda en el navegador y no en memoria para que cerrar la pestaña y volver
   * a los dos minutos no cuente como media hora de ausencia.
   */
  marcarActividad(): void {
    this.escribir(CLAVE_ACTIVIDAD, String(Date.now()));
  }

  /** Cuándo fue la última actividad, o `null` si no hay ninguna anotada. */
  ultimaActividad(): number | null {
    const crudo = this.leerCrudo(CLAVE_ACTIVIDAD);
    if (crudo === null) {
      return null;
    }
    const instante = Number(crudo);
    return Number.isFinite(instante) ? instante : null;
  }

  /**
   * `true` si corresponde contestar solo ahora mismo.
   *
   * @param ahora - En qué instante se pregunta.
   * @param ultimoAvisoAEstaPersona - Cuándo se le contestó por última vez a
   *   esta misma persona, o `null` si nunca.
   */
  corresponde(ahora: number, ultimoAvisoAEstaPersona: number | null): boolean {
    const config = this.configuracion();
    if (!config.activa) {
      return false;
    }

    // Sin actividad anotada no se supone ausencia: puede ser la primera vez que
    // se abre la aplicación en este navegador, y contestar solo ahí sería
    // contestarle a alguien que sí está mirando la pantalla.
    const desde = this.ultimaActividad();
    if (desde === null || ahora - desde < config.minutosDeInactividad * 60_000) {
      return false;
    }

    if (
      ultimoAvisoAEstaPersona !== null &&
      ahora - ultimoAvisoAEstaPersona < config.horasEntreAvisos * 3_600_000
    ) {
      return false;
    }

    if (config.soloFueraDeHorario && dentroDeLaFranja(ahora, config)) {
      return false;
    }

    return true;
  }

  private escribir(clave: string, valor: string): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      this.document.defaultView?.localStorage.setItem(clave, valor);
    } catch {
      // Almacenamiento lleno o bloqueado. Lo elegido sigue valiendo en esta
      // sesión; no vale un cartel por algo que la persona no puede arreglar.
    }
  }

  private leerCrudo(clave: string): string | null {
    if (!this.isBrowser) {
      return null;
    }
    try {
      return this.document.defaultView?.localStorage.getItem(clave) ?? null;
    } catch {
      return null;
    }
  }

  private leer(): RespuestaAutomatica {
    const crudo = this.leerCrudo(CLAVE);
    if (crudo === null) {
      return CONFIGURACION_POR_DEFECTO;
    }
    try {
      const guardado: unknown = JSON.parse(crudo);
      if (typeof guardado !== 'object' || guardado === null) {
        return CONFIGURACION_POR_DEFECTO;
      }
      return sanear({ ...CONFIGURACION_POR_DEFECTO, ...guardado });
    } catch {
      // Un valor corrupto no puede dejar a nadie sin chat.
      return CONFIGURACION_POR_DEFECTO;
    }
  }
}

/**
 * Acota lo que llega a lo que se admite.
 *
 * Vale tanto para lo que escribe la pantalla como para lo que se lee del
 * almacenamiento: los dos pueden traer basura —el segundo, editado a mano— y
 * una espera de cero minutos convertiría la respuesta automática en un eco.
 */
function sanear(config: RespuestaAutomatica): RespuestaAutomatica {
  const texto = config.texto.trim().slice(0, LARGO_MAXIMO);
  return {
    activa: config.activa === true && texto !== '',
    minutosDeInactividad: acotar(
      config.minutosDeInactividad,
      MINUTOS_MINIMO,
      MINUTOS_MAXIMO,
      CONFIGURACION_POR_DEFECTO.minutosDeInactividad,
    ),
    texto: texto === '' ? RESPUESTA_POR_DEFECTO : texto,
    horasEntreAvisos: acotar(
      config.horasEntreAvisos,
      HORAS_MINIMO,
      HORAS_MAXIMO,
      CONFIGURACION_POR_DEFECTO.horasEntreAvisos,
    ),
    soloFueraDeHorario: config.soloFueraDeHorario === true,
    horarioDesde: hora(config.horarioDesde, CONFIGURACION_POR_DEFECTO.horarioDesde),
    horarioHasta: hora(config.horarioHasta, CONFIGURACION_POR_DEFECTO.horarioHasta),
  };
}

function acotar(valor: number, minimo: number, maximo: number, porDefecto: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return porDefecto;
  }
  return Math.min(maximo, Math.max(minimo, Math.round(valor)));
}

function hora(valor: string, porDefecto: string): string {
  return typeof valor === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/u.test(valor)
    ? valor
    : porDefecto;
}

/**
 * `true` si el instante cae dentro de la franja de atención.
 *
 * Una franja que termina antes de empezar —`22:00` a `06:00`— es la de quien
 * atiende de noche, y cruza la medianoche: se resuelve como la unión de los dos
 * tramos, no como un rango vacío.
 */
function dentroDeLaFranja(ahora: number, config: RespuestaAutomatica): boolean {
  const fecha = new Date(ahora);
  const minutos = fecha.getHours() * 60 + fecha.getMinutes();
  const desde = enMinutos(config.horarioDesde);
  const hasta = enMinutos(config.horarioHasta);
  return desde <= hasta
    ? minutos >= desde && minutos < hasta
    : minutos >= desde || minutos < hasta;
}

function enMinutos(hhmm: string): number {
  const [horas, minutos] = hhmm.split(':').map(Number);
  return horas * 60 + minutos;
}
