import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { NotificationsClient } from '../../core/data-access/notifications/notifications.client';
import type { InAppNotificationPage } from '../../core/data-access/notifications/notifications.types';
import { ToastService } from '@shared/components/molecules/toast/toast.service';
import { AvisoDeDemora, esDemoraVigente, rutaDelAviso } from './aviso-de-demora';

/**
 * Lo que se fija: una demora **avisa sola**, como push —toast fijo con botón a
 * la cita y, con permiso, notificación del sistema—, una sola vez por aviso.
 */
function pagina(items: readonly unknown[]): InAppNotificationPage {
  return {
    items: items as InAppNotificationPage['items'],
    count: items.length,
    limit: 20,
    nextCursor: null,
    unreadCount: items.length,
  };
}

const DEMORA = {
  id: 'n-1',
  subject: 'Dra. Rojas se demora 20 minutos',
  bodyText: 'Su cita de las 09:30 con Dra. Rojas se atrasa unos 20 minutos.',
  unread: true,
  availableAt: new Date(),
  payloadJson: { kind: 'PRACTITIONER_DELAY', route: '/my-account/appointments?turno=b-1', bookingId: 'b-1', delayMinutes: 20 },
};

const OTRA = { ...DEMORA, id: 'n-2', payloadJson: { kind: 'APPOINTMENT_REMINDER' } };

describe('AvisoDeDemora', () => {
  let servicio: AvisoDeDemora;
  let toasts: ToastService;

  function montar(autenticado: boolean, items: readonly unknown[] = [DEMORA, OTRA]) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationsClient, useValue: { listMine: vi.fn().mockReturnValue(of(pagina(items))) } },
        { provide: AuthService, useValue: { isAuthenticated: () => autenticado } },
      ],
    });
    servicio = TestBed.inject(AvisoDeDemora);
    toasts = TestBed.inject(ToastService);
    vi.spyOn(toasts, 'show');
  }

  afterEach(() => {
    servicio.parar();
    vi.unstubAllGlobals();
  });

  it('levanta la demora como push fijo, con el botón a la cita', () => {
    montar(true);

    servicio.empezar();

    expect(toasts.show).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toasts.show).mock.calls[0]![0]).toMatchObject({
      type: 'warning',
      title: '⏳ Dra. Rojas se demora 20 minutos',
      message: DEMORA.bodyText,
      durationMs: null,
      action: { label: '📅 Ver mi cita', url: '/my-account/appointments?turno=b-1' },
    });
  });

  it('no repite el mismo aviso en el siguiente sondeo', () => {
    montar(true);
    servicio.empezar();
    servicio.parar();

    servicio.empezar();

    expect(toasts.show).toHaveBeenCalledTimes(1);
  });

  it('con permiso concedido, también sale como notificación del sistema', () => {
    const creadas: unknown[][] = [];
    class NotificacionFalsa {
      static permission = 'granted';
      onclick: (() => void) | null = null;
      constructor(...args: unknown[]) {
        creadas.push(args);
      }
      close(): void {
        // La falsa no tiene nada que cerrar.
      }
    }
    vi.stubGlobal('Notification', NotificacionFalsa);
    montar(true);

    servicio.empezar();

    expect(creadas).toHaveLength(1);
    expect(creadas[0]![0]).toBe('⏳ Dra. Rojas se demora 20 minutos');
    expect(creadas[0]![1]).toMatchObject({ body: DEMORA.bodyText, tag: 'demora-n-1' });
  });

  it('sin sesión no mira nada', () => {
    montar(false);

    servicio.empezar();

    expect(toasts.show).not.toHaveBeenCalled();
  });

  it('una demora de hace un día ya no se levanta: para eso está la campana', () => {
    const ayer = { ...DEMORA, availableAt: new Date(Date.now() - 24 * 60 * 60_000) };
    expect(esDemoraVigente(ayer as never, Date.now())).toBe(false);
    expect(esDemoraVigente(DEMORA as never, Date.now())).toBe(true);
  });

  it('sólo sigue rutas internas; sin ruta, va a «Mis citas»', () => {
    expect(rutaDelAviso({ ...DEMORA, payloadJson: { route: '//malo.com' } } as never)).toBe('/my-account/appointments');
    expect(rutaDelAviso({ ...DEMORA, payloadJson: null } as never)).toBe('/my-account/appointments');
    expect(rutaDelAviso(DEMORA as never)).toBe('/my-account/appointments?turno=b-1');
  });
});
