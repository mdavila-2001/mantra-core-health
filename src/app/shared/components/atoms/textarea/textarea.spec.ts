import { Component, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FormField } from '../../molecules/form-field/form-field';
import { Textarea } from './textarea';

/** Campo real alrededor del control: así se ejerce el contrato por DI. */
@Component({
  imports: [FormField, Textarea],
  template: `
    <app-form-field
      [label]="label()"
      [hint]="hint()"
      [errorMessage]="errorMessage()"
      [required]="required()"
    >
      <app-textarea [(value)]="value" [maxLength]="maxLength()" />
    </app-form-field>
  `,
})
class CampoHost {
  readonly label = signal('Evolución');
  readonly hint = signal('Queda en la historia clínica');
  readonly errorMessage = signal('');
  readonly required = signal(false);
  readonly value = signal('');
  readonly maxLength = signal<number | null>(null);
}

/** Formulario reactivo: el camino del `ControlValueAccessor`. */
@Component({
  imports: [ReactiveFormsModule, Textarea],
  template: `<app-textarea [formControl]="control" />`,
})
class FormularioHost {
  readonly control = new FormControl<string>('', { nonNullable: true });
}

describe('Textarea', () => {
  let fixture: ComponentFixture<Textarea>;

  function textarea(root: HTMLElement = fixture.nativeElement): HTMLTextAreaElement {
    const element = root.querySelector('textarea');
    if (!(element instanceof HTMLTextAreaElement)) {
      throw new Error('el <textarea> nativo no está en el DOM');
    }
    return element;
  }

  async function setInputs(inputs: Record<string, unknown>): Promise<void> {
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    await fixture.whenStable();
  }

  async function escribir(texto: string): Promise<void> {
    const control = textarea();
    control.value = texto;
    control.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Textarea] }).compileComponents();
    fixture = TestBed.createComponent(Textarea);
    await fixture.whenStable();
  });

  describe('valor', () => {
    it('escribir actualiza el modelo con la cadena completa', async () => {
      await escribir('Paciente refiere dolor torácico');

      expect(fixture.componentInstance.value()).toBe('Paciente refiere dolor torácico');
    });

    it('el valor siempre es string: un vacío es "" y nunca null', async () => {
      await escribir('algo');
      await escribir('');

      const valor: string = fixture.componentInstance.value();
      expect(valor).toBe('');
    });

    it('el modelo pinta el control: ida y vuelta', async () => {
      await setInputs({ value: 'Control post operatorio' });

      expect(textarea().value).toBe('Control post operatorio');
    });

    it('rows por defecto es 3 y se puede subir', async () => {
      expect(textarea().rows).toBe(3);

      await setInputs({ rows: 8 });
      expect(textarea().rows).toBe(8);
    });
  });

  describe('deshabilitado', () => {
    it('intercepta la escritura: el valor no cambia', async () => {
      await setInputs({ disabled: true, value: 'original' });
      await escribir('intento de edición');

      expect(fixture.componentInstance.value()).toBe('original');
    });

    it('marca el control nativo y el envoltorio', async () => {
      await setInputs({ disabled: true });

      expect(textarea().disabled).toBe(true);
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('.textarea-wrapper')?.classList,
      ).toContain('is-disabled');
    });
  });

  describe('contador de caracteres', () => {
    it('sin maxLength no existe: un número suelto no informa nada', () => {
      const root = fixture.nativeElement as HTMLElement;

      expect(root.querySelector('.textarea-counter')).toBeNull();
      expect(textarea().hasAttribute('maxlength')).toBe(false);
    });

    it('con maxLength muestra «N / max» y limita el control nativo', async () => {
      await setInputs({ maxLength: 10 });
      await escribir('hola');

      const root = fixture.nativeElement as HTMLElement;
      expect(root.querySelector('.textarea-counter')?.textContent?.trim()).toBe('4 / 10');
      expect(textarea().getAttribute('maxlength')).toBe('10');
    });

    it('la cifra visible no se anuncia: cambia con cada tecla', async () => {
      await setInputs({ maxLength: 10 });

      const contador = (fixture.nativeElement as HTMLElement).querySelector('.textarea-counter');
      expect(contador?.getAttribute('aria-hidden')).toBe('true');
    });

    it('el aviso vivo calla por debajo del 90 %', async () => {
      await setInputs({ maxLength: 10 });
      await escribir('12345678');

      expect(avisoVivo()).toBe('');
    });

    it('habla al cruzar el 90 %', async () => {
      await setInputs({ maxLength: 10 });
      await escribir('123456789');

      expect(avisoVivo()).toBe('Te estás acercando al límite de 10 caracteres.');
    });

    it('las teclas intermedias de la misma banda no cambian el anuncio', async () => {
      await setInputs({ maxLength: 100 });
      await escribir('x'.repeat(90));
      const primerAviso = avisoVivo();

      await escribir('x'.repeat(95));

      // Mismo texto ⇒ el lector no vuelve a hablar.
      expect(avisoVivo()).toBe(primerAviso);
      expect(primerAviso).toContain('acercando');
    });

    it('anuncia el límite con otras palabras al tocar el techo', async () => {
      await setInputs({ maxLength: 10 });
      await escribir('1234567890');

      expect(avisoVivo()).toBe('Alcanzaste el límite de 10 caracteres.');
    });

    it('el techo, que no cambia, es lo que describe al control', async () => {
      await setInputs({ maxLength: 2000 });

      const descrito = textarea().getAttribute('aria-describedby');
      expect(descrito).not.toBeNull();
      const pista = (fixture.nativeElement as HTMLElement).querySelector(`#${descrito}`);
      expect(pista?.textContent?.trim()).toBe('Máximo 2000 caracteres.');
    });

    function avisoVivo(): string {
      const root = fixture.nativeElement as HTMLElement;
      const region = root.querySelector('[aria-live="polite"]');
      return (region?.textContent ?? '').trim();
    }
  });

  describe('crecimiento automático', () => {
    /** jsdom no hace layout: el alto real se simula para poder aseverar. */
    function fijarScrollHeight(alto: number): void {
      Object.defineProperty(textarea(), 'scrollHeight', {
        configurable: true,
        get: () => alto,
      });
    }

    it('apagado por defecto: nadie toca el alto', async () => {
      fijarScrollHeight(180);
      await escribir('linea\nlinea\nlinea');

      expect(textarea().style.height).toBe('');
    });

    it('encendido, el alto sigue al contenido', async () => {
      await setInputs({ autoResize: true });
      fijarScrollHeight(120);
      await escribir('linea\nlinea\nlinea');

      expect(textarea().style.height).toBe('120px');
    });

    it('el tope es declarativo: maxRows viaja al CSS como custom property', async () => {
      await setInputs({ autoResize: true, maxRows: 6 });

      expect(textarea().style.getPropertyValue('--_textarea-max-rows')).toBe('6');
      expect(textarea().classList).toContain('is-auto-resize');
    });
  });

  describe('integración con app-form-field', () => {
    let campo: ComponentFixture<CampoHost>;

    function control(): HTMLTextAreaElement {
      return textarea(campo.nativeElement as HTMLElement);
    }

    beforeEach(async () => {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [CampoHost] }).compileComponents();
      campo = TestBed.createComponent(CampoHost);
      await campo.whenStable();
    });

    it('el id lo genera el campo y el label le apunta', () => {
      const label = (campo.nativeElement as HTMLElement).querySelector('label');

      expect(control().id).toBeTruthy();
      expect(label?.getAttribute('for')).toBe(control().id);
    });

    it('el hint del campo describe al control', () => {
      const descrito = control().getAttribute('aria-describedby');
      const hint = (campo.nativeElement as HTMLElement).querySelector('.form-field-hint');

      expect(descrito).toBe(hint?.id);
    });

    it('el error del campo se refleja en aria-invalid', async () => {
      expect(control().getAttribute('aria-invalid')).toBe('false');

      campo.componentInstance.errorMessage.set('La evolución es obligatoria');
      await campo.whenStable();

      expect(control().getAttribute('aria-invalid')).toBe('true');
    });

    it('la obligatoriedad del campo llega como aria-required', async () => {
      campo.componentInstance.required.set(true);
      await campo.whenStable();

      expect(control().getAttribute('aria-required')).toBe('true');
    });

    it('el describedby del campo y el del límite conviven: ninguno pisa al otro', async () => {
      campo.componentInstance.maxLength.set(500);
      await campo.whenStable();

      const ids = (control().getAttribute('aria-describedby') ?? '').split(' ');
      const hint = (campo.nativeElement as HTMLElement).querySelector('.form-field-hint');

      expect(ids).toHaveLength(2);
      expect(ids).toContain(hint?.id);
    });
  });

  describe('ControlValueAccessor', () => {
    let formulario: ComponentFixture<FormularioHost>;

    function control(): HTMLTextAreaElement {
      return textarea(formulario.nativeElement as HTMLElement);
    }

    beforeEach(async () => {
      await TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [FormularioHost] }).compileComponents();
      formulario = TestBed.createComponent(FormularioHost);
      await formulario.whenStable();
    });

    it('el formulario escribe en el control', async () => {
      formulario.componentInstance.control.setValue('Indicaciones al alta');
      await formulario.whenStable();

      expect(control().value).toBe('Indicaciones al alta');
    });

    it('escribir actualiza el FormControl', async () => {
      control().value = 'Dolor abdominal difuso';
      control().dispatchEvent(new Event('input'));
      await formulario.whenStable();

      expect(formulario.componentInstance.control.value).toBe('Dolor abdominal difuso');
    });

    it('el blur marca el control como tocado', async () => {
      expect(formulario.componentInstance.control.touched).toBe(false);

      control().dispatchEvent(new FocusEvent('blur'));
      await formulario.whenStable();

      expect(formulario.componentInstance.control.touched).toBe(true);
    });

    it('deshabilitar el FormControl deshabilita el control nativo', async () => {
      formulario.componentInstance.control.disable();
      await formulario.whenStable();

      expect(control().disabled).toBe(true);
    });
  });
});
