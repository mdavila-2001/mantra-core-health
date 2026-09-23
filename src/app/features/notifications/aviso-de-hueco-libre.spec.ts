import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { NotificationsClient } from '../../core/data-access/notifications/notifications.client';
import type { InAppNotificationPage } from '../../core/data-access/notifications/notifications.types';
import { ToastService } from '@shared/components/molecules/toast/toast.service';
import { AvisoDeHuecoLibre } from './aviso-de-hueco-libre';

/**
 * Lo que se fija: **el toast llega una sola vez, y sólo por lo que es**.
 *
 * Las dos mitades importan. Si llegara por cualquier notificación, la campana
 * entera se volvería un desfile de toasts; y si llegara en cada vuelta del
 * sondeo, el mismo hueco taparía la pantalla cada veinte segundos —la
 * notificación sigue sin leer hasta que alguien la abra, así que «no leída» no
 * alcanza como criterio de novedad—.
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

const HUECO = {
  id: 'n-1',
  subject: 'Se liberó un horario',
  bodyText: 'Un paciente no confirmó su cita del martes a las 10:30.',
  unread: true,
  availableAt: new Date(),
  payloadJson: { kind: 'SLOT_RELEASED', bookableSlotId: 's-1' },
};

const OTRA = {
  id: 'n-2',
  subject: 'Nueva receta disponible',
  bodyText: 'La Dra. Rojas emitió una receta.',
  unread: true,
  availableAt: new Date(),
  payloadJson: null,
};

describe('AvisoDeHuecoLibre', () => {
  let servicio: AvisoDeHuecoLibre;
  let toasts: ToastService;
  let listMine: ReturnType<typeof vi.fn>;

  function montar(autenticado: boolean, respuesta = of(pagina([HUECO]))) {
    listMine = vi.fn().mockReturnValue(respuesta);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationsClient, useValue: { listMine } },
        { provide: AuthService, useValue: { isAuthenticated: () => autenticado } },
      ],
    });
    servicio = TestBed.inject(AvisoDeHuecoLibre);
    toasts = TestBed.inject(ToastService);
    vi.spyOn(toasts, 'show');
  }

  afterEach(() => {
    servicio.parar();
    vi.useRealTimers();
  });

  it('levanta el toast cuando llega un hueco libre', () => {
    montar(true);

    servicio.empezar();

    expect(toasts.show).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toasts.show).mock.calls[0]![0]).toMatchObject({
      title: 'Se liberó un horario',
      // Fijo hasta que la persona lo cierre: ofrece un turno que alguien más
      // puede tomar mientras tanto.
      durationMs: null,
    });
  });

  it('no levanta nada por una notificación que no es de huecos', () => {
    montar(true, of(pagina([OTRA])));

    servicio.empezar();

    expect(toasts.show).not.toHaveBeenCalled();
  });

  it('el mismo hueco no vuelve a avisar en la vuelta siguiente', () => {
    vi.useFakeTimers();
    montar(true);

    servicio.empezar();
    vi.advanceTimersByTime(60_000);

    // Tres vueltas del reloj, un solo toast.
    expect(listMine.mock.calls.length).toBeGreaterThan(1);
    expect(toasts.show).toHaveBeenCalledTimes(1);
  });

  it('sin sesión no pregunta nada', () => {
    montar(false);

    servicio.empezar();

    expect(listMine).not.toHaveBeenCalled();
  });

  it('si el sondeo falla, no rompe ni avisa', () => {
    // Es una comodidad de la maqueta, no una lectura que alguien esté
    // esperando: la campana sigue mostrando lo que haya cuando se la abra.
    montar(true, throwError(() => new Error('sin red')));

    expect(() => servicio.empezar()).not.toThrow();
    expect(toasts.show).not.toHaveBeenCalled();
  });

  it('empezar dos veces no arranca dos relojes', () => {
    vi.useFakeTimers();
    montar(true, of(pagina([])));

    servicio.empezar();
    servicio.empezar();
    const trasArrancar = listMine.mock.calls.length;
    vi.advanceTimersByTime(20_000);

    // Una sola vuelta más, no dos.
    expect(listMine.mock.calls.length).toBe(trasArrancar + 1);
  });
});
