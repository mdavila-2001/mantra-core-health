import { ChangeDetectionStrategy, Component } from '@angular/core';

import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { CYCLE_PHASES, NO_COMPROBADO, REQUEST_CYCLE, stagesOf } from './request-cycle';

/**
 * El ciclo de la petición: las 21 etapas por las que pasa cualquier llamada a
 * la API, cada una con el archivo de origen. Es el mismo para todas las
 * operaciones —no depende de la que se está mirando— y se dice así arriba.
 * Presentacional y sin datos de red: lo que muestra viene de `request-cycle.ts`.
 */
@Component({
  selector: 'app-portal-operation-cycle',
  imports: [Alert, Badge],
  templateUrl: './operation-cycle.html',
  styleUrl: './operation-cycle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationCycle {
  protected readonly phases = CYCLE_PHASES.map((phase) => ({ ...phase, stages: stagesOf(phase.codigo) }));
  protected readonly total = REQUEST_CYCLE.length;
  protected readonly unverified = NO_COMPROBADO;
}
