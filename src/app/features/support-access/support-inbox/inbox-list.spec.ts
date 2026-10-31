import { Component, signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { SupportInboxDoctor, SupportInboxItem } from '../../../core/data-access/support-access/support-inbox.types';
import { doctorColor } from '../combined-agenda/agenda-grouping';
import { InboxList } from './inbox-list';

const AHORA = new Date('2026-10-30T12:00:00.000Z');
const enMin = (m: number): string => new Date(AHORA.getTime() + m * 60_000).toISOString();

const DOCTORES: SupportInboxDoctor[] = [
  { id: 'r-perez', practitionerProfileId: 'h-perez', name: 'Dr. Andrés Pérez', specialty: 'Cardiología' },
  { id: 'r-rojas', practitionerProfileId: 'h-rojas', name: 'Dra. Valeria Rojas', specialty: 'Ginecología' },
];

function item(id: string, parcial: Partial<SupportInboxItem> = {}): SupportInboxItem {
  return {
    conversationId: id,
    organizationId: 't-1',
    organizationName: 'Hospital Piloto',
    practitionerProfileId: 'h-perez',
    doctorPublicProfileId: 'pub-perez',
    practitionerName: 'Dr. Andrés Pérez',
    patientLabel: 'Ana Lucía Pérez',
    lastMessagePreview: '¿Puedo cambiar mi cita?',
    lastMessageAt: enMin(-35),
    status: 'NEW',
    assignedToMe: false,
    isClinical: false,
    ...parcial,
  };
}

@Component({
  imports: [InboxList],
  template: `<app-inbox-list [items]="items()" [doctors]="doctores" [selectedId]="seleccionada()" [now]="ahora" [busyId]="ocupada()" (open)="abiertas.push($event)" (take)="tomadas.push($event)" />`,
})
class Host {
  readonly items = signal<readonly SupportInboxItem[]>([]);
  readonly seleccionada = signal<string | null>(null);
  readonly ocupada = signal<string | null>(null);
  readonly doctores = DOCTORES;
  readonly ahora = AHORA;
  readonly abiertas: string[] = [];
  readonly tomadas: string[] = [];
}

describe('InboxList', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  const raiz = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => raiz().querySelector(`[data-testid="${id}"]`);

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host], providers: [provideHttpClient(), provideHttpClientTesting()] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
  });

  function pintar(items: SupportInboxItem[], seleccionada: string | null = null): void {
    host.items.set(items);
    host.seleccionada.set(seleccionada);
    fixture.detectChanges();
  }

  it('cada fila dice quién escribió, un adelanto, el doctor y cuánto hace', () => {
    pintar([item('a')]);
    const fila = byId('conv-a')!;
    expect(fila.textContent).toContain('Ana Lucía Pérez');
    expect(fila.textContent).toContain('¿Puedo cambiar mi cita?');
    expect(fila.textContent).toContain('Dr. Andrés Pérez');
    expect(fila.textContent).toContain('hace 35 min');
  });

  it('la marca roja «Clínico» aparece solo en las que la API detectó como clínicas', () => {
    pintar([item('admin'), item('clinica', { isClinical: true })]);
    expect(byId('conv-admin')!.querySelector('[data-testid="marca-clinico"]')).toBeNull();
    const marca = byId('conv-clinica')!.querySelector('[data-testid="marca-clinico"]');
    expect(marca).not.toBeNull();
    expect(marca!.textContent).toContain('Clínico');
  });

  it('un adelanto con el marcador de contenido clínico oculto dice «Contenido clínico oculto» y no imprime el marcador', () => {
    const marcador = 'Contenido clínico oculto: requiere acceso clínico temporal aprobado.';
    pintar([
      item('vista', { isClinical: true, lastMessagePreview: marcador }),
      item('otra', { isClinical: true, lastMessagePreview: '', lastPatientMessage: marcador }),
      item('normal'),
    ]);
    for (const id of ['vista', 'otra']) {
      expect(byId(`oculto-${id}`)!.textContent).toContain('Contenido clínico oculto');
      expect(byId(`conv-${id}`)!.textContent).not.toContain('requiere acceso clínico temporal aprobado.');
    }
    expect(byId('oculto-normal')).toBeNull();
    expect(byId('conv-normal')!.textContent).toContain('¿Puedo cambiar mi cita?');
  });

  it('el plazo se dice con palabras: vence en, por vencer o vencida', () => {
    pintar([
      item('lejos', { slaDueAt: enMin(95) }),
      item('pronto', { slaDueAt: enMin(20) }),
      item('vencida', { slaDueAt: enMin(-25) }),
      item('resuelta', { status: 'RESOLVED', slaDueAt: enMin(-500) }),
    ]);
    expect(byId('plazo-lejos')!.textContent!.trim()).toBe('Vence en 1 h 35 min');
    expect(byId('plazo-lejos')!.getAttribute('data-plazo')).toBe('ok');
    expect(byId('plazo-pronto')!.getAttribute('data-plazo')).toBe('soon');
    expect(byId('plazo-vencida')!.textContent!.trim()).toBe('Vencida hace 25 min');
    expect(byId('plazo-vencida')!.getAttribute('data-plazo')).toBe('overdue');
    expect(byId('plazo-resuelta')).toBeNull();
  });

  it('dice quién tiene cada conversación, para que las demás lo vean', () => {
    pintar([
      item('libre'),
      item('mia', { status: 'TAKEN', assignedToMe: true }),
      item('ajena', { status: 'TAKEN', assignedToName: 'Mariela Soliz' }),
    ]);
    expect(byId('dueno-libre')!.textContent).toBe('Sin responsable');
    expect(byId('dueno-mia')!.textContent).toBe('Responsable: usted');
    expect(byId('dueno-ajena')!.textContent).toBe('Responsable: Mariela Soliz');
  });

  it('«Tomar» existe solo en las nuevas y avisa cuál se toma', () => {
    pintar([item('libre'), item('ajena', { status: 'TAKEN', assignedToName: 'Mariela Soliz' }), item('hecha', { status: 'RESOLVED' })]);
    expect(byId('tomar-ajena')).toBeNull();
    expect(byId('tomar-hecha')).toBeNull();
    byId('tomar-libre')!.click();
    expect(host.tomadas).toEqual(['libre']);
    expect(byId('tomar-libre')!.getAttribute('aria-label')).toBe('Tomar la conversación de Ana Lucía Pérez');
  });

  it('mientras se toma una, los «Tomar» se frenan', () => {
    pintar([item('a'), item('b')]);
    host.ocupada.set('a');
    fixture.detectChanges();
    expect(byId('tomar-a')!.getAttribute('aria-disabled')).toBe('true');
    expect(byId('tomar-b')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('abrir una fila avisa su id, y la abierta queda marcada', () => {
    pintar([item('a'), item('b')], 'b');
    byId('abrir-a')!.click();
    expect(host.abiertas).toEqual(['a']);
    expect(byId('abrir-b')!.getAttribute('aria-current')).toBe('true');
    expect(byId('abrir-a')!.getAttribute('aria-current')).toBeNull();
  });

  it('el color del doctor es el de la agenda combinada', () => {
    pintar([item('perez'), item('rojas', { practitionerProfileId: 'h-rojas', practitionerName: 'Dra. Valeria Rojas' })]);
    const comoAgenda = DOCTORES.map((d) => ({ id: d.practitionerProfileId, name: d.name, specialty: d.specialty }));
    for (const [id, doctor] of [['perez', 'h-perez'], ['rojas', 'h-rojas']] as const) {
      const fila = byId(`conv-${id}`)!;
      expect(fila.style.getPropertyValue('--doctor-color')).toBe(doctorColor(comoAgenda, doctor).borde);
      expect(fila.style.getPropertyValue('--doctor-fondo')).toBe(doctorColor(comoAgenda, doctor).fondo);
    }
    expect(byId('conv-perez')!.style.getPropertyValue('--doctor-color')).not.toBe(byId('conv-rojas')!.style.getPropertyValue('--doctor-color'));
  });

  describe('conversaciones «Reservado»', () => {
    it('sale como un bloque sin nombre ni texto, que no se abre, con «¿Por qué no puedo?» sobre esa bandeja', () => {
      pintar([item('r', { denialReason: 'RESERVED', patientLabel: 'Reservado', lastMessagePreview: '' }), item('n')]);
      const fila = byId('conv-r')!;
      expect(fila.textContent).toContain('Reservado');
      expect(fila.textContent).toContain('El contenido de esta conversación no está disponible para usted.');
      expect(fila.textContent).toContain('Dr. Andrés Pérez');
      expect(byId('abrir-r')).toBeNull();
      expect(byId('tomar-r')).toBeNull();
      expect(byId('por-que-r-boton')!.textContent).toContain('¿Por qué no puedo?');
      // Las demás siguen siendo conversaciones normales.
      expect(byId('abrir-n')).not.toBeNull();
      expect(byId('por-que-n-boton')).toBeNull();
    });

    it('«¿Por qué no puedo?» pregunta por esa organización y ese doctor, y muestra lo que la API dice en palabras', () => {
      pintar([item('r', { denialReason: 'RESERVED', patientLabel: 'Reservado', lastMessagePreview: '' })]);
      const http = TestBed.inject(HttpTestingController);
      byId('por-que-r-boton')!.click();
      fixture.detectChanges();

      const pedido = http.expectOne((r) => r.url.endsWith('/me/support-access/explain'));
      expect(pedido.request.body).toEqual({ tenantId: 't-1', action: 'messages.inbox.view', practitionerRoleAssignmentId: 'r-perez' });
      pedido.flush({ decision: { effect: 'DENY' }, summary: 'Esa conversación es de un paciente reservado.', missing: [], askAdmin: 'Pida a su administrador que le dé acceso.', reasons: [], obligations: {}, visibleFields: {}, evaluatedAt: '' });
      fixture.detectChanges();

      expect(byId('por-que-r-resumen')!.textContent).toContain('Esa conversación es de un paciente reservado.');
      expect(byId('por-que-r-admin')!.textContent).toContain('Pida a su administrador que le dé acceso.');
      http.verify();
    });
  });
});
