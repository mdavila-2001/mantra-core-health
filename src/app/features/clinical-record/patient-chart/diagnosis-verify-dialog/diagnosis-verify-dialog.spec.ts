import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type {
  Condition,
  DiagnosisOutcome,
} from '../../../../core/data-access/clinical/clinical.types';
import { DiagnosisVerifyDialog } from './diagnosis-verify-dialog';

/**
 * Confirmar o rechazar un presuntivo — C3. Lo que estas pruebas fijan:
 *
 * 1. **La evidencia es de esta persona**: las opciones salen de su circuito
 *    diagnóstico y de sus notas; no hay campo libre.
 * 2. **El espejo del 422 corre antes de mandar**: sin motivo ni evidencia, o
 *    confirmar sin fin ni crónica, marca el campo y no pega al servidor.
 * 3. **Lo que viaja es el contrato**: sólo las claves elegidas, los instantes
 *    en ISO, la crónica sin fin esperado y con el curso del catálogo.
 * 4. **Un rechazo del servidor se muestra sin perder lo escrito.**
 */

const PRESUNTIVO: Condition = {
  id: 'c-1',
  codeConceptId: 'dx-hta',
  clinicalStatusConceptId: 'st-activa',
  verificationStatusConceptId: 'st-provisional',
  onsetAt: new Date('2026-09-01T00:00:00.000Z'),
  createdAt: new Date('2026-09-20T10:00:00.000Z'),
};

const CIRCUITO = {
  patientProfileId: 'p-1',
  orders: [
    {
      id: 'o-1',
      patientProfileId: 'p-1',
      codeConceptId: 'st-hemo',
      statusConceptId: 'st-activa',
      createdAt: '2026-09-10T10:00:00.000Z',
    },
  ],
  reports: [
    {
      id: 'r-1',
      patientProfileId: 'p-1',
      serviceRequestId: 'o-1',
      codeConceptId: 'st-hemo',
      lifecycleStatusConceptId: 'final',
      createdAt: '2026-09-12T10:00:00.000Z',
    },
  ],
  limit: 50,
  truncated: [],
};

const NOTAS = {
  items: [
    {
      noteId: 'n-1',
      lifecycleStatusConceptId: 'l',
      releasedToPatient: false,
      createdAt: '2026-09-11T10:00:00.000Z',
    },
  ],
  count: 1,
  limit: 50,
  nextCursor: null,
};

const ETIQUETAS = {
  items: [
    { conceptId: 'st-hemo', code: 'HEMO', display: 'Hemograma completo', codeSystemVersionId: 'v' },
  ],
  count: 1,
  limit: 200,
};

const CATALOGO_DE_CURSO = {
  code: 'condition-clinical-course',
  name: 'Curso clínico',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  allowCustomValue: false,
  options: [
    {
      conceptId: 'curso-agudo',
      code: 'COND_COURSE_ACUTE',
      display: 'Acute',
      ordinal: 1,
      isDefault: false,
    },
    {
      conceptId: 'curso-cronico',
      code: 'COND_COURSE_CHRONIC',
      display: 'Chronic',
      ordinal: 2,
      isDefault: false,
    },
  ],
};

/** La condición como la devuelve el servidor tras decidir. */
const DECIDIDA = {
  id: 'c-1',
  codeConceptId: 'dx-hta',
  clinicalStatusConceptId: 'st-activa',
  verificationStatusConceptId: 'st-confirmada',
  onsetAt: '2026-09-01T00:00:00.000Z',
  expectedResolutionAt: '2026-10-05T00:00:00.000Z',
  verification: {
    outcome: 'CONFIRMED',
    decidedAt: '2026-09-26T10:00:00.000Z',
    decidedByProfileId: 'pr-1',
    reasonText: 'Cuadro compatible',
    basedOn: { kind: 'ANALYSIS', serviceRequestId: 'o-1', diagnosticReportId: 'r-1' },
  },
  createdAt: '2026-09-20T10:00:00.000Z',
};

describe('DiagnosisVerifyDialog', () => {
  let fixture: ComponentFixture<DiagnosisVerifyDialog>;
  let componente: DiagnosisVerifyDialog;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DiagnosisVerifyDialog);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('condition', PRESUNTIVO);
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.componentRef.setInput('outcome', 'CONFIRMED');
    fixture.componentRef.setInput('nombre', 'Hipertensión esencial');
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function señal<T>(nombre: string): WritableSignal<T> {
    return (componente as unknown as Record<string, WritableSignal<T>>)[nombre];
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  /** Pinta el diálogo y responde las cuatro lecturas con las que se arma. */
  function abrir(outcome: DiagnosisOutcome = 'CONFIRMED'): void {
    fixture.componentRef.setInput('outcome', outcome);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/diagnostics/patients/p-1/orders').flush(CIRCUITO);
    http.expectOne((r) => r.url === '/charts/notes').flush(NOTAS);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(ETIQUETAS);
    http.expectOne((r) => r.url === '/system-context/dynamic-enums').flush(CATALOGO_DE_CURSO);
    fixture.detectChanges();
  }

  function enviar(): void {
    interno<() => void>('enviar')();
    fixture.detectChanges();
  }

  it('ofrece como evidencia las órdenes, los informes y las notas de la persona, con su nombre', () => {
    abrir();

    const etiquetas = interno<() => readonly { label: string; value: string | null }[]>(
      'opcionesDeEvidencia',
    )().map((opcion) => opcion.label);

    // Sin opción vacía propia: la nula la dibuja el `placeholder` del select.
    expect(etiquetas).toHaveLength(3);
    expect(etiquetas.some((e) => e.startsWith('Informe · Hemograma completo'))).toBe(true);
    expect(etiquetas.some((e) => e.startsWith('Orden · Hemograma completo'))).toBe(true);
    expect(etiquetas.some((e) => e.startsWith('Nota #'))).toBe(true);
    expect(texto()).toContain('Confirmar Hipertensión esencial');
  });

  it('sin motivo ni evidencia no manda: marca el motivo y lo dice', () => {
    abrir();

    enviar();

    http.expectNone((r) => r.url.includes('/verification'));
    expect(texto()).toContain('Escribí el motivo o elegí una evidencia');
  });

  it('confirmar sin fin esperado ni crónica no manda: marca el campo', () => {
    abrir();
    señal<string>('motivo').set('Cuadro compatible');

    enviar();

    http.expectNone((r) => r.url.includes('/verification'));
    expect(texto()).toContain('Indicá hasta cuándo se espera la condición');
  });

  it('confirma con motivo, informe y fin esperado: manda el contrato y emite la condición decidida', () => {
    abrir();
    const decididas: Condition[] = [];
    let cierres = 0;
    componente.verified.subscribe((c) => decididas.push(c));
    componente.closed.subscribe(() => (cierres += 1));

    señal<string>('motivo').set('Cuadro compatible');
    señal<string | null>('evidencia').set('report:r-1');
    señal<Date | null>('fin').set(new Date('2026-10-05T00:00:00.000Z'));
    enviar();

    const req = http.expectOne('/clinical/conditions/c-1/verification');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      outcome: 'CONFIRMED',
      reasonText: 'Cuadro compatible',
      basedOn: { kind: 'ANALYSIS', diagnosticReportId: 'r-1', serviceRequestId: 'o-1' },
      // El inicio precargado del presuntivo viaja aunque nadie lo haya tocado.
      onsetAt: '2026-09-01T00:00:00.000Z',
      expectedResolutionAt: '2026-10-05T00:00:00.000Z',
    });

    req.flush(DECIDIDA);
    fixture.detectChanges();

    expect(decididas).toHaveLength(1);
    expect(decididas[0]!.verificationStatusConceptId).toBe('st-confirmada');
    expect(decididas[0]!.createdAt).toBeInstanceOf(Date);
    expect(cierres).toBe(1);
  });

  it('crónica: sin fin esperado y con el curso del catálogo; el motivo admite exactamente 500', () => {
    abrir();
    señal<string>('motivo').set('x'.repeat(500));
    señal<Date | null>('fin').set(new Date('2026-10-05T00:00:00.000Z'));
    interno<(marcada: boolean) => void>('marcarCronica')(true);
    enviar();

    const req = http.expectOne('/clinical/conditions/c-1/verification');
    const body = req.request.body as Record<string, unknown>;
    expect(body['clinicalCourseConceptId']).toBe('curso-cronico');
    expect('expectedResolutionAt' in body).toBe(false);
    expect((body['reasonText'] as string).length).toBe(500);

    req.flush({ ...DECIDIDA, expectedResolutionAt: undefined });
  });

  it('rechazar con sólo una nota manda la evidencia y nada más', () => {
    abrir('REFUTED');
    señal<string | null>('evidencia').set('note:n-1');
    enviar();

    const req = http.expectOne('/clinical/conditions/c-1/verification');
    expect(req.request.body).toEqual({
      outcome: 'REFUTED',
      basedOn: { kind: 'NOTE', noteId: 'n-1' },
    });
    expect(texto()).toContain('Rechazar Hipertensión esencial');

    req.flush({ ...DECIDIDA, verificationStatusConceptId: 'st-descartada' });
  });

  it('un 409 del servidor se muestra sin perder lo escrito y sin cerrar', () => {
    abrir();
    let cierres = 0;
    componente.closed.subscribe(() => (cierres += 1));
    señal<string>('motivo').set('Cuadro compatible');
    señal<Date | null>('fin').set(new Date('2026-10-05T00:00:00.000Z'));
    enviar();

    http.expectOne('/clinical/conditions/c-1/verification').flush(
      {
        statusCode: 409,
        code: 'CONFLICT',
        message:
          'Este diagnóstico ya no está en estudio: sólo un presuntivo se confirma o se rechaza.',
        error: 'Conflict',
        details: {},
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(texto()).toContain('ya no está en estudio');
    expect(señal<string>('motivo')()).toBe('Cuadro compatible');
    expect(interno<() => boolean>('enviando')()).toBe(false);
    expect(cierres).toBe(0);
  });
});
