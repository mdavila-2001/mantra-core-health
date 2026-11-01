import { TestBed } from '@angular/core/testing';

import { DataTypeIcon, familiaDe } from './data-type-icon';

/**
 * El ícono del tipo de dato de un campo del catálogo clínico. Conviven dos
 * vocabularios (`string`/`integer` del contrato y `TEXT`/`NUMBER` del seed): la
 * familia se decide sin distinguir mayúsculas, y la cardinalidad de un `code`
 * (una o varias, en fila o en cuadrícula) cambia el dibujo.
 */
describe('DataTypeIcon', () => {
  describe('familiaDe', () => {
    it.each([
      ['TEXT', 'parrafo'],
      ['textarea', 'parrafo'],
      ['integer', 'numero'],
      ['NUMBER', 'numero'],
      ['decimal', 'numero'],
      ['boolean', 'booleano'],
      ['date', 'fecha'],
      ['timestamp', 'fecha'],
      ['string', 'texto'],
      ['algo-raro', 'texto'],
    ])('%s → %s', (tipo, familia) => {
      expect(familiaDe(tipo)).toBe(familia);
    });

    it('un code es elección; con multiple, casillas; en cuadrícula, la cuadrícula que corresponda', () => {
      expect(familiaDe('code')).toBe('eleccion');
      expect(familiaDe('code', true)).toBe('casillas');
      expect(familiaDe('code', false, true)).toBe('cuadricula');
      expect(familiaDe('code', true, true)).toBe('cuadricula-casillas');
    });
  });

  function dibujo(tipo: string, multiple = false): HTMLElement {
    const fixture = TestBed.createComponent(DataTypeIcon);
    fixture.componentRef.setInput('tipo', tipo);
    fixture.componentRef.setInput('multiple', multiple);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('es decorativo y siempre dibuja algo, aun con un tipo desconocido', () => {
    const host = dibujo('desconocido');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelector('svg')!.children.length).toBeGreaterThan(0);
  });

  it('elección única y múltiple se dibujan distinto', () => {
    const unica = dibujo('code').querySelector('svg')!.innerHTML.replace(/<!--[\s\S]*?-->/g, '');
    const varias = dibujo('code', true).querySelector('svg')!.innerHTML.replace(/<!--[\s\S]*?-->/g, '');
    expect(unica).not.toBe(varias);
  });
});
