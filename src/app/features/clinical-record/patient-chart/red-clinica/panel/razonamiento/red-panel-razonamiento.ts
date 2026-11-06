import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';

import type { DetalleDeDiagnostico } from '../../red-clinica.types';

/** A diagnosis' reasoning in the detail panel: certainty, findings and the decision. */
@Component({
  selector: 'section[app-red-panel-razonamiento]',
  imports: [DatePipe],
  templateUrl: './red-panel-razonamiento.html',
  styleUrl: '../red-clinica-panel.secciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedPanelRazonamiento {
  readonly d = input.required<DetalleDeDiagnostico>();
  /** «hace N días» since the node's date. */
  readonly hace = input('');
  /** Another node was chosen from the evidence or the replacement. */
  readonly elegir = output<string>();
}
