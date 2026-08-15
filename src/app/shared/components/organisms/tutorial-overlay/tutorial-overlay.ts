import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { TutorialEngine } from '../../../../core/tutorials/tutorial.engine';
import { AppButton } from '../../atoms/button/button';
import { DialogService } from '../../molecules/dialog/dialog-service';

/** Cuánto respira el recorte alrededor del elemento resaltado. */
const AIRE = 6;

/** Cuánto se separa el globo del elemento. */
const SEPARACION = 12;

/** Ancho del globo. Fijo: un globo que cambia de ancho por paso marea. */
const ANCHO = 340;

/** El rectángulo del recorte y la posición del globo, ya resueltos. */
interface Geometria {
  readonly recorte: { top: number; left: number; width: number; height: number } | null;
  readonly globo: { top: number; left: number };
  readonly lado: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

/**
 * La capa visual del motor de tutoriales.
 *
 * Se monta **una sola vez**, en el armazón, y se dibuja sola cuando hay un paso
 * activo. Ninguna pantalla la importa ni sabe que existe: eso es lo que permite
 * que un tutorial cruce de la agenda al expediente sin que ninguna de las dos
 * tenga que colaborar.
 *
 * ## El fondo tiene un agujero, y el agujero decide si se puede tocar
 *
 * El velo se dibuja con cuatro rectángulos alrededor del elemento en vez de un
 * rectángulo con `clip-path`. La razón es que así el hueco **no tiene capa
 * encima**: en un paso donde hay que hacer clic en el botón resaltado, el clic
 * llega al botón de verdad. Con un velo entero y `pointer-events: none`, o se
 * podía tocar todo o no se podía tocar nada.
 *
 * En los pasos que sólo explican, el hueco lleva una tapa transparente: un clic
 * distraído en medio de una explicación no debería disparar una acción real.
 *
 * ## Accesibilidad
 *
 * El globo es un `role="dialog"` con `aria-modal`, el foco entra al abrirse y se
 * devuelve al salir. `Escape` pregunta antes de abandonar —perder un recorrido a
 * mitad de camino por un tecleo es una molestia real— y las flechas avanzan y
 * retroceden. El progreso se dice con palabras («paso 3 de 8»), no sólo con la
 * barra, porque una barra no se escucha.
 */
@Component({
  selector: 'app-tutorial-overlay',
  imports: [AppButton],
  templateUrl: './tutorial-overlay.html',
  styleUrl: './tutorial-overlay.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'alTeclear($event)',
    '(window:resize)': 'remedir()',
    '(window:scroll)': 'remedir()',
  },
})
export class TutorialOverlay {
  private readonly engine = inject(TutorialEngine);
  private readonly dialogs = inject(DialogService);
  private readonly document = inject(DOCUMENT);

  private readonly globo = viewChild<ElementRef<HTMLElement>>('globo');

  protected readonly paso = this.engine.activeStep;
  protected readonly buscando = this.engine.isSearching;

  /**
   * Fuerza a recalcular la geometría.
   *
   * Es un contador y no un booleano porque lo que hace falta es **invalidar**:
   * dos recálculos seguidos por dos eventos de scroll tienen que producir dos
   * lecturas, y con un booleano el segundo no cambiaría la señal.
   */
  private readonly reloj = signal(0);

  /** A quién devolverle el foco cuando el recorrido termina. */
  private focoPrevio: HTMLElement | null = null;

  protected readonly geometria = computed<Geometria>(() => {
    this.reloj();
    const activo = this.paso();
    const elemento = activo?.element ?? null;

    if (elemento === null) {
      // Sin ancla, el globo se centra. Es el caso del primer paso («esto es lo
      // que vas a aprender») y del último, que no señalan nada.
      return {
        recorte: null,
        globo: { top: this.alto() / 2 - 120, left: this.ancho() / 2 - ANCHO / 2 },
        lado: 'center',
      };
    }

    const caja = elemento.getBoundingClientRect();
    const recorte = {
      top: caja.top - AIRE,
      left: caja.left - AIRE,
      width: caja.width + AIRE * 2,
      height: caja.height + AIRE * 2,
    };

    const lado = this.elegirLado(caja, activo?.step.placement ?? 'auto');
    return { recorte, globo: this.ubicar(caja, lado), lado };
  });

  /** El texto del progreso. Se dice con palabras: una barra no se escucha. */
  protected readonly progresoEnPalabras = computed(() => {
    const activo = this.paso();
    return activo === null ? '' : `Paso ${activo.index} de ${activo.total}`;
  });

  protected readonly porcentaje = computed(() => Math.round(this.engine.progressRatio() * 100));

  /** Si el elemento resaltado se puede tocar en este paso. */
  protected readonly interactivo = computed(() => {
    const activo = this.paso();
    if (activo === null) {
      return false;
    }
    // No se puede pedir que toquen algo y a la vez taparlo: en los pasos de
    // clic el hueco queda abierto salvo que la definición diga lo contrario.
    return activo.step.interactive ?? activo.step.advanceOn === 'click';
  });

  constructor() {
    effect(() => {
      const activo = this.paso();
      untracked(() => {
        if (activo === null) {
          this.devolverElFoco();
          return;
        }
        this.recordarElFoco();
        this.enfocarElGlobo();
        this.remedir();
      });
    });
  }

  protected async siguiente(): Promise<void> {
    await this.engine.next();
  }

  protected async anterior(): Promise<void> {
    await this.engine.previous();
  }

  /**
   * Abandonar el recorrido, con confirmación.
   *
   * Se pregunta porque un tutorial a medias se pierde de vista: no hay nada en
   * pantalla que recuerde que estaba empezado, y el progreso queda en el centro
   * de ayuda, que es otra pantalla. Un `Escape` distraído no debería costar ocho
   * pasos.
   */
  protected async abandonar(): Promise<void> {
    const activo = this.paso();
    if (activo === null) {
      return;
    }
    // En el primer paso no se pregunta: no hay nada que perder todavía, y la
    // confirmación se vuelve un trámite para cerrar algo que se abrió sin querer.
    if (!activo.isFirst) {
      const confirmado = await this.dialogs.confirm({
        title: 'Dejar el tutorial',
        message:
          'Se guarda el paso en el que quedaste: vas a poder continuarlo desde el centro de tutoriales.',
        confirmLabel: 'Dejarlo',
        cancelLabel: 'Seguir',
      });
      if (!confirmado) {
        return;
      }
    }
    this.engine.skip();
  }

  protected alTeclear(evento: KeyboardEvent): void {
    if (this.paso() === null) {
      return;
    }
    if (evento.key === 'Escape') {
      evento.preventDefault();
      void this.abandonar();
      return;
    }
    // Las flechas sólo mueven el recorrido cuando el foco está DENTRO del globo:
    // en un paso interactivo, quien está escribiendo en el campo resaltado usa
    // las flechas para moverse por el texto, y robárselas sería inaceptable.
    if (!this.focoEnElGlobo()) {
      return;
    }
    if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      void this.siguiente();
    }
    if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      void this.anterior();
    }
  }

  /** Vuelve a medir. La posición se calcula sobre el rectángulo real. */
  protected remedir(): void {
    this.reloj.update((valor) => valor + 1);
  }

  /**
   * Elige el lado con más espacio, salvo que la definición fije uno.
   *
   * La medición es contra la ventana y no contra el documento: lo que importa es
   * si el globo entra **en pantalla**, no si entra en la página.
   */
  private elegirLado(caja: DOMRect, pedido: string): Geometria['lado'] {
    if (pedido !== 'auto' && pedido !== 'center') {
      return pedido as Geometria['lado'];
    }
    if (pedido === 'center') {
      return 'center';
    }
    const abajo = this.alto() - caja.bottom;
    if (abajo > 220) {
      return 'bottom';
    }
    if (caja.top > 220) {
      return 'top';
    }
    return this.ancho() - caja.right > ANCHO + SEPARACION ? 'right' : 'left';
  }

  /** Dónde va el globo, ya sujeto a los bordes para que no se salga. */
  private ubicar(caja: DOMRect, lado: Geometria['lado']): { top: number; left: number } {
    const centrado = caja.left + caja.width / 2 - ANCHO / 2;

    switch (lado) {
      case 'bottom':
        return { top: caja.bottom + SEPARACION, left: this.sujetar(centrado, ANCHO) };
      case 'top':
        return { top: Math.max(AIRE, caja.top - SEPARACION - 200), left: this.sujetar(centrado, ANCHO) };
      case 'right':
        return { top: this.sujetar(caja.top, 200, this.alto()), left: caja.right + SEPARACION };
      case 'left':
        return {
          top: this.sujetar(caja.top, 200, this.alto()),
          left: Math.max(AIRE, caja.left - SEPARACION - ANCHO),
        };
      default:
        return { top: this.alto() / 2 - 120, left: this.ancho() / 2 - ANCHO / 2 };
    }
  }

  /** Mantiene un borde dentro de la pantalla. */
  private sujetar(valor: number, tamano: number, limite = this.ancho()): number {
    return Math.min(Math.max(AIRE, valor), Math.max(AIRE, limite - tamano - AIRE));
  }

  private ancho(): number {
    return this.document.defaultView?.innerWidth ?? 1024;
  }

  private alto(): number {
    return this.document.defaultView?.innerHeight ?? 768;
  }

  private focoEnElGlobo(): boolean {
    const globo = this.globo()?.nativeElement;
    const activo = this.document.activeElement;
    return globo !== undefined && activo !== null && globo.contains(activo);
  }

  private recordarElFoco(): void {
    if (this.focoPrevio !== null) {
      return;
    }
    const activo = this.document.activeElement;
    this.focoPrevio = activo instanceof HTMLElement ? activo : null;
  }

  /**
   * Lleva el foco al globo.
   *
   * En el siguiente cuadro, no ahora: el globo se dibuja en este ciclo de
   * detección y todavía no existe cuando el efecto corre.
   */
  private enfocarElGlobo(): void {
    requestAnimationFrame(() => this.globo()?.nativeElement.focus({ preventScroll: true }));
  }

  private devolverElFoco(): void {
    const previo = this.focoPrevio;
    this.focoPrevio = null;
    if (previo !== null && previo.isConnected) {
      previo.focus({ preventScroll: true });
    }
  }
}
