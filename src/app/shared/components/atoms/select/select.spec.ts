import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FormField } from '../../molecules/form-field/form-field';
import type { SelectOption } from './select.types';
import { Select } from './select';

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

  function native(fixture: ComponentFixture<unknown>): HTMLSelectElement {
    return fixture.nativeElement.querySelector('select');
  }

  async function elegirIndice(fixture: ComponentFixture<unknown>, index: number): Promise<void> {
    const select = native(fixture);
    select.value = String(index);
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

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
      await fixture.whenStable();

      expect(native(fixture).value).toBe('1');
      expect(fixture.componentInstance.value()).toBe(2);
    });
  });

  describe('placeholder', () => {
    it('queda oculto de la lista pero seleccionable por el propio control', async () => {
      const fixture = crear<string>([{ value: 'a', label: 'A' }]);
      fixture.componentRef.setInput('placeholder', 'Elegí un servicio');
      await fixture.whenStable();

      const placeholder: HTMLOptionElement = fixture.nativeElement.querySelector('option');
      expect(placeholder.hidden).toBe(true);
      // NO va `disabled`: el navegador se niega a seleccionar una opción
      // deshabilitada y el placeholder nunca llegaría a mostrarse.
      expect(placeholder.disabled).toBe(false);
      expect(placeholder.textContent?.trim()).toBe('Elegí un servicio');
    });

    it('sin selección el select queda en el placeholder', async () => {
      const fixture = crear<string>([{ value: 'a', label: 'A' }]);
      await fixture.whenStable();

      expect(native(fixture).value).toBe('');
    });

    /**
     * El desplegable que **nace** con valor tiene que mostrarlo.
     *
     * Parece obvio y no lo era: la selección se aplicaba con un `[value]` sobre
     * el `<select>`, y en el primer pase Angular escribe las propiedades del
     * elemento **antes** de crear los `<option>` del `@for`. `select.value = "1"`
     * sobre un select sin opciones no hace nada, así que quedaba en la primera
     * —el placeholder oculto— y la pantalla decía «Seleccionar opción» con un
     * valor elegido.
     *
     * No se veía con formularios, que escriben el valor **después** de montar.
     * Lo destapó el recorrido con usuarios reales en el selector de recurso de
     * la agenda, que nace con el primer recurso ya elegido.
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

      expect(native(fixture).value).toBe('1');
      expect(native(fixture).selectedIndex).toBe(2); // 0 es el placeholder
    });

    /** Y el que recibe sus opciones después —lo normal con datos remotos—. */
    it('marca la opción cuando las opciones llegan después del valor', async () => {
      const fixture = crear<string>([], 'b');
      await fixture.whenStable();
      expect(native(fixture).value).toBe('');

      fixture.componentRef.setInput('options', [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ]);
      await fixture.whenStable();

      expect(native(fixture).value).toBe('1');
    });
  });

  /**
   * El `placeholder` **no nombra al control**: se renderiza como un
   * `<option hidden>` y el lector de pantalla lo lee como una opción, no como
   * de qué es el desplegable. Sin `ariaLabel`, un `<select>` suelto se anuncia
   * como «cuadro combinado» y nada más.
   *
   * Lo encontró la auditoría de axe (`select-name`, crítico) sobre el paginado.
   */
  describe('nombre accesible', () => {
    it('suelto, `ariaLabel` nombra al control', async () => {
      const fixture = crear<string>([{ value: 'a', label: 'A' }]);
      fixture.componentRef.setInput('ariaLabel', 'Resultados por página');
      await fixture.whenStable();

      expect(native(fixture).getAttribute('aria-label')).toBe('Resultados por página');
    });

    it('sin `ariaLabel` no inventa uno: el placeholder no cuenta', async () => {
      const fixture = crear<string>([{ value: 'a', label: 'A' }]);
      fixture.componentRef.setInput('placeholder', 'Elegir sede');
      await fixture.whenStable();

      expect(native(fixture).hasAttribute('aria-label')).toBe(false);
    });

    it('dentro de un campo se ignora: el `<label>` manda', async () => {
      const fixture = TestBed.createComponent(SelectEnCampo);
      await fixture.whenStable();

      // Un `aria-label` acá ganaría por precedencia y el lector diría algo
      // distinto de lo que está escrito en pantalla. Ese desacuerdo silencioso
      // es peor que no tener la vía de escape.
      const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
      expect(select.hasAttribute('aria-label')).toBe(false);

      const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
      expect(label.control).toBe(select);
    });
  });

  it('respeta las opciones deshabilitadas', async () => {
    const fixture = crear<string>([
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B', disabled: true },
    ]);
    await fixture.whenStable();

    const options: HTMLOptionElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('option'),
    );
    expect(options.at(-1)?.disabled).toBe(true);
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
