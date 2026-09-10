import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { Observable } from 'rxjs';

import type { OwnerType } from '../../../../core/data-access/files/files.types';
import { AppButton } from '../../atoms/button/button';
import { DialogService } from '../../molecules/dialog/dialog-service';
import {
  AttachmentUploader,
  type ContextoDelAdjunto,
} from '../attachment-uploader/attachment-uploader';
import { ContentDialog } from '../content-dialog/content-dialog';

/**
 * **Adjuntar archivos**, en un modal.
 *
 * ## Por qué existe en vez de repetir el par en cada pantalla
 *
 * Porque la corrección del 10/09/2026 pide que adjuntar deje de abrirse dentro
 * de la fila del registro. Antes cada llamador ponía el
 * `app-attachment-uploader` donde le quedaba —en el expediente, debajo de la
 * fila del diagnóstico— y el formulario empujaba la tabla hacia abajo. Con
 * esto, los tres sitios que adjuntan comparten el mismo modal, el mismo título
 * y el mismo descarte.
 *
 * ```html
 * @if (adjuntandoA(); as conditionId) {
 *   <app-attachment-dialog
 *     ownerType="CONDITION"
 *     [ownerId]="conditionId"
 *     [contexto]="contextoDelDiagnostico()"
 *     [linkVia]="enlazarAlDiagnostico"
 *     (attached)="recargar()"
 *     (closed)="cerrarAdjuntos()"
 *   />
 * }
 * ```
 *
 * ## El descarte se pregunta, y sólo cuando hay algo que descartar
 *
 * Con archivos elegidos y sin mandar, los tres gestos de cierre —el botón,
 * `Escape` y el fondo— preguntan en vez de cerrar. Sin nada pendiente cierran
 * de una: una confirmación sobre un formulario vacío es una puerta con llave y
 * nada detrás.
 *
 * Con una subida en curso el cierre **no se ofrece**: el resultado de cada
 * archivo se está escribiendo y ocultarlo dejaría a alguien sin saber cuáles
 * entraron. Ahí la confirmación no aparece y el gesto no hace nada, que es lo
 * único honesto mientras el lote viaja.
 */
@Component({
  selector: 'app-attachment-dialog',
  imports: [AppButton, AttachmentUploader, ContentDialog],
  templateUrl: './attachment-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttachmentDialog {
  private readonly dialogs = inject(DialogService);

  /** A qué tipo de recurso se adjunta. */
  readonly ownerType = input.required<OwnerType>();
  /** El recurso concreto. */
  readonly ownerId = input.required<string>();

  /** El contexto clínico heredado, en pares rótulo/valor. Ver el uploader. */
  readonly contexto = input<readonly ContextoDelAdjunto[]>([]);

  /** El vínculo propio del dominio, si lo hay. Ver el uploader. */
  readonly linkVia = input<((fileId: string, ownerId: string) => Observable<unknown>) | null>(
    null,
  );

  /** Se emite cuando todo el lote quedó adjuntado. */
  readonly attached = output<void>();

  /** Se emite por cada archivo que entró, mientras el lote avanza. */
  readonly progressed = output<void>();

  /** Se cerró. Quien lo escucha baja la bandera que lo montó. */
  readonly closed = output<void>();

  /**
   * Sin `required`: la plantilla lo consulta en el mismo pase en el que se
   * crea, y un `viewChild.required` ahí revienta antes de que exista.
   */
  protected readonly uploader = viewChild(AttachmentUploader);
  private readonly dialog = viewChild(ContentDialog);

  /** Si el modal puede cerrarse solo, o hay una selección que se perdería. */
  protected readonly sePuedeCerrarSolo = computed(
    () => !(this.uploader()?.tieneCambiosPendientes() ?? false),
  );

  /** Termina el lote: avisa y cierra. */
  protected alAdjuntar(): void {
    this.attached.emit();
    this.dialog()?.close();
  }

  /**
   * Intento de cierre con archivos sin mandar.
   *
   * Se pregunta y, si se descarta, se cierra. Si se cancela la confirmación, el
   * modal queda donde estaba con la cola intacta: cancelar el descarte no puede
   * costar la selección.
   */
  protected async alIntentarCerrar(): Promise<void> {
    if (this.uploader()?.enviando() === true) {
      return;
    }
    // Sin nada pendiente no hay nada que descartar: preguntar sería una puerta
    // con llave y nada detrás. Es el camino del botón «Cancelar» en un
    // formulario vacío.
    if (this.sePuedeCerrarSolo()) {
      this.dialog()?.close();
      return;
    }
    const descartar = await this.dialogs.confirm({
      title: '¿Descartar los archivos elegidos?',
      message:
        'Todavía no se adjuntaron. Si cerrás, la selección se pierde y hay que volver a elegirlos.',
      confirmLabel: 'Descartar',
      cancelLabel: 'Seguir adjuntando',
      destructive: true,
    });
    if (descartar) {
      this.dialog()?.close();
    }
  }
}
