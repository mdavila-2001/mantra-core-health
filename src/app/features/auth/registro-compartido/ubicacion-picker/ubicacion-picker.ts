import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { AnnounceOnAppear } from '../../../../shared/a11y/announce-on-appear';
import { Tooltip } from '../../../../shared/components/atoms/tooltip/tooltip';
import { AppMap } from '../../../../shared/components/organisms/map/map';
import type { PinMapa } from '../../../../shared/components/organisms/map/pin-mapa.types';

/** Un punto en el mapa, tal como lo entrega el navegador. */
export interface Coordenadas {
  readonly lat: number;
  readonly lng: number;
}

/**
 * Los identificadores de prueba del bloque.
 *
 * Van uno por uno y no derivados de un prefijo porque **los que ya existen no
 * son uniformes**: el domicilio del paciente mezcla `registro-*` (los primeros
 * que se escribieron) con `registration-home-*`, y el trabajo es todo
 * `registration-work-*`. Un prefijo obligaría a renombrarlos, y un identificador
 * de prueba renombrado es una prueba y un recorrido de Playwright que dejan de
 * encontrar lo que buscaban. Se pasan explícitos para que la extracción no
 * cambie **nada** de lo que ya funcionaba.
 */
export interface IdsDePrueba {
  readonly mapa: string;
  readonly confirmada: string;
  readonly avisoGeocodificacion: string;
  readonly quitar: string;
  readonly confirmar: string;
  readonly usarUbicacion: string;
  /** El botón que abre el mapa vacío para poner el pin a mano. */
  readonly marcarEnMapa: string;
}

/**
 * Cuánto se espera al navegador antes de dar la ubicación por perdida.
 *
 * Diez segundos: más que eso y la persona ya volvió a lo suyo.
 */
const GPS_TIMEOUT_MS = 10_000;

/** Una lectura de hasta cinco minutos sirve: nadie se mudó en ese rato. */
const GPS_MAX_AGE_MS = 300_000;

/**
 * Lo que se le dice a quien fijó un punto y espera que la calle se escriba
 * sola (AC-03-8 / AC-03-9).
 *
 * **La resolución del nombre de la dirección no está disponible, y decirlo es
 * el requisito.** Convertir un par de coordenadas en «Av. Banzer 3er anillo»
 * necesita un geocodificador externo, y la política de seguridad del servidor
 * no lo permite: `src/server/security-headers.ts` deja `connect-src` en
 * `'self'` y `img-src` sólo abierto a `tile.openstreetmap.org`, con una prueba
 * que lo verifica. Así que el punto se guarda tal cual y la calle la escribe
 * la persona. Lo que no se hace es rellenar la dirección con un texto
 * inventado: una dirección falsa en una ficha es peor que un campo vacío,
 * porque nadie la vuelve a mirar.
 */
export const AVISO_SIN_GEOCODIFICACION =
  'El punto del mapa se guarda tal cual, pero no podemos convertirlo en el nombre de la calle: escribila vos arriba.';



/**
 * El punto de un lugar sobre el mapa, capturado del navegador **o marcado a
 * mano sobre el plano**, y confirmado por la persona.
 *
 * ## Dos maneras de poner el pin, y ninguna es obligatoria
 *
 * Nació con una sola: pedir la ubicación al navegador. Eso deja afuera a quien
 * se registra desde otro lugar —la casa se declara desde el trabajo, o desde
 * el teléfono de un familiar—, a quien negó el permiso, y a quien el GPS le
 * acertó la cuadra pero no la puerta. Así que el mapa también se abre vacío
 * («Marcar en el mapa») y el pin se pone tocando el plano; y una vez que hay
 * pin, venga de donde venga, tocar el plano lo corre. Es el mismo `pointPicked`
 * que «Cómo llegar» usa para marcar el origen, con la misma pista visual: el
 * cursor en cruz mientras el mapa espera un toque.
 *
 * ## Por qué es un componente y no tres copias de la misma plantilla
 *
 * El alta del paciente pregunta **dos** ubicaciones —dónde vivís y dónde
 * trabajás— y la del profesional pide la tercera. Las tres son el mismo
 * baile: pedir permiso al navegador, dibujar el pin, dejar que alguien mire
 * el plano y diga que sí, y no perder el dato en silencio si no lo dice.
 *
 * `register-patient.ts` ya había extraído la mitad difícil —`pedirUbicacion`,
 * con las cuatro señales— justamente para no escribirlo dos veces, y dejaba
 * dicho por qué: «escribirlo dos veces garantizaba que el arreglo del segundo
 * caso se hiciera sólo en el primero». Lo que faltaba extraer era la otra
 * mitad, la plantilla, que sí estaba duplicada. Con una tercera copia a la
 * vista, esto es lo que corresponde.
 *
 * ## Qué sale de acá
 *
 * Sólo lo **confirmado**. Mientras el punto esté capturado y sin confirmar, el
 * componente lo dibuja, pero emite `null`: entre «esto es lo que
 * encontramos» y «esta es mi dirección» tiene que haber alguien mirando el
 * plano. Quien lo consume guarda lo que reciba, sin volver a preguntarse si
 * estaba confirmado.
 */
@Component({
  selector: 'app-ubicacion-picker',
  imports: [AppButton, NavIcon, AppMap, AnnounceOnAppear, Tooltip],
  templateUrl: './ubicacion-picker.html',
  styleUrl: './ubicacion-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UbicacionPicker {
  private readonly documento = inject(DOCUMENT);

  /** Si ya se sembró el punto guardado. Ver {@link inicial}. */
  private sembrado = false;

  constructor() {
    // `effect` y no un valor inicial de la señal: el perfil llega por HTTP y el
    // componente ya está montado cuando aparece.
    effect(() => {
      const guardado = this.inicial();
      if (this.sembrado || guardado === null) return;
      this.sembrado = true;
      this.punto.set(guardado);
      // Confirmado de entrada: es un punto que la persona ya dio por bueno
      // alguna vez. Pedirle que lo vuelva a confirmar para no perderlo sería
      // convertir «no toqué el mapa» en «borrá mi ubicación».
      this.confirmada.set(true);
    });
  }

  /**
   * El identificador del pin en el mapa.
   *
   * `app-map` habla de sus pines por `id` y exige uno; acá hay un solo pin, así
   * que es una entrada y no un dato. **No es un uuid a propósito**: nada del
   * mapa debe poder filtrar identificadores.
   */
  readonly pinId = input.required<string>();

  /** Cómo se llama el pin una vez confirmado («Tu dirección»). */
  readonly etiquetaConfirmada = input.required<string>();


  /** Nombre accesible del botón que quita la ubicación. */
  readonly etiquetaQuitar = input.required<string>();

  /** Rótulo del botón que la pide por primera vez. */
  readonly etiquetaPedir = input('Usar mi ubicación');

  /** Rótulo del mapa, para quien no lo ve. */
  readonly etiquetaMapa = input('Tu ubicación actual en el mapa');

  /** Rótulo del botón que abre el mapa vacío para marcar el punto a mano. */
  readonly etiquetaMarcar = input('Marcar en el mapa');

  /** Lo que se le dice sobre el mapa vacío («Tocá el mapa donde queda tu casa»). */
  readonly indicacionMarcar = input('Tocá el mapa en el lugar exacto para poner el pin.');

  readonly ids = input.required<IdsDePrueba>();

  /**
   * El punto que la persona ya tenía guardado, si lo tenía.
   *
   * Existe para **editar**, que es un caso que el alta no tiene: en el registro
   * se parte de cero, pero en el perfil hay que mostrar el pin que ya está y
   * dejar moverlo. Sin esto, abrir «editar» mostraría el bloque vacío y quien
   * guardara sin tocar el mapa perdería su ubicación.
   *
   * Se siembra **una sola vez**. Después manda la persona: si vuelve a pedir su
   * ubicación, la corre o la quita, un dato que llegue tarde del servidor no
   * puede pisar lo que acaba de hacer.
   */
  readonly inicial = input<Coordenadas | null>(null);

  /**
   * El punto confirmado, o `null`.
   *
   * Se emite también al desconfirmar —al volver a pedir la ubicación o al
   * quitarla—, para que quien lo consume no se quede con un punto que la
   * persona ya descartó.
   */
  readonly confirmado = output<Coordenadas | null>();

  /**
   * Las coordenadas que la persona compartió, si las compartió.
   *
   * **Nunca se muestran como números.** Son la entrada del mapa, y lo que la
   * persona ve es el pin sobre el plano: «-17,7833, -63,1821» no le dice a
   * nadie si el punto está bien, y era exactamente lo que había que confirmar.
   */
  readonly punto = signal<Coordenadas | null>(null);

  /** Si se está esperando al navegador ahora mismo. */
  readonly pidiendo = signal(false);

  /** Si la persona ya dio por buena la ubicación del mapa. */
  readonly confirmada = signal(false);

  /** Si el navegador negó la ubicación, para poder decirlo sin frenar el alta. */
  readonly rechazado = signal(false);

  /**
   * Si la persona pidió el mapa vacío para poner el pin a mano.
   *
   * Sólo importa mientras no hay punto: con un pin ya puesto el mapa está
   * abierto de todos modos y tocarlo lo corre. Se apaga al quitar la ubicación,
   * que es volver al principio.
   */
  readonly marcando = signal(false);

  /** Si el mapa tiene que estar en pantalla: porque hay pin, o porque se está por poner. */
  protected readonly mapaAbierto = computed(() => this.punto() !== null || this.marcando());

  /**
   * Si el punto actual lo dio el navegador (y no un toque sobre el plano).
   *
   * Sólo cambia cómo se llama el pin sin confirmar: «Acá te encontramos» es
   * mentira para un punto que la persona puso a mano.
   */
  private readonly vieneDelNavegador = signal(false);

  protected readonly avisoSinGeocodificacion = AVISO_SIN_GEOCODIFICACION;

  /**
   * El pin, tal como lo espera `app-map`.
   *
   * Vacío mientras no haya punto: el mapa acepta la lista vacía y se queda en
   * su vista por defecto, que es lo que corresponde antes de pedir nada.
   */
  protected readonly pines = computed<readonly PinMapa[]>(() => {
    const punto = this.punto();
    if (punto === null) return [];
    return [
      {
        id: this.pinId(),
        lat: punto.lat,
        lng: punto.lng,
        titulo: this.confirmada()
          ? this.etiquetaConfirmada()
          : this.vieneDelNavegador()
            ? 'Acá te encontramos'
            : 'El punto que marcaste',
      },
    ];
  });

  /**
   * Pide la ubicación al navegador.
   *
   * Nunca bloquea el alta: si el navegador no la da —porque no hay API, porque
   * se corre en el servidor, o porque la persona dijo que no— se anota el
   * rechazo y el formulario sigue como estaba. La ubicación es una comodidad,
   * no un requisito.
   */
  usarMiUbicacion(): void {
    const geo = this.documento.defaultView?.navigator?.geolocation;
    if (!geo) {
      this.rechazado.set(true);
      return;
    }

    this.pidiendo.set(true);
    // Volver a pedirla es empezar de nuevo: lo confirmado antes valía para el
    // punto anterior, no para el que está por llegar.
    this.desconfirmar();
    geo.getCurrentPosition(
      (posicion) => {
        this.punto.set({ lat: posicion.coords.latitude, lng: posicion.coords.longitude });
        this.vieneDelNavegador.set(true);
        this.marcando.set(false);
        this.rechazado.set(false);
        this.pidiendo.set(false);
      },
      () => {
        this.rechazado.set(true);
        this.pidiendo.set(false);
      },
      { enableHighAccuracy: false, timeout: GPS_TIMEOUT_MS, maximumAge: GPS_MAX_AGE_MS },
    );
  }

  /**
   * Abre el mapa vacío para que la persona ponga el pin a mano.
   *
   * No pide nada al navegador ni toca lo que hubiera: es la puerta para quien
   * no quiere —o no puede— compartir dónde está ahora, que casi nunca es donde
   * vive.
   */
  marcarEnMapa(): void {
    this.marcando.set(true);
    this.rechazado.set(false);
  }

  /**
   * Un toque sobre el mapa: el pin va ahí.
   *
   * Sirve para las dos cosas —poner el primer pin sobre el mapa vacío y correr
   * uno que ya estaba, viniera del GPS o de otro toque—, y en las dos el punto
   * queda **sin confirmar**: la persona que lo movió es la misma que tiene que
   * mirarlo y decir que sí, y el dato anterior ya no vale para el punto nuevo.
   */
  fijarPunto(punto: Coordenadas): void {
    this.desconfirmar();
    this.punto.set({ lat: punto.lat, lng: punto.lng });
    this.vieneDelNavegador.set(false);
    this.marcando.set(false);
    this.rechazado.set(false);
  }

  /**
   * Da por buena la dirección que muestra el mapa.
   *
   * Es lo que convierte un punto capturado en un dato del alta. Lo que **no**
   * hace es escribir la calle: ver {@link AVISO_SIN_GEOCODIFICACION}.
   */
  confirmarDireccionActual(): void {
    const punto = this.punto();
    if (punto === null) return;
    this.confirmada.set(true);
    this.confirmado.emit(punto);
  }

  /** Olvida la ubicación capturada, y con ella su confirmación; cierra el mapa. */
  quitarUbicacion(): void {
    this.punto.set(null);
    this.marcando.set(false);
    this.desconfirmar();
  }

  private desconfirmar(): void {
    if (!this.confirmada()) return;
    this.confirmada.set(false);
    this.confirmado.emit(null);
  }
}
