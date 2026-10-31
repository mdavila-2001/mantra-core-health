import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { InternalNote, SupportConversationMessage } from '../../../core/data-access/support-access/support-inbox.types';
import { buildTimeline, ConversationTimeline } from './conversation-timeline';

const MENSAJES: SupportConversationMessage[] = [
  { id: 'm1', from: 'PATIENT', bodyText: '¿Puedo cambiar mi cita?', sentAt: '2026-10-30T10:00:00.000Z', isClinical: false },
  { id: 'm2', from: 'DOCTOR_SIDE', bodyText: 'Claro, le proponemos el jueves.', sentAt: '2026-10-30T10:30:00.000Z', isClinical: false, authoredByName: 'Ana Gutiérrez', disclosureShown: true },
  { id: 'm3', from: 'PATIENT', bodyText: 'Me duele el pecho', sentAt: '2026-10-30T11:00:00.000Z', isClinical: true },
  { id: 'm4', from: 'DOCTOR_SIDE', bodyText: 'Lo veo yo.', sentAt: '2026-10-30T11:30:00.000Z', isClinical: false },
  { id: 'm5', from: 'DOCTOR_SIDE', bodyText: 'Respuesta en silencio.', sentAt: '2026-10-30T11:40:00.000Z', isClinical: false, authoredByName: 'Mariela Soliz', disclosureShown: false },
];
const NOTAS: InternalNote[] = [{ id: 'n1', conversationId: 'c', authorName: 'Ana Gutiérrez', bodyText: 'Llamar a caja.', createdAt: '2026-10-30T10:15:00.000Z' }];

@Component({
  imports: [ConversationTimeline],
  template: `<app-conversation-timeline [messages]="mensajes" [notes]="notas" doctorName="Dr. Andrés Pérez" patientLabel="Ana Lucía Pérez" />`,
})
class Host {
  readonly mensajes = MENSAJES;
  readonly notas = NOTAS;
}

describe('buildTimeline', () => {
  it('junta mensajes y notas en el orden en que pasaron', () => {
    expect(buildTimeline(MENSAJES, NOTAS).map((e) => (e.kind === 'message' ? e.message.id : e.note.id))).toEqual(['m1', 'n1', 'm2', 'm3', 'm4', 'm5']);
  });
});

describe('ConversationTimeline', () => {
  function pintar(): HTMLElement {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  const byId = (raiz: HTMLElement, id: string): HTMLElement | null => raiz.querySelector(`[data-testid="${id}"]`);

  beforeEach(() => TestBed.configureTestingModule({ imports: [Host] }));

  it('el mensaje del equipo dice quién lo escribió de verdad y si el paciente ve el aviso', () => {
    const raiz = pintar();
    expect(byId(raiz, 'mensaje-m2')!.querySelector('[data-testid="autora-real"]')!.textContent).toContain('Respondió Ana Gutiérrez en nombre de Dr. Andrés Pérez.');
    expect(byId(raiz, 'mensaje-m2')!.textContent).toContain('El paciente ve «respondido por su equipo».');
    expect(byId(raiz, 'mensaje-m5')!.textContent).toContain('Respondió Mariela Soliz');
    expect(byId(raiz, 'mensaje-m5')!.textContent).toContain('El paciente no ve el aviso.');
  });

  it('lo que respondió el propio doctor no lleva autora real', () => {
    expect(byId(pintar(), 'mensaje-m4')!.querySelector('[data-testid="autora-real"]')).toBeNull();
  });

  it('la marca «Clínico» está solo en el mensaje que lo es', () => {
    const raiz = pintar();
    expect(byId(raiz, 'mensaje-m3')!.querySelector('[data-testid="mensaje-clinico"]')).not.toBeNull();
    expect(byId(raiz, 'mensaje-m1')!.querySelector('[data-testid="mensaje-clinico"]')).toBeNull();
    expect(byId(raiz, 'mensaje-m3')!.getAttribute('data-clinico')).toBe('true');
  });

  it('la nota interna tiene su propio estilo y dice que el paciente nunca la ve', () => {
    const nota = byId(pintar(), 'nota-n1')!;
    expect(nota.classList.contains('nota')).toBe(true);
    expect(nota.classList.contains('burbuja')).toBe(false);
    expect(nota.textContent).toContain('Nota interna');
    expect(nota.textContent).toContain('Solo el equipo la ve. El paciente nunca.');
    expect(nota.textContent).toContain('Llamar a caja.');
    expect(nota.textContent).toContain('Ana Gutiérrez');
  });

  it('quien habla se anuncia para el lector de pantalla', () => {
    const raiz = pintar();
    expect(byId(raiz, 'mensaje-m1')!.querySelector('.sr-only')!.textContent).toContain('Paciente');
    expect(byId(raiz, 'mensaje-m2')!.querySelector('.sr-only')!.textContent).toContain('Respuesta');
  });
});
