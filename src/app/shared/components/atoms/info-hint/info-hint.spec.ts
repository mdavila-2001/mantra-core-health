import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { InfoHint } from './info-hint';

describe('InfoHint', () => {
  function crear(text: string, label = '') {
    const fixture = TestBed.createComponent(InfoHint);
    fixture.componentRef.setInput('text', text);
    fixture.componentRef.setInput('label', label);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('es un botón alcanzable con teclado, no un title suelto', () => {
    const el = crear('Personas asignadas sobre las requeridas.', 'Cobertura');
    const boton = el.querySelector('button');
    expect(boton).not.toBeNull();
    expect(boton?.getAttribute('type')).toBe('button');
    expect(boton?.hasAttribute('title')).toBe(false);
  });

  it('su nombre accesible dice qué explica', () => {
    const el = crear('Texto', 'Cobertura');
    expect(el.querySelector('button')?.getAttribute('aria-label')).toBe(
      'Más información sobre Cobertura',
    );
  });

  it('sin label usa un nombre genérico y no queda vacío', () => {
    const el = crear('Texto');
    expect(el.querySelector('button')?.getAttribute('aria-label')).toBe('Más información');
  });

  it('el dibujo no se anuncia aparte del botón', () => {
    const el = crear('Texto', 'Horas');
    expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
