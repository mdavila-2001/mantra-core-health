import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { InformedConsent } from '../../../../core/data-access/informed-consents/informed-consents.types';
import { InformedConsentBadge } from './informed-consent-badge';

/**
 * La insignia de consentimiento de un ítem de la historia clínica (receta,
 * orden, derivación…). `undefined` es «todavía no se sabe» y no pinta nada;
 * `null` es «no hay consentimiento», que sí se dice.
 */

function consentimiento(partial: Partial<InformedConsent>): InformedConsent {
  return { id: 'ic-1', decision: 'ACCEPTED', status: 'ACTIVE', signatureStatus: 'SIGNED', ...partial } as InformedConsent;
}

describe('InformedConsentBadge', () => {
  let fixture: ComponentFixture<InformedConsentBadge>;

  function pintar(consent: InformedConsent | null | undefined): HTMLElement {
    fixture = TestBed.createComponent(InformedConsentBadge);
    fixture.componentRef.setInput('consent', consent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const estado = (root: HTMLElement) => root.querySelector('[data-testid="consent-state"]');
  const firma = (root: HTMLElement) => root.querySelector('[data-testid="consent-signature-item"]');

  it('sin saber todavía (undefined) no pinta ninguna insignia', () => {
    const root = pintar(undefined);
    expect(estado(root)).toBeNull();
    expect(firma(root)).toBeNull();
  });

  it('sin consentimiento lo advierte, sin insignia de firma', () => {
    const root = pintar(null);
    expect(estado(root)?.getAttribute('data-estado')).toBe('NONE');
    expect(estado(root)?.textContent?.trim()).toBe('Sin consentimiento');
    expect(estado(root)?.classList.contains('badge--warning')).toBe(true);
    expect(firma(root)).toBeNull();
  });

  it('aceptado y firmado', () => {
    const root = pintar(consentimiento({}));
    expect(estado(root)?.getAttribute('data-estado')).toBe('ACCEPTED');
    expect(estado(root)?.classList.contains('badge--success')).toBe(true);
    expect(firma(root)?.textContent?.trim()).toBe('Firmado');
  });

  it('rechazado con firma pendiente', () => {
    const root = pintar(consentimiento({ decision: 'DECLINED', signatureStatus: 'PENDING' } as Partial<InformedConsent>));
    expect(estado(root)?.textContent?.trim()).toBe('Consentimiento rechazado');
    expect(estado(root)?.classList.contains('badge--error')).toBe(true);
    expect(firma(root)?.textContent?.trim()).toBe('Firma pendiente');
    expect(firma(root)?.classList.contains('badge--warning')).toBe(true);
  });

  it('revocado: lo dice y ya no muestra la firma', () => {
    const root = pintar(consentimiento({ status: 'WITHDRAWN' }));
    expect(estado(root)?.getAttribute('data-estado')).toBe('WITHDRAWN');
    expect(estado(root)?.textContent?.trim()).toBe('Consentimiento revocado');
    expect(firma(root)).toBeNull();
  });
});
