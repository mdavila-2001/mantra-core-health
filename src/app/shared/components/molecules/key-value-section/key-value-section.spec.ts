import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { KeyValueSection } from './key-value-section';
import type { KeyValueRow } from './key-value-section.types';

// Anfitrión de prueba: lee campos mutables a propósito, no es un componente de producto.
 
@Component({
  imports: [KeyValueSection],
  template: `<app-key-value-section
    heading="Identificación técnica"
    description="Tal como está en la base"
    [rows]="filas"
  />`,
})
class Anfitrion {
  filas: readonly KeyValueRow[] = [
    { label: 'Schema', value: 'scheduling', mono: true, copyable: true },
    { label: 'Responsable', value: null },
    { label: 'Nota', value: '   ' },
  ];
}

describe('KeyValueSection', () => {
  function montar() {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('dibuja título, descripción y una fila por dato', () => {
    const { el } = montar();
    expect(el.querySelector('h2')?.textContent).toContain('Identificación técnica');
    expect(el.querySelectorAll('.kv__row')).toHaveLength(3);
  });

  it('lo que falta dice «Sin dato» en lugar de desaparecer', () => {
    const { el } = montar();
    const valores = [...el.querySelectorAll('.kv__value')].map((v) => v.textContent?.trim());
    expect(valores[1]).toBe('Sin dato');
    expect(valores[2]).toBe('Sin dato');
  });

  it('el valor técnico va en mono y sólo lo copiable lleva botón con nombre accesible', () => {
    const { el } = montar();
    expect(el.querySelector('.kv__value--mono')).not.toBeNull();
    const botones = el.querySelectorAll('[data-testid="kv-copiar"]');
    expect(botones).toHaveLength(1);
    expect(botones[0].getAttribute('aria-label')).toBe('Copiar Schema');
  });

  it('copiar escribe el valor en el portapapeles y lo avisa', async () => {
    const escribir = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText: escribir } });
    const { fixture, el } = montar();
    (el.querySelector('[data-testid="kv-copiar"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(escribir).toHaveBeenCalledWith('scheduling');
    expect(el.querySelector('[data-testid="kv-copiar"]')?.textContent).toContain('Copiado');
    vi.unstubAllGlobals();
  });
});
