import { DestroyRef, inject, signal } from '@angular/core';
import type { Observable, Subscription } from 'rxjs';

import { errorToViewState } from '@core/http/error-to-view-state';
import { empty, loading, ready, stale } from '@core/view-state/view-state';
import type { EmptyViewState, ViewState } from '@core/view-state/view-state.types';

/** Cómo decide un widget qué hacer con lo que llegó. Todo es opcional: sin reglas, llegó = `ready`. */
export interface ReglasWidget<T> {
  /** Un estado S3 (con próxima acción) cuando la respuesta no trae nada que mostrar. */
  readonly vacio?: (datos: T) => EmptyViewState | null;
  /** S7: la fecha de los datos si están atrasados; `null` si están al día. */
  readonly atrasado?: (datos: T) => Date | null;
  /** Se llama con cada respuesta buena (p. ej. para publicar la frescura en la cabecera). */
  readonly alRecibir?: (datos: T) => void;
}

/**
 * El estado de UN widget (nueve estados M34), con sus propias peticiones: una pestaña con un 403 en un widget
 * no apaga a los demás. Al volver a pedir se CONSERVAN los datos anteriores (`refrescando`) en vez de volver a
 * un esqueleto: el gráfico no salta. Una petición nueva cancela la anterior (la última gana).
 */
export class WidgetState<T> {
  private readonly destroyRef = inject(DestroyRef);
  private sub: Subscription | null = null;

  readonly state = signal<ViewState<T>>(loading());
  readonly refrescando = signal(false);

  constructor() {
    this.destroyRef.onDestroy(() => this.sub?.unsubscribe());
  }

  cargar(fuente: Observable<T>, reglas: ReglasWidget<T> = {}): void {
    this.sub?.unsubscribe();
    const previo = this.state();
    if (previo.status === 'ready' || previo.status === 'stale') {
      this.refrescando.set(true);
    } else {
      this.state.set(loading());
    }
    this.sub = fuente.subscribe({
      next: (datos) => {
        this.refrescando.set(false);
        reglas.alRecibir?.(datos);
        const vacio = reglas.vacio?.(datos) ?? null;
        if (vacio !== null) {
          this.state.set(vacio);
          return;
        }
        const desde = reglas.atrasado?.(datos) ?? null;
        this.state.set(desde === null ? ready(datos) : stale(datos, desde));
      },
      error: (e: unknown) => {
        this.refrescando.set(false);
        this.state.set(errorToViewState<T>(e));
      },
    });
  }

  /** Vuelve a S2 sin conservar nada (cambio de contexto que invalida lo que se veía). */
  reiniciar(): void {
    this.sub?.unsubscribe();
    this.refrescando.set(false);
    this.state.set(loading());
  }

  /** Un vacío con su próxima acción, para widgets que se arman sin petición. */
  vaciar(accion: string, mensaje: string): void {
    this.state.set(empty({ label: accion }, mensaje));
  }
}

/** Mientras más de este tiempo pase sin que alguna instancia vuelque datos, los números de tráfico están atrasados (S7). */
export const UMBRAL_ATRASO_SEGUNDOS = 180;

/** Si el último volcado quedó más atrás que el umbral, los datos están atrasados «desde» ese instante. */
export function atrasoDeFrescura(f: { lastFlushAt: string | null; lagSeconds: number | null }): Date | null {
  if (f.lastFlushAt === null || f.lagSeconds === null) return null;
  return f.lagSeconds > UMBRAL_ATRASO_SEGUNDOS ? new Date(f.lastFlushAt) : null;
}
