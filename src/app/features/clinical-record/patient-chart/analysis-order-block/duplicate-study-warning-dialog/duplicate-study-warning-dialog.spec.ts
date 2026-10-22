import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { DuplicateStudyCheckResult } from '../../../../../core/data-access/diagnostics/diagnostics.types';
import { DuplicateStudyWarningDialog } from './duplicate-study-warning-dialog';

function checkResult(overrides: Partial<DuplicateStudyCheckResult> = {}): DuplicateStudyCheckResult {
  return {
    isDuplicate: true,
    requiresJustification: true,
    pendingReport: false,
    windowDays: 30,
    previousStudy: {
      reportId: 'report-1',
      studyName: 'Hemograma completo',
      providerName: 'Laboratorio Central',
      performedAt: new Date('2026-09-03T12:00:00Z'),
      daysAgo: 14,
      resultsAvailable: true,
      sameOrganization: true,
    },
    ...overrides,
  };
}

describe('DuplicateStudyWarningDialog', () => {
  let fixture: ComponentFixture<DuplicateStudyWarningDialog>;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function query(testId: string): HTMLElement | null {
    return document.querySelector(`[data-testid="${testId}"]`);
  }

  function montar(check: DuplicateStudyCheckResult): void {
    fixture = TestBed.createComponent(DuplicateStudyWarningDialog);
    fixture.componentRef.setInput('check', check);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DuplicateStudyWarningDialog] }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('renderiza estudio, fecha, prestador y hace cuántos días', () => {
    montar(checkResult());

    const texto = root().textContent ?? '';
    expect(texto).toContain('Hemograma completo');
    expect(texto).toContain('Laboratorio Central');
    expect(texto).toContain('14 días');
  });

  it('el botón de confirmar sigue deshabilitado con 15 caracteres y se habilita con 25', () => {
    montar(checkResult());

    const casilla = query('checkbox-repeat-required')?.querySelector('input[type="checkbox"]');
    if (!(casilla instanceof HTMLInputElement)) throw new Error('falta la casilla');
    casilla.click();
    fixture.detectChanges();

    const textarea = query('textarea-duplicate-justification')?.querySelector('textarea');
    if (!(textarea instanceof HTMLTextAreaElement)) throw new Error('falta el textarea');
    const confirmar = query('btn-confirm-justified-duplicate');
    if (!(confirmar instanceof HTMLButtonElement)) throw new Error('falta el botón de confirmar');

    // AppButton deshabilita por `aria-disabled`, no por el atributo nativo: el
    // click queda interceptado en el handler, pero el botón sigue enfocable.
    textarea.value = 'x'.repeat(15);
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmar.getAttribute('aria-disabled')).toBe('true');

    textarea.value = 'x'.repeat(25);
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(confirmar.getAttribute('aria-disabled')).toBe('false');
  });

  it('reutilizar emite `reused` sin pedir justificación', () => {
    montar(checkResult());
    let emitido = false;
    fixture.componentInstance.reused.subscribe(() => (emitido = true));

    const reutilizar = query('btn-reuse-previous-results');
    if (!(reutilizar instanceof HTMLButtonElement)) throw new Error('falta el botón de reutilizar');
    reutilizar.click();

    expect(emitido).toBe(true);
  });

  it('cancelar emite `closed` sin pedir ninguna decisión', () => {
    montar(checkResult());
    let cerrado = false;
    fixture.componentInstance.closed.subscribe(() => (cerrado = true));

    const cancelar = query('btn-cancel-duplicate-dialog');
    if (!(cancelar instanceof HTMLButtonElement)) throw new Error('falta el botón de cancelar');
    cancelar.click();
    fixture.detectChanges();

    expect(cerrado).toBe(true);
  });

  it('sin resultados liberados no ofrece reutilizar', () => {
    montar(
      checkResult({
        previousStudy: {
          reportId: 'report-2',
          studyName: 'Ecografía abdominal',
          providerName: 'Clínica del Este',
          performedAt: new Date('2026-09-10T12:00:00Z'),
          daysAgo: 7,
          resultsAvailable: false,
          sameOrganization: true,
        },
      }),
    );

    expect(query('btn-reuse-previous-results')).toBeNull();
    expect(root().textContent).toContain('No se puede reutilizar un resultado');
  });
});
