import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { OperacionDetalle } from '../../../../core/data-access/admin-portal/portal.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { accionSobreTabla, confianza, operacionSobreTabla } from '../portal-labels';
import { groupTables, type AffectedTable } from './operation-tables';

interface TableSection {
  readonly key: string;
  readonly heading: string;
  readonly tables: readonly AffectedTable[];
  /** Qué decir cuando el grupo está vacío; `null` = no se muestra el grupo vacío. */
  readonly emptyText: string | null;
}

/**
 * Qué datos toca una operación: un resumen de tablas afectadas, las que
 * escribe y las que lee (cada una con la cadena de llamadas, la confianza con
 * que el generador la determinó y el `archivo:línea` del acceso), los eventos
 * que emite, los trabajos que encola y lo que no pudo resolver. Presentacional.
 */
@Component({
  selector: 'app-portal-operation-data',
  imports: [RouterLink, Badge, Link],
  templateUrl: './operation-data.html',
  styleUrl: './operation-data.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationData {
  readonly operation = input.required<OperacionDetalle>();
  /** Cómo se llega a la ficha de una tabla; lo decide quien conoce las rutas. */
  readonly tableUrl = input.required<(schema: string, table: string) => string>();

  protected readonly groups = computed(() => groupTables(this.operation().datos));
  protected readonly sections = computed<readonly TableSection[]>(() => {
    const g = this.groups();
    return [
      { key: 'write', heading: 'Tablas que escribe', tables: g.escribe, emptyText: 'No escribe en ninguna tabla: sólo consulta.' },
      { key: 'read', heading: 'Tablas que lee', tables: g.lee, emptyText: 'No lee ninguna tabla.' },
      { key: 'other', heading: 'Otros accesos', tables: g.otros, emptyText: null },
    ];
  });

  protected readonly effect = operacionSobreTabla;
  protected readonly action = accionSobreTabla;
  protected readonly confidence = confianza;
}
