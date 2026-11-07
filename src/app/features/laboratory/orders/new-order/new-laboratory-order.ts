import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';

import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import type { NewOrderResult } from './new-order.types';
import { OwnOrderTab } from './own-order-tab';
import { QrOrderTab } from './qr-order-tab';

/**
 * **New order** at a laboratory or imaging center. An order is born three ways and this screen
 * covers the two the center starts: the QR the patient sends, or the order the center registers
 * itself. The third, a doctor's referral, arrives by itself once the patient accepts it. One card
 * with tabs, full width (`composition-rules.md` §5).
 */
@Component({
  selector: 'app-new-laboratory-order',
  imports: [Alert, AppButton, Card, OwnOrderTab, QrOrderTab, Tab, Tabs],
  templateUrl: './new-laboratory-order.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NewLaboratoryOrder {
  readonly created = output<NewOrderResult>();
  readonly cancelled = output<void>();
  protected readonly tab = signal(0);
}
