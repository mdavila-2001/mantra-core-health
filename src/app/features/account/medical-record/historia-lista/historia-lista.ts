import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';

import { FECHAS_DEL_DIA_CLINICO } from '../../../clinical-record/patient-chart/recorrido-clinico/recorrido-clinico.zona';

/** A row of the read-only lists (allergies, results). */
export interface FilaVisible {
  readonly id: string;
  readonly principal: string;
  readonly secundario: string;
  readonly cuando: Date | null;
}

/**
 * A read-only list of the history (allergies, results): a title for screen
 * readers, the empty message or the rows. It sits on the panel's `<section>`.
 */
@Component({
  selector: 'section[app-historia-lista]',
  imports: [DatePipe],
  // The row dates in the clinical day's zone, not the browser's.
  providers: [FECHAS_DEL_DIA_CLINICO],
  templateUrl: './historia-lista.html',
  styleUrl: '../medical-record.listas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoriaLista {
  readonly tituloId = input.required<string>();
  readonly titulo = input.required<string>();
  readonly vacio = input.required<string>();
  readonly testId = input.required<string>();
  readonly filas = input.required<readonly FilaVisible[]>();
  /** Whether each row says its date after the secondary text. */
  readonly conFecha = input(false);
}
