import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ESTADOS_DE_CASO, resolverEstadosDeCaso } from '../../../../testing/case-status';
import { CaseQueue } from './case-queue';

/** Estados reales del catálogo: los UUID salen de un único lugar, no de acá. */
const EN_VERIFICACION = ESTADOS_DE_CASO.CASE_IN_VERIFICATION;
const REVISION_MANUAL = ESTADOS_DE_CASO.CASE_MANUAL_REVIEW;
const MARCADO_POR_RIESGO = ESTADOS_DE_CASO.CASE_AT_RISK;
const CASO = '23232323-2323-2323-2323-232323232323';
const OTRO_CASO = '24242424-2424-2424-2424-242424242424';
const SUJETO = '21212121-2121-2121-2121-212121212121';
/** El caso no distingue por tipo de sujeto: la cola no lo muestra ni lo filtra. */
const TIPO_DE_SUJETO = '25252525-2525-2525-2525-252525252525';
const POLITICA = '22222222-2222-2222-2222-222222222222';

function caso(overrides: Record<string, unknown> = {}) {
  return {
    id: CASO,
    status: EN_VERIFICACION,
    subjectTypeConceptId: TIPO_DE_SUJETO,
    subjectEntityId: SUJETO,
    identityVerificationPolicyId: POLITICA,
    openedAt: '2026-08-10T12:00:00.000Z',
    ...overrides,
  };
}

describe('CaseQueue', () => {
  let fixture: ComponentFixture<CaseQueue>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CaseQueue],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });

    fixture = TestBed.createComponent(CaseQueue);
    http = TestBed.inject(HttpTestingController);
    // La cola resuelve los estados contra terminología: sin responder esa
    // búsqueda, las etiquetas quedan en neutro y `verify()` protesta.
    resolverEstadosDeCaso(http);
  });

  afterEach(() => {
    http.verify();
  });

  function responder(casos: readonly unknown[]) {
    fixture.detectChanges();
    http.expectOne('/identity/verification-cases').flush({ cases: casos });
    fixture.detectChanges();
  }

  it('pide la cola sin filtros: los estados que esperan los decide el backend', () => {
    fixture.detectChanges();
    const req = http.expectOne('/identity/verification-cases');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ cases: [] });
  });

  it('muestra un caso en verificación con su estado en palabras', () => {
    responder([caso()]);

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('En revisión');
    expect(texto).toContain(CASO);
  });

  it('al revisor SÍ le revela la marca de riesgo, que al titular se le oculta', () => {
    responder([caso({ id: OTRO_CASO, status: MARCADO_POR_RIESGO })]);

    const texto = fixture.nativeElement.textContent as string;
    // El mapa compartido lo llamaría «En revisión» —enmascaramiento deliberado
    // para el titular—; en la cola del revisor eso escondería el único dato que
    // cambia su orden de atención.
    expect(texto).toContain('Marcado por riesgo');
  });

  it('enlaza cada caso al formulario de revisión con el id ya puesto', () => {
    responder([caso()]);

    const enlace: HTMLAnchorElement | null =
      fixture.nativeElement.querySelector(`a[href*="caseId=${CASO}"]`);
    expect(enlace).not.toBeNull();
    expect(enlace?.getAttribute('href')).toContain(
      '/administracion/verificacion-identidad/revision/escalar',
    );
  });

  it('una cola vacía ofrece salida, como exige el M34', () => {
    responder([]);

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('No hay casos esperando revisión.');
    expect(texto).toContain('Abrir un caso de verificación');
  });

  it('un error deja reintentar, y el reintento vuelve a pedir la cola', () => {
    fixture.detectChanges();
    http
      .expectOne('/identity/verification-cases')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const reintentar: HTMLButtonElement | undefined = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((boton) => (boton.textContent ?? '').includes('Reintentar'));
    expect(reintentar).toBeDefined();

    reintentar?.click();
    fixture.detectChanges();
    http.expectOne('/identity/verification-cases').flush({ cases: [] });
    fixture.detectChanges();
  });

  it('respeta el orden que manda el backend: el que más esperó, primero', () => {
    responder([
      caso({ id: CASO, openedAt: '2026-08-09T08:00:00.000Z' }),
      caso({ id: OTRO_CASO, status: REVISION_MANUAL, openedAt: '2026-08-10T12:00:00.000Z' }),
    ]);

    const texto = fixture.nativeElement.textContent as string;
    // La pantalla no reordena: si lo hiciera, duplicaría una regla que el
    // backend ya aplica y podrían discrepar.
    expect(texto.indexOf(CASO)).toBeLessThan(texto.indexOf(OTRO_CASO));
  });
});
