import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AccessExplainClient } from '../../../core/data-access/access-governance/access-explain.client';
import { AgendaReserved } from './agenda-reserved';
import type { AgendaEvent } from './agenda-model';

/**
 * El detalle de un bloque «Reservado» de la agenda combinada: dice que el
 * horario está ocupado **sin** nombrar paciente ni motivo (la API no los
 * manda a quien no puede verlos) y ofrece preguntar por qué, con el contexto
 * exacto del bloque.
 */

const BLOQUE = {
  id: 'blk-1',
  kind: 'BOOKING',
  start: '2026-10-31T14:00:00Z',
  end: '2026-10-31T14:30:00Z',
  practitionerRoleAssignmentId: 'pra-9',
  careSpaceId: 'cs-3',
  careSpaceName: 'Consultorio 3',
  serviceName: '',
  status: 'BOOKED',
  allowedActions: [],
  denialReason: 'RESERVED',
  orgId: 't-2',
  orgName: 'Clínica Norte',
  orgShort: 'CN',
  orgTone: 1,
  doctorName: 'Dra. Rojas',
  patientLabel: 'NO DEBE VERSE',
} as unknown as AgendaEvent;

describe('AgendaReserved', () => {
  let fixture: ComponentFixture<AgendaReserved>;
  let explainMine: ReturnType<typeof vi.fn>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    explainMine = vi.fn(() => of({ decision: { effect: 'DENY' }, summary: 'x', missing: [] }));
    TestBed.configureTestingModule({ providers: [{ provide: AccessExplainClient, useValue: { explainMine } }] });
    fixture = TestBed.createComponent(AgendaReserved);
    fixture.componentRef.setInput('event', BLOQUE);
    fixture.detectChanges();
  });

  it('se titula «Reservado» y explica que el detalle no está disponible', () => {
    expect(root().querySelector('[data-testid="panel-titulo"]')?.textContent?.trim()).toBe('Reservado');
    expect(root().querySelector('[data-testid="agenda-reservado-texto"]')?.textContent).toContain(
      'No se muestra quién es el paciente ni el motivo',
    );
  });

  it('muestra organización, doctor y lugar, pero nunca el paciente', () => {
    expect(root().textContent).toContain('Clínica Norte');
    expect(root().textContent).toContain('Dra. Rojas');
    expect(root().textContent).toContain('Consultorio 3');
    expect(root().textContent).not.toContain('NO DEBE VERSE');
  });

  it('«¿Por qué no puedo?» pregunta por ver esa cita, en ese tenant, doctor, lugar y hora', () => {
    root().querySelector<HTMLElement>('[data-testid="agenda-por-que-boton"]')!.click();
    expect(explainMine).toHaveBeenCalledWith({
      tenantId: 't-2',
      action: 'agenda.appointment.view',
      practitionerRoleAssignmentId: 'pra-9',
      careSpaceId: 'cs-3',
      appointmentStartAt: '2026-10-31T14:00:00Z',
    });
  });

  it('cerrar emite closed', () => {
    let cerrado = 0;
    fixture.componentInstance.closed.subscribe(() => (cerrado += 1));
    root().querySelector<HTMLElement>('[data-testid="agenda-reservado-cerrar"]')!.click();
    expect(cerrado).toBe(1);
  });
});
