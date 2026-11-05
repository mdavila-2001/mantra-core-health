import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { wireMine } from '../../../../testing/admissions';
import type { MyAdmission } from './admissions.types';
import { OwnAdmissionClient } from './own-admission.client';

const OWN = '/profiles/practitioners/me/admission';

describe('OwnAdmissionClient', () => {
  let client: OwnAdmissionClient;
  let http: HttpTestingController;
  let mine: MyAdmission | undefined;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(OwnAdmissionClient);
    http = TestBed.inject(HttpTestingController);
    mine = undefined;
  });

  afterEach(() => http.verify());

  it('lee su admisión y convierte las fechas y los estados', () => {
    client.myAdmission().subscribe((x) => (mine = x));
    http
      .expectOne(OWN)
      .flush(wireMine({ status: { code: 'ENVIADA', label: 'Enviada' }, infoDueAt: '2026-11-20T00:00:00Z', canWithdraw: true }));
    expect(mine?.status.code).toBe('SUBMITTED');
    expect(mine?.infoDueAt).toBeInstanceOf(Date);
    expect(mine).toMatchObject({ canResubmit: false, canWithdraw: true, resubmissionCount: 0 });
  });

  it('a quien le ven un motivo de fraude no se lo cuentan: la API ya lo entrega como «otro»', () => {
    client.myAdmission().subscribe((x) => (mine = x));
    http.expectOne(OWN).flush(
      wireMine({ items: [{ type: 'LICENSE', id: 'i', label: 'Matrícula', state: 'REJECTED', reasonText: 'No se lee.', reasonCode: 'ILEGIBLE' }] }),
    );
    expect(mine?.items[0]?.reasonCode).toBe('ILLEGIBLE');
  });

  it('envía la primera solicitud por POST con la atestación y su versión, y devuelve la admisión enviada', () => {
    client.submitMyAdmission({ attested: true, attestationVersion: '2026-10' }).subscribe((x) => (mine = x));
    const req = http.expectOne(`${OWN}/submit`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ attested: true, attestationVersion: '2026-10' });
    req.flush(wireMine({ status: { code: 'ENVIADA', label: 'Enviada' } }));
    expect(mine?.status.code).toBe('SUBMITTED');
  });

  it('un rechazo del envío llega tal cual, con su motivo, para que la pantalla decida', () => {
    let failure: unknown;
    client.submitMyAdmission({ attested: true, attestationVersion: '2026-10' }).subscribe({ error: (e: unknown) => (failure = e) });
    http
      .expectOne(`${OWN}/submit`)
      .flush({ code: 'CONFLICT', reason: 'ADMISSION_ALREADY_EXISTS', message: 'Ya tiene una solicitud' }, { status: 409, statusText: 'Conflict' });
    expect(failure).toMatchObject({ status: 409, error: { reason: 'ADMISSION_ALREADY_EXISTS' } });
  });

  it('reenvía con la atestación y su versión, y nada más', () => {
    client.resubmitMyAdmission({ attested: true, attestationVersion: '2026-10' }).subscribe();
    const req = http.expectOne(`${OWN}/resubmit`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ attested: true, attestationVersion: '2026-10' });
    req.flush(wireMine());
  });

  it('retira su solicitud', () => {
    client.withdrawMyAdmission().subscribe((x) => (mine = x));
    const req = http.expectOne(`${OWN}/withdraw`);
    expect(req.request.method).toBe('POST');
    req.flush(wireMine({ status: { code: 'RETIRADA', label: 'Retirada' }, canWithdraw: false }));
    expect(mine?.status.code).toBe('WITHDRAWN');
  });
});
