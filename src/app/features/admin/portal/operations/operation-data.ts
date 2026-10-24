import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { OperacionDetalle } from '../../../../core/data-access/admin-portal/portal.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { confianza, operacionSobreTabla } from '../portal-labels';

/**
 * Qué datos toca una operación: las tablas que lee, escribe o borra (con la
 * confianza con que el generador lo determinó), los eventos que emite, los
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
}
