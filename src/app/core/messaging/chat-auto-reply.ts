import { DOCUMENT, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { CommunityClient } from '../data-access/community/community.client';

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
 * ## El servidor manda; el navegador es la copia local
 *
 * Desde el patch v4.2.9 la configuración vive en `community.chat_auto_replies`
 * y **la evalúa el servidor ante cada mensaje entrante**, así que contesta
 * aunque no haya ninguna pestaña abierta — que es lo que separa un contestador
 * de un recordatorio.
 *
 * Esta clase sigue guardando una copia en `localStorage` por dos razones
 * concretas, no por inercia:
 *
 * 1. **La pantalla abre con lo último que se vio**, sin esperar la lectura.
 * 2. **Sin perfil público no hay dónde guardar en el servidor** —la tabla
 *    cuelga de `public_profiles`—, y quien todavía no lo creó igual puede
 *    configurarla; se sube sola en cuanto el perfil exista.
 *
 * `corresponde()` se conserva para el mismo caso: mientras no haya perfil, el
 * navegador es el único que puede contestar, y sólo con la aplicación abierta.
 * Con perfil, la decisión ya la tomó el servidor y esta ruta no se usa.
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

  private readonly community = inject(CommunityClient);

  readonly configuracion = signal<RespuestaAutomatica>(this.leer());

  /** `true` mientras se sube o se baja del servidor. */
  readonly sincronizando = signal(false);

  /**
   * `true` si lo que se ve salió del servidor.
   *
   * `false` significa que sólo vive en este navegador —no hay perfil público
   * todavía, o la lectura falló—, y la pantalla lo dice: es la diferencia entre
   * «contesta siempre» y «contesta mientras tengas esto abierto».
   */
  readonly enElServidor = signal(false);

  /**
   * Trae la configuración del servidor y la adopta.
   *
   * Lo que hay en el servidor **gana** sobre la copia local: es lo que se está
   * aplicando de verdad, aunque se haya configurado desde otro dispositivo.
   *
   * @param profileId - El perfil público propio, o `null` si no tiene.
   */
  cargar(profileId: string | null): void {
    if (profileId === null) {
      this.enElServidor.set(false);
      return;
    }
    this.sincronizando.set(true);
    this.community.readAutoReply(profileId).subscribe({
      next: (remota) => {
        this.sincronizando.set(false);
        this.enElServidor.set(true);
        if (remota === null) {
          // Nunca se configuró en el servidor. Si hay algo local —de antes de
          // que existiera la tabla— se sube, en vez de perderlo en silencio.
          if (this.configuracion().activa) {
            this.subir(profileId);
          }
          return;
        }
        this.configuracion.set(sanear(desdeElServidor(remota)));
        this.escribir(CLAVE, JSON.stringify(this.configuracion()));
      },
      error: () => {
        this.sincronizando.set(false);
        this.enElServidor.set(false);
      },
    });
  }

  /**
   * Guarda la configuración, con sus valores acotados a lo que se admite.
   *
   * Se aplica en el acto y se sube después: la pantalla no tiene por qué
   * esperar a la red para acusar un interruptor.
   *
   * @param cambios - Lo que cambió.
   * @param profileId - El perfil propio, para subirlo. Sin él queda local.
   */
  guardar(cambios: Partial<RespuestaAutomatica>, profileId: string | null = null): void {
    const siguiente = sanear({ ...this.configuracion(), ...cambios });
    this.configuracion.set(siguiente);
    this.escribir(CLAVE, JSON.stringify(siguiente));
    if (profileId !== null) {
      this.subir(profileId);
    }
  }

  /** Sube lo que hay ahora mismo. */
  private subir(profileId: string): void {
    const config = this.configuracion();
    this.sincronizando.set(true);
    this.community
      .upsertAutoReply(profileId, {
        isActive: config.activa,
        inactivityMinutes: config.minutosDeInactividad,
        bodyText: config.texto,
        cooldownHours: config.horasEntreAvisos,
        onlyOutsideBusinessHours: config.soloFueraDeHorario,
        ...(config.soloFueraDeHorario
          ? {
              businessHoursFrom: config.horarioDesde,
              businessHoursTo: config.horarioHasta,
            }
          : {}),
      })
      .subscribe({
        next: () => {
          this.sincronizando.set(false);
          this.enElServidor.set(true);
        },
        error: () => {
          // Lo elegido sigue valiendo en este navegador; lo que no se puede
          // prometer es que conteste con la aplicación cerrada.
          this.sincronizando.set(false);
          this.enElServidor.set(false);
        },
      });
  }

  /**
   * Olvida la copia local de la configuración y la última actividad (TX-31).
   *
   * La fuente de verdad es la API (`GET/PUT /community/profiles/:id/auto-reply`);
   * lo que queda en el navegador es una copia para abrir la pantalla sin
   * esperar, y en un dispositivo compartido no debe sobrevivir a la sesión. Lo
   * corre `AuthService.logout` vía `SESSION_CLEANERS`.
   */
  olvidar(): void {
    this.configuracion.set(CONFIGURACION_POR_DEFECTO);
    this.enElServidor.set(false);
    if (!this.isBrowser) {
      return;
    }
    try {
      this.document.defaultView?.localStorage.removeItem(CLAVE);
      this.document.defaultView?.localStorage.removeItem(CLAVE_ACTIVIDAD);
    } catch {
      // Bloqueado: no hay nada que borrar ni forma de hacerlo.
    }
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

/** La configuración del servidor, con los nombres que usa la pantalla. */
function desdeElServidor(remota: {
  readonly isActive: boolean;
  readonly inactivityMinutes: number;
  readonly bodyText: string;
  readonly cooldownHours: number;
  readonly onlyOutsideBusinessHours: boolean;
  readonly businessHoursFrom?: string;
  readonly businessHoursTo?: string;
}): RespuestaAutomatica {
  return {
    activa: remota.isActive,
    minutosDeInactividad: remota.inactivityMinutes,
    texto: remota.bodyText,
    horasEntreAvisos: remota.cooldownHours,
    soloFueraDeHorario: remota.onlyOutsideBusinessHours,
    // Postgres devuelve `time` con segundos; la pantalla usa `HH:MM`.
    horarioDesde:
      remota.businessHoursFrom?.slice(0, 5) ?? CONFIGURACION_POR_DEFECTO.horarioDesde,
    horarioHasta:
      remota.businessHoursTo?.slice(0, 5) ?? CONFIGURACION_POR_DEFECTO.horarioHasta,
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
