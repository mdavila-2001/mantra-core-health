import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
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
    expect(pestanas.length).toBe(6);
    pestanas[1]!.click();
    fixture.detectChanges();

    const filtrada = http.expectOne((r) => r.url === '/notifications/me');
    expect(filtrada.request.params.get('unread')).toBe('true');
    expect(filtrada.request.params.has('cursor')).toBe(false);
    filtrada.flush(pagina([aviso('n-3')], null));
    fixture.detectChanges();

    expect(filas().length).toBe(1);
  });

  it('salir de «Sin leer» vuelve a pedir la bandeja entera: las leídas no desaparecen', () => {
    http
      .expectOne((r) => r.url === '/notifications/me')
      .flush(pagina([aviso('n-1'), { ...aviso('n-2'), unread: false }], null));
    fixture.detectChanges();

    const pestanas = (): NodeListOf<HTMLElement> =>
      fixture.nativeElement.querySelectorAll('[data-testid="avisos-pestanas"] [role="tab"]');
    pestanas()[1]!.click();
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/notifications/me' && r.params.get('unread') === 'true')
      .flush(pagina([aviso('n-1')], null));
    fixture.detectChanges();
    expect(filas().length).toBe(1);

    pestanas()[0]!.click();
    fixture.detectChanges();
    const todas = http.expectOne((r) => r.url === '/notifications/me');
    expect(todas.request.params.has('unread')).toBe(false);
    expect(todas.request.params.has('cursor')).toBe(false);
    todas.flush(pagina([aviso('n-1'), { ...aviso('n-2'), unread: false }], null));
    fixture.detectChanges();

    expect(filas().length).toBe(2);
  });

  it('una notificación sin destino se pinta como texto y no como control', () => {
    http
      .expectOne((r) => r.url === '/notifications/me')
      .flush(pagina([aviso('n-1', { type: 'POST', id: 'p-1' })], null));
    fixture.detectChanges();

    expect(filas()[0].tagName).toBe('DIV');
  });

  it('una notificación sin destino y sin leer se puede marcar leída de a una, sin navegar', () => {
    http
      .expectOne((r) => r.url === '/notifications/me')
      .flush(pagina([aviso('n-1', { type: 'POST', id: 'p-1' })], null, 1));
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navegar = vi.spyOn(router, 'navigateByUrl');

    const boton = fixture.nativeElement.querySelector(
      '[data-testid="aviso-marcar-leida"]',
    ) as HTMLButtonElement;
    expect(boton.getAttribute('aria-label')).toBe('Marcar como leída: Aviso n-1');
    boton.click();
    http.expectOne('/notifications/in-app/n-1/read').flush({
      id: 'n-1',
      readAt: '2026-08-18T12:00:00.000Z',
      alreadyRead: false,
    });
    fixture.detectChanges();
    http
      .match((r) => r.url === '/notifications/me')
      .forEach((pedido) => pedido.flush(pagina([], null, 0)));

    expect(navegar).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.avisos__fila.is-sin-leer')).toBeNull();
    // Ya leída, el botón no tiene nada que hacer y se va.
    expect(fixture.nativeElement.querySelector('[data-testid="aviso-marcar-leida"]')).toBeNull();
  });

  it('el botón aparte sólo existe para avisos sin destino y sin leer', () => {
    http
      .expectOne((r) => r.url === '/notifications/me')
      .flush(
        pagina(
          [
            aviso('n-1'),
            { ...aviso('n-2', { type: 'POST', id: 'p-1' }), unread: false },
          ],
          null,
          1,
        ),
      );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="aviso-marcar-leida"]').length).toBe(0);
  });

  it('muestra preferencias y filtra consultas, mensajes, recetas y red', () => {
    const consulta = aviso('consulta', { type: 'ENCOUNTER', id: 'e-1' });
    const mensaje = {
      ...aviso('mensaje', { type: 'CONVERSATION', id: 'c-1' }),
      category: 'MESSAGES',
    };
    const receta = aviso('receta', { type: 'PRESCRIPTION', id: 'r-1' });
    const red = {
      ...aviso('red', { type: 'POST', id: 'p-1' }),
      category: 'SOCIAL',
    };
    http
      .expectOne((r) => r.url === '/notifications/me')
      .flush(pagina([consulta, mensaje, receta, red], null));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('a[routerLink="/settings"]')?.textContent,
    ).toContain('Preferencias');
    const pestañas = fixture.nativeElement.querySelectorAll(
      '[data-testid="avisos-pestanas"] [role="tab"]',
    ) as NodeListOf<HTMLElement>;
    expect(Array.from(pestañas).map((pestaña) => pestaña.textContent?.trim())).toEqual([
      'Todas',
      'Sin leer (1)',
      'Consultas',
      'Mensajes',
      'Recetas',
      'Red',
    ]);

    pestañas[2]!.click();
    fixture.detectChanges();
    expect(filas().map((fila) => fila.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining('Aviso consulta')]),
    );
    expect(filas().length).toBe(1);

    pestañas[3]!.click();
    fixture.detectChanges();
    expect(filas().map((fila) => fila.textContent?.trim())).toEqual(
      expect.arrayContaining([expect.stringContaining('Aviso mensaje')]),
    );
    expect(filas().length).toBe(1);

    pestañas[4]!.click();
    fixture.detectChanges();
    expect(filas().length).toBe(1);
    expect(texto()).toContain('Aviso receta');

    pestañas[5]!.click();
    fixture.detectChanges();
    expect(filas().length).toBe(1);
    expect(texto()).toContain('Aviso red');
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

  it('marca toda la bandeja como leída desde la acción de cabecera', () => {
    http
      .expectOne((r) => r.url === '/notifications/me')
      .flush(pagina([aviso('n-1'), aviso('n-2')], null, 2));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="avisos-marcar-todas"]') as HTMLElement)
      .click();
    http.expectOne('/notifications/in-app/read-all').flush({ marked: 2, unreadCount: 0 });
    const refrescos = http.match((r) => r.url === '/notifications/me');
    refrescos.forEach((pedido) => pedido.flush(pagina([], null, 0)));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="avisos-marcar-todas"]'),
    ).toBeNull();
  });

  it('presenta el identificador de soporte en el estado S9', () => {
    http.expectOne((r) => r.url === '/notifications/me').flush(
      {
        code: 'INTERNAL',
        message: 'Error',
        correlationId: 'req-35-1',
        timestamp: '2026-10-13T12:00:00.000Z',
        path: '/notifications/me',
      },
      { status: 500, statusText: 'Server Error' },
    );
    fixture.detectChanges();

    expect(texto()).toContain('Código de soporte');
    expect(texto()).toContain('req-35-1');
  });

  it('el vacío conserva el título de siempre en «Todas» y «Sin leer» y ofrece Preferencias', () => {
    http.expectOne((r) => r.url === '/notifications/me').flush(pagina([], null, 0));
    fixture.detectChanges();

    expect(texto()).toContain('Todavía no tiene notificaciones');
    expect(texto()).toContain('Ir a preferencias');

    const pestañas = fixture.nativeElement.querySelectorAll(
      '[data-testid="avisos-pestanas"] [role="tab"]',
    ) as NodeListOf<HTMLElement>;
    pestañas[1]!.click();
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/notifications/me').flush(pagina([], null, 0));
    fixture.detectChanges();
    expect(texto()).toContain('No tiene notificaciones sin leer');

    pestañas[2]!.click();
    fixture.detectChanges();
    // Salir de «Sin leer» vuelve a pedir la bandeja entera (sin `unread`).
    const todas = http.expectOne((r) => r.url === '/notifications/me');
    expect(todas.request.params.has('unread')).toBe(false);
    todas.flush(pagina([], null, 0));
    fixture.detectChanges();
    expect(texto()).toContain('No tiene avisos en esta categoría');
  });
});
