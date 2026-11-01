import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PharmacyIntegrationClient } from './pharmacy-integration.client';

describe('PharmacyIntegrationClient ERP contract', () => {
  let client: PharmacyIntegrationClient;
  let http: HttpTestingController;
  const url = '/pharmacies/farmacia/erp-connection';
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PharmacyIntegrationClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('reads the connection from the existing endpoint', () => {
    client.readErpConnection('farmacia').subscribe();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('GET');
    request.flush({ mode: 'MANUAL' });
  });
  it('omits an empty key and preserves siteCodes when saving', () => {
    client
      .saveErpConnection('farmacia', {
        mode: 'CONNECTED',
        apiKey: '',
        siteCodes: [{ siteId: 'sede', externalCode: 'CENTRO' }],
      })
      .subscribe();
    const request = http.expectOne(url);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      mode: 'CONNECTED',
      siteCodes: [{ siteId: 'sede', externalCode: 'CENTRO' }],
    });
    request.flush({ mode: 'CONNECTED' });
  });
  it('tests draft data without sending a mode or reading a key back', () => {
    client
      .testErpConnection('farmacia', {
        systemCode: 'SIMULATED_CHAIN',
        baseUrl: 'http://127.0.0.1',
        pharmacyCode: 'F',
        apiKey: '',
      })
      .subscribe();
    const request = http.expectOne(`${url}/test`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      systemCode: 'SIMULATED_CHAIN',
      baseUrl: 'http://127.0.0.1',
      pharmacyCode: 'F',
    });
    request.flush({ result: 'AUTH_REJECTED' });
  });
  it('tests the saved connection through its distinct mutating endpoint', () => {
    client.testSavedErpConnection('farmacia').subscribe();
    const request = http.expectOne(`${url}/test-saved`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ result: 'OK' });
  });
});
