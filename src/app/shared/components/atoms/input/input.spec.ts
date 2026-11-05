import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { fieldKindMessage } from '@shared/forms/field-kinds';
import { Input } from './input';

@Component({
  imports: [Input, ReactiveFormsModule],
  template: `<app-input [formControl]="correo" fieldKind="email" />`,
})
class AnfitrionConFormulario {
  readonly correo = new FormControl('', { nonNullable: true });
}

describe('Input', () => {
  let fixture: ComponentFixture<Input>;

  function native(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input');
  }

  async function escribir(text: string): Promise<void> {
    native().value = text;
    native().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function desenfocar(): Promise<void> {
    native().dispatchEvent(new FocusEvent('blur'));
    await fixture.whenStable();
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Input] }).compileComponents();
    fixture = TestBed.createComponent(Input);
    await fixture.whenStable();
  });

  describe('tipo number', () => {
    beforeEach(async () => {
      await setInputs({ type: 'number' });
    });

    it('el 0 vuelve como número, no como texto', async () => {
      await escribir('0');

      expect(fixture.componentInstance.value()).toBe(0);
      expect(typeof fixture.componentInstance.value()).toBe('number');
    });

    it('un decimal vuelve como número', async () => {
      await escribir('36.6');

      expect(fixture.componentInstance.value()).toBe(36.6);
    });

    it('vaciar el campo da null, no una cadena vacía', async () => {
      await escribir('12');
      await escribir('');

      expect(fixture.componentInstance.value()).toBeNull();
    });
  });

  describe('normalización al perder el foco', () => {
    it('el correo NO se pasa a minúsculas: la parte local distingue mayúsculas', async () => {
      await setInputs({ type: 'email' });
      await escribir('Juan.Perez@Alovida.BO');
      await desenfocar();

      expect(fixture.componentInstance.value()).toBe('Juan.Perez@Alovida.BO');
    });

    it('al correo sí le quita espacios, que nunca son válidos', async () => {
      await setInputs({ type: 'email' });
      await escribir(' juan @alovida.bo ');
      await desenfocar();

      expect(fixture.componentInstance.value()).toBe('juan@alovida.bo');
    });

    it('a una URL sin esquema le antepone https', async () => {
      await setInputs({ type: 'url' });
      await escribir('alovida.salud.bo');
      await desenfocar();

      expect(fixture.componentInstance.value()).toBe('https://alovida.salud.bo');
    });

    it('respeta un esquema ya escrito', async () => {
      await setInputs({ type: 'url' });
      await escribir('http://alovida.salud.bo');
      await desenfocar();

      expect(fixture.componentInstance.value()).toBe('http://alovida.salud.bo');
    });
  });

  describe('contraseña', () => {
    beforeEach(async () => {
      await setInputs({ type: 'password' });

    });

    it('arranca oculta y alterna a texto', async () => {
      expect(native().getAttribute('type')).toBe('password');

      const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.input-action-btn');
      toggle.click();
      await fixture.whenStable();

      expect(native().getAttribute('type')).toBe('text');
      expect(toggle.getAttribute('aria-pressed')).toBe('true');
      expect(toggle.getAttribute('aria-label')).toBe('Ocultar contraseña');
    });
  });

  describe('búsqueda', () => {
    it('el botón de limpiar solo existe con contenido y vacía el valor', async () => {
      await setInputs({ type: 'search' });
      expect(fixture.nativeElement.querySelector('.input-action-btn')).toBeNull();

      await escribir('Cardiología');
      const limpiar: HTMLButtonElement = fixture.nativeElement.querySelector('.input-action-btn');
      expect(limpiar.getAttribute('aria-label')).toBe('Limpiar búsqueda');

      limpiar.click();
      await fixture.whenStable();

      expect(fixture.componentInstance.value()).toBe('');
    });
  });

  /**
   * Sin `autocomplete` el navegador adivina cuál es el campo de usuario, y
   * adivina mal: en el alta de profesional guardaba el número de credencial
   * como nombre de usuario, así que al volver ofrecía una credencial donde iba
   * el correo y el acceso fallaba.
   */
  describe('autocompletado', () => {
    it('sin declararlo no pone el atributo, y el navegador decide', () => {
      expect(native().hasAttribute('autocomplete')).toBe(false);
    });

    it('lo propaga al input nativo, que es donde el navegador lo lee', async () => {
      await setInputs({ autocomplete: 'username' });

      expect(native().getAttribute('autocomplete')).toBe('username');
    });

    it('admite apagarlo donde ninguna pista corresponde', async () => {
      await setInputs({ autocomplete: 'off' });

      expect(native().getAttribute('autocomplete')).toBe('off');
    });
  });

  describe('fieldKind: el tipo de dato de la casilla', () => {
    it('filtra en el <input> mismo lo que el tipo no admite', async () => {
      await setInputs({ fieldKind: 'personName' });

      await escribir('holaLTAD1*');

      expect(native().value).toBe('holaLTAD');
      expect(fixture.componentInstance.value()).toBe('holaLTAD');
    });

    it('abre el teclado del tipo, salvo que `inputMode` diga otro', async () => {
      await setInputs({ fieldKind: 'digits' });
      expect(native().getAttribute('inputmode')).toBe('numeric');

      await setInputs({ inputMode: 'decimal' });
      expect(native().getAttribute('inputmode')).toBe('decimal');
    });

    it('`inputFilter` declarado a mano le gana al del tipo', async () => {
      await setInputs({ fieldKind: 'digits', inputFilter: (v: string) => v.toUpperCase() });

      await escribir('ab1');

      expect(native().value).toBe('AB1');
    });

    it('al salir del campo, un nombre pierde el separador colgado', async () => {
      await setInputs({ fieldKind: 'personName' });

      await escribir('Quispe-');
      await desenfocar();

      expect(fixture.componentInstance.value()).toBe('Quispe');
    });

    it('sin tipo no filtra nada', async () => {
      await escribir('holaLTAD1*');

      expect(native().value).toBe('holaLTAD1*');
    });
  });

  describe('accesibilidad', () => {
    it('suelto, el input igual tiene id propio', () => {
      expect(native().id).not.toBe('');
    });

    it('hasError marca aria-invalid', async () => {
      expect(native().getAttribute('aria-invalid')).toBe('false');

      await setInputs({ hasError: true });

      expect(native().getAttribute('aria-invalid')).toBe('true');
    });
  });
});

describe('Input con fieldKind dentro de un formulario', () => {
  it('se cuelga del control como un validador nativo y deja el mensaje del catálogo', async () => {
    await TestBed.configureTestingModule({ imports: [AnfitrionConFormulario] }).compileComponents();
    const fixture = TestBed.createComponent(AnfitrionConFormulario);
    await fixture.whenStable();
    const { correo } = fixture.componentInstance;

    correo.setValue('sin-arroba');
    expect(correo.errors).toEqual({ fieldKind: { kind: 'email', message: fieldKindMessage('email') } });

    correo.setValue('ana@dominio.com');
    expect(correo.valid).toBe(true);

    correo.setValue('');
    expect(correo.valid).toBe(true);
  });
});
