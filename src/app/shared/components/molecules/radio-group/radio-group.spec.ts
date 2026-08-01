import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FormFieldComponent } from '../form-field/form-field';
import { RadioComponent } from '../radio/radio';
import { RadioGroupComponent } from './radio-group';

@Component({
  imports: [RadioGroupComponent, RadioComponent],
  template: `
    <app-radio-group [(value)]="tipo" [disabled]="groupDisabled()">
      <app-radio value="paciente" label="Paciente" />
      <app-radio value="medico" label="Médico" />
      <app-radio value="admin" label="Administrativo" [disabled]="adminDisabled()" />
    </app-radio-group>
  `,
})
class HostComponent {
  readonly tipo = signal<string | null>('paciente');
  readonly groupDisabled = signal(false);
  readonly adminDisabled = signal(false);
}

describe('RadioGroupComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function inputs(): HTMLInputElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('input[type=radio]'));
  }
  function marcados(): number {
    return fixture.nativeElement.querySelectorAll('.radio-dot').length;
  }
  async function elegir(index: number): Promise<void> {
    inputs()[index].dispatchEvent(new Event('change'));
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('exclusión mutua', () => {
    it('arranca con exactamente uno marcado', () => {
      expect(marcados()).toBe(1);
      expect(inputs()[0].checked).toBe(true);
    });

    it('elegir otro deja exactamente uno marcado', async () => {
      await elegir(1);

      expect(marcados()).toBe(1);
      expect(host.tipo()).toBe('medico');
      expect(inputs()[0].checked).toBe(false);
      expect(inputs()[1].checked).toBe(true);
    });

    it('recorrer todas las opciones nunca acumula marcados', async () => {
      for (let index = 0; index < 3; index += 1) {
        await elegir(index);
        expect(marcados()).toBe(1);
      }
    });

    it('el value del grupo es el único origen de verdad', async () => {
      host.tipo.set('admin');
      await fixture.whenStable();

      expect(marcados()).toBe(1);
      expect(inputs()[2].checked).toBe(true);
    });
  });

  describe('agrupación nativa', () => {
    it('todos comparten name aunque no se pase ninguno', () => {
      const names = new Set(inputs().map((radio) => radio.name));
      expect(names.size).toBe(1);
      expect([...names][0]).not.toBe('');
    });

    it('cada radio tiene su propio id', () => {
      expect(new Set(inputs().map((radio) => radio.id)).size).toBe(3);
    });
  });

  describe('deshabilitado', () => {
    it('el grupo deshabilita a todos sus radios', async () => {
      host.groupDisabled.set(true);
      await fixture.whenStable();

      expect(inputs().every((radio) => radio.disabled)).toBe(true);
    });

    it('un grupo deshabilitado ignora la selección', async () => {
      host.groupDisabled.set(true);
      await fixture.whenStable();

      await elegir(1);

      expect(host.tipo()).toBe('paciente');
    });

    it('se puede deshabilitar una sola opción', async () => {
      host.adminDisabled.set(true);
      await fixture.whenStable();

      expect(inputs()[2].disabled).toBe(true);
      expect(inputs()[1].disabled).toBe(false);
    });
  });

  it('se anuncia como un control único, no como tres sueltos', () => {
    const group = fixture.nativeElement.querySelector('app-radio-group');
    expect(group.getAttribute('role')).toBe('radiogroup');
  });

  it('dentro de un campo se nombra por aria-labelledby y el label no emite `for`', async () => {
    const conCampo = TestBed.createComponent(GroupInFieldHost);
    await conCampo.whenStable();

    const label: HTMLLabelElement = conCampo.nativeElement.querySelector('label.form-field-label');
    const group: HTMLElement = conCampo.nativeElement.querySelector('app-radio-group');

    // un `for` apuntando a un grupo no tendría destino válido en HTML
    expect(label.hasAttribute('for')).toBe(false);
    expect(group.getAttribute('aria-labelledby')).toBe(label.id);
  });
});

@Component({
  imports: [FormFieldComponent, RadioGroupComponent, RadioComponent],
  template: `
    <app-form-field label="Tipo de usuario">
      <app-radio-group [(value)]="tipo">
        <app-radio value="paciente" label="Paciente" />
      </app-radio-group>
    </app-form-field>
  `,
})
class GroupInFieldHost {
  readonly tipo = signal<string | null>('paciente');
}
