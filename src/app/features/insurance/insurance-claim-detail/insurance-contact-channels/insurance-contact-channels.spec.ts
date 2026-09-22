import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import type { ClaimListItem } from '../../../../core/data-access/insurance/insurance.types';
import { InsuranceContactChannels } from './insurance-contact-channels';

/** Una cabecera de solicitud mínima, con los tres canales en null por defecto. */
function header(over: Partial<ClaimListItem> = {}): ClaimListItem {
  return {
    id: 'claim-1',
    claimIdentifier: 'CLM-2026-0177',
    patient: {
      id: 'p-1',
      displayName: 'Rosa Quispe',
      patientCode: 'PAC-1',
      memberIdentifier: 'AF-1',
    },
    carrierName: 'Alianza Seguros',
    insuranceCarrierId: 'c-1',
    carrierWhatsappNumber: null,
    carrierCallCenterPhone: null,
    carrierSupportEmail: null,
    policyIdentifier: 'POL-88213',
    policyBrokerName: null,
    billedTotal: { amount: '120.00', currency: null },
    approvedTotal: null,
    submittedAt: null,
    status: null,
    hasOpenDispute: false,
    ...over,
  };
}

describe('InsuranceContactChannels', () => {
  let fixture: ComponentFixture<InsuranceContactChannels>;

  async function crear(h: ClaimListItem): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [InsuranceContactChannels],
    }).compileComponents();

    fixture = TestBed.createComponent(InsuranceContactChannels);
    fixture.componentRef.setInput('header', h);
    fixture.detectChanges();
  }

  it('should create', async () => {
    await crear(header());
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('arma la URL de WhatsApp con los dígitos limpios y un mensaje que nombra la solicitud, el paciente y la aseguradora', async () => {
    await crear(
      header({
        carrierWhatsappNumber: '+591 71 548278',
        claimIdentifier: 'CLM-2026-0177',
        patient: {
          id: 'p-1',
          displayName: 'Rosa Quispe',
          patientCode: 'PAC-1',
          memberIdentifier: 'AF-1',
        },
        carrierName: 'Alianza Seguros',
        policyIdentifier: 'POL-88213',
      }),
    );

    const boton = fixture.debugElement.query(By.css('[data-testid="btn-whatsapp-claim"]'));
    expect(boton).toBeTruthy();
    const href = boton.nativeElement.getAttribute('href') as string;
    expect(href.startsWith('https://wa.me/59171548278?text=')).toBe(true);

    const mensaje = decodeURIComponent(href.split('?text=')[1]);
    expect(mensaje).toContain('CLM-2026-0177');
    expect(mensaje).toContain('Rosa Quispe');
    expect(mensaje).toContain('Alianza Seguros');
    expect(mensaje).toContain('POL-88213');
  });

  it('sin WhatsApp registrado, el botón no existe (Escenario 2)', async () => {
    await crear(header({ carrierWhatsappNumber: null, carrierCallCenterPhone: '800-10-6060' }));

    expect(fixture.debugElement.query(By.css('[data-testid="btn-whatsapp-claim"]'))).toBeNull();
    expect(fixture.debugElement.query(By.css('[data-testid="btn-callcenter-claim"]'))).toBeTruthy();
  });

  it('el enlace de WhatsApp abre en pestaña nueva y sin dejar referencia a la sesión (Escenario 1)', async () => {
    await crear(header({ carrierWhatsappNumber: '+59171548278' }));

    const boton = fixture.debugElement.query(By.css('[data-testid="btn-whatsapp-claim"]'));
    expect(boton.nativeElement.getAttribute('target')).toBe('_blank');
    expect(boton.nativeElement.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('el call center se marca sin espacios en el href tel: (Escenario 3)', async () => {
    await crear(header({ carrierCallCenterPhone: '800-10-6060' }));

    const boton = fixture.debugElement.query(By.css('[data-testid="btn-callcenter-claim"]'));
    expect(boton.nativeElement.getAttribute('href')).toBe('tel:800106060');
    expect(boton.nativeElement.textContent).toContain('800-10-6060');
  });

  it('el correo de siniestros se arma como mailto:', async () => {
    await crear(header({ carrierSupportEmail: 'siniestros@aseguradora.com.bo' }));

    const boton = fixture.debugElement.query(By.css('[data-testid="btn-support-email-claim"]'));
    expect(boton.nativeElement.getAttribute('href')).toBe('mailto:siniestros@aseguradora.com.bo');
  });

  it('sin ningún canal, muestra la nota de ausencia y ningún enlace', async () => {
    await crear(header());

    expect(fixture.debugElement.query(By.css('[data-testid="insurance-contact-absent"]'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('[data-testid="btn-whatsapp-claim"]'))).toBeNull();
    expect(fixture.debugElement.query(By.css('[data-testid="btn-callcenter-claim"]'))).toBeNull();
    expect(fixture.debugElement.query(By.css('[data-testid="btn-support-email-claim"]'))).toBeNull();
  });
});
