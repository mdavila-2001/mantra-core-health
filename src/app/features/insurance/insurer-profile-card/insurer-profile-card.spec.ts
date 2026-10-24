import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { InsurerProfileCard } from './insurer-profile-card';

const ACTIVO = { code: 'CARRIER_ACTIVE', display: 'Aseguradora activa' };

function resumen(carrierCode: string, legalName: string) {
  return {
    id: `id-${carrierCode}`,
    carrierCode,
    legalName,
    regulatorIdentifier: 'REG-99',
    whatsappNumber: '+59171548278',
    callCenterPhone: '800-10-6060',
    supportEmail: 'siniestros@aseguradoradelsur.com.bo',
    jurisdiction: null,
    status: ACTIVO,
    verification: { code: 'VERIFICATION_PENDING', display: 'Verificación pendiente' },
    productCount: 1,
    planCount: 1,
    networkCount: 1,
    createdAt: '2026-08-09T12:00:00.000Z',
    canAdminister: false,
  };
}

describe('InsurerProfileCard', () => {
  let fixture: ComponentFixture<InsurerProfileCard>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InsurerProfileCard);
    fixture.componentRef.setInput('carrierCode', 'ASEG-002');
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function texto(): string {
    return fixture.nativeElement.textContent as string;
  }

  it('muestra la ficha de la aseguradora de esta organización, no la primera del listado', () => {
    http.expectOne('/insurance-carriers').flush({
      items: [resumen('ASEG-001', 'Otra Aseguradora S.A.'), resumen('ASEG-002', 'Aseguradora del Sur S.A.')],
      count: 2,
    });
    fixture.detectChanges();

    expect(texto()).toContain('Aseguradora del Sur S.A.');
    expect(texto()).not.toContain('Otra Aseguradora S.A.');
    expect(texto()).toContain('REG-99');
    expect(texto()).toContain('Verificación pendiente');
  });

  it('muestra los canales de contacto como enlaces (subtarea 2.3)', () => {
    http.expectOne('/insurance-carriers').flush({
      items: [resumen('ASEG-002', 'Aseguradora del Sur S.A.')],
      count: 1,
    });
    fixture.detectChanges();

    const hrefs = Array.from(
      fixture.nativeElement.querySelectorAll('a') as NodeListOf<HTMLAnchorElement>,
    ).map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('tel:800106060');
    expect(hrefs).toContain('mailto:siniestros@aseguradoradelsur.com.bo');
    expect(hrefs).toContain('https://wa.me/59171548278');
  });

  it('explica el vacío si el listado no trae su aseguradora', () => {
    http.expectOne('/insurance-carriers').flush({ items: [], count: 0 });
    fixture.detectChanges();

    expect(texto()).toContain('Todavía no hay una ficha de aseguradora');
  });

  it('distingue lo declarado de lo verificado traduciendo el código', () => {
    const variant = (
      fixture.componentInstance as unknown as { verificationVariant(code: string): string }
    ).verificationVariant.bind(fixture.componentInstance);

    expect(variant('VERIFICATION_VERIFIED')).toBe('approved');
    expect(variant('VERIFICATION_PENDING')).toBe('pending');
    expect(variant('UN_CODIGO_QUE_NO_CONOCEMOS')).toBe('unknown');

    http.expectOne('/insurance-carriers').flush({ items: [], count: 0 });
  });
});
