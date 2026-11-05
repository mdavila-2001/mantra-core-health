import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { OperacionDetalle } from '../../../../core/data-access/admin-portal/portal.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { confianza, operacionSobreTabla } from '../portal-labels';
import { affectedTablesHeadline, summarizeAffectedTables } from './operation-tables.model';

/**
 * Las tablas que afecta una operación, separadas por efecto (lee, escribe,
 * borra) y agrupadas por tabla: cada una con el camino handler → servicio →
 * repositorio (`via`), el `archivo:línea` del acceso (`fuente`) y la confianza
 * con que el generador lo determinó. Debajo, los eventos que emite, los
 * trabajos que encola y lo que no pudo resolver. Presentacional.
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

  protected readonly effect = operacionSobreTabla;
  protected readonly confidence = confianza;

  protected readonly summary = computed(() => summarizeAffectedTables(this.operation().datos));
  protected readonly headline = computed(() => affectedTablesHeadline(this.summary().counts));
}
