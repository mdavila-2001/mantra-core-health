import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { Checkbox } from '../atoms/checkbox/checkbox';
import { Input } from '../atoms/input/input';
import { Select } from '../atoms/select/select';
import type { SelectOption } from '../atoms/input/input.types';

/**
 * El contrato de estas pruebas es el de sustitución: un átomo enchufado a un
 * `FormControl` tiene que comportarse como su control nativo, sin que el
 * formulario se entere de que hay un componente en el medio.
 */
@Component({
  selector: 'app-host-formulario',
  imports: [ReactiveFormsModule, Input, Checkbox, Select],
  template: `
    <form [formGroup]="form">
      <app-input formControlName="nombre" />
      <app-input formControlName="edad" type="number" />
      <app-checkbox formControlName="acepta" />
      <app-select formControlName="tipo" [options]="opciones" />
    </form>
  `,
})
class Host {
  readonly opciones: readonly SelectOption<string>[] = [
    { value: 'consulta', label: 'Consulta' },
    { value: 'urgencia', label: 'Urgencia' },
  ];

  readonly form = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    edad: new FormControl<number | null>(null),
    acepta: new FormControl(false, { nonNullable: true }),
    tipo: new FormControl<string | null>(null),
  });
}

/** Control suelto, sin formulario: el uso que existía antes del CVA. */
@Component({
  selector: 'app-host-suelto',
  imports: [Input],
  template: `<app-input [(value)]="texto" />`,
})
class HostSuelto {
  readonly texto = signal<string | number | null>('inicial');
}

describe('ControlValueAccessor de los átomos de formulario', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  function nativo<T extends HTMLElement>(selector: string, indice = 0): T {
    return fixture.nativeElement.querySelectorAll(selector)[indice] as T;
  }

  describe('del formulario hacia el control (writeValue)', () => {
    it('setValue llega al input nativo', async () => {
      host.form.controls.nombre.setValue('Ana Paz');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(nativo<HTMLInputElement>('input.native-input').value).toBe('Ana Paz');
    });

    it('setValue llega a la casilla', async () => {
      host.form.controls.acepta.setValue(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(nativo<HTMLInputElement>('input[type=checkbox]').checked).toBe(true);
    });

    it('setValue posiciona el desplegable en la opción correcta', async () => {
      host.form.controls.tipo.setValue('urgencia');
      fixture.detectChanges();
      await fixture.whenStable();

      // El <option> lleva el indice, no el valor: 'urgencia' es el segundo.
      expect(nativo<HTMLSelectElement>('select').value).toBe('1');
    });

    it('reset deja los controles vacíos', async () => {
      host.form.controls.nombre.setValue('Ana');
      fixture.detectChanges();
      host.form.reset();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(nativo<HTMLInputElement>('input.native-input').value).toBe('');
    });
  });

  describe('del control hacia el formulario (registerOnChange)', () => {
    it('escribir en el input actualiza el formulario', async () => {
      const input = nativo<HTMLInputElement>('input.native-input');
      input.value = 'Bruno';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(host.form.controls.nombre.value).toBe('Bruno');
    });

    it('el 0 de un campo numérico llega como número, no como texto ni como null', async () => {
      const edad = nativo<HTMLInputElement>('input.native-input', 1);
      edad.value = '0';
      edad.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(host.form.controls.edad.value).toBe(0);
      expect(typeof host.form.controls.edad.value).toBe('number');
    });

    it('marcar la casilla actualiza el formulario', async () => {
      const casilla = nativo<HTMLInputElement>('input[type=checkbox]');
      casilla.checked = true;
      casilla.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(host.form.controls.acepta.value).toBe(true);
    });

    it('elegir una opción manda el valor original, no el índice', async () => {
      const select = nativo<HTMLSelectElement>('select');
      select.value = '0';
      select.dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(host.form.controls.tipo.value).toBe('consulta');
    });
  });

  describe('estado del formulario', () => {
    it('el formulario arranca intacto y el blur lo marca tocado', async () => {
      expect(host.form.controls.nombre.touched).toBe(false);

      nativo<HTMLInputElement>('input.native-input').dispatchEvent(new FocusEvent('blur'));
      await fixture.whenStable();

      expect(host.form.controls.nombre.touched).toBe(true);
    });

    it('disable() deshabilita el control nativo', async () => {
      host.form.controls.nombre.disable();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(nativo<HTMLInputElement>('input.native-input').disabled).toBe(true);

      host.form.controls.nombre.enable();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(nativo<HTMLInputElement>('input.native-input').disabled).toBe(false);
    });

    it('disable() alcanza también a la casilla y al desplegable', async () => {
      host.form.disable();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(nativo<HTMLInputElement>('input[type=checkbox]').disabled).toBe(true);
      expect(nativo<HTMLSelectElement>('select').disabled).toBe(true);
    });

    it('los validadores del formulario ven el valor del átomo', async () => {
      expect(host.form.controls.nombre.hasError('required')).toBe(true);

      const input = nativo<HTMLInputElement>('input.native-input');
      input.value = 'Ana';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();

      expect(host.form.controls.nombre.hasError('required')).toBe(false);
      expect(host.form.controls.nombre.valid).toBe(true);
    });
  });

  it('el uso suelto con [(value)] sigue funcionando sin formulario', async () => {
    const sueltoFixture = TestBed.createComponent(HostSuelto);
    await sueltoFixture.whenStable();

    const input = sueltoFixture.nativeElement.querySelector(
      'input.native-input',
    ) as HTMLInputElement;
    expect(input.value).toBe('inicial');

    input.value = 'editado';
    input.dispatchEvent(new Event('input'));
    await sueltoFixture.whenStable();

    expect(sueltoFixture.componentInstance.texto()).toBe('editado');
  });
});
