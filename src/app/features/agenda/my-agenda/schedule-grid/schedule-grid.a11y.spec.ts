import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { expectNoSeriousViolations } from '../../../../../testing/a11y';
import type { PublishedRule } from '../../../../core/data-access/scheduling/scheduling.types';
import type { BloqueoDelMes } from '../month-view/month-view';
import { ScheduleGrid, type RangoDeGrilla } from './schedule-grid';

/**
 * Gate de accesibilidad de la grilla semanal (axe, WCAG 2.2 A/AA): bloquea el
 * pull request ante violaciones `serious` o `critical`.
 *
 * Vive junto al componente y no en `shared/components/a11y-gate.spec.ts`
 * porque la grilla es de la agenda: importarla desde `shared` invertiría la
 * dirección de las capas que vigila `check-architecture.mjs`.
 *
 * Afirma reglas, no valores: ni colores ni textos concretos.
 */

/** Miércoles 9 de septiembre de 2026: la semana va del lunes 7 al domingo 13. */
const WEDNESDAY = new Date(2026, 8, 9);

const RULES: readonly PublishedRule[] = [
  { dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00', slotMinutes: 30 },
  { dayOfWeek: 3, startTime: '14:00:00', endTime: '18:00:00', slotMinutes: 20, gapMinutes: 5 },
  { dayOfWeek: 5, startTime: '08:00:00', endTime: '12:00:00' },
];

const BLOCKS: readonly BloqueoDelMes[] = [
  {
    id: 'b-1',
    desde: new Date(2026, 8, 9, 15, 0),
    hasta: new Date(2026, 8, 9, 16, 0),
    motivo: 'Junta médica',
  },
];

/** Margen amplio: con `preload: false` cada auditoría tarda decenas de ms. */
const TIMEOUT_MS = 30_000;

describe('ScheduleGrid · gate de accesibilidad (axe, WCAG 2.2 AA, graves)', () => {
  let fixture: ComponentFixture<ScheduleGrid>;

  async function mount(
    inputs: Partial<{
      conFechas: boolean;
      rango: RangoDeGrilla;
      bloqueos: readonly BloqueoDelMes[];
    }> = {},
  ): Promise<Element> {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(ScheduleGrid);
    fixture.componentRef.setInput('reglas', RULES);
    fixture.componentRef.setInput('semana', WEDNESDAY);
    fixture.componentRef.setInput('nombre', 'Horario de invierno');
    fixture.componentRef.setInput('vigencia', 'Desde el 1 de julio');
    for (const key of ['conFechas', 'rango', 'bloqueos'] as const) {
      if (inputs[key] !== undefined) fixture.componentRef.setInput(key, inputs[key]);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as Element;
  }

  it(
    'semana con fechas, franjas y un bloqueo',
    async () => {
      const root = await mount({ bloqueos: BLOCKS });
      expect(root.querySelectorAll('[data-testid="horario-bloque"]').length).toBeGreaterThan(0);
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'horario sin fechas, recortado a las horas de atención',
    async () => {
      const root = await mount({ conFechas: false, rango: 'atencion' });
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );

  it(
    'con el globo de detalle abierto por teclado',
    async () => {
      const root = await mount({ bloqueos: BLOCKS });
      const block = root.querySelector<HTMLElement>('[data-testid="horario-bloque"]');
      if (block === null) {
        throw new Error('la grilla no dibujó ninguna franja');
      }
      block.dispatchEvent(new FocusEvent('focus'));
      fixture.detectChanges();
      await fixture.whenStable();
      expect(root.querySelector('[data-testid="horario-globo"]')).not.toBeNull();
      await expectNoSeriousViolations(root);
    },
    TIMEOUT_MS,
  );
});
