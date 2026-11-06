import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { defaultRegistrationHours, type RegistrationHours } from '../opening-hours';
import { RegistrationOpeningHours, type HoursBranch } from './registration-opening-hours';

/**
 * El paso «Horario de atención»: la central siempre; cada sucursal con nombre,
 * «Mismo horario que la casa central» encendido por omisión, y su propia
 * semana al apagarlo (arranca copiando la de la central).
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RegistrationOpeningHours],
  template: `<app-registration-opening-hours testId="h" [value]="value()" [branches]="branches()" (valueChange)="value.set($event)" />`,
})
class Host {
  readonly value = signal<RegistrationHours>(defaultRegistrationHours());
  readonly branches = signal<readonly HoursBranch[]>([
    { id: 'b1', nombre: 'Sucursal Norte' },
    { id: 'b2', nombre: '  ' },
  ]);
}

describe('RegistrationOpeningHours', () => {
  let fixture: ComponentFixture<Host>;
  const q = (sel: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(sel);

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('muestra la central y sólo las sucursales con nombre', () => {
    expect(q('[data-testid="h-headquarters"]')).not.toBeNull();
    expect(q('[data-testid="h-branch-b1"]')?.textContent).toContain('Sucursal Norte');
    expect(q('[data-testid="h-branch-b2"]')).toBeNull();
  });

  it('una sucursal hereda hasta que se apaga «Mismo horario»; entonces arranca con el de la central', () => {
    expect(q('[data-testid="h-b1-day-0"]')).toBeNull();
    q('[data-testid="h-same-b1"] input[role="switch"]')!.click();
    fixture.detectChanges();
    const value = fixture.componentInstance.value();
    expect(value.branches['b1']).toEqual(value.headquarters);
    expect(q('[data-testid="h-b1-day-0"]')).not.toBeNull();
  });
});
