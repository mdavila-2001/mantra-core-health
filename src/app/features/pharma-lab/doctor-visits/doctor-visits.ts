import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { PharmaLabClient } from '../../../core/data-access/pharma-lab/pharma-lab.client';
import type {
  PublishedAgenda,
  VisitRecord,
  VisitRequest,
} from '../../../core/data-access/pharma-lab/pharma-lab.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { PharmaLabConcepts, type ConceptDictionary } from '../pharma-lab-concepts';
import { mensajeDeError } from '../visitor-visits/visitor-visits';

/** Nombre del día de la semana, con 0 = domingo, como lo declara la agenda. */
const DIAS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

/** Datos de la pantalla de visitas del doctor. */
export interface DoctorVisitsData {
  readonly requests: readonly VisitRequest[];
  readonly records: readonly VisitRecord[];
  readonly agenda: PublishedAgenda | null;
  readonly concepts: ConceptDictionary;
}

/**
 * Las visitas de laboratorio que recibe el doctor (carril 17, spec 5396-5421).
 *
 * ## Está separada de la agenda de pacientes
 *
 * La especificación lo pide explícitamente (5399), y hay una razón práctica: la
 * bandeja de un visitador no debe competir por atención con la de una consulta.
 * Lo que sí comparten es el calendario real — el backend rechaza una visita que
 * se superponga con una consulta o una intervención.
 *
 * ## Sin agenda configurada no hay error
 *
 * Un doctor que nunca configuró horarios de visita no está en un estado roto:
 * simplemente no recibe visitadores. Por eso la agenda se pide tolerando el 404
 * y la pantalla lo dice con palabras en vez de mostrar un fallo.
 */
@Component({
  selector: 'app-doctor-visits',
  imports: [AppButton, PageHeader, Tab, Tabs, ViewStateHost],
  templateUrl: './doctor-visits.html',
  styleUrl: './doctor-visits.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorVisits {
  private readonly api = inject(PharmaLabClient);
  private readonly conceptsApi = inject(PharmaLabConcepts);

  protected readonly state = signal<ViewState<DoctorVisitsData>>(loading());
  protected readonly data = computed(() => dataOf(this.state()));
  protected readonly aviso = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected retry(): void {
    this.load();
  }

  protected concepto(conceptId: string | undefined): string {
    return this.data()?.concepts.label(conceptId) ?? '—';
  }

  protected dia(weekday: number): string {
    return DIAS[weekday] ?? `Día ${weekday}`;
  }

  /** Si la solicitud sigue esperando una decisión del doctor. */
  protected esperaDecision(request: VisitRequest): boolean {
    const estado = this.concepto(request.statusConceptId);
    return estado === 'Pendiente de confirmación' || estado === 'Solicitada';
  }

  protected aceptar(request: VisitRequest): void {
    this.api.acceptVisit(request.id).subscribe({
      next: (resultado) => {
        this.aviso.set(`Visita ${this.concepto(resultado.statusConceptId)}.`);
        this.load();
      },
      error: (error: unknown) => this.aviso.set(mensajeDeError(error)),
    });
  }

  protected rechazar(request: VisitRequest): void {
    this.api.rejectVisit(request.id, 'Sin disponibilidad en ese horario').subscribe({
      next: (resultado) => {
        this.aviso.set(`Visita ${this.concepto(resultado.statusConceptId)}.`);
        this.load();
      },
      error: (error: unknown) => this.aviso.set(mensajeDeError(error)),
    });
  }

  private load(): void {
    this.state.set(loading());
    forkJoin({
      requests: this.api.listDoctorVisitRequests(),
      records: this.api.listDoctorVisitRecords(),
      // Un doctor sin agenda de visitas no es un error: es alguien que no recibe
      // visitadores. El 404 se traduce a «no configurada», no a pantalla rota.
      agenda: this.api.getOwnAgenda().pipe(catchError(() => of(null))),
      concepts: this.conceptsApi.load(),
    }).subscribe({
      next: (partes) => this.state.set(ready(partes)),
      error: (error: unknown) =>
        this.state.set(errorToViewState<DoctorVisitsData>(error)),
    });
  }
}
