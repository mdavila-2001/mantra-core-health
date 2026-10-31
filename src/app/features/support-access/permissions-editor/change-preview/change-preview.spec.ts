import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import type { SimulateAccessResponse } from '../../../../core/data-access/access-governance/access-explain.types';
import type { PlacedIssue } from '../issue-placement';
import { ChangePreview, type PreviewView } from './change-preview';

const RESPUESTA: SimulateAccessResponse = {
  valid: true,
  validation: { errors: [], warnings: [] },
  governance: {
    sodFindings: [],
    needsFourEyes: { required: false, reasons: [] },
    privilegeScore: { before: 4, after: 9, delta: 5 },
  },
  summary: { plain: ['Ana podrá ver la agenda.'], changes: ['Ahora podrá: ver la agenda.'] },
  scenarios: [],
  impact: {
    newlyAllowed: 3,
    newlyDenied: 1,
    unchanged: 8,
    challengesNew: 2,
    doctorsCovered: { before: 1, after: 2 },
    servicesCovered: { before: 0, after: 0 },
    spacesCovered: { before: 2, after: 4 },
    effectiveAtoms: { added: ['agenda.appointment.view'], removed: ['billing.payment.collect'] },
  },
  limits: { scenarioCount: 12, truncated: false },
  evaluatedAt: '2026-10-30T10:00:00-04:00',
};

describe('ChangePreview', () => {
  let fixture: ComponentFixture<ChangePreview>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);

  function montar(view: PreviewView, issues: readonly PlacedIssue[] = []): void {
    fixture = TestBed.createComponent(ChangePreview);
    fixture.componentRef.setInput('view', view);
    fixture.componentRef.setInput('issues', issues);
    fixture.componentRef.setInput('atomNames', {
      'agenda.appointment.view': 'Ver las citas',
      'billing.payment.collect': 'Cobrar',
    });
    fixture.detectChanges();
  }

  it('sin cambios dice qué hacer a continuación', () => {
    montar({ kind: 'idle' });
    expect(byId('preview-idle')!.textContent).toContain('qué cambia, antes de guardar');
  });

  it('mientras calcula lo anuncia como estado', () => {
    montar({ kind: 'loading' });
    expect(byId('preview-loading')!.getAttribute('role')).toBe('status');
  });

  it('si falla ofrece volver a calcular', () => {
    montar({ kind: 'error', message: 'No hay conexión.' });
    const volver = vi.fn();
    fixture.componentInstance.retry.subscribe(volver);
    expect(byId('preview-error')!.textContent).toContain('No hay conexión.');
    (byId('preview-retry') as HTMLElement).click();
    expect(volver).toHaveBeenCalled();
  });

  it('muestra el impacto con números, los permisos que se suman y se quitan por nombre, y el puntaje antes → después', () => {
    montar({ kind: 'ready', response: RESPUESTA });

    expect(byId('preview-valid')!.textContent).toContain('Sin errores');
    expect(byId('preview-impact')!.textContent).toContain('3');
    expect(byId('preview-impact')!.textContent).toContain('1 → 2');
    expect(byId('preview-impact')!.textContent).toContain('2 → 4');
    expect(byId('preview-added')!.textContent).toContain('Ver las citas');
    expect(byId('preview-removed')!.textContent).toContain('Cobrar');
    expect(byId('preview-score')!.textContent).toContain('4');
    expect(byId('preview-score')!.textContent).toContain('9');
    expect(byId('preview-score')!.textContent).toContain('+5');
    expect(host().textContent).toContain('Pesa más lo que toca dinero o datos de pacientes.');
  });

  it('cada error trae «Ir al campo» y avisa cuál', () => {
    const issue: PlacedIssue = {
      severity: 'error',
      code: 'GUARDRAIL_CEILING_EXCEEDED',
      message: 'Cobrar no cabe en el techo.',
      writeIndex: 0,
      actionIndex: 1,
      path: 'grants[0].actions[1]',
    };
    montar({ kind: 'ready', response: { ...RESPUESTA, valid: false } }, [issue]);
    const elegido = vi.fn();
    fixture.componentInstance.goTo.subscribe(elegido);

    expect(byId('preview-errors')!.textContent).toContain('Cobrar no cabe en el techo.');
    expect(byId('preview-valid')).toBeNull();
    (byId('preview-goto-GUARDRAIL_CEILING_EXCEEDED') as HTMLElement).click();
    expect(elegido).toHaveBeenCalledWith(issue);
  });

  it('los conflictos de funciones dicen qué pasa con cada uno, con palabras', () => {
    montar({
      kind: 'ready',
      response: {
        ...RESPUESTA,
        governance: {
          ...RESPUESTA.governance,
          sodFindings: [
            {
              ruleCode: 'A',
              action: 'BLOCK',
              atoms: [],
              message: 'Cobrar y anular no van juntos.',
            },
            {
              ruleCode: 'B',
              action: 'WARN',
              atoms: [],
              message: 'Conviene separar crear y cobrar.',
            },
          ],
        },
      },
    });

    expect(byId('preview-sod')!.textContent).toContain('Bloqueado: no se puede guardar así');
    expect(byId('preview-sod')!.textContent).toContain('Aviso: conviene revisarlo');
  });

  it('los avisos no impiden guardar pero se listan aparte', () => {
    const warning: PlacedIssue = {
      severity: 'warning',
      code: 'SOD_WARN',
      message: 'Conflicto de funciones.',
      writeIndex: 0,
      path: 'grants[0]',
    };
    montar({ kind: 'ready', response: RESPUESTA }, [warning]);

    expect(byId('preview-valid')).not.toBeNull();
    expect(byId('preview-warnings')!.textContent).toContain('Conflicto de funciones.');
  });

  it('si el cambio necesita cuatro ojos lo explica', () => {
    montar({
      kind: 'ready',
      response: {
        ...RESPUESTA,
        governance: {
          ...RESPUESTA.governance,
          needsFourEyes: { required: true, reasons: ['Sube el puntaje más de 10 puntos.'] },
        },
      },
    });
    expect(byId('preview-four-eyes')!.textContent).toContain('Sube el puntaje más de 10 puntos.');
  });

  it('es una región que se anuncia sola', () => {
    montar({ kind: 'idle' });
    expect(byId('preview')!.getAttribute('aria-live')).toBe('polite');
  });
});
