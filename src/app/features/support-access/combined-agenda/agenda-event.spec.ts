import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { AgendaEvent } from './agenda-model';
import { AgendaEventButton, type DragRole } from './agenda-event';

/**
 * Una celda de la agenda combinada (un `<button>`). Lo que se fija es qué dice
 * según lo que la API dejó ver: con `schedule.view` muestra paciente y estado;
 * sin él, «Sin permiso» atenuado y deshabilitado; un bloque `RESERVED` dice
 * «Reservado» y sigue activo para preguntar por qué. Sólo se arrastra lo que
 * la API permite reprogramar.
 */

function evento(partial: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id: 'ev-1',
    kind: 'BOOKING',
    start: '2026-10-31T14:00:00Z',
    end: '2026-10-31T14:30:00Z',
    practitionerRoleAssignmentId: 'pra-1',
    careSpaceId: 'cs-1',
    careSpaceName: 'Consultorio 1',
    serviceName: 'Clínica general',
    status: 'BOOKED',
    allowedActions: ['schedule.view'],
    patientLabel: 'Ana Pérez',
    orgId: 't-1',
    orgName: 'Clínica Sur',
    orgShort: 'CS',
    orgTone: 0,
    doctorName: 'Dr. Paz',
    ...partial,
  } as AgendaEvent;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AgendaEventButton],
  template: `<button app-agenda-event [event]="ev()" [color]="{ bg: '#fff', border: '#000' }" [multiOrg]="multi()" [compact]="compacta()" [selected]="sel()" [dragRole]="rol()">celda</button>`,
})
class Host {
  readonly ev = signal(evento());
  readonly multi = signal(false);
  readonly compacta = signal(false);
  readonly sel = signal(false);
  readonly rol = signal<DragRole>(null);
}

describe('AgendaEventButton', () => {
  let fixture: ComponentFixture<Host>;
  const celda = (): HTMLButtonElement => (fixture.nativeElement as HTMLElement).querySelector('button')!;

  function pintar(partial: Partial<AgendaEvent> = {}): void {
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.ev.set(evento(partial));
    fixture.detectChanges();
  }

  it('visible y reservada: paciente, doctor y lugar, «Por confirmar», y su etiqueta accesible', () => {
    pintar();
    expect(celda().getAttribute('type')).toBe('button');
    expect(celda().getAttribute('data-testid')).toBe('item-ev-1');
    expect(celda().querySelector('.celda__texto')?.textContent).toBe('Ana Pérez');
    expect(celda().querySelector('.celda__sub')?.textContent).toBe('Dr. Paz · Consultorio 1');
    expect(celda().querySelector('.celda__marca')?.textContent).toBe('Por confirmar');
    expect(celda().getAttribute('aria-label')).toContain('Reservada, por confirmar, Ana Pérez');
    expect(celda().hasAttribute('aria-disabled')).toBe(false);
  });

  it('sin permiso de ver: «Sin permiso», atenuada y deshabilitada, sin paciente', () => {
    pintar({ allowedActions: [], patientLabel: undefined, denialReason: 'Fuera de su horario' } as Partial<AgendaEvent>);
    expect(celda().querySelector('.celda__texto')?.textContent).toBe('Sin permiso');
    expect(celda().classList.contains('celda--atenuada')).toBe(true);
    expect(celda().getAttribute('aria-disabled')).toBe('true');
    expect(celda().getAttribute('aria-label')).toContain('Sin permiso: Fuera de su horario');
    expect(celda().querySelector('.celda__marca')).toBeNull();
  });

  it('un bloque RESERVED dice «Reservado» y queda activo para preguntar por qué', () => {
    pintar({ allowedActions: [], denialReason: 'RESERVED', patientLabel: undefined } as Partial<AgendaEvent>);
    expect(celda().querySelector('.celda__texto')?.textContent).toBe('Reservado');
    expect(celda().hasAttribute('aria-disabled')).toBe(false);
    expect(celda().getAttribute('aria-label')).toContain('Pulse para preguntar por qué');
  });

  it('libre: «Libre» y cuántos esperan', () => {
    pintar({ status: 'FREE', kind: 'SLOT', patientLabel: undefined, waitlistCount: 2 } as Partial<AgendaEvent>);
    expect(celda().querySelector('.celda__texto')?.textContent).toBe('Libre');
    expect(celda().querySelector('.celda__marca')?.textContent).toBe('2 en espera');
    expect(celda().classList.contains('celda--libre')).toBe(true);
  });

  it('se arrastra sólo si la API permite reprogramar', () => {
    pintar();
    expect(celda().hasAttribute('data-draggable')).toBe(false);
    pintar({ allowedActions: ['schedule.view', 'schedule.reschedule'] });
    expect(celda().getAttribute('data-draggable')).toBe('true');
    expect(celda().classList.contains('celda--arrastrable')).toBe(true);
  });

  it('seleccionada se anuncia presionada; con varias organizaciones muestra la sigla', () => {
    pintar();
    fixture.componentInstance.sel.set(true);
    fixture.componentInstance.multi.set(true);
    fixture.detectChanges();
    expect(celda().getAttribute('aria-pressed')).toBe('true');
    expect(celda().querySelector('.celda__org')?.textContent).toBe('CS');
    expect(celda().getAttribute('aria-label')).toContain('Clínica Sur');
  });

  it('compacta omite la segunda línea; el rol de arrastre se refleja en la clase', () => {
    pintar();
    fixture.componentInstance.compacta.set(true);
    fixture.componentInstance.rol.set('target-no');
    fixture.detectChanges();
    expect(celda().querySelector('.celda__sub')).toBeNull();
    expect(celda().classList.contains('celda--destino-no')).toBe(true);
  });
});
