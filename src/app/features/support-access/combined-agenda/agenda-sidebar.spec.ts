import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { LocationNode } from '../../../core/data-access/support-access/support-access.types';
import { AgendaSidebar } from './agenda-sidebar';
import type { AgendaDoctor, AgendaOrg } from './agenda-model';

/**
 * El lateral de la agenda combinada: qué doctores se ven (con «Todos» y
 * «Ninguno» apagados cuando no cambian nada), el árbol de ubicaciones (con la
 * rama de la ubicación elegida siempre abierta) y qué mostrar. El lateral no
 * filtra: emite y la agenda decide.
 */

const ORGS: readonly AgendaOrg[] = [
  { id: 't-1', name: 'Clínica Sur', short: 'CS', tone: 0 } as AgendaOrg,
  { id: 't-2', name: 'Clínica Norte', short: 'CN', tone: 1 } as AgendaOrg,
];
const DOCTORES: readonly AgendaDoctor[] = [
  { id: 'd-1', name: 'Dra. Rojas', specialty: 'Pediatría', orgId: 't-1' },
  { id: 'd-2', name: 'Dr. Paz', specialty: 'Clínica', orgId: 't-2' },
];
const LUGARES: readonly LocationNode[] = [
  { id: 'sede', kind: 'SITE', name: 'Sede', parentId: null, path: 'sede' },
  { id: 'ed', kind: 'BUILDING', name: 'Edificio A', parentId: 'sede', path: 'sede/ed' },
  { id: 'p1', kind: 'LEVEL', name: 'Piso 1', parentId: 'ed', path: 'sede/ed/p1' },
  { id: 'c1', kind: 'CONSULTING_ROOM', name: 'Consultorio 1', parentId: 'p1', path: 'sede/ed/p1/c1' },
] as LocationNode[];

describe('AgendaSidebar', () => {
  let fixture: ComponentFixture<AgendaSidebar>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement = HTMLElement>(id: string): T | null => root().querySelector<T>(`[data-testid="${id}"]`);

  function pintar(extra: Record<string, unknown> = {}): void {
    fixture = TestBed.createComponent(AgendaSidebar);
    const base: Record<string, unknown> = {
      date: new Date('2026-10-31T12:00:00Z'),
      today: new Date('2026-10-31T12:00:00Z'),
      orgs: ORGS,
      orgOptions: ORGS.map((o) => ({ value: o.id, label: o.name })),
      doctors: DOCTORES,
      hidden: new Set<string>(),
      locations: LUGARES,
      serviceOptions: [{ value: '', label: 'Todos los servicios' }],
      ...extra,
    };
    for (const [k, v] of Object.entries(base)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  }

  it('cuenta los doctores visibles; con todos visibles «Todos» está apagado', () => {
    pintar();
    expect(root().querySelector('.bloque__cuenta')?.textContent?.trim()).toBe('2 de 2');
    expect(q<HTMLButtonElement>('doctores-todos')!.disabled).toBe(true);
    expect(q<HTMLButtonElement>('doctores-ninguno')!.disabled).toBe(false);
  });

  it('ocultar un doctor emite su id; «Todos» y «Ninguno» emiten su intención', () => {
    pintar({ hidden: new Set(['d-2']) });
    const toggles: string[] = [];
    const todos: boolean[] = [];
    fixture.componentInstance.doctorToggle.subscribe((id) => toggles.push(id));
    fixture.componentInstance.allDoctors.subscribe((v) => todos.push(v));

    expect(q<HTMLInputElement>('doctor-visible-d-2')!.checked).toBe(false);
    q<HTMLInputElement>('doctor-visible-d-1')!.dispatchEvent(new Event('change'));
    q('doctores-todos')!.click();
    expect(toggles).toEqual(['d-1']);
    expect(todos).toEqual([true]);
  });

  it('con varias organizaciones agrupa los doctores por organización', () => {
    pintar({ multiOrg: true });
    expect(Array.from(root().querySelectorAll('.grupo-org')).map((p) => p.textContent?.trim())).toEqual(['CS Clínica Sur', 'CN Clínica Norte']);
    expect(root().textContent).toContain('Cada cita lleva la sigla de su organización.');
  });

  it('sin doctores lo dice', () => {
    pintar({ doctors: [] });
    expect(root().textContent).toContain('Ninguno todavía.');
    expect(q('doctores-todos')).toBeNull();
  });

  it('el árbol arranca abierto hasta 3 niveles; plegar oculta la rama', () => {
    pintar();
    expect(q('ubicacion-c1')).not.toBeNull();
    const abrir = root().querySelector<HTMLButtonElement>('[aria-label="Cerrar Edificio A"]')!;
    expect(abrir.getAttribute('aria-expanded')).toBe('true');
    abrir.click();
    fixture.detectChanges();
    expect(q('ubicacion-p1')).toBeNull();
    expect(root().querySelector('[aria-label="Abrir Edificio A"]')).not.toBeNull();
  });

  it('elegir una ubicación la emite; la elegida se marca y su rama no se puede ocultar', () => {
    pintar({ locationId: 'c1' });
    expect(q('ubicacion-c1')!.getAttribute('aria-pressed')).toBe('true');
    expect(q('ubicacion-todas')!.getAttribute('aria-pressed')).toBe('false');
    root().querySelector<HTMLButtonElement>('[aria-label="Cerrar Edificio A"]')!.click();
    fixture.detectChanges();
    expect(q('ubicacion-c1')).not.toBeNull();

    const elegidas: (string | null)[] = [];
    fixture.componentInstance.locationChange.subscribe((id) => elegidas.push(id));
    q('ubicacion-todas')!.click();
    expect(elegidas).toEqual([null]);
  });

  it('«Qué mostrar» emite el nuevo valor de cada interruptor', () => {
    pintar();
    const libres: boolean[] = [];
    fixture.componentInstance.showFreeChange.subscribe((v) => libres.push(v));
    const casilla = q<HTMLInputElement>('agenda-ver-libres')!;
    casilla.checked = false;
    casilla.dispatchEvent(new Event('change'));
    expect(libres).toEqual([false]);
  });
});
