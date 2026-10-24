import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type {
  IndiceDeTabla,
  RelacionDeTabla,
} from '../../../../core/data-access/admin-portal/portal.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { relationResolution } from '../portal-labels';

/**
 * Las relaciones de una tabla —a qué apunta y quién la apunta— y sus índices
 * con el para qué que el inventario les encontró. Presentacional.
 */
@Component({
  selector: 'app-portal-table-relations',
  imports: [RouterLink, Badge, Link],
  templateUrl: './table-relations.html',
  styleUrl: './table-relations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableRelations {
  readonly outgoing = input.required<readonly RelacionDeTabla[]>();
  readonly incoming = input.required<readonly RelacionDeTabla[]>();
  readonly indexes = input.required<readonly IndiceDeTabla[]>();
  readonly tableUrl = input.required<(schema: string, table: string) => string>();

  protected readonly resolution = relationResolution;
  protected readonly columnName = (c: { readonly columna: string }): string => c.columna;
}
