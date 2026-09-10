import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { Observable } from 'rxjs';

import type { OwnerType } from '../../../../core/data-access/files/files.types';
import { AttachmentUploader } from '../attachment-uploader/attachment-uploader';
import { ContentDialog } from '../content-dialog/content-dialog';

/**
 * Adjuntar un archivo **en un modal**, no dentro de la fila.
 *
 * ## Por qué existe
 *
 * El subidor se desplegaba dentro de la celda o del renglón del registro al
 * que se adjunta: la tabla crecía de golpe, las filas de abajo se iban de la
 * pantalla y el alto de la lista dependía de si alguien había tocado
 * «Adjuntar». Un cambio sobre un registro existente que **pide datos** va en
 * modal; la fila sólo tiene acciones directas o un menú.
 *
 * Es un envoltorio y no un componente nuevo a propósito: el modal es
 * `content-dialog` y el formulario es `attachment-uploader`, los dos ya
 * probados. Lo único que agrega es atarlos y cerrar solo cuando el archivo
 * quedó vinculado — que era la línea que los tres consumidores repetían.
 *
 * ```html
 * @if (adjuntandoA(); as conditionId) {
 *   <app-attachment-dialog
 *     ownerType="CONDITION"
 *     [ownerId]="conditionId"
 *     [linkVia]="enlazarAdjuntoAlDiagnostico"
 *     (closed)="cerrarAdjuntos()"
 *   />
 * }
 * ```
 *
 * Quien lo usa lo monta con un `@if`: el modal se abre al construirse
 * —`content-dialog` llama a `showModal()` en su `afterNextRender`— y `closed`
 * es la señal de desmontarlo, venga del botón, de `Escape` o del fondo.
 */
@Component({
  selector: 'app-attachment-dialog',
  imports: [AttachmentUploader, ContentDialog],
  template: `
    <app-content-dialog
      [heading]="heading()"
      [description]="description()"
      closeLabel="Listo, sin adjuntar"
      (closed)="closed.emit()"
    >
      <app-attachment-uploader
        [ownerType]="ownerType()"
        [ownerId]="ownerId()"
        [linkVia]="linkVia()"
        (attached)="alAdjuntar()"
      />
    </app-content-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttachmentDialog {
  /** A qué tipo de recurso se adjunta. */
  readonly ownerType = input.required<OwnerType>();

  /** El recurso concreto. */
  readonly ownerId = input.required<string>();

  /** El endpoint propio del dominio, si lo tiene. Ver `AttachmentUploader`. */
  readonly linkVia = input<((fileId: string, ownerId: string) => Observable<unknown>) | null>(null);

  readonly heading = input('Adjuntar un archivo');

  /** Qué registro es, en una línea. `null` no dibuja nada. */
  readonly description = input<string | null>(null);

  /** El archivo quedó subido **y** vinculado. */
  readonly attached = output<void>();

  /**
   * Se cerró: por el botón, por `Escape`, por el fondo o porque el archivo
   * terminó de adjuntarse. Quien lo usa desmonta el modal acá.
   *
   * Es un solo camino de salida a propósito: con `attached` y `closed` como
   * eventos separados, los consumidores tenían que acordarse de cerrar en los
   * dos, y olvidarse de uno dejaba el modal abierto sobre una tarea terminada.
   */
  readonly closed = output<void>();

  protected alAdjuntar(): void {
    this.attached.emit();
    this.closed.emit();
  }
}
