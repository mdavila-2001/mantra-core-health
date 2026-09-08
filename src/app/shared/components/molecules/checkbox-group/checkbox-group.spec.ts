import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';

import { CheckboxGroup, type OpcionDeCasilla } from './checkbox-group';
import { FormField } from '../form-field/form-field';

const OPCIONES: readonly OpcionDeCasilla[] = [
  { value: 'Tabaquismo', label: 'Tabaquismo' },
  { value: 'Hipertensión', label: 'Hipertensión' },
  { value: 'Diabetes', label: 'Diabetes' },
];

/**
 * El grupo **dentro de un `app-form-field`**, que es como se monta de verdad.
 *
 * Suelto no reproduce nada: el defecto que se ataja acá nace justamente de que
 * el campo provee un `id` pensado para un control y las casillas son varias.
 */
@Component({
  imports: [CheckboxGroup, FormField, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <app-form-field label="Factores de riesgo">
        <app-checkbox-group formControlName="factores" [options]="opciones()" />
      </app-form-field>
    </form>
  `,
})
class Host {
  readonly opciones = signal(OPCIONES);
  readonly form = new FormGroup({
    factores: new FormControl<readonly string[]>([], { nonNullable: true }),
  });
}

describe('CheckboxGroup', () => {
  let fixture: ComponentFixture<Host>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  function casillas(): HTMLInputElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('app-checkbox input'));
  }

  function etiquetas(): HTMLLabelElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('app-checkbox label'));
  }

  function guardado(): readonly string[] {
    return fixture.componentInstance.form.controls.factores.value;
  }

  /** Pulsa la etiqueta, que es lo que pulsa una persona. */
  function pulsarEtiqueta(indice: number): void {
    etiquetas()[indice]!.click();
    fixture.detectChanges();
  }

  it('cada casilla tiene su propio id y su label apunta a ella', () => {
    // La regresión que esto ataja: `app-checkbox` toma el `id` del campo cuando
    // hay uno, y con cinco casillas bajo el mismo `app-form-field` las cinco
    // recibían el mismo. Los cinco `<label for>` apuntaban al primero, así que
    // pulsar «Diabetes» marcaba «Tabaquismo» — y los ids repetidos dejaban a un
    // lector de pantalla leyendo cinco veces la misma etiqueta.
    const ids = casillas().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const [i, label] of etiquetas().entries()) {
      expect(label.getAttribute('for')).toBe(ids[i]);
    }
  });

  it('pulsar la etiqueta marca ESA casilla y no la primera', () => {
    pulsarEtiqueta(2);

    expect(guardado()).toEqual(['Diabetes']);
    expect(casillas()[2]!.checked).toBe(true);
    expect(casillas()[0]!.checked).toBe(false);
  });

  it('marcar una segunda conserva la primera', () => {
    pulsarEtiqueta(0);
    pulsarEtiqueta(2);

    expect(guardado()).toEqual(['Tabaquismo', 'Diabetes']);
  });

  it('guarda en el orden de la lista y no en el de los clics', () => {
    // La respuesta se lee después en una ficha clínica: tiene que leerse en el
    // mismo orden en que se ofreció.
    pulsarEtiqueta(2);
    pulsarEtiqueta(0);

    expect(guardado()).toEqual(['Tabaquismo', 'Diabetes']);
  });

  it('desmarcar quita sólo esa', () => {
    pulsarEtiqueta(0);
    pulsarEtiqueta(1);
    pulsarEtiqueta(0);

    expect(guardado()).toEqual(['Hipertensión']);
  });

  it('el formulario escribe en el grupo y se refleja en las casillas', () => {
    fixture.componentInstance.form.controls.factores.setValue(['Hipertensión']);
    fixture.detectChanges();

    expect(casillas()[1]!.checked).toBe(true);
    expect(casillas()[0]!.checked).toBe(false);
  });

  it('tolera que el control traiga algo que no sea un array', () => {
    // `''` es lo que deja un `FormControl` sin valor inicial, y
    // `''.includes(opcion)` respondería que sí a cualquier subcadena.
    fixture.componentInstance.form.controls.factores.setValue('' as unknown as string[]);
    fixture.detectChanges();

    expect(casillas().every((c) => !c.checked)).toBe(true);
  });

  it('deshabilitado por el formulario no deja marcar', () => {
    fixture.componentInstance.form.controls.factores.disable();
    fixture.detectChanges();

    pulsarEtiqueta(0);

    expect(fixture.componentInstance.form.controls.factores.value).toEqual([]);
  });

  it('el grupo se nombra por el label del campo y no con `for`', () => {
    // Un grupo no es «etiquetable»: el `for` no puede apuntarle, así que se
    // nombra con `aria-labelledby`. Sin esto queda sin nombre accesible.
    const grupo = fixture.nativeElement.querySelector('app-checkbox-group');
    const label = fixture.nativeElement.querySelector('.form-field-label');

    expect(grupo.getAttribute('role')).toBe('group');
    expect(grupo.getAttribute('aria-labelledby')).toBe(label.id);
    expect(label.getAttribute('for')).toBeNull();
  });
});
