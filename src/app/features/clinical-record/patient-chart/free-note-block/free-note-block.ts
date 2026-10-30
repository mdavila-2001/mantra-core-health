import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  output,
  viewChild,
} from '@angular/core';

import type { CitaDelPaciente } from '../diagnosis-block/diagnosis-block';
import { DRAFT_BLOCK, type DraftBlock } from '../draft-block';
import { MeasurementGrid } from '../measurement-grid/measurement-grid';

/**
 * @deprecated (C7, 2026-09-25) Este componente **ya no ofrece la hoja en
 * blanco**: el propietario pidió homogeneizar la terminología, y "hoja en
 * blanco"/"nota clínica narrativa" eran justo los términos con varias formas
 * conviviendo que había que retirar. Lo único que le queda es delegar en
 * `MeasurementGrid` (ex `note-grid`, ya renombrado y relocado por este mismo
 * carril).
 *
 * **No se pudo borrar el archivo ni la clase**, aunque el prompt lo pedía:
 * `patient-chart.ts` (C3, fuera de mi alcance esta noche) todavía importa
 * `FreeNoteBlock` y la usa en su plantilla (`patient-chart.ts:74,322`,
 * `<app-free-note-block>` en `patient-chart.html:461`). Borrar la clase
 * rompería la compilación de un archivo que no puedo tocar — ver
 * `PLAN.md` §"Bloqueo real". **Instrucción para quien pueda tocar
 * `patient-chart.ts` después:** cambiar el import y la plantilla a
 * `<app-measurement-grid>` directo, y entonces sí borrar esta carpeta entera.
 */
@Component({
  selector: 'app-free-note-block',
  imports: [MeasurementGrid],
  providers: [{ provide: DRAFT_BLOCK, useExisting: forwardRef(() => FreeNoteBlock) }],
  templateUrl: './free-note-block.html',
  styleUrl: './free-note-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FreeNoteBlock implements DraftBlock {
  readonly patientProfileId = input.required<string>();
  readonly encounterId = input<string | null>(null);
  /** @deprecated Sin uso desde que se retiró la hoja en blanco (era sólo suya); se mantiene por el contrato del host. */
  readonly citas = input<readonly CitaDelPaciente[]>([]);

  /** Reenviado tal cual desde `MeasurementGrid`: `patient-chart.ts` sigue escuchándolo en este selector. */
  readonly guardada = output<void>();

  private readonly grid = viewChild.required(MeasurementGrid);

  readonly tieneCambiosPendientes = computed(() => this.grid().hayCambiosSinGuardar());
}
