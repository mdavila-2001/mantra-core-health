import { computed, effect, inject, signal, untracked, type Signal, type WritableSignal } from '@angular/core';
import type { Subscription } from 'rxjs';

import { AuthService } from '../../../../../core/auth/auth.service';
import { SystemContextClient } from '../../../../../core/data-access/system-context/system-context.client';
import { loading } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import {
  DEFAULT_PERFORMER_CHOICE,
  isPerformerChoiceComplete,
  isProcedureCategoryCode,
  performerFieldsOf,
  type PerformerChoice,
  type PerformerFields,
  type PerformerSite,
} from './performer-selector.rules';
import { PerformerSiteOptions, type PerformerSiteData } from './performer-site-options';

/** Lo que el formulario de la orden le pasa al estado del selector. */
export interface PerformerOrderStateInputs {
  /** La categoría elegida (uuid) o `null`. */
  readonly category: Signal<string | null>;
  /** El estudio elegido (uuid): para un procedimiento, es el procedimiento. */
  readonly study: Signal<string | null>;
  /** El binding que puebla las categorías (`esquema.tabla.columna`). */
  readonly categoryTarget: string;
}

/** Lo que el selector muestra de las sedes: nunca inventa, dice por qué faltan. */
export interface PerformerSitesView {
  readonly own: readonly PerformerSite[];
  readonly center: readonly PerformerSite[];
  readonly loading: boolean;
  readonly error: string | null;
}

/**
 * El estado del selector de ejecutor dentro del formulario de la orden.
 *
 * Vive fuera de `analysis-order-block.ts` a propósito: ese archivo está en su
 * techo de líneas (`scripts/baselines/max-lines.json`) y el selector es una
 * responsabilidad aparte. Se crea **en el contexto de inyección del
 * componente** —un inicializador de campo— con {@link createPerformerOrderState}.
 */
export interface PerformerOrderState {
  /** El selector sólo existe en una orden de procedimiento. */
  readonly isProcedure: Signal<boolean>;
  /** La elección del médico; arranca en «Que elija el paciente». */
  readonly choice: WritableSignal<PerformerChoice>;
  readonly sites: Signal<PerformerSitesView>;
  /** Si lo elegido se puede enviar (los modos con sede la exigen). */
  readonly canSubmit: Signal<boolean>;
  /**
   * Los campos de ejecutor del alta, `{}` si no es un procedimiento, o `null`
   * si la elección no se puede enviar (el formulario no manda nada a medias).
   */
  fields(): PerformerFields | null;
  /** Vuelve a «Que elija el paciente»: el siguiente pedido arranca limpio. */
  reset(): void;
}

/** Por qué las sedes no se pudieron leer, en palabras. */
function sitesErrorMessage(state: ViewState<PerformerSiteData>): string | null {
  switch (state.status) {
    case 'ready':
    case 'loading':
      return null;
    case 'offline':
      return 'No pudimos conectarnos. Revise su conexión y reintente.';
    case 'forbidden':
      return state.message || 'Su rol no permite ver las sedes.';
    case 'validation':
      return state.issues.map((issue) => issue.message).join(' ') || 'No pudimos leer las sedes.';
    case 'error':
      return `${state.message || 'No pudimos leer las sedes.'} (${state.requestId})`;
    default:
      return 'No pudimos leer las sedes.';
  }
}

export function createPerformerOrderState(inputs: PerformerOrderStateInputs): PerformerOrderState {
  const systemContext = inject(SystemContextClient);
  const auth = inject(AuthService);
  const options = inject(PerformerSiteOptions);

  const categories = signal<readonly { readonly conceptId: string; readonly code: string }[]>([]);
  const choice = signal<PerformerChoice>(DEFAULT_PERFORMER_CHOICE);
  const read = signal<ViewState<PerformerSiteData>>(loading());
  let inFlight: Subscription | null = null;

  // Sin las categorías no se sabe si es un procedimiento: el selector no aparece.
  systemContext.dynamicEnum(inputs.categoryTarget).subscribe({
    next: (enumeration) => categories.set(enumeration.options),
    error: () => categories.set([]),
  });

  const isProcedure = computed(() => {
    const chosen = inputs.category();
    return chosen !== null && isProcedureCategoryCode(categories().find((c) => c.conceptId === chosen)?.code);
  });

  const reset = (): void => choice.set(DEFAULT_PERFORMER_CHOICE);

  effect(() => {
    const procedure = isProcedure() ? inputs.study() : null;
    untracked(() => {
      inFlight?.unsubscribe();
      inFlight = null;
      // Otro procedimiento, otras sedes: la recomendación anterior no se arrastra.
      reset();
      if (procedure === null) {
        read.set(loading());
        return;
      }
      inFlight = options.load(procedure).subscribe((state) => read.set(state));
    });
  });

  return {
    isProcedure,
    choice,
    sites: computed(() => {
      const state = read();
      const data = state.status === 'ready' ? state.data : null;
      return {
        own: data?.ownSites ?? [],
        center: data?.centerSites ?? [],
        loading: state.status === 'loading',
        error: sitesErrorMessage(state),
      };
    }),
    canSubmit: computed(() => !isProcedure() || isPerformerChoiceComplete(choice())),
    fields: () => {
      if (!isProcedure()) {
        return {};
      }
      const state = read();
      return performerFieldsOf(
        choice(),
        auth.practitionerProfileId(),
        state.status === 'ready' ? state.data.concepts : null,
      );
    },
    reset,
  };
}
