import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import type { ChecklistItem, ChecklistState } from '../organization-home.model';

/** The state in words too: colour and icon alone are not enough for a screen reader. */
const STATE_TEXT: Readonly<Record<ChecklistState, string>> = {
  ok: 'En orden',
  pending: 'Pendiente',
  attention: 'Requiere atención',
};

/** What the organization has in order and what it still owes, one line each. Presentational. */
@Component({
  selector: 'app-organization-checklist',
  imports: [NavIcon],
  templateUrl: './organization-checklist.html',
  styleUrl: './organization-checklist.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationChecklist {
  readonly items = input.required<readonly ChecklistItem[]>();

  protected stateText(state: ChecklistState): string {
    return STATE_TEXT[state];
  }
}
