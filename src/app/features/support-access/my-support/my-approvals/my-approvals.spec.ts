import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessApprovalsClient } from '../../../../core/data-access/access-governance/access-approvals.client';
import type { SupportApproval } from '../../../../core/data-access/access-governance/access-reviews.types';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { falloDeApi } from '../../../access-governance/simulator/simulator.fixtures';
import { approvalStatusText, MyApprovals } from './my-approvals';

const pedido = (
  id: string,
  status: string,
  extra: Partial<SupportApproval> = {},
): SupportApproval => ({
  id,
  tenantId: 't',
  kind: 'ACTION',
  status,
  approverKind: 'DOCTOR',
  createdAt: '2026-11-03T09:00:00-04:00',
  expiresAt: '2026-11-03T23:00:00-04:00',
  summary: `Pedido ${id}`,
  ...extra,
});

describe('MyApprovals', () => {
  let fixture: ComponentFixture<MyApprovals>;
  let listMyApprovals: ReturnType<typeof vi.fn>;
  let cancelMyApproval: ReturnType<typeof vi.fn>;
  let toastError: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function abrir(items: readonly SupportApproval[]): Promise<void> {
    listMyApprovals = vi.fn(() => of({ items, count: items.length }));
    TestBed.configureTestingModule({
      providers: [
        { provide: AccessApprovalsClient, useValue: { listMyApprovals, cancelMyApproval } },
        { provide: ToastService, useValue: { success: vi.fn(), error: toastError } },
      ],
    });
    fixture = TestBed.createComponent(MyApprovals);
    await settle();
  }

  beforeEach(() => {
    cancelMyApproval = vi.fn(() => of(pedido('a', 'CANCELLED')));
    toastError = vi.fn();
  });

  it('cada estado se dice con palabras, y solo lo pendiente se puede retirar', async () => {
    await abrir([
      pedido('a', 'PENDING'),
      pedido('b', 'APPROVED', { approvedUntil: '2026-11-03T12:00:00-04:00' }),
      pedido('c', 'REJECTED', { decisionComment: 'No corresponde' }),
      pedido('d', 'EXPIRED'),
    ]);
    expect(byId('aprobacion-a')!.textContent).toContain('Espera la decisión');
    expect(byId('aprobacion-retirar-a')).not.toBeNull();
    expect(byId('aprobacion-b')!.textContent).toContain('Vale hasta');
    expect(byId('aprobacion-c')!.textContent).toContain('Motivo: No corresponde');
    expect(byId('aprobacion-d')!.textContent).toContain('Venció');
    for (const id of ['b', 'c', 'd']) expect(byId(`aprobacion-retirar-${id}`)).toBeNull();
  });

  it('retirar un pedido que ya se resolvió explica por qué y recarga la lista', async () => {
    cancelMyApproval.mockReturnValue(
      throwError(() => falloDeApi(409, 'CONFLICT', 'FOUR_EYES_NOT_PENDING')),
    );
    await abrir([pedido('a', 'PENDING')]);
    byId('aprobacion-retirar-a')!.click();
    await settle();
    expect(toastError).toHaveBeenCalledWith('Esa solicitud ya fue resuelta.');
    expect(listMyApprovals).toHaveBeenCalledTimes(2);
  });

  it('si la lista no carga muestra el código de seguimiento', async () => {
    listMyApprovals = vi.fn(() => throwError(() => falloDeApi(500, 'INTERNAL')));
    TestBed.configureTestingModule({
      providers: [
        { provide: AccessApprovalsClient, useValue: { listMyApprovals } },
        { provide: ToastService, useValue: {} },
      ],
    });
    fixture = TestBed.createComponent(MyApprovals);
    await settle();
    expect(host().textContent).toContain('req-123');
  });

  it('un estado desconocido no se pinta como éxito', () => {
    expect(approvalStatusText('RARO')).toEqual({ label: 'Resuelta', tone: 'secondary' });
  });
});
