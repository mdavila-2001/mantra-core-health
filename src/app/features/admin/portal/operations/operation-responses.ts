import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type {
  MapaFila,
  OperacionDetalle,
  RespuestaPosible,
} from '../../../../core/data-access/admin-portal/portal.types';
import { ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';

interface ResponseRow {
  readonly key: string;
  readonly status: string;
  readonly code: string;
  readonly causes: string;
}

const RESPONSE_COLUMNS: readonly ColumnDef<ResponseRow>[] = [
  { key: 'status', header: 'Estado', priority: 1 },
  { key: 'code', header: 'Código', priority: 1 },
  { key: 'causes', header: 'Cuándo', priority: 2 },
];

function fromResponse(r: RespuestaPosible, i: number): ResponseRow {
  return {
    key: `${r.estado}-${r.codigo ?? ''}-${i}`,
    status: String(r.estado),
    code: r.codigo ?? '—',
    causes: r.causas.join(' · ') || '—',
  };
}

/**
 * Con qué puede responder una operación (`respuestasPosibles`: estado, código y
 * causas, en el orden en que la API los enumera) y quién la llama desde el
 * front (`llamadaPor`, que vive en el mapa de rutas y no en la ficha). Lo que
 * el mapa no trae se dice «sin dato». Presentacional.
 */
@Component({
  selector: 'app-portal-operation-responses',
  imports: [Badge, DataTable],
  templateUrl: './operation-responses.html',
  styleUrl: './operation-responses.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationResponses {
  readonly operation = input.required<OperacionDetalle>();
  /** La fila de esta operación en el mapa de rutas; `ready(null)` si el mapa no la trae. */
  readonly mapRow = input.required<ViewState<MapaFila | null>>();

  protected readonly columns = RESPONSE_COLUMNS;
  protected readonly byKey = (row: ResponseRow): string => row.key;

  protected readonly responses = computed(() =>
    ready(this.operation().respuestasPosibles.map(fromResponse)),
  );
  protected readonly success = computed(() =>
    this.operation().respuestasPosibles.filter((r) => r.estado < 400).length,
  );
  protected readonly failures = computed(() =>
    this.operation().respuestasPosibles.filter((r) => r.estado >= 400).length,
  );
}
