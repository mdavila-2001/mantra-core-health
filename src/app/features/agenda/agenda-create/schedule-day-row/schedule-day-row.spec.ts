import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ScheduleDayRow } from './schedule-day-row';
import type { ScheduleDayChange, ScheduleDayValue } from './schedule-day';

/**
 * Una fila (un día) del armado de agenda. La fila no guarda: emite qué campo
 * cambió y su valor, y el formulario del padre decide. Apagada dice «No
 * atiende»; flexible no pide duración ni descanso; sólo servicios no cuenta
 * turnos fijos.
 */

function dia(partial: Partial<ScheduleDayValue> = {}): ScheduleDayValue {
  return {
    activo: true,
    desde: '08:00',
    hasta: '12:00',
    duracion: 30,
    respiro: 0,
    modo: 'CONSULTATIONS',
    telemedicina: false,
    flexible: false,
    ...partial,
  };
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ScheduleDayRow],
  template: `<table><tbody><tr app-schedule-day-row [index]="1" dayName="Lunes" [value]="valor()" [weekFlexible]="semanaFlexible()" [slots]="8" (changed)="cambios.push($event)"></tr></tbody></table>`,
})
class Host {
  readonly valor = signal(dia());
  readonly semanaFlexible = signal(false);
  readonly cambios: ScheduleDayChange[] = [];
}

describe('ScheduleDayRow', () => {
  let fixture: ComponentFixture<Host>;
  const fila = (): HTMLElement => (fixture.nativeElement as HTMLElement).querySelector('tr')!;

  function pintar(valor: ScheduleDayValue, semanaFlexible = false): void {
    fixture = TestBed.createComponent(Host);
    fixture.componentInstance.valor.set(valor);
    fixture.componentInstance.semanaFlexible.set(semanaFlexible);
    fixture.detectChanges();
  }

  it('apagada: «No atiende» ocupando la fila', () => {
    pintar(dia({ activo: false }));
    expect(fila().querySelector('.schedule-day-row__off')?.textContent).toBe('No atiende');
    expect(fila().querySelector('.schedule-day-row__off')?.getAttribute('colspan')).toBe('8');
    expect(fila().querySelector('[data-testid="agenda-create-desde-1"]')).toBeNull();
  });

  it('activa: desde, hasta y la cantidad de turnos', () => {
    pintar(dia());
    expect(fila().classList.contains('schedule-day-row--active')).toBe(true);
    expect(fila().querySelector<HTMLInputElement>('[data-testid="agenda-create-desde-1"]')?.value).toBe('08:00');
    expect(fila().querySelector('.schedule-day-row__slots strong')?.textContent).toBe('8');
  });

  it('cambiar la hora emite el campo y el valor como texto', async () => {
    pintar(dia());
    const hasta = fila().querySelector<HTMLInputElement>('[data-testid="agenda-create-hasta-1"]')!;
    hasta.value = '13:30';
    hasta.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.cambios).toContainEqual({ field: 'hasta', value: '13:30' });
  });

  it('decir «No» al día emite activo=false', () => {
    pintar(dia());
    const no = Array.from(fila().querySelectorAll<HTMLButtonElement>('[role="radio"]')).find((b) => b.textContent?.trim() === 'No')!;
    no.click();
    expect(fixture.componentInstance.cambios).toContainEqual({ field: 'activo', value: false });
  });

  it('día flexible: sin duración ni descanso, «Sin citas de duración fija»', () => {
    pintar(dia({ flexible: true }));
    expect(fila().querySelector('.schedule-day-row__free')?.textContent).toBe('Sin citas de duración fija');
    expect(fila().querySelector('[data-testid="schedule-day-gap-1"]')).toBeNull();
  });

  it('sólo servicios: no cuenta turnos fijos', () => {
    pintar(dia({ modo: 'SERVICES' }));
    expect(fila().querySelector('.schedule-day-row__slots strong')).toBeNull();
    expect(fila().querySelector('.schedule-day-row__slots span')?.getAttribute('title')).toBe('Las citas de servicios se crean al reservar');
  });

  it('semana flexible: no ofrece el interruptor por día y la fila apagada ocupa 4 columnas', () => {
    pintar(dia(), true);
    expect(fila().querySelector('[data-testid="schedule-day-flexible-1"]')).toBeNull();
    expect(fila().classList.contains('schedule-day-row--week-flexible')).toBe(true);
    pintar(dia({ activo: false }), true);
    expect(fila().querySelector('.schedule-day-row__off')?.getAttribute('colspan')).toBe('4');
  });
});
