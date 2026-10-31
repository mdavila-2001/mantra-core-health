import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessApprovalsClient } from '../../../../core/data-access/access-governance/access-approvals.client';
import { AccessGovernanceClient } from '../../../../core/data-access/access-governance/access-governance.client';
import type { GovernancePanel } from '../../../../core/data-access/access-governance/access-governance.types';
import type { SupportApproval } from '../../../../core/data-access/access-governance/access-reviews.types';
import type { DoctorTeamMember } from '../../../../core/data-access/support-access/support-access.types';
import { falloDeApi } from '../../../access-governance/simulator/simulator.fixtures';
import { countText, TeamAttention } from './team-attention';

const PANEL: GovernancePanel = {
  generatedAt: '2026-11-03T10:00:00-04:00',
  team: [{ userId: 'u-ana', engagementId: 'e-ana', templateCode: 'SECRETARY', liveGrants: 2 }],
  pendingReviews: 3,
  openAnomalies: [
    {
      id: 'an-1',
      userId: 'u-ana',
      kindConceptId: 'ANOMALY_CANCEL_SPIKE',
      windowStart: '2026-11-03T08:00:00-04:00',
      observed: 30,
      threshold: 20,
    },
  ],
};
const APROBACION: SupportApproval = {
  id: 'ap-1',
  tenantId: 't',
  kind: 'ACTION',
  status: 'PENDING',
  approverKind: 'DOCTOR',
  createdAt: '2026-11-03T09:00:00-04:00',
  expiresAt: '2026-11-03T23:00:00-04:00',
  summary: 'Marcos pide cancelar la cita de Mateo.',
};
const ANA = {
  delegateId: 'dl-ana',
  userId: 'u-ana',
  personName: 'Ana Gutiérrez',
} as DoctorTeamMember;

describe('TeamAttention', () => {
  let fixture: ComponentFixture<TeamAttention>;
  let getPractitionerPanel: ReturnType<typeof vi.fn>;
  let listPending: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function abrir(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AccessGovernanceClient, useValue: { getPractitionerPanel } },
        { provide: AccessApprovalsClient, useValue: { listPending } },
      ],
    });
    fixture = TestBed.createComponent(TeamAttention);
    fixture.componentRef.setInput('members', [ANA]);
    await settle();
  }

  beforeEach(() => {
    getPractitionerPanel = vi.fn(() => of(PANEL));
    listPending = vi.fn(() => of({ items: [APROBACION], count: 1 }));
  });

  it('dice cuántas cosas esperan, cada una con su enlace a donde se decide', async () => {
    await abrir();
    expect(byId('atencion-aprobaciones')!.textContent).toContain(
      '1 aprobación espera su decisión.',
    );
    expect(byId('atencion-aprobaciones')!.querySelector('a')!.getAttribute('href')).toBe(
      '/my-team/approvals',
    );
    expect(byId('atencion-aprobaciones-detalle')!.textContent).toContain(
      'Marcos pide cancelar la cita de Mateo.',
    );
    expect(byId('atencion-revisiones')!.textContent).toContain(
      '3 accesos de su equipo esperan su revisión.',
    );
    expect(byId('atencion-revisiones')!.querySelector('a')!.getAttribute('href')).toBe(
      '/my-team/reviews',
    );
  });

  it('las alertas dicen quién, qué y desde cuándo, con el nombre de la persona de su equipo', async () => {
    await abrir();
    expect(byId('atencion-anomalias')!.textContent).toContain(
      '1 alerta sobre la actividad de su agenda.',
    );
    expect(byId('atencion-alertas')!.textContent).toContain('Ana Gutiérrez: Muchas cancelaciones');
  });

  it('sin nada pendiente es un vacío con su próxima acción en palabras', async () => {
    getPractitionerPanel.mockReturnValue(of({ ...PANEL, pendingReviews: 0, openAnomalies: [] }));
    listPending.mockReturnValue(of({ items: [], count: 0 }));
    await abrir();
    expect(host().textContent).toContain('No tiene nada pendiente por ahora.');
    expect(host().textContent).toContain('Cuando algo necesite su decisión, aparecerá acá');
  });

  it('un fallo muestra el código de seguimiento y reintenta con el botón', async () => {
    getPractitionerPanel.mockReturnValueOnce(throwError(() => falloDeApi(500, 'INTERNAL')));
    await abrir();
    expect(host().textContent).toContain('req-123');
    const reintentar = Array.from(host().querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Reintentar'),
    )!;
    reintentar.click();
    await settle();
    expect(getPractitionerPanel).toHaveBeenCalledTimes(2);
    expect(byId('atencion-revisiones')).not.toBeNull();
  });

  it('el singular y el plural se dicen bien', () => {
    expect(countText(1, 'aprobación espera', 'aprobaciones esperan')).toBe('1 aprobación espera');
    expect(countText(2, 'aprobación espera', 'aprobaciones esperan')).toBe(
      '2 aprobaciones esperan',
    );
  });
});
