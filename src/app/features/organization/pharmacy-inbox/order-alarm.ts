import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';

/**
 * Preferencia por navegador, como el tema: el mostrador que apagó el sonido
 * lo encuentra apagado mañana.
 */
export const SONIDO_STORAGE_KEY = 'mantra.farmacia.sonido';

/** El «díng-dóng» del mostrador. Vive en `public/` y se sirve de la raíz. */
const RUTA_DEL_SONIDO = '/sounds/pedido-nuevo.wav';

/** Cadencia del parpadeo del título, visible de reojo en la barra de pestañas. */
const PARPADEO_MS = 1500;

/**
 * Cada cuánto vuelve a sonar mientras haya pedidos que nadie tomó.
 *
 * Veinte segundos: lo bastante seguido para que no se pierda un pedido en un
 * mostrador con gente, y lo bastante espaciado para no volverse un ruido que
 * la primera reacción sea apagar —y apagado no avisa nada—.
 */
const INSISTENCIA_MS = 20_000;

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
const REPETICIONES_MAXIMAS = 15;

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
export class AlarmaDePedidos {
  private readonly documento = inject(DOCUMENT);
  private readonly titulo = inject(Title);
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly sonido = signal(this.leerPreferencia());
  private audio: HTMLAudioElement | null = null;
  private parpadeo: ReturnType<typeof setInterval> | null = null;
  private tituloOriginal: string | null = null;
  /** Pedidos sin ver acumulados: por el canal llegan de a uno por aviso. */
  private sinVer = 0;
  /** El temporizador que hace que el díng-dóng vuelva. */
  private insistencia: ReturnType<typeof setInterval> | null = null;
  /** Cuántas veces repitió ya, para no hacerlo indefinidamente. */
  private repeticiones = 0;
  private readonly alVolverVisible = (): void => {
    if (!this.documento.hidden) {
      this.descartar();
    }
  };

  /** Si el mostrador quiere el díng-dóng. La pantalla pinta el interruptor. */
  readonly sonidoActivo = this.sonido.asReadonly();

  constructor() {
    if (this.esBrowser) {
      this.documento.addEventListener('visibilitychange', this.alVolverVisible);
    }
    inject(DestroyRef).onDestroy(() => {
      this.callar();
      this.descartar();
      if (this.esBrowser) {
        this.documento.removeEventListener('visibilitychange', this.alVolverVisible);
      }
    });
  }

  alternarSonido(): void {
    const activo = !this.sonido();
    this.sonido.set(activo);
    this.persistirPreferencia(activo);
    // Apagar el interruptor calla lo que esté sonando ahora, no sólo lo que
    // venga: si no, el mostrador que lo apaga sigue escuchando el díng-dóng
    // veinte segundos más y concluye que el interruptor no anda.
    if (!activo) {
      this.callar();
    }
  }

  /**
   * Avisa que llegaron pedidos nuevos: suena si el interruptor está
   * encendido, y si la pestaña está oculta el título parpadea con el
   * contador hasta que la persona vuelva.
   */
  notificar(cantidad: number): void {
    if (!this.esBrowser || cantidad <= 0) {
      return;
    }
    if (this.sonido()) {
      this.sonar();
      this.insistir();
    }
    if (this.documento.hidden) {
      // El contador es lo acumulado sin ver, no el tamaño de este lote.
      this.sinVer += cantidad;
      this.parpadearTitulo(this.sinVer);
    }
  }

  /**
   * El mostrador tomó el pedido: se calla.
   *
   * Es lo único que detiene el sonido, y va aparte de {@link descartar} a
   * propósito. Aquel lo dispara `visibilitychange`, o sea **mirar la
   * pestaña**; y mirar no es atender. Si volver a la pestaña callara la
   * alarma, alcanzaría con pasar por ahí para que el pedido quedara sin
   * tomar y sin avisar — que es exactamente el modo de perderlo.
   */
  acusarRecibo(): void {
    this.callar();
    this.descartar();
  }

  /** Apaga el parpadeo, devuelve el título y arranca la cuenta de cero. */
  descartar(): void {
    this.sinVer = 0;
    if (this.parpadeo !== null) {
      clearInterval(this.parpadeo);
      this.parpadeo = null;
    }
    if (this.tituloOriginal !== null) {
      this.titulo.setTitle(this.tituloOriginal);
      this.tituloOriginal = null;
    }
  }

  /**
   * Programa la repetición del díng-dóng hasta que alguien acuse recibo.
   *
   * Reinicia el contador en cada llegada: un pedido nuevo es un motivo nuevo
   * para insistir, aunque el anterior ya llevara diez repeticiones.
   */
  private insistir(): void {
    this.repeticiones = 0;
    if (this.insistencia !== null) {
      clearInterval(this.insistencia);
    }
    this.insistencia = setInterval(() => {
      this.repeticiones += 1;
      if (this.repeticiones > REPETICIONES_MAXIMAS || !this.sonido()) {
        this.callar();
        return;
      }
      this.sonar();
    }, INSISTENCIA_MS);
  }

  /** Detiene la repetición. El sonido ya emitido no se puede desandar. */
  private callar(): void {
    this.repeticiones = 0;
    if (this.insistencia !== null) {
      clearInterval(this.insistencia);
      this.insistencia = null;
    }
  }

  private sonar(): void {
    this.audio ??= new Audio(RUTA_DEL_SONIDO);
    this.audio.currentTime = 0;
    // Autoplay bloqueado o audio no disponible: degradar en silencio.
    this.audio.play().catch(() => undefined);
  }

  private parpadearTitulo(cantidad: number): void {
    // Sólo mientras la pestaña está oculta: al volver, `visibilitychange`
    // restaura — así jamás pisa el título que el shell anuncia al navegar.
    this.tituloOriginal ??= this.titulo.getTitle();
    const aviso = `(${cantidad}) Pedidos nuevos — AloVida`;
    this.titulo.setTitle(aviso);
    if (this.parpadeo !== null) {
      clearInterval(this.parpadeo);
    }
    this.parpadeo = setInterval(() => {
      const original = this.tituloOriginal ?? aviso;
      this.titulo.setTitle(this.titulo.getTitle() === aviso ? original : aviso);
    }, PARPADEO_MS);
  }

  private leerPreferencia(): boolean {
    // Encendido por defecto: la alarma es la razón de ser de la bandeja.
    const guardado = this.storage()?.getItem(SONIDO_STORAGE_KEY);
    return guardado === null || guardado === undefined ? true : guardado === 'on';
  }

  private persistirPreferencia(activo: boolean): void {
    try {
      this.storage()?.setItem(SONIDO_STORAGE_KEY, activo ? 'on' : 'off');
    } catch {
      // Escritura rechazada (cuota agotada o modo privado): degradar, no romper.
    }
  }

  private storage(): Storage | null {
    try {
      return this.documento.defaultView?.localStorage ?? null;
    } catch {
      return null;
    }
  }
}
