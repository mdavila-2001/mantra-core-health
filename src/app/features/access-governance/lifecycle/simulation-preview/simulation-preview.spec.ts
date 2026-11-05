import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { SimulateAccessResponse } from '../../../../core/data-access/access-governance/access-explain.types';
import { SimulationPreview } from './simulation-preview';

const BASE: SimulateAccessResponse = {
  valid: true,
  validation: { errors: [], warnings: [] },
  governance: {
    sodFindings: [],
    needsFourEyes: { required: false, reasons: [] },
    privilegeScore: { before: 12, after: 20, delta: 8 },
  },
  summary: { plain: ['Marcos podrá cancelar citas.'], changes: ['Ahora podrá: cancelar citas.'] },
  scenarios: [],
  impact: {
    newlyAllowed: 3,
    newlyDenied: 1,
    unchanged: 20,
    challengesNew: 0,
    doctorsCovered: { before: 1, after: 2 },
    servicesCovered: { before: 0, after: 0 },
    spacesCovered: { before: 1, after: 1 },
    effectiveAtoms: { added: [], removed: [] },
  },
  simulationToken: 'sim_1',
  evaluatedAt: '2026-11-03T10:00:00-04:00',
};

describe('SimulationPreview', () => {
  let fixture: ComponentFixture<SimulationPreview>;
  const text = (id: string): string =>
    (
      (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`)?.textContent ??
      ''
    )
      .replace(/\s+/g, ' ')
      .trim();

  const abrir = (preview: SimulateAccessResponse): void => {
    fixture = TestBed.createComponent(SimulationPreview);
    fixture.componentRef.setInput('preview', preview);
    fixture.componentRef.setInput('idPrefix', 'p');
    fixture.detectChanges();
  };

  it('dice en palabras qué cambia, a cuántos casos afecta y cómo cambia el puntaje de privilegios', () => {
    abrir(BASE);
    expect(text('p-valid')).toContain('El cambio es válido');
    expect(text('p-plain')).toBe('Marcos podrá cancelar citas.');
    expect(text('p-changes')).toBe('Ahora podrá: cancelar citas.');
    expect(text('p-impact')).toContain('Casos que pasan a estar permitidos');
    expect(text('p-impact')).toContain('Casos que no cambian');
    expect(text('p-impact')).toContain('1 → 2');
    expect(text('p-score')).toContain('12 → 20 (+8)');
    expect(text('p-immediate')).toContain('Se aplica de inmediato');
  });

  it('los errores bloquean con su explicación, los avisos acompañan y los conflictos de funciones dicen qué pasa', () => {
    abrir({
      ...BASE,
      valid: false,
      validation: {
        errors: [
          {
            code: 'SOD_CONFLICT_BLOCKED',
            path: 'grants[0]',
            message: 'Cobrar y anular no se permite en una misma persona.',
          },
        ],
        warnings: [
          { code: 'SOD_WARN', path: 'grants[0]', message: 'Conflicto de funciones (advertencia).' },
        ],
      },
      governance: {
        ...BASE.governance,
        sodFindings: [
          {
            ruleCode: 'SOD-BILL-01',
            action: 'REQUIRE_APPROVAL',
            atoms: [],
            message: 'Crear citas y emitir comprobantes pide aprobación.',
          },
        ],
        needsFourEyes: { required: true, reasons: ['El cambio sube el puntaje más de 10 puntos.'] },
        privilegeScore: { before: 20, after: 8, delta: -12 },
      },
    });
    expect(text('p-invalid')).toContain('Hay que corregir antes de guardar');
    expect(text('p-invalid')).toContain('Cobrar y anular no se permite en una misma persona.');
    expect(text('p-warnings')).toContain('Conflicto de funciones (advertencia).');
    expect(text('p-sod')).toContain(
      'Pide aprobación: Crear citas y emitir comprobantes pide aprobación.',
    );
    expect(text('p-four-eyes')).toContain('Necesita la aprobación de otra persona');
    expect(text('p-score')).toContain('20 → 8 (-12)');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="p-immediate"]'),
    ).toBeNull();
  });
});
