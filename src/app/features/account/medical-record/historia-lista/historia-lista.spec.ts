import { TestBed } from '@angular/core/testing';

import { HistoriaLista } from './historia-lista';

describe('HistoriaLista', () => {
  it('prints the row date in the clinical day, whatever the browser zone (run with TZ=UTC)', () => {
    const fixture = TestBed.createComponent(HistoriaLista);
    fixture.componentRef.setInput('tituloId', 't');
    fixture.componentRef.setInput('titulo', 'Resultados');
    fixture.componentRef.setInput('vacio', 'Sin resultados');
    fixture.componentRef.setInput('testId', 'lista');
    fixture.componentRef.setInput('conFecha', true);
    // 23:30 on 4 Nov in La Paz, already 5 Nov in UTC.
    fixture.componentRef.setInput('filas', [
      { id: 'r1', principal: 'TSH', secundario: 'Laboratorio', cuando: new Date('2026-11-05T03:30:00Z') },
    ]);
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).querySelector('.historia__secundario')?.textContent ?? '';
    expect(texto.replace(/\s+/g, ' ').trim()).toMatch(/· 4 nov\.? 2026$/i);
  });
});
