import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
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
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { PharmaLabConcepts, type ConceptDictionary } from '../../../core/data-access/pharma-lab/pharma-lab-concepts.client';
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

interface FilaDeSolicitud {
  readonly id: string;
  readonly fecha: string;
  readonly duracion: string;
  readonly modalidad: string;
  readonly motivo: string;
  readonly estado: string;
  readonly request: VisitRequest;
}

interface FilaDeFranja {
  readonly id: string;
  readonly dia: string;
  readonly desde: string;
  readonly hasta: string;
  readonly duracion: string;
  readonly modalidad: string;
  readonly lugar: string;
}

interface FilaDeRegistro {
  readonly id: string;
  readonly fecha: string;
  readonly lugar: string;
  readonly temas: string;
  readonly confirmacion: string;
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
  imports: [AppButton, DataTable, PageHeader, Tab, Tabs, ViewStateHost],
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

  /* ---- las tres tablas, en el organismo del sistema (refactor UX) --------
     Eran `<table>` escritas a mano: a 390 px empujaban la página de costado y
     no tenían prioridad de columnas, detalle plegable ni indicio de scroll. */

  private readonly celdaDecision =
    viewChild.required<TemplateRef<{ $implicit: FilaDeSolicitud }>>('celdaDecision');

  protected readonly solicitudes = computed<ViewState<readonly FilaDeSolicitud[]>>(() => {
    const datos = this.data();
    if (datos === null) return loading();
    return ready(
      datos.requests.map((request) => ({
        id: request.id,
        fecha: request.requestedStartAt.toLocaleString('es-BO'),
        duracion: `${request.durationMinutes} min`,
        modalidad: this.concepto(request.modalityConceptId),
        motivo: request.reason,
        estado: this.concepto(request.statusConceptId),
        request,
      })),
    );
  });

  protected readonly columnasDeSolicitudes = computed<readonly ColumnDef<FilaDeSolicitud>[]>(
    () => [
      { key: 'fecha', header: 'Fecha solicitada', priority: 1 },
      { key: 'motivo', header: 'Motivo', priority: 1 },
      { key: 'estado', header: 'Estado', priority: 1 },
      { key: 'duracion', header: 'Duración', priority: 2 },
      { key: 'modalidad', header: 'Modalidad', priority: 2 },
      { key: 'decision', header: 'Decisión', priority: 1, cell: this.celdaDecision() },
    ],
  );

  protected readonly franjas = computed<ViewState<readonly FilaDeFranja[]>>(() => {
    const agenda = this.data()?.agenda;
    if (agenda === undefined || agenda === null) return loading();
    return ready(
      agenda.windows.map((ventana, indice) => ({
        id: `franja-${indice}`,
        dia: this.dia(ventana.weekday),
        desde: ventana.startTime,
        hasta: ventana.endTime,
        duracion: `${ventana.slotDurationMinutes} min`,
        modalidad: this.concepto(ventana.modalityConceptId),
        lugar: ventana.location ?? '—',
      })),
    );
  });

  protected readonly columnasDeFranjas: readonly ColumnDef<FilaDeFranja>[] = [
    { key: 'dia', header: 'Día', priority: 1 },
    { key: 'desde', header: 'Desde', priority: 1 },
    { key: 'hasta', header: 'Hasta', priority: 1 },
    { key: 'duracion', header: 'Duración', priority: 2 },
    { key: 'modalidad', header: 'Modalidad', priority: 2 },
    { key: 'lugar', header: 'Lugar', priority: 2 },
  ];

  protected readonly registros = computed<ViewState<readonly FilaDeRegistro[]>>(() => {
    const datos = this.data();
    if (datos === null) return loading();
    return ready(
      datos.records.map((record) => ({
        id: record.id,
        fecha: record.occurredAt.toLocaleString('es-BO'),
        lugar: record.location ?? '—',
        temas: record.topicsDiscussed ?? '—',
        confirmacion: this.concepto(record.confirmationConceptId),
      })),
    );
  });

  protected readonly columnasDeRegistros: readonly ColumnDef<FilaDeRegistro>[] = [
    { key: 'fecha', header: 'Fecha', priority: 1 },
    { key: 'temas', header: 'Temas', priority: 1 },
    { key: 'confirmacion', header: 'Confirmación', priority: 1 },
    { key: 'lugar', header: 'Lugar', priority: 2 },
  ];

  protected readonly porId = (fila: { readonly id: string }): string => fila.id;
  /** Nombres de fila para el lector de pantalla (`rowLabel` de la tabla). */
  protected readonly nombreDeSolicitud = (fila: FilaDeSolicitud): string =>
    `la solicitud del ${fila.fecha}`;
  protected readonly nombreDeFranja = (fila: FilaDeFranja): string =>
    `la franja del ${fila.dia} de ${fila.desde} a ${fila.hasta}`;
  protected readonly nombreDeRegistro = (fila: FilaDeRegistro): string =>
    `la visita del ${fila.fecha}`;

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
