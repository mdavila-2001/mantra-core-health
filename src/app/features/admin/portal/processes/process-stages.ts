import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { Etapa } from '../../../../core/data-access/admin-portal/portal.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { metodoHttp, operacionSobreTabla, riesgo } from '../portal-labels';

/**
 * Las etapas de un proceso, cada una con sus operaciones: quién actúa, qué
 * hace, con qué riesgo y qué efectos deja. Presentacional.
 */
@Component({
  selector: 'app-portal-process-stages',
  imports: [RouterLink, Badge, Link],
  templateUrl: './process-stages.html',
  styleUrl: './process-stages.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessStages {
  readonly stages = input.required<readonly Etapa[]>();
  readonly operationUrl = input.required<(id: string) => string>();
  /** `null` cuando el nombre de la tabla no trae schema y no hay ficha a la que llevar. */
  readonly tableUrl = input.required<(qualified: string) => string | null>();

  protected readonly method = metodoHttp;
  protected readonly risk = riesgo;
  protected readonly effect = operacionSobreTabla;
}
