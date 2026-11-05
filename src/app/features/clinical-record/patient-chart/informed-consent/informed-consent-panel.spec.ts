import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AuthService } from '../../../../core/auth/auth.service';
import type { WireInformedConsent } from '../../../../core/data-access/informed-consents/informed-consents.client';
import type { InformedConsent } from '../../../../core/data-access/informed-consents/informed-consents.types';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { InformedConsentPanel } from './informed-consent-panel';

const URL = '/consent/treatment-informed-consents';

const ACEPTADO: WireInformedConsent = {
  id: 'c-1',
  patientProfileId: 'p-1',
  encounterId: 'e-1',
  targetType: 'MEDICATION_REQUEST',
  targetId: 'rx-1',
  targetLabel: 'Amoxicilina 500 mg',
  decision: 'ACCEPTED',
  status: 'ACTIVE',
  diagnosisText: null,
  purposeText: 'Tratar la infección',
  benefitsText: 'Curación',
  risksText: 'Diarrea',
  personalizedRisksText: null,
  alternativesText: null,
  refusalConsequencesText: null,
  patientQuestionsText: null,
  grantedBy: 'PATIENT',
  representativeName: null,
  representativeDocument: null,
  representativeRelationship: null,
  incapacityReason: null,
  informedByProfileId: 'hp-1',
  channel: 'IN_PERSON',
  exceptionType: null,
  exceptionJustification: null,
  withdrawalReason: null,
  revocationRightInformed: true,
  signedAt: '2026-10-01T10:00:00.000Z',
  withdrawnAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
};

/**
 * El panel del consentimiento DIRIGIDO. Lo que fijan estas pruebas es lo que
 * la norma y el contrato exigen y que una refactorización visual podría
 * perder sin que compile distinto: nada premarcado, las mismas reglas que la
 * API, el foco al primer error, la relectura después de registrar y la
 * revocación con motivo.
 */
describe('InformedConsentPanel', () => {
  let fixture: ComponentFixture<InformedConsentPanel>;
  let componente: InformedConsentPanel;
  let http: HttpTestingController;
  let withdrawReason: string | null;

  beforeEach(async () => {
    withdrawReason = 'Prefiere otra opinión';
    await TestBed.configureTestingModule({
      imports: [InformedConsentPanel],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            activeTenantId: signal<string | null>('t-1'),
            roles: signal<readonly string[]>(['PRACTITIONER']),
            practitionerProfileId: signal<string | null>('hp-1'),
            displayName: signal<string | null>('Dra. Rojas'),
          },
        },
        {
          provide: DialogService,
          useValue: {
            confirmWithReason: () => Promise.resolve(withdrawReason),
            confirm: () => Promise.resolve(true),
            confirmarDescarte: () => Promise.resolve(true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InformedConsentPanel);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.componentRef.setInput('encounterId', 'e-1');
    fixture.componentRef.setInput('targetType', 'MEDICATION_REQUEST');
    fixture.componentRef.setInput('targetId', 'rx-1');
    fixture.componentRef.setInput('targetLabel', 'Amoxicilina 500 mg · cada 8 horas');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function señal<T>(nombre: string): WritableSignal<T> {
    return (componente as unknown as Record<string, WritableSignal<T>>)[nombre]!;
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function cargar(lista: WireInformedConsent[]): void {
    fixture.detectChanges();
    const req = http.expectOne((r) => r.url === URL && r.method === 'GET');
    expect(req.request.params.get('patientProfileId')).toBe('p-1');
    expect(req.request.params.get('targetType')).toBe('MEDICATION_REQUEST');
    expect(req.request.params.get('targetId')).toBe('rx-1');
    req.flush({ items: lista });
    fixture.detectChanges();
  }

  function informar(): void {
    señal<string>('proposito').set('Antibiótico para la infección urinaria');
    señal<string>('beneficios').set('Curación en 7 días');
    señal<string>('riesgos').set('Diarrea; alergia rara');
  }

  it('sin consentimiento previo dice qué hacer (S3 con próxima acción)', () => {
    cargar([]);
    expect(texto()).toContain('Todavía no tiene consentimiento');
    expect(texto()).toContain('Receta:');
    expect(texto()).toContain('Amoxicilina 500 mg · cada 8 horas');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-estado="NONE"]')).not.toBeNull();
  });

  it('nada viene premarcado: ni la decisión ni la constancia de revocabilidad', () => {
    cargar([]);
    expect(interno<() => unknown>('decision')()).toBeNull();
    expect(interno<() => boolean>('revocabilidadInformada')()).toBe(false);
    expect(interno<() => string>('etiquetaDelEnvio')()).toBe('Registrar decisión');
  });

  it('el botón dice qué registra según la decisión', () => {
    cargar([]);
    señal<string | null>('decision').set('DECLINED');
    expect(interno<() => string>('etiquetaDelEnvio')()).toBe('Registrar rechazo');
    señal<string | null>('decision').set('ACCEPTED');
    expect(interno<() => string>('etiquetaDelEnvio')()).toBe('Registrar consentimiento');
  });

  it('prellena desde el ítem sin pisar lo escrito', () => {
    señal<string>('riesgos').set('Escrito a mano');
    fixture.componentRef.setInput('defaults', { purposeText: 'Desde la receta', risksText: 'Del ítem' });
    cargar([]);
    expect(interno<() => string>('proposito')()).toBe('Desde la receta');
    expect(interno<() => string>('riesgos')()).toBe('Escrito a mano');
  });

  it('al intentar registrar incompleto no envía: resume, abre la pestaña del primer error', () => {
    cargar([]);
    señal<number>('pestana').set(2);
    interno<() => void>('registrar')();
    fixture.detectChanges();

    expect(texto()).toContain('Revise antes de registrar');
    expect(texto()).toContain('Explique en qué consiste y para qué se indica.');
    expect(texto()).toContain('Elija si la persona acepta o no acepta.');
    expect(interno<() => number>('pestana')()).toBe(0);
    http.expectNone((r) => r.method === 'POST');
  });

  it('las pestañas dicen si les falta algo', () => {
    cargar([]);
    const rotulos = interno<() => string[]>('rotulos')();
    expect(rotulos[0]).toBe('1 · Información · falta');
    expect(rotulos[1]).toBe('2 · Quién otorga · lista');
    informar();
    expect(interno<() => string[]>('rotulos')()[0]).toBe('1 · Información · lista');
  });

  it('aceptar exige la constancia de que se informó el derecho a revocar', () => {
    cargar([]);
    informar();
    señal<string | null>('decision').set('ACCEPTED');
    interno<() => void>('registrar')();
    fixture.detectChanges();
    expect(texto()).toContain('Deje constancia de que informó que puede revocar su decisión.');
    http.expectNone((r) => r.method === 'POST');
  });

  it('con representante pide nombre, parentesco y asentimiento, en la pestaña 2', () => {
    cargar([]);
    informar();
    señal<string>('otorgante').set('GUARDIAN');
    señal<string | null>('decision').set('DECLINED');
    interno<() => void>('registrar')();
    fixture.detectChanges();
    expect(interno<() => number>('pestana')()).toBe(1);
    expect(texto()).toContain('Indique el nombre de quien otorga en representación.');
    expect(texto()).toContain('Indique si la persona representada dio su asentimiento.');
  });

  it('registra con objeto, relee y avisa al ítem: UI → request → relectura', () => {
    let emitido: InformedConsent | null | undefined;
    componente.consentChanged.subscribe((c) => (emitido = c));
    cargar([]);
    informar();
    señal<string | null>('decision').set('ACCEPTED');
    señal<boolean>('revocabilidadInformada').set(true);
    señal<string>('idioma').set('qu');
    señal<string>('testigo').set('Juan Mamani');

    interno<() => void>('registrar')();
    const post = http.expectOne((r) => r.url === URL && r.method === 'POST');
    expect(post.request.body).toEqual({
      patientProfileId: 'p-1',
      encounterId: 'e-1',
      decision: 'ACCEPTED',
      targetType: 'MEDICATION_REQUEST',
      targetId: 'rx-1',
      targetLabel: 'Amoxicilina 500 mg · cada 8 horas',
      purposeText: 'Antibiótico para la infección urinaria',
      benefitsText: 'Curación en 7 días',
      risksText: 'Diarrea; alergia rara',
      grantedBy: 'PATIENT',
      channel: 'IN_PERSON',
      informedByProfileId: 'hp-1',
      witnessName: 'Juan Mamani',
      informationLanguage: 'qu',
      revocationRightInformed: true,
    });
    post.flush(ACEPTADO);
    expect(emitido?.id).toBe('c-1');

    fixture.detectChanges();
    // Lo que prueba el registro es que vuelva de la lectura.
    http.expectOne((r) => r.url === URL && r.method === 'GET').flush({ items: [ACEPTADO] });
    fixture.detectChanges();
    expect(texto()).toContain('Decisión registrada');
    expect(texto()).toContain('Adjuntar firma');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-estado="ACCEPTED"]')).not.toBeNull();
    expect(texto()).toContain('Firma pendiente');
    expect(interno<() => number>('pestana')()).toBe(3);
  });

  it('un 400 de la API señala cada campo de `details.fields` y conserva lo escrito', () => {
    cargar([]);
    informar();
    señal<string | null>('decision').set('DECLINED');
    señal<number>('pestana').set(2);
    interno<() => void>('registrar')();
    http.expectOne((r) => r.url === URL && r.method === 'POST').flush(
      {
        code: 'VALIDATION_FAILED',
        message: 'Falta información obligatoria para consentir',
        reason: 'INFORMED_CONSENT_INFORMATION_INCOMPLETE',
        details: { fields: ['risksText'] },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(texto()).toContain('Falta información obligatoria para consentir');
    // El campo queda señalado con su corrección, y la pestaña se abre ahí.
    expect(interno<(c: string) => string>('errorDe')('riesgos')).toBe('Indique los riesgos frecuentes y los graves.');
    expect(interno<() => number>('pestana')()).toBe(0);
    expect(interno<() => string>('proposito')()).toBe('Antibiótico para la infección urinaria');
  });

  it('sin atención no ofrece un formulario que siempre fallaría: S3 con la próxima acción', () => {
    fixture.componentRef.setInput('encounterId', null);
    cargar([]);
    const pantalla = fixture.nativeElement as HTMLElement;
    expect(texto()).toContain('Abra un encuentro para registrar el consentimiento');
    expect(pantalla.querySelector('[data-testid="consent-record"]')).toBeNull();
    expect(pantalla.querySelector('app-tabs')).toBeNull();
  });

  it('sin atención igual deja ver y revocar lo ya registrado', () => {
    fixture.componentRef.setInput('encounterId', null);
    cargar([ACEPTADO]);
    expect(texto()).toContain('Revocar consentimiento');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="consent-history"]')).not.toBeNull();
  });

  it('el encuentro del ítem (defaults) alcanza para registrar', () => {
    fixture.componentRef.setInput('encounterId', null);
    fixture.componentRef.setInput('defaults', { encounterId: 'e-9' });
    cargar([]);
    expect(interno<() => string | null>('encuentro')()).toBe('e-9');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-tabs')).not.toBeNull();
  });

  it('revoca con motivo y relee', async () => {
    cargar([ACEPTADO]);
    expect(texto()).toContain('Revocar consentimiento');
    await interno<() => Promise<void>>('revocar')();
    const req = http.expectOne(`${URL}/c-1/withdraw`);
    expect(req.request.body).toEqual({ reason: 'Prefiere otra opinión' });
    req.flush({ ...ACEPTADO, status: 'WITHDRAWN', withdrawnAt: '2026-10-02T10:00:00.000Z', withdrawalReason: 'Prefiere otra opinión' });
    fixture.detectChanges();
    http.expectOne((r) => r.url === URL && r.method === 'GET').flush({
      items: [{ ...ACEPTADO, status: 'WITHDRAWN', withdrawnAt: '2026-10-02T10:00:00.000Z', withdrawalReason: 'Prefiere otra opinión' }],
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-estado="WITHDRAWN"]')).not.toBeNull();
    expect(texto()).not.toContain('Revocar consentimiento');
  });

  it('cancelar la revocación no manda nada', async () => {
    withdrawReason = null;
    cargar([ACEPTADO]);
    await interno<() => Promise<void>>('revocar')();
    http.expectNone((r) => r.method === 'PATCH');
  });

  it('un 403 en la lectura cae en el anfitrión de estados, no en el formulario', () => {
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === URL)
      .flush({ code: 'FORBIDDEN', message: 'Sin permiso' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="consent-record"]')).toBeNull();
  });
});
