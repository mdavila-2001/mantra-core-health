import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { AlternativaDeEjemplo } from '../new-order.fixtures';
import { OrderAlternatives } from './order-alternatives';

/** Alternativas de marca para un genérico recetado: elegir una y volver a la recetada. */

const ALTERNATIVAS: readonly AlternativaDeEjemplo[] = [
  { id: 'a-1', nombre: 'Genfar Paracetamol', presentacion: '500 mg', precio: '8.00', ahorro: '2.00' },
  { id: 'a-2', nombre: 'MK Paracetamol', presentacion: null, precio: '7.50', ahorro: '2.50' },
];

describe('OrderAlternatives', () => {
  let fixture: ComponentFixture<OrderAlternatives>;

  function pintar(elegidaId: string | null = null): HTMLElement {
    fixture = TestBed.createComponent(OrderAlternatives);
    fixture.componentRef.setInput('recetada', 'Panadol');
    fixture.componentRef.setInput('alternativas', ALTERNATIVAS);
    fixture.componentRef.setInput('moneda', 'BOB');
    fixture.componentRef.setInput('elegidaId', elegidaId);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lista cada alternativa con precio y ahorro, y rotula que son datos de ejemplo', () => {
    const root = pintar();
    const opciones = root.querySelectorAll('[data-testid="alternativa"]');

    expect(opciones).toHaveLength(2);
    expect(opciones[0]?.textContent).toContain('8.00 Bs');
    expect(opciones[0]?.textContent).toContain('Ahorra 2.00 Bs por unidad');
    expect(root.textContent).toContain('Datos de ejemplo');
    expect(root.textContent).toContain('Marcas del mismo genérico que Panadol');
  });

  it('elegir emite la alternativa tocada', () => {
    const root = pintar();
    const elegidas: AlternativaDeEjemplo[] = [];
    fixture.componentInstance.elegir.subscribe((a) => elegidas.push(a));

    root.querySelectorAll<HTMLElement>('[data-testid="alternativa-elegir"]')[1]!.click();

    expect(elegidas).toEqual([ALTERNATIVAS[1]]);
  });

  it('la elegida no ofrece «Elegir» y aparece «Volver a» la recetada, que emite restaurar', () => {
    const root = pintar('a-1');
    let restaurada = 0;
    fixture.componentInstance.restaurar.subscribe(() => (restaurada += 1));

    expect(root.querySelectorAll('[data-testid="alternativa-elegir"]')).toHaveLength(1);
    expect(root.querySelector('.alternativas__opcion--elegida')?.textContent).toContain('Elegida');
    const volver = root.querySelector<HTMLElement>('[data-testid="alternativa-restaurar"]');
    expect(volver?.textContent).toContain('Volver a Panadol');
    volver!.click();
    expect(restaurada).toBe(1);
  });

  it('sin elección no ofrece volver', () => {
    expect(pintar().querySelector('[data-testid="alternativa-restaurar"]')).toBeNull();
  });
});
