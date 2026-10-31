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
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { SessionStore } from '../../core/auth/session.store';
import { OperatingRoomsClient } from '../../core/data-access/operating-rooms/operating-rooms.client';
import { canManageBlocks, canScheduleCases, canSeeUtilization } from '../../core/data-access/operating-rooms/operating-rooms.rules';
import type { OperatingRoomSummary } from '../../core/data-access/operating-rooms/operating-rooms.types';
import { SiteContextStore } from '../../core/data-access/operating-rooms/site-context.store';
import { ProceduresClient } from '../../core/data-access/procedures/procedures.client';
import type { SurgicalCase } from '../../core/data-access/procedures/procedures.types';
import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { dataOf, empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { AppButton } from '../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../shared/components/atoms/button/button-link';
import { Select } from '../../shared/components/atoms/select/select';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { Tooltip } from '../../shared/components/atoms/tooltip/tooltip';
import { Alert } from '../../shared/components/molecules/alert/alert';
import { Card } from '../../shared/components/molecules/card/card';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { CLINICAL_RECORD_ROUTE } from '../clinical-record/clinical-record.routes';
import { CaseTeam } from './case-team/case-team';
import { timeOf } from './interventions.presentation';
import {
  caseRoute,
  OPERATING_ROOMS_ROUTE,
  OR_BLOCKS_ROUTE,
  OR_UTILIZATION_ROUTE,
  SCHEDULE_CASE_ROUTE,
} from './interventions.routes';

/** Tope de filas de la agenda. Alcanza una pantalla sin paginar. */
const TOPE = 50;

/** Lo que se muestra cuando un concepto no tiene etiqueta en el catálogo. */
const SIN_DATO = '—';

/** El valor del filtro que significa «todas las salas». */
const ALL_ROOMS = '';

/**
 * **Intervenciones médicas** (M53) — la agenda quirúrgica y la aceptación del
 * equipo.
 *
 * ## Qué contesta esta pantalla y qué no
 *
 * Contesta dos preguntas del profesional: *qué hay programado* y *qué me toca
 * confirmar a mí*. La primera sale de `GET /procedure-cases`, acotado siempre
 * al tenant por el backend; la segunda, del equipo de cada caso.
 *
 * No contesta *qué se le hizo a esta persona*: ése es el histórico, vive en la
 * ficha del paciente y ya lo pinta `procedures-block`.
 *
 * ## Por qué la aceptación es el centro y no un detalle
 *
 * `POST /procedure-cases/:id/confirm` exige que **cada** integrante con rol
 * clínico haya aceptado. La aceptación vive ahora en `app-case-team` —la misma
 * que monta la ficha del caso— sin cambiar su contrato.
 *
 * ## F4 · el quirófano en la agenda (`CONTRATO-F2-F5.md` §F4.4)
 *
 * Cada caso muestra su sala resuelta (`código · nombre`, con la ruta del árbol
 * en el globo; nunca un uuid), su ventana reservada con la preparación y la
 * limpieza que la API le sumó, y el bloque en el que cae. El filtro por
 * quirófano se alimenta de `GET /sites/:siteId/operating-rooms`, nunca de ids
 * fijos. Los accesos a programar, bloques y utilización se ofrecen según el
 * rol; la API vuelve a decidir.
 *
 * ## Los estados se traducen; los uuid no se muestran
 *
 * `statusConceptId` es catálogo. Se resuelve con `readConceptLabels` y, si la
 * terminología falla, la agenda se muestra igual con guiones.
 */
@Component({
  selector: 'app-interventions',
  imports: [Alert, AppButton, AppButtonLink, Badge, Card, CaseTeam, DataTable, DatePipe, PageHeader, RouterLink, Select, Tooltip],
  templateUrl: './interventions.html',
  styleUrl: './interventions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Interventions {
  private readonly procedures = inject(ProceduresClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly session = inject(SessionStore);
  private readonly siteContext = inject(SiteContextStore);
  private readonly operatingRooms = inject(OperatingRoomsClient);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly caseRoute = caseRoute;
  protected readonly timeOf = timeOf;
  protected readonly scheduleRoute = SCHEDULE_CASE_ROUTE;
  protected readonly roomsRoute = OPERATING_ROOMS_ROUTE;
  protected readonly blocksRoute = OR_BLOCKS_ROUTE;
  protected readonly utilizationRoute = OR_UTILIZATION_ROUTE;

  protected readonly canSchedule = computed(() => canScheduleCases(this.session.roles()));
  protected readonly canManage = computed(() => canManageBlocks(this.session.roles()));
  protected readonly canMeasure = computed(() => canSeeUtilization(this.session.roles()));

  private readonly celdaCaso = viewChild.required<TemplateRef<{ $implicit: SurgicalCase }>>('celdaCaso');
  private readonly celdaEstado = viewChild.required<TemplateRef<{ $implicit: SurgicalCase }>>('celdaEstado');
  private readonly celdaCuando = viewChild.required<TemplateRef<{ $implicit: SurgicalCase }>>('celdaCuando');
  private readonly roomCell = viewChild.required<TemplateRef<{ $implicit: SurgicalCase }>>('roomCell');
  private readonly windowCell = viewChild.required<TemplateRef<{ $implicit: SurgicalCase }>>('windowCell');
  private readonly teamCell = viewChild.required<TemplateRef<{ $implicit: SurgicalCase }>>('teamCell');

  protected readonly agenda = signal<ViewState<readonly SurgicalCase[]>>(loading());

  /** El caso cuyo equipo está abierto, o `null`. */
  protected readonly casoAbierto = signal<SurgicalCase | null>(null);

  /** Las salas de la sede, para el filtro. Vacío = sin filtro que ofrecer. */
  private readonly rooms = signal<readonly OperatingRoomSummary[]>([]);
  protected readonly roomFilter = signal<string>(ALL_ROOMS);

  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly roomOptions = computed<readonly SelectOption<string>[]>(() => [
    { value: ALL_ROOMS, label: 'Todos los quirófanos' },
    ...this.rooms().map((r) => ({ value: r.careSpace.id, label: `${r.careSpace.code} · ${r.careSpace.name}` })),
  ]);

  protected readonly columnas = computed<readonly ColumnDef<SurgicalCase>[]>(() => [
    { key: 'caseNumber', header: 'Intervención', priority: 1, cell: this.celdaCaso() },
    { key: 'statusConceptId', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'scheduledStartAt', header: 'Programada', priority: 2, cell: this.celdaCuando() },
    { key: 'operatingRoom', header: 'Quirófano', priority: 1, cell: this.roomCell() },
    { key: 'reservedStartAt', header: 'Ventana reservada', priority: 3, cell: this.windowCell() },
    { key: 'id', header: 'Equipo', priority: 2, cell: this.teamCell(), align: 'end' },
  ]);

  protected readonly porCaso = (fila: SurgicalCase): string => fila.id;
  /** Nombre de la fila para el lector de pantalla (`rowLabel` de la tabla). */
  protected readonly nombreDeCaso = (fila: SurgicalCase): string => `el caso ${fila.caseNumber}`;

  constructor() {
    this.siteContext.ensure();
    effect(() => {
      untracked(() => this.cargar());
    });
    // Las salas salen de la primera sede de la organización activa.
    effect(() => {
      const context = dataOf(this.siteContext.state());
      const site = context?.sites[0];
      if (site === undefined) return;
      untracked(() =>
        this.operatingRooms.listOperatingRooms(site.id).subscribe({
          next: (rooms) => this.rooms.set(rooms),
          // Sin filtro no se pierde la agenda: se muestra entera.
          error: () => this.rooms.set([]),
        }),
      );
    });
  }

  /** La etiqueta de un concepto, o el guion si el catálogo no la tiene. */
  protected etiquetaDe(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }

  protected hasRoomFilter(): boolean {
    return this.rooms().length > 0;
  }

  protected chooseRoom(value: string | null): void {
    this.roomFilter.set(value ?? ALL_ROOMS);
    this.cargar();
  }

  protected recargar(): void {
    this.cargar();
  }

  protected abrir(caso: SurgicalCase): void {
    this.casoAbierto.set(caso);
  }

  protected cerrar(): void {
    this.casoAbierto.set(null);
  }

  private cargar(): void {
    this.agenda.set(loading());
    const room = this.roomFilter();

    this.procedures
      .listAgenda({ limit: TOPE, ...(room === ALL_ROOMS ? {} : { operatingRoomId: room }) })
      .pipe(
        switchMap((pagina) =>
          forkJoin({
            pagina: of(pagina),
            etiquetas: this.terminology
              .readConceptLabels(pagina.items.map((caso) => caso.statusConceptId))
              .pipe(catchError(() => of(new Map() as ConceptLabels))),
          }),
        ),
      )
      .subscribe({
        next: ({ pagina, etiquetas }) => {
          this.etiquetas.update((previas) => new Map([...previas, ...etiquetas]));

          if (pagina.items.length === 0) {
            // Con permiso de programar, la salida es programar; si no, la
            // ficha de la persona que se va a operar.
            this.agenda.set(
              empty(
                this.canSchedule()
                  ? { label: 'Programar una intervención', route: SCHEDULE_CASE_ROUTE }
                  : { label: 'Ir al archivo clínico', route: CLINICAL_RECORD_ROUTE },
                room === ALL_ROOMS
                  ? 'No hay intervenciones programadas en la organización.'
                  : 'No hay intervenciones en este quirófano.',
              ),
            );
            return;
          }

          this.agenda.set(ready(pagina.items));
        },
        error: (error: unknown) =>
          this.agenda.set(errorToViewState<readonly SurgicalCase[]>(error)),
      });
  }
}
