import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { OpsToolsClient } from './ops-tools.client';
import type { OpsToolsOverview } from './ops-tools.types';

describe('OpsToolsClient', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lee GET /admin/ops/tools y entrega el cuerpo tal cual', () => {
    const cuerpo: OpsToolsOverview = {
      evaluatedAt: '2026-10-30T12:00:00.000Z',
      items: [
        {
          code: 'postgresql',
          name: 'PostgreSQL',
          kind: 'DATABASE',
          isCritical: true,
          status: 'ACTIVE',
          requiredEnvVars: ['DATABASE_URL'],
          health: {
            state: 'OK',
            checkType: 'LIVE',
            observedAt: '2026-10-30T11:59:55.000Z',
            missingEnvVars: [],
          },
        },
      ],
      notMeasured: [],
    };
    let recibido: OpsToolsOverview | undefined;
    TestBed.inject(OpsToolsClient)
      .tools()
      .subscribe((r) => (recibido = r));
    const req = http.expectOne('/admin/ops/tools');
    expect(req.request.method).toBe('GET');
    req.flush(cuerpo);
    expect(recibido).toEqual(cuerpo);
  });
});
