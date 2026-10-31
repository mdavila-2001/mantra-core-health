import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CommunityClient } from '../../../core/data-access/community/community.client';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { SupportConversation } from '../../../core/data-access/support-access/support-inbox.types';
import { SupportConversationView } from './support-conversation';

function conversacion(parcial: Partial<SupportConversation> = {}): SupportConversation {
  return {
    conversationId: 'c-1',
    organizationId: 't-1',
    organizationName: 'Hospital Piloto Mantra',
    practitionerProfileId: 'h-perez',
    doctorPublicProfileId: 'pub-perez',
    practitionerName: 'Dr. Andrés Pérez',
    practitionerSpecialty: 'Cardiología',
    patientLabel: 'Ana Lucía Pérez',
    status: 'NEW',
    assignedToMe: false,
    slaDueAt: '2026-10-30T13:35:00.000Z',
    isClinical: false,
    replyDisclosure: 'SHOW',
    replyAllowed: true,
    assignableTo: [
      { userId: 'u-ana', name: 'Ana Gutiérrez' },
      { userId: 'u-mariela', name: 'Mariela Soliz' },
    ],
    messages: [{ id: 'm-1', from: 'PATIENT', bodyText: '¿Puedo cambiar mi cita del jueves?', sentAt: '2026-10-30T11:25:00.000Z', isClinical: false }],
    notes: [],
    patientContext: { reasonLabel: 'Control de presión arterial', clinicalAccess: 'NONE', delegateId: 'dl-1', patientProfileId: 'p-1', requestedPermissionId: 'perm-1' },
    ...parcial,
  };
}

function falla(status: number, code: string, message: string): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: { code, message, timestamp: '', path: '' } });
}

@Component({
  imports: [SupportConversationView],
  template: `<app-support-conversation [conversationId]="id()" org="t-1" [now]="ahora" (changed)="cambios.push(1)" (closed)="cierres.push(1)" />`,
})
class Host {
  readonly id = signal('c-1');
  readonly ahora = new Date('2026-10-30T12:00:00.000Z');
  readonly cambios: number[] = [];
  readonly cierres: number[] = [];
}

describe('SupportConversationView', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let actual: SupportConversation;
  let getSupportConversation: ReturnType<typeof vi.fn>;
  let assignConversation: ReturnType<typeof vi.fn>;
  let addInternalNote: ReturnType<typeof vi.fn>;
  let sendMessage: ReturnType<typeof vi.fn>;
  let requestClinicalAccess: ReturnType<typeof vi.fn>;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => raiz().querySelector(`[data-testid="${id}"]`);
  const activarCorreo = (): void => {
    (byId('correo-interruptor')!.querySelector('input') as HTMLInputElement).click();
    fixture.detectChanges();
  };
  const clic = (id: string): void => {
    (byId(id) as HTMLElement).click();
    fixture.detectChanges();
  };
  const escribir = (id: string, texto: string): void => {
    const campo = byId(id)!.querySelector('textarea')!;
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  function montar(inicial: SupportConversation): void {
    actual = inicial;
    getSupportConversation = vi.fn(() => of(actual));
    assignConversation = vi.fn(() => of({ conversationId: 'c-1', status: 'TAKEN' }));
    addInternalNote = vi.fn(() => of({ id: 'n-1' }));
    sendMessage = vi.fn(() => of({ id: 'm-2', conversationId: 'c-1' }));
    requestClinicalAccess = vi.fn(() => of({ id: 'a-1' }));
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [
        provideRouter([]),
        { provide: SupportAccessClient, useValue: { requestClinicalAccess, getSupportConversation, assignConversation, addInternalNote, listReplyTemplates: () => of({ items: [{ id: 't-1', category: 'GENERAL', title: 'Recibimos su mensaje', bodyText: 'Hola {paciente}, recibimos su mensaje.' }] }) } },
        { provide: CommunityClient, useValue: { sendMessage } },
      ],
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('lo que se ve', () => {
    beforeEach(() => montar(conversacion()));

    it('lee la conversación de la organización y la dibuja con su paciente, doctor y estado', () => {
      expect(getSupportConversation).toHaveBeenCalledWith('c-1', 't-1');
      expect(byId('conversacion-paciente')!.textContent).toContain('Ana Lucía Pérez');
      expect(raiz().textContent).toContain('Dr. Andrés Pérez');
      expect(raiz().textContent).toContain('Cardiología');
      expect(byId('conversacion-estado')!.textContent).toContain('Nueva');
      expect(byId('conversacion-dueno')!.textContent).toBe('Sin responsable');
      expect(byId('conversacion-plazo')!.textContent).toContain('Vence en 1 h 35 min');
    });

    it('el aviso de «Está respondiendo como» está siempre y el botón principal dice «Enviar como Dr. Andrés Pérez»', () => {
      expect(byId('aviso-en-nombre')!.textContent).toContain('Está respondiendo como Dr. Andrés Pérez.');
      expect(byId('enviar-respuesta')!.textContent!.trim()).toBe('Enviar como Dr. Andrés Pérez');
    });

    it('«Reprogramar cita» lleva a la agenda combinada', () => {
      const enlace = byId('conv-reprogramar') as HTMLAnchorElement;
      expect(enlace.tagName).toBe('A');
      expect(enlace.getAttribute('href')).toBe('/combined-agenda');
    });

    it('el contexto del paciente muestra solo el motivo de consulta y ofrece pedir el acceso clínico', () => {
      expect(byId('contexto-motivo')!.textContent).toContain('Control de presión arterial');
      expect(byId('contexto-paciente')!.textContent).toContain('Por defecto, solo el motivo de consulta');
      expect(byId('acceso-pedir')).not.toBeNull();
    });

    it('al abrirla, el foco pasa al título de la conversación; al releerla después de una acción, no se mueve', async () => {
      await fixture.whenStable();
      expect(document.activeElement).toBe(byId('conversacion-paciente'));
      (byId('conversacion-paciente') as HTMLElement).blur();
      clic('conv-tomar');
      await fixture.whenStable();
      expect(document.activeElement).not.toBe(byId('conversacion-paciente'));
    });

    it('«Volver a la bandeja» avisa para que la lista vuelva a verse en pantallas angostas', () => {
      clic('conversacion-volver');
      expect(host.cierres).toHaveLength(1);
    });
  });

  describe('tomar, asignar, derivar y resolver', () => {
    it('«Tomar» pide TAKEN sin nombrar a nadie (la API asigna a quien pide) y vuelve a leer', () => {
      montar(conversacion());
      actual = conversacion({ status: 'TAKEN', assignedToMe: true });
      clic('conv-tomar');
      expect(assignConversation).toHaveBeenCalledWith('c-1', { practitionerProfileId: 'h-perez', status: 'TAKEN' }, expect.objectContaining({ context: expect.anything() }));
      expect(getSupportConversation).toHaveBeenCalledTimes(2);
      expect(host.cambios).toHaveLength(1);
      expect(byId('conversacion-dueno')!.textContent).toBe('Responsable: usted');
      expect(byId('conv-tomar')).toBeNull();
      expect(byId('conversacion-anuncio')!.textContent).toBe('Conversación tomada.');
    });

    it('«Asignar» pide TAKEN con la persona elegida', () => {
      montar(conversacion());
      expect(byId('conv-asignar-aplicar')!.getAttribute('aria-disabled')).toBe('true');
      // El select se alimenta del equipo que la API dice que puede atender a este doctor.
      const componente = fixture.debugElement.query((d) => d.nativeElement === byId('conv-asignar-select'));
      componente.triggerEventHandler('valueChange', 'u-mariela');
      fixture.detectChanges();
      clic('conv-asignar-aplicar');
      expect(assignConversation).toHaveBeenCalledWith('c-1', { practitionerProfileId: 'h-perez', status: 'TAKEN', assignedUserId: 'u-mariela' }, expect.objectContaining({ context: expect.anything() }));
    });

    it('si otra persona se adelantó, la API responde 409 y la pantalla dice quién la tiene', () => {
      montar(conversacion());
      assignConversation.mockReturnValueOnce(throwError(() => falla(409, 'CONFLICT', 'Mariela Soliz ya tiene esta conversación.')));
      actual = conversacion({ status: 'TAKEN', assignedToName: 'Mariela Soliz' });
      clic('conv-tomar');
      expect(byId('conversacion-error')!.textContent).toContain('Mariela Soliz ya tiene esta conversación.');
      expect(byId('conversacion-dueno')!.textContent).toBe('Responsable: Mariela Soliz');
      expect(byId('conv-tomar')).toBeNull();
      expect(host.cambios).toHaveLength(1);
    });

    it('«Derivar al doctor» pide WAITING_DOCTOR', () => {
      montar(conversacion({ status: 'TAKEN', assignedToMe: true }));
      clic('conv-derivar');
      expect(assignConversation).toHaveBeenCalledWith('c-1', { practitionerProfileId: 'h-perez', status: 'WAITING_DOCTOR' }, expect.objectContaining({ context: expect.anything() }));
    });

    it('«Resolver» pide RESOLVED, «Liberar» la deja sin responsable y «Reabrir» la vuelve a tomar', () => {
      montar(conversacion({ status: 'TAKEN', assignedToMe: true }));
      clic('conv-resolver');
      expect(assignConversation).toHaveBeenLastCalledWith('c-1', { practitionerProfileId: 'h-perez', status: 'RESOLVED' }, expect.objectContaining({ context: expect.anything() }));
      clic('conv-liberar');
      expect(assignConversation).toHaveBeenLastCalledWith('c-1', { practitionerProfileId: 'h-perez', status: 'NEW' }, expect.objectContaining({ context: expect.anything() }));
      actual = conversacion({ status: 'RESOLVED' });
      host.id.set('c-2');
      fixture.detectChanges();
      clic('conv-reabrir');
      expect(assignConversation).toHaveBeenLastCalledWith('c-1', { practitionerProfileId: 'h-perez', status: 'TAKEN' }, expect.objectContaining({ context: expect.anything() }));
    });

    it('lo que tiene otra persona no ofrece ninguna acción de asignación', () => {
      montar(conversacion({ status: 'TAKEN', assignedToMe: false, assignedToName: 'Mariela Soliz' }));
      for (const id of ['conv-tomar', 'conv-derivar', 'conv-resolver', 'conv-liberar', 'conv-reabrir', 'conv-asignar']) {
        expect(byId(id), id).toBeNull();
      }
      expect(byId('conv-reprogramar')).not.toBeNull();
    });
  });

  describe('mensaje clínico', () => {
    beforeEach(() => montar(conversacion({ isClinical: true, messages: [{ id: 'm-1', from: 'PATIENT', bodyText: 'Me duele el pecho', sentAt: '2026-10-30T11:25:00.000Z', isClinical: true }] })));

    it('lo marca en rojo y el principal es derivar; la acción de la barra no se duplica', () => {
      expect(byId('conversacion-clinica')).not.toBeNull();
      expect(byId('mensaje-clinico')).not.toBeNull();
      expect(byId('derivar-principal')!.classList.contains('btn--primary')).toBe(true);
      expect(byId('conv-derivar')).toBeNull();
      expect(byId('enviar-respuesta')!.getAttribute('aria-disabled')).toBe('true');
    });

    it('derivar desde el compositor pide WAITING_DOCTOR y no envía nada al paciente', () => {
      clic('derivar-principal');
      expect(assignConversation).toHaveBeenCalledWith('c-1', { practitionerProfileId: 'h-perez', status: 'WAITING_DOCTOR' }, expect.objectContaining({ context: expect.anything() }));
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('responder en nombre del doctor', () => {
    beforeEach(() => montar(conversacion({ status: 'TAKEN', assignedToMe: true })));

    it('envía con el perfil PÚBLICO del doctor como remitente y como «en nombre de» (no el profesional); vuelve a leer y vacía el borrador', () => {
      escribir('compositor-texto', 'Le confirmamos el jueves a las 15:30.');
      actual = conversacion({
        status: 'TAKEN',
        assignedToMe: true,
        messages: [
          { id: 'm-1', from: 'PATIENT', bodyText: '¿Puedo cambiar mi cita del jueves?', sentAt: '2026-10-30T11:25:00.000Z', isClinical: false },
          { id: 'm-2', from: 'DOCTOR_SIDE', bodyText: 'Le confirmamos el jueves a las 15:30.', sentAt: '2026-10-30T12:00:00.000Z', isClinical: false, authoredByName: 'Ana Gutiérrez', disclosureShown: true },
        ],
      });
      clic('enviar-respuesta');
      expect(sendMessage).toHaveBeenCalledWith('c-1', { senderProfileId: 'pub-perez', bodyText: 'Le confirmamos el jueves a las 15:30.', onBehalfOfProfileId: 'pub-perez' }, expect.objectContaining({ context: expect.anything() }));
      expect(byId('autora-real')!.textContent).toContain('Respondió Ana Gutiérrez en nombre de Dr. Andrés Pérez.');
      expect(byId('compositor-texto')!.querySelector('textarea')!.value).toBe('');
      expect(host.cambios).toHaveLength(1);
    });

    it('con «También por correo» manda los canales CHAT y EMAIL y cuenta que el correo quedó en cola', () => {
      sendMessage.mockReturnValueOnce(of({ id: 'm-3', conversationId: 'c-1', email: { queued: true, requestId: 'r-1' } }));
      escribir('compositor-texto', 'Le confirmamos el jueves a las 15:30.');
      activarCorreo();
      clic('enviar-respuesta');
      expect(sendMessage).toHaveBeenCalledWith('c-1', {
        senderProfileId: 'pub-perez',
        bodyText: 'Le confirmamos el jueves a las 15:30.',
        onBehalfOfProfileId: 'pub-perez',
        channels: ['CHAT', 'EMAIL'],
      }, expect.objectContaining({ context: expect.anything() }));
      expect(raiz().textContent).toContain('El correo quedó en cola.');
    });

    it('si el paciente no tiene correo, la respuesta salió por el chat y se dice por qué no hubo correo', () => {
      sendMessage.mockReturnValueOnce(of({ id: 'm-4', conversationId: 'c-1', email: { queued: false, skippedReason: 'La cuenta del paciente no tiene un correo verificado con credencial activa' } }));
      escribir('compositor-texto', 'Le confirmamos el jueves.');
      activarCorreo();
      clic('enviar-respuesta');
      expect(raiz().textContent).not.toContain('El correo quedó en cola.');
      expect(raiz().textContent).toContain('La cuenta del paciente no tiene un correo verificado con credencial activa');
      expect(raiz().textContent).toContain('salió por el chat');
    });

    it('si la API lo rechaza, dice el motivo y conserva lo escrito', () => {
      sendMessage.mockReturnValueOnce(throwError(() => falla(403, 'FORBIDDEN', 'La Dra. Rojas todavía no le autorizó a responder en su nombre.')));
      escribir('compositor-texto', 'Hola');
      clic('enviar-respuesta');
      expect(byId('compositor-error')!.textContent).toContain('todavía no le autorizó');
      expect(byId('compositor-texto')!.querySelector('textarea')!.value).toBe('Hola');
    });

    it('una plantilla se inserta con el nombre del paciente', () => {
      clic('plantillas-abrir');
      clic('plantilla-t-1');
      expect(byId('compositor-texto')!.querySelector('textarea')!.value).toBe('Hola Ana, recibimos su mensaje.');
    });

    it('la nota interna va a la ruta de notas y nunca a la del chat', () => {
      (raiz().querySelector('[data-value="NOTE"]') as HTMLElement).click();
      fixture.detectChanges();
      escribir('compositor-texto', 'Llamar a caja.');
      clic('guardar-nota');
      expect(addInternalNote).toHaveBeenCalledWith('c-1', { bodyText: 'Llamar a caja.' }, expect.objectContaining({ context: expect.anything() }));
      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('acceso clínico temporal (caso 10)', () => {
    it('se pide al doctor con el motivo; mientras decide, la pantalla lo dice', () => {
      montar(conversacion());
      clic('acceso-pedir');
      expect(byId('acceso-enviar')!.getAttribute('aria-disabled')).toBe('true');
      escribir('acceso-motivo', 'Necesito el informe del electrocardiograma para el seguro.');
      actual = conversacion({ patientContext: { reasonLabel: 'Control', clinicalAccess: 'PENDING', delegateId: 'dl-1', patientProfileId: 'p-1', requestedPermissionId: 'perm-1' } });
      clic('acceso-enviar');
      // `POST /me/support-access-requests`: la organización, el doctor (su perfil profesional), el paciente y el motivo.
      expect(requestClinicalAccess).toHaveBeenCalledWith({
        tenantId: 't-1',
        practitionerProfileId: 'h-perez',
        patientProfileId: 'p-1',
        reasonText: 'Necesito el informe del electrocardiograma para el seguro.',
      });
      expect(byId('acceso-pendiente')!.textContent).toContain('todavía no decidió');
      expect(byId('acceso-pedir')).toBeNull();
    });

    it('sin ficha de paciente en la organización no hay a quién pedirle el acceso: la pantalla lo dice y no ofrece pedirlo', () => {
      montar(conversacion({ patientContext: { clinicalAccess: 'NONE' } }));
      expect(byId('acceso-pedir')).toBeNull();
      expect(byId('acceso-sin-paciente')!.textContent).toContain('no tiene ficha');
    });

    it('con el acceso autorizado lo dice y no vuelve a pedirlo', () => {
      montar(conversacion({ patientContext: { clinicalAccess: 'APPROVED' } }));
      expect(byId('acceso-aprobado')!.textContent).toContain('autorizó un acceso clínico temporal');
      expect(byId('acceso-pedir')).toBeNull();
    });
  });

  describe('contenido clínico oculto', () => {
    const MARCADOR = 'Contenido clínico oculto: requiere acceso clínico temporal aprobado.';
    const conOculto = (acceso: 'NONE' | 'PENDING' | 'APPROVED' = 'NONE'): SupportConversation =>
      conversacion({
        isClinical: true,
        messages: [
          { id: 'm-1', from: 'PATIENT', bodyText: '¿Puedo cambiar mi cita del jueves?', sentAt: '2026-10-30T11:25:00.000Z', isClinical: false },
          { id: 'm-2', from: 'PATIENT', bodyText: MARCADOR, sentAt: '2026-10-30T11:30:00.000Z', isClinical: true, contentHidden: true },
          { id: 'm-3', from: 'DOCTOR_SIDE', bodyText: MARCADOR, sentAt: '2026-10-30T11:40:00.000Z', isClinical: true, contentHidden: true },
        ],
        patientContext: { reasonLabel: 'Control', clinicalAccess: acceso, delegateId: 'dl-1', patientProfileId: 'p-1', requestedPermissionId: 'perm-1' },
      });

    it('en lugar del texto muestra un estado visible «Contenido clínico oculto» y no imprime el marcador', () => {
      montar(conOculto());
      expect(byId('oculto-m-2')!.textContent).toContain('Contenido clínico oculto');
      expect(byId('oculto-m-2')!.textContent).toContain('acceso clínico temporal');
      // Ronda 2 de la API (G1): se dice POR QUÉ no se lee y que no es un fallo, no solo «oculto».
      expect(byId('oculto-m-2')!.textContent).toContain('no tiene cita en la agenda de');
      expect(byId('oculto-m-2')!.textContent).toContain('No es un error');
      expect(byId('oculto-m-3')).not.toBeNull();
      expect(byId('mensaje-m-2')!.querySelector('.burbuja__texto')).toBeNull();
      expect(byId('mensaje-m-2')!.textContent).not.toContain('requiere acceso clínico temporal aprobado.');
      // Lo administrativo se lee siempre.
      expect(byId('mensaje-m-1')!.textContent).toContain('¿Puedo cambiar mi cita del jueves?');
      expect(byId('oculto-m-1')).toBeNull();
    });

    it('el botón «Pedir acceso a la historia clínica» del estado abre el pedido al doctor', () => {
      montar(conOculto());
      expect(byId('acceso-motivo')).toBeNull();
      clic('oculto-pedir-m-2');
      expect(byId('acceso-motivo')).not.toBeNull();
      escribir('acceso-motivo', 'Necesito leer lo que escribió el paciente.');
      clic('acceso-enviar');
      expect(requestClinicalAccess).toHaveBeenCalledWith(expect.objectContaining({ reasonText: 'Necesito leer lo que escribió el paciente.' }));
    });

    it('con el pedido pendiente no ofrece pedirlo otra vez y dice que el doctor decide', () => {
      montar(conOculto('PENDING'));
      expect(byId('oculto-pedir-m-2')).toBeNull();
      expect(byId('oculto-pendiente-m-2')!.textContent).toContain('todavía no lo decidió');
    });

    it('con el acceso aprobado la API manda el texto completo y no hay estado oculto', () => {
      montar(conversacion({
        patientContext: { clinicalAccess: 'APPROVED' },
        messages: [{ id: 'm-2', from: 'PATIENT', bodyText: 'Tengo dolor de pecho desde ayer', sentAt: '2026-10-30T11:30:00.000Z', isClinical: true }],
      }));
      expect(byId('oculto-m-2')).toBeNull();
      expect(byId('mensaje-m-2')!.textContent).toContain('Tengo dolor de pecho desde ayer');
    });

    it('responder da 404 si la conversación ya no está en la bandeja: lo explica, relee y avisa a la lista', () => {
      montar(conversacion());
      sendMessage.mockReturnValueOnce(throwError(() => falla(404, 'NOT_FOUND', 'Conversación no encontrada.')));
      escribir('compositor-texto', 'Hola');
      clic('enviar-respuesta');
      expect(host.cambios.length).toBeGreaterThan(0);
      expect(getSupportConversation.mock.calls.length).toBeGreaterThan(1);
    });
  });

  describe('estados de la página', () => {
    it('sin permiso sobre la conversación, la página lo dice (403) y no muestra nada de ella', () => {
      actual = conversacion();
      TestBed.configureTestingModule({
        imports: [Host],
        providers: [
          provideRouter([]),
          { provide: SupportAccessClient, useValue: { getSupportConversation: () => throwError(() => falla(403, 'FORBIDDEN', 'No tiene un vínculo de apoyo vigente con esta organización.')), listReplyTemplates: () => of({ items: [] }) } },
          { provide: CommunityClient, useValue: {} },
        ],
      });
      fixture = TestBed.createComponent(Host);
      fixture.detectChanges();
      expect(raiz().textContent).toContain('No tiene acceso a esta sección');
      expect(raiz().textContent).toContain('No tiene un vínculo de apoyo vigente');
      expect(byId('conversacion')).toBeNull();
    });

    it('si falla la lectura ofrece reintentar, y las plantillas ausentes no tapan la conversación', () => {
      let intento = 0;
      actual = conversacion();
      TestBed.configureTestingModule({
        imports: [Host],
        providers: [
          provideRouter([]),
          { provide: SupportAccessClient, useValue: { getSupportConversation: () => (++intento === 1 ? throwError(() => new HttpErrorResponse({ status: 0 })) : of(actual)), listReplyTemplates: () => throwError(() => new HttpErrorResponse({ status: 500 })) } },
          { provide: CommunityClient, useValue: {} },
        ],
      });
      fixture = TestBed.createComponent(Host);
      fixture.detectChanges();
      expect(byId('conversacion')).toBeNull();
      expect(raiz().textContent).toContain('conexión');
      const reintentar = [...raiz().querySelectorAll('button')].find((b) => /reintentar/i.test(b.textContent ?? ''))!;
      reintentar.click();
      fixture.detectChanges();
      expect(byId('conversacion')).not.toBeNull();
      expect(byId('plantillas-abrir')).toBeNull();
    });
  });
});
