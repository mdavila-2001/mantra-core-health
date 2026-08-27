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

  function disparador(): HTMLButtonElement {
    const element = fixture.nativeElement.querySelector('.pais__disparador');
    if (!(element instanceof HTMLButtonElement)) {
      throw new Error('el selector de país no está en el DOM');
    }
    return element;
  }

  /** Abre el desplegable y devuelve sus filas, en el orden en que se ven. */
  function abrirPaises(): HTMLElement[] {
    disparador().click();
    fixture.detectChanges();
    return Array.from(fixture.nativeElement.querySelectorAll('[role="option"]'));
  }

  /** Elige un país por su nombre, como lo haría alguien con el ratón. */
  function elegirPais(nombre: string): void {
    const fila = abrirPaises().find((o) => o.textContent?.includes(nombre));
    if (!fila) {
      throw new Error(`el país «${nombre}» no está en el desplegable`);
    }
    fila.click();
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
    const prefijo = fixture.nativeElement.querySelector('.pais__prefijo');
    expect(prefijo?.textContent?.trim()).toBe('+591');
    expect(input().value).toBe('');
  });

  it('abre en Bolivia: el país del producto, sin que nadie elija', () => {
    // El desplegable es nuevo; que el caso de siempre siga siendo cero clics
    // es la condición para haberlo agregado.
    expect(disparador().getAttribute('aria-label')).toContain('Bolivia');
    expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();
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

  describe('selector de país', () => {
    it('cambiar de país cambia el prefijo que se guarda', () => {
      escribir('70012345');
      elegirPais('Argentina');

      // El número tecleado no se pierde: lo que cambia es bajo qué prefijo se
      // guarda, que es justo lo que la persona pidió al cambiar de país.
      expect(host.control.value).toBe('+54 70012345');
    });

    it('el número se agrupa como agrupa el país elegido', () => {
      elegirPais('Brasil');
      escribir('11912345678');

      // `11 91234 5678` y no `1191 2345 678`: un número brasileño se lee así, y
      // agrupar todo de a cuatro sería una regla que ningún país usa.
      expect(input().value).toBe('11 91234 5678');
      expect(host.control.value).toBe('+55 11912345678');
    });

    it('cambiar a un país de números más cortos recorta, y se ve', () => {
      elegirPais('Brasil');
      escribir('11912345678');
      elegirPais('Bolivia');

      // Guardar once dígitos bajo `+591` produciría un teléfono que no existe.
      // El recorte es la decisión menos mala, y ocurre a la vista.
      expect(input().value).toBe('1191 2345');
      expect(host.control.value).toBe('+591 11912345');
    });

    it('abre en el país del número que el formulario escribe', () => {
      // Sin esto, un teléfono argentino ya guardado abriría con la bandera de
      // Bolivia y ocho dígitos: el campo mostraría un número que no es el que
      // tiene.
      host.control.setValue('+54 1134567890');
      fixture.detectChanges();

      expect(disparador().getAttribute('aria-label')).toContain('Argentina');
      expect(input().value).toBe('113 456 7890');
    });

    it('reconoce el prefijo más específico, no el más corto', () => {
      // `+591` empieza igual que `+59`, y `+1` es prefijo de casi todo: buscando
      // de corto a largo, un número boliviano se leería como estadounidense.
      host.control.setValue('+591 70012345');
      fixture.detectChanges();

      expect(disparador().getAttribute('aria-label')).toContain('Bolivia');
      expect(input().value).toBe('7001 2345');
    });

    it('el marcador es el del país elegido', () => {
      expect(input().placeholder).toBe('7001 2345');

      elegirPais('España');

      // Un marcador boliviano en un campo español enseñaría un largo que ese
      // país no usa.
      expect(input().placeholder).toBe('612 345 678');
    });

    it('se recorre y se elige con el teclado', () => {
      abrirPaises();
      const lista = fixture.nativeElement.querySelector('[role="listbox"]') as HTMLElement;

      lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      fixture.detectChanges();
      lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      fixture.detectChanges();

      // Bolivia es la primera; una flecha abajo cae en Argentina.
      expect(disparador().getAttribute('aria-label')).toContain('Argentina');
      expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();
    });

    it('Escape cierra sin cambiar el país', () => {
      abrirPaises();
      const lista = fixture.nativeElement.querySelector('[role="listbox"]') as HTMLElement;

      lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      fixture.detectChanges();
      lista.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();
      expect(disparador().getAttribute('aria-label')).toContain('Bolivia');
    });

    it('deshabilitado no abre', () => {
      host.control.disable();
      fixture.detectChanges();

      disparador().click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="listbox"]')).toBeNull();
    });
  });
});
