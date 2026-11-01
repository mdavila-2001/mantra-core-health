import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { UiVisibilityClient } from './ui-visibility.client';
import type { MyUiVisibility, UiElementDraft, UiElementSyncResult } from './ui-visibility.types';

describe('UiVisibilityClient', () => {
  let client: UiVisibilityClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(UiVisibilityClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide lo oculto de la sesión con GET /me/ui-visibility y lo devuelve tal cual', () => {
    let body: MyUiVisibility | undefined;
    client.mine().subscribe((b) => (body = b));
    const req = http.expectOne('/me/ui-visibility');
    expect(req.request.method).toBe('GET');
    const respuesta: MyUiVisibility = {
      hiddenKeys: ['nav.pharmacy-orders', 'dashboard.today-agenda'],
      version: 'v7',
      generatedAt: '2026-10-31T10:00:00Z',
    };
    req.flush(respuesta);
    expect(body).toEqual(respuesta);
  });

  it('publica el catálogo con POST /admin/ui-visibility/elements/sync dentro de { elements }', () => {
    const elements: UiElementDraft[] = [
      {
        key: 'dashboard.today-agenda',
        kind: 'WIDGET',
        moduleCode: 'dashboard',
        parentKey: 'nav.dashboard',
        label: 'Agenda de hoy',
        description: null,
        defaultVisible: true,
      },
    ];
    let result: UiElementSyncResult | undefined;
    client.sync(elements).subscribe((r) => (result = r));
    const req = http.expectOne('/admin/ui-visibility/elements/sync');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ elements });
    req.flush({ created: 1, updated: 0, retired: 0, unchanged: 0 });
    expect(result).toEqual({ created: 1, updated: 0, retired: 0, unchanged: 0 });
  });

  it('propaga el error HTTP al que llama (decide quién consume qué hacer)', () => {
    let status: number | undefined;
    client.mine().subscribe({ error: (e: { status: number }) => (status = e.status) });
    http.expectOne('/me/ui-visibility').flush({ code: 'INTERNAL' }, { status: 500, statusText: 'x' });
    expect(status).toBe(500);
  });
});
