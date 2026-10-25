import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  type TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap, tap, type Observable } from 'rxjs';

import { ReceivedServicesClient } from '../../../../core/data-access/received-services/received-services.client';
import { TerminologyClient } from '../../../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState, ViewStateNextAction } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../atoms/badge/badge';
import { Alert } from '../../molecules/alert/alert';
import { DataTable } from '../data-table/data-table';
import type { ColumnDef } from '../data-table/data-table.types';
import {
  conceptsOf,
  receivedServiceRows,
  type ReceivedServiceRow,
} from './received-services-view-model';

/** Servicios que se piden de una vez. Si hay más, la lista lo dice. */
const LIMIT = 100;

/** Qué se le ofrece a quien no tiene ningún servicio: una indicación, no una ruta. */
const DEFAULT_EMPTY_ACTION: ViewStateNextAction = {
  label: 'Aparecen cuando se completa una intervención o se aplica una vacuna',
};

interface Loaded {
  readonly state: ViewState<readonly ReceivedServiceRow[]>;
  readonly truncated: boolean;
  readonly costsVisible: boolean;
}

/**
 * «Servicios recibidos» de la historia clínica: las intervenciones médicas
 * realizadas y las vacunas.
 *
 * ## Qué entra y qué no
 *
 * Entra lo que se le HIZO al paciente y no tiene pestaña propia. La consulta
 * vive en «Atenciones»; el laboratorio y la imagenología, en «Resultados».
 * El tipo es un concepto extensible: un servicio de un tipo nuevo se dibuja con
 * su etiqueta, sin tocar esta pantalla.
 *
 * ## Una sola pieza para el paciente y para el médico
 *
 * La historia del paciente y la ficha del médico montan este mismo panel, así
 * que dicen lo mismo. Lo que cambia lo decide la API, no el cliente: el paciente
 * o quien lo representa ve el costo y el personal clínico no (`costsVisible`).
 *
 * ## Carga perezosa y falla aislada
 *
 * Lee solo cuando la pestaña se monta. Un error acá se queda acá: la historia
 * entera no se cae porque falte una pestaña.
 */
@Component({
  selector: 'app-received-services-panel',
  imports: [DataTable, Badge, Alert, DatePipe],
  templateUrl: './received-services-panel.html',
  styleUrl: './received-services-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceivedServicesPanel {
  private readonly client = inject(ReceivedServicesClient);
  private readonly terminology = inject(TerminologyClient);

  /** De quién son los servicios. */
  readonly patientProfileId = input.required<string>();

  /** Qué se indica cuando no hay ninguno. */
  readonly emptyAction = input<ViewStateNextAction>(DEFAULT_EMPTY_ACTION);

  private readonly attempt = signal(0);
  protected readonly state = signal<ViewState<readonly ReceivedServiceRow[]>>(loading());
  protected readonly truncated = signal(false);
  protected readonly costsVisible = signal(true);

  protected readonly limit = LIMIT;
  protected readonly trackBy = (row: ReceivedServiceRow): string => row.id;

  private readonly serviceCell = viewChild.required<TemplateRef<{ $implicit: ReceivedServiceRow }>>('serviceCell');
  private readonly dateCell = viewChild.required<TemplateRef<{ $implicit: ReceivedServiceRow }>>('dateCell');
  private readonly performerCell = viewChild.required<TemplateRef<{ $implicit: ReceivedServiceRow }>>('performerCell');

  protected readonly columns = computed<readonly ColumnDef<ReceivedServiceRow>[]>(() => {
    const base: ColumnDef<ReceivedServiceRow>[] = [
      { key: 'performedAt', header: 'Fecha', priority: 1, cell: this.dateCell() },
      { key: 'title', header: 'Servicio', priority: 1, cell: this.serviceCell() },
      { key: 'performer', header: 'Profesional y sede', priority: 2, cell: this.performerCell() },
      { key: 'status', header: 'Estado', priority: 1 },
      { key: 'result', header: 'Resultado', priority: 3 },
    ];
    // Sin importes para quien no los ve: una columna vacía se leería como «sin cobro».
    return this.costsVisible() ? [...base, { key: 'cost', header: 'Costo', priority: 2, align: 'end' }] : base;
  });

  constructor() {
    toObservable(computed(() => ({ id: this.patientProfileId(), attempt: this.attempt() })))
      .pipe(
        tap(() => this.state.set(loading())),
        switchMap(({ id }) => this.load(id)),
        takeUntilDestroyed(),
      )
      .subscribe((loaded) => {
        this.truncated.set(loaded.truncated);
        this.costsVisible.set(loaded.costsVisible);
        this.state.set(loaded.state);
      });
  }

  protected retry(): void {
    this.attempt.update((attempt) => attempt + 1);
  }

  private load(patientProfileId: string): Observable<Loaded> {
    return this.client.list(patientProfileId, LIMIT).pipe(
      switchMap((page) =>
        forkJoin({
          page: of(page),
          // Sin etiquetas los servicios igual se muestran: perder la traducción
          // de un concepto no justifica perder el servicio.
          labels: this.terminology
            .readConceptLabels(conceptsOf(page.items))
            .pipe(catchError(() => of<ConceptLabels>(new Map()))),
        }),
      ),
      map(({ page, labels }): Loaded => {
        const rows = receivedServiceRows(page, labels);
        return {
          state:
            rows.length === 0
              ? empty(this.emptyAction(), 'Todavía no hay servicios recibidos en esta historia.')
              : ready(rows),
          truncated: page.truncated,
          costsVisible: page.costsVisible,
        };
      }),
      catchError((error: unknown) =>
        of<Loaded>({ state: errorToViewState<readonly ReceivedServiceRow[]>(error), truncated: false, costsVisible: true }),
      ),
    );
  }
}
