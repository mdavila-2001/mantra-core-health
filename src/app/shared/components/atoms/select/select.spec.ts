import { TestBed, type ComponentFixture } from '@angular/core/testing';

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
