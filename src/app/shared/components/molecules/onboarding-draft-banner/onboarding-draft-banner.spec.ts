import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { OnboardingDraft } from '../../../../core/onboarding/onboarding-draft.types';
import { OnboardingDraftBanner } from './onboarding-draft-banner';

describe('OnboardingDraftBanner', () => {
  let fixture: ComponentFixture<OnboardingDraftBanner>;
  let component: OnboardingDraftBanner;

  const mockDraft: OnboardingDraft = {
    draftId: 'test-draft-1',
    formType: 'patient',
    stepIndex: 2,
    stepKey: 'contacto',
    stepTitle: 'Datos de contacto',
    data: { name: 'Carlos', email: 'carlos@example.com' },
    createdAt: '2026-10-20T10:00:00Z',
    updatedAt: '2026-10-20T10:15:00Z',
    percentComplete: 50,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OnboardingDraftBanner],
    });
    fixture = TestBed.createComponent(OnboardingDraftBanner);
    component = fixture.componentInstance;
  });

  it('no dibuja nada cuando draft es null', () => {
    fixture.componentRef.setInput('draft', null);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-testid="onboarding-draft-banner"]');
    expect(el).toBeNull();
  });

  it('dibuja el banner y muestra el número de paso cuando draft está presente', () => {
    fixture.componentRef.setInput('draft', mockDraft);
    fixture.detectChanges();
    const el = fixture.nativeElement.querySelector('[data-testid="onboarding-draft-banner"]');
    expect(el).not.toBeNull();
    expect(el.textContent).toContain('paso 3');
    expect(el.textContent).toContain('Datos de contacto');
  });

  it('emite el evento resume al pulsar Reanudar avance', () => {
    fixture.componentRef.setInput('draft', mockDraft);
    fixture.detectChanges();

    let emittedDraft: OnboardingDraft | null = null;
    component.resume.subscribe((d) => (emittedDraft = d));

    const btnResume = fixture.nativeElement.querySelector('[data-testid="onboarding-draft-resume"]');
    btnResume.click();

    expect(emittedDraft).toEqual(mockDraft);
  });

  it('emite el evento discard al pulsar Empezar de nuevo', () => {
    fixture.componentRef.setInput('draft', mockDraft);
    fixture.detectChanges();

    let discarded = false;
    component.discard.subscribe(() => (discarded = true));

    const btnDiscard = fixture.nativeElement.querySelector('[data-testid="onboarding-draft-discard"]');
    btnDiscard.click();

    expect(discarded).toBe(true);
  });
});
