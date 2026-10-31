import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { PATIENT_TIPS } from '../patient-home.copy';
import { PatientTipCard } from './patient-tip-card';

/**
 * El consejo del día en «Mi salud»: uno por día del año, y «Otro consejo» pasa
 * al siguiente en círculo. El texto vive en una región `aria-live` para que el
 * cambio se anuncie.
 */
describe('PatientTipCard', () => {
  let fixture: ComponentFixture<PatientTipCard>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texto = (): string => root().querySelector('[data-testid="mi-salud-consejo-texto"]')!.textContent!.trim();

  beforeEach(async () => {
    fixture = TestBed.createComponent(PatientTipCard);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('muestra uno de los consejos, en una región que se anuncia', () => {
    expect(PATIENT_TIPS.map((t) => t.text)).toContain(texto());
    expect(root().querySelector('[data-testid="mi-salud-consejo-texto"]')?.getAttribute('aria-live')).toBe('polite');
    expect(root().querySelectorAll('.consejo__punto')).toHaveLength(PATIENT_TIPS.length);
    expect(root().querySelectorAll('.consejo__punto--activo')).toHaveLength(1);
  });

  it('«Otro consejo» pasa al siguiente y vuelve a empezar al final', () => {
    const textos = PATIENT_TIPS.map((t) => t.text);
    const inicial = textos.indexOf(texto());
    const boton = root().querySelector<HTMLElement>('[data-testid="mi-salud-otro-consejo"]')!;

    boton.click();
    fixture.detectChanges();
    expect(texto()).toBe(textos[(inicial + 1) % textos.length]);

    for (let i = 1; i < textos.length; i += 1) boton.click();
    fixture.detectChanges();
    expect(texto()).toBe(textos[inicial]);
  });
});
