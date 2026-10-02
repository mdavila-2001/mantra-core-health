import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';

import { AuthService } from '../../../core/auth/auth.service';
import { PatientStudyComparisonContext } from '../../../core/diagnostics/patient-study-comparison';
import { DiagnosticOrders } from './diagnostic-orders';
import type { ValueSetOption } from '../../../core/data-access/terminology/terminology.types';

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
  function responderOrdenes(items: readonly unknown[], conceptos: readonly ValueSetOption[] = []): void {
    http
      .expectOne((request) => request.url === '/diagnostic-results/me/orders')
      .flush({ patientProfileId: PROFILE_ID, items, limit: 50, truncated: false });
    for (const pedido of http.match((request) => request.url.startsWith('/terminology'))) {
      pedido.flush({ items: conceptos });
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

  it('no presenta la agenda genérica de laboratorio como reserva de imagenología', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([{ ...ORDEN, hasReleasedResult: true, reportId: REPORT_ID }]);

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid="orden-reservar"]')).toBeNull();
    expect(raiz.textContent).not.toContain('Reservar hora en un laboratorio');
    expect(raiz.querySelector('[data-testid="orden-comparar-centros"]')).not.toBeNull();
    expect(raiz.querySelector('a[aria-label^="Ver resultado:"]')).not.toBeNull();
  });

  it('inicia una comparación con todos los estudios agrupados y mantiene sus nombres fuera de la URL', () => {
    configurar(PROFILE_ID);
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    mount();
    responderOrdenes([
      { ...ORDEN, id: 'o-1', codeConceptId: 'concept-1' },
      { ...ORDEN, id: 'o-2', codeConceptId: 'concept-2' },
      { ...ORDEN, id: 'o-3', codeConceptId: 'concept-3' },
    ], [
      { conceptId: 'concept-1', code: 'US-ABD', display: 'Ecografía abdominal', codeSystemVersionId: 'test' },
      { conceptId: 'concept-2', code: 'RX-TORAX', display: 'Radiografía de tórax', codeSystemVersionId: 'test' },
      { conceptId: 'concept-3', code: 'RMN-RODILLA', display: 'Resonancia de rodilla', codeSystemVersionId: 'test' },
    ]);

    const boton = fixture.nativeElement.querySelector(
      '[data-testid="orden-comparar-centros"]',
    ) as HTMLButtonElement | null;
    expect(boton).not.toBeNull();
    boton?.click();

    expect(navegar).toHaveBeenCalledWith(['/laboratory-directory']);
    expect(TestBed.inject(PatientStudyComparisonContext).studies()).toEqual([
      { code: 'US-ABD', name: 'Ecografía abdominal', preparationInstructions: null },
      { code: 'RX-TORAX', name: 'Radiografía de tórax', preparationInstructions: null },
      { code: 'RMN-RODILLA', name: 'Resonancia de rodilla', preparationInstructions: null },
    ]);
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

  it('el control de comparación del pedido es enfocable y tiene nombre accesible', () => {
    configurar(PROFILE_ID);
    mount();
    responderOrdenes([ORDEN]);

    const comparar = fixture.nativeElement.querySelector(
      '[data-testid="orden-comparar-centros"]',
    ) as HTMLButtonElement;
    expect(comparar.hasAttribute('disabled')).toBe(false);
    expect(comparar.tabIndex).not.toBe(-1);
    expect(comparar.getAttribute('aria-label')).toContain('1 estudios');
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
