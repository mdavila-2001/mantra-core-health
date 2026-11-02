import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type { LabSummary } from '../../../core/data-access/lab-portal/lab-portal.types';
import { LaboratorySummaryPage } from './laboratory-summary';

/**
 * El resumen del portal de laboratorio: indicadores (con alerta cuando hay
 * algo pendiente), servicios por categoría en barras relativas al mayor,
 * atajos a la bandeja con su filtro y actividad reciente. Un fallo de la API
 * no se muestra como «cero».
 */

const RESUMEN: LabSummary = {
  labName: 'Laboratorio Andino',
  published: 12,
  drafts: 2,
  withdrawn: 1,
  unavailable: 1,
  ordersWithoutResults: 3,
  resultFiles: 40,
  resultBytes: 2_097_152,
  byCategory: [
    { category: 'Hematología', count: 8 },
    { category: 'Química', count: 4 },
  ],
  recentActivity: [{ id: 'a-1', text: 'Publicó Hemograma', at: '2026-10-30T12:00:00Z' }],
} as unknown as LabSummary;

describe('LaboratorySummaryPage', () => {
  let fixture: ComponentFixture<LaboratorySummaryPage>;
  let getSummary: ReturnType<typeof vi.fn>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const q = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);

  function pintar(): void {
    fixture = TestBed.createComponent(LaboratorySummaryPage);
    fixture.detectChanges();
  }

  beforeEach(() => {
    getSummary = vi.fn(() => of(RESUMEN));
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: LabPortalClient, useValue: { getSummary } }] });
  });

  it('nombra al laboratorio y muestra sus indicadores', () => {
    pintar();
    expect(root().querySelector('h1')?.textContent).toContain('Resumen');
    expect(root().textContent).toContain('Laboratorio Andino: qué ofrece');
    expect(q('summary-published')?.textContent).toBe('12');
    expect(q('summary-orders-without-results')?.textContent).toBe('3');
    expect(q('summary-result-files')?.textContent).toBe('40');
  });

  it('lo pendiente se resalta: no disponibles y órdenes sin resultado', () => {
    pintar();
    expect(q('summary-unavailable')!.closest('li')!.classList.contains('summary__indicator--alert')).toBe(true);
    expect(q('summary-orders-without-results')!.closest('li')!.classList.contains('summary__indicator--alert')).toBe(true);
    expect(q('summary-drafts')!.closest('li')!.classList.contains('summary__indicator--alert')).toBe(false);
  });

  it('las barras por categoría son relativas a la mayor', () => {
    pintar();
    const anchos = Array.from(root().querySelectorAll<HTMLElement>('.summary__bar-fill')).map((b) => b.style.inlineSize);
    expect(anchos).toEqual(['100%', '50%']);
  });

  it('los atajos llevan a la bandeja con el filtro de cada paso', () => {
    pintar();
    const hrefs = Array.from(root().querySelectorAll('a.summary__shortcut')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '/administration/laboratory-orders?estado=draft',
      '/administration/laboratory-orders?estado=processed',
    ]);
  });

  it('sin categorías ni actividad lo dice en palabras', () => {
    getSummary.mockReturnValue(of({ ...RESUMEN, byCategory: [], recentActivity: [] }));
    pintar();
    expect(root().textContent).toContain('Todavía no hay servicios en su catálogo.');
    expect(q('summary-no-activity')).not.toBeNull();
  });

  it('un error de la API no se pinta como un resumen en cero', () => {
    getSummary.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    pintar();
    expect(q('summary-card')).toBeNull();
    expect(q('summary-published')).toBeNull();
  });
});
