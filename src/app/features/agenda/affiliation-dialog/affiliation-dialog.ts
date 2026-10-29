import { ChangeDetectionStrategy, Component, inject, output, viewChild } from '@angular/core';

import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { AffiliationRequestForm } from '../../account/my-profile/affiliation-invitations/affiliation-request-form/affiliation-request-form';

/** El título del formulario de solicitud: el modal lo dice una vez, en su encabezado. */
const HEADING = 'Pedir afiliarme a un centro';

/**
 * «Afiliarme a otra organización…» sin salir de la pantalla: el formulario de
 * solicitud que ya existe (`AffiliationRequestForm`) dentro del modal del
 * sistema.
 *
 * Lo abren «Publicar agenda» y el modal del día cuando el selector de
 * organización emite `affiliationRequested`. La pantalla lo monta con un `@if`
 * y lo desmonta al recibir {@link closed}.
 *
 * ## Se cierra con `close()`, no sacándolo del DOM
 *
 * Un `<dialog>` abierto que un `@if` quita deja el velo puesto y la página
 * inerte (el mismo motivo que da `app-select` al cerrar su panel). Por eso el
 * formulario terminado le pide el cierre al modal, y la pantalla lo desmonta
 * recién cuando el modal avisa que cerró. Enviar es una decisión tomada:
 * `close(true)` libera la página en el acto. Cancelar es descartar, y lleva la
 * salida corta del panel, como `Escape` o un clic en el fondo.
 *
 * ## Pedir no es publicar
 *
 * La solicitud queda pendiente hasta que la organización la apruebe, así que
 * no devuelve ninguna organización: el selector sigue con lo que tenía.
 */
@Component({
  selector: 'app-affiliation-dialog',
  imports: [AffiliationRequestForm, ContentDialog],
  template: `
    <app-content-dialog [heading]="heading" size="md" (closed)="closed.emit()">
      <app-affiliation-request-form
        (requested)="finish($event)"
        (changed)="changed.emit()"
        (cancelled)="dialog().close()"
      />
    </app-content-dialog>
  `,
  styleUrl: './affiliation-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffiliationDialog {
  private readonly toasts = inject(ToastService);

  protected readonly dialog = viewChild.required(ContentDialog);
  protected readonly heading = HEADING;

  /** Se enviaron todas las solicitudes; dice cuántas. Enseguida el modal se cierra. */
  readonly requested = output<number>();

  /**
   * Alguna solicitud quedó hecha aunque otra falló. El formulario sigue abierto
   * con su aviso; quien tenga una lista de afiliaciones a la vista la recarga.
   */
  readonly changed = output<void>();

  /** El modal terminó de cerrarse, por cualquier camino: ya se puede desmontar. */
  readonly closed = output<void>();

  /** Mismo aviso que «Invitaciones y solicitudes»: el pedido salió y falta el centro. */
  protected finish(count: number): void {
    this.toasts.success(
      count === 1
        ? 'Pidió afiliarse por 1 procedimiento.'
        : `Pidió afiliarse por ${count} procedimientos.`,
      'Falta que el centro apruebe',
    );
    this.requested.emit(count);
    this.dialog().close(true);
  }
}
