import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { RoadmapStep } from '../my-verifications.model';
import { VerificationRoadmap } from './verification-roadmap';

/**
 * The roadmap tab: one primary call to action for the first required step the
 * person can act on, the required steps apart from the optional ones, and the
 * celebration only when every required step carries its seal.
 */

function paso(key: string, partial: Partial<RoadmapStep> = {}): RoadmapStep {
  return {
    key,
    title: `Etapa ${key}`,
    icon: 'shield',
    state: 'approved',
    stateLabel: 'Verificado',
    detail: `Detalle ${key}`,
    optional: false,
    ...partial,
  };
}

describe('VerificationRoadmap', () => {
  let fixture: ComponentFixture<VerificationRoadmap>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string) => root().querySelector(`[data-testid="${id}"]`);

  function render(steps: readonly RoadmapStep[], pending = 0): void {
    TestBed.configureTestingModule({
      imports: [VerificationRoadmap],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(VerificationRoadmap);
    fixture.componentRef.setInput('steps', steps);
    fixture.componentRef.setInput('pending', pending);
    fixture.detectChanges();
  }

  it('highlights the first required actionable step as the next one', () => {
    render([
      paso('account'),
      paso('profile', {
        state: 'not-started',
        stateLabel: 'Sin cargar',
        action: { label: 'Completar mi perfil', route: '/onboarding' },
      }),
      paso('credentials', {
        state: 'not-started',
        optional: true,
        action: { label: 'Cargar un título', route: '/my-account/edit' },
      }),
    ]);

    expect(byId('verif-resumen')?.textContent).toContain('Siguiente paso: Etapa profile');
    expect(byId('verif-siguiente')?.textContent).toContain('Completar mi perfil');
    expect(byId('verif-siguiente')?.getAttribute('href')).toBe('/onboarding');
    expect(byId('verif-tramo-profile')?.classList).toContain('is-siguiente');
    expect(byId('verif-tramo-credentials')?.textContent).toContain('Cargar un título');
    expect(byId('verif-resumen')?.textContent).toContain('1 de 3');
  });

  it('celebrates when every required step is verified and links to pending requests', () => {
    render(
      [
        paso('account'),
        paso('profile'),
        paso('institutions', { optional: true, state: 'not-started' }),
      ],
      2,
    );

    expect(byId('verif-resumen')?.textContent).toContain('todos los sellos obligatorios');
    expect(byId('verif-resumen')?.textContent).toContain('2 solicitudes esperando respuesta');
    expect(byId('verif-siguiente')).toBeNull();
    expect(byId('verif-ir-bandeja')).not.toBeNull();
  });
});
