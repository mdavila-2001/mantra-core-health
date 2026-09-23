import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { SurveyQuestion } from '@core/data-access/surveys/surveys.types';
import { QuestionEditor } from './question-editor';

/**
 * El editor de una pregunta.
 *
 * Se prueba lo que decide si se puede guardar y **qué** se guarda: la
 * validación, y que el emitido lleve sólo las claves que el tipo admite. Lo
 * segundo es lo que el backend rechaza con 400 si se hace mal, y el fallo no se
 * ve hasta que alguien cambia el tipo de una pregunta ya escrita.
 */
describe('QuestionEditor', () => {
  let fixture: ComponentFixture<QuestionEditor>;

  const PREGUNTA: SurveyQuestion = {
    id: 'q-1',
    position: 1,
    questionText: '¿Cómo calificarías la atención?',
    answerType: 'SCALE',
    required: true,
    scaleMin: 1,
    scaleMax: 5,
  };

  function montar(pregunta: SurveyQuestion = PREGUNTA, abierta = true): HTMLElement {
    fixture = TestBed.createComponent(QuestionEditor);
    fixture.componentRef.setInput('pregunta', pregunta);
    fixture.componentRef.setInput('abierta', abierta);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /**
   * El componente por dentro; el editor expone su borrador como `protected`.
   *
   * Los métodos se devuelven **enlazados**: sin `bind`, llamarlos desde acá los
   * ejecuta sin `this` y cada uno falla al tocar sus señales. Es el mismo
   * ayudante que ya usa el spec de la ficha de laboratorio.
   */
  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  /* -- plegada vs desplegada ------------------------------------------------ */

  it('plegada muestra el enunciado, el tipo y su detalle', () => {
    const host = montar(PREGUNTA, false);

    expect(host.textContent).toContain('¿Cómo calificarías la atención?');
    expect(host.textContent).toContain('Escala');
    expect(host.textContent).toContain('De 1 a 5');
    expect(host.querySelector('.editor-pregunta__edicion')).toBeNull();
  });

  it('en una versión publicada la fila no es un botón', () => {
    // No hay nada que abrir, y un control que no hace nada es peor que su
    // ausencia.
    fixture = TestBed.createComponent(QuestionEditor);
    fixture.componentRef.setInput('pregunta', PREGUNTA);
    fixture.componentRef.setInput('abierta', false);
    fixture.componentRef.setInput('editable', false);
    fixture.detectChanges();

    const fila = (fixture.nativeElement as HTMLElement).querySelector('.editor-pregunta__fila');
    expect(fila?.getAttribute('role')).toBeNull();
    expect(fila?.getAttribute('tabindex')).toBeNull();
  });

  it('resume las opciones y dice cuántas quedaron afuera', () => {
    // La fila plegada tiene que caber en un renglón: una pregunta con doce
    // opciones las empujaría a tres líneas.
    const host = montar(
      {
        ...PREGUNTA,
        answerType: 'SINGLE_CHOICE',
        options: ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'],
      },
      false,
    );

    expect(host.textContent).toContain('Uno · Dos · Tres · y 2 más');
  });

  /* -- el borrador ---------------------------------------------------------- */

  it('al abrirse precarga lo que la pregunta ya tiene', () => {
    montar();

    expect(interno<() => string>('texto')()).toBe('¿Cómo calificarías la atención?');
    expect(interno<() => string>('tipo')()).toBe('SCALE');
    expect(interno<() => boolean>('obligatoria')()).toBe(true);
    expect(interno<() => number>('minimo')()).toBe(1);
    expect(interno<() => number>('maximo')()).toBe(5);
  });

  it('pasar a una elección siembra dos opciones vacías', () => {
    // Una lista vacía con un «+ Agregar opción» esconde que hacen falta dos.
    montar();
    interno<(v: string) => void>('cambiarTipo')('SINGLE_CHOICE');
    fixture.detectChanges();

    expect(interno<() => readonly string[]>('opciones')()).toHaveLength(2);
  });

  /* -- lo que impide guardar ------------------------------------------------ */

  it('sin enunciado no se puede guardar', () => {
    montar();
    interno<(v: string) => void>('cambiarTexto')('   ');
    fixture.detectChanges();

    expect(interno<() => string | null>('problema')()).toBe('Escribí la pregunta.');
  });

  it('una elección con menos de dos opciones no se puede guardar', () => {
    montar({ ...PREGUNTA, answerType: 'SINGLE_CHOICE', options: ['Única'] });
    fixture.detectChanges();

    expect(interno<() => string | null>('problema')()).toContain('al menos dos opciones');
  });

  it('dos opciones repetidas no se pueden guardar', () => {
    // Al responder no se distinguen, y en el resumen la barra de una taparía a
    // la otra.
    montar({ ...PREGUNTA, answerType: 'SINGLE_CHOICE', options: ['Sí', 'sí '] });
    fixture.detectChanges();

    expect(interno<() => string | null>('problema')()).toBe('Hay dos opciones repetidas.');
  });

  it('una escala con el máximo por debajo del mínimo no se puede guardar', () => {
    montar();
    interno<(v: number) => void>('cambiarMinimo')(5);
    interno<(v: number) => void>('cambiarMaximo')(2);
    fixture.detectChanges();

    expect(interno<() => string | null>('problema')()).toContain('mayor que el mínimo');
  });

  /* -- qué se emite --------------------------------------------------------- */

  it('una escala emite sus extremos y NINGUNA opción', () => {
    // El backend valida con `forbidNonWhitelisted`: una clave que no
    // corresponde al tipo vuelve 400.
    montar();
    let emitido: Record<string, unknown> | null = null;
    fixture.componentInstance.guardar.subscribe((c) => (emitido = c as Record<string, unknown>));

    interno<() => void>('confirmar')();

    expect(emitido).toEqual({
      questionText: '¿Cómo calificarías la atención?',
      answerType: 'SCALE',
      required: true,
      scaleMin: 1,
      scaleMax: 5,
    });
  });

  it('una elección emite sus opciones y NINGÚN extremo de escala', () => {
    montar({
      ...PREGUNTA,
      answerType: 'MULTIPLE_CHOICE',
      options: ['Tiempo de espera', 'Claridad'],
      scaleMin: undefined,
      scaleMax: undefined,
    });
    let emitido: Record<string, unknown> | null = null;
    fixture.componentInstance.guardar.subscribe((c) => (emitido = c as Record<string, unknown>));

    interno<() => void>('confirmar')();

    expect(emitido).toEqual({
      questionText: '¿Cómo calificarías la atención?',
      answerType: 'MULTIPLE_CHOICE',
      required: true,
      options: ['Tiempo de espera', 'Claridad'],
    });
  });

  it('descarta las opciones vacías al emitir', () => {
    // «+ Agregar opción» deja una fila en blanco que nadie llenó: mandarla
    // haría que el servidor rechazara el guardado entero.
    montar({ ...PREGUNTA, answerType: 'SINGLE_CHOICE', options: ['Sí', 'No'] });
    interno<() => void>('agregarOpcion')();
    fixture.detectChanges();

    let emitido: Record<string, unknown> | null = null;
    fixture.componentInstance.guardar.subscribe((c) => (emitido = c as Record<string, unknown>));
    interno<() => void>('confirmar')();

    expect(emitido).not.toBeNull();
    expect((emitido as unknown as { options: readonly string[] }).options).toEqual(['Sí', 'No']);
  });

  it('no emite nada mientras haya un problema', () => {
    montar();
    interno<(v: string) => void>('cambiarTexto')('');
    fixture.detectChanges();

    let emitio = false;
    fixture.componentInstance.guardar.subscribe(() => (emitio = true));
    interno<() => void>('confirmar')();

    expect(emitio).toBe(false);
  });
});
