import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Odontogram } from './odontogram';
import { PIEZAS_FDI, recuentoCpod } from './odontogram.types';

describe('Odontogram', () => {
  let fixture: ComponentFixture<Odontogram>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Odontogram] }).compileComponents();
    fixture = TestBed.createComponent(Odontogram);
  });

  /** Los botones de pieza que hay pintados. */
  const piezas = (): HTMLButtonElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('button'));

  /** El botón de una pieza concreta, por su número FDI. */
  const pieza = (fdi: string): HTMLButtonElement =>
    piezas().find((boton) => boton.textContent?.includes(fdi))!;

  it('dibuja las 32 piezas permanentes, ninguna repetida', () => {
    fixture.detectChanges();

    expect(piezas()).toHaveLength(32);
    expect(new Set(PIEZAS_FDI).size).toBe(32);
    // Las temporales (51-85) quedan fuera a propósito.
    expect(PIEZAS_FDI.some((fdi) => Number(fdi) > 48)).toBe(false);
  });

  it('anuncia cada pieza con palabras: el color no cuenta el dato solo', () => {
    fixture.componentRef.setInput('estados', { '16': '1' });
    fixture.componentRef.setInput('marcas', { '16': 2 });
    fixture.detectChanges();

    expect(pieza('16').getAttribute('aria-label')).toBe(
      'Pieza 16, cariada, 2 tratamientos',
    );
    // Sin nada registrado, lo dice igual en vez de callarse.
    expect(pieza('27').getAttribute('aria-label')).toBe('Pieza 27, sin registrar');
  });

  it('el singular del tratamiento no dice «1 tratamientos»', () => {
    fixture.componentRef.setInput('marcas', { '11': 1 });
    fixture.detectChanges();

    expect(pieza('11').getAttribute('aria-label')).toBe(
      'Pieza 11, sin registrar, 1 tratamiento',
    );
  });

  it('pinta el tono del estado y muestra su código', () => {
    fixture.componentRef.setInput('estados', { '36': '3' });
    fixture.detectChanges();

    expect(pieza('36').className).toContain('odontograma__pieza--info');
    expect(pieza('36').textContent).toContain('3');
  });

  it('un código que no es de la tabla no pinta ningún tono', () => {
    fixture.componentRef.setInput('estados', { '36': 'ZZ' });
    fixture.detectChanges();

    expect(pieza('36').className).toBe('odontograma__pieza');
  });

  it('emite el código FDI de la pieza elegida', () => {
    const elegidas: string[] = [];
    fixture.componentRef.setInput('estados', {});
    fixture.detectChanges();
    fixture.componentInstance.pieza.subscribe((fdi) => elegidas.push(fdi));

    pieza('24').click();

    expect(elegidas).toEqual(['24']);
  });

  it('en modo lectura no se elige nada, pero se sigue leyendo', () => {
    const elegidas: string[] = [];
    fixture.componentRef.setInput('readonly', true);
    fixture.componentRef.setInput('estados', { '24': '0' });
    fixture.detectChanges();
    fixture.componentInstance.pieza.subscribe((fdi) => elegidas.push(fdi));

    pieza('24').click();

    expect(elegidas).toEqual([]);
    expect(pieza('24').disabled).toBe(true);
    // El dato sigue anunciándose: leer la boca con un lector tiene que valer.
    expect(pieza('24').getAttribute('aria-label')).toBe('Pieza 24, sana');
    // Y sin elección posible, `aria-pressed` no aporta nada.
    expect(pieza('24').getAttribute('aria-pressed')).toBeNull();
  });

  it('marca la pieza elegida con aria-pressed', () => {
    fixture.componentRef.setInput('seleccionada', '41');
    fixture.detectChanges();

    expect(pieza('41').getAttribute('aria-pressed')).toBe('true');
    expect(pieza('41').className).toContain('odontograma__pieza--elegida');
    expect(pieza('42').getAttribute('aria-pressed')).toBe('false');
  });

  it('avisa cuando no hay nada registrado, y calla cuando sí', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay nada registrado');

    fixture.componentRef.setInput('estados', { '11': '0' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Todavía no hay nada registrado');
  });
});

describe('recuentoCpod', () => {
  it('cuenta cariadas, perdidas y obturadas, y suma el índice', () => {
    const recuento = recuentoCpod({
      '11': '1', // cariada
      '12': '2', // obturada CON caries → cuenta como cariada
      '13': '3', // obturada sin caries
      '14': '4', // perdida por caries
      '15': '5', // perdida por otra causa
      '16': '0', // sana: no entra en el índice
      '17': '8', // sin erupcionar: tampoco
    });

    expect(recuento).toEqual({
      cariados: 2,
      perdidos: 2,
      obturados: 1,
      cpod: 5,
    });
  });

  it('una boca sin registrar da todo en cero', () => {
    expect(recuentoCpod({})).toEqual({
      cariados: 0,
      perdidos: 0,
      obturados: 0,
      cpod: 0,
    });
  });
});
