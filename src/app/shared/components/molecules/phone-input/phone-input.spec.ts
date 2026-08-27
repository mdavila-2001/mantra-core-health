import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { PhoneInput } from './phone-input';

@Component({
  imports: [PhoneInput, ReactiveFormsModule],
  template: `<app-phone-input [formControl]="control" testId="telefono" />`,
})
class Host {
  readonly control = new FormControl('', { nonNullable: true });
}

describe('PhoneInput', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  function input(): HTMLInputElement {
    const element = fixture.nativeElement.querySelector('input');
    if (!(element instanceof HTMLInputElement)) {
      throw new Error('el <input> del teléfono no está en el DOM');
    }
    return element;
  }

  /** Escribe como la persona: el átomo emite `input`, no `change`. */
  function escribir(texto: string): void {
    const campo = input();
    campo.value = texto;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('el prefijo lo pone el campo: se ve y no se escribe', () => {
    // Es la mitad del arreglo: con el prefijo tecleado a mano, la mitad de la
    // base quedaba con `+591` y la otra mitad sin él.
    const prefijo = fixture.nativeElement.querySelector('.telefono__prefijo');
    expect(prefijo?.textContent?.trim()).toBe('+591');
    expect(input().value).toBe('');
  });

  it('guarda el número completo aunque se vea agrupado', () => {
    escribir('70012345');

    // Lo que se ve ayuda a leer; lo que se guarda es lo que valida el backend.
    expect(input().value).toBe('7001 2345');
    expect(host.control.value).toBe('+591 70012345');
  });

  it('descarta lo que no es dígito, en vez de dejarlo llegar al formulario', () => {
    escribir('(700) 12-345');

    expect(host.control.value).toBe('+591 70012345');
  });

  it('quita el prefijo de un número pegado desde una agenda', () => {
    // `+591 70012345`, `591 70012345` y `70012345` son el mismo teléfono: los
    // tres tienen que terminar en el mismo valor guardado.
    escribir('+591 70012345');

    expect(host.control.value).toBe('+591 70012345');
    expect(input().value).toBe('7001 2345');
  });

  it('corta en ocho dígitos: un número boliviano no tiene nueve', () => {
    escribir('700123456789');

    expect(host.control.value).toBe('+591 70012345');
  });

  it('vacío guarda vacío, no un prefijo suelto', () => {
    escribir('70012345');
    escribir('');

    // `+591` sin número es un teléfono que no existe, y el alta lo mandaría
    // como si lo fuera.
    expect(host.control.value).toBe('');
  });

  it('muestra lo que el formulario escribe, ya sin prefijo', () => {
    host.control.setValue('+591 76543210');
    fixture.detectChanges();

    expect(input().value).toBe('7654 3210');
  });

  it('el formulario puede deshabilitarlo', () => {
    host.control.disable();
    fixture.detectChanges();

    expect(input().disabled).toBe(true);
  });
});
