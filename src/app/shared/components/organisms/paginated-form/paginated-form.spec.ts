import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { By } from '@angular/platform-browser';

import { PaginatedForm } from './paginated-form';
import { CampoPersonalizado } from './campo-personalizado';
import type { PaginaDeFormulario } from '../../../forms/paginated/paginated-form.types';

/**
 * Lo que se prueba acá es **la promesa del motor**: que sirve una página por
 * vez, que no deja avanzar con un campo mal, y que lo que se escribe termina en
 * el `FormGroup` de la pantalla y en ningún otro sitio.
 *
 * No se prueba cómo se ven la barra ni el stepper: eso ya lo cubren sus propios
 * archivos (`progress.spec.ts`, `stepper.spec.ts`). Repetirlo acá sería atar
 * este motor a la maqueta de dos componentes que no le pertenecen.
 */

const PAGINAS: readonly PaginaDeFormulario[] = [
  {
    titulo: 'Identidad',
    campos: [
      { key: 'documento', label: 'Documento', control: 'text', required: true },
      { key: 'nacimiento', label: 'Fecha de nacimiento', control: 'date' },
    ],
  },
  {
    titulo: 'Acceso',
    campos: [
      { key: 'correo', label: 'Correo', control: 'email', required: true },
      { key: 'clave', label: 'Contraseña', control: 'password', required: true },
    ],
  },
];

@Component({
  imports: [PaginatedForm, CampoPersonalizado],
  template: `
    <app-paginated-form
      [paginas]="paginas()"
      [form]="form"
      label="Crear cuenta"
      submitLabel="Crear cuenta"
      (enviado)="enviados = enviados + 1"
    >
      <ng-template appCampoPersonalizado="odontograma">
        <p data-testid="widget-propio">un mapa dental</p>
      </ng-template>
    </app-paginated-form>
  `,
})
class Host {
  readonly paginas = signal<readonly PaginaDeFormulario[]>(PAGINAS);
  readonly form = new FormGroup({
    documento: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nacimiento: new FormControl<Date | null>(null),
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    clave: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
    odontograma: new FormControl<string | null>(null),
  });
  enviados = 0;
}

describe('PaginatedForm', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** El texto del botón que hace avanzar o enviar. */
  function botonContinuar(): HTMLButtonElement {
    return fixture.debugElement.query(By.css('[data-testid="paginated-form-continuar"]'))
      .nativeElement as HTMLButtonElement;
  }

  function titulo(): string {
    return (
      fixture.debugElement.query(By.css('.paginated-form__titulo')).nativeElement as HTMLElement
    ).textContent!.trim();
  }

  function rotulos(): string[] {
    return fixture.debugElement
      .queryAll(By.css('.form-field__label, label'))
      .map((el) => (el.nativeElement as HTMLElement).textContent!.trim());
  }

  describe('sirve una página por vez', () => {
    it('empieza por la primera y no pinta los campos de las demás', () => {
      expect(titulo()).toBe('Identidad');

      const texto = (fixture.nativeElement as HTMLElement).textContent!;
      expect(texto).toContain('Documento');
      // Los de la página siguiente no están en el DOM: ocultarlos con CSS los
      // dejaría en el orden de tabulación y en el lector de pantalla.
      expect(texto).not.toContain('Contraseña');
    });

    it('el botón dice «Siguiente» mientras quede página, y la acción real en la última', () => {
      expect(botonContinuar().textContent!.trim()).toBe('Siguiente');

      host.form.controls.documento.setValue('1234567');
      botonContinuar().click();
      fixture.detectChanges();

      expect(titulo()).toBe('Acceso');
      expect(botonContinuar().textContent!.trim()).toBe('Crear cuenta');
    });

    it('«Atrás» no aparece en la primera página', () => {
      expect(fixture.debugElement.query(By.css('[data-testid="paginated-form-atras"]'))).toBeNull();
    });
  });

  describe('valida al pasar de página', () => {
    it('no avanza con un campo obligatorio vacío, y dice por qué', () => {
      botonContinuar().click();
      fixture.detectChanges();

      expect(titulo()).toBe('Identidad');
      expect(host.form.controls.documento.touched).toBe(true);
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'Este dato es obligatorio.',
      );
    });

    it('no toca los campos de las otras páginas al validar la actual', () => {
      botonContinuar().click();
      fixture.detectChanges();

      // Marcar todo al primer intento pintaría de rojo una página que la persona
      // todavía no vio.
      expect(host.form.controls.correo.touched).toBe(false);
    });

    it('avanza cuando lo de la página está bien', () => {
      host.form.controls.documento.setValue('1234567');

      botonContinuar().click();
      fixture.detectChanges();

      expect(titulo()).toBe('Acceso');
    });

    it('volver atrás no valida: se puede retroceder desde una página a medias', () => {
      host.form.controls.documento.setValue('1234567');
      botonContinuar().click();
      fixture.detectChanges();

      fixture.debugElement
        .query(By.css('[data-testid="paginated-form-atras"]'))
        .nativeElement.click();
      fixture.detectChanges();

      expect(titulo()).toBe('Identidad');
    });
  });

  describe('el envío', () => {
    function irAlFinal(): void {
      host.form.controls.documento.setValue('1234567');
      botonContinuar().click();
      fixture.detectChanges();
    }

    it('emite sólo cuando todo el formulario es válido', () => {
      irAlFinal();
      host.form.controls.correo.setValue('ana@ejemplo.com');
      host.form.controls.clave.setValue('contraseña-larga');

      botonContinuar().click();
      fixture.detectChanges();

      expect(host.enviados).toBe(1);
    });

    it('con un error en una página anterior, vuelve a ella en vez de quedarse mudo', () => {
      irAlFinal();
      host.form.controls.correo.setValue('ana@ejemplo.com');
      host.form.controls.clave.setValue('contraseña-larga');
      // Alguien borró el documento de la primera página antes de enviar.
      host.form.controls.documento.setValue('');

      botonContinuar().click();
      fixture.detectChanges();

      expect(host.enviados).toBe(0);
      expect(titulo()).toBe('Identidad');
    });
  });

  describe('el dato', () => {
    it('lo que se escribe va al FormGroup de la pantalla', () => {
      // El `testId` del átomo va en el propio `<input>`, no en un envoltorio.
      const input = fixture.debugElement.query(By.css('input[data-testid="campo-documento"]'))
        .nativeElement as HTMLInputElement;

      input.value = '9876543';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(host.form.controls.documento.value).toBe('9876543');
    });

    it('la fecha también, aunque su control no sea un ControlValueAccessor', () => {
      const picker = fixture.debugElement.query(By.css('app-date-picker'));
      expect(picker).not.toBeNull();

      picker.componentInstance.value.set(new Date(1990, 4, 17));
      fixture.detectChanges();

      // El puente escribe en el mismo control: sin él, la fecha viviría en un
      // signal aparte y el envío tendría dos fuentes para el mismo dato.
      expect(host.form.controls.nacimiento.value).toEqual(new Date(1990, 4, 17));
    });
  });

  describe('los campos que el motor no sabe dibujar', () => {
    it('proyecta la plantilla que le den, con su rótulo', () => {
      host.paginas.set([
        {
          titulo: 'Odontograma',
          campos: [{ key: 'odontograma', label: 'Mapa dental', control: 'custom' }],
        },
      ]);
      fixture.detectChanges();

      expect(rotulos().join(' ')).toContain('Mapa dental');
      expect(
        fixture.debugElement.query(By.css('[data-testid="widget-propio"]')),
      ).not.toBeNull();
    });
  });

  describe('el avance', () => {
    it('la barra cuenta páginas terminadas: en la primera todavía no hay nada hecho', () => {
      const barra = fixture.debugElement.query(By.css('app-progress')).nativeElement as HTMLElement;
      expect(barra.getAttribute('aria-valuenow')).toBe('0');

      host.form.controls.documento.setValue('1234567');
      botonContinuar().click();
      fixture.detectChanges();

      expect(barra.getAttribute('aria-valuenow')).toBe('50');
    });

    it('el nombre de la barra dice dónde está la persona', () => {
      const barra = fixture.debugElement.query(By.css('app-progress')).nativeElement as HTMLElement;

      expect(barra.getAttribute('aria-label')).toBe('Crear cuenta: paso 1 de 2, Identidad');
    });
  });
});
