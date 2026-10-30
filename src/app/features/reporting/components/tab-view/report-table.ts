import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { formatearValor, NO_DATA } from '@core/data-access/reporting/reporting-format';
import type { TablaReporte } from '@core/data-access/reporting/reporting.types';
import { nextControlId } from '@shared/forms/form-control.context';
import { AppButton } from '@shared/components/atoms/button/button';
import { NavIcon } from '@shared/components/atoms/nav-icon/nav-icon';
import { CalcInfo } from '../calc-info/calc-info';

const NUMBER_FORMAT = new Intl.NumberFormat('es-BO', { maximumFractionDigits: 2 });

type CellValue = string | number | null | undefined;
type Column = TablaReporte['columnas'][number];
type SortDirection = 'asc' | 'desc';

const isMissingValue = (value: CellValue): value is null | undefined =>
  value === null || value === undefined || (typeof value === 'number' && Number.isNaN(value));

const COLLATOR = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });

const MAX_CARD_ROWS = 12;
const MAX_CARD_CELLS = 60;
const WIDE_COLUMNS = 8;

/**
 * Tabla de detalle de una pestaña (ranking, envejecimiento…). Hereda el rigor
 * del resto del portal: `null` se escribe «Sin dato» (nunca un 0 ni un guion),
 * los números van a la derecha con cifras tabulares, la cabecera se queda
 * fija al desplazar y «Cómo se calcula» abre la ficha de la tabla.
 *
 * Cada columna se puede ordenar con su cabecera. Los números se ordenan como
 * números (no como texto: «9» antes que «10») y lo que no tiene dato va
 * siempre al final, suba o baje el orden — un «Sin dato» arriba de un ranking
 * leería como el mejor. Un texto ya formateado («Bs 1.200,50») se muestra tal
 * cual; un número con `unidad` se formatea con ella.
 */
@Component({
  selector: 'app-report-table',
  imports: [AppButton, NavIcon, CalcInfo],
  templateUrl: './report-table.html',
  styleUrl: './report-table.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportTable {
  protected readonly WIDE_COLUMNS = WIDE_COLUMNS;
  readonly table = input.required<TablaReporte>();

  protected readonly ids = nextControlId('rt');
  protected readonly infoOpen = signal(false);
  /** En un teléfono cada fila pasa a una tarjeta, pero solo si el resultado no es una columna interminable (filas × columnas). */
  protected readonly asCards = computed(() => {
    const { filas, columnas } = this.table();
    return filas.length <= MAX_CARD_ROWS && filas.length * columnas.length <= MAX_CARD_CELLS;
  });

  /** Pocas columnas de texto largo: se parten en varias líneas. Con muchas columnas partirlas empuja las cifras fuera de la pantalla. */
  protected readonly isProse = computed(() => this.table().columnas.length < WIDE_COLUMNS);
  protected readonly sort = signal<{ readonly key: string; readonly direction: SortDirection } | null>(null);

  /** Una columna es numérica si lo declara o si todo lo que trae son números (o ausencias). */
  protected readonly numericColumns = computed(() => {
    const { columnas, filas } = this.table();
    return new Set(
      columnas
        .filter((column) => {
          if (column.alinear === 'der' || column.unidad !== undefined) {
            return true;
          }
          const values = filas.map((row) => row[column.clave]).filter((v) => v !== null && v !== undefined);
          return values.length > 0 && values.every((v) => typeof v === 'number');
        })
        .map((column) => column.clave),
    );
  });

  protected readonly rows = computed(() => {
    const { filas } = this.table();
    const sort = this.sort();
    if (sort === null) {
      return filas;
    }
    const factor = sort.direction === 'asc' ? 1 : -1;
    return [...filas].sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      // Sin dato siempre al final, en cualquiera de los dos sentidos.
      if (isMissingValue(left) || isMissingValue(right)) {
        return Number(isMissingValue(left)) - Number(isMissingValue(right));
      }
      if (typeof left === 'number' && typeof right === 'number') {
        return (left - right) * factor;
      }
      return COLLATOR.compare(String(left), String(right)) * factor;
    });
  });

  protected display(value: CellValue, column: Column): string {
    if (isMissingValue(value)) {
      return NO_DATA;
    }
    if (typeof value === 'number') {
      return column.unidad === undefined ? NUMBER_FORMAT.format(value) : formatearValor(value, column.unidad);
    }
    return value;
  }

  protected isMissing(value: CellValue): boolean {
    return isMissingValue(value);
  }

  protected ariaSort(key: string): 'ascending' | 'descending' | 'none' {
    const sort = this.sort();
    return sort?.key !== key ? 'none' : sort.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected arrow(key: string): string {
    const sort = this.sort();
    return sort?.key !== key ? '' : sort.direction === 'asc' ? '▲' : '▼';
  }

  /** Sin orden → ascendente → descendente → sin orden. */
  protected toggleSort(key: string): void {
    this.sort.update((current) => {
      if (current?.key !== key) {
        return { key, direction: 'asc' };
      }
      return current.direction === 'asc' ? { key, direction: 'desc' } : null;
    });
  }
}
