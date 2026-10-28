import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';

import { RecorridoClinico } from './recorrido-clinico';
import type { AristaDelRecorrido, NodoDelRecorrido } from './recorrido-clinico.model';

/**
 * El recorrido en pantalla. La geometría se prueba en el modelo; acá, las tres
 * promesas de la vista: que cada registro sea un botón que abre su detalle, que
 * su nombre accesible diga lo que dicen las líneas, y que un grupo se abra en
 * vez de abrir un detalle que no existe.
 */
const enero = new Date(2026, 0, 10);
const nodo = (id: string, tipo: NodoDelRecorrido['tipo'], encuentroId?: string): NodoDelRecorrido => ({
  id,
  tipo,
  principal: id === 'c' ? 'Ambulatorio' : id === 'dx' ? 'Hipertensión' : id === 'rx' ? 'Enalapril' : id,
  secundario: '',
  estado: 'Activa',
  cuando: enero,
  ...(encuentroId === undefined ? {} : { encuentroId }),
});

@Component({
  imports: [RecorridoClinico],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-recorrido-clinico [nodos]="nodos()" [aristas]="aristas()" (abrir)="abiertos.push($event)" />
  `,
})
class Anfitrion {
  readonly nodos = signal<readonly NodoDelRecorrido[]>([
    nodo('c', 'encuentros'),
    nodo('dx', 'diagnosticos', 'c'),
    nodo('rx', 'medicacion', 'c'),
    ...['o1', 'o2', 'o3', 'o4'].map((id) => nodo(id, 'observaciones', 'c')),
  ]);
  readonly aristas = signal<readonly AristaDelRecorrido[]>([
    { desde: 'c', hasta: 'dx', motivo: 'atencion' },
    { desde: 'c', hasta: 'rx', motivo: 'atencion' },
    { desde: 'dx', hasta: 'rx', motivo: 'indicacion' },
    ...['o1', 'o2', 'o3', 'o4'].map((id) => ({ desde: 'c', hasta: id, motivo: 'atencion' as const })),
  ]);
  readonly abiertos: string[] = [];
}

describe('RecorridoClinico', () => {
  let fixture: ComponentFixture<Anfitrion>;
  const botones = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid="recorrido-nodo"]'));
  const boton = (texto: string): HTMLButtonElement =>
    botones().find((b) => (b.getAttribute('aria-label') ?? '').includes(texto))!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Anfitrion] }).compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('abre el detalle del registro elegido', () => {
    boton('Medicación: Enalapril').click();
    expect(fixture.componentInstance.abiertos).toEqual(['rx']);
  });

  it('dice en el nombre accesible de dónde viene y para qué es la receta', () => {
    const nombre = boton('Medicación: Enalapril').getAttribute('aria-label');
    expect(nombre).toContain('registrado en la atención Ambulatorio');
    expect(nombre).toContain('indicado para Hipertensión');
    expect(boton('Diagnóstico: Hipertensión').getAttribute('aria-label')).toContain('tratado con Enalapril');
  });

  it('agrupa la celda llena y la abre sin pedir un detalle', () => {
    const grupo = boton('Mostrar 2 observaciones más');
    expect(grupo.getAttribute('aria-expanded')).toBe('false');
    const antes = botones().length;
    grupo.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.abiertos).toEqual([]);
    expect(botones().length).toBe(antes + 2);
    expect(boton('Mostrar menos').getAttribute('aria-expanded')).toBe('true');
  });

  it('al enfocar un registro atenúa lo que no está en su camino', () => {
    boton('Medicación: Enalapril').dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    const atenuados = botones()
      .filter((b) => b.classList.contains('recorrido__nodo--atenuado'))
      .map((b) => b.getAttribute('aria-label') ?? '');
    expect(atenuados.some((n) => n.startsWith('Observación'))).toBe(true);
    expect(atenuados.some((n) => n.startsWith('Diagnóstico'))).toBe(false);
    expect(atenuados.some((n) => n.startsWith('Atención'))).toBe(false);
  });
});
