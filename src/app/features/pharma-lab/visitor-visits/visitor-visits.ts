import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { PharmaLabClient } from '../../../core/data-access/pharma-lab/pharma-lab.client';
import type { VisitRequest } from '../../../core/data-access/pharma-lab/pharma-lab.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { PharmaLabConcepts, type ConceptDictionary } from '../../../core/data-access/pharma-lab/pharma-lab-concepts.client';

/** Datos de la pantalla del visitador. */
export interface VisitorVisitsData {
  readonly requests: readonly VisitRequest[];
  readonly concepts: ConceptDictionary;
}

/**
 * Las visitas del visitador médico (carril 17, spec 5343-5394).
 *
 * ## Lo que esta pantalla no puede hacer
 *
 * No hay ninguna vista de pacientes, historia clínica ni recetas, y no es una
 * omisión de alcance: la especificación se lo prohíbe expresamente al visitador
 * (5316-5318). El cliente que esta pantalla usa tampoco expone métodos para
 * pedirlo — la garantía está en las dos capas, y en la API que revalida.
 *
 * ## Cancelar tiene plazo
 *
 * El botón existe siempre, pero el backend rechaza la cancelación pasada la
 * ventana que fijó el doctor. Se muestra el error tal como llega en vez de
 * ocultar el botón: una acción que desaparece sin explicación es peor que una
 * que dice por qué no se puede.
 */
@Component({
  selector: 'app-visitor-visits',
  imports: [AppButton, PageHeader, ViewStateHost],
  templateUrl: './visitor-visits.html',
  styleUrl: './visitor-visits.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitorVisits {
  private readonly api = inject(PharmaLabClient);
  private readonly conceptsApi = inject(PharmaLabConcepts);

  protected readonly state = signal<ViewState<VisitorVisitsData>>(loading());
  protected readonly data = computed(() => dataOf(this.state()));

  /** Último mensaje de la acción ejecutada, de éxito o de rechazo. */
  protected readonly aviso = signal<string | null>(null);

  /** Motivo de la cancelación. El backend lo exige. */
  protected readonly motivo = signal('');

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  protected concepto(conceptId: string | undefined): string {
    return this.data()?.concepts.label(conceptId) ?? '—';
  }

  protected escribirMotivo(evento: Event): void {
    this.motivo.set((evento.target as HTMLInputElement).value);
  }

  protected cancelar(request: VisitRequest): void {
    const motivo = this.motivo().trim();
    if (motivo === '') {
      this.aviso.set('Escribí el motivo antes de cancelar.');
      return;
    }
    this.api.cancelVisit(request.id, motivo).subscribe({
      next: (resultado) => {
        this.aviso.set(
          `Visita cancelada: ${this.concepto(resultado.statusConceptId)}.`,
        );
        this.motivo.set('');
        this.load();
      },
      error: (error: unknown) => this.aviso.set(mensajeDeError(error)),
    });
  }

  private load(): void {
    this.state.set(loading());
    forkJoin({
      requests: this.api.listOwnVisitRequests(),
      concepts: this.conceptsApi.load(),
    }).subscribe({
      next: (partes) => this.state.set(ready(partes)),
      error: (error: unknown) =>
        this.state.set(errorToViewState<VisitorVisitsData>(error)),
    });
  }
}

/**
 * El mensaje del servidor, no uno inventado.
 *
 * Cuando el backend rechaza por plazo o por producto no autorizado, esa frase es
 * la información útil; reemplazarla por «no se pudo cancelar» la borraría.
 */
export function mensajeDeError(error: unknown): string {
  const cuerpo = (error as { error?: { message?: unknown } })?.error;
  if (typeof cuerpo?.message === 'string') return cuerpo.message;
  if (Array.isArray(cuerpo?.message)) return cuerpo.message.join('. ');
  return 'No se pudo completar la operación.';
}
