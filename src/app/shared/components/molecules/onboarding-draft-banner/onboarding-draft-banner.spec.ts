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

  it('trata al usuario de usted, como el resto del alta', () => {
    fixture.componentRef.setInput('draft', mockDraft);
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.querySelector('[data-testid="onboarding-draft-banner"]').textContent;
    expect(texto).toContain('Tiene un registro guardado en borrador');
    expect(texto).toContain('Quedó en el paso 3');
    expect(texto).toContain('¿Desea continuar desde donde lo dejó?');
    expect(texto).not.toMatch(/Tenés|Quedaste|Querés|dejaste/);
  });

  it('muestra la fecha en 24 h, sin «a. m.» ni «p. m.» ni puntos dobles', () => {
    fixture.componentRef.setInput('draft', { ...mockDraft, updatedAt: '2026-10-20T15:15:00' });
    fixture.detectChanges();
    const texto: string = fixture.nativeElement.querySelector('.onboarding-draft-banner__details').textContent;
    expect(texto).toContain('20/10/2026 15:15.');
    expect(texto).not.toMatch(/[ap]\. ?m\./);
    expect(texto).not.toContain('..');
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
