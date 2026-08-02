import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  DEFAULT_TIMEOUT_MS,
  timeoutInterceptor,
  UPLOAD_TIMEOUT_MS,
} from './timeout.interceptor';

/**
 * Sin límite de espera, una API que acepta la conexión y no contesta deja la
 * interfaz en S2 —cargando— indefinidamente. Es el peor estado posible: no
 * ofrece nada que hacer.
 */
describe('timeoutInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([timeoutInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('deja pasar una respuesta que llega a tiempo', () => {
    let recibido: unknown = null;
    http.get('/public/directory').subscribe((r) => (recibido = r));

    backend.expectOne('/public/directory').flush({ ok: true });

    expect(recibido).toEqual({ ok: true });
  });

  /**
   * La traducción a `HttpErrorResponse` con estado 0 es la decisión de diseño:
   * un `TimeoutError` de RxJS caería en el S9 genérico y pediría un
   * identificador de petición que no existe. Con estado 0 entra por el camino
   * que ya existe —**S8, sin conexión, con botón de reintentar**— que es lo que
   * de verdad pasó.
   */
  it('un vencimiento se traduce a estado 0, que la aplicación pinta como S8', () => {
    // Contenedor y no `let`: TypeScript estrecha una variable asignada dentro de
    // un callback a `never`, porque no puede probar que el callback corrió.
    const capturado: { error: HttpErrorResponse | null } = { error: null };
    http.get('/public/directory').subscribe({
      error: (e: HttpErrorResponse) => (capturado.error = e),
    });

    backend.expectOne('/public/directory');
    vi.advanceTimersByTime(DEFAULT_TIMEOUT_MS + 1);

    expect(capturado.error).toBeInstanceOf(HttpErrorResponse);
    expect(capturado.error?.status).toBe(0);
  });

  it('no vence antes de tiempo', () => {
    let error: unknown = null;
    http.get('/public/directory').subscribe({ error: (e: unknown) => (error = e) });

    backend.expectOne('/public/directory');
    vi.advanceTimersByTime(DEFAULT_TIMEOUT_MS - 1000);

    expect(error).toBeNull();
  });

  it('la subida de archivos aguanta más: 10 MB por red móvil no caben en 30 s', () => {
    let error: unknown = null;
    http.post('/common/files/upload', new FormData()).subscribe({
      error: (e: unknown) => (error = e),
    });

    backend.expectOne('/common/files/upload');
    // Pasado el límite normal, la subida sigue viva.
    vi.advanceTimersByTime(DEFAULT_TIMEOUT_MS + 1000);
    expect(error).toBeNull();

    vi.advanceTimersByTime(UPLOAD_TIMEOUT_MS);
    expect(error).toBeInstanceOf(HttpErrorResponse);
  });

  it('un error real del servidor pasa intacto, sin disfrazarse de vencimiento', () => {
    const capturado: { error: HttpErrorResponse | null } = { error: null };
    http.get('/public/directory').subscribe({
      error: (e: HttpErrorResponse) => (capturado.error = e),
    });

    backend
      .expectOne('/public/directory')
      .flush({ code: 'INTERNAL' }, { status: 500, statusText: 'Server Error' });

    expect(capturado.error?.status).toBe(500);
  });

  it('el límite de subida es mayor que el normal', () => {
    expect(UPLOAD_TIMEOUT_MS).toBeGreaterThan(DEFAULT_TIMEOUT_MS);
  });
});
