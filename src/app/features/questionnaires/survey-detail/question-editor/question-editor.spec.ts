import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { SurveyQuestion, SurveyQuestionEdit } from '@core/data-access/surveys/surveys.types';
import { DialogService } from '@shared/components/molecules/dialog/dialog-service';
import type { DialogConfig } from '@shared/components/molecules/dialog/dialog.types';
import { QuestionEditor } from './question-editor';

/** Diálogo falso: el descarte se decide en la prueba, no en el navegador. */
class DialogServiceFalso {
  respuesta = true;
  readonly pedidos: DialogConfig[] = [];

  confirm(config: DialogConfig): Promise<boolean> {
    this.pedidos.push(config);
    return Promise.resolve(this.respuesta);
  }
}

/**
 * Una pantalla mínima que usa el editor como lo usa la ficha de la encuesta:
 * el disparador abre, `cerrar` cierra y `guardar` se anota.
 *
 * Hace falta un anfitrión —y no el componente suelto— para dos cosas que sólo
 * existen si el modal se abre **desde un botón real**: que el foco vuelva a
 * quien lo abrió, y que cancelar no emita nada hacia arriba.
 */
@Component({
  imports: [QuestionEditor],
  template: `
    <app-question-editor
      [pregunta]="pregunta()"
      [abierta]="abierta()"
      (abrir)="abierta.set(true)"
      (cerrar)="abierta.set(false)"
      (guardar)="guardados.push($event)"
    />
  `,
})
class Anfitrion {
  readonly pregunta = signal<SurveyQuestion>({
    id: 'q-1',
    position: 1,
    questionText: '¿Cómo calificarías la atención?',
    answerType: 'SCALE',
    required: true,
    scaleMin: 1,
    scaleMax: 5,
  });
  readonly abierta = signal(false);
  readonly guardados: SurveyQuestionEdit[] = [];
}

/**
 * El editor de una pregunta.
 *
 * Se prueba lo que decide si se puede guardar y **qué** se guarda: la
 * validación, y que el emitido lleve sólo las claves que el tipo admite. Lo
 * segundo es lo que el backend rechaza con 400 si se hace mal, y el fallo no se
 * ve hasta que alguien cambia el tipo de una pregunta ya escrita.
 *
 * Y se prueba **dónde** se edita: en un modal, nunca desplegado dentro de la
 * fila. Es el requisito central de la pantalla, así que tiene sus propias
 * pruebas —el formulario dentro de un `<dialog>`, cancelar sin emitir, el foco
 * de vuelta en el disparador— y no queda librado a que alguien lo mire.
 */
describe('QuestionEditor', () => {
  let fixture: ComponentFixture<QuestionEditor>;
  let dialogs: DialogServiceFalso;

  // El módulo se configura UNA vez, en el `beforeEach` más externo y antes de
  // cualquier `inject` o `createComponent`: instanciarlo primero deja a Angular
  // sin poder reconfigurarlo.
  beforeEach(() => {
    dialogs = new DialogServiceFalso();
    TestBed.configureTestingModule({
      providers: [{ provide: DialogService, useValue: dialogs }],
    });
  });

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

  /* -- dónde se edita: el modal --------------------------------------------- */

  describe('la edición se abre en un modal', () => {
    it('el formulario vive dentro de un <dialog>, no dentro de la fila', () => {
      const host = montar(PREGUNTA, true);

      const modal = host.querySelector('[data-testid="editor-pregunta-modal"]');
      expect(modal, 'falta el modal de edición').not.toBeNull();
      // Un `<dialog>` y no un bloque cualquiera: el fondo, la inertización de
      // lo de atrás y la trampa de foco son del elemento nativo.
      expect(modal!.querySelector('dialog')).not.toBeNull();
      expect(modal!.querySelector('[data-testid="editor-texto"]')).not.toBeNull();

      const fila = host.querySelector('.editor-pregunta__fila');
      expect(fila!.querySelector('[data-testid="editor-texto"]')).toBeNull();
      expect(fila!.querySelector('[data-testid="editor-guardar"]')).toBeNull();
    });

    it('cerrada, la fila trae el disparador y ningún campo del formulario', () => {
      const host = montar(PREGUNTA, false);

      expect(host.querySelector('[data-testid="editor-pregunta-abrir"]')).not.toBeNull();
      expect(host.querySelector('[data-testid="editor-pregunta-modal"]')).toBeNull();
      expect(host.querySelector('[data-testid="editor-texto"]')).toBeNull();
    });

    it('la fila se lee con aspecto de formulario, y ningún control se puede editar', () => {
      const host = montar(
        { ...PREGUNTA, answerType: 'SINGLE_CHOICE', options: ['Sí', 'No'] },
        false,
      );

      const muestra = host.querySelectorAll<HTMLInputElement>('.editor-pregunta__vista input');
      expect(muestra.length, 'la fila no muestra ningún control').toBeGreaterThan(0);
      for (const control of muestra) {
        expect(control.disabled, 'un control de la fila se puede editar').toBe(true);
      }
    });
  });

  describe('el modal, abierto desde su disparador', () => {
    let anfitrion: ComponentFixture<Anfitrion>;

    function raiz(): HTMLElement {
      return anfitrion.nativeElement as HTMLElement;
    }

    function disparador(): HTMLButtonElement {
      const boton = raiz().querySelector('[data-testid="editor-pregunta-abrir"]');
      if (!(boton instanceof HTMLButtonElement)) {
        throw new Error('falta el botón que abre el modal');
      }
      return boton;
    }

    function modal(): HTMLElement | null {
      return raiz().querySelector('[data-testid="editor-pregunta-modal"]');
    }

    function botonDelModal(testid: string): HTMLButtonElement {
      const boton = modal()?.querySelector(`[data-testid="${testid}"]`);
      if (!(boton instanceof HTMLButtonElement)) {
        throw new Error(`falta el botón ${testid}`);
      }
      return boton;
    }

    function botonPorTexto(texto: string): HTMLButtonElement {
      const botones = Array.from(modal()?.querySelectorAll('button') ?? []);
      const boton = botones.find((b) => b.textContent?.trim() === texto);
      if (!(boton instanceof HTMLButtonElement)) {
        throw new Error(`falta el botón «${texto}»`);
      }
      return boton;
    }

    /** Escribe en el campo del enunciado como escribe una persona. */
    function escribir(valor: string): void {
      const campo = modal()?.querySelector('[data-testid="editor-texto"] input');
      if (!(campo instanceof HTMLInputElement)) {
        throw new Error('falta el campo del enunciado');
      }
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
    }

    async function abrir(): Promise<void> {
      disparador().focus();
      disparador().click();
      await anfitrion.whenStable();
    }

    beforeEach(async () => {
      anfitrion = TestBed.createComponent(Anfitrion);
      await anfitrion.whenStable();
    });

    it('el disparador abre el modal', async () => {
      expect(modal()).toBeNull();

      await abrir();

      expect(modal()).not.toBeNull();
    });

    it('escribir en el modal no toca la pregunta hasta guardar', async () => {
      await abrir();
      escribir('Otro enunciado');
      await anfitrion.whenStable();

      expect(anfitrion.componentInstance.guardados).toHaveLength(0);
      expect(anfitrion.componentInstance.pregunta().questionText).toBe(
        '¿Cómo calificarías la atención?',
      );
    });

    it('cancelar no emite ningún guardado y descarta lo escrito', async () => {
      await abrir();
      escribir('Otro enunciado');
      await anfitrion.whenStable();

      botonPorTexto('Cancelar').click();
      await anfitrion.whenStable();

      // Con algo escrito, cerrar pregunta antes de tirarlo.
      expect(dialogs.pedidos).toHaveLength(1);
      expect(anfitrion.componentInstance.guardados).toHaveLength(0);
      expect(modal()).toBeNull();

      // Y al volver a abrir está lo guardado, no lo que se descartó.
      await abrir();
      const campo = modal()?.querySelector<HTMLInputElement>('[data-testid="editor-texto"] input');
      expect(campo?.value).toBe('¿Cómo calificarías la atención?');
    });

    it('si el descarte se rechaza, el modal sigue abierto y no se emitió nada', async () => {
      dialogs.respuesta = false;
      await abrir();
      escribir('Otro enunciado');
      await anfitrion.whenStable();

      botonPorTexto('Cancelar').click();
      await anfitrion.whenStable();

      expect(modal()).not.toBeNull();
      expect(anfitrion.componentInstance.guardados).toHaveLength(0);
    });

    it('cancelar devuelve el foco a quien abrió el modal', async () => {
      await abrir();

      botonPorTexto('Cancelar').click();
      await anfitrion.whenStable();

      expect(document.activeElement).toBe(disparador());
    });

    it('guardar emite una sola vez, cierra el modal y devuelve el foco', async () => {
      await abrir();
      escribir('Otro enunciado');
      await anfitrion.whenStable();

      botonDelModal('editor-guardar').click();
      await anfitrion.whenStable();

      expect(anfitrion.componentInstance.guardados).toHaveLength(1);
      expect(anfitrion.componentInstance.guardados[0]!.questionText).toBe('Otro enunciado');
      expect(modal()).toBeNull();
      expect(document.activeElement).toBe(disparador());
    });

    it('guardar no pregunta si quiero descartar lo que acabo de confirmar', async () => {
      await abrir();
      escribir('Otro enunciado');
      await anfitrion.whenStable();

      botonDelModal('editor-guardar').click();
      await anfitrion.whenStable();

      expect(dialogs.pedidos).toHaveLength(0);
    });
  });
});
