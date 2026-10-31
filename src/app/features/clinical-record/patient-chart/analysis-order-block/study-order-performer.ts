import { computed, effect, inject, signal, untracked, type Signal } from '@angular/core';
import type { Subscription } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { loading } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import {
  DEFAULT_PERFORMER_CHOICE,
  isPerformerChoiceComplete,
  performerFieldsOf,
  type PerformerChoice,
  type PerformerFields,
} from './performer-selector/performer-selector.rules';
import { PerformerSiteOptions, type PerformerSiteData } from './performer-selector/performer-site-options';

/**
 * Quién realiza un laboratorio o una imagen (D9).
 *
 * Hermano de `createPerformerOrderState`, que sólo vive para procedimientos
 * (depende de la categoría del concepto). Acá la pregunta es la misma —¿lo hago
 * yo, en este centro, o elige el paciente?— pero se lee las sedes del primer
 * estudio elegido. Se crea en contexto de inyección.
 *
 * `performerTenantId` no sale de acá: la búsqueda de centros no trae el
 * tenant, así que lo que viaja es la recomendación (modo y sede). Sin
 * ejecutor la orden no aparece en ninguna bandeja; ver `sinEjecutor`.
 */
export function createStudyPerformer(firstStudy: Signal<string | null>) {
  const options = inject(PerformerSiteOptions);
  const auth = inject(AuthService);
  const choice = signal<PerformerChoice>(DEFAULT_PERFORMER_CHOICE);
  const read = signal<ViewState<PerformerSiteData>>(loading());
  let inFlight: Subscription | null = null;

  effect(() => {
    const study = firstStudy();
    untracked(() => {
      inFlight?.unsubscribe();
      inFlight = null;
      choice.set(DEFAULT_PERFORMER_CHOICE);
      if (study === null) {
        read.set(loading());
        return;
      }
      inFlight = options.load(study).subscribe((state) => read.set(state));
    });
  });

  const data = computed(() => {
    const state = read();
    return state.status === 'ready' ? state.data : null;
  });

  return {
    choice,
    sites: computed(() => ({
      own: data()?.ownSites ?? [],
      center: data()?.centerSites ?? [],
      loading: read().status === 'loading',
      error: ['error', 'offline', 'forbidden', 'validation'].includes(read().status)
        ? 'No pudimos leer las sedes que ofrecen este estudio.'
        : null,
    })),
    /** Sin ejecutor elegido, la orden no llega a ninguna bandeja. */
    sinEjecutor: computed(() => choice().mode === 'PATIENT_CHOICE'),
    canSubmit: computed(() => isPerformerChoiceComplete(choice())),
    fields: (): PerformerFields | null => performerFieldsOf(choice(), auth.practitionerProfileId(), data()?.concepts ?? null),
    reset: (): void => choice.set(DEFAULT_PERFORMER_CHOICE),
  };
}

export type StudyPerformer = ReturnType<typeof createStudyPerformer>;
