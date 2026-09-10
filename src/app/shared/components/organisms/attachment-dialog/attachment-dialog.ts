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
 * Adjuntar archivos **en un modal**, no dentro de la fila.
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
 * probados. Lo que agrega es atarlos, cerrar solo cuando el lote quedó
 * vinculado y preguntar antes de tirar una selección a medio mandar.
 *
 * ```html
 * @if (adjuntandoA(); as conditionId) {
 *   <app-attachment-dialog
 *     ownerType="CONDITION"
 *     [ownerId]="conditionId"
 *     [contexto]="contextoDelDiagnostico()"
 *     [linkVia]="enlazarAdjuntoAlDiagnostico"
 *     heading="Adjuntar archivos al diagnóstico"
 *     (closed)="cerrarAdjuntos()"
 *   />
 * }
 * ```
 *
 * Quien lo usa lo monta con un `@if`: el modal se abre al construirse
 * —`content-dialog` llama a `showModal()` en su `afterNextRender`— y `closed`
 * es la señal de desmontarlo, venga del botón, de `Escape` o del fondo.
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
 * entraron.
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

  /**
   * El título del modal, que es su nombre accesible.
   *
   * En plural desde que la carga admite varios archivos: un título que dice
   * «un archivo» sobre un formulario que acepta doce es lo que hacía que nadie
   * probara a elegir más de uno.
   */
  readonly heading = input('Adjuntar archivos');

  /** Qué registro es, en una línea. `null` no dibuja nada. */
  readonly description = input<string | null>(null);

  /**
   * Los vínculos clínicos que el lote hereda, en pares rótulo/valor.
   *
   * Es contexto de lectura, no un formulario: quien adjunta desde un
   * diagnóstico ya tiene paciente, encuentro y diagnóstico resueltos por el
   * registro padre, y lo que necesita es **verlos** antes de confirmar.
   */
  readonly contexto = input<readonly ContextoDelAdjunto[]>([]);

  /** El endpoint propio del dominio, si lo tiene. Ver `AttachmentUploader`. */
  readonly linkVia = input<((fileId: string, ownerId: string) => Observable<unknown>) | null>(
    null,
  );

  /** El lote quedó subido **y** vinculado, entero. */
  readonly attached = output<void>();

  /** Se emite por cada archivo que entró, mientras el lote avanza. */
  readonly progressed = output<void>();

  /**
   * Se cerró: por el botón, por `Escape`, por el fondo o porque el lote
   * terminó de adjuntarse. Quien lo usa desmonta el modal acá.
   *
   * Es un solo camino de salida a propósito: con `attached` y `closed` como
   * eventos separados, los consumidores tenían que acordarse de cerrar en los
   * dos, y olvidarse de uno dejaba el modal abierto sobre una tarea terminada.
   */
  readonly closed = output<void>();

  /**
   * Sin `required`: la plantilla los consulta en el mismo pase en el que se
   * crean, y un `viewChild.required` ahí revienta antes de que existan.
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
    // `close()` del modal reemite `closed`. Si el diálogo todavía no se montó
    // —una prueba que emite `attached` a mano—, se avisa igual: la salida es
    // una sola y quien lo usa desmonta con ella.
    const modal = this.dialog();
    if (modal === undefined) {
      this.closed.emit();
      return;
    }
    modal.close();
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
