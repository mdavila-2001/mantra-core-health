import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ARISTAS_DEMO, NODOS_DEMO } from '../red-clinica.demo';
import { aplicarFiltro, FILTRO_VACIO, type FiltroDeRed } from '../red-clinica-filtro';
import { RedClinicaFiltros } from './red-clinica-filtros';

@Component({
  imports: [RedClinicaFiltros],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-red-clinica-filtros
      [nodos]="nodos"
      [(filtro)]="filtro"
      [visibles]="visibles().length"
      (filtroChange)="emitidos.push($event)"
    />
  `,
})
class Anfitrion {
  readonly nodos = NODOS_DEMO;
  readonly filtro = signal<FiltroDeRed>(FILTRO_VACIO);
  readonly visibles = computed(() => aplicarFiltro(this.nodos, this.filtro(), ARISTAS_DEMO));
  readonly emitidos: FiltroDeRed[] = [];
}

describe('RedClinicaFiltros', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let host: Anfitrion;
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const chips = () => Array.from(el().querySelectorAll<HTMLElement>('[data-testid="red-filtro-tipo"]'));
  const cuenta = () => el().querySelector('[data-testid="red-filtros-cuenta"]')?.textContent?.replace(/\s+/g, ' ').trim();

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('ofrece sólo los tipos presentes, en el orden canónico', () => {
    expect(chips().map((c) => c.textContent?.trim())).toEqual([
      'Citas',
      'Reconsultas',
      'Atenciones',
      'Diagnósticos',
      'Estudios',
      'Derivaciones',
      'Medicación',
    ]);
  });

  it('sin filtros resume el total y no ofrece «Limpiar»', () => {
    expect(cuenta()).toBe('14 registros en la historia');
    expect(el().querySelector('[data-testid="red-filtros-limpiar"]')).toBeNull();
  });

  it('un chip de tipo alterna el tipo en el filtro y emite', async () => {
    const diagnosticos = chips().find((c) => c.textContent?.includes('Diagnósticos'))!;
    // El chip seleccionable ES el botón (role=button en su host).
    diagnosticos.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.filtro().tipos).toEqual(['diagnostico']);
    expect(host.emitidos.at(-1)?.tipos).toEqual(['diagnostico']);
    expect(cuenta()).toBe('3 de 14 registros · 1 filtro aplicado');
  });

  it('«Limpiar filtros» vuelve al filtro vacío', async () => {
    host.filtro.set({ ...FILTRO_VACIO, texto: 'cefalea', tipos: ['atencion'] });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(cuenta()).toBe('2 de 14 registros · 2 filtros aplicados');
    el().querySelector<HTMLButtonElement>('[data-testid="red-filtros-limpiar"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.filtro()).toEqual(FILTRO_VACIO);
  });

  it('la búsqueda escribe el texto en el filtro', async () => {
    const input = el().querySelector<HTMLInputElement>('app-search-field input')!;
    input.value = 'méndez';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 400));
    fixture.detectChanges();
    expect(host.filtro().texto).toBe('méndez');
    expect(host.visibles().map((n) => n.id)).toEqual(['d1', 'a3', 'e3', 'dx3']);
  });

  it('el rango invertido se avisa en el campo, no se corrige en silencio', async () => {
    host.filtro.set({ ...FILTRO_VACIO, desde: new Date(2026, 9, 1), hasta: new Date(2026, 8, 1) });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el().textContent).toContain('La fecha «hasta» es anterior a «desde»');
    expect(host.filtro().desde?.getMonth()).toBe(9);
  });

  it('las opciones de especialidad, profesional e hilo salen de los nodos', () => {
    const cmp = fixture.debugElement.children[0].componentInstance as unknown as {
      opcionesDeEspecialidad: () => { label: string }[];
      opcionesDeProfesional: () => { label: string }[];
      opcionesDeHilo: () => { label: string; description?: string }[];
    };
    expect(cmp.opcionesDeEspecialidad().map((o) => o.label)).toEqual([
      'Todas las especialidades',
      'Cardiología',
      'Medicina general',
    ]);
    expect(cmp.opcionesDeProfesional().map((o) => o.label)).toEqual([
      'Todos los profesionales',
      'Dra. Ana Rojas',
      'Dr. Luis Méndez',
    ]);
    expect(cmp.opcionesDeHilo()[0].label).toBe('Toda la historia');
    expect(cmp.opcionesDeHilo()[1]).toEqual(
      expect.objectContaining({ label: 'Hipertrofia ventricular izquierda', description: 'En estudio' }),
    );
  });

  it('elegir «todas» en un desplegable vuelve el criterio a null', () => {
    const cmp = fixture.debugElement.children[0].componentInstance as unknown as {
      elegirEspecialidad: (v: string | null) => void;
      elegirHilo: (v: string | null) => void;
    };
    cmp.elegirEspecialidad('esp-cardio');
    expect(host.filtro().especialidadId).toBe('esp-cardio');
    cmp.elegirEspecialidad('');
    expect(host.filtro().especialidadId).toBeNull();
    cmp.elegirHilo('dx2');
    expect(host.filtro().hiloDeDiagnosticoId).toBe('dx2');
    cmp.elegirHilo(null);
    expect(host.filtro().hiloDeDiagnosticoId).toBeNull();
  });

  it('«Más filtros» pliega y despliega los criterios (y lo anuncia)', async () => {
    const boton = Array.from(el().querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes('Más filtros'),
    )!;
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    boton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(el().querySelector('#red-filtros-avanzados')?.classList).toContain('filtros__avanzados--abierto');
  });
});
