import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { forkJoin, of } from 'rxjs';
import { catchError, filter, map, startWith, switchMap } from 'rxjs/operators';

import { OperatingRoomsClient } from '../../core/data-access/operating-rooms/operating-rooms.client';
import type { OperatingRoomSummary } from '../../core/data-access/operating-rooms/operating-rooms.types';
import { SiteContextStore } from '../../core/data-access/operating-rooms/site-context.store';
import { ProceduresClient } from '../../core/data-access/procedures/procedures.client';
import type { SurgicalCase } from '../../core/data-access/procedures/procedures.types';
import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../core/view-state/view-state';
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
import { CaseTeam } from './case-team/case-team';
import { timeOf } from './interventions.presentation';
import { SiteSwitch } from './site-switch/site-switch';
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
  imports: [Alert, AppButton, AppButtonLink, Badge, Card, CaseTeam, DataTable, DatePipe, PageHeader, RouterLink, Select, SiteSwitch, Tooltip],
  templateUrl: './interventions.html',
  styleUrl: './interventions.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Interventions {
  private readonly procedures = inject(ProceduresClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly siteContext = inject(SiteContextStore);
  private readonly operatingRooms = inject(OperatingRoomsClient);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly caseRoute = caseRoute;
  protected readonly timeOf = timeOf;
  protected readonly scheduleRoute = SCHEDULE_CASE_ROUTE;
  protected readonly roomsRoute = OPERATING_ROOMS_ROUTE;
  protected readonly blocksRoute = OR_BLOCKS_ROUTE;
  protected readonly utilizationRoute = OR_UTILIZATION_ROUTE;

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
  private readonly reloads = signal(0);

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
    // Las salas de la sede elegida: alimentan el filtro y el nombre de la sala
    // de cada caso (la API manda `operatingRoomId`, no la sala resuelta).
    toObservable(this.siteContext.siteId)
      .pipe(
        filter((id): id is string => id !== null),
        // Sin salas no se pierde la agenda: se muestra entera, sin filtro.
        switchMap((siteId) => this.operatingRooms.listOperatingRooms(siteId).pipe(catchError(() => of([] as readonly OperatingRoomSummary[])))),
        takeUntilDestroyed(),
      )
      .subscribe((rooms) => this.rooms.set(rooms));
    // La agenda por clave (filtro, reintento): `switchMap` cancela la lectura
    // anterior, así el filtro viejo nunca pisa al elegido.
    toObservable(computed(() => ({ room: this.roomFilter(), n: this.reloads() })))
      .pipe(
        switchMap(({ room }) => this.read(room).pipe(startWith(loading() as ViewState<readonly SurgicalCase[]>))),
        takeUntilDestroyed(),
      )
      .subscribe((s) => this.agenda.set(s));
  }

  /** La sala del caso: la que manda la API o, si no, la de la sede por su id. */
  protected roomOf(caso: SurgicalCase): { code: string; name: string; path?: string } | null {
    if (caso.operatingRoom) return caso.operatingRoom;
    const r = this.rooms().find((x) => x.careSpace.id === caso.operatingRoomId);
    return r === undefined ? null : { code: r.careSpace.code, name: r.careSpace.name, path: '' };
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
  }

  protected recargar(): void {
    this.reloads.update((n) => n + 1);
  }

  protected abrir(caso: SurgicalCase): void {
    this.casoAbierto.set(caso);
  }

  protected cerrar(): void {
    this.casoAbierto.set(null);
  }

  private read(room: string) {
    return this.procedures.listAgenda({ limit: TOPE, ...(room === ALL_ROOMS ? {} : { operatingRoomId: room }) }).pipe(
      switchMap((pagina) =>
        forkJoin({
          pagina: of(pagina),
          etiquetas: this.terminology
            .readConceptLabels(pagina.items.map((caso) => caso.statusConceptId))
            .pipe(catchError(() => of(new Map() as ConceptLabels))),
        }),
      ),
      map(({ pagina, etiquetas }): ViewState<readonly SurgicalCase[]> => {
        this.etiquetas.update((previas) => new Map([...previas, ...etiquetas]));
        if (pagina.items.length > 0) return ready(pagina.items);
        // La salida es programar: si el rol no alcanza, la API lo dice ahí (S5).
        return empty(
          { label: 'Programar una intervención', route: SCHEDULE_CASE_ROUTE },
          room === ALL_ROOMS ? 'No hay intervenciones programadas en la organización.' : 'No hay intervenciones en este quirófano.',
        );
      }),
      catchError((error: unknown) => of(errorToViewState<readonly SurgicalCase[]>(error))),
    );
  }
}
