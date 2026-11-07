import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import type { NewOrderResult } from './new-order.types';
import { QrOrderTab } from './qr-order-tab';

/** Way 1 of three to create an order, in a dialog: the QR the patient sent (camera, image, paste). */
@Component({
  selector: 'app-qr-order-dialog',
  imports: [ContentDialog, QrOrderTab],
  template: `
    <app-content-dialog
      heading="Orden con el QR del paciente"
      description="La que el paciente genera en «Mis órdenes». Las que deriva un médico llegan solas cuando el paciente las acepta."
      size="lg"
      (closed)="closed.emit()"
      data-testid="lab-qr-order-dialog"
    >
      <app-qr-order-tab (created)="created.emit($event)" />
    </app-content-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QrOrderDialog {
  readonly created = output<NewOrderResult>();
  readonly closed = output<void>();
}
