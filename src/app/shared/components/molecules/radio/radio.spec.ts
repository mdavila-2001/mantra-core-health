import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { RadioGroup } from '../radio-group/radio-group';
import { Radio } from './radio';

/**
 * Un `app-radio` vive dentro de un `app-radio-group`: el grupo es el dueño del
 * valor, del nombre que comparten los `<input>` nativos y del estado
 * deshabilitado. La opción sólo pinta y le avisa al grupo cuando la eligen.
 */

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Radio, RadioGroup],
  template: `
    <app-radio-group name="sexo" [(value)]="valor" [disabled]="grupoApagado()">
      <app-radio value="F" label="Femenino" />
      <app-radio value="M" label="Masculino" [disabled]="masculinoApagado()" />
      <app-radio value="X" />
    </app-radio-group>
  `,
})
class Host {
  readonly valor = signal<string | null>('F');
  readonly grupoApagado = signal(false);
  readonly masculinoApagado = signal(false);
}

describe('Radio', () => {
  let fixture: ComponentFixture<Host>;

  const nativos = (): HTMLInputElement[] =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type="radio"]'));

  beforeEach(async () => {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function elegir(indice: number): void {
    const radio = nativos()[indice]!;
    radio.checked = true;
    radio.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('todas comparten el nombre del grupo y su etiqueta queda asociada al input', () => {
    expect(nativos().map((r) => r.name)).toEqual(['sexo', 'sexo', 'sexo']);
    const label = (fixture.nativeElement as HTMLElement).querySelector('label')!;
    expect(label.getAttribute('for')).toBe(nativos()[0]!.id);
    expect(label.textContent?.trim()).toBe('Femenino');
  });

  it('marca la opción que coincide con el valor del grupo', () => {
    expect(nativos().map((r) => r.checked)).toEqual([true, false, false]);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.radio-dot')).toHaveLength(1);
  });

  it('elegir una opción actualiza el valor del grupo', () => {
    elegir(2);
    expect(fixture.componentInstance.valor()).toBe('X');
    expect(nativos().map((r) => r.checked)).toEqual([false, false, true]);
  });

  it('una opción deshabilitada no cambia el valor', () => {
    fixture.componentInstance.masculinoApagado.set(true);
    fixture.detectChanges();

    expect(nativos()[1]!.disabled).toBe(true);
    elegir(1);
    expect(fixture.componentInstance.valor()).toBe('F');
  });

  it('el grupo deshabilitado apaga todas las opciones', () => {
    fixture.componentInstance.grupoApagado.set(true);
    fixture.detectChanges();

    expect(nativos().every((r) => r.disabled)).toBe(true);
    elegir(2);
    expect(fixture.componentInstance.valor()).toBe('F');
  });

  it('sin etiqueta no pinta un rótulo vacío', () => {
    const ultimo = (fixture.nativeElement as HTMLElement).querySelectorAll('app-radio')[2]!;
    expect(ultimo.querySelector('.radio-label')).toBeNull();
  });
});
