import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { NotificationBell } from './notification-bell';

/**
 * Lo que estas pruebas fijan.
 *
 * Que **el badge no aparece con cero** —un «0» permanente enseña a no mirar la
 * campana—, que el panel **está cerrado hasta que alguien lo abre** (no es una
 * lista más del header) y que abrir una notificación **marca y navega**, en ese
 * orden y sin esperar la respuesta del marcado.
 */
describe('NotificationBell', () => {
  let fixture: ComponentFixture<NotificationBell>;
  let http: HttpTestingController;

  const VACIA = {
    items: [],
    count: 0,
    limit: 8,
    nextCursor: null,
    unreadCount: 0,
  };

  const pagina = (unreadCount: number) => ({
    items: [
      {
        id: 'n-1',
        category: 'CLINICAL',
        subject: 'Tu receta está lista',
        bodyText: 'Podés verla en tu historia clínica.',
        destination: { type: 'PRESCRIPTION', id: 'rx-1' },
        payloadJson: null,
        unread: true,
        availableAt: '2026-08-18T10:00:00.000Z',
        readAt: null,
      },
    ],
    count: 1,
    limit: 8,
    nextCursor: null,
    unreadCount,
  });

  /** Contesta todo lo pendiente, incluso lo que una respuesta dispare después. */
  const resolver = (cuerpo: object = VACIA): void => {
    for (let vuelta = 0; vuelta < 5; vuelta += 1) {
      const pendientes = http.match(() => true);
      if (pendientes.length === 0) {
        return;
      }
      for (const pedido of pendientes) {
        pedido.flush(
          pedido.request.url === '/notifications/me' ? cuerpo : null,
        );
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
        // Un comodín inerte: abrir una notificación navega de verdad, y sin
        // ninguna ruta declarada el router rechaza la promesa fuera del test.
        provideRouter([{ path: '**', children: [] }]),
        { provide: AuthService, useValue: { isAuthenticated: signal(true) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationBell);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.match(() => true).forEach((pedido) => pedido.flush(VACIA));
    http.verify();
  });

  it('no pinta el badge cuando no hay nada sin leer', () => {
    resolver(VACIA);
    fixture.detectChanges();

    expect(consultar('campana')).not.toBeNull();
    expect(consultar('campana-badge')).toBeNull();
  });

  it('pinta el conteo y lo anuncia en la etiqueta accesible', () => {
    resolver(pagina(3));
    fixture.detectChanges();

    expect(consultar('campana-badge')).not.toBeNull();
    expect(consultar('campana')?.getAttribute('aria-label')).toContain('3');
  });

  it('el panel arranca cerrado y se abre al pulsar', () => {
    resolver(pagina(1));
    fixture.detectChanges();
    expect(consultar('campana-item')).toBeNull();

    consultar('campana')?.click();
    // Abrir refresca: quien la abre quiere lo de ahora, no lo del último tic.
    resolver(pagina(1));
    fixture.detectChanges();

    expect(consultar('campana-item')?.textContent).toContain(
      'Tu receta está lista',
    );
    expect(consultar('campana')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('abrir una notificación la marca leída', () => {
    resolver(pagina(1));
    fixture.detectChanges();
    consultar('campana')?.click();
    resolver(pagina(1));
    fixture.detectChanges();

    consultar('campana-item')?.click();

    http.expectOne('/notifications/in-app/n-1/read').flush({
      id: 'n-1',
      readAt: '2026-08-18T12:00:00.000Z',
      alreadyRead: false,
    });
    resolver(VACIA);
    fixture.detectChanges();

    // Y el panel se cierra: tocar una notificación es irse a otra pantalla, y
    // un desplegable que sobrevive a la navegación queda flotando sobre una
    // pantalla que no lo pidió.
    expect(consultar('campana-item')).toBeNull();
  });

  it('ofrece marcar todas sólo cuando hay algo que marcar', () => {
    resolver(VACIA);
    fixture.detectChanges();
    consultar('campana')?.click();
    resolver(VACIA);
    fixture.detectChanges();

    expect(consultar('campana-marcar-todas')).toBeNull();
    expect(consultar('campana-ver-todas')).not.toBeNull();
  });
});
