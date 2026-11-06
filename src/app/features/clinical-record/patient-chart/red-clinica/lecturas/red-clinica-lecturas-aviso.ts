import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import type { FaltasDeLaRed } from './red-clinica-lecturas';

/**
 * What the network could not read, above it: loading, failed (retry and
 * request id), outside the access scope (S5, no retry), not available (S6,
 * nothing about existence) and cut at the cap. The network is drawn anyway
 * with what arrived.
 *
 * ```html
 * <app-red-clinica-lecturas-aviso [faltas]="faltasDeLaRed()" (reintentar)="releerLaRed()" />
 * ```
 */
@Component({
  selector: 'app-red-clinica-lecturas-aviso',
  imports: [Alert, AppButton],
  templateUrl: './red-clinica-lecturas-aviso.html',
  styleUrl: './red-clinica-lecturas-aviso.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedClinicaLecturasAviso {
  readonly faltas = input.required<FaltasDeLaRed>();
  readonly reintentar = output<void>();
}
