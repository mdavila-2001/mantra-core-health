import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  untracked,
  viewChildren,
} from '@angular/core';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';

import { seguirEpisodio, type PasoDelRecorrido } from './recorrido-guiado.model';

/* ============================================================================
    The guided tour's control: previous / play-pause / next.

    It receives the steps already built (`armarRecorridoGuiado`) and says which
    one is current; it does not look at the network nor know the API. Whoever
    mounts it focuses and reveals the nodes with what `pasoActual` emits (see
    ADR-0022).

    ## Playing is not mandatory

    With `prefers-reduced-motion: reduce` there is no autoplay: the button is
    disabled and says why, and it moves with previous and next. Any
    interaction with the network (`interaccionEnLaRed`) pauses: if the person
    started looking at a node, the tour does not change the focus under them.
    ========================================================================== */

export type VelocidadDelRecorrido = 'lenta' | 'normal' | 'rapida';

/** Milliseconds per step. Meant for reading a two- or three-sentence narration. */
export const MS_POR_PASO: Readonly<Record<VelocidadDelRecorrido, number>> = {
  lenta: 11000,
  normal: 7000,
  rapida: 4000,
};

/** What the control emits every time the step changes. */
export interface PasoActualDelRecorrido {
  /** Index in the list being toured (filtered if an episode is followed). */
  readonly indice: number;
  readonly total: number;
  readonly paso: PasoDelRecorrido;
  readonly enfocar: readonly string[];
  readonly revelados: readonly string[];
}

const VELOCIDADES: readonly SegmentedOption<VelocidadDelRecorrido>[] = [
  { value: 'lenta', label: 'Lenta', description: 'Velocidad lenta' },
  { value: 'normal', label: 'Normal', description: 'Velocidad normal' },
  { value: 'rapida', label: 'Rápida', description: 'Velocidad rápida' },
];

@Component({
  selector: 'app-recorrido-guiado',
  imports: [AppButton, NavIcon, SegmentedControl],
  templateUrl: './recorrido-guiado.html',
  styleUrl: './recorrido-guiado.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'recorrido-guiado',
    '[class.recorrido-guiado--integrada]': 'integrada()',
    '(keydown)': 'alTeclado($event)',
  },
})
export class RecorridoGuiado {
  /** Los pasos en orden, tal como salen de `armarRecorridoGuiado`. */
  readonly pasos = input.required<readonly PasoDelRecorrido[]>();
  /** If present, only what touches these ids is toured (an episode). */
  readonly episodio = input<readonly string[] | null>(null);
  /** The name of the episode followed, to say it on screen. */
  readonly nombreDelEpisodio = input<string | null>(null);
  /**
   * Changes every time the person touches the network (a counter, a chosen
   * id…). Any change pauses playback.
   */
  readonly interaccionEnLaRed = input<unknown>(undefined);
  /**
   * Inside a surface that already has its border (the chart's Tour): no card
   * of its own, so as not to stack one box on another.
   */
  readonly integrada = input(false, { transform: booleanAttribute });

  /** The current step, with what to focus and what is already revealed. */
  readonly pasoActual = output<PasoActualDelRecorrido>();

  protected readonly velocidades = VELOCIDADES;

  protected readonly lista = computed<readonly PasoDelRecorrido[]>(() => {
    const episodio = this.episodio();
    return episodio === null ? this.pasos() : seguirEpisodio(this.pasos(), episodio);
  });

  /** Back to the first step when the list changes (another patient, another episode). */
  protected readonly indice = linkedSignal<readonly PasoDelRecorrido[], number>({
    source: this.lista,
    computation: (lista, anterior) => {
      if (anterior === undefined || lista.length === 0) return 0;
      // If the list changed but the step is still there, it stays on it.
      const clave = anterior.source[anterior.value]?.clave;
      const mismo = lista.findIndex((p) => p.clave === clave);
      return mismo >= 0 ? mismo : 0;
    },
  });

  protected readonly actual = computed(() => this.lista()[this.indice()] ?? null);
  protected readonly total = computed(() => this.lista().length);
  protected readonly esPrimero = computed(() => this.indice() <= 0);
  protected readonly esUltimo = computed(() => this.indice() >= this.total() - 1);

  protected readonly reproduciendo = signal(false);
  protected readonly velocidad = signal<VelocidadDelRecorrido>('normal');
  /** Read in the browser; on the server it is assumed reduced (no playback in SSR). */
  protected readonly movimientoReducido = signal(true);

  private readonly segmentos = viewChildren<ElementRef<HTMLButtonElement>>('segmento');

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const consulta = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      if (consulta === undefined) {
        this.movimientoReducido.set(false);
        return;
      }
      const leer = (): void => {
        this.movimientoReducido.set(consulta.matches);
        if (consulta.matches) this.reproduciendo.set(false);
      };
      leer();
      consulta.addEventListener('change', leer);
      destroyRef.onDestroy(() => consulta.removeEventListener('change', leer));
    });

    // Emit the current step every time it changes.
    effect(() => {
      const paso = this.actual();
      if (paso === null) return;
      const indice = this.indice();
      const total = this.total();
      untracked(() =>
        this.pasoActual.emit({ indice, total, paso, enfocar: paso.enfocar, revelados: paso.revelados }),
      );
    });

    // The playback timer: one per step, cancelled on change.
    effect((alLimpiar) => {
      if (!this.reproduciendo()) return;
      if (this.esUltimo()) {
        untracked(() => this.reproduciendo.set(false));
        return;
      }
      const espera = MS_POR_PASO[this.velocidad()];
      this.indice();
      const temporizador = setTimeout(() => this.irA(this.indice() + 1), espera);
      alLimpiar(() => clearTimeout(temporizador));
    });

    // Touching the network pauses. The first read is the initial value, not an interaction.
    let primera = true;
    effect(() => {
      this.interaccionEnLaRed();
      if (primera) {
        primera = false;
        return;
      }
      untracked(() => this.reproduciendo.set(false));
    });
  }

  protected anterior(): void {
    this.pausar();
    this.irA(this.indice() - 1);
  }

  protected siguiente(): void {
    this.pausar();
    this.irA(this.indice() + 1);
  }

  protected alternar(): void {
    if (this.movimientoReducido()) return;
    if (this.reproduciendo()) {
      this.pausar();
      return;
    }
    // Playing from the end starts over.
    if (this.esUltimo()) this.indice.set(0);
    this.reproduciendo.set(true);
  }

  protected saltarA(indice: number): void {
    this.pausar();
    this.irA(indice);
  }

  /** Pauses playback. Public for whoever mounts the control. */
  pausar(): void {
    this.reproduciendo.set(false);
  }

  protected elegirVelocidad(valor: VelocidadDelRecorrido): void {
    this.velocidad.set(valor);
  }

  /** Arrows and space, except inside controls that already use those keys. */
  protected alTeclado(evento: KeyboardEvent): void {
    const destino = evento.target instanceof HTMLElement ? evento.target : null;
    if (destino !== null && destino.closest('[role="radiogroup"], input, select, textarea') !== null) return;
    if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      this.siguiente();
      this.enfocarSegmentoSiCorresponde(destino);
    } else if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      this.anterior();
      this.enfocarSegmentoSiCorresponde(destino);
    } else if (evento.key === 'Home') {
      evento.preventDefault();
      this.saltarA(0);
      this.enfocarSegmentoSiCorresponde(destino);
    } else if (evento.key === 'End') {
      evento.preventDefault();
      this.saltarA(this.total() - 1);
      this.enfocarSegmentoSiCorresponde(destino);
    } else if (evento.key === ' ' || evento.key === 'Spacebar') {
      // On a button, space already activates it: it is not duplicated.
      if (destino !== null && destino.closest('button') !== null) return;
      evento.preventDefault();
      this.alternar();
    }
  }

  protected etiquetaDeSegmento(paso: PasoDelRecorrido, i: number): string {
    return `Ir al paso ${i + 1} de ${this.total()}: ${paso.fechaTexto}, ${paso.titulo}`;
  }

  private irA(indice: number): void {
    const total = this.total();
    if (total === 0) return;
    this.indice.set(Math.min(Math.max(indice, 0), total - 1));
  }

  /** If the focus was on the progress line, it moves it to the new step's segment. */
  private enfocarSegmentoSiCorresponde(destino: HTMLElement | null): void {
    if (destino === null || destino.closest('.guiado__progreso') === null) return;
    this.segmentos()[this.indice()]?.nativeElement.focus();
  }
}
