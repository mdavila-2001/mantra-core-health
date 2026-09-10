import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
import { NotificationCenter } from './notification-center';

/**
 * Lo que estas pruebas fijan.
 *
 * Que la paginación es **por cursor** —lo único que el contrato permite, que no
 * da totales—, que el filtro «sólo sin leer» **empieza de cero** en vez de
 * seguir con un cursor de otra consulta, y que una notificación **sin destino
 * no se ofrece como enlace**.
 */
describe('NotificationCenter', () => {
  let fixture: ComponentFixture<NotificationCenter>;
  let http: HttpTestingController;

  const aviso = (
    id: string,
    destino: { type: string; id: string } = { type: 'PRESCRIPTION', id: 'rx-1' },
  ) => ({
    id,
    category: 'CLINICAL',
    subject: `Aviso ${id}`,
    bodyText: null,
    destination: destino,
    payloadJson: null,
    unread: true,
    availableAt: '2026-08-18T10:00:00.000Z',
    readAt: null,
  });

  const pagina = (
    items: object[],
    nextCursor: string | null,
    unreadCount = 1,
  ) => ({
    items,
    count: items.length,
    limit: 25,
    nextCursor,
    unreadCount,
  });

  const texto = (): string => fixture.nativeElement.textContent as string;
  const filas = (): HTMLElement[] =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid="aviso"]'));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // Un comodín inerte: abrir una notificación navega de verdad, y sin
        // ninguna ruta declarada el router rechaza la promesa fuera del test.
        provideRouter([{ path: '**', children: [] }]),
        { provide: AuthService, useValue: { isAuthenticated: signal(false) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationCenter);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('pide la primera página sin cursor y pinta lo que vuelve', () => {
    const req = http.expectOne((r) => r.url === '/notifications/me');
    expect(req.request.params.has('cursor')).toBe(false);
    expect(req.request.params.get('limit')).toBe('25');
    req.flush(pagina([aviso('n-1')], null));
    fixture.detectChanges();

    expect(texto()).toContain('Aviso n-1');
    expect(filas().length).toBe(1);
  });

  it('«ver más» continúa por cursor y acumula, no reemplaza', () => {
    http
      .expectOne((r) => r.url === '/notifications/me')
      .flush(pagina([aviso('n-1')], 'cursor-1'));
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector(
        'button[app-button][variant="outline"]:not([data-testid])',
      ) as HTMLButtonElement | null
    )?.click();
    fixture.detectChanges();

    const segunda = http.expectOne((r) => r.url === '/notifications/me');
    expect(segunda.request.params.get('cursor')).toBe('cursor-1');
    segunda.flush(pagina([aviso('n-2')], null));
    fixture.detectChanges();

    expect(filas().length).toBe(2);
  });

  it('la pestaña «Sin leer» empieza de cero: el cursor viejo es de otra consulta', () => {
    // El filtro dejó de ser un botón que alterna y pasó a ser la segunda
    // pestaña (2026-09-10), pero la regla que se prueba es la misma: cambiar
    // de vista descarta el cursor, porque pertenecía a otra consulta.
    http
      .expectOne((r) => r.url === '/notifications/me')
      .flush(pagina([aviso('n-1')], 'cursor-1'));
    fixture.detectChanges();

    const pestanas = fixture.nativeElement.querySelectorAll(
      '[data-testid="avisos-pestanas"] [role="tab"]',
    ) as NodeListOf<HTMLElement>;
    expect(pestanas.length).toBe(2);
    pestanas[1]!.click();
    fixture.detectChanges();

    const filtrada = http.expectOne((r) => r.url === '/notifications/me');
    expect(filtrada.request.params.get('unread')).toBe('true');
    expect(filtrada.request.params.has('cursor')).toBe(false);
    filtrada.flush(pagina([aviso('n-3')], null));
    fixture.detectChanges();

    expect(filas().length).toBe(1);
  });

  it('una notificación sin destino se pinta como texto y no como control', () => {
    http
      .expectOne((r) => r.url === '/notifications/me')
      .flush(pagina([aviso('n-1', { type: 'POST', id: 'p-1' })], null));
    fixture.detectChanges();

    expect(filas()[0].tagName).toBe('DIV');
  });

  it('abrir una notificación la marca y la saca de negrita sin recargar la lista', () => {
    http
      .expectOne((r) => r.url === '/notifications/me')
      .flush(pagina([aviso('n-1')], null, 1));
    fixture.detectChanges();

    filas()[0].click();
    http.expectOne('/notifications/in-app/n-1/read').flush({
      id: 'n-1',
      readAt: '2026-08-18T12:00:00.000Z',
      alreadyRead: false,
    });
    fixture.detectChanges();

    // El store también relee para que el badge del header cuente lo mismo.
    http
      .match((r) => r.url === '/notifications/me')
      .forEach((pedido) => pedido.flush(pagina([], null, 0)));

    expect(
      fixture.nativeElement.querySelector('.avisos__fila.is-sin-leer'),
    ).toBeNull();
  });

  it('cuenta el error sin dejar la pantalla en blanco', () => {
    http
      .expectOne((r) => r.url === '/notifications/me')
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos cargar tus notificaciones.');
  });
});
