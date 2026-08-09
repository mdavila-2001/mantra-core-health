import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import { NgTemplateOutlet } from '@angular/common';

import { AppButton } from '../../atoms/button/button';
import { Checkbox } from '../../atoms/checkbox/checkbox';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { ViewStateHost } from '../view-state-host/view-state-host';
import {
  MOBILE_DETAIL_PRIORITY,
  type ColumnDef,
  type CursorState,
  type SortDirection,
  type SortState,
} from './data-table.types';

/**
 * Tabla de un listado de dominio.
 *
 * ```html
 * <app-data-table
 *   [state]="pacientes()" [columns]="columnas" [trackBy]="porId"
 *   [cursor]="{ nextCursor: cursorSiguiente() }"
 *   caption="Pacientes del servicio"
 *   (cursorChanged)="cargar($event)" (sortChanged)="ordenar($event)" />
 * ```
 *
 * Decisiones que no son de estilo:
 *
 * - **`<table>` semántica** con `<caption>`, `<thead>` y `scope="col"`. Un
 *   `div role="table"` obliga a reimplementar la navegación de tabla que el
 *   lector de pantalla ya sabe hacer.
 * - **Los estados los delega** en `app-view-state-host`: los 9 estados del
 *   M34 se dibujan en un solo lugar de todo el proyecto.
 * - **Cursor, no páginas** (§0.6): `Anterior`/`Siguiente` y nada más. Un
 *   cursor no conoce el total, así que no hay «página 7 de 42».
 * - **Se ordena por código**, nunca por etiqueta: la etiqueta es presentación
 *   y cambia con el idioma o con el value set.
 * - En móvil, las columnas de menor prioridad **se pliegan a una fila de
 *   detalle**; no se ocultan. El M34 prohíbe esconder información clínica.
 *
 * > `available_actions_json` puede decidir **qué acciones se muestran**, pero
 * > eso es presentación: el backend revalida cada operación. Nunca derives un
 * > permiso de lo que llegue en esa lista.
 */
@Component({
  selector: 'app-data-table',
  imports: [AppButton, Checkbox, NgTemplateOutlet, ViewStateHost],
  templateUrl: './data-table.html',
  styleUrl: './data-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'data-table',
  },
})
export class DataTable<Row> {
  readonly state = input.required<ViewState<readonly Row[]>>();
  readonly columns = input.required<readonly ColumnDef<Row>[]>();

  /** Identidad estable de cada fila. Requerido: sin esto `@for` no puede rastrear. */
  readonly trackBy = input.required<(row: Row) => string>();

  /** Rótulo de la tabla. Va en `<caption>`, aunque sea solo para lectores. */
  readonly caption = input<string>('');

  readonly selectable = input(false, { transform: booleanAttribute });
  readonly sort = input<SortState | null>(null);
  readonly cursor = input<CursorState>({});

  readonly sortChanged = output<SortState>();
  readonly cursorChanged = output<string>();
  readonly selectionChanged = output<readonly Row[]>();

  /**
   * S8 y S9: la persona pide reintentar. **Se reemiten desde el host de
   * estados**, que es quien dibuja el botón.
   *
   * Sin esto el botón «Reintentar» de una tabla no hacía nada: el host emitía
   * el evento, la tabla no lo escuchaba y ahí moría. Un control visible que no
   * responde es peor que no ofrecerlo — la persona concluye que la aplicación
   * está rota, y tiene razón.
   */
  readonly retry = output<void>();

  /** S7: la persona pide datos frescos. Misma razón que {@link retry}. */
  readonly refresh = output<void>();

  /** Filas seleccionadas de **la página visible**. Con cursor no hay «todas». */
  private readonly selectedRows = signal<readonly Row[]>([]);

  /** Filas con el detalle desplegado en móvil. */
  private readonly expandedRows = signal<ReadonlySet<string>>(new Set());

  /** Las que se ven siempre, en cualquier ancho. */
  protected readonly primaryColumns = computed(() =>
    this.columns().filter((column) => column.priority < MOBILE_DETAIL_PRIORITY),
  );

  /** Las que en móvil se pliegan a la fila de detalle — nunca se ocultan. */
  protected readonly secondaryColumns = computed(() =>
    this.columns().filter((column) => column.priority >= MOBILE_DETAIL_PRIORITY),
  );

  protected readonly rows = computed<readonly Row[]>(() => {
    const state = this.state();
    if (state.status === 'ready' || state.status === 'stale') {
      return state.data;
    }
    return [];
  });

  protected readonly hasPrevious = computed(() => Boolean(this.cursor().prevCursor));
  protected readonly hasNext = computed(() => Boolean(this.cursor().nextCursor));

  protected readonly allVisibleSelected = computed(
    () => this.rows().length > 0 && this.selectedRows().length === this.rows().length,
  );

  protected readonly someVisibleSelected = computed(
    () => this.selectedRows().length > 0 && !this.allVisibleSelected(),
  );

  protected rowKey(row: Row): string {
    return this.trackBy()(row);
  }

  protected isSelected(row: Row): boolean {
    return this.selectedRows().includes(row);
  }

  protected isExpanded(row: Row): boolean {
    return this.expandedRows().has(this.rowKey(row));
  }

  protected toggleDetail(row: Row): void {
    const key = this.rowKey(row);
    this.expandedRows.update((abiertas) => {
      const siguiente = new Set(abiertas);
      if (!siguiente.delete(key)) {
        siguiente.add(key);
      }
      return siguiente;
    });
  }

  protected toggleRow(row: Row): void {
    this.selectedRows.update((seleccionadas) =>
      seleccionadas.includes(row)
        ? seleccionadas.filter((candidata) => candidata !== row)
        : [...seleccionadas, row],
    );
    this.selectionChanged.emit(this.selectedRows());
  }

  /** Marca o desmarca **la página visible**, que es lo único que se conoce. */
  protected toggleAllVisible(): void {
    this.selectedRows.set(this.allVisibleSelected() ? [] : [...this.rows()]);
    this.selectionChanged.emit(this.selectedRows());
  }

  protected sortDirectionFor(column: ColumnDef<Row>): SortDirection | null {
    const sort = this.sort();
    return sort?.key === column.key ? sort.direction : null;
  }

  /** Valor de `aria-sort` del encabezado. `none` cuando la columna es ordenable. */
  protected ariaSortFor(column: ColumnDef<Row>): string | null {
    if (!column.sortable) {
      return null;
    }
    const direction = this.sortDirectionFor(column);
    if (direction === null) {
      return 'none';
    }
    return direction === 'asc' ? 'ascending' : 'descending';
  }

  protected toggleSort(column: ColumnDef<Row>): void {
    if (!column.sortable) {
      return;
    }
    const actual = this.sortDirectionFor(column);
    // Emite el CÓDIGO de la columna: ordenar por etiqueta rompe al cambiar de
    // idioma o de value set.
    this.sortChanged.emit({
      key: column.key,
      direction: actual === 'asc' ? 'desc' : 'asc',
    });
  }

  protected goPrevious(): void {
    const cursor = this.cursor().prevCursor;
    if (cursor) {
      this.cursorChanged.emit(cursor);
    }
  }

  protected goNext(): void {
    const cursor = this.cursor().nextCursor;
    if (cursor) {
      this.cursorChanged.emit(cursor);
    }
  }

  /** Valor crudo de una celda cuando la columna no trae plantilla. */
  protected cellValue(row: Row, column: ColumnDef<Row>): string {
    const value = (row as Record<string, unknown>)[column.key];
    return value === null || value === undefined ? '' : String(value);
  }
}
