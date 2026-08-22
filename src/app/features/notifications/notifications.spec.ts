import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NOTIFICATION_CATEGORY } from '../../core/data-access/notifications/notification-concepts';
import { Notifications } from './notifications';

const IN_APP_CHANNEL = 'ch-in-app';
const EMAIL_CHANNEL = 'ch-email';

describe('Notifications — Carril 18', () => {
  let fixture: ComponentFixture<Notifications>;
  let http: HttpTestingController;

  function flushInicial(): void {
    http.expectOne((r) => r.url === '/notifications/channels').flush({
      items: [
        {
          id: IN_APP_CHANNEL,
          code: 'IN_APP',
          name: 'Interna',
          channelTypeConceptId: '41557f04-1334-5b20-a794-16bf070f64fb',
        },
        {
          id: EMAIL_CHANNEL,
          code: 'EMAIL',
          name: 'Email',
          channelTypeConceptId: '91a8ccd8-39f8-5381-8e79-d319598c8a96',
        },
      ],
    });
    http.expectOne((r) => r.url === '/notifications/preferences').flush({ items: [] });
    http.expectOne((r) => r.url === '/notifications/in-app').flush({ items: [], count: 0 });
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Notifications],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(Notifications);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide canales, preferencias y bandeja al construirse', () => {
    fixture.detectChanges();
    flushInicial();
  });

  it('sin preferencia guardada, una categoría aparece "recibir" por defecto', () => {
    fixture.detectChanges();
    flushInicial();
    fixture.detectChanges();

    const categorias = (
      fixture.componentInstance as unknown as {
        categorias: () => readonly { categoryConceptId: string; optedIn: boolean }[];
      }
    ).categorias();

    expect(categorias.find((c) => c.categoryConceptId === NOTIFICATION_CATEGORY.ACCOUNTING)?.optedIn).toBe(
      true,
    );
  });

  it('cambiar el interruptor de una categoría hace PUT y vuelve a pedir las preferencias', () => {
    fixture.detectChanges();
    flushInicial();
    fixture.detectChanges();

    const componente = fixture.componentInstance as unknown as {
      categorias: () => readonly { categoryConceptId: string; optedIn: boolean }[];
      toggleCategoria: (
        fila: { categoryConceptId: string; optedIn: boolean },
        optedIn: boolean,
      ) => void;
    };
    const fila = componente
      .categorias()
      .find((c) => c.categoryConceptId === NOTIFICATION_CATEGORY.ACCOUNTING)!;

    componente.toggleCategoria(fila, false);

    const put = http.expectOne((r) => r.url === '/notifications/preferences');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      channelId: IN_APP_CHANNEL,
      categoryConceptId: NOTIFICATION_CATEGORY.ACCOUNTING,
      optedIn: false,
    });
    put.flush({
      id: 'pref-1',
      channelId: IN_APP_CHANNEL,
      categoryConceptId: NOTIFICATION_CATEGORY.ACCOUNTING,
      optedIn: false,
      quietHoursJson: null,
    });

    // Tras guardar, releé las preferencias — la lista debe reflejar el nuevo valor.
    http.expectOne((r) => r.url === '/notifications/preferences').flush({
      items: [
        {
          id: 'pref-1',
          channelId: IN_APP_CHANNEL,
          categoryConceptId: NOTIFICATION_CATEGORY.ACCOUNTING,
          optedIn: false,
          quietHoursJson: null,
        },
      ],
    });
  });

  it('marca los canales sin proveedor conectado (WhatsApp/SMS/push)', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/notifications/channels').flush({
      items: [
        {
          id: IN_APP_CHANNEL,
          code: 'IN_APP',
          name: 'Interna',
          channelTypeConceptId: '41557f04-1334-5b20-a794-16bf070f64fb',
        },
        {
          id: 'ch-whatsapp',
          code: 'WHATSAPP',
          name: 'WhatsApp',
          channelTypeConceptId: 'a7df2062-a02a-5d6c-a05d-62de20270c5d',
        },
      ],
    });
    http.expectOne((r) => r.url === '/notifications/preferences').flush({ items: [] });
    http.expectOne((r) => r.url === '/notifications/in-app').flush({ items: [], count: 0 });
    fixture.detectChanges();

    const otros = (
      fixture.componentInstance as unknown as {
        otrosCanales: () => readonly { configured: boolean; label: string }[];
      }
    ).otrosCanales();

    expect(otros).toHaveLength(1);
    expect(otros[0]).toEqual(expect.objectContaining({ configured: false, label: 'WhatsApp' }));
  });
});
