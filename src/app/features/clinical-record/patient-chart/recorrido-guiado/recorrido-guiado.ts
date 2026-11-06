import {
  afterNextRender,
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
    El control del recorrido guiado: anterior / reproducir-pausa / siguiente.

    Recibe los pasos ya armados (`armarRecorridoGuiado`) y dice cuál es el
    actual; no mira la red ni sabe de la API. Quien lo monta enfoca y revela
    los nodos con lo que emite `pasoActual` (ver ADR-0022).

    ## Reproducir no es obligatorio

    Con `prefers-reduced-motion: reduce` no hay reproducción automática: el
    botón queda deshabilitado y dice por qué, y se avanza con anterior y
    siguiente. Cualquier interacción con la red (`interaccionEnLaRed`) pausa:
    si la persona se puso a mirar un nodo, el recorrido no le cambia el foco
    por debajo.
    ========================================================================== */

export type VelocidadDelRecorrido = 'lenta' | 'normal' | 'rapida';

/** Milisegundos por paso. Pensados para leer una narración de dos o tres frases. */
export const MS_POR_PASO: Readonly<Record<VelocidadDelRecorrido, number>> = {
  lenta: 11000,
  normal: 7000,
  rapida: 4000,
};

/** Lo que emite el control cada vez que cambia el paso. */
export interface PasoActualDelRecorrido {
  /** Índice en la lista que se está recorriendo (filtrada si se sigue un episodio). */
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
    '(keydown)': 'alTeclado($event)',
  },
})
export class RecorridoGuiado {
  /** Los pasos en orden, tal como salen de `armarRecorridoGuiado`. */
  readonly pasos = input.required<readonly PasoDelRecorrido[]>();
  /** Si viene, se recorre sólo lo que toca estos ids (un episodio). */
  readonly episodio = input<readonly string[] | null>(null);
  /** El nombre del episodio que se sigue, para decirlo en pantalla. */
  readonly nombreDelEpisodio = input<string | null>(null);
  /**
   * Cambia cada vez que la persona toca la red (un contador, un id elegido…).
   * Cualquier cambio pausa la reproducción.
   */
  readonly interaccionEnLaRed = input<unknown>(undefined);

  /** El paso actual, con lo que hay que enfocar y lo ya revelado. */
  readonly pasoActual = output<PasoActualDelRecorrido>();

  protected readonly velocidades = VELOCIDADES;

  protected readonly lista = computed<readonly PasoDelRecorrido[]>(() => {
    const episodio = this.episodio();
    return episodio === null ? this.pasos() : seguirEpisodio(this.pasos(), episodio);
  });

  /** Vuelve al primer paso cuando cambia la lista (otro paciente, otro episodio). */
  protected readonly indice = linkedSignal<readonly PasoDelRecorrido[], number>({
    source: this.lista,
    computation: (lista, anterior) => {
      if (anterior === undefined || lista.length === 0) return 0;
      // Si la lista cambió pero el paso sigue estando, se queda en él.
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
  /** Se lee en el navegador; en el servidor se asume reducido (no hay reproducción en SSR). */
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

    // Emitir el paso actual cada vez que cambia.
    effect(() => {
      const paso = this.actual();
      if (paso === null) return;
      const indice = this.indice();
      const total = this.total();
      untracked(() =>
        this.pasoActual.emit({ indice, total, paso, enfocar: paso.enfocar, revelados: paso.revelados }),
      );
    });

    // El temporizador de la reproducción: uno por paso, se cancela al cambiar.
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

    // Tocar la red pausa. La primera lectura es el valor inicial, no una interacción.
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
    // Reproducir desde el final vuelve a empezar.
    if (this.esUltimo()) this.indice.set(0);
    this.reproduciendo.set(true);
  }

  protected saltarA(indice: number): void {
    this.pausar();
    this.irA(indice);
  }

  /** Pausa la reproducción. Público para quien monta el control. */
  pausar(): void {
    this.reproduciendo.set(false);
  }

  protected elegirVelocidad(valor: VelocidadDelRecorrido): void {
    this.velocidad.set(valor);
  }

  /** Flechas y espacio, salvo dentro de controles que ya usan esas teclas. */
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
      // Sobre un botón, el espacio ya lo activa: no se duplica.
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

  /** Si el foco estaba en la línea de progreso, lo lleva al segmento del paso nuevo. */
  private enfocarSegmentoSiCorresponde(destino: HTMLElement | null): void {
    if (destino === null || destino.closest('.guiado__progreso') === null) return;
    this.segmentos()[this.indice()]?.nativeElement.focus();
  }
}
