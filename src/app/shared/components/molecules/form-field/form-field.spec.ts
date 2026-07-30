import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { InputComponent } from '../../atoms/input/input';
import { FormFieldComponent } from './form-field';

@Component({
  imports: [FormFieldComponent, InputComponent],
  template: `
    <app-form-field
      [label]="label()"
      [hint]="hint()"
      [errorMessage]="errorMessage()"
      [required]="required()"
    >
      <app-input type="text" />
    </app-form-field>
  `,
})
class HostComponent {
  readonly label = signal('Nombre del paciente');
  readonly hint = signal('');
  readonly errorMessage = signal('');
  readonly required = signal(false);
}

describe('FormFieldComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function label(): HTMLLabelElement {
    return fixture.nativeElement.querySelector('label');
  }
  function control(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input');
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('asociación label ↔ control', () => {
    it('el label resuelve a su control sin que nadie pase `for` ni `id`', () => {
      expect(control().id).not.toBe('');
      expect(label().getAttribute('for')).toBe(control().id);
      // `label.control` es la resolución del propio DOM, no una comparación nuestra
      expect(label().control).toBe(control());
    });

    it('dos campos en la misma página no comparten id', async () => {
      const otro = TestBed.createComponent(HostComponent);
      await otro.whenStable();

      const idB = (otro.nativeElement.querySelector('input') as HTMLInputElement).id;
      expect(control().id).not.toBe(idB);
    });
  });

  describe('descripción accesible', () => {
    it('el hint describe al control', async () => {
      host.hint.set('Como figura en el CI');
      await fixture.whenStable();

      const hint = fixture.nativeElement.querySelector('.form-field-hint');
      expect(control().getAttribute('aria-describedby')).toBe(hint.id);
    });

    it('el error reemplaza al hint y pasa a describir al control', async () => {
      host.hint.set('Como figura en el CI');
      host.errorMessage.set('El nombre es obligatorio');
      await fixture.whenStable();

      const error = fixture.nativeElement.querySelector('.form-field-error');
      expect(fixture.nativeElement.querySelector('.form-field-hint')).toBeNull();
      expect(control().getAttribute('aria-describedby')).toBe(error.id);
      expect(error.getAttribute('role')).toBe('alert');
    });

    it('sin hint ni error no ensucia el control con un describedby vacío', () => {
      expect(control().hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('propagación de estado al control', () => {
    it('un errorMessage del campo marca aria-invalid en el control', async () => {
      expect(control().getAttribute('aria-invalid')).toBe('false');

      host.errorMessage.set('Fecha no disponible');
      await fixture.whenStable();

      expect(control().getAttribute('aria-invalid')).toBe('true');
    });

    it('required marca aria-required y se anuncia además del asterisco', async () => {
      host.required.set(true);
      await fixture.whenStable();

      expect(control().getAttribute('aria-required')).toBe('true');
      expect(
        fixture.nativeElement.querySelector('.required-asterisk').getAttribute('aria-hidden'),
      ).toBe('true');
      expect(label().textContent).toContain('(obligatorio)');
    });
  });
});
