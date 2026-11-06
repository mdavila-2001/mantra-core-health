import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { SurveysServiceAssignmentsClient } from './surveys-service-assignments.client';

/* Bodies are written as the server sends them: dates as text, optionals null or absent. */
describe('SurveysServiceAssignmentsClient', () => {
  let client: SurveysServiceAssignmentsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(SurveysServiceAssignmentsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the standard catalog from /surveys/standard-catalog, never /surveys/catalog', async () => {
    const lleno = firstValueFrom(client.listStandardCatalog());
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/surveys/standard-catalog')).flush({
      items: [
        {
          code: 'STD_IMAGING_V1',
          title: 'Estudios por imágenes',
          description: '…',
          serviceKinds: ['IMAGING'],
          source: { instrument: 'CG-CAHPS 4.0', license: 'Dominio público (AHRQ)' },
          additionalSources: [],
          questions: [{ text: '¿Le explicaron el estudio?', answerType: 'BOOLEAN', required: false, dimension: 'claridad' }],
        },
      ],
    });
    expect((await lleno).map((e) => e.code)).toEqual(['STD_IMAGING_V1']);
    http.expectNone((r) => r.url.endsWith('/surveys/catalog'));

    const vacio = firstValueFrom(client.listStandardCatalog());
    http.expectOne((r) => r.url.endsWith('/surveys/standard-catalog')).flush({ items: null });
    expect(await vacio).toEqual([]);
  });

  it('normalizes the date and an absent assignment to null; catalogCode may be null', async () => {
    const pending = firstValueFrom(client.list());
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/surveys/service-assignments')).flush({
      consultation: { system: true, title: 'Cita médica', templateTitle: 'Encuesta de su consulta', questionCount: 12, replaceable: false },
      services: [
        { serviceId: 's-1', serviceName: 'ECG', assignment: null },
        { serviceId: 's-2', serviceName: 'Holter' },
        {
          serviceId: 's-3',
          serviceName: 'Ecografía',
          assignment: { assignmentId: 'a-1', catalogCode: null, title: 'Propia', templateId: 't-1', versionId: 'v-1', assignedAt: '2026-11-01T10:00:00.000Z' },
        },
      ],
    });
    const cuerpo = await pending;
    expect(cuerpo.services[0]!.assignment).toBeNull();
    expect(cuerpo.services[1]!.assignment).toBeNull();
    expect(cuerpo.services[2]!.assignment?.catalogCode).toBeNull();
    expect(cuerpo.services[2]!.assignment?.assignedAt).toEqual(new Date('2026-11-01T10:00:00.000Z'));
  });

  it('PUT sends only the catalog code; DELETE removes', async () => {
    const put = firstValueFrom(client.assign('s-1', 'STD_PROCEDURE_V1'));
    const req = http.expectOne((r) => r.url.endsWith('/surveys/service-assignments/s-1'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ catalogCode: 'STD_PROCEDURE_V1' });
    req.flush({
      serviceId: 's-1',
      serviceName: 'ECG',
      assignment: { assignmentId: 'a-2', catalogCode: 'STD_PROCEDURE_V1', title: 'Procedimientos', templateId: 't-2', versionId: 'v-2', assignedAt: null },
    });
    expect((await put).assignment?.catalogCode).toBe('STD_PROCEDURE_V1');

    const removal = firstValueFrom(client.remove('s-1'));
    const removeRequest = http.expectOne((r) => r.url.endsWith('/surveys/service-assignments/s-1'));
    expect(removeRequest.request.method).toBe('DELETE');
    removeRequest.flush(null, { status: 204, statusText: 'No Content' });
    await removal;
  });
});
