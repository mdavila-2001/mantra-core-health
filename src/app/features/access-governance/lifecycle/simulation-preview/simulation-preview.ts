import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { SimulateAccessResponse } from '../../../../core/data-access/access-governance/access-explain.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';

const SOD_ACTION_TEXT: Readonly<Record<string, string>> = {
  BLOCK: 'No se permite',
  REQUIRE_APPROVAL: 'Pide aprobación',
  WARN: 'Es un aviso',
};

/**
 * **La vista previa de un cambio** (CONTRATO-GOBIERNO §9.4): lo que `simulate` responde, en palabras simples. Nada se guarda
 * acá: es lo que hay que ver *antes* de confirmar. Las regiones que cambian se anuncian (`aria-live`) y ningún estado
 * depende solo del color.
 */
@Component({
  selector: 'app-simulation-preview',
  imports: [Alert],
  templateUrl: './simulation-preview.html',
  styleUrl: './simulation-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationPreview {
  readonly preview = input.required<SimulateAccessResponse>();
  readonly idPrefix = input('preview');

  protected readonly sodActionText = SOD_ACTION_TEXT;
}
