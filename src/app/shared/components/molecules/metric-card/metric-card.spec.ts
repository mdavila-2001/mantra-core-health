import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import type { MetricTone } from './metric-card.types';
import { MetricCard } from './metric-card';

// Anfitrión de prueba: lee campos mutables a propósito, no es un componente de producto.
 
@Component({
  imports: [MetricCard],
  template: `<app-metric-card
    label="Operaciones"
    [value]="valor"
    hint="del inventario"
    [tone]="tono"
    icon="route"
  />`,
})
class Anfitrion {
  valor: string | number | null = 1254;
  tono: MetricTone = 'primary';
}

function montar() {
  const fixture = TestBed.createComponent(Anfitrion);
  fixture.detectChanges();
  const el = fixture.nativeElement.querySelector('app-metric-card') as HTMLElement;
  return { fixture, el };
}

describe('MetricCard', () => {
  it('dice rótulo y valor juntos en su nombre accesible', () => {
    const { el } = montar();
    expect(el.getAttribute('role')).toBe('group');
    expect(el.getAttribute('aria-label')).toMatch(/^Operaciones: 1.?254$/);
  });

  it('formatea el número con separador de miles y muestra la pista', () => {
    const { el } = montar();
    expect(el.querySelector('.metric-card__value')?.textContent?.trim()).toMatch(/^1.?254$/);
    expect(el.querySelector('.metric-card__hint')?.textContent).toContain('del inventario');
  });

  it('un valor nulo se dice «Sin dato» y no se dibuja como un cero', () => {
    const { fixture, el } = montar();
    fixture.componentInstance.valor = null;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    const valor = el.querySelector('.metric-card__value');
    expect(valor?.textContent?.trim()).toBe('Sin dato');
    expect(valor?.classList).toContain('metric-card__value--empty');
    expect(el.getAttribute('aria-label')).toBe('Operaciones: Sin dato');
  });

  it('el tono sólo cambia la clase de la loseta; el ícono es decorativo', () => {
    const { el } = montar();
    expect(el.classList).toContain('metric-card--primary');
    expect(el.querySelector('.metric-card__tile')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('un cero medido sí se muestra', () => {
    const { fixture, el } = montar();
    fixture.componentInstance.valor = 0;
    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();
    expect(el.querySelector('.metric-card__value')?.textContent?.trim()).toBe('0');
  });
});
