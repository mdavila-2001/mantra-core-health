import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { DataCatalogClient } from '../../../core/data-access/admin-portal/data-catalog.client';
import type {
  CatalogObjectSummary,
  Coverage,
  MissingFilter,
  ReviewStatus,
  Scan,
  SchemaSummary,
} from '../../../core/data-access/admin-portal/data-catalog.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { NavigationService } from '../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef, CursorState } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import {
  claveIdempotente,
  entero,
  errorDeApi,
  porcentaje,
  reviewStatus,
  scanStatus,
  observationStatus,
} from '../platform/platform-labels';

const PAGE_SIZE = 25;
const VOLVER = '__volver__';

interface ObjectRow extends CatalogObjectSummary {
  readonly qualifiedName: string;
  readonly fichaLabel: string;
  readonly fichaTone: ReturnType<typeof reviewStatus>['tone'];
  readonly owner: string;
  readonly rows: string;
}

/** Las cinco dimensiones que el servidor mide por separado; nunca se promedian. */
const DIMENSIONES = [
  { key: 'technical', label: 'Técnica', help: 'Estructura leída del motor' },
  { key: 'semantic', label: 'Justificación', help: 'Propósito, razón de existir y grano de fila' },
  { key: 'ownership', label: 'Responsable', help: 'Dueño de negocio o steward declarado' },
  { key: 'sensitivity', label: 'Sensibilidad', help: 'PII/PHI determinada, no supuesta' },
  { key: 'review', label: 'Aprobada', help: 'Ficha vigente aprobada por otra persona' },
] as const;

/**
 * Catálogo de datos: qué tablas y vistas existen, cuáles tienen su ficha de
 * justificación y cuál es la cobertura explicada. Todo lo calcula el servidor.
 */
@Component({
  selector: 'app-data-catalog',
  imports: [
    DatePipe,
    RouterLink,
    AppButton,
    Badge,
    Select,
    Alert,
    Card,
    SearchField,
    Tabs,
    Tab,
    DataTable,
    PageHeader,
    ViewStateHost,
  ],
  templateUrl: './data-catalog.html',
  styleUrl: './data-catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataCatalog {
  private readonly catalog = inject(DataCatalogClient);
  private readonly router = inject(Router);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly pestana = signal(0);
  protected readonly dimensiones = DIMENSIONES;
  protected readonly porcentaje = porcentaje;
  protected readonly scanStatus = scanStatus;

  // ------------------------------------------------------------ cobertura
  protected readonly cobertura = signal<ViewState<Coverage>>(loading());

  // ------------------------------------------------------------ filtros
  protected readonly busqueda = signal('');
  protected readonly schema = signal<string | null>(null);
  protected readonly revision = signal<ReviewStatus | 'NONE' | null>(null);
  protected readonly faltante = signal<MissingFilter | null>(null);
  protected readonly schemas = signal<readonly SchemaSummary[]>([]);
  protected readonly opcionesSchema = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'Todos los schemas' },
    ...this.schemas().map((s) => ({ value: s.schemaName, label: `${s.schemaName} (${s.objects})` })),
  ]);
  protected readonly opcionesRevision: readonly SelectOption<ReviewStatus | 'NONE' | null>[] = [
    { value: null, label: 'Cualquier estado de ficha' },
    { value: 'NONE', label: 'Sin ficha' },
    { value: 'DRAFT', label: 'Borrador' },
    { value: 'NEEDS_REVIEW', label: 'En revisión' },
    { value: 'APPROVED', label: 'Aprobada' },
    { value: 'REJECTED', label: 'Rechazada' },
  ];
  protected readonly opcionesFaltante: readonly SelectOption<MissingFilter | null>[] = [
    { value: null, label: 'Sin filtrar por faltantes' },
    { value: 'existenceRationale', label: 'Sin razón de existir' },
    { value: 'purpose', label: 'Sin propósito' },
    { value: 'rowGrain', label: 'Sin grano de fila' },
    { value: 'businessOwner', label: 'Sin responsable' },
  ];

  // ------------------------------------------------------------ inventario
  private readonly objetos = signal<ViewState<readonly CatalogObjectSummary[]>>(loading());
  private readonly historia = signal<readonly (string | undefined)[]>([undefined]);
  private readonly cursorSiguiente = signal<string | null>(null);
  protected readonly cursor = computed<CursorState>(() => ({
    prevCursor: this.historia().length > 1 ? VOLVER : null,
    nextCursor: this.cursorSiguiente(),
  }));
  private readonly celdaNombre = viewChild<TemplateRef<{ $implicit: ObjectRow }>>('nombreCell');
  private readonly celdaFicha = viewChild<TemplateRef<{ $implicit: ObjectRow }>>('fichaCell');

  protected readonly filas = computed<ViewState<readonly ObjectRow[]>>(() => {
    const estado = this.objetos();
    if (estado.status !== 'ready') return estado as ViewState<readonly ObjectRow[]>;
    return ready(
      estado.data.map((o) => {
        const ficha = o.annotation ? reviewStatus(o.annotation.reviewStatus) : { label: 'Sin ficha', tone: 'secondary' as const };
        return {
          ...o,
          qualifiedName: `${o.schemaName}.${o.objectName}`,
          fichaLabel: o.observationStatus === 'OBSERVED' ? ficha.label : observationStatus(o.observationStatus).label,
          fichaTone: o.observationStatus === 'OBSERVED' ? ficha.tone : 'warning',
          owner: o.annotation?.owner ?? '—',
          rows: entero(o.statistics.estimatedRows),
        };
      }),
    );
  });

  protected readonly columnas = computed<readonly ColumnDef<ObjectRow>[]>(() => [
    { key: 'qualifiedName', header: 'Objeto', priority: 1, cell: this.celdaNombre() },
    { key: 'fichaLabel', header: 'Ficha', priority: 1, cell: this.celdaFicha() },
    { key: 'objectKind', header: 'Tipo', priority: 3 },
    { key: 'owner', header: 'Responsable', priority: 2 },
    { key: 'rows', header: 'Filas (estimadas)', priority: 3, align: 'end' },
  ]);
  protected readonly byId = (row: ObjectRow) => row.id;

  // ------------------------------------------------------------ escaneos
  protected readonly escaneos = signal<ViewState<readonly Scan[]>>(loading());
  protected readonly pidiendoEscaneo = signal(false);
  protected readonly avisoEscaneo = signal<string | null>(null);
  protected readonly errorEscaneo = signal<string | null>(null);
  private claveEscaneo = claveIdempotente('scan');

  constructor() {
    this.catalog.listSchemas().subscribe({ next: (s) => this.schemas.set(s), error: () => this.schemas.set([]) });
    this.cargarCobertura();
    this.cargar();
    this.cargarEscaneos();
  }

  protected cargarCobertura(): void {
    this.cobertura.set(loading());
    this.catalog.coverage(this.schema() ?? undefined).subscribe({
      next: (c) => this.cobertura.set(ready(c)),
      error: (e: unknown) => this.cobertura.set(errorToViewState<Coverage>(e)),
    });
  }

  protected cargar(): void {
    this.objetos.set(loading());
    const cursor = this.historia().at(-1);
    this.catalog
      .listObjects({
        ...(this.busqueda() ? { q: this.busqueda() } : {}),
        ...(this.schema() ? { schema: this.schema()! } : {}),
        ...(this.revision() ? { reviewStatus: this.revision()! } : {}),
        ...(this.faltante() ? { missing: this.faltante()! } : {}),
        ...(cursor ? { cursor } : {}),
        limit: PAGE_SIZE,
      })
      .subscribe({
        next: (page) => {
          this.cursorSiguiente.set(page.nextCursor);
          this.objetos.set(
            page.items.length === 0
              ? empty(
                  this.hayFiltros()
                    ? { label: 'Quitá o cambiá los filtros de arriba.' }
                    : { label: 'Usá «Solicitar escaneo» arriba a la derecha.' },
                  this.hayFiltros()
                    ? 'Ningún objeto coincide con los filtros elegidos.'
                    : 'Todavía no hay objetos catalogados: el catálogo se llena con un escaneo técnico.',
                )
              : ready(page.items),
          );
        },
        error: (e: unknown) => this.objetos.set(errorToViewState<readonly CatalogObjectSummary[]>(e)),
      });
  }

  protected hayFiltros(): boolean {
    return Boolean(this.busqueda() || this.schema() || this.revision() || this.faltante());
  }

  protected filtrar(): void {
    this.historia.set([undefined]);
    this.cargar();
  }

  protected cambiarSchema(valor: string | null): void {
    this.schema.set(valor);
    this.filtrar();
    this.cargarCobertura();
  }

  protected limpiarFiltros(): void {
    this.busqueda.set('');
    this.schema.set(null);
    this.revision.set(null);
    this.faltante.set(null);
    this.filtrar();
    this.cargarCobertura();
  }

  protected mover(cursor: string): void {
    if (cursor === VOLVER) this.historia.update((h) => h.slice(0, -1));
    else this.historia.update((h) => [...h, cursor]);
    this.cargar();
  }

  protected abrir(row: ObjectRow): void {
    void this.router.navigate(['/administration/data-catalog', row.id]);
  }

  protected cargarEscaneos(): void {
    this.catalog.listScans().subscribe({
      next: (lista) =>
        this.escaneos.set(
          lista.length === 0
            ? empty({ label: 'Usá «Solicitar escaneo» arriba a la derecha.' }, 'Nunca se escaneó la base.')
            : ready(lista),
        ),
      error: (e: unknown) => this.escaneos.set(errorToViewState<readonly Scan[]>(e)),
    });
  }

  /** 202 tras aceptación durable; el worker lo ejecuta. La misma clave cubre el doble clic. */
  protected solicitarEscaneo(): void {
    this.pidiendoEscaneo.set(true);
    this.errorEscaneo.set(null);
    this.catalog.requestScan(this.claveEscaneo).subscribe({
      next: (aceptado) => {
        this.pidiendoEscaneo.set(false);
        this.claveEscaneo = claveIdempotente('scan');
        this.avisoEscaneo.set(
          aceptado.created
            ? 'Escaneo aceptado. El worker lo ejecuta en segundo plano; el estado se actualiza en «Escaneos».'
            : 'Ese escaneo ya estaba aceptado.',
        );
        this.pestana.set(1);
        this.cargarEscaneos();
      },
      error: (e: unknown) => {
        this.pidiendoEscaneo.set(false);
        this.errorEscaneo.set(
          errorDeApi(e).status === 409 ? 'Ya hay un escaneo en curso. Esperá a que termine.' : 'No se pudo solicitar el escaneo.',
        );
      },
    });
  }

  protected contadores(scan: Scan): string {
    const c = scan.counters;
    if (!c) return '—';
    return `${c['objectsObserved'] ?? 0} objetos · +${c['objectsAdded'] ?? 0} altas · ${c['objectsChanged'] ?? 0} cambios · ${c['objectsNotObserved'] ?? 0} no observados`;
  }
}
