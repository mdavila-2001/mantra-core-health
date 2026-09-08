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

/** El mismo grupo, con «Otro» y su renglón. */
@Component({
  imports: [CheckboxGroup, FormField, ReactiveFormsModule],
  template: `
    <form [formGroup]="form">
      <app-form-field label="Factores de riesgo">
        <app-checkbox-group formControlName="factores" [options]="opciones()" allowOther />
      </app-form-field>
    </form>
  `,
})
class HostConOtro extends Host {}

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

describe('CheckboxGroup con «Otro»', () => {
  let fixture: ComponentFixture<HostConOtro>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostConOtro] }).compileComponents();
    fixture = TestBed.createComponent(HostConOtro);
    fixture.detectChanges();
  });

  function guardado(): readonly string[] {
    return fixture.componentInstance.form.controls.factores.value;
  }

  function casillaOtro(): HTMLInputElement {
    return fixture.nativeElement.querySelector('[data-testid="checkbox-group-otro"] input');
  }

  function renglon(): HTMLInputElement {
    return fixture.nativeElement.querySelector('[data-testid="checkbox-group-otro-texto"]');
  }

  function escribir(texto: string): void {
    renglon().value = texto;
    renglon().dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('ofrece una casilla más, con su renglón', () => {
    expect(casillaOtro()).not.toBeNull();
    expect(renglon()).not.toBeNull();
  });

  it('lo escrito va al array como texto, después de las de la lista', () => {
    // El texto y no un código «otro»: es lo que después se lee en la ficha.
    // Al final, por la misma regla del orden: primero lo que se ofreció.
    escribir('Sedentarismo');
    fixture.nativeElement.querySelectorAll('app-checkbox label')[0]!.click();
    fixture.detectChanges();

    expect(guardado()).toEqual(['Tabaquismo', 'Sedentarismo']);
    expect(casillaOtro().checked).toBe(true);
  });

  it('«Otro» marcado sin texto no mete una cadena vacía', () => {
    fixture.nativeElement.querySelector('[data-testid="checkbox-group-otro"] label')!.click();
    fixture.detectChanges();

    expect(casillaOtro().checked).toBe(true);
    expect(guardado()).toEqual([]);
  });

  it('desmarcar «Otro» saca el texto del array y lo conserva en el renglón', () => {
    escribir('Sedentarismo');
    fixture.nativeElement.querySelector('[data-testid="checkbox-group-otro"] label')!.click();
    fixture.detectChanges();

    expect(guardado()).toEqual([]);
    expect(renglon().value).toBe('Sedentarismo');
  });

  it('un valor guardado con texto libre vuelve con «Otro» marcado y el renglón escrito', () => {
    // Es lo que hace que releer una ficha muestre lo que se respondió.
    fixture.componentInstance.form.controls.factores.setValue(['Diabetes', 'Estrés']);
    fixture.detectChanges();

    expect(casillaOtro().checked).toBe(true);
    expect(renglon().value).toBe('Estrés');
  });
});
