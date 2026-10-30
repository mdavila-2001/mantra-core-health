import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PracticeOnboardingClient } from './practice-onboarding.client';
import type { CreatedOrganizationPractice } from './practice-onboarding.types';

describe('PracticeOnboardingClient', () => {
  let client: PracticeOnboardingClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(PracticeOnboardingClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const site = {
    name: 'Sede Norte',
    addressText: 'Av. San Martín 123',
    latitude: -17.78,
    longitude: -63.18,
  };

  it('hace POST a /tenants/:tenantId/practices con el cuerpo exacto', () => {
    client.createPractice('t-1', { name: 'Centro Médico Norte', site: { ...site, cityText: 'Santa Cruz' } }).subscribe();

    const req = http.expectOne((r) => r.url === '/tenants/t-1/practices');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'Centro Médico Norte',
      site: { ...site, cityText: 'Santa Cruz' },
    });
    req.flush({ practiceId: 'p', practiceSiteId: 's' });
  });

  it('no manda la ciudad si no se escribió', () => {
    client.createPractice('t-1', { name: 'Centro', site }).subscribe();

    const req = http.expectOne((r) => r.url === '/tenants/t-1/practices');
    expect('cityText' in req.request.body.site).toBe(false);
    req.flush({ practiceId: 'p', practiceSiteId: 's' });
  });

  it('escapa el identificador de la organización en la ruta', () => {
    client.createPractice('t/1', { name: 'Centro', site }).subscribe();

    http.expectOne((r) => r.url === '/tenants/t%2F1/practices').flush({});
  });

  it('devuelve los identificadores de la práctica y la sede', () => {
    let creada: CreatedOrganizationPractice | null = null;
    client.createPractice('t-1', { name: 'Centro', site }).subscribe((c) => (creada = c));

    http.expectOne((r) => r.url === '/tenants/t-1/practices').flush({ practiceId: 'p-1', practiceSiteId: 's-1' });

    expect(creada).toEqual({ practiceId: 'p-1', practiceSiteId: 's-1' });
  });
});
