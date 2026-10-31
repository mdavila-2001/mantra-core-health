import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { InformedConsentsClient, type WireInformedConsent } from './informed-consents.client';
import {
  violationsFromFields,
  consentRuleViolations,
  currentConsentFor,
  type InformedConsent,
} from './informed-consents.types';

const CABLE: WireInformedConsent = {
  id: 'c-1',
  patientProfileId: 'p-1',
  encounterId: 'e-1',
  targetType: 'MEDICATION_REQUEST',
  targetId: 'rx-1',
  targetLabel: 'Amoxicilina 500 mg · cada 8 horas',
  decision: 'ACCEPTED',
  status: 'ACTIVE',
  diagnosisText: null,
  purposeText: 'Tratar la infección',
  benefitsText: 'Curación',
  risksText: 'Diarrea; alergia',
  personalizedRisksText: null,
  alternativesText: null,
  refusalConsequencesText: null,
  patientQuestionsText: null,
  grantedBy: 'PATIENT',
  representativeName: null,
  representativeDocument: null,
  representativeRelationship: null,
  incapacityReason: null,
  informedByProfileId: 'pr-1',
  channel: 'IN_PERSON',
  exceptionType: null,
  exceptionJustification: null,
  withdrawalReason: null,
  signedAt: '2026-10-01T10:00:00.000Z',
  withdrawnAt: null,
  createdAt: '2026-10-01T10:00:00.000Z',
};

describe('InformedConsentsClient', () => {
  let client: InformedConsentsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(InformedConsentsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list manda paciente, tipo y objeto, y convierte los instantes', () => {
    let lista: InformedConsent[] | undefined;
    client
      .list({ patientProfileId: 'p-1', targetType: 'MEDICATION_REQUEST', targetId: 'rx-1' })
      .subscribe((r) => (lista = r));

    const req = http.expectOne((r) => r.url === '/consent/treatment-informed-consents');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('patientProfileId')).toBe('p-1');
    expect(req.request.params.get('targetType')).toBe('MEDICATION_REQUEST');
    expect(req.request.params.get('targetId')).toBe('rx-1');
    req.flush({ items: [CABLE] });

    expect(lista?.[0]?.createdAt).toEqual(new Date('2026-10-01T10:00:00.000Z'));
    // Sin evidencia la firma está pendiente, aunque la API vieja no lo derive.
    expect(lista?.[0]?.signatureStatus).toBe('PENDING');
    expect(lista?.[0]?.evidence).toEqual([]);
  });

  it('list sin filtros de objeto sólo manda el paciente', () => {
    client.list({ patientProfileId: 'p-1' }).subscribe();
    const req = http.expectOne((r) => r.url === '/consent/treatment-informed-consents');
    expect(req.request.params.keys()).toEqual(['patientProfileId']);
    req.flush({ items: [] });
  });

  it('create omite lo vacío y recorta los textos', () => {
    client
      .create({
        patientProfileId: 'p-1',
        encounterId: 'e-1',
        decision: 'DECLINED',
        targetType: 'SERVICE_REQUEST',
        targetId: 'sr-1',
        purposeText: '  Hemograma  ',
        alternativesText: '   ',
      })
      .subscribe();
    const req = http.expectOne('/consent/treatment-informed-consents');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      patientProfileId: 'p-1',
      encounterId: 'e-1',
      decision: 'DECLINED',
      targetType: 'SERVICE_REQUEST',
      targetId: 'sr-1',
      purposeText: 'Hemograma',
    });
    req.flush({ ...CABLE, decision: 'DECLINED' });
  });

  it('withdraw manda el motivo por PATCH', () => {
    let revocado: InformedConsent | undefined;
    client.withdraw('c-1', 'Cambió de opinión').subscribe((r) => (revocado = r));
    const req = http.expectOne('/consent/treatment-informed-consents/c-1/withdraw');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ reason: 'Cambió de opinión' });
    req.flush({ ...CABLE, status: 'WITHDRAWN', withdrawnAt: '2026-10-02T10:00:00.000Z' });
    expect(revocado?.withdrawnAt).toEqual(new Date('2026-10-02T10:00:00.000Z'));
  });

  it('addEvidence registra la firma en la ruta del consentimiento: el sujeto lo pone la ruta', () => {
    client.addEvidence('c-1', 'f-1').subscribe();
    const req = http.expectOne('/consent/treatment-informed-consents/c-1/evidence');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ documentFileId: 'f-1' });
    req.flush({ id: 'ev-1', subjectId: 'c-1', recordedAt: '2026-10-02T10:00:00.000Z' });
  });

  it('informPostEmergency manda el instante en ISO', () => {
    const informedAt = new Date('2026-10-03T12:00:00.000Z');
    client.informPostEmergency('c-1', informedAt).subscribe();
    const req = http.expectOne('/consent/treatment-informed-consents/c-1/post-emergency-information');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ informedAt: '2026-10-03T12:00:00.000Z' });
    req.flush({
      ...CABLE,
      exceptionType: 'EMERGENCY',
      postEmergencyInformedAt: '2026-10-03T12:00:00.000Z',
      evidence: [{ id: 'ev-1', evidenceTypeConceptId: null, capturedChannelConceptId: null, recordedAt: '2026-10-01T10:00:00.000Z' }],
    });
  });

  it('lo que la API omite llega como null, no como undefined', () => {
    let leido: InformedConsent | undefined;
    client.get('c-2').subscribe((r) => (leido = r));
    http
      .expectOne('/consent/treatment-informed-consents/c-2')
      .flush({ id: 'c-2', patientProfileId: 'p-1', decision: 'DECLINED', status: 'ACTIVE', createdAt: '2026-10-01T10:00:00.000Z', evidence: [], signatureStatus: 'PENDING' });
    expect(leido?.targetType).toBeNull();
    expect(leido?.withdrawnAt).toBeNull();
    expect(leido?.assentObtained).toBeNull();
  });

  it('get pide uno por id', () => {
    client.get('c-1').subscribe();
    http.expectOne('/consent/treatment-informed-consents/c-1').flush(CABLE);
  });
});

describe('consentRuleViolations (contrato §2 + enmienda 1)', () => {
  const base = { patientProfileId: 'p-1', encounterId: 'e-1' } as const;

  it('objeto a medias: tipo sin id', () => {
    expect(consentRuleViolations({ ...base, targetType: 'CARE_PLAN' })).toContain(
      'TARGET_PAIR_INCOMPLETE',
    );
  });

  it('con objeto y sin excepción exige propósito, beneficios y riesgos', () => {
    expect(
      consentRuleViolations({ ...base, decision: 'DECLINED', targetType: 'PROCEDURE', targetId: 'x' }),
    ).toEqual(['PURPOSE_REQUIRED', 'BENEFITS_REQUIRED', 'RISKS_REQUIRED']);
  });

  it('una excepción exime de los textos pero exige su justificación', () => {
    expect(
      consentRuleViolations({
        ...base,
        decision: 'DECLINED',
        targetType: 'PROCEDURE',
        targetId: 'x',
        exceptionType: 'PATIENT_WAIVER',
      }),
    ).toEqual(['EXCEPTION_JUSTIFICATION_REQUIRED']);
  });

  it('con representante exige nombre, parentesco y que se declare el asentimiento', () => {
    expect(consentRuleViolations({ ...base, grantedBy: 'GUARDIAN' })).toEqual([
      'REPRESENTATIVE_NAME_REQUIRED',
      'REPRESENTATIVE_RELATIONSHIP_REQUIRED',
      'ASSENT_REQUIRED',
    ]);
    // «No» también es una respuesta: lo que no vale es omitirla.
    expect(
      consentRuleViolations({
        ...base,
        grantedBy: 'GUARDIAN',
        representativeName: 'Ana',
        representativeRelationship: 'Madre',
        assentObtained: false,
      }),
    ).toEqual([]);
  });

  it('aceptar con objeto exige la constancia de revocabilidad, salvo urgencia', () => {
    const aceptado = {
      ...base,
      decision: 'ACCEPTED' as const,
      targetType: 'MEDICATION_REQUEST' as const,
      targetId: 'rx',
      purposeText: 'a',
      benefitsText: 'b',
      risksText: 'c',
    };
    expect(consentRuleViolations(aceptado)).toEqual(['REVOCATION_RIGHT_REQUIRED']);
    expect(consentRuleViolations({ ...aceptado, revocationRightInformed: true })).toEqual([]);
    expect(
      consentRuleViolations({
        ...aceptado,
        exceptionType: 'EMERGENCY',
        exceptionJustification: 'Inconsciente',
      }),
    ).toEqual([]);
  });
});

describe('violationsFromFields', () => {
  it('traduce `details.fields` del 400 a las reglas de la pantalla', () => {
    expect(violationsFromFields(['purposeText', 'risksText'])).toEqual(['PURPOSE_REQUIRED', 'RISKS_REQUIRED']);
    expect(violationsFromFields(['assentObtained'])).toEqual(['ASSENT_REQUIRED']);
    expect(violationsFromFields(['otroCampo'])).toEqual([]);
  });
});

describe('currentConsentFor', () => {
  it('elige el más reciente del objeto, sin confiar en el orden', () => {
    const viejo = { ...CABLE, id: 'a', createdAt: new Date('2026-01-01') } as unknown as InformedConsent;
    const newest = { ...CABLE, id: 'b', createdAt: new Date('2026-02-01') } as unknown as InformedConsent;
    const otro = { ...CABLE, id: 'c', targetId: 'rx-2', createdAt: new Date('2026-03-01') } as unknown as InformedConsent;
    expect(currentConsentFor([viejo, otro, newest], 'MEDICATION_REQUEST', 'rx-1')?.id).toBe('b');
    expect(currentConsentFor([viejo], 'CARE_PLAN', 'rx-1')).toBeNull();
  });
});
