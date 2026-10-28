import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AuthService } from '../../../../core/auth/auth.service';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import { ReferralBlock } from './referral-block';
import { destinoDe, estadoDe, vencida } from './referral-labels';

const ENUM = {
  code: 'x',
  name: 'x',
  definitionId: 'd',
  valueSetId: 'vs',
  cacheToken: 'v1',
  allowCustomValue: false,
  options: [{ conceptId: 'pri-urgente', code: 'PRI-URGENT', display: 'Urgent', ordinal: 1 }],
};

const DERIVACIONES = [
  {
    id: 'r-1',
    patientProfileId: 'p-1',
    statusConceptId: 's',
    status: 'PENDING',
    referralType: 'THERAPY',
    targetExternalName: 'Centro de Fisioterapia Andino',
    requestedServiceText: 'Fisioterapia de rodilla',
    priorityConceptId: 'pri-urgente',
    createdAt: '2026-10-20T10:00:00Z',
  },
  {
    id: 'r-2',
    patientProfileId: 'p-1',
    statusConceptId: 's',
    status: 'ACCEPTED',
    referralType: 'CONSULTATION',
    targetTenantId: 't-1',
    targetTenantName: 'Hospital San Lucas',
    targetBranchId: 'b-1',
    targetBranchName: 'Anexo Norte',
    requestedServiceText: 'Interconsulta con endocrinología',
    createdAt: '2026-10-10T10:00:00Z',
  },
];

describe('ReferralBlock', () => {
  let fixture: ComponentFixture<ReferralBlock>;
  let http: HttpTestingController;

  async function montar(puedeEscribir: boolean): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ReferralBlock],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            activeTenantId: signal<string | null>('t-1'),
            roles: signal<readonly string[]>(['PRACTITIONER']),
            practitionerProfileId: signal<string | null>('hp-1'),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ReferralBlock);
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.componentRef.setInput('puedeEscribir', puedeEscribir);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  function responder(derivaciones: unknown[]): void {
    for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) req.flush(ENUM);
    http.expectOne((r) => r.url === '/referrals').flush(derivaciones);
    for (const req of http.match((r) => r.url === '/consent/treatment-informed-consents')) req.flush([]);
    fixture.detectChanges();
  }

  afterEach(() => {
    for (const req of http.match(() => true)) req.flush([]);
  });

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('lista las derivaciones con tipo, destino, prioridad y estado', async () => {
    await montar(true);
    responder(DERIVACIONES);
    expect(texto()).toContain('Derivaciones (2)');
    expect(texto()).toContain('Terapia');
    expect(texto()).toContain('Centro de Fisioterapia Andino (externo)');
    expect(texto()).toContain('Hospital San Lucas · Anexo Norte');
    expect(texto()).toContain('Urgente');
    expect(texto()).toContain('Pendiente');
    expect(texto()).toContain('Nueva derivación');
  });

  it('vacío: dice qué hacer (S3)', async () => {
    await montar(true);
    responder([]);
    expect(texto()).toContain('todavía no tiene derivaciones');
    expect(texto()).toContain('Nueva derivación');
  });

  it('sin permiso de escritura no ofrece la pestaña de alta', async () => {
    await montar(false);
    responder(DERIVACIONES);
    expect(texto()).not.toContain('Nueva derivación');
  });

  it('tras cambiar el consentimiento relee la derivación y muestra el vínculo que dice la API', async () => {
    await montar(true);
    responder(DERIVACIONES);
    const bloque = fixture.componentInstance as unknown as {
      alCambiarConsentimiento: (id: string, c: null) => void;
    };
    bloque.alCambiarConsentimiento('r-1', null);
    const relectura = http.expectOne((r) => r.url === '/referrals/r-1');
    relectura.flush({ ...DERIVACIONES[0], informedConsentId: 'c-9' });
    fixture.detectChanges();
    const vinculado = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="derivacion-consentimiento-vinculado"]',
    );
    expect(vinculado?.textContent).toContain('Aceptado');
  });

  it('un 403 de la lista se muestra como prohibido y no como vacío', async () => {
    await montar(true);
    for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) req.flush(ENUM);
    http
      .expectOne((r) => r.url === '/referrals')
      .flush({ statusCode: 403, code: 'FORBIDDEN', message: 'Sin permiso' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect(texto()).not.toContain('todavía no tiene derivaciones');
  });
});

describe('referral-labels', () => {
  const base: Referral = {
    id: 'r',
    patientProfileId: 'p',
    statusConceptId: 's',
    createdAt: new Date(),
  };

  it('nunca muestra un uuid como destino', () => {
    expect(destinoDe({ ...base, targetProfileId: 'uuid-1' })).toBe('Profesional de la plataforma');
    expect(destinoDe(base)).toBe('Sin destino registrado');
  });

  it('sin estado derivado por la API, no inventa uno', () => {
    expect(estadoDe(base).etiqueta).toBe('Registrada');
  });

  it('la vigencia vence al día siguiente, no en el instante', () => {
    const hoy = new Date(2026, 9, 28, 18);
    expect(vencida({ ...base, validUntil: new Date(2026, 9, 28) }, hoy)).toBe(false);
    expect(vencida({ ...base, validUntil: new Date(2026, 9, 27) }, hoy)).toBe(true);
  });
});
