import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { FormsClient } from './forms.client';
import type { FormInstance } from './forms.types';

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
});
