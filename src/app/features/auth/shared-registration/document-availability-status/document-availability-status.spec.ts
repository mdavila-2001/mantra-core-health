import { TestBed } from '@angular/core/testing';

import type { EstadoDeDocumento } from '../document-availability';
import { DocumentAvailabilityStatus } from './document-availability-status';

function pintar(estado: EstadoDeDocumento): HTMLElement {
  const fixture = TestBed.createComponent(DocumentAvailabilityStatus);
  fixture.componentRef.setInput('estado', estado);
  fixture.detectChanges();
  return fixture.nativeElement.querySelector('[data-testid="documento-disponibilidad"]');
}

describe('DocumentAvailabilityStatus (C-10 / MD-01)', () => {
  it('«ya registrado» no se repite acá: lo dice el campo (ver los specs de cada alta)', () => {
    const region = pintar('tomado');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.textContent?.trim()).toBe('');
  });

  it('es una región de estado que existe aunque no haya nada que decir', () => {
    const region = pintar('sin-dato');
    expect(region.getAttribute('role')).toBe('status');
    expect(region.textContent?.trim()).toBe('');
  });

  it.each<[EstadoDeDocumento, RegExp]>([
    ['falta-departamento', /elija el departamento/i],
    ['comprobando', /comprobando/i],
    ['libre', /documento disponible/i],
    ['sin-respuesta', /no pudimos comprobar/i],
  ])('%s se dice con palabras, no sólo con color', (estado, texto) => {
    expect(pintar(estado).textContent).toMatch(texto);
  });

  it('sin catálogo de departamentos dice qué pasó y ofrece reintentar', () => {
    const fixture = TestBed.createComponent(DocumentAvailabilityStatus);
    fixture.componentRef.setInput('caido', true);
    let reintentos = 0;
    fixture.componentInstance.reintentar.subscribe(() => (reintentos += 1));
    fixture.detectChanges();
    const aviso: HTMLElement = fixture.nativeElement.querySelector(
      '[data-testid="documento-catalogo-caido"]',
    );
    expect(aviso.textContent).toContain('No pudimos traer el catálogo de departamentos');
    const boton: HTMLButtonElement = aviso.querySelector('button')!;
    expect(boton.textContent?.trim()).toBe('Reintentar');
    boton.click();
    expect(reintentos).toBe(1);
    expect(
      fixture.nativeElement.querySelector('[data-testid="documento-disponibilidad"]'),
    ).toBeNull();
  });
});
