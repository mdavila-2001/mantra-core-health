import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { GridGroup } from './grid-group';
import type { OpcionDeCuadricula, RespuestaDeCuadricula } from './grid-group.types';

/**
 * La cuadrícula de preguntas.
 *
 * Lo que fijan estas pruebas no es la maqueta sino lo que se puede contestar:
 * que cada fila sea independiente de las demás —el defecto clásico de una
 * cuadrícula armada con radios mal agrupados es que contestar la fila 2 borre
 * la 1—, que las filas sin responder no dejen rastro, y que «una respuesta por
 * columna» se cumpla apagando la celda y no avisando después.
 */
@Component({
  imports: [GridGroup, ReactiveFormsModule],
  template: `
    <app-grid-group
      [formControl]="control"
      [rows]="filas"
      [columns]="columnas"
      [multiple]="varias()"
      [oneResponsePerColumn]="unaPorColumna()"
      ariaLabel="¿Con qué frecuencia?"
    />
  `,
})
class Anfitrion {
  readonly filas: readonly OpcionDeCuadricula[] = [
    { value: 'tos', label: 'Tos' },
    { value: 'fiebre', label: 'Fiebre' },
  ];
  readonly columnas: readonly OpcionDeCuadricula[] = [
    { value: 'nunca', label: 'Nunca' },
    { value: 'a-veces', label: 'A veces' },
    { value: 'siempre', label: 'Siempre' },
  ];
  readonly varias = signal(false);
  readonly unaPorColumna = signal(false);
  readonly control = new FormControl<RespuestaDeCuadricula>({});
}

describe('GridGroup', () => {
  let fixture: ComponentFixture<Anfitrion>;
  let anfitrion: Anfitrion;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [Anfitrion] });
    await TestBed.compileComponents();
    fixture = TestBed.createComponent(Anfitrion);
    anfitrion = fixture.componentInstance;
    fixture.detectChanges();
  });

  function celda(fila: string, columna: string): HTMLInputElement {
    const elemento = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      `[data-testid="cuadricula-${fila}-${columna}"]`,
    );
    if (elemento === null) throw new Error(`No existe la celda ${fila}/${columna}`);
    return elemento;
  }

  function marcar(fila: string, columna: string): void {
    celda(fila, columna).click();
    fixture.detectChanges();
  }

  it('dibuja una tabla con las columnas y las filas como encabezados', () => {
    const raiz = fixture.nativeElement as HTMLElement;
    const columnas = [...raiz.querySelectorAll('th[scope="col"]')].map((t) => t.textContent?.trim());
    const filas = [...raiz.querySelectorAll('th[scope="row"]')].map((t) => t.textContent?.trim());

    expect(columnas).toEqual(['Nunca', 'A veces', 'Siempre']);
    expect(filas).toEqual(['Tos', 'Fiebre']);
  });

  it('cada control se anuncia con su fila y su columna', () => {
    // «Casilla, sin marcar» a secas no dice qué se estaría contestando: en una
    // cuadrícula de 8×5 son cuarenta controles con el mismo nombre.
    expect(celda('tos', 'a-veces').getAttribute('aria-label')).toBe('Tos, A veces');
  });

  it('en la de opción única cada fila guarda UNA columna', () => {
    marcar('tos', 'a-veces');
    expect(anfitrion.control.value).toEqual({ tos: 'a-veces' });

    marcar('tos', 'siempre');
    expect(anfitrion.control.value).toEqual({ tos: 'siempre' });
  });

  it('las filas son independientes: contestar una no toca a la otra', () => {
    // Es el defecto clásico de una cuadrícula con los radios mal agrupados:
    // un solo `name` para toda la tabla hace que contestar la fila 2 borre la 1.
    marcar('tos', 'nunca');
    marcar('fiebre', 'siempre');

    expect(anfitrion.control.value).toEqual({ tos: 'nunca', fiebre: 'siempre' });
    expect(celda('tos', 'nunca').checked).toBe(true);
  });

  it('volver a pulsar la columna elegida deja la fila sin responder', () => {
    // Un radio nativo no ofrece desmarcar, y sin esto una fila contestada por
    // error no se puede dejar en blanco nunca más.
    marcar('tos', 'nunca');
    marcar('tos', 'nunca');

    expect(anfitrion.control.value).toEqual({});
  });

  it('una fila sin responder no aparece en el valor', () => {
    marcar('fiebre', 'nunca');
    expect(Object.keys(anfitrion.control.value ?? {})).toEqual(['fiebre']);
  });

  it('en la de casillas cada fila guarda varias, en el orden de las columnas', () => {
    anfitrion.varias.set(true);
    fixture.detectChanges();

    // Se marcan al revés del orden ofrecido a propósito: lo guardado se lee
    // después en una ficha, y leerlo en el orden de los clics no dice nada.
    marcar('tos', 'siempre');
    marcar('tos', 'nunca');

    expect(anfitrion.control.value).toEqual({ tos: ['nunca', 'siempre'] });
  });

  it('desmarcar la última casilla de una fila la deja sin responder', () => {
    anfitrion.varias.set(true);
    fixture.detectChanges();

    marcar('tos', 'nunca');
    marcar('tos', 'nunca');

    expect(anfitrion.control.value).toEqual({});
  });

  it('«una respuesta por columna» APAGA la columna ya usada en las demás filas', () => {
    // Se apaga en vez de dejar marcarla y avisar después: un error que se
    // puede volver imposible no debería llegar a ocurrir.
    anfitrion.unaPorColumna.set(true);
    fixture.detectChanges();

    marcar('tos', 'nunca');

    expect(celda('fiebre', 'nunca').disabled).toBe(true);
    // La de la fila que la tomó sigue viva: es la que hay que poder pulsar
    // para soltarla.
    expect(celda('tos', 'nunca').disabled).toBe(false);
    expect(celda('fiebre', 'siempre').disabled).toBe(false);
  });

  it('soltar la columna vuelve a ofrecerla en las demás filas', () => {
    anfitrion.unaPorColumna.set(true);
    fixture.detectChanges();

    marcar('tos', 'nunca');
    marcar('tos', 'nunca');

    expect(celda('fiebre', 'nunca').disabled).toBe(false);
  });

  it('sin la restricción, la misma columna se puede repetir', () => {
    marcar('tos', 'nunca');
    marcar('fiebre', 'nunca');

    expect(anfitrion.control.value).toEqual({ tos: 'nunca', fiebre: 'nunca' });
  });

  it('un valor escrito desde el formulario se dibuja marcado', () => {
    anfitrion.control.setValue({ fiebre: 'siempre' });
    fixture.detectChanges();

    expect(celda('fiebre', 'siempre').checked).toBe(true);
    expect(celda('tos', 'siempre').checked).toBe(false);
  });

  it('tolera el valor con el que nace un control sin valor inicial', () => {
    // `''` es lo que deja un `FormControl` recién creado: leer `''['tos']` no
    // falla, pero `null['tos']` sí, y un array pasaría por objeto dejando
    // índices donde tendría que haber filas.
    anfitrion.control.setValue('' as unknown as RespuestaDeCuadricula);
    fixture.detectChanges();

    expect(celda('tos', 'nunca').checked).toBe(false);
  });

  it('contestar marca el control como tocado', () => {
    // Elegir ya es la interacción completa: esperar al blur retrasaría el
    // mensaje de una cuadrícula obligatoria sin responder hasta salir de ella.
    expect(anfitrion.control.touched).toBe(false);
    marcar('tos', 'nunca');
    expect(anfitrion.control.touched).toBe(true);
  });

  it('deshabilitada desde el formulario, ninguna celda se puede pulsar', () => {
    anfitrion.control.disable();
    fixture.detectChanges();

    expect(celda('tos', 'nunca').disabled).toBe(true);

    celda('tos', 'nunca').click();
    fixture.detectChanges();
    expect(anfitrion.control.value).toEqual({});
  });
});
