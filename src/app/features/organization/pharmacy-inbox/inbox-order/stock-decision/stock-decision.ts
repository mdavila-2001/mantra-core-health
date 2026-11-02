import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { DecisionDeLinea, LineaDePedido } from '../../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { Radio } from '../../../../../shared/components/molecules/radio/radio';
import { RadioGroup } from '../../../../../shared/components/molecules/radio-group/radio-group';
import { confirmationQuantityError, type InboxLineAdjustment } from '../stock-confirmation';

/** Presentación por línea; estado y envío siguen en el mostrador. */
@Component({
  selector: 'app-stock-decision',
  imports: [FormField, Input, Radio, RadioGroup],
  templateUrl: './stock-decision.html',
  styleUrl: './stock-decision.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockDecision {
  readonly index = input.required<number>();
  readonly line = input.required<LineaDePedido>();
  readonly adjustment = input.required<InboxLineAdjustment>();
  readonly decisionChange = output<DecisionDeLinea | null>();
  readonly quantityChange = output<string | number | null>();
  protected readonly quantityError = computed(() => confirmationQuantityError(this.adjustment().quantity));
}
