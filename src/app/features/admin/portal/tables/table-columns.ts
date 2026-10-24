import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  viewChild,
  type TemplateRef,
} from '@angular/core';

import type { ColumnaDeTabla } from '../../../../core/data-access/admin-portal/portal.types';
import { ready } from '../../../../core/view-state/view-state';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { columnOrmState } from '../portal-labels';

/** Una columna con el texto ya armado: la tabla sólo lo pinta. */
export interface ColumnRow {
  readonly name: string;
  readonly type: string;
  readonly nullable: string;
  readonly keys: readonly string[];
  readonly references: string | null;
  readonly description: string;
  readonly orm: string;
}

/** `[{ hacia: { schema, tabla, columna } }]` → `iam.users.id`; lo que no tenga esa forma, nada. */
function referenceOf(fk: readonly unknown[]): string | null {
  const first = fk[0] as { hacia?: { schema?: unknown; tabla?: unknown; columna?: unknown } } | undefined;
  const to = first?.hacia;
  return to && typeof to.schema === 'string' && typeof to.tabla === 'string'
    ? `${to.schema}.${to.tabla}${typeof to.columna === 'string' ? `.${to.columna}` : ''}`
    : null;
}

export function toColumnRow(c: ColumnaDeTabla): ColumnRow {
  return {
    name: c.nombre,
    type: c.tipo,
    nullable: c.nulable ? 'Admite vacío' : 'Obligatoria',
    keys: [c.pk ? 'PK' : null, c.fk.length > 0 ? 'FK' : null, c.uk.length > 0 ? 'Única' : null].filter(
      (k): k is string => k !== null,
    ),
    references: referenceOf(c.fk),
    description: c.descripcion?.texto ?? 'Sin descripción',
    orm: c.orm.estado,
  };
}

/** Las columnas de una tabla. Presentacional. */
@Component({
  selector: 'app-portal-table-columns',
  imports: [Badge, DataTable],
  template: `
    <section class="columns" aria-label="Columnas de la tabla">
      <app-data-table
        data-testid="portal-table-columns"
        caption="Columnas de la tabla"
        [state]="rows()"
        [columns]="tableColumns()"
        [trackBy]="byName"
        stackedOnMobile
      />
    </section>

    <ng-template #nameCell let-row>
      <code class="columns__name">{{ row.name }}</code>
      @for (key of row.keys; track key) {
        <app-badge size="sm" variant="info">{{ key }}</app-badge>
      }
      @if (row.references) {
        <span class="columns__muted">→ {{ row.references }}</span>
      }
    </ng-template>

    <ng-template #ormCell let-row>
      <app-badge size="sm" [variant]="ormLabel(row.orm).tone">{{ ormLabel(row.orm).label }}</app-badge>
    </ng-template>
  `,
  styles: `
    .columns { padding-block: var(--sp-4); }
    .columns__name { font-family: var(--font-mono); font-size: var(--fs-data); margin-inline-end: var(--sp-1); }
    .columns__muted { display: block; font-size: var(--fs-caption); color: var(--text-secondary); overflow-wrap: anywhere; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableColumns {
  readonly columns = input.required<readonly ColumnaDeTabla[]>();

  protected readonly ormLabel = columnOrmState;
  protected readonly rows = computed(() => ready(this.columns().map(toColumnRow)));
  protected readonly byName = (row: ColumnRow): string => row.name;

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: ColumnRow }>>('nameCell');
  private readonly ormCell = viewChild.required<TemplateRef<{ $implicit: ColumnRow }>>('ormCell');
  protected readonly tableColumns = computed<readonly ColumnDef<ColumnRow>[]>(() => [
    { key: 'name', header: 'Columna', priority: 1, cell: this.nameCell() },
    { key: 'type', header: 'Tipo', priority: 1 },
    { key: 'nullable', header: 'Vacío', priority: 2 },
    { key: 'description', header: 'Descripción', priority: 3 },
    { key: 'orm', header: 'ORM', priority: 2, cell: this.ormCell() },
  ]);
}
