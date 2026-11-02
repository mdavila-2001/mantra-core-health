import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { SupportActionCode } from '../../../core/data-access/support-access/support-access.types';
import { ACTION_GROUPS, SupportActionPicker } from './support-action-picker';

/**
 * Las acciones que se le delegan a una persona de soporte, agrupadas. El
 * modelo queda siempre en el orden canónico (no en el del clic), y si se
 * eligen acciones sin «Ver la agenda» se avisa que no se van a poder usar. La
 * autorización real la decide la API; esto es la intención declarada.
 */
describe('SupportActionPicker', () => {
  let fixture: ComponentFixture<SupportActionPicker>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const casilla = (accion: SupportActionCode): HTMLInputElement =>
    root().querySelector<HTMLInputElement>(`[data-testid="accion-${accion}"] input[type="checkbox"]`)!;

  function pintar(actions: readonly SupportActionCode[] = [], disabled = false): void {
    fixture = TestBed.createComponent(SupportActionPicker);
    fixture.componentRef.setInput('actions', actions);
    fixture.componentRef.setInput('disabled', disabled);
    fixture.detectChanges();
  }

  function marcar(accion: SupportActionCode, valor: boolean): void {
    casilla(accion).checked = valor;
    casilla(accion).dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('agrupa las acciones en fieldsets rotulados, una casilla por acción', () => {
    pintar();
    expect(Array.from(root().querySelectorAll('legend')).map((l) => l.textContent)).toEqual(ACTION_GROUPS.map((g) => g.title));
    expect(root().querySelectorAll('input[type="checkbox"]')).toHaveLength(ACTION_GROUPS.flatMap((g) => g.actions).length);
    expect(root().querySelector('[data-testid="accion-schedule.view"]')?.textContent).toContain('Ver la agenda');
  });

  it('marcar mantiene el orden canónico aunque se elija en otro orden', () => {
    pintar();
    marcar('billing.collect', true);
    marcar('schedule.view', true);
    expect(fixture.componentInstance.actions()).toEqual(['schedule.view', 'billing.collect']);
  });

  it('desmarcar saca sólo esa acción', () => {
    pintar(['schedule.view', 'schedule.create']);
    marcar('schedule.create', false);
    expect(fixture.componentInstance.actions()).toEqual(['schedule.view']);
  });

  it('sin «Ver la agenda» avisa que lo demás no se podrá usar', () => {
    pintar(['schedule.create']);
    expect(root().querySelector('[role="note"]')?.textContent).toContain('Sin «Ver la agenda»');
    pintar(['schedule.view', 'schedule.create']);
    expect(root().querySelector('[role="note"]')).toBeNull();
    pintar([]);
    expect(root().querySelector('[role="note"]')).toBeNull();
  });

  it('deshabilitado apaga todas las casillas', () => {
    pintar([], true);
    expect(Array.from(root().querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).every((c) => c.disabled)).toBe(true);
  });
});
