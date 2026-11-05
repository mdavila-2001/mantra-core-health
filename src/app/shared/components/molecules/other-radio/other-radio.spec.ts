import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Radio } from '../radio/radio';
import { RadioGroup } from '../radio-group/radio-group';
import { OtherRadio } from './other-radio';

/**
 * La opción «Otro:» con texto libre de un grupo de radios (cuestionarios). El
 * valor del grupo ES el texto escrito; escribir ya es elegir «Otro», y un valor
 * que no es ninguna de las opciones fijas se reconoce como texto libre.
 */

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OtherRadio, Radio, RadioGroup],
  template: `
    <app-radio-group name="p1" [(value)]="valor" [disabled]="apagado()">
      <app-radio value="SI" label="Sí" />
      <app-radio value="NO" label="No" />
      <app-other-radio [valores]="['SI', 'NO']" />
    </app-radio-group>
  `,
})
class Host {
  readonly valor = signal<string | null>(null);
  readonly apagado = signal(false);
}

describe('OtherRadio', () => {
  let fixture: ComponentFixture<Host>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const radioOtro = (): HTMLInputElement => root().querySelector('[data-testid="radio-otro"]')!;
  const texto = (): HTMLInputElement => root().querySelector('[data-testid="radio-otro-texto"]')!;

  async function pintar(valor: string | null = null): Promise<void> {
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.valor.set(valor);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('escribir elige «Otro» y el valor del grupo es el texto recortado', async () => {
    await pintar();
    texto().value = '  A veces  ';
    texto().dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.valor()).toBe('A veces');
    expect(radioOtro().checked).toBe(true);
  });

  it('un valor que no es opción fija se reconoce como texto libre', async () => {
    await pintar('Depende del día');

    expect(radioOtro().checked).toBe(true);
    expect(texto().value).toBe('Depende del día');
  });

  it('elegir una opción fija desmarca «Otro»', async () => {
    await pintar('Depende');
    fixture.componentInstance.valor.set('SI');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(radioOtro().checked).toBe(false);
  });

  it('comparte el nombre del grupo y su texto tiene nombre accesible', async () => {
    await pintar();
    expect(radioOtro().name).toBe('p1');
    expect(texto().getAttribute('aria-label')).toBe('Otro: escriba su respuesta');
  });

  it('con el grupo deshabilitado no escribe en el valor', async () => {
    await pintar();
    fixture.componentInstance.apagado.set(true);
    fixture.detectChanges();

    expect(texto().disabled).toBe(true);
    texto().value = 'x';
    texto().dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.valor()).toBeNull();
  });
});
