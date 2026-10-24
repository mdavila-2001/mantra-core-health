import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';

/**
 * Preferencia por navegador, como el tema: el mostrador que apagó el sonido
 * lo encuentra apagado mañana.
 */
export const SOUND_STORAGE_KEY = 'mantra.farmacia.sonido';

/** El «díng-dóng» del mostrador. Vive en `public/` y se sirve de la raíz. */
const SOUND_PATH = '/sounds/pedido-nuevo.wav';

/** Cadencia del parpadeo del título, visible de reojo en la barra de pestañas. */
const BLINK_MS = 1500;

/**
 * Cada cuánto vuelve a sonar mientras haya pedidos que nadie tomó.
 *
 * Veinte segundos: lo bastante seguido para que no se pierda un pedido en un
 * mostrador con gente, y lo bastante espaciado para no volverse un ruido que
 * la primera reacción sea apagar —y apagado no avisa nada—.
 */
const PERSISTENCE_MS = 20_000;

/**
 * Cuántas veces repite antes de rendirse.
 *
 * El pedido del cliente es que suene **hasta que el mostrador acuse recibo**, y
 * así es: el contador sólo se agota cuando no hay nadie. Sonar de verdad para
 * siempre no avisaría a más gente, sería ruido en un local vacío toda la
 * noche —y al día siguiente el interruptor amanece apagado—. Quince
 * repeticiones son unos cinco minutos; el cartel, el destaque de la tarjeta y
 * el título de la pestaña siguen avisando después, que es lo que un mostrador
 * vacío va a ver cuando alguien vuelva.
 */
const MAX_REPETITIONS = 15;

/**
 * La alarma de la bandeja (FAR-I3) — el pedido literal del cliente: «alguna
 * alarma o sonido al llegar el pedido, muy similar a PedidosYa».
 *
 * Tres canales: el sonido (con interruptor persistido — un mostrador ocho
 * horas con díng-dóng necesita apagarlo), el título de la pestaña que
 * parpadea con el contador mientras la pestaña está oculta, y el destaque
 * visual de la tarjeta, que es CSS de la bandeja y no pasa por acá.
 *
 * ## El autoplay bloqueado es la realidad, no un bug
 *
 * Los navegadores no dejan sonar audio hasta la primera interacción con la
 * página. El interruptor «Sonido» de la bandeja ES ese gesto: quien lo deja
 * encendido ya interactuó, y a partir de ahí el díng-dóng suena. Si el
 * navegador igual lo bloquea, el `catch` degrada en silencio — el título y
 * el destaque siguen avisando.
 *
 * Provisto por la bandeja (no en root): la alarma vive lo que vive la
 * pantalla que la necesita.
 */
@Injectable()
export class OrdersAlarm {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly sound = signal(this.readPreference());
  private audio: HTMLAudioElement | null = null;
  private blink: ReturnType<typeof setInterval> | null = null;
  private titleOriginal: string | null = null;
  /** Pedidos sin ver acumulados: por el canal llegan de a uno por aviso. */
  private withoutView = 0;
  /** El temporizador que hace que el díng-dóng vuelva. */
  private persistence: ReturnType<typeof setInterval> | null = null;
  /** Cuántas veces repitió ya, para no hacerlo indefinidamente. */
  private repetitions = 0;
  private readonly toReturnVisible = (): void => {
    if (!this.document.hidden) {
      this.discard();
    }
  };

  /** Si el mostrador quiere el díng-dóng. La pantalla pinta el interruptor. */
  readonly activeSound = this.sound.asReadonly();

  constructor() {
    if (this.esBrowser) {
      this.document.addEventListener('visibilitychange', this.toReturnVisible);
    }
    inject(DestroyRef).onDestroy(() => {
      this.silence();
      this.discard();
      if (this.esBrowser) {
        this.document.removeEventListener('visibilitychange', this.toReturnVisible);
      }
    });
  }

  toggleSound(): void {
    const activo = !this.sound();
    this.sound.set(activo);
    this.persistPreference(activo);
    // Apagar el interruptor calla lo que esté sonando ahora, no sólo lo que
    // venga: si no, el mostrador que lo apaga sigue escuchando el díng-dóng
    // veinte segundos más y concluye que el interruptor no anda.
    if (!activo) {
      this.silence();
    }
  }

  /**
   * Avisa que llegaron pedidos nuevos: suena si el interruptor está
   * encendido, y si la pestaña está oculta el título parpadea con el
   * contador hasta que la persona vuelva.
   */
  notify(cantidad: number): void {
    if (!this.esBrowser || cantidad <= 0) {
      return;
    }
    if (this.sound()) {
      this.sonar();
      this.insist();
    }
    if (this.document.hidden) {
      // El contador es lo acumulado sin ver, no el tamaño de este lote.
      this.withoutView += cantidad;
      this.blinkTitle(this.withoutView);
    }
  }

  /**
   * El mostrador tomó el pedido: se calla.
   *
   * Es lo único que detiene el sonido, y va aparte de {@link discard} a
   * propósito. Aquel lo dispara `visibilitychange`, o sea **mirar la
   * pestaña**; y mirar no es atender. Si volver a la pestaña callara la
   * alarma, alcanzaría con pasar por ahí para que el pedido quedara sin
   * tomar y sin avisar — que es exactamente el modo de perderlo.
   */
  acknowledgeReceipt(): void {
    this.silence();
    this.discard();
  }

  /** Apaga el parpadeo, devuelve el título y arranca la cuenta de cero. */
  discard(): void {
    this.withoutView = 0;
    if (this.blink !== null) {
      clearInterval(this.blink);
      this.blink = null;
    }
    if (this.titleOriginal !== null) {
      this.title.setTitle(this.titleOriginal);
      this.titleOriginal = null;
    }
  }

  /**
   * Programa la repetición del díng-dóng hasta que alguien acuse recibo.
   *
   * Reinicia el contador en cada llegada: un pedido nuevo es un motivo nuevo
   * para insistir, aunque el anterior ya llevara diez repeticiones.
   */
  private insist(): void {
    this.repetitions = 0;
    if (this.persistence !== null) {
      clearInterval(this.persistence);
    }
    this.persistence = setInterval(() => {
      this.repetitions += 1;
      if (this.repetitions > MAX_REPETITIONS || !this.sound()) {
        this.silence();
        return;
      }
      this.sonar();
    }, PERSISTENCE_MS);
  }

  /** Detiene la repetición. El sonido ya emitido no se puede desandar. */
  private silence(): void {
    this.repetitions = 0;
    if (this.persistence !== null) {
      clearInterval(this.persistence);
      this.persistence = null;
    }
  }

  private sonar(): void {
    this.audio ??= new Audio(SOUND_PATH);
    this.audio.currentTime = 0;
    // Autoplay bloqueado o audio no disponible: degradar en silencio.
    this.audio.play().catch(() => undefined);
  }

  private blinkTitle(cantidad: number): void {
    // Sólo mientras la pestaña está oculta: al volver, `visibilitychange`
    // restaura — así jamás pisa el título que el shell anuncia al navegar.
    this.titleOriginal ??= this.title.getTitle();
    const aviso = `(${cantidad}) Pedidos nuevos — AloVida`;
    this.title.setTitle(aviso);
    if (this.blink !== null) {
      clearInterval(this.blink);
    }
    this.blink = setInterval(() => {
      const original = this.titleOriginal ?? aviso;
      this.title.setTitle(this.title.getTitle() === aviso ? original : aviso);
    }, BLINK_MS);
  }

  private readPreference(): boolean {
    // Encendido por defecto: la alarma es la razón de ser de la bandeja.
    const guardado = this.storage()?.getItem(SOUND_STORAGE_KEY);
    return guardado === null || guardado === undefined ? true : guardado === 'on';
  }

  private persistPreference(activo: boolean): void {
    try {
      this.storage()?.setItem(SOUND_STORAGE_KEY, activo ? 'on' : 'off');
    } catch {
      // Escritura rechazada (cuota agotada o modo privado): degradar, no romper.
    }
  }

  private storage(): Storage | null {
    try {
      return this.document.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }
}
