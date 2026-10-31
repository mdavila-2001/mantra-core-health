import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { AllowedHours } from '../../../core/data-access/support-access/support-access.types';
import { WeeklyHoursEditor } from './weekly-hours-editor';

describe('WeeklyHoursEditor', () => {
  let fixture: ComponentFixture<WeeklyHoursEditor>;
  let emitido: (AllowedHours | undefined)[];
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);

  function abrir(valor: AllowedHours | undefined): void {
    emitido = [];
    fixture = TestBed.createComponent(WeeklyHoursEditor);
    fixture.componentRef.setInput('value', valor);
    fixture.componentInstance.valueChange.subscribe((v) => emitido.push(v));
    fixture.detectChanges();
  }

  it('sin horario no dibuja la semana: dice que no hay restricción', () => {
    abrir(undefined);
    expect(byId('horario-semana')).toBeNull();
    expect(host().textContent).toContain('Sin restricción');
  });

  it('encender el límite propone el horario de oficina; apagarlo lo quita', () => {
    abrir(undefined);
    (byId('horario-limitar')!.querySelector('input') as HTMLInputElement).click();
    expect(emitido.at(-1)).toMatchObject({ days: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' });
    abrir({ days: [1], from: '08:00', to: '12:00' });
    (byId('horario-limitar')!.querySelector('input') as HTMLInputElement).click();
    expect(emitido.at(-1)).toBeUndefined();
  });

  it('dibuja los siete días, lunes primero, con la franja de los que rigen', () => {
    abrir({ days: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' });
    const dias = [...host().querySelectorAll('.semana__dia')] as HTMLElement[];
    expect(dias).toHaveLength(7);
    expect(dias[0]!.textContent).toContain('Lunes');
    expect(dias[6]!.textContent).toContain('Domingo');
    expect(dias[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(dias[5]!.getAttribute('aria-pressed')).toBe('false');
    expect(dias[0]!.getAttribute('aria-label')).toBe('lunes: habilitado de 08:00 a 18:00');
    expect(dias[5]!.getAttribute('aria-label')).toBe('sábado: sin acceso');
    expect(dias[0]!.querySelectorAll('.semana__tramo')).toHaveLength(1);
    expect(dias[5]!.querySelectorAll('.semana__tramo')).toHaveLength(0);
  });

  it('tocar un día lo habilita o lo quita', () => {
    abrir({ days: [1, 2], from: '08:00', to: '18:00' });
    (byId('horario-dia-6') as HTMLElement).click();
    expect(emitido.at(-1)!.days).toEqual([1, 2, 6]);
    (byId('horario-dia-1') as HTMLElement).click();
    expect(emitido.at(-1)!.days).toEqual([2]);
  });

  it('nunca deja el horario sin ningún día', () => {
    abrir({ days: [3], from: '08:00', to: '18:00' });
    (byId('horario-dia-3') as HTMLElement).click();
    expect(emitido).toEqual([]);
  });

  it('el turno de noche cruza la medianoche y se dibuja partido entre dos días', () => {
    abrir({ days: [5], from: '22:00', to: '06:00' });
    const viernes = byId('horario-dia-5')!;
    const sabado = byId('horario-dia-6')!;
    expect(viernes.querySelectorAll('.semana__tramo')).toHaveLength(1);
    expect(sabado.querySelectorAll('.semana__tramo')).toHaveLength(1);
    expect(host().textContent).toContain('cruza la medianoche');
  });

  it('los atajos proponen la oficina y el turno de noche', () => {
    abrir({ days: [1], from: '09:00', to: '10:00' });
    (byId('horario-noche') as HTMLElement).click();
    expect(emitido.at(-1)).toMatchObject({ from: '22:00', to: '06:00', days: [1, 2, 3, 4, 5, 6, 0] });
    (byId('horario-oficina') as HTMLElement).click();
    expect(emitido.at(-1)).toMatchObject({ days: [1, 2, 3, 4, 5], from: '08:00', to: '18:00' });
  });
});
