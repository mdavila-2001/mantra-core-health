import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PromotionsClient } from './promotions.client';
import type { MyPromotionsResponseDto } from './promotions.dto';

describe('PromotionsClient', () => {
  let client: PromotionsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PromotionsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide GET /promotions/me sin ningún parámetro: el titular sale del token', () => {
    let count = -1;
    client.listMine().subscribe((page) => (count = page.count));

    const req = http.expectOne((r) => r.url === '/promotions/me');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ items: [], count: 0 } satisfies MyPromotionsResponseDto);

    expect(count).toBe(0);
  });

  it('propaga el error real en vez de inventar un vacío', () => {
    let status = 0;
    client.listMine().subscribe({ error: (error: { status: number }) => (status = error.status) });

    http
      .expectOne('/promotions/me')
      .flush(
        { message: 'Se requiere X-Tenant-Id' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    expect(status).toBe(422);
  });
});
