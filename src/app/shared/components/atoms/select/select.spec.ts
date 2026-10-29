import { Component, computed, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { FormField } from '../../molecules/form-field/form-field';
import type { SelectOption } from './select.types';
import { SEARCH_FROM, Select } from './select';

interface Servicio {
  readonly id: number;
  readonly nombre: string;
}

describe('Select', () => {
  function crear<T>(
    options: SelectOption<T>[],
    value: T | null = null,
  ): ComponentFixture<Select<T>> {
    const fixture = TestBed.createComponent<Select<T>>(Select);
    fixture.componentRef.setInput('options', options);
    fixture.componentRef.setInput('value', value);
    return fixture;
  }

  function boton(fixture: ComponentFixture<unknown>): HTMLButtonElement {
    return fixture.nativeElement.querySelector('.select-trigger');
  }

  function dialogo(fixture: ComponentFixture<unknown>): HTMLDialogElement | null {
    return fixture.nativeElement.querySelector('dialog');
  }

  function filas(fixture: ComponentFixture<unknown>): HTMLLIElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="option"]'));
  }

  async function abrir(fixture: ComponentFixture<unknown>): Promise<void> {
    boton(fixture).click();
    await fixture.whenStable();
  }

  async function elegirIndice(fixture: ComponentFixture<unknown>, index: number): Promise<void> {
    await abrir(fixture);
    filas(fixture)[index].click();
    await fixture.whenStable();
  }

  async function tecla(fixture: ComponentFixture<unknown>, key: string): Promise<void> {
    const destino = fixture.nativeElement.querySelector('.search-input, .select-list');
    destino.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await fixture.whenStable();
  }

  const ONCE: SelectOption<string>[] = [
    'Cardiología',
    'Dermatología',
    'Ginecología',
    'Medicina general',
    'Neurología',
    'Oftalmología',
    'Otorrinolaringología',
    'Pediatría',
    'Psiquiatría',
    'Traumatología',
    'Urología',
  ].map((label) => ({ value: label, label }));

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Select] }).compileComponents();
  });

  describe('el tipo del valor sobrevive al DOM', () => {
    it('una opción numérica vuelve como número', async () => {
      const fixture = crear<number>([
        { value: 1, label: 'Uno' },
        { value: 2, label: 'Dos' },
      ]);
      await fixture.whenStable();

      await elegirIndice(fixture, 1);

      expect(fixture.componentInstance.value()).toBe(2);
      expect(typeof fixture.componentInstance.value()).toBe('number');
    });

    it('una opción objeto vuelve como el mismo objeto, no como "[object Object]"', async () => {
      const consulta: Servicio = { id: 10, nombre: 'Consulta' };
      const urgencia: Servicio = { id: 20, nombre: 'Urgencia' };
      const fixture = crear<Servicio>([
        { value: consulta, label: 'Consulta' },
        { value: urgencia, label: 'Urgencia' },
      ]);
      await fixture.whenStable();

      await elegirIndice(fixture, 1);

      expect(fixture.componentInstance.value()).toBe(urgencia);
    });

    it('reelegir mantiene la opción marcada (no se pierde la selección)', async () => {
      const fixture = crear<number>(
        [
          { value: 1, label: 'Uno' },
          { value: 2, label: 'Dos' },
        ],
        1,
      );
      await fixture.whenStable();

      await elegirIndice(fixture, 1);
      await elegirIndice(fixture, 1);

      expect(boton(fixture).textContent?.trim()).toBe('Dos');
      expect(fixture.componentInstance.value()).toBe(2);
    });
  });

  describe('placeholder', () => {
    it('sin selección el campo muestra el placeholder, apagado', async () => {
      const fixture = crear<string>([{ value: 'a', label: 'A' }]);
      fixture.componentRef.setInput('placeholder', 'Elija un servicio');
      await fixture.whenStable();

      const valor = fixture.nativeElement.querySelector('.select-value');
      expect(valor.textContent.trim()).toBe('Elija un servicio');
      expect(valor.classList).toContain('is-placeholder');
    });

    it('el placeholder no es una opción de la lista', async () => {
      const fixture = crear<string>([{ value: 'a', label: 'A' }]);
      fixture.componentRef.setInput('placeholder', 'Elija un servicio');
      await fixture.whenStable();
      await abrir(fixture);

      expect(filas(fixture).map((fila) => fila.textContent?.trim())).toEqual(['A']);
    });

    /**
     * El desplegable que **nace** con valor tiene que mostrarlo. Con el
     * `<select>` nativo no era obvio —se escribía el valor antes de que
     * existieran las opciones—; lo destapó el selector de recurso de la agenda.
     */
    it('el que nace con valor muestra su opción, no el placeholder', async () => {
      const fixture = crear<string>(
        [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
        'b',
      );
      fixture.componentRef.setInput('placeholder', 'Seleccionar opción');
      await fixture.whenStable();

      expect(boton(fixture).textContent?.trim()).toBe('B');
    });

    /** Y el que recibe sus opciones después —lo normal con datos remotos—. */
    it('marca la opción cuando las opciones llegan después del valor', async () => {
      const fixture = crear<string>([], 'b');
      await fixture.whenStable();
      expect(boton(fixture).textContent?.trim()).toBe('Seleccionar opción');

      fixture.componentRef.setInput('options', [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ]);
      await fixture.whenStable();

      expect(boton(fixture).textContent?.trim()).toBe('B');
    });
  });

  describe('el modal', () => {
    it('se abre al tocar el campo y se cierra al elegir', async () => {
      const fixture = crear<string>([
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ]);
      await fixture.whenStable();
      expect(dialogo(fixture)).toBeNull();

      await abrir(fixture);
      expect(dialogo(fixture)?.open).toBe(true);
      expect(boton(fixture).getAttribute('aria-expanded')).toBe('true');

      filas(fixture)[0].click();
      await fixture.whenStable();
      expect(dialogo(fixture)).toBeNull();
      expect(document.activeElement).toBe(boton(fixture));
    });

    it('elegir libera la página en el acto: el modal no sigue abierto mientras sale el panel', async () => {
      // Con animación de salida posible (en jsdom no existe `animate`) el panel
      // tarda 140 ms en irse y el `<dialog>` sigue siendo modal: la página de
      // atrás está inerte y lo que se escribe en el campo de al lado se pierde.
      // Una salida que nunca termina deja a la vista si elegir espera por ella.
      const original = HTMLElement.prototype.animate;
      HTMLElement.prototype.animate = (() => ({
        finished: new Promise<void>(() => undefined),
        cancel: () => undefined,
      })) as unknown as typeof HTMLElement.prototype.animate;
      try {
        const fixture = crear<string>([
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]);
        await fixture.whenStable();
        await abrir(fixture);

        filas(fixture)[1].click();
        await fixture.whenStable();

        expect(fixture.componentInstance.value()).toBe('b');
        expect(dialogo(fixture)).toBeNull();
        expect(boton(fixture).getAttribute('aria-expanded')).toBe('false');
      } finally {
        HTMLElement.prototype.animate = original;
      }
    });

    it('descartar sí anima la salida: Escape espera a que el panel se vaya', async () => {
      const original = HTMLElement.prototype.animate;
      let terminar: () => void = () => undefined;
      HTMLElement.prototype.animate = (() => ({
        finished: new Promise<void>((resolve) => {
          terminar = resolve;
        }),
        cancel: () => undefined,
      })) as unknown as typeof HTMLElement.prototype.animate;
      try {
        const fixture = crear<string>([{ value: 'a', label: 'A' }]);
        await fixture.whenStable();
        await abrir(fixture);

        await tecla(fixture, 'Escape');
        expect(dialogo(fixture)).not.toBeNull();

        terminar();
        await Promise.resolve();
        fixture.detectChanges();
        await fixture.whenStable();
        expect(dialogo(fixture)).toBeNull();
        expect(fixture.componentInstance.value()).toBeNull();
      } finally {
        HTMLElement.prototype.animate = original;
      }
    });

    it('marca la elegida con aria-selected', async () => {
      const fixture = crear<string>(
        [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
        'b',
      );
      await fixture.whenStable();
      await abrir(fixture);

      expect(filas(fixture).map((fila) => fila.getAttribute('aria-selected'))).toEqual([
        'false',
        'true',
      ]);
    });

    it('muestra la descripción de cada opción en segunda línea', async () => {
      const fixture = crear<string>([
        { value: 'p', label: 'Provisional', description: 'Sospecha, falta confirmar' },
      ]);
      await fixture.whenStable();
      await abrir(fixture);

      expect(fixture.nativeElement.querySelector('.option-description').textContent).toContain(
        'Sospecha, falta confirmar',
      );
    });

    it('Escape cierra sin elegir y devuelve el foco al campo', async () => {
      const fixture = crear<string>([{ value: 'a', label: 'A' }]);
      await fixture.whenStable();
      await abrir(fixture);

      await tecla(fixture, 'Escape');

      expect(dialogo(fixture)).toBeNull();
      expect(fixture.componentInstance.value()).toBeNull();
      expect(document.activeElement).toBe(boton(fixture));
    });

    it('el teclado del modal no sube: dentro de otro diálogo, Escape no lo cierra', async () => {
      const fixture = crear<string>([{ value: 'a', label: 'A' }]);
      await fixture.whenStable();
      const deAfuera = vi.fn();
      fixture.nativeElement.addEventListener('keydown', deAfuera);
      await abrir(fixture);

      await tecla(fixture, 'Escape');

      expect(dialogo(fixture)).toBeNull();
      expect(deAfuera).not.toHaveBeenCalled();
    });

    it('con el teclado: flecha abajo y Enter eligen la siguiente', async () => {
      const fixture = crear<string>(
        [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
          { value: 'c', label: 'C' },
        ],
        'a',
      );
      await fixture.whenStable();
      await abrir(fixture);

      await tecla(fixture, 'ArrowDown');
      await tecla(fixture, 'Enter');

      expect(fixture.componentInstance.value()).toBe('b');
    });

    it(`sin buscador hasta ${SEARCH_FROM} opciones`, async () => {
      const fixture = crear<string>(ONCE.slice(0, SEARCH_FROM));
      await fixture.whenStable();
      await abrir(fixture);

      expect(fixture.nativeElement.querySelector('.search-input')).toBeNull();
    });

    it('con más opciones busca sin tildes, por etiqueta y descripción', async () => {
      const fixture = crear<string>(ONCE);
      await fixture.whenStable();
      await abrir(fixture);

      const buscador: HTMLInputElement = fixture.nativeElement.querySelector('.search-input');
      expect(document.activeElement).toBe(buscador);
      buscador.value = 'pediatria';
      buscador.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(filas(fixture).map((fila) => fila.textContent?.trim())).toEqual(['Pediatría']);
      await tecla(fixture, 'Enter');
      expect(fixture.componentInstance.value()).toBe('Pediatría');
    });

    it('una búsqueda sin coincidencias lo dice', async () => {
      const fixture = crear<string>(ONCE);
      await fixture.whenStable();
      await abrir(fixture);

      const buscador: HTMLInputElement = fixture.nativeElement.querySelector('.search-input');
      buscador.value = 'zzz';
      buscador.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(fixture.nativeElement.querySelector('.select-empty').textContent).toContain(
        'Ninguna opción coincide',
      );
    });

    it('deshabilitado no se abre', async () => {
      const fixture = crear<string>([{ value: 'a', label: 'A' }]);
      fixture.componentRef.setInput('disabled', true);
      await fixture.whenStable();

      expect(boton(fixture).disabled).toBe(true);
    });
  });

  /**
   * El `placeholder` **no nombra al control**. Sin `ariaLabel`, un desplegable
   * suelto no dice de qué es. Lo encontró la auditoría de axe sobre el paginado.
   */
  describe('nombre accesible', () => {
    it('suelto, `ariaLabel` nombra al control', async () => {
      const fixture = crear<string>([{ value: 'a', label: 'A' }]);
      fixture.componentRef.setInput('ariaLabel', 'Resultados por página');
      await fixture.whenStable();

      expect(boton(fixture).getAttribute('aria-label')).toBe('Resultados por página');
    });

    it('sin `ariaLabel` no inventa uno: el placeholder no cuenta', async () => {
      const fixture = crear<string>([{ value: 'a', label: 'A' }]);
      fixture.componentRef.setInput('placeholder', 'Elegir sede');
      await fixture.whenStable();

      expect(boton(fixture).hasAttribute('aria-label')).toBe(false);
    });

    it('dentro de un campo se ignora: el `<label>` manda, y titula el modal', async () => {
      const fixture = TestBed.createComponent(SelectEnCampo);
      await fixture.whenStable();

      const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.select-trigger');
      expect(trigger.hasAttribute('aria-label')).toBe(false);

      const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
      expect(label.control).toBe(trigger);

      trigger.click();
      await fixture.whenStable();
      expect(fixture.nativeElement.querySelector('.dialog-title').textContent.trim()).toBe(
        'Tipo de sangre',
      );
    });
  });

  it('respeta las opciones deshabilitadas', async () => {
    const fixture = crear<string>([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
    ]);
    await fixture.whenStable();
    await abrir(fixture);

    const deshabilitada = filas(fixture)[1];
    expect(deshabilitada.getAttribute('aria-disabled')).toBe('true');
    deshabilitada.click();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBeNull();
  });

  /**
   * Lo encontró la prueba en navegador del perfil del paciente: la pantalla
   * arma un arreglo nuevo de opciones cada vez que cambia el valor, y eso
   * volvía a abrir el modal justo al elegir —el foco quedaba en el `body` y
   * el velo, puesto—.
   */
  it('elegir no reabre el modal aunque la pantalla entregue opciones nuevas', async () => {
    const fixture = TestBed.createComponent(SelectConOpcionesNuevas);
    await fixture.whenStable();
    const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.select-trigger');

    trigger.click();
    await fixture.whenStable();
    fixture.nativeElement.querySelectorAll('[role="option"]')[1].click();
    await fixture.whenStable();

    expect(fixture.componentInstance.valor()).toBe('b');
    expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  describe('con un formulario', () => {
    it('abrir el modal no marca el campo como tocado; elegir avisa al formulario', async () => {
      const fixture = TestBed.createComponent(SelectConFormulario);
      await fixture.whenStable();
      const control = fixture.componentInstance.control;

      const trigger: HTMLButtonElement = fixture.nativeElement.querySelector('.select-trigger');
      trigger.focus();
      trigger.click();
      await fixture.whenStable();
      expect(control.touched).toBe(false);

      fixture.nativeElement.querySelectorAll('[role="option"]')[1].click();
      await fixture.whenStable();
      expect(control.value).toBe('b');
    });
  });
});

@Component({
  imports: [FormField, Select],
  template: `
    <app-form-field label="Tipo de sangre">
      <app-select ariaLabel="Otro nombre" [options]="opciones()" />
    </app-form-field>
  `,
})
class SelectEnCampo {
  readonly opciones = signal<SelectOption<string>[]>([{ value: 'a+', label: 'A positivo' }]);
}

@Component({
  imports: [ReactiveFormsModule, Select],
  template: `<app-select [formControl]="control" [options]="opciones" />`,
})
class SelectConFormulario {
  readonly control = new FormControl<string | null>(null);
  readonly opciones: SelectOption<string>[] = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
  ];
}

@Component({
  imports: [Select],
  template: `<app-select [(value)]="valor" [options]="opciones()" />`,
})
class SelectConOpcionesNuevas {
  readonly valor = signal<string | null>('a');
  // Un arreglo nuevo en cada cambio de valor, como hace la pantalla del perfil.
  readonly opciones = computed<SelectOption<string>[]>(() => {
    this.valor();
    return [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ];
  });
}
