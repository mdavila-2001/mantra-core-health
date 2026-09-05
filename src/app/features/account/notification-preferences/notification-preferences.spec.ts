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

  const preferences = (
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

  const text = (): string => fixture.nativeElement.textContent as string;
  const query = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  /**
   * El `data-testid` de una fila de preferencia vive en el host de
   * `app-switch` (S1: TAREA-17), no en un `<input>` suelto como antes. El
   * control nativo que de verdad tiene `.checked` y recibe el click está
   * adentro.
   */
  const querySwitch = (testid: string): HTMLInputElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"] input[role="switch"]`);
  const iconosPorRenglon = (): number[] =>
    [...fixture.nativeElement.querySelectorAll('.prefs__fila')].map(
      (fila) => fila.querySelectorAll('app-nav-icon').length,
    );

  /** El mismo cálculo que hace la pantalla, para no fijar un huso concreto. */
  const toUtc = (localTime: string): string => {
    const [hours, minutes] = localTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(
      date.getUTCMinutes(),
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
    http.match(() => true).forEach((request) => request.flush(preferences()));
    http.verify();
  });

  it('muestra las cuatro categorías en lenguaje llano', () => {
    http.expectOne('/notifications/preferences/me').flush(preferences());
    fixture.detectChanges();

    // Ni `CLINICAL` ni `SOCIAL`: son vocabulario del sistema, y quien configura
    // sus avisos razona en «recetas y consultas».
    expect(text()).toContain('Recetas y consultas');
    expect(text()).toContain('Turnos');
    // «Chats» y no «Mensajes» desde F1/§4.H del plan de UX del 22/08/2026: la
    // sección se llama así en el menú, y las preferencias de aviso tienen que
    // usar el mismo nombre o son dos cosas distintas para quien las lee.
    expect(text()).toContain('Chats');
    expect(text()).toContain('Actividad social');
    expect(text()).not.toContain('CLINICAL');
  });

  it('conserva un icono por categoría y otro en la fila de silencio', () => {
    http.expectOne('/notifications/preferences/me').flush(preferences());
    fixture.detectChanges();

    expect(iconosPorRenglon()).toEqual([1, 1, 1, 1, 1]);
  });

  it('refleja lo que ya estaba silenciado', () => {
    http.expectOne('/notifications/preferences/me').flush(preferences());
    fixture.detectChanges();

    expect(querySwitch('pref-SOCIAL')?.checked).toBe(false);
    expect(querySwitch('pref-CLINICAL')?.checked).toBe(true);
  });

  it('guarda la categoría que se cambió', () => {
    http.expectOne('/notifications/preferences/me').flush(preferences());
    fixture.detectChanges();

    querySwitch('pref-MESSAGES')?.click();
    fixture.detectChanges();
    query('pref-save')?.click();

    const saveRequest = http.expectOne('/notifications/preferences/me');
    expect(saveRequest.request.method).toBe('PUT');
    expect(saveRequest.request.body.categories).toContainEqual({
      category: 'MESSAGES',
      optedIn: false,
    });
    saveRequest.flush(preferences());
    fixture.detectChanges();

    expect(text()).toContain('Guardamos tus preferencias.');
  });

  it('convierte la hora local a UTC al guardar el silencio', () => {
    http.expectOne('/notifications/preferences/me').flush(preferences());
    fixture.detectChanges();

    querySwitch('pref-quiet-hours')?.click();
    fixture.detectChanges();
    query('pref-save')?.click();

    const saveRequest = http.expectOne('/notifications/preferences/me');
    // El backend compara contra `getUTCHours()`; mandar la hora local sin
    // convertirla haría que el silencio cayera en cualquier momento.
    expect(saveRequest.request.body.quietHours).toEqual({
      start: toUtc('22:00'),
      end: toUtc('07:00'),
    });
    saveRequest.flush(preferences({ start: toUtc('22:00'), end: toUtc('07:00') }));
    fixture.detectChanges();
  });

  it('apagar el silencio manda `null`, que es «quitala»', () => {
    http
      .expectOne('/notifications/preferences/me')
      .flush(preferences({ start: toUtc('22:00'), end: toUtc('07:00') }));
    fixture.detectChanges();

    querySwitch('pref-quiet-hours')?.click();
    fixture.detectChanges();
    query('pref-save')?.click();

    const saveRequest = http.expectOne('/notifications/preferences/me');
    expect(saveRequest.request.body.quietHours).toBeNull();
    saveRequest.flush(preferences());
  });

  it('dice que el silencio aplaza y no pierde nada', () => {
    http.expectOne('/notifications/preferences/me').flush(preferences());
    fixture.detectChanges();

    // Prometer «no te molesto» y perder un aviso serían dos cosas distintas, y
    // la pantalla dice la que el backend efectivamente hace.
    expect(text()).toContain('No se pierde ninguno');
  });

  it('si el PUT falla, dice el error y el switch vuelve a su valor anterior (AC-17-7)', () => {
    http.expectOne('/notifications/preferences/me').flush(preferences());
    fixture.detectChanges();

    querySwitch('pref-CLINICAL')?.click();
    fixture.detectChanges();
    expect(querySwitch('pref-CLINICAL')?.checked).toBe(false);

    query('pref-save')?.click();
    http
      .expectOne('/notifications/preferences/me')
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(text()).toContain('No pudimos guardar tus preferencias.');
    // Nada quedó guardado (el PUT es todo-o-nada): el switch no se queda
    // «encendido de mentira», vuelve a lo último que el servidor confirmó.
    expect(querySwitch('pref-CLINICAL')?.checked).toBe(true);
  });

  it('mientras guarda, un segundo clic en «Guardar» no dispara un segundo PUT (AC-17-8)', () => {
    http.expectOne('/notifications/preferences/me').flush(preferences());
    fixture.detectChanges();

    querySwitch('pref-CLINICAL')?.click();
    fixture.detectChanges();
    query('pref-save')?.click();
    fixture.detectChanges();

    // `app-button` con `isLoading` intercepta el click nativo: un segundo
    // clic mientras el primer PUT sigue en vuelo no emite `clicked`.
    query('pref-save')?.click();
    fixture.detectChanges();

    const onlyRequest = http.expectOne('/notifications/preferences/me');
    onlyRequest.flush(preferences());
  });
});
