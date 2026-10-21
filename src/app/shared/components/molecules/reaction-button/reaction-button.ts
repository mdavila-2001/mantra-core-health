import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
  viewChildren,
  type OnDestroy,
} from '@angular/core';

import type { ReactionType } from '@core/data-access/community/community.types';
import {
  REACCIONES_OFRECIDAS,
  reaccionOfrecida,
  type ReaccionOfrecida,
} from './reaction-button.types';

/** Cuánto hay que mantener el puntero encima para que se abra el selector. */
const DEMORA_AL_ENTRAR_MS = 450;

/** Cuánto tarda en cerrarse al salir: deja cruzar el hueco entre el botón y el selector. */
const DEMORA_AL_SALIR_MS = 250;

/** Una pulsación larga en pantalla táctil. */
const PULSACION_LARGA_MS = 500;

/**
 * El botón «Recomendar» con su selector de cinco reacciones.
 *
 * ## Cómo se usa, y cómo se llega con cada dispositivo
 *
 * - **Toque o clic simple**: si ya reaccionó, la quita; si no, deja `LIKE`.
 * - **Mouse**: mantener el puntero encima abre el selector.
 * - **Pantalla táctil**: pulsación larga.
 * - **Teclado**: `↑` sobre el botón abre el selector y mueve el foco adentro;
 *   `←` `→` se mueven entre reacciones; `Esc` cierra y devuelve el foco.
 * - **Cualquiera**: el chevron «Elegir otra reacción» (`aria-label`) abre el
 *   selector con un clic. Existe a propósito: una pulsación larga o un hover no
 *   se descubren solos, y para quien no puede hacerlos (lector de pantalla,
 *   conmutador) es la única puerta.
 *
 * Esta pieza **no sabe de la API**: recibe la reacción actual y emite lo que la
 * persona pidió (`elegida` o `quitada`). Quien la monta decide cómo guardarlo.
 *
 * `actual` tiene tres valores: un tipo (ya reaccionó), `null` (no reaccionó) y
 * `undefined` (todavía no se sabe). En el último el botón no afirma «presionado».
 */
@Component({
  selector: 'app-reaction-button',
  templateUrl: './reaction-button.html',
  styleUrl: './reaction-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:pointerdown)': 'alPulsarFuera($event)',
    '(focusout)': 'alPerderFoco($event)',
    // En el host y no en un `div` del template: un elemento con manejadores de
    // puntero o de teclado tiene que ser enfocable, y el contenedor no lo es.
    '(pointerenter)': 'alEntrar($event)',
    '(pointerleave)': 'alSalir($event)',
    '(keydown.escape)': 'alEscape($event)',
  },
})
export class ReactionButton implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  /** La reacción de quien mira: un tipo, `null` (no reaccionó) o `undefined` (no se sabe). */
  readonly actual = input<ReactionType | null | undefined>(null);

  /** Con una escritura en vuelo no se aceptan más gestos (sin doble envío). */
  readonly ocupado = input(false);

  /** Se emite con el tipo elegido, desde el botón (`LIKE`) o desde el selector. */
  readonly elegida = output<ReactionType>();

  /** Se emite cuando la persona pide quitar la que tenía. */
  readonly quitada = output<void>();

  protected readonly reacciones = REACCIONES_OFRECIDAS;
  protected readonly abierto = signal(false);

  private readonly principal = viewChild<ElementRef<HTMLButtonElement>>('principal');
  private readonly opciones = viewChildren<ElementRef<HTMLButtonElement>>('opcion');

  /** La reacción propia como se ofrece, o `null` si no hay. */
  protected readonly propia = computed<ReaccionOfrecida | null>(() => {
    const tipo = this.actual();
    return tipo === null || tipo === undefined ? null : reaccionOfrecida(tipo);
  });

  protected readonly presionado = computed(() => this.propia() !== null);

  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private suprimirClic = false;

  ngOnDestroy(): void {
    this.cancelarTemporizador();
  }

  /* ---- el botón ---------------------------------------------------------- */

  protected alPrincipal(): void {
    // Una pulsación larga ya abrió el selector: el clic que la sigue no es un toque.
    if (this.suprimirClic) {
      this.suprimirClic = false;
      return;
    }
    if (this.ocupado()) return;

    this.cerrar(false);
    if (this.propia() !== null) {
      this.quitada.emit();
    } else {
      this.elegida.emit('LIKE');
    }
  }

  protected alAlternar(): void {
    if (this.abierto()) {
      this.cerrar(true);
    } else {
      this.abrir(false);
    }
  }

  protected alPulsarFlecha(evento: Event): void {
    evento.preventDefault();
    this.abrir(true);
  }

  /* ---- el selector ------------------------------------------------------- */

  protected elegir(tipo: ReactionType): void {
    if (this.ocupado()) return;
    this.cerrar(true);
    this.elegida.emit(tipo);
  }

  protected alMoverEnElSelector(evento: Event, indice: number, paso: -1 | 1): void {
    evento.preventDefault();
    const opciones = this.opciones();
    const siguiente = opciones[(indice + paso + opciones.length) % opciones.length];
    siguiente?.nativeElement.focus();
  }

  protected alEscape(evento: Event): void {
    if (!this.abierto()) return;
    evento.stopPropagation();
    this.cerrar(true);
  }

  /* ---- puntero ----------------------------------------------------------- */

  protected alEntrar(evento: PointerEvent): void {
    // Con el dedo no hay «pasar por encima»: lo abre la pulsación larga.
    if (evento.pointerType !== 'mouse') return;
    this.programar(DEMORA_AL_ENTRAR_MS, () => this.abrir(false));
  }

  protected alSalir(evento: PointerEvent): void {
    if (evento.pointerType !== 'mouse') return;
    this.programar(DEMORA_AL_SALIR_MS, () => this.cerrar(false));
  }

  protected alPulsar(evento: PointerEvent): void {
    if (evento.pointerType === 'mouse') return;
    this.programar(PULSACION_LARGA_MS, () => {
      this.suprimirClic = true;
      this.abrir(false);
    });
  }

  protected alSoltar(): void {
    this.cancelarTemporizador();
  }

  protected alPulsarFuera(evento: Event): void {
    if (this.abierto() && !this.host.nativeElement.contains(evento.target as Node)) {
      this.cerrar(false);
    }
  }

  protected alPerderFoco(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    // `null` es «el foco salió de la página o se hizo clic en nada»: no se cierra,
    // lo resuelve `alPulsarFuera`. Se cierra cuando el foco va a otro elemento de la página.
    if (this.abierto() && destino !== null && !this.host.nativeElement.contains(destino)) {
      this.cerrar(false);
    }
  }

  /* ---- internos ---------------------------------------------------------- */

  private abrir(enfocar: boolean): void {
    this.cancelarTemporizador();
    if (this.ocupado()) return;
    this.abierto.set(true);
    if (enfocar) {
      // Después del render: la primera opción todavía no existe en este tick, y
      // un `queueMicrotask` corre antes de que Angular dibuje el selector.
      afterNextRender(() => this.opciones()[0]?.nativeElement.focus(), { injector: this.injector });
    }
  }

  private cerrar(devolverFoco: boolean): void {
    this.cancelarTemporizador();
    const estabaAbierto = this.abierto();
    this.abierto.set(false);
    if (estabaAbierto && devolverFoco) {
      this.principal()?.nativeElement.focus();
    }
  }

  private programar(ms: number, accion: () => void): void {
    this.cancelarTemporizador();
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      accion();
    }, ms);
  }

  private cancelarTemporizador(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }
}
