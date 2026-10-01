import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { AuthService } from '../../../../core/auth/auth.service';
import { provideDependentLinkNotificationActions } from '../../../../features/account/dependents/dependent-link-notification-actions';
import { ToastService } from '../../molecules/toast/toast.service';
import { NotificationBell } from './notification-bell';

/**
 * «Aceptar» desde la campana, de punta a punta: con el manejador REAL de
 * dependientes registrado, sin abrir la pantalla de Dependientes.
 *
 * Lo que fija: la notificación con acciones vigentes dibuja sus botones; aceptar
 * llama a la misma API que la bandeja de Dependientes, deja un aviso, lee de
 * nuevo la bandeja y NO navega; y una notificación sin acciones no dibuja
 * ninguno.
 */
describe('NotificationBell · acciones de la notificación', () => {
  let fixture: ComponentFixture<NotificationBell>;
  let http: HttpTestingController;

  const CON_ACCIONES = {
    id: 'n-9',
    category: 'CLINICAL',
    subject: 'Te quieren registrar como dependiente',
    bodyText: 'Ana pide registrarte como su dependiente.',
    destination: { type: 'DEPENDENT_LINK_REQUEST', id: 'sol-1' },
    payloadJson: null,
    actions: [
      { key: 'ACCEPT', label: 'Aceptar', tone: 'primary' },
      { key: 'REJECT', label: 'Rechazar', tone: 'neutral' },
    ],
    unread: true,
    availableAt: '2026-08-18T10:00:00.000Z',
    readAt: null,
  };

  const pagina = (items: object[], unreadCount: number) => ({
    items,
    count: items.length,
    limit: 8,
    nextCursor: null,
    unreadCount,
  });

  /** Contesta lo pendiente; la bandeja de mensajes con lo que se le indique. */
  const resolver = (cuerpo: object): void => {
    for (let vuelta = 0; vuelta < 5; vuelta += 1) {
      const pendientes = http.match(() => true);
      if (pendientes.length === 0) return;
      for (const pedido of pendientes) {
        pedido.flush(pedido.request.url === '/notifications/me' ? cuerpo : null);
      }
    }
  };

  const consultar = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
        provideDependentLinkNotificationActions(),
        { provide: AuthService, useValue: { isAuthenticated: signal(true) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationBell);
    fixture.detectChanges();
    resolver(pagina([CON_ACCIONES], 1));
    consultar('campana')?.click();
    resolver(pagina([CON_ACCIONES], 1));
    fixture.detectChanges();
  });

  afterEach(() => {
    http.match(() => true).forEach((pedido) => pedido.flush(pagina([], 0)));
    http.verify();
  });

  it('dibuja Aceptar y Rechazar bajo la notificación', () => {
    expect(consultar('notificacion-accion-accept')?.textContent).toContain('Aceptar');
    expect(consultar('notificacion-accion-reject')?.textContent).toContain('Rechazar');
  });

  it('Aceptar llama a la API de aceptación, avisa, relee la bandeja y no navega', () => {
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const toast = TestBed.inject(ToastService);

    consultar('notificacion-accion-accept')?.click();

    http
      .expectOne('/profiles/patients/me/dependent-requests/sol-1/accept')
      .flush({ id: 'sol-1', status: 'ACCEPTED' });
    // Se da por leída (responder es haberla leído) y se vuelve a pedir la bandeja.
    http.expectOne('/notifications/in-app/n-9/read').flush({
      id: 'n-9',
      readAt: '2026-08-18T12:00:00.000Z',
      alreadyRead: false,
    });
    resolver(pagina([{ ...CON_ACCIONES, actions: undefined, unread: false }], 0));
    fixture.detectChanges();

    expect(toast.toasts()[0]!.message).toContain('Aceptaste');
    expect(navegar).not.toHaveBeenCalled();
    // La decisión ya está tomada: la bandeja ya no ofrece los botones.
    expect(consultar('notificacion-accion-accept')).toBeNull();
    expect(consultar('campana-item')).not.toBeNull();
  });

  it('Rechazar llama a la API de rechazo', () => {
    consultar('notificacion-accion-reject')?.click();

    http
      .expectOne('/profiles/patients/me/dependent-requests/sol-1/reject')
      .flush({ id: 'sol-1', status: 'REJECTED' });
    http.expectOne('/notifications/in-app/n-9/read').flush({
      id: 'n-9',
      readAt: '2026-08-18T12:00:00.000Z',
      alreadyRead: false,
    });
    resolver(pagina([], 0));
  });

  it('si la API falla no da la notificación por resuelta', () => {
    consultar('notificacion-accion-accept')?.click();

    http
      .expectOne('/profiles/patients/me/dependent-requests/sol-1/accept')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    http.expectNone('/notifications/in-app/n-9/read');
    expect(TestBed.inject(ToastService).toasts()[0]!.type).toBe('error');
    expect(consultar('notificacion-accion-accept')).not.toBeNull();
  });
});
