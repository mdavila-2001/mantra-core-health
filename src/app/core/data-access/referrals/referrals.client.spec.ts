import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ReferralsClient } from './referrals.client';
import { motivoDeDerivacion } from './referrals.errors';
import { problemasDeDerivacion, type Referral } from './referrals.types';

describe('ReferralsClient', () => {
  let client: ReferralsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(ReferralsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista por paciente y limpia nulos, fechas y enums', () => {
    let filas: readonly Referral[] = [];
    client.listByPatient('p-1').subscribe((r) => (filas = r));

    const req = http.expectOne((r) => r.url === '/referrals');
    expect(req.request.params.get('patientProfileId')).toBe('p-1');
    req.flush([
      {
        id: 'r-1',
        patientProfileId: 'p-1',
        statusConceptId: 'st-1',
        status: 'PENDING',
        referralType: 'THERAPY',
        targetExternalName: 'Centro de Fisioterapia Andino',
        targetProfileId: null,
        requestedServiceText: 'Fisioterapia de rodilla, 10 sesiones',
        validUntil: '2026-11-30',
        respondedAt: null,
        createdAt: '2026-10-20T14:00:00.000Z',
      },
      {
        id: 'r-legado',
        patientProfileId: 'p-1',
        statusConceptId: 'st-1',
        referralType: null,
        status: 'RARO',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(filas).toHaveLength(2);
    const [nueva, legado] = filas;
    expect(nueva!.referralType).toBe('THERAPY');
    expect(nueva!.status).toBe('PENDING');
    expect(nueva!.targetProfileId).toBeUndefined();
    expect(nueva!.validUntil?.getDate()).toBe(30);
    expect(nueva!.createdAt).toBeInstanceOf(Date);
    expect(legado!.referralType).toBeUndefined();
    expect(legado!.status).toBeUndefined();
  });

  it('acepta el listado con sobre { items }', () => {
    let filas: readonly Referral[] = [];
    client.listByPatient('p-1').subscribe((r) => (filas = r));
    http.expectOne((r) => r.url === '/referrals').flush({
      items: [{ id: 'r-1', patientProfileId: 'p-1', statusConceptId: 's', createdAt: '2026-10-01T00:00:00Z' }],
    });
    expect(filas.map((f) => f.id)).toEqual(['r-1']);
  });

  it('emite sin claves vacías y con la vigencia como día local', () => {
    let creada: Referral | null = null;
    client
      .create({
        patientProfileId: 'p-1',
        referralType: 'DIAGNOSTIC',
        targetExternalName: '  Laboratorio externo ',
        targetExternalContact: '',
        requestedServiceText: 'Perfil tiroideo',
        clinicalSummary: 'Bocio difuso.',
        validUntil: new Date(2026, 10, 15, 23, 30),
      })
      .subscribe((r) => (creada = r));

    const req = http.expectOne((r) => r.url === '/referrals' && r.method === 'POST');
    expect(req.request.body).toEqual({
      patientProfileId: 'p-1',
      referralType: 'DIAGNOSTIC',
      targetExternalName: 'Laboratorio externo',
      requestedServiceText: 'Perfil tiroideo',
      clinicalSummary: 'Bocio difuso.',
      validUntil: '2026-11-15',
    });
    req.flush({ id: 'r-9', patientProfileId: 'p-1', statusConceptId: 's', createdAt: '2026-10-28T10:00:00Z' });

    expect(creada!.id).toBe('r-9');
    // Lo enviado completa una respuesta angosta.
    expect(creada!.referralType).toBe('DIAGNOSTIC');
    expect(creada!.requestedServiceText).toBe('Perfil tiroideo');
  });

  const DTO = { id: 'r-1', patientProfileId: 'p-1', statusConceptId: 's', createdAt: '2026-10-28T10:00:00Z' };

  it('responde con motivo sólo si lo hay y devuelve la derivación', () => {
    let respondida: Referral | null = null;
    client.respond('r-1', { decision: 'ACCEPT', rejectReason: '' }).subscribe((r) => (respondida = r));
    const aceptar = http.expectOne((r) => r.url === '/referrals/r-1/respond');
    expect(aceptar.request.method).toBe('PATCH');
    expect(aceptar.request.body).toEqual({ decision: 'ACCEPT' });
    aceptar.flush({ ok: true, ...DTO, status: 'ACCEPTED' });
    expect(respondida!.status).toBe('ACCEPTED');

    client.respond('r-1', { decision: 'REJECT', rejectReason: 'Sin cupo' }).subscribe();
    const rechazar = http.expectOne((r) => r.url === '/referrals/r-1/respond');
    expect(rechazar.request.body).toEqual({ decision: 'REJECT', rejectReason: 'Sin cupo' });
    rechazar.flush({ ok: true, ...DTO, status: 'REJECTED', rejectReason: 'Sin cupo' });
  });

  it('registra la contrarreferencia', () => {
    client.counterReferral('r-1', 'Alta de fisioterapia.').subscribe();
    const req = http.expectOne((r) => r.url === '/referrals/r-1/counter-referral');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ counterReferralText: 'Alta de fisioterapia.' });
    req.flush({ ...DTO, status: 'COMPLETED' });
  });

  it('anula sin cuerpo útil y devuelve CANCELLED', () => {
    let anulada: Referral | null = null;
    client.cancel('r-1').subscribe((r) => (anulada = r));
    const req = http.expectOne((r) => r.url === '/referrals/r-1/cancel');
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...DTO, status: 'CANCELLED' });
    expect(anulada!.status).toBe('CANCELLED');
  });

  it('lee el sub-código del error y lo pone en palabras', () => {
    let error: unknown = null;
    client.cancel('r-1').subscribe({ error: (e: unknown) => (error = e) });
    http.expectOne((r) => r.url === '/referrals/r-1/cancel').flush(
      { statusCode: 422, code: 'PRECONDITION_FAILED', reason: 'REFERRAL_ALREADY_CLOSED', message: 'x', details: {} },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(motivoDeDerivacion(error)?.mensaje).toContain('ya está cerrada');

    client.create({
      patientProfileId: 'p-1',
      referralType: 'OTHER',
      targetExternalName: 'X',
      requestedServiceText: 'Y',
      clinicalSummary: 'Z',
    }).subscribe({ error: (e: unknown) => (error = e) });
    http.expectOne((r) => r.url === '/referrals').flush(
      {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        reason: 'REFERRAL_SERVICE_INFORMATION_INCOMPLETE',
        message: 'x',
        details: { fields: ['clinicalSummary'] },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    expect(motivoDeDerivacion(error)?.campos).toEqual(['clinicalSummary']);
  });
});

describe('problemasDeDerivacion', () => {
  const hoy = new Date(2026, 9, 28);
  const valida = {
    patientProfileId: 'p-1',
    referralType: 'TREATMENT' as const,
    targetBranchId: 'b-1',
    requestedServiceText: 'Hemodiálisis',
    clinicalSummary: 'ERC estadio 5.',
  };

  it('no objeta una derivación completa', () => {
    expect(problemasDeDerivacion(valida, hoy)).toEqual([]);
  });

  it('exige tipo, destino, servicio y resumen clínico', () => {
    const campos = problemasDeDerivacion({ patientProfileId: 'p-1' }, hoy).map((p) => p.campo);
    expect(campos).toEqual(['referralType', 'destino', 'requestedServiceText', 'clinicalSummary']);
  });

  it('un destino externo alcanza como destino', () => {
    const { targetBranchId: _b, ...sinSede } = valida;
    expect(problemasDeDerivacion({ ...sinSede, targetExternalName: 'Dr. Quispe' }, hoy)).toEqual([]);
  });

  it('respeta los topes del DTO', () => {
    const campos = problemasDeDerivacion(
      { ...valida, requestedServiceText: 'x'.repeat(501), targetExternalName: 'y'.repeat(201) },
      hoy,
    ).map((p) => p.campo);
    expect(campos).toEqual(['targetExternalName', 'requestedServiceText']);
  });

  it('la vigencia no termina antes de hoy, pero hoy vale', () => {
    expect(problemasDeDerivacion({ ...valida, validUntil: new Date(2026, 9, 28) }, hoy)).toEqual([]);
    expect(
      problemasDeDerivacion({ ...valida, validUntil: new Date(2026, 9, 27) }, hoy).map((p) => p.campo),
    ).toEqual(['validUntil']);
  });
});
