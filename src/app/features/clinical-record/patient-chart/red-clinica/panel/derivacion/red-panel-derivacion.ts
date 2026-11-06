import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';

import type { DetalleDeDerivacion } from '../../red-clinica.types';

/** A referral in the detail panel: destination, answer, arrival and counter-referral. */
@Component({
  selector: 'section[app-red-panel-derivacion]',
  imports: [DatePipe],
  templateUrl: './red-panel-derivacion.html',
  styleUrl: '../red-clinica-panel.secciones.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedPanelDerivacion {
  readonly d = input.required<DetalleDeDerivacion>();
  /** The arrival encounter was chosen. */
  readonly elegir = output<string>();
}
