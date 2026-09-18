import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { DiagnosticOrders } from './diagnostic-orders';

const PROFILE_ID = '44444444-4444-4444-8444-444444444444';
const ORDER_ID = '66666666-6666-4666-8666-666666666666';
const REPORT_ID = '11111111-1111-4111-8111-111111111111';

const ORDEN = {
  id: ORDER_ID,
  encounterId: '77777777-7777-4777-8777-777777777777',
  codeConceptId: 'concept-code',
  categoryConceptId: 'concept-cat',
  statusConceptId: 'concept-status',
  priorityConceptId: 'concept-prio',
  createdAt: '2026-08-14T10:00:00.000Z',
  hasReleasedResult: false,
};

/** Doble mínimo de la sesión: lo único que la pantalla le pide es el perfil. */
function authDoble(patientProfileId: string | null) {
  return { patientProfileId: signal(patientProfileId) };
}

/**
 * «Mis órdenes» — carril J1, tarea 2.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **No hay id de paciente en la petición.** Sin parámetro no hay
 *    comparación que olvidar; el vínculo lo resuelve el servidor.
 * 2. **La preparación se muestra cuando la hay y se calla cuando no.** Un
 *    «no requiere preparación» inventado manda a alguien desayunado a un
 *    estudio en ayunas.
 * 3. **«Ver resultado» sólo aparece si el servidor dijo que hay uno liberado.**
 *    La pantalla no recalcula esa regla.
 * 4. **Sin perfil de paciente no se pide nada**, y se explica por qué.
 */
describe('DiagnosticOrders', () => {
  let fixture: ComponentFixture<DiagnosticOrders>;
  let http: HttpTestingController;

  function configurar(perfil: string | null): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: authDoble(perfil) },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  }

  function mount(): void {
    fixture = TestBed.createComponent(DiagnosticOrders);
    fixture.detectChanges();
  }

  /** Responde la lectura de órdenes y descarta la de terminología. */
  function responderOrdenes(items: readonly unknown[]): void {
    http
      .expectOne((request) => request.url === '/diagnostic-results/me/orders')
      .flush({ patientProfileId: PROFILE_ID, items, limit: 50, truncated: false });
    for (const pedido of http.match((request) => request.url.startsWith('/terminology'))) {
      pedido.flush({ items: [] });
    }
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('no pregunta por nadie más: no hay id de paciente en la petición', () => {
    configurar(PROFILE_ID);
    mount();

    const pedido = http.expectOne((request) => request.url === '/diagnostic-results/me/orders');
    expect(pedido.request.url).not.toContain(PROFILE_ID);
    pedido.flush({ patientProfileId: PROFILE_ID, items: [], limit: 50, truncated: false });
  });

  it('no lee nada para una cuenta sin perfil de paciente', () => {
    configurar(null);
    mount();

    http.expectNone(() => true);
    expect(fixture.nativeElement.textContent).toContain('Esta sección es para pacientes');
  });

  it('sin órdenes explica de dónde sale una, en vez de dejar la pantalla en blanco', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([]);

    expect(fixture.nativeElement.textContent).toContain('te pida un estudio en una consulta');
  });

  it('muestra la preparación cuando el catálogo la trae', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([{ ...ORDEN, preparationInstructions: 'Ayuno de 8 horas.' }]);

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Cómo prepararte');
    expect(texto).toContain('Ayuno de 8 horas.');
  });

  it('sin preparación publicada no inventa un texto tranquilizador', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([ORDEN]);

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('Cómo prepararte');
    expect(texto).not.toContain('No requiere preparación');
  });

  it('no ofrece «ver resultado» sobre una orden sin resultado liberado', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([ORDEN]);

    expect(fixture.nativeElement.textContent).not.toContain('Ver resultado');
  });

  it('enlaza el resultado cuando el servidor dice que está liberado', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([{ ...ORDEN, hasReleasedResult: true, reportId: REPORT_ID }]);

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Ver resultado');
    expect(texto).toContain('Con resultado');
  });

  it('refactor UX: «Reservar hora» lleva a Mis citas en modo laboratorio y dice de qué estudio', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([{ ...ORDEN, hasReleasedResult: true, reportId: REPORT_ID }]);

    const raiz = fixture.nativeElement as HTMLElement;
    const reservar = raiz.querySelector('[data-testid="orden-reservar"]') as HTMLAnchorElement;
    const estudio = raiz.querySelector('.ordenes__titulo')?.textContent?.trim() ?? '';
    // Antes: botón deshabilitado con «Próximamente», aunque la reserva existía.
    expect(reservar.tagName).toBe('A');
    expect(reservar.getAttribute('aria-disabled')).not.toBe('true');
    expect(reservar.getAttribute('href')).toBe('/my-account/appointments?resource=lab');
    expect(reservar.getAttribute('aria-label')).toBe(`Reservar hora en un laboratorio: ${estudio}`);
    expect(raiz.textContent).not.toContain('Próximamente');
    const verResultado = [...raiz.querySelectorAll('a')].find((a) =>
      a.textContent?.includes('Ver resultado'),
    );
    expect(verResultado?.getAttribute('aria-label')).toBe(`Ver resultado: ${estudio}`);
  });

  it('agrupa por atención: tres estudios de una consulta son un pedido, no tres', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([
      { ...ORDEN, id: 'o-1' },
      { ...ORDEN, id: 'o-2' },
      { ...ORDEN, id: 'o-3' },
    ]);

    const grupos = fixture.nativeElement.querySelectorAll('.ordenes__grupo');
    const filas = fixture.nativeElement.querySelectorAll('.ordenes__item');
    expect(grupos).toHaveLength(1);
    expect(filas).toHaveLength(3);
  });

  it('separa las atenciones distintas', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([
      { ...ORDEN, id: 'o-1', encounterId: 'enc-a' },
      { ...ORDEN, id: 'o-2', encounterId: 'enc-b' },
    ]);

    expect(fixture.nativeElement.querySelectorAll('.ordenes__grupo')).toHaveLength(2);
  });

  it('el encabezado del grupo es la fecha, no el identificador de la atención', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([ORDEN]);

    const titulo: string =
      fixture.nativeElement.querySelector('.ordenes__grupo-titulo').textContent;
    expect(titulo).toContain('Atención del');
    expect(titulo).not.toContain(ORDEN.encounterId);
  });

  it('una orden pedida fuera de una consulta se agrupa aparte y lo dice', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([{ ...ORDEN, encounterId: undefined }]);

    expect(fixture.nativeElement.querySelector('.ordenes__grupo-titulo').textContent).toContain(
      'fuera de una consulta',
    );
  });

  it('el estado vacío ofrece su salida, no sólo el texto (contrato S3)', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([]);

    const salida = fixture.nativeElement.querySelector('a[app-link]');
    expect(salida).not.toBeNull();
    expect(salida.textContent).toContain('Ver mis turnos');
  });

  it('reservar es enfocable y el lector lo anuncia: nunca un control apagado en nativo', () => {
    // Invariante original (carril J1): el camino a reservar no se esconde ni
    // deja de ser enfocable. Mientras la reserva no existía se apagaba con
    // aria-disabled; desde el refactor UX es un enlace activo (ver el caso
    // «Reservar hora lleva a Mis citas en modo laboratorio»).
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([ORDEN]);

    const reservar = fixture.nativeElement.querySelector(
      '[data-testid="orden-reservar"]',
    ) as HTMLAnchorElement;
    expect(reservar.hasAttribute('href')).toBe(true);
    expect(reservar.hasAttribute('disabled')).toBe(false);
    expect(reservar.tabIndex).not.toBe(-1);
  });

  it('no muestra ningún uuid en pantalla', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([{ ...ORDEN, hasReleasedResult: true, reportId: REPORT_ID }]);

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain(ORDER_ID);
    expect(texto).not.toContain(REPORT_ID);
    expect(texto).not.toContain('concept-code');
  });
});
