import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';

import { accessFailureOf } from '../../../../core/data-access/access-governance/access-errors';
import { AccessApprovalsClient } from '../../../../core/data-access/access-governance/access-approvals.client';
import type { SupportApproval } from '../../../../core/data-access/access-governance/access-reviews.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Card } from '../../../../shared/components/molecules/card/card';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { formatDateTime } from '../../support-labels';

/** El estado de un pedido de aprobación dicho con palabras; el tono solo acompaña. */
export function approvalStatusText(status: string): {
  readonly label: string;
  readonly tone: BadgeVariant;
} {
  switch (status) {
    case 'PENDING':
      return { label: 'Espera la decisión', tone: 'info' };
    case 'APPROVED':
      return { label: 'Aprobada', tone: 'success' };
    case 'CONSUMED':
      return { label: 'Aprobada y ya usada', tone: 'secondary' };
    case 'REJECTED':
      return { label: 'Rechazada', tone: 'error' };
    case 'CANCELLED':
      return { label: 'Retirada', tone: 'secondary' };
    case 'EXPIRED':
      return { label: 'Venció', tone: 'warning' };
    default:
      return { label: 'Resuelta', tone: 'secondary' };
  }
}

/**
 * **Mis pedidos de aprobación** en «Mis accesos»: lo que la persona pidió a otra (el doctor o una segunda persona) y cómo va.
 * Lo pendiente se puede retirar; lo demás se lee. Nada de acá aprueba nada: decide quien corresponde (cuatro ojos).
 */
@Component({
  selector: 'app-my-approvals',
  imports: [AppButton, Badge, Card, ViewStateHost],
  templateUrl: './my-approvals.html',
  styleUrl: './my-approvals.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyApprovals implements OnInit {
  private readonly client = inject(AccessApprovalsClient);
  private readonly toasts = inject(ToastService);

  protected readonly state = signal<ViewState<readonly SupportApproval[]>>(loading());
  protected readonly busy = signal<string | null>(null);

  protected readonly items = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data : [];
  });

  protected statusOf = approvalStatusText;
  protected when = formatDateTime;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set(loading());
    this.client.listMyApprovals().subscribe({
      next: ({ items }) =>
        this.state.set(
          items.length === 0
            ? empty(
                { label: 'Cuando una acción necesite aprobación, el pedido aparecerá acá' },
                'No tiene pedidos de aprobación.',
              )
            : ready(items),
        ),
      error: (failure: unknown) =>
        this.state.set(errorToViewState<readonly SupportApproval[]>(failure)),
    });
  }

  protected withdraw(item: SupportApproval): void {
    if (this.busy() !== null) return;
    this.busy.set(item.id);
    this.client.cancelMyApproval(item.id).subscribe({
      next: () => {
        this.busy.set(null);
        this.toasts.success('Retiró su pedido.', 'Ya nadie puede aprobarlo.');
        this.load();
      },
      error: (failure: unknown) => {
        this.busy.set(null);
        this.toasts.error(
          accessFailureOf(failure)?.message ?? 'No pudimos retirar el pedido. Vuelva a intentarlo.',
        );
        this.load();
      },
    });
  }
}
