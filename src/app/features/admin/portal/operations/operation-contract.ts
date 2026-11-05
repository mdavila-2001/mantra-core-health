import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type {
  Campo,
  OperacionDetalle,
  Parametro,
} from '../../../../core/data-access/admin-portal/portal.types';
import { ready } from '../../../../core/view-state/view-state';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';

/** Una fila de campo o parámetro con el texto ya armado: la tabla sólo lo pinta. */
interface FieldRow {
  readonly key: string;
  readonly name: string;
  readonly type: string;
  readonly required: string;
  readonly notes: string;
}

const FIELD_COLUMNS: readonly ColumnDef<FieldRow>[] = [
  { key: 'name', header: 'Campo', priority: 1 },
  { key: 'type', header: 'Tipo', priority: 1 },
  { key: 'required', header: 'Obligatorio', priority: 2 },
  { key: 'notes', header: 'Notas', priority: 3 },
];

function fromField(f: Campo, i: number): FieldRow {
  return {
    key: `${i}-${f.campo}`,
    name: f.campo,
    type: f.tipo,
    required: f.obligatorio ? 'Sí' : 'No',
    notes: [f.descripcion, ...f.restricciones].filter(Boolean).join(' · ') || '—',
  };
}

function fromParameter(p: Parametro, i: number): FieldRow {
  return {
    key: `${i}-${p.nombre}`,
    name: `${p.nombre} (${p.en})`,
    type: p.tipo,
    required: p.obligatorio ? 'Sí' : 'No',
    notes: p.descripcion ?? '—',
  };
}

/**
 * El contrato de una operación: parámetros, cuerpo y la forma de la respuesta.
 * Las respuestas posibles (estado, código, causas) viven en la pestaña
 * «Respuestas». Presentacional: recibe la ficha y no pide nada.
 */
@Component({
  selector: 'app-portal-operation-contract',
  imports: [DataTable],
  templateUrl: './operation-contract.html',
  styleUrl: './operation-contract.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationContract {
  readonly operation = input.required<OperacionDetalle>();

  protected readonly fieldColumns = FIELD_COLUMNS;
  protected readonly byField = (row: FieldRow): string => row.key;

  protected readonly parameters = computed(() =>
    ready(this.operation().parametros.map(fromParameter)),
  );
  protected readonly bodyFields = computed(() =>
    ready((this.operation().cuerpo?.campos ?? []).map(fromField)),
  );
  protected readonly responseFields = computed(() =>
    ready(this.operation().respuesta.campos.map(fromField)),
  );
}
