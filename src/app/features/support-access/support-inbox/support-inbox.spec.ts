import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommunityClient } from '../../../core/data-access/community/community.client';
import { DelegatedAccessClient } from '../../../core/data-access/delegated-access/delegated-access.client';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportEngagement } from '../../../core/data-access/support-access/support-access.types';
import type { SupportConversation, SupportInboxItem, SupportInboxPage } from '../../../core/data-access/support-access/support-inbox.types';
import { SupportInbox } from './support-inbox';

const hace = (minutos: number): string => new Date(Date.now() - minutos * 60_000).toISOString();
const dentro = (minutos: number): string => new Date(Date.now() + minutos * 60_000).toISOString();

const VINCULO = (tenantId: string, nombre: string): SupportEngagement =>
  ({ id: `e-${tenantId}`, tenantId, organizationName: nombre, status: 'ACTIVE', roleTemplate: 'SECRETARY', grants: [] }) as unknown as SupportEngagement;

function item(id: string, parcial: Partial<SupportInboxItem> = {}): SupportInboxItem {
  return {
    conversationId: id,
    organizationId: 't-1',
    organizationName: 'Hospital Piloto Mantra',
    practitionerProfileId: 'h-perez',
    doctorPublicProfileId: 'pub-perez',
    practitionerName: 'Dr. Andrés Pérez',
    patientLabel: `Paciente ${id}`,
    lastMessagePreview: `Mensaje de ${id}`,
    lastMessageAt: hace(30),
    status: 'NEW',
    assignedToMe: false,
    isClinical: false,
    ...parcial,
  };
}

const PAGINA: SupportInboxPage = {
  doctors: [
    { id: 'r-perez', practitionerProfileId: 'h-perez', name: 'Dr. Andrés Pérez', specialty: 'Cardiología' },
    { id: 'r-rojas', practitionerProfileId: 'h-rojas', name: 'Dra. Valeria Rojas', specialty: 'Ginecología' },
  ],
  items: [
    item('lejos', { slaDueAt: dentro(180) }),
    item('vencida', { slaDueAt: hace(25), isClinical: true }),
    item('pronto', { slaDueAt: dentro(20) }),
    item('rojas', { practitionerProfileId: 'h-rojas', practitionerName: 'Dra. Valeria Rojas', slaDueAt: dentro(60) }),
    item('mia', { status: 'TAKEN', assignedToMe: true, assignedToName: 'Ana Gutiérrez', slaDueAt: dentro(40) }),
    item('ajena', { status: 'TAKEN', assignedToName: 'Mariela Soliz', slaDueAt: dentro(50) }),
    item('derivada', { status: 'WAITING_DOCTOR', assignedToMe: true, isClinical: true, slaDueAt: dentro(90) }),
    item('hecha', { status: 'RESOLVED' }),
  ],
};

/** Lo mínimo que la conversación abierta necesita para dibujarse. */
const CONVERSACION: SupportConversation = {
  conversationId: 'lejos',
  organizationId: 't-1',
  organizationName: 'Hospital Piloto Mantra',
  practitionerProfileId: 'h-perez',
    doctorPublicProfileId: 'pub-perez',
  practitionerName: 'Dr. Andrés Pérez',
  practitionerSpecialty: 'Cardiología',
  patientLabel: 'Paciente lejos',
  status: 'NEW',
  assignedToMe: false,
  isClinical: false,
  replyDisclosure: 'SHOW',
  replyAllowed: true,
  assignableTo: [],
  messages: [],
  notes: [],
  patientContext: { clinicalAccess: 'NONE' },
};

function falla(status: number, code: string, message: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, message, timestamp: '', path: '' } });
}

describe('SupportInbox', () => {
  let fixture: ComponentFixture<SupportInbox>;
  let getSupportInbox: ReturnType<typeof vi.fn>;
  let assignConversation: ReturnType<typeof vi.fn>;
  let listMyEngagements: ReturnType<typeof vi.fn>;
  let router: Router;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => raiz().querySelector(`[data-testid="${id}"]`);
  const ids = (): string[] => [...raiz().querySelectorAll('[data-testid^="conv-"]')].map((el) => el.getAttribute('data-testid')!.slice(5));
  const pestana = (valor: string): HTMLElement => raiz().querySelector(`[data-testid="pestana-${valor}"]`) as HTMLElement;
  const rotulo = (valor: string): string => `${pestana(valor).querySelector('.pestana__rotulo')!.textContent} ${pestana(valor).querySelector('.pestana__cuenta')!.textContent}`;

  async function montar(opciones: { engagements?: SupportEngagement[]; inbox?: ReturnType<typeof vi.fn> } = {}): Promise<void> {
    getSupportInbox = opciones.inbox ?? vi.fn(() => of(PAGINA));
    assignConversation = vi.fn(() => of({ conversationId: 'lejos', status: 'TAKEN' }));
    listMyEngagements = vi.fn(() => of({ engagements: opciones.engagements ?? [VINCULO('t-1', 'Hospital Piloto Mantra')], requests: [] }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SupportAccessClient, useValue: { listMyEngagements, getSupportInbox, assignConversation, getSupportConversation: () => of(CONVERSACION), listReplyTemplates: () => of({ items: [] }) } },
        { provide: CommunityClient, useValue: {} },
        { provide: DelegatedAccessClient, useValue: {} },
      ],
    });
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(SupportInbox);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  describe('la lista', () => {
    beforeEach(() => montar());

    it('pide la bandeja de su organización', () => {
      expect(getSupportInbox).toHaveBeenCalledWith({ org: 't-1' });
    });

    it('cuenta cada pestaña y arranca en «Nuevos»', () => {
      expect(rotulo('NEW')).toBe('Nuevos 4');
      expect(rotulo('MINE')).toBe('Míos 1');
      expect(rotulo('TEAM')).toBe('Del equipo 1');
      expect(rotulo('WAITING_DOCTOR')).toBe('Esperando al doctor 1');
      expect(rotulo('RESOLVED')).toBe('Resueltos 1');
      expect(pestana('NEW').getAttribute('aria-selected')).toBe('true');
    });

    it('en «Nuevos» lo más atrasado va arriba: vencida, por vencer, y luego por plazo', () => {
      expect(ids()).toEqual(['vencida', 'pronto', 'rojas', 'lejos']);
    });

    it('cada pestaña muestra solo lo suyo', () => {
      pestana('MINE').click();
      fixture.detectChanges();
      expect(ids()).toEqual(['mia']);
      pestana('TEAM').click();
      fixture.detectChanges();
      expect(ids()).toEqual(['ajena']);
      expect(byId('dueno-ajena')!.textContent).toBe('Responsable: Mariela Soliz');
      pestana('WAITING_DOCTOR').click();
      fixture.detectChanges();
      expect(ids()).toEqual(['derivada']);
      pestana('RESOLVED').click();
      fixture.detectChanges();
      expect(ids()).toEqual(['hecha']);
    });

    it('lo clínico lleva la marca roja y lo vencido lo dice', () => {
      expect(byId('conv-vencida')!.querySelector('[data-testid="marca-clinico"]')).not.toBeNull();
      expect(byId('conv-pronto')!.querySelector('[data-testid="marca-clinico"]')).toBeNull();
      expect(byId('plazo-vencida')!.textContent).toContain('Vencida hace 25 min');
      expect(byId('plazo-vencida')!.getAttribute('data-plazo')).toBe('overdue');
    });

    it('filtra por doctor, y el filtro ofrece solo a los doctores con conversaciones', () => {
      const select = fixture.debugElement.query((d) => d.nativeElement === byId('bandeja-doctor'));
      select.triggerEventHandler('valueChange', 'h-rojas');
      fixture.detectChanges();
      expect(ids()).toEqual(['rojas']);
      select.triggerEventHandler('valueChange', '');
      fixture.detectChanges();
      expect(ids()).toHaveLength(4);
    });

    it('con una sola organización no hay selector: se nombra la organización', () => {
      expect(byId('bandeja-organizacion')).toBeNull();
      expect(byId('bandeja-organizacion-nombre')!.textContent).toContain('Hospital Piloto Mantra');
    });

    it('«Tomar» desde la lista pide TAKEN, abre la conversación y vuelve a leer', async () => {
      const navegar = vi.spyOn(router, 'navigate');
      (byId('tomar-lejos') as HTMLElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(assignConversation).toHaveBeenCalledWith('lejos', { practitionerProfileId: 'h-perez', status: 'TAKEN' }, expect.objectContaining({ context: expect.anything() }));
      expect(getSupportInbox).toHaveBeenCalledTimes(2);
      expect(navegar).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { c: 'lejos' } }));
    });

    it('si otra persona la tomó antes, la pantalla lo dice con su nombre y relee', async () => {
      assignConversation.mockReturnValueOnce(throwError(() => falla(409, 'CONFLICT', 'Mariela Soliz ya tiene esta conversación.')));
      (byId('tomar-lejos') as HTMLElement).click();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(byId('bandeja-error')!.textContent).toContain('Mariela Soliz ya tiene esta conversación.');
      expect(getSupportInbox).toHaveBeenCalledTimes(2);
    });

    it('sin conversación abierta, invita a elegir una', () => {
      expect(byId('bandeja-sin-seleccion')).not.toBeNull();
    });
  });

  describe('varias organizaciones', () => {
    it('ofrece el selector y la bandeja se pide siempre acotada a la organización elegida', async () => {
      await montar({ engagements: [VINCULO('t-1', 'Hospital Piloto Mantra'), VINCULO('t-2', 'Clínica Norte'), VINCULO('t-1', 'Hospital Piloto Mantra')] });
      const select = fixture.debugElement.query((d) => d.nativeElement === byId('bandeja-organizacion'));
      expect(select).not.toBeNull();
      expect(getSupportInbox).toHaveBeenLastCalledWith({ org: 't-1' });
      select.triggerEventHandler('valueChange', 't-2');
      fixture.detectChanges();
      expect(getSupportInbox).toHaveBeenLastCalledWith({ org: 't-2' });
    });
  });

  describe('estados vacío, error y sin permiso', () => {
    it('sin vínculo de apoyo no hay bandeja: lo dice y lleva a «Mis accesos»', async () => {
      await montar({ engagements: [] });
      expect(raiz().textContent).toContain('No tiene un vínculo de apoyo activo');
      expect(raiz().querySelector('a[href="/my-support"]')).not.toBeNull();
      expect(getSupportInbox).not.toHaveBeenCalled();
    });

    it('una pestaña sin conversaciones lo dice con palabras de esa pestaña', async () => {
      await montar({ inbox: vi.fn(() => of({ ...PAGINA, items: [item('a')] })) });
      pestana('MINE').click();
      fixture.detectChanges();
      expect(byId('bandeja-vacia')!.textContent).toContain('No tiene conversaciones en curso');
      pestana('RESOLVED').click();
      fixture.detectChanges();
      expect(byId('bandeja-vacia')!.textContent).toContain('Todavía no hay conversaciones resueltas');
    });

    it('si el permiso no incluye mensajes, la API responde 403 y la página lo explica', async () => {
      await montar({ inbox: vi.fn(() => throwError(() => falla(403, 'FORBIDDEN', 'Su permiso en esta organización no incluye atender mensajes de pacientes.'))) });
      expect(raiz().textContent).toContain('No tiene acceso a esta sección');
      expect(raiz().textContent).toContain('no incluye atender mensajes de pacientes');
      expect(byId('bandeja')).toBeNull();
    });

    it('si falla la red, ofrece reintentar y vuelve a pedir', async () => {
      const inbox = vi.fn().mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 }))).mockReturnValue(of(PAGINA));
      await montar({ inbox });
      expect(byId('bandeja')).toBeNull();
      const reintentar = [...raiz().querySelectorAll('button')].find((b) => /reintentar/i.test(b.textContent ?? ''))!;
      reintentar.click();
      fixture.detectChanges();
      expect(inbox).toHaveBeenCalledTimes(2);
      expect(byId('bandeja')).not.toBeNull();
    });

    it('mientras carga no hay lista ni «sin conversaciones»', async () => {
      await montar({ inbox: vi.fn(() => NEVER) });
      expect(byId('bandeja-lista')).toBeNull();
      expect(byId('bandeja-vacia')).toBeNull();
    });
  });
});
