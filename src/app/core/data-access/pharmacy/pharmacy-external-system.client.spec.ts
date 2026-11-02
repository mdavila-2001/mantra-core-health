import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PharmacyIntegrationClient } from './pharmacy-integration.client';
import type {
  ExternalSystemDraft,
  ExternalSystemProbe,
  ExternalSystemSaved,
  ExternalSystemSummary,
} from './pharmacy-integration.types';

const PHARMACY = '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63';
const CONNECTION = 'c1f20f08-4bbf-47f2-8e8e-7a238cde42ba';
const BASE = `/pharmacies/${PHARMACY}/integration-connections`;
const SYSTEM_URL = `${BASE}/${CONNECTION}/external-system`;
const DRAFT: ExternalSystemDraft = {
  format: 'ALOVIDA_STANDARD',
  baseUrl: 'https://system.example.test',
  externalPharmacyCode: 'F-1',
  apiKey: 'synthetic-test-key',
};
const SUMMARY: ExternalSystemSummary = {
  format: DRAFT.format,
  baseUrl: DRAFT.baseUrl,
  externalPharmacyCode: DRAFT.externalPharmacyCode,
  apiKeyConfigured: true,
  configuredAt: '2026-11-01T10:00:00.000Z',
};

describe('PharmacyIntegrationClient · external-system canonical', () => {
  let client: PharmacyIntegrationClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PharmacyIntegrationClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('guarda y prueba con PUT de los cuatro campos del contrato, incluida la clave', () => {
    let saved: ExternalSystemSaved | undefined;
    const draftWithExtraFields = { ...DRAFT, mode: 'CONNECTED', siteCodes: [] };
    client
      .saveSystem(PHARMACY, CONNECTION, draftWithExtraFields)
      .subscribe((result) => (saved = result));

    const request = http.expectOne({ method: 'PUT', url: SYSTEM_URL });
    expect(request.request.body).toEqual(DRAFT);
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ system: SUMMARY, probe: 'OK' });

    expect(saved).toEqual({ system: SUMMARY, probe: 'OK' });
    expect(saved?.system).not.toHaveProperty('apiKey');
  });

  it('no omite una clave vacía ni la interpreta como conservar la guardada', () => {
    client.saveSystem(PHARMACY, CONNECTION, { ...DRAFT, apiKey: '' }).subscribe({
      error: () => undefined,
    });
    const request = http.expectOne({ method: 'PUT', url: SYSTEM_URL });
    expect(request.request.body).toEqual({ ...DRAFT, apiKey: '' });
    request.flush(
      { message: 'apiKey must be longer than or equal to 1 characters' },
      {
        status: 400,
        statusText: 'Bad Request',
      },
    );
  });

  it.each(['PHARMACY', 'SERVER'] as const)(
    'prueba lo guardado sin mandar borrador y devuelve el origen %s',
    (source) => {
      let probe: ExternalSystemProbe | undefined;
      client.probeSystem(PHARMACY, CONNECTION).subscribe((result) => (probe = result));
      const request = http.expectOne({ method: 'POST', url: `${SYSTEM_URL}/test` });
      expect(request.request.body).toEqual({});
      request.flush({ status: 'OK', source });
      expect(probe).toEqual({ status: 'OK', source });
    },
  );

  it('quita solo el sistema propio mediante DELETE y admite 204 sin cuerpo', () => {
    let completed = false;
    client.removeSystem(PHARMACY, CONNECTION).subscribe({
      complete: () => (completed = true),
    });
    const request = http.expectOne({ method: 'DELETE', url: SYSTEM_URL });
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });
    expect(completed).toBe(true);
  });

  it('lee el resumen por conexión desde GET integration-connections', () => {
    let systems: readonly (ExternalSystemSummary | null | undefined)[] = [];
    client.listConnections(PHARMACY).subscribe((list) => {
      systems = list.items.map((item) => item.system);
    });
    const request = http.expectOne({ method: 'GET', url: BASE });
    const connection = {
      id: CONNECTION,
      pharmacySiteId: null,
      siteName: null,
      integrationMode: 'BATCH',
      supportsStockQuery: true,
      status: 'ACTIVE',
      providerConfigured: true,
      createdAt: '2026-11-01T09:00:00.000Z',
    };
    request.flush({
      providerConfigured: true,
      items: [
        { ...connection, system: SUMMARY },
        { ...connection, id: 'server', system: null },
      ],
    });
    expect(systems).toEqual([SUMMARY, null]);
  });

  it.each([
    [400, 'PHARMACY_INTEGRATION_URL_INVALID'],
    [422, 'PHARMACY_INTEGRATION_HOST_NOT_ALLOWED'],
    [502, 'PHARMACY_INTEGRATION_UNAVAILABLE'],
  ])('propaga el rechazo %s con reason %s sin emitir éxito', (status, reason) => {
    let failure: HttpErrorResponse | undefined;
    let emitted = false;
    client.saveSystem(PHARMACY, CONNECTION, DRAFT).subscribe({
      next: () => (emitted = true),
      error: (error: HttpErrorResponse) => (failure = error),
    });
    http
      .expectOne({ method: 'PUT', url: SYSTEM_URL })
      .flush(
        { reason, details: { reason }, correlationId: 'synthetic-request-id' },
        { status: Number(status), statusText: 'Rejected' },
      );
    expect(emitted).toBe(false);
    expect(failure?.status).toBe(status);
    expect(failure?.error.reason).toBe(reason);
  });

  it('codifica farmacia y conexión en las tres operaciones', () => {
    const url = '/pharmacies/f%2Fa/integration-connections/c%20b/external-system';
    client.saveSystem('f/a', 'c b', DRAFT).subscribe();
    client.probeSystem('f/a', 'c b').subscribe();
    client.removeSystem('f/a', 'c b').subscribe();
    http.expectOne({ method: 'PUT', url }).flush({ system: SUMMARY, probe: 'OK' });
    http
      .expectOne({ method: 'POST', url: `${url}/test` })
      .flush({ status: 'OK', source: 'PHARMACY' });
    http
      .expectOne({ method: 'DELETE', url })
      .flush(null, { status: 204, statusText: 'No Content' });
  });
});
