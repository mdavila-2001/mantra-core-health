import { sameDecimal } from './insurance-claim-detail';

/**
 * `sameDecimal` decide si la pantalla acusa un descuadre entre el monto
 * declarado y la suma de los ítems. Un falso positivo acá le dice a alguien
 * que su facturación no cierra cuando sí cierra; un falso negativo esconde un
 * descuadre real. Por eso se prueba aparte del componente.
 */
describe('sameDecimal', () => {
  it('la escala no es una diferencia', () => {
    // `'1250.0'` y `'1250.00'` son el mismo dinero: marcarlo como descuadre
    // sería avisar de un problema que no existe.
    expect(sameDecimal('1250.0', '1250.00')).toBe(true);
    expect(sameDecimal('1250', '1250.000')).toBe(true);
  });

  it('un céntimo de diferencia sí lo es', () => {
    expect(sameDecimal('1250.00', '1250.01')).toBe(false);
  });

  it('compara sin pasar por coma flotante', () => {
    // Con `Number`, estos dos son iguales por redondeo del doble; como cadena
    // decimal, no lo son. La comparación tiene que ver la diferencia.
    expect(sameDecimal('0.1', '0.10000000000000001')).toBe(false);
  });

  it('sostiene importes que no caben en un doble', () => {
    expect(
      sameDecimal('90071992547409.91', '90071992547409.91'),
    ).toBe(true);
    expect(
      sameDecimal('90071992547409.91', '90071992547409.92'),
    ).toBe(false);
  });

  it('tolera el signo explícito y los espacios de los bordes', () => {
    expect(sameDecimal(' +100.00 ', '100.0')).toBe(true);
  });

  it('distingue el signo', () => {
    expect(sameDecimal('-40.50', '40.50')).toBe(false);
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { InsuranceClaimDetail } from './insurance-claim-detail';

const CLAIM_ID = '11111111-1111-4111-8111-111111111111';
const BOB = { code: 'BOB', display: 'Boliviano' };

/** Un `ClaimDetail` tal cual lo manda el servidor: importes como cadena, fechas ISO. */
function detalleWire(over: Record<string, unknown> = {}) {
  return {
    header: {
      id: CLAIM_ID,
      claimIdentifier: 'CLM-2026-0001',
      patient: { id: 'p-1', displayName: 'Rosa Quispe', patientCode: 'PAC-1', memberIdentifier: 'AF-1' },
      carrierName: 'Nacional Seguros',
      insuranceCarrierId: 'c-1',
      carrierWhatsappNumber: '+59171548278',
      carrierCallCenterPhone: '800-10-6060',
      carrierSupportEmail: 'siniestros@nacional.com.bo',
      policyIdentifier: 'POL-1',
      policyBrokerName: null,
      billedTotal: { amount: '300.00', currency: BOB },
      approvedTotal: { amount: '180.00', currency: BOB },
      submittedAt: '2026-05-01T12:00:00.000Z',
      status: { code: 'CLAIM_ADJUDICATED', display: 'Adjudicado' },
      hasOpenDispute: false,
    },
    lines: [
      {
        id: 'l-approved',
        lineSequence: 1,
        service: { code: 'SRV-1', display: 'Control cardiológico' },
        billedAmount: { amount: '180.00', currency: BOB },
        patientResponsibilityAmount: { amount: '0.00', currency: BOB },
        approvedAmount: { amount: '180.00', currency: BOB },
        deniedAmount: null,
        decision: { code: 'LINE_DECISION_APPROVED', display: 'Aprobada' },
        denialReason: null,
        policyClauseReference: null,
        denialRationale: null,
        referenceType: null,
        reference: null,
      },
      {
        id: 'l-denied',
        lineSequence: 2,
        service: { code: 'SRV-2', display: 'ECG' },
        billedAmount: { amount: '120.00', currency: BOB },
        patientResponsibilityAmount: { amount: '0.00', currency: BOB },
        approvedAmount: { amount: '0.00', currency: BOB },
        deniedAmount: { amount: '120.00', currency: BOB },
        decision: { code: 'LINE_DECISION_DENIED', display: 'Denegada' },
        denialReason: { code: 'NOT_COVERED', display: 'No cubierto' },
        policyClauseReference: 'Cláusula 12.3: Estudios complementarios sin autorización previa',
        denialRationale: 'El estudio requiere autorización previa del área médica según la póliza.',
        referenceType: null,
        reference: null,
      },
      ...(over['lineasAdicionales'] as unknown[] ?? []),
    ],
    lineBilledTotal: { amount: '300.00', currency: BOB },
    lineApprovedTotal: { amount: '180.00', currency: BOB },
    adjudication: null,
    adjudicationHistory: [],
    disputes: [],
    ...over,
  };
}

/**
 * La celda «Motivo» de la tabla de ítems — subtarea 2.2: un ítem denegado
 * muestra la cita de la cláusula contractual y la justificación, no un
 * guión ni el aviso de que la descripción por ítem «no está registrada».
 */
describe('InsuranceClaimDetail · cláusula y justificación del rechazo', () => {
  let fixture: ComponentFixture<InsuranceClaimDetail>;
  let http: HttpTestingController;

  function mount(): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ claimId: CLAIM_ID })) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InsuranceClaimDetail);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  function responder(detalle: Record<string, unknown> = detalleWire()): void {
    http.expectOne(`/insurance-claims/${CLAIM_ID}`).flush(detalle);
    fixture.detectChanges();
  }

  it('el ítem denegado muestra la cita de la cláusula y la justificación completa', () => {
    mount();
    responder();

    const filas = fixture.nativeElement.querySelectorAll('[data-testid="claim-line-reason"]');
    expect(filas.length).toBe(2);

    const celdaDenegada: HTMLElement = filas[1];
    expect(celdaDenegada.textContent).toContain(
      'Cláusula 12.3: Estudios complementarios sin autorización previa',
    );
    expect(celdaDenegada.textContent).toContain(
      'El estudio requiere autorización previa del área médica según la póliza.',
    );

    const badge = celdaDenegada.querySelector('app-badge');
    expect(badge).not.toBeNull();
    // Tono de error: la cláusula es un rechazo, no un aviso genérico.
    expect(badge?.className).toContain('badge--error');
  });

  it('el badge de la cláusula lleva el nombre accesible con el texto de la cita', () => {
    mount();
    responder();

    const filas = fixture.nativeElement.querySelectorAll('[data-testid="claim-line-reason"]');
    const badge: HTMLElement = filas[1].querySelector('app-badge');
    // El nombre accesible sale del host de `app-badge` vía su input `label`.
    expect(badge.getAttribute('aria-label')).toBe(
      'Cláusula de exclusión: Cláusula 12.3: Estudios complementarios sin autorización previa',
    );
  });

  it('el ítem aprobado muestra un guión, sin badge de cláusula', () => {
    mount();
    responder();

    const filas = fixture.nativeElement.querySelectorAll('[data-testid="claim-line-reason"]');
    const celdaAprobada: HTMLElement = filas[0];

    expect(celdaAprobada.textContent?.trim()).toBe('—');
    expect(celdaAprobada.querySelector('app-badge')).toBeNull();
  });

  it('un ítem denegado sin cláusula ni justificación dice que no hay motivo registrado', () => {
    mount();
    const sinCita = detalleWire();
    (sinCita['lines'] as Record<string, unknown>[])[1] = {
      ...(sinCita['lines'] as Record<string, unknown>[])[1],
      policyClauseReference: null,
      denialRationale: null,
      denialReason: null,
    };
    responder(sinCita);

    const filas = fixture.nativeElement.querySelectorAll('[data-testid="claim-line-reason"]');
    expect(filas[1].textContent?.trim()).toBe('Sin motivo registrado');
  });
});

/**
 * Los canales de contacto directo de la aseguradora (subtarea 2.3): la
 * cabecera de la solicitud ya trae los tres canales, y esta pantalla sólo
 * los muestra — no hace ninguna petición adicional.
 */
describe('InsuranceClaimDetail · canales de contacto de la aseguradora', () => {
  let fixture: ComponentFixture<InsuranceClaimDetail>;
  let http: HttpTestingController;

  function mount(): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ claimId: CLAIM_ID })) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InsuranceClaimDetail);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  function responder(detalle: Record<string, unknown> = detalleWire()): void {
    http.expectOne(`/insurance-claims/${CLAIM_ID}`).flush(detalle);
    fixture.detectChanges();
  }

  it('muestra la sección de asistencia con el botón de WhatsApp con href a wa.me', () => {
    mount();
    responder();

    const seccion = fixture.nativeElement.querySelector('h2#claim-contact');
    expect(seccion?.textContent).toContain('Asistencia y soporte de la aseguradora');

    const boton = fixture.nativeElement.querySelector('[data-testid="btn-whatsapp-claim"]');
    expect(boton).not.toBeNull();
    const href: string = boton.getAttribute('href');
    expect(href.startsWith('https://wa.me/')).toBe(true);
    expect(decodeURIComponent(href)).toContain('CLM-2026-0001');
  });

  it('sin WhatsApp registrado, el botón no aparece pero el call center sí', () => {
    mount();
    const detalle = detalleWire();
    (detalle['header'] as Record<string, unknown>)['carrierWhatsappNumber'] = null;
    responder(detalle);

    expect(fixture.nativeElement.querySelector('[data-testid="btn-whatsapp-claim"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="btn-callcenter-claim"]')).not.toBeNull();
  });
});

/**
 * El badge «Posible duplicado» en la celda «Documento» (antiduplicación de
 * estudios, v4.2.17, T-26, subtarea 3.2): quien factura ve que el ítem viene
 * de un estudio repetido, con su justificación — nunca el informe.
 */
describe('InsuranceClaimDetail · antiduplicación de estudios', () => {
  let fixture: ComponentFixture<InsuranceClaimDetail>;
  let http: HttpTestingController;

  function mount(): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ claimId: CLAIM_ID })) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InsuranceClaimDetail);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  function responder(detalle: Record<string, unknown> = detalleWire()): void {
    http.expectOne(`/insurance-claims/${CLAIM_ID}`).flush(detalle);
    fixture.detectChanges();
  }

  it('con estudio duplicado, muestra el badge, el tooltip y la línea de días', () => {
    mount();
    const detalle = detalleWire();
    const lineas = detalle['lines'] as Record<string, unknown>[];
    lineas[0] = {
      ...lineas[0],
      duplicateStudy: {
        previousDiagnosticReportId: 'dr-previo',
        studyName: 'Hemograma completo',
        performedAt: '2026-08-01T10:00:00.000Z',
        daysAgo: 14,
        providerName: 'Laboratorio Central',
        justification: 'Sospecha de anemia aguda, se repite por deterioro clínico.',
        reused: false,
      },
    };
    responder(detalle);

    const boton: HTMLElement | null = fixture.nativeElement.querySelector(
      '[data-testid="badge-duplicate-alert"]',
    );
    expect(boton).not.toBeNull();
    expect(boton?.textContent).toContain('Posible duplicado');
    expect(boton?.getAttribute('aria-label')).toBe(
      'Posible estudio duplicado del ítem 1, estudio previo hace 14 días',
    );

    const fila = boton?.closest('[data-testid="claim-line-reference"], td') ?? fixture.nativeElement;
    expect(fila.textContent).toContain('estudio previo hace 14 días');
  });

  it('sin estudio duplicado, no muestra el badge', () => {
    mount();
    responder();

    expect(
      fixture.nativeElement.querySelector('[data-testid="badge-duplicate-alert"]'),
    ).toBeNull();
  });
});
