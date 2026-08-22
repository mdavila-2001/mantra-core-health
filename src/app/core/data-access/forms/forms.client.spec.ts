import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FormsClient } from './forms.client';
import type {
  FormInstance,
  FormInstanceDetail,
  FormInstanceList,
  MyFormInstanceList,
} from './forms.types';

describe('FormsClient', () => {
  let client: FormsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(FormsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('openInstance manda el recurso al backend y devuelve la instancia', () => {
    let recibida: FormInstance | undefined;
    client.openInstance({ resourceId: 'enc-1' }).subscribe((i) => (recibida = i));

    const req = http.expectOne('/forms/instances');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ resourceId: 'enc-1' });

    req.flush({ id: 'inst-1', schemaVersion: 1, state: 'open' });
    expect(recibida).toEqual({ id: 'inst-1', schemaVersion: 1, state: 'open' });
  });

  it('captureValues manda los valores y devuelve los ids creados', () => {
    let ids: readonly string[] | undefined;
    client
      .captureValues('inst-1', [{ fieldId: 'f1', dataType: 'string', value: 'hola' }])
      .subscribe((r) => (ids = r));

    const req = http.expectOne('/forms/instances/inst-1/values');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      values: [{ fieldId: 'f1', dataType: 'string', value: 'hola' }],
    });

    req.flush({ ids: ['v1'] });
    expect(ids).toEqual(['v1']);
  });

  it('closeInstance cierra la instancia sin cuerpo relevante', () => {
    let resuelto = false;
    client.closeInstance('inst-1').subscribe(() => (resuelto = true));

    const req = http.expectOne('/forms/instances/inst-1/close');
    expect(req.request.method).toBe('POST');

    req.flush({ ok: true });
    expect(resuelto).toBe(true);
  });

  it('codifica el id de instancia en la ruta', () => {
    client.captureValues('inst/../otro', []).subscribe();

    const req = http.expectOne((r) => r.url.includes('inst%2F..%2Fotro'));
    req.flush({ ids: [] });
  });

  it('listInstancesByEncounter pregunta por el encuentro con GET y query exactos', () => {
    let recibido: FormInstanceList | undefined;
    client.listInstancesByEncounter('enc-1', 10).subscribe((r) => (recibido = r));

    const req = http.expectOne(
      (r) =>
        r.url === '/forms/instances' &&
        r.method === 'GET' &&
        r.params.get('encounter') === 'enc-1' &&
        r.params.get('limit') === '10',
    );

    const listado: FormInstanceList = {
      encounterId: 'enc-1',
      items: [
        {
          id: 'inst-1',
          resourceId: 'enc-1',
          resourceTypeConceptId: 'rt-1',
          schemaVersion: 1,
          createdAt: '2026-08-17T14:00:00Z',
        },
      ],
      limit: 10,
      truncated: false,
    };
    req.flush(listado);
    expect(recibido).toEqual(listado);
  });

  it('listInstancesByEncounter sin tope no manda limit', () => {
    client.listInstancesByEncounter('enc-1').subscribe();

    const req = http.expectOne(
      (r) =>
        r.url === '/forms/instances' &&
        r.method === 'GET' &&
        r.params.get('encounter') === 'enc-1' &&
        !r.params.has('limit'),
    );
    req.flush({ encounterId: 'enc-1', items: [], limit: 50, truncated: false });
  });

  it('getInstance trae el detalle con sus valores, incluido el enmascarado sin valor', () => {
    let recibido: FormInstanceDetail | undefined;
    client.getInstance('inst-1').subscribe((r) => (recibido = r));

    const req = http.expectOne(
      (r) => r.url === '/forms/instances/inst-1' && r.method === 'GET',
    );

    req.flush({
      id: 'inst-1',
      resourceId: 'enc-1',
      resourceTypeConceptId: 'rt-1',
      schemaVersion: 1,
      createdAt: '2026-08-17T14:00:00Z',
      values: [
        {
          id: 'v-1',
          fieldId: 'f-1',
          dataType: 'string',
          value: 'Buena',
          ordinal: 0,
          masked: false,
        },
        { id: 'v-2', fieldId: 'f-2', dataType: 'string', value: null, ordinal: 1, masked: true },
      ],
    });

    expect(recibido?.values).toHaveLength(2);
    expect(recibido?.values[1].masked).toBe(true);
    expect(recibido?.values[1].value).toBeNull();
  });

  it('listMyInstances pregunta por lo propio sin mandar ningún identificador', () => {
    let recibido: MyFormInstanceList | undefined;
    client.listMyInstances(10).subscribe((r) => (recibido = r));

    // La URL no lleva paciente ni tenant: el servidor los toma de la sesión.
    const req = http.expectOne(
      (r) =>
        r.url === '/forms/me/instances' &&
        r.method === 'GET' &&
        r.params.get('limit') === '10' &&
        r.params.keys().length === 1,
    );

    const listado: MyFormInstanceList = {
      items: [
        {
          id: 'inst-1',
          resourceId: 'enc-1',
          resourceTypeConceptId: 'rt-1',
          schemaVersion: 1,
          createdAt: '2026-08-17T14:00:00Z',
        },
      ],
      limit: 10,
      truncated: false,
    };
    req.flush(listado);
    expect(recibido).toEqual(listado);
  });

  it('listMyInstances sin tope no manda limit', () => {
    client.listMyInstances().subscribe();

    const req = http.expectOne(
      (r) => r.url === '/forms/me/instances' && r.method === 'GET' && !r.params.has('limit'),
    );
    req.flush({ items: [], limit: 50, truncated: false });
  });

  it('getMyInstance trae el detalle propio con la etiqueta del campo', () => {
    let recibido: FormInstanceDetail | undefined;
    client.getMyInstance('inst-1').subscribe((r) => (recibido = r));

    const req = http.expectOne(
      (r) => r.url === '/forms/me/instances/inst-1' && r.method === 'GET',
    );

    req.flush({
      id: 'inst-1',
      resourceId: 'enc-1',
      resourceTypeConceptId: 'rt-1',
      schemaVersion: 1,
      createdAt: '2026-08-17T14:00:00Z',
      values: [
        {
          id: 'v-1',
          fieldId: 'f-1',
          dataType: 'string',
          fieldName: 'Tolerancia al ejercicio',
          value: 'Buena',
          ordinal: 0,
          masked: false,
        },
        { id: 'v-2', fieldId: 'f-2', dataType: 'string', value: null, ordinal: 1, masked: true },
      ],
    });

    expect(recibido?.values[0].fieldName).toBe('Tolerancia al ejercicio');
    expect(recibido?.values[1].masked).toBe(true);
    expect(recibido?.values[1].value).toBeNull();
  });
});
