import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { DiagnosticsClient } from '../../core/data-access/diagnostics/diagnostics.client';
import type { LabWorkOrder } from '../../core/data-access/diagnostics/diagnostics.types';
import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { CLINICAL_RECORD_ROUTE } from '../clinical-record/clinical-record.routes';

/** Tope de filas de la cola. La API acota a 200; acá alcanza una pantalla. */
const TOPE = 50;

/** Lo que se muestra cuando un concepto no tiene etiqueta en el catálogo. */
const SIN_DATO = '—';

/**
 * **Laboratorio e imagenología** (M20) — la cola de trabajo del laboratorio.
 *
 * ## Por qué esta sección muestra una cola y no elige una persona
 *
 * Porque es la única lectura del módulo que **no** pide un paciente:
 * `GET /diagnostics/work-orders` es la vista del laboratorio sobre su propio
 * trabajo —qué hay pendiente, con qué prioridad, quién lo tiene— acotada
 * siempre al tenant del contexto por el backend.
 *
 * El otro lado del circuito —pedir un estudio y ver su resultado— vive en la
 * ficha del paciente, que es donde está quien lo pide. No hay pantalla que
 * liste «todos los estudios de la organización» por el mismo motivo por el que
 * no hay una que liste todas las historias clínicas.
 *
 * ## La cola no trae paciente, y no se lo inventa
 *
 * El contrato de `WorkOrderSummaryDto` no expone el paciente: la orden de
 * trabajo cuelga de una acesión de laboratorio, no de una persona. Cruzarlo acá
 * pidiendo la acesión de cada fila serían N peticiones para una columna, y
 * adivinarlo sería peor. La cola se recorre por número de orden, que es como la
 * recorre el laboratorio; quien necesite la persona entra por su ficha.
 *
 * ## Los estados se traducen; los uuid no se muestran
 *
 * `statusConceptId` y `priorityConceptId` son catálogo. Se resuelven con
 * `TerminologyClient.readConceptLabels` y, si la terminología falla, la cola se
 * muestra igual con guiones: perder los nombres es molesto, perder la lista
 * entera porque el catálogo no respondió sería peor.
 */
@Component({
  selector: 'app-diagnostics',
  imports: [Alert, Card, DataTable, DatePipe, PageHeader],
  templateUrl: './diagnostics.html',
  styleUrl: './diagnostics.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Diagnostics {
  private readonly diagnostics = inject(DiagnosticsClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  private readonly celdaOrden =
    viewChild.required<TemplateRef<{ $implicit: LabWorkOrder }>>('celdaOrden');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: LabWorkOrder }>>('celdaEstado');
  private readonly celdaCuando =
    viewChild.required<TemplateRef<{ $implicit: LabWorkOrder }>>('celdaCuando');

  protected readonly cola = signal<ViewState<readonly LabWorkOrder[]>>(loading());

  /** Las etiquetas de los conceptos que la cola muestra. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly cargando = computed(() => this.cola().status === 'loading');

  protected readonly columnas = computed<readonly ColumnDef<LabWorkOrder>[]>(() => [
    { key: 'workOrderNumber', header: 'Orden', priority: 1, cell: this.celdaOrden() },
    { key: 'statusConceptId', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'scheduledAt', header: 'Programada', priority: 2, cell: this.celdaCuando() },
  ]);

  protected readonly porOrden = (fila: LabWorkOrder): string => fila.id;

  constructor() {
    effect(() => {
      untracked(() => this.cargar());
    });
  }

  /** La etiqueta de un concepto, o el guion si el catálogo no la tiene. */
  protected etiquetaDe(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }

  protected recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cola.set(loading());

    this.diagnostics
      .listWorkOrders({ limit: TOPE })
      .pipe(
        switchMap((filas) =>
          forkJoin({
            filas: of(filas),
            etiquetas: this.terminology
              .readConceptLabels(conceptosDe(filas))
              .pipe(catchError(() => of(new Map() as ConceptLabels))),
          }),
        ),
      )
      .subscribe({
        next: ({ filas, etiquetas }) => {
          this.etiquetas.set(etiquetas);

          if (filas.length === 0) {
            // La salida no es «crear una orden»: la orden de trabajo nace de
            // acesionar un espécimen recibido, no de un formulario. Lo que sí
            // puede hacer quien llegó hasta acá es pedir un estudio, y eso vive
            // en la ficha del paciente.
            this.cola.set(
              empty(
                { label: 'Ir al archivo clínico', route: CLINICAL_RECORD_ROUTE },
                'No hay órdenes de trabajo en la cola del laboratorio. Aparecen acá ' +
                  'cuando se acesionan los especímenes recibidos.',
              ),
            );
            return;
          }

          this.cola.set(ready(filas));
        },
        error: (error: unknown) =>
          this.cola.set(errorToViewState<readonly LabWorkOrder[]>(error)),
      });
  }
}

/**
 * Los conceptos que la cola necesita traducir.
 *
 * Una sola lista para las dos columnas de catálogo porque `readConceptLabels`
 * ya deduplica y trocea: dos llamadas separadas pedirían dos veces los estados
 * que se repiten entre filas, que en una cola son casi todos.
 */
function conceptosDe(filas: readonly LabWorkOrder[]): readonly string[] {
  const ids: string[] = [];
  for (const fila of filas) {
    ids.push(fila.statusConceptId, fila.priorityConceptId);
  }
  return ids;
}
