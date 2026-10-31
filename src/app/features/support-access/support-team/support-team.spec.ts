import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessGovernanceClient } from '../../../core/data-access/access-governance/access-governance.client';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type {
  SupportEngagement,
  SupportGrant,
} from '../../../core/data-access/support-access/support-access.types';
import { falloDeApi } from '../../access-governance/simulator/simulator.fixtures';
import { SupportTeam } from './support-team';

const enDias = (n: number): string => new Date(Date.now() + n * 86_400_000).toISOString();

const permiso = (extra: Partial<SupportGrant>): SupportGrant => ({
  id: 'g',
  engagementId: 'e-marcos',
  targetKind: 'PRACTITIONER',
  practitionerName: 'Dr. Suárez',
  expansionMode: 'DYNAMIC',
  actions: ['schedule.view'],
  status: 'ACTIVE',
  ...extra,
});

const MARCOS: SupportEngagement = {
  id: 'e-marcos',
  tenantId: 't-1',
  organizationName: 'Hospital Piloto',
  ownerKind: 'ORGANIZATION',
  userId: 'u-marcos',
  personName: 'Marcos Ribera',
  roleTemplate: 'FRONT_DESK',
  status: 'ACTIVE',
  origin: 'REQUEST',
  recertifyEveryMonths: 12,
  nextRecertificationAt: enDias(120),
  lastActivityAt: enDias(-2),
  grants: [
    permiso({
      id: 'a',
      effect: 'ALLOW',
      origin: 'ATOM',
      atoms: ['billing.payment.collect'],
      conditionsSummary: 'Solo de lunes a viernes.',
    }),
    permiso({ id: 'b', effect: 'DENY', origin: 'ATOM', atoms: ['agenda.appointment.view.reason'] }),
  ],
};
const ANA: SupportEngagement = {
  ...MARCOS,
  id: 'e-ana',
  userId: 'u-ana',
  personName: 'Ana Gutiérrez',
  roleTemplate: 'SECRETARY',
  lastActivityAt: undefined,
  nextRecertificationAt: enDias(-3),
  grants: [permiso({ id: 'c', engagementId: 'e-ana', actions: ['schedule.cancel'] })],
};

describe('SupportTeam', () => {
  let fixture: ComponentFixture<SupportTeam>;
  let governance: Record<string, ReturnType<typeof vi.fn>>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  const settle = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  async function abrir(items: readonly SupportEngagement[] = [MARCOS, ANA]): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupportAccessClient, useValue: { listEngagements: () => of({ items }) } },
        { provide: AccessGovernanceClient, useValue: governance },
      ],
    });
    fixture = TestBed.createComponent(SupportTeam);
    fixture.detectChanges();
    await settle();
  }

  beforeEach(() => {
    governance = {
      getOwnerless: vi.fn(() =>
        of({
          generatedAt: 'x',
          items: [{ userId: 'u-ana', engagementId: 'e-ana', reasons: ['NO_OWNER'] }],
        }),
      ),
      getUnusedAccess: vi.fn(() =>
        of({
          generatedAt: 'x',
          days: 60,
          items: [
            { userId: 'u-ana', engagementId: 'e-ana', grantId: 'c', atoms: [], daysSinceUse: 75 },
          ],
        }),
      ),
      listSodFindings: vi.fn(() =>
        of({
          count: 1,
          items: [
            {
              engagementId: 'e-marcos',
              userId: 'u-marcos',
              ruleCode: 'SOD-BILL-03',
              ruleName: 'Cobrar y anular',
              action: 'WARN',
              outcome: 'OPEN',
              atomsA: [],
              atomsB: [],
              admitsException: true,
              message: 'x',
            },
          ],
        }),
      ),
      getPrivilegeCreep: vi.fn(() =>
        of({
          generatedAt: 'x',
          threshold: 15,
          items: [
            {
              userId: 'u-marcos',
              engagementId: 'e-marcos',
              score: 40,
              baseline: 20,
              drift: 20,
              flagged: true,
              reasons: [],
              grantsSinceCertification: 2,
            },
          ],
        }),
      ),
    };
  });

  it('cada persona muestra el efecto, las condiciones, el origen y la sensibilidad de sus permisos', async () => {
    await abrir();
    const marcos = byId('equipo-insignias-e-marcos')!;
    expect(marcos.textContent).toContain('Permite 1');
    expect(marcos.textContent).toContain('Deniega 1');
    expect(marcos.textContent).toContain('Con condiciones');
    expect(marcos.textContent).toContain('Permisos por átomo');
    expect(marcos.textContent).toContain('Sensibilidad máxima: Alta');
    const ana = byId('equipo-insignias-e-ana')!;
    expect(ana.textContent).toContain('Permisos antiguos');
    expect(ana.textContent).not.toContain('Deniega');
  });

  it('marca sin responsable, sin uso, conflicto de funciones, acumulación y certificación vencida, con palabras', async () => {
    await abrir();
    const ana = byId('equipo-estado-e-ana')!.parentElement!;
    expect(ana.textContent).toContain('Sin responsable de la cuenta');
    expect(ana.textContent).toContain('Sin uso hace 75 días');
    expect(ana.textContent).toContain('Certificación vencida');
    const marcos = byId('equipo-estado-e-marcos')!.parentElement!;
    expect(marcos.textContent).toContain('Conflicto de funciones');
    expect(marcos.textContent).toContain('Acumuló permisos');
    expect(marcos.textContent).not.toContain('Sin responsable');
    expect(marcos.textContent).not.toContain('Certificación vencida');
  });

  /**
   * Pendiente 72: las pantallas de cambiar de rol (`move`) y de dar de baja con traspaso (`offboard`) existían pero no había cómo
   * llegar a ellas desde la lista del equipo.
   */
  it('cada persona vigente enlaza a «Cambiar de rol o alcance» y a «Dar de baja con traspaso»', async () => {
    await abrir();
    const mover = byId('equipo-mover-e-marcos') as HTMLAnchorElement;
    const baja = byId('equipo-baja-e-marcos') as HTMLAnchorElement;
    expect(mover.getAttribute('href')).toBe('/administration/support-team/e-marcos/move');
    expect(mover.textContent).toContain('Cambiar de rol');
    expect(mover.getAttribute('aria-label')).toContain('Marcos Ribera');
    expect(baja.getAttribute('href')).toBe('/administration/support-team/e-marcos/offboard');
    expect(baja.textContent).toContain('Dar de baja');
    expect(byId('equipo-mover-e-ana')).not.toBeNull();
  });

  it('un vínculo ya terminado no ofrece cambiar de rol ni dar de baja', async () => {
    await abrir([{ ...MARCOS, status: 'ENDED' }]);
    expect(byId('equipo-mover-e-marcos')).toBeNull();
    expect(byId('equipo-baja-e-marcos')).toBeNull();
  });

  it('muestra el último uso y dice la verdad cuando no hay ninguno', async () => {
    await abrir();
    expect(byId('equipo-ultimo-uso-e-marcos')!.textContent).toContain('Último uso');
    expect(byId('equipo-ultimo-uso-e-ana')!.textContent).toContain('Sin actividad registrada');
  });

  it('si un informe de gobierno falla, la lista sigue y solo faltan esas insignias', async () => {
    governance['getOwnerless'] = vi.fn(() => throwError(() => falloDeApi(500, 'INTERNAL')));
    governance['listSodFindings'] = vi.fn(() => throwError(() => falloDeApi(403, 'FORBIDDEN')));
    await abrir();
    expect(byId('equipo-nombre-e-marcos')).not.toBeNull();
    expect(host().textContent).not.toContain('Sin responsable de la cuenta');
    expect(host().textContent).not.toContain('Conflicto de funciones');
    expect(host().textContent).toContain('Sin uso hace 75 días');
  });

  it('sin personal es un vacío con su próxima acción', async () => {
    await abrir([]);
    expect(host().textContent).toContain('Todavía no tiene personal de apoyo.');
    expect(host().querySelector('a[href="/administration/support-invitations"]')).not.toBeNull();
  });
});
