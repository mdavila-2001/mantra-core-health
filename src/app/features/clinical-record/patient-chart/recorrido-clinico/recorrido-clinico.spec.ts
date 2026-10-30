import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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

  it('agrupa la celda llena y la abre sin pedir un detalle, en el mismo botón', () => {
    const grupo = boton('Mostrar 2 observaciones más');
    expect(grupo.getAttribute('aria-expanded')).toBe('false');
    const antes = botones().length;
    grupo.focus();
    grupo.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.abiertos).toEqual([]);
    expect(botones().length).toBe(antes + 2);
    // Es EL MISMO elemento: quien navega con teclado no pierde el foco, y
    // `aria-expanded` cambia sobre el botón que se activó.
    expect(boton('Mostrar menos')).toBe(grupo);
    expect(grupo.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(grupo);
  });

  it('nombra el diagnóstico real aunque esté agrupado en el plano', () => {
    const muchos = [
      nodo('c', 'encuentros'),
      ...['dx', 'd2', 'd3', 'd4'].map((id) => nodo(id, 'diagnosticos', 'c')),
      nodo('rx', 'medicacion', 'c'),
    ];
    fixture.componentInstance.nodos.set(muchos);
    fixture.detectChanges();
    // «Hipertensión» (dx) queda primera y visible; pruebo con uno que se agrupa.
    fixture.componentInstance.aristas.set([{ desde: 'd4', hasta: 'rx', motivo: 'indicacion' }]);
    fixture.detectChanges();
    expect(boton('Medicación: Enalapril').getAttribute('aria-label')).toContain('indicado para d4');
  });

  it('sacar el puntero de un nodo no apaga el camino del que tiene el foco', () => {
    const receta = boton('Medicación: Enalapril');
    receta.dispatchEvent(new Event('focus'));
    const otro = boton('Observación: o1');
    otro.dispatchEvent(new Event('mouseenter'));
    otro.dispatchEvent(new Event('mouseleave'));
    fixture.detectChanges();
    expect(boton('Diagnóstico: Hipertensión').classList.contains('recorrido__nodo--atenuado')).toBe(false);
    expect(otro.classList.contains('recorrido__nodo--atenuado')).toBe(true);
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
  it('muestra la fecha propia del registro cuando no es la de su columna', () => {
    fixture.componentInstance.nodos.set([
      nodo('c', 'encuentros'),
      { ...nodo('dx', 'diagnosticos', 'c'), cuando: new Date(2025, 8, 23) },
    ]);
    fixture.detectChanges();
    const fechas = Array.from(fixture.nativeElement.querySelectorAll('.recorrido__nodo-fecha')).map(
      (e) => (e as HTMLElement).textContent?.trim(),
    );
    expect(fechas).toHaveLength(1);
    // De otro año: mes y año, para que entre al lado del estado.
    expect(fechas[0]).toMatch(/^Inicio sept?\.? 2025$/i);
  });

  it('enfocar el control de un grupo no atenúa lo que se acaba de mostrar', () => {
    const grupo = boton('Mostrar 2 observaciones más');
    grupo.click();
    fixture.detectChanges();
    grupo.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(botones().some((b) => b.classList.contains('recorrido__nodo--atenuado'))).toBe(false);
  });

  it('en pantalla angosta se dibuja en vertical, lo más reciente arriba y la indicación en texto', () => {
    const recorrido = fixture.debugElement.query(By.directive(RecorridoClinico)).componentInstance as unknown as {
      angosto: { set(v: boolean): void };
    };
    recorrido.angosto.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.recorrido__lienzo')).toBeNull();
    expect(fixture.nativeElement.querySelector('.recorrido-v')).not.toBeNull();
    expect(boton('Medicación: Enalapril').textContent).toContain('Para Hipertensión');
  });
  it('pinta el estado con el mismo tono que la tabla, no con el del tipo', () => {
    fixture.componentInstance.nodos.set([
      nodo('c', 'encuentros'),
      { ...nodo('dx', 'diagnosticos', 'c'), estado: 'Enfermedad activa', tonoDelEstado: 'success' },
    ]);
    fixture.detectChanges();
    const estado = boton('Diagnóstico: Hipertensión').querySelector('.recorrido__nodo-estado')!;
    expect(estado.classList.contains('tono--success')).toBe(true);
    expect(boton('Atención: Ambulatorio').querySelector('.recorrido__nodo-estado')?.classList.contains('tono--info')).toBe(true);
  });

  it('en vertical no muestra la leyenda de líneas que no dibuja', () => {
    const recorrido = fixture.debugElement.query(By.directive(RecorridoClinico)).componentInstance as unknown as {
      angosto: { set(v: boolean): void };
    };
    expect(fixture.nativeElement.querySelector('.recorrido__leyenda')).not.toBeNull();
    recorrido.angosto.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.recorrido__leyenda')).toBeNull();
  });
});
