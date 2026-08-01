import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  isDevMode,
  output,
  PLATFORM_ID,
  untracked,
} from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';

import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Alert } from '../../molecules/alert/alert';
import { AppButton } from '../../atoms/button/button';
import { EmptyState } from '../../molecules/empty-state/empty-state';
import { Link } from '../../atoms/link/link';
import { RouterLink } from '@angular/router';
import { Skeleton } from '../../atoms/skeleton/skeleton';
import { Spinner } from '../../atoms/spinner/spinner';

/**
 * Renderiza los 9 estados del M34 **una sola vez para todo el proyecto**: cada
 * una de las 81 secciones envuelve su contenido en este organismo y se olvida
 * de qué se muestra cuando el dato no está.
 *
 * ```html
 * <app-view-state-host [state]="pacientes()" (retry)="recargar()">
 *   <div vsh-skeleton><app-skeleton variant="text" [lines]="5" /></div>
 *   <tabla [filas]="filas()" />
 * </app-view-state-host>
 * ```
 *
 * Reglas duras que este componente encarna (no las repitas afuera):
 *
 * - **S1 ≠ S2**: mientras la ruta autoriza, NO hay esqueleto de contenido —
 *   un esqueleto insinúa que hay algo que ver antes de saber si se puede.
 * - **S6 ≠ S5**: el «no encontrado» es idéntico exista o no el recurso.
 * - **S7** muestra `asOf` siempre visible, nunca solo en un tooltip.
 * - **S9** muestra el `requestId` copiable: sin él no hay soporte posible.
 *
 * El organismo no reintenta solo: emite `retry`/`refresh` y el dueño de los
 * datos decide.
 */
@Component({
  selector: 'app-view-state-host',
  imports: [Alert, AppButton, DatePipe, EmptyState, Link, RouterLink, Skeleton, Spinner],
  templateUrl: './view-state-host.html',
  styleUrl: './view-state-host.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'view-state-host',
    // Los cambios de estado se anuncian; la urgencia la decide cada estado en
    // su propio bloque (S4/S9 son assertive por su rol de alerta).
    'aria-live': 'polite',
  },
})
export class ViewStateHost<T> {
  private readonly hostElement = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly state = input.required<ViewState<T>>();

  /** S8 y S9: la persona pide reintentar. El dueño de los datos ejecuta. */
  readonly retry = output<void>();

  /** S7: la persona pide datos frescos. */
  readonly refresh = output<void>();

  protected readonly status = computed(() => this.state().status);

  /**
   * S4 mueve el foco al mensaje: la persona tiene que corregir y el error
   * puede haber aparecido lejos de donde estaba mirando. S2/S7 NO lo mueven —
   * robar el foco durante una carga es perder el lugar en la página.
   */
  constructor() {
    effect(() => {
      const status = this.status();
      if (status !== 'validation' || !this.isBrowser) {
        return;
      }
      untracked(() => this.focusValidationMessage());
    });

    if (isDevMode()) {
      effect(() => {
        if (this.status() === 'error' && !this.errorRequestId()) {
          console.warn(
            '[app-view-state-host] S9 sin requestId: el estado no debería poder construirse así.',
          );
        }
      });
    }
  }

  /* ---- proyecciones estrechadas por estado --------------------------------
     `computed` + comprobación del discriminante: la plantilla consume estos
     accesores y el tipo llega estrecho sin conversiones. */

  protected readonly emptyState = computed(() => {
    const state = this.state();
    return state.status === 'empty' ? state : null;
  });

  protected readonly validationState = computed(() => {
    const state = this.state();
    return state.status === 'validation' ? state : null;
  });

  protected readonly forbiddenState = computed(() => {
    const state = this.state();
    return state.status === 'forbidden' ? state : null;
  });

  protected readonly notFoundState = computed(() => {
    const state = this.state();
    return state.status === 'not-found' ? state : null;
  });

  protected readonly staleState = computed(() => {
    const state = this.state();
    return state.status === 'stale' ? state : null;
  });

  protected readonly errorState = computed(() => {
    const state = this.state();
    return state.status === 'error' ? state : null;
  });

  protected readonly errorRequestId = computed(() => this.errorState()?.requestId ?? '');

  /** Los estados que muestran contenido proyectado: el feliz y el viejo. */
  protected readonly showsContent = computed(
    () => this.status() === 'ready' || this.status() === 'stale',
  );

  protected requestRetry(): void {
    this.retry.emit();
  }

  protected requestRefresh(): void {
    this.refresh.emit();
  }

  /**
   * Copia el requestId al portapapeles. Si el navegador no deja (contexto no
   * seguro), el id sigue visible y seleccionable: copiar es comodidad, verlo
   * es el requisito.
   */
  protected async copyRequestId(): Promise<void> {
    const id = this.errorRequestId();
    if (!id || !this.isBrowser || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(id);
    } catch {
      // El id queda visible: no hay nada que recuperar acá.
    }
  }

  private focusValidationMessage(): void {
    // El alert de S4 todavía no está pintado cuando el effect corre: el
    // microtask alcanza porque el render síncrono ya pasó.
    queueMicrotask(() => {
      const alerta = this.hostElement.nativeElement.querySelector<HTMLElement>(
        '.view-state-host__validation',
      );
      alerta?.setAttribute('tabindex', '-1');
      alerta?.focus();
    });
  }
}
