import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Injector, runInInjectionContext, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ReferralsClient } from '../../../core/data-access/referrals/referrals.client';
import { ConsultationReferrals } from './consultation-referrals';

const ROW = {
  id: 'ref-1',
  patientProfileId: 'p-1',
  statusConceptId: 'st',
  createdAt: '2026-10-24T12:00:00.000Z',
};

/**
 * La lectura de derivaciones que comparten la casilla y el bloque: una a la
 * vez (la vieja no pisa a la nueva), sin volver a S2 al releer a la misma
 * persona, y relee sola cuando se emite una derivación aunque el bloque ya no
 * esté montado.
 */
describe('ConsultationReferrals', () => {
  let http: HttpTestingController;
  let profileId: WritableSignal<string>;
  let referrals: ConsultationReferrals;

  const forPatient = (id: string) => (r: { url: string; method: string; params: { get(k: string): string | null } }) =>
    r.url === '/referrals' && r.method === 'GET' && r.params.get('patientProfileId') === id;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    profileId = signal('p-1');
    referrals = runInInjectionContext(TestBed.inject(Injector), () => new ConsultationReferrals(profileId));
    TestBed.tick();
  });

  afterEach(() => http.verify());

  it('lee a la persona al nacer y cuenta lo leído', () => {
    expect(referrals.state().status).toBe('loading');
    expect(referrals.count()).toBeNull();
    http.expectOne(forPatient('p-1')).flush([ROW]);
    expect(referrals.state().status).toBe('ready');
    expect(referrals.count()).toBe(1);
  });

  it('si cambia la persona con una lectura en vuelo, la vieja se cancela y no pisa a la nueva', () => {
    const first = http.expectOne(forPatient('p-1'));
    profileId.set('p-2');
    TestBed.tick();

    expect(first.cancelled).toBe(true);
    // Otra persona arranca en S2: nunca los datos de la anterior como «atrasados».
    expect(referrals.state().status).toBe('loading');
    http.expectOne(forPatient('p-2')).flush([{ ...ROW, id: 'ref-2', patientProfileId: 'p-2' }]);
    expect(referrals.count()).toBe(1);
    expect(referrals.state().status).toBe('ready');
  });

  it('releer a la misma persona deja la lista a la vista como S7, con la hora de la lectura', () => {
    http.expectOne(forPatient('p-1')).flush([ROW]);

    referrals.reload();

    const state = referrals.state();
    expect(state.status).toBe('stale');
    expect(state.status === 'stale' && state.asOf).toBeInstanceOf(Date);
    // La casilla no pierde la cifra mientras tanto.
    expect(referrals.count()).toBe(1);
    http.expectOne(forPatient('p-1')).flush([ROW, { ...ROW, id: 'ref-2' }]);
    expect(referrals.state().status).toBe('ready');
    expect(referrals.count()).toBe(2);
  });

  it('dos relecturas seguidas: sólo cuenta la última', () => {
    http.expectOne(forPatient('p-1')).flush([ROW]);
    referrals.reload();
    referrals.reload();
    const [older, newer] = http.match(forPatient('p-1'));
    expect(older!.cancelled).toBe(true);
    newer!.flush([ROW, { ...ROW, id: 'ref-2' }]);
    expect(referrals.count()).toBe(2);
  });

  it('si falla la relectura de la misma persona, la lista sigue (S7) con su cifra y el fallo va aparte', () => {
    http.expectOne(forPatient('p-1')).flush([ROW]);
    referrals.reload();
    http
      .expectOne(forPatient('p-1'))
      .flush({ code: 'INTERNAL', message: 'Falló.', correlationId: 'req-9' }, { status: 500, statusText: 'Server Error' });

    const state = referrals.state();
    expect(state.status).toBe('stale');
    expect(referrals.count()).toBe(1);
    expect(referrals.missingCount()).toBeNull();
    expect(referrals.refreshError()).toContain('req-9');

    // Reintentar: mientras viaja, sin el fallo anterior; al volver bien, limpio.
    referrals.reload();
    expect(referrals.refreshError()).toBeNull();
    http.expectOne(forPatient('p-1')).flush([ROW]);
    expect(referrals.state().status).toBe('ready');
    expect(referrals.refreshError()).toBeNull();
  });

  it('un fallo de la lectura es su estado, sin inventar un cero', () => {
    http
      .expectOne(forPatient('p-1'))
      .flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });
    expect(referrals.state().status).toBe('error');
    expect(referrals.count()).toBeNull();
  });

  it('una derivación emitida para esta persona la relee, aunque nadie avise con `cambio`', () => {
    http.expectOne(forPatient('p-1')).flush([ROW]);

    // Lo que hace el bloque al derivar; después ya puede no estar montado.
    TestBed.inject(ReferralsClient)
      .create({ patientProfileId: 'p-1', sourceEncounterId: 'enc-1', targetProfileId: 'hp-1' })
      .subscribe();
    http.expectOne((r) => r.url === '/referrals' && r.method === 'POST').flush({ ...ROW, id: 'ref-2' });

    http.expectOne(forPatient('p-1')).flush([ROW, { ...ROW, id: 'ref-2' }]);
    expect(referrals.count()).toBe(2);
  });

  it('una derivación de otra persona no la relee', () => {
    http.expectOne(forPatient('p-1')).flush([ROW]);
    TestBed.inject(ReferralsClient)
      .create({ patientProfileId: 'p-9', sourceEncounterId: 'enc-9', targetProfileId: 'hp-1' })
      .subscribe();
    http.expectOne((r) => r.url === '/referrals' && r.method === 'POST').flush({ ...ROW, patientProfileId: 'p-9' });
    http.expectNone(forPatient('p-1'));
  });

  it('sin persona no pide nada', () => {
    http.expectOne(forPatient('p-1')).flush([ROW]);
    profileId.set('');
    TestBed.tick();
    expect(referrals.state().status).toBe('loading');
    http.expectNone((r) => r.url === '/referrals');
  });
});
