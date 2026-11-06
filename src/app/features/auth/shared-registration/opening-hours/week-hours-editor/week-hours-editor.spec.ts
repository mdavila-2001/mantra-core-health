import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { defaultWeekHours, type WeekHours } from '../opening-hours';
import { WeekHoursEditor } from './week-hours-editor';

/**
 * El editor de una semana no guarda nada: pinta el valor y emite la semana
 * entera con cada cambio. Un día cerrado dice «No atiende»; un día abierto
 * ofrece un segundo turno; «24 h» reemplaza la grilla.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WeekHoursEditor],
  template: `<app-week-hours-editor testId="t" siteLabel="la central" [value]="value()" (valueChange)="emitted.push($event); value.set($event)" />`,
})
class Host {
  readonly value = signal<WeekHours>(defaultWeekHours());
  readonly emitted: WeekHours[] = [];
}

describe('WeekHoursEditor', () => {
  let fixture: ComponentFixture<Host>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = <T extends Element = HTMLElement>(sel: string) => root().querySelector<T>(sel);
  const click = (testId: string): void => {
    (q(`[data-testid="${testId}"]`) as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
  });

  it('pinta la plantilla: el lunes abierto de 08:00 a 18:00, el domingo cerrado', () => {
    expect(q<HTMLInputElement>('[data-testid="t-opens-0-0"]')?.value).toBe('08:00');
    expect(q<HTMLInputElement>('[data-testid="t-closes-0-0"]')?.value).toBe('18:00');
    expect(q('[data-testid="t-day-6"] .week-hours__closed')?.textContent).toContain('No atiende');
  });

  it('agrega un turno de tarde y lo quita', () => {
    click('t-add-shift-0');
    expect(fixture.componentInstance.value().days[0].shifts).toHaveLength(2);
    expect(q<HTMLInputElement>('[data-testid="t-opens-0-1"]')?.value).toBe('14:30');
    expect(q('[data-testid="t-add-shift-0"]')).toBeNull();
    click('t-remove-shift-0');
    expect(fixture.componentInstance.value().days[0].shifts).toHaveLength(1);
  });

  it('copia el horario de un día a todos los días abiertos', () => {
    click('t-add-shift-1');
    click('t-copy-1');
    const days = fixture.componentInstance.value().days;
    expect(days.filter((d) => d.open).every((d) => d.shifts.length === 2)).toBe(true);
    expect(days[6].open).toBe(false);
  });

  it('avisa en la fila cuando el cierre no es posterior a la apertura', () => {
    const week = defaultWeekHours();
    fixture.componentInstance.value.set({
      ...week,
      days: week.days.map((d, i) => (i === 2 ? { open: true, shifts: [{ opensAt: '18:00', closesAt: '09:00' }] } : d)),
    });
    fixture.detectChanges();
    expect(q('[data-testid="t-error-2"]')?.textContent).toContain('posterior');
  });

  it('«24 h» reemplaza la grilla por un resumen', () => {
    const toggle = q<HTMLInputElement>('[data-testid="t-24h"] input[role="switch"]')!;
    toggle.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.value().allDay).toBe(true);
    expect(q('[data-testid="t-24h-summary"]')?.textContent).toContain('00:00 a 24:00');
    expect(q('[data-testid="t-day-0"]')).toBeNull();
  });
});
