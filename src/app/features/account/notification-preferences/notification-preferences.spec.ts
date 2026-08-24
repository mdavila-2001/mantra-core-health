import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { NotificationPreferences } from './notification-preferences';

/**
 * Lo que estas pruebas fijan.
 *
 * Que las categorías se muestran **en lenguaje llano** y no con el vocabulario
 * del contrato, que **la hora se escribe en local y viaja en UTC** —el backend
 * compara contra `getUTCHours()` y nadie piensa su noche en UTC— y que apagar
 * el silencio manda `null`, que es lo que el contrato entiende por «quitala».
 */
describe('NotificationPreferences', () => {
  let fixture: ComponentFixture<NotificationPreferences>;
  let http: HttpTestingController;

  const preferencias = (
    quietHours: { start: string; end: string } | null = null,
  ) => ({
    categories: [
      { category: 'CLINICAL', optedIn: true },
      { category: 'SCHEDULING', optedIn: true },
      { category: 'MESSAGES', optedIn: true },
      { category: 'SOCIAL', optedIn: false },
    ],
    quietHours,
  });

  const texto = (): string => fixture.nativeElement.textContent as string;
  const consultar = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);

  /** El mismo cálculo que hace la pantalla, para no fijar un huso concreto. */
  const aUtc = (horaLocal: string): string => {
    const [horas, minutos] = horaLocal.split(':').map(Number);
    const fecha = new Date();
    fecha.setHours(horas, minutos, 0, 0);
    return `${String(fecha.getUTCHours()).padStart(2, '0')}:${String(
      fecha.getUTCMinutes(),
    ).padStart(2, '0')}`;
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { isAuthenticated: signal(false) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NotificationPreferences);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.match(() => true).forEach((pedido) => pedido.flush(preferencias()));
    http.verify();
  });

  it('muestra las cuatro categorías en lenguaje llano', () => {
    http.expectOne('/notifications/preferences/me').flush(preferencias());
    fixture.detectChanges();

    // Ni `CLINICAL` ni `SOCIAL`: son vocabulario del sistema, y quien configura
    // sus avisos razona en «recetas y consultas».
    expect(texto()).toContain('Recetas y consultas');
    expect(texto()).toContain('Turnos');
    // «Chats» y no «Mensajes» desde F1/§4.H del plan de UX del 22/08/2026: la
    // sección se llama así en el menú, y las preferencias de aviso tienen que
    // usar el mismo nombre o son dos cosas distintas para quien las lee.
    expect(texto()).toContain('Chats');
    expect(texto()).toContain('Actividad social');
    expect(texto()).not.toContain('CLINICAL');
  });

  it('refleja lo que ya estaba silenciado', () => {
    http.expectOne('/notifications/preferences/me').flush(preferencias());
    fixture.detectChanges();

    expect((consultar('pref-SOCIAL') as HTMLInputElement).checked).toBe(false);
    expect((consultar('pref-CLINICAL') as HTMLInputElement).checked).toBe(true);
  });

  it('guarda la categoría que se cambió', () => {
    http.expectOne('/notifications/preferences/me').flush(preferencias());
    fixture.detectChanges();

    consultar('pref-MESSAGES')?.click();
    fixture.detectChanges();
    consultar('pref-guardar')?.click();

    const guardado = http.expectOne('/notifications/preferences/me');
    expect(guardado.request.method).toBe('PUT');
    expect(guardado.request.body.categories).toContainEqual({
      category: 'MESSAGES',
      optedIn: false,
    });
    guardado.flush(preferencias());
    fixture.detectChanges();

    expect(texto()).toContain('Guardamos tus preferencias.');
  });

  it('convierte la hora local a UTC al guardar el silencio', () => {
    http.expectOne('/notifications/preferences/me').flush(preferencias());
    fixture.detectChanges();

    consultar('pref-silencio')?.click();
    fixture.detectChanges();
    consultar('pref-guardar')?.click();

    const guardado = http.expectOne('/notifications/preferences/me');
    // El backend compara contra `getUTCHours()`; mandar la hora local sin
    // convertirla haría que el silencio cayera en cualquier momento.
    expect(guardado.request.body.quietHours).toEqual({
      start: aUtc('22:00'),
      end: aUtc('07:00'),
    });
    guardado.flush(preferencias({ start: aUtc('22:00'), end: aUtc('07:00') }));
    fixture.detectChanges();
  });

  it('apagar el silencio manda `null`, que es «quitala»', () => {
    http
      .expectOne('/notifications/preferences/me')
      .flush(preferencias({ start: aUtc('22:00'), end: aUtc('07:00') }));
    fixture.detectChanges();

    consultar('pref-silencio')?.click();
    fixture.detectChanges();
    consultar('pref-guardar')?.click();

    const guardado = http.expectOne('/notifications/preferences/me');
    expect(guardado.request.body.quietHours).toBeNull();
    guardado.flush(preferencias());
  });

  it('dice que el silencio aplaza y no pierde nada', () => {
    http.expectOne('/notifications/preferences/me').flush(preferencias());
    fixture.detectChanges();

    // Prometer «no te molesto» y perder un aviso serían dos cosas distintas, y
    // la pantalla dice la que el backend efectivamente hace.
    expect(texto()).toContain('No se pierde ninguno');
  });

  it('cuenta el error de guardado sin perder lo que la persona eligió', () => {
    http.expectOne('/notifications/preferences/me').flush(preferencias());
    fixture.detectChanges();

    consultar('pref-CLINICAL')?.click();
    fixture.detectChanges();
    consultar('pref-guardar')?.click();
    http
      .expectOne('/notifications/preferences/me')
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos guardar tus preferencias.');
    expect((consultar('pref-CLINICAL') as HTMLInputElement).checked).toBe(false);
  });
});
