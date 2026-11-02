import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../../shared/components/molecules/alert/alert';

/** Recuperación de una confirmación por lotes, sin sustituir el recuento de Inventario. */
@Component({
  selector: 'app-stock-confirmation-notice',
  imports: [Alert, AppButtonLink, RouterLink],
  templateUrl: './stock-confirmation-notice.html',
  styleUrl: './stock-confirmation-notice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockConfirmationNotice {
  readonly message = input<string | null>(null);
}
