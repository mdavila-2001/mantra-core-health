import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { LogoDeOrganizacionClient } from './organization-logo.client';

describe('LogoDeOrganizacionClient', () => {
  let client: LogoDeOrganizacionClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(LogoDeOrganizacionClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lee bytes por pertenencia al tenant y los convierte a una URL de imagen', async () => {
    const result = firstValueFrom(client.obtenerUrl('t-1'));
    const logo = http.expectOne('/tenants/t-1/logo');
    expect(logo.request.headers.get('X-Tenant-Id')).toBe('t-1');
    logo.flush({ fileId: 'subido-por-otro-miembro' });
    const content = http.expectOne('/tenants/t-1/logo/content');
    expect(content.request.headers.get('X-Tenant-Id')).toBe('t-1');
    expect(content.request.responseType).toBe('blob');
    content.flush(new Blob(['PNG'], { type: 'image/png' }));
    expect(await result).toBe('data:image/png;base64,UE5H');
    http.expectNone('/common/files/subido-por-otro-miembro/content');
  });

  it('sin logo no pide bytes', async () => {
    const result = firstValueFrom(client.obtenerUrl('t-1'));
    http.expectOne('/tenants/t-1/logo').flush({ fileId: null });
    expect(await result).toBeNull();
    http.expectNone('/tenants/t-1/logo/content');
  });

  it('un contenido no autorizado conserva el estado vacío de la ficha', async () => {
    const result = firstValueFrom(client.obtenerUrl('t-1'));
    http.expectOne('/tenants/t-1/logo').flush({ fileId: 'f-1' });
    http.expectOne('/tenants/t-1/logo/content').flush(null, { status: 403, statusText: 'Forbidden' });
    expect(await result).toBeNull();
  });
});
