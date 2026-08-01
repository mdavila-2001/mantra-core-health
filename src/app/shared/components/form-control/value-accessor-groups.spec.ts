import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { Radio } from '../atoms/radio/radio';
import { RadioGroup } from '../atoms/radio-group/radio-group';
import { Switch } from '../atoms/switch/switch';

/**
 * `ControlValueAccessor` de `radio-group` y `switch` (tarjeta 13), contra un
 * `FormGroup` real: lo que importa es que el formulario y el átomo digan lo
 * mismo en las dos direcciones.
 */
@Component({
  imports: [ReactiveFormsModule, RadioGroup, Radio, Switch],
  template: `
    <form [formGroup]="form">
      <app-radio-group formControlName="perfil">
        <app-radio value="paciente" label="Paciente" />
        <app-radio value="medico" label="Médico" />
      </app-radio-group>

      <app-switch formControlName="notificaciones" label="Notificaciones" />
    </form>

    <!-- El mismo átomo suelto, para comprobar que no perdió el uso sin formulario. -->
    <app-switch [(checked)]="sueltoActivo" label="Suelto" />
  `,
})
class Host {
  readonly form = new FormGroup({
    perfil: new FormControl<string | null>(null, Validators.required),
    notificaciones: new FormControl<boolean>(false),
  });

  readonly sueltoActivo = signal(false);
}

describe('ControlValueAccessor · radio-group y switch', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();

    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  const radios = (): HTMLInputElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('app-radio input[type="radio"]'));

  const nativeSwitch = (): HTMLInputElement =>
    fixture.nativeElement.querySelector('app-switch input[role="switch"]');

  const switchesNativos = (): HTMLInputElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('app-switch input[role="switch"]'));

  async function click(element: HTMLElement): Promise<void> {
    element.click();
    await fixture.whenStable();
  }

  describe('del formulario al control', () => {
    it('setValue marca el radio correspondiente', async () => {
      host.form.controls.perfil.setValue('medico');
      await fixture.whenStable();

      expect(radios()[1]?.checked).toBe(true);
      expect(radios()[0]?.checked).toBe(false);
    });

    it('setValue enciende el interruptor', async () => {
      host.form.controls.notificaciones.setValue(true);
      await fixture.whenStable();

      expect(nativeSwitch().checked).toBe(true);
    });

    it('reset vuelve a dejar el grupo sin elección', async () => {
      host.form.controls.perfil.setValue('paciente');
      await fixture.whenStable();

      host.form.reset();
      await fixture.whenStable();

      expect(radios().some((radio) => radio.checked)).toBe(false);
    });

    it('disable apaga los radios y el interruptor', async () => {
      host.form.disable();
      await fixture.whenStable();

      expect(radios().every((radio) => radio.disabled)).toBe(true);
      expect(nativeSwitch().disabled).toBe(true);

      host.form.enable();
      await fixture.whenStable();

      expect(radios().every((radio) => radio.disabled)).toBe(false);
    });
  });

  describe('del control al formulario', () => {
    it('elegir un radio escribe el valor', async () => {
      const medico = radios()[1];
      expect(medico).toBeDefined();

      await click(medico as HTMLElement);

      expect(host.form.controls.perfil.value).toBe('medico');
    });

    it('la exclusión mutua se mantiene al cambiar de opción', async () => {
      await click(radios()[0] as HTMLElement);
      await click(radios()[1] as HTMLElement);

      expect(host.form.controls.perfil.value).toBe('medico');
      expect(radios().filter((radio) => radio.checked).length).toBe(1);
    });

    it('accionar el interruptor escribe true y luego false', async () => {
      await click(nativeSwitch());
      expect(host.form.controls.notificaciones.value).toBe(true);

      await click(nativeSwitch());
      expect(host.form.controls.notificaciones.value).toBe(false);
    });

    it('elegir marca el control como tocado en el mismo gesto', async () => {
      expect(host.form.controls.perfil.touched).toBe(false);

      await click(radios()[0] as HTMLElement);

      // Sin esto, un grupo obligatorio sin responder no muestra su error hasta
      // que la persona toca otra cosa.
      expect(host.form.controls.perfil.touched).toBe(true);
    });

    it('el validador required ve la elección del grupo', async () => {
      expect(host.form.controls.perfil.invalid).toBe(true);

      await click(radios()[0] as HTMLElement);

      expect(host.form.controls.perfil.valid).toBe(true);
    });

    it('un grupo deshabilitado por el formulario no acepta la elección', async () => {
      host.form.controls.perfil.disable();
      await fixture.whenStable();

      // `click()` sobre un input deshabilitado no dispara nada; se llama al
      // grupo directo para probar la guarda, no al DOM.
      const grupo = fixture.debugElement
        .query((node) => node.name === 'app-radio-group')
        .componentInstance as RadioGroup<string>;
      grupo.select('medico');
      await fixture.whenStable();

      expect(host.form.controls.perfil.value).toBeNull();
    });
  });

  it('el interruptor suelto sigue funcionando sin formulario', async () => {
    const suelto = switchesNativos()[1];
    expect(suelto).toBeDefined();

    await click(suelto as HTMLElement);

    expect(host.sueltoActivo()).toBe(true);
    // Y no contaminó al que sí está en el formulario.
    expect(host.form.controls.notificaciones.value).toBe(false);
  });
});
