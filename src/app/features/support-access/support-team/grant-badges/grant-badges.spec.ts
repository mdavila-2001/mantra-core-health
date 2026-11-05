import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { SupportGrant } from '../../../../core/data-access/support-access/support-access.types';
import { GrantBadges, summarizeGrantBadges } from './grant-badges';

const permiso = (extra: Partial<SupportGrant> = {}): SupportGrant => ({
  id: 'g-1',
  engagementId: 'e-1',
  targetKind: 'PRACTITIONER',
  expansionMode: 'DYNAMIC',
  actions: ['schedule.view'],
  status: 'ACTIVE',
  ...extra,
});

describe('summarizeGrantBadges', () => {
  it('un permiso antiguo (alias) se lee como «permitir», de origen antiguo, con la sensibilidad de sus átomos', () => {
    const r = summarizeGrantBadges([permiso({ actions: ['schedule.cancel'] })]);
    expect(r.allow).toBe(1);
    expect(r.deny).toBe(0);
    expect(r.origin).toBe('LEGACY');
    expect(r.topSensitivity).toBe('MEDIUM');
    expect(r.conditioned).toBe(0);
  });

  it('cuenta prohibiciones y condiciones, y distingue el origen por átomo de la mezcla', () => {
    const r = summarizeGrantBadges([
      permiso({
        id: 'a',
        effect: 'ALLOW',
        origin: 'ATOM',
        atoms: ['billing.payment.collect'],
        conditionsSummary: 'Solo de lunes a viernes.',
      }),
      permiso({
        id: 'b',
        effect: 'DENY',
        origin: 'ATOM',
        atoms: ['agenda.appointment.view.reason'],
      }),
      permiso({ id: 'c', origin: 'LEGACY' }),
    ]);
    expect(r).toMatchObject({
      allow: 2,
      deny: 1,
      conditioned: 1,
      origin: 'MIXED',
      topSensitivity: 'HIGH',
    });
    expect(r.conditionTexts).toEqual(['Solo de lunes a viernes.']);
  });

  it('la sensibilidad máxima solo mira lo que se permite: una prohibición no suma privilegio', () => {
    const r = summarizeGrantBadges([
      permiso({ effect: 'DENY', atoms: ['billing.receipt.void'], origin: 'ATOM' }),
    ]);
    expect(r.topSensitivity).toBeNull();
    expect(r.allow).toBe(0);
  });

  it('ignora los permisos que ya no rigen', () => {
    expect(summarizeGrantBadges([permiso({ status: 'REVOKED' })]).allow).toBe(0);
  });
});

describe('GrantBadges', () => {
  function pintar(grants: readonly SupportGrant[]): HTMLElement {
    const fixture = TestBed.createComponent(GrantBadges);
    fixture.componentRef.setInput('grants', grants);
    fixture.componentRef.setInput('personName', 'Marcos Ribera');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const byId = (host: HTMLElement, id: string): HTMLElement | null =>
    host.querySelector(`[data-testid="${id}"]`);

  it('dice con palabras el efecto, las condiciones, el origen y la sensibilidad', () => {
    const host = pintar([
      permiso({
        id: 'a',
        effect: 'ALLOW',
        origin: 'ATOM',
        atoms: ['billing.receipt.void'],
        conditionsSummary: 'Solo desde la red del hospital.',
      }),
      permiso({
        id: 'b',
        effect: 'DENY',
        origin: 'ATOM',
        atoms: ['agenda.appointment.view.reason'],
      }),
    ]);
    expect(byId(host, 'insignia-permitir')!.textContent).toContain('Permite 1');
    expect(byId(host, 'insignia-denegar')!.textContent).toContain('Deniega 1');
    expect(byId(host, 'insignia-condiciones')!.textContent).toContain('Con condiciones');
    expect(byId(host, 'insignia-origen')!.textContent).toContain('Permisos por átomo');
    expect(byId(host, 'insignia-sensibilidad')!.textContent).toContain(
      'Sensibilidad máxima: Crítica',
    );
    expect(host.querySelector('ul')!.getAttribute('aria-label')).toBe(
      'Resumen de los permisos de Marcos Ribera',
    );
  });

  it('un alias antiguo se rotula «Permisos antiguos» y sin permisos no hay insignias', () => {
    expect(byId(pintar([permiso()]), 'insignia-origen')!.textContent).toContain(
      'Permisos antiguos',
    );
    const vacio = pintar([]);
    expect(vacio.querySelector('[data-testid^="insignia-"]')).toBeNull();
  });

  it('las condiciones se leen en la propia insignia (no solo en un globo)', () => {
    const host = pintar([
      permiso({
        origin: 'ATOM',
        atoms: ['billing.payment.collect'],
        conditionsSummary: 'Solo de lunes a viernes.',
      }),
    ]);
    expect(byId(host, 'insignia-condiciones-texto')!.textContent).toContain(
      'Solo de lunes a viernes.',
    );
  });
});
