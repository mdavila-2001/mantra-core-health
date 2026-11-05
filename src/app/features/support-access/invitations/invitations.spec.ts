import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type {
  AffiliationInvitation,
  NewAffiliationInvitation,
} from '../../../core/data-access/support-access/support-access.types';
import { Invitations } from './invitations';

/**
 * F6 (revisión de seguridad del front): un código de invitación es un **secreto de portador**. La pantalla no puede dar a
 * entender que está atado a alguien: el destinatario no viaja a la API ni se guarda, así que quien tenga el código puede
 * usarlo hasta que venza o se agote.
 */
describe('Invitations', () => {
  let fixture: ComponentFixture<Invitations>;
  let createInvitation: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);

  const EMITIDA: AffiliationInvitation = {
    id: 'inv-1',
    kind: 'SUPPORT_STAFF',
    maxUses: 1,
    usesCount: 0,
    expiresAt: '2026-11-14T00:00:00Z',
    roleTemplate: 'SECRETARY',
    status: 'ACTIVE',
    createdAt: '2026-10-31T00:00:00Z',
    code: 'c'.repeat(32),
  };

  async function abrir(): Promise<void> {
    createInvitation = vi.fn((_: NewAffiliationInvitation) => of(EMITIDA));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupportAccessClient,
          useValue: { listInvitations: () => of({ items: [] }), createInvitation },
        },
      ],
    });
    fixture = TestBed.createComponent(Invitations);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('no pide ni muestra «a quién va dirigida»: esa etiqueta no se guarda ni restringe nada', async () => {
    await abrir();
    expect(byId('invitacion-destinatario')).toBeNull();
    expect(host().textContent).not.toMatch(/dirigid|para alguien concreto|queda anotado/i);
  });

  it('dice que el código es de portador: quien lo tenga lo puede usar hasta que venza o se agote', async () => {
    await abrir();
    const aviso = byId('invitacion-portador')?.textContent ?? '';
    expect(aviso).toContain('cualquiera que tenga este código');
    expect(aviso).toContain('hasta que venza o se agote');
  });

  it('un solo uso se emite sin pedir destinatario, y el resultado no rotula «para alguien»', async () => {
    await abrir();
    (byId('invitacion-emitir') as HTMLElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(createInvitation).toHaveBeenCalledOnce();
    expect(createInvitation.mock.calls[0]![0]).toMatchObject({ kind: 'SUPPORT_STAFF', maxUses: 1 });
    expect(createInvitation.mock.calls[0]![0]).not.toHaveProperty('targetPersonLabel');
    const resultado = byId('invitacion-resultado')?.textContent ?? '';
    expect(resultado).toContain('un solo uso');
    expect(resultado).not.toMatch(/ para /);
    expect(resultado).toContain('cualquiera que tenga este código');
  });
});
