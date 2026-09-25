import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';

/** C0: contrato del bloque que C1 implementará (P39). No persiste contenido. */
@Component({
  selector: 'app-medical-note-block',
  imports: [Alert],
  templateUrl: './medical-note-block.html',
  styleUrl: './medical-note-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalNoteBlock {
  readonly patientProfileId = input.required<string>();
  readonly encounterId = input<string | null>(null);
  readonly citas = input<readonly CitaDelPaciente[]>([]);
  readonly guardada = output<void>();
}
