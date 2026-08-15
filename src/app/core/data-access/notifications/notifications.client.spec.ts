import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NotificationsClient } from './notifications.client';

describe('NotificationsClient — Carril 18', () => {
  let client: NotificationsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(NotificationsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listChannels pide /notifications/channels', () => {
    let canales: readonly unknown[] = [];
    client.listChannels().subscribe((items) => (canales = items));

    http.expectOne((r) => r.url === '/notifications/channels').flush({
      items: [{ id: 'ch-1', code: 'IN_APP', name: 'Interna', channelTypeConceptId: 'ct-1' }],
    });

    expect(canales).toEqual([
      { id: 'ch-1', code: 'IN_APP', name: 'Interna', channelTypeConceptId: 'ct-1' },
    ]);
  });

  it('getMyPreferences normaliza los opcionales en null', () => {
    let prefs: readonly unknown[] = [];
    client.getMyPreferences().subscribe((items) => (prefs = items));

    http.expectOne((r) => r.url === '/notifications/preferences').flush({
      items: [
        {
          id: 'pref-1',
          channelId: 'ch-1',
          categoryConceptId: null,
          optedIn: true,
          quietHoursJson: null,
        },
      ],
    });

    expect(prefs).toEqual([{ id: 'pref-1', channelId: 'ch-1', optedIn: true }]);
  });

  it('setPreference hace PUT con el cuerpo dado', () => {
    let resultado: unknown;
    client
      .setPreference({ channelId: 'ch-1', categoryConceptId: 'cat-1', optedIn: false })
      .subscribe((r) => (resultado = r));

    const req = http.expectOne((r) => r.url === '/notifications/preferences');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      channelId: 'ch-1',
      categoryConceptId: 'cat-1',
      optedIn: false,
    });
    req.flush({
      id: 'pref-1',
      channelId: 'ch-1',
      categoryConceptId: 'cat-1',
      optedIn: false,
      quietHoursJson: null,
    });

    expect(resultado).toEqual({
      id: 'pref-1',
      channelId: 'ch-1',
      categoryConceptId: 'cat-1',
      optedIn: false,
    });
  });

  it('listMyInApp manda el límite solo cuando se pide', () => {
    client.listMyInApp().subscribe();
    let req = http.expectOne((r) => r.url === '/notifications/in-app');
    expect(req.request.params.has('limit')).toBe(false);
    req.flush({ items: [], count: 0 });

    client.listMyInApp(10).subscribe();
    req = http.expectOne((r) => r.url === '/notifications/in-app');
    expect(req.request.params.get('limit')).toBe('10');
    req.flush({ items: [], count: 0 });
  });

  it('listMyInApp normaliza fechas y opcionales de cada notificación', () => {
    let items: readonly unknown[] = [];
    client.listMyInApp().subscribe((r) => (items = r));

    http.expectOne((r) => r.url === '/notifications/in-app').flush({
      items: [
        {
          id: 'n-1',
          categoryConceptId: 'cat-accounting',
          subject: null,
          bodyText: 'Registraste un gasto.',
          payloadJson: { transactionId: 't-1' },
          statusConceptId: 'unread',
          relatedResourceType: 'accounting.journal_transactions',
          relatedResourceId: 't-1',
          availableAt: '2026-01-31T10:00:00.000Z',
          readAt: null,
        },
      ],
      count: 1,
    });

    expect(items).toEqual([
      {
        id: 'n-1',
        categoryConceptId: 'cat-accounting',
        bodyText: 'Registraste un gasto.',
        payloadJson: { transactionId: 't-1' },
        statusConceptId: 'unread',
        relatedResourceType: 'accounting.journal_transactions',
        relatedResourceId: 't-1',
        availableAt: new Date('2026-01-31T10:00:00.000Z'),
      },
    ]);
  });
});
