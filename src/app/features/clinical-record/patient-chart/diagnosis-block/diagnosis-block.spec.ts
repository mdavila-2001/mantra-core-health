import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import { DiagnosisBlock } from './diagnosis-block';

/**
 * La tabla de presuntivos (C3), sola en el bloque desde el 2026-09-25 —
 * ver el comentario de la clase en `diagnosis-block.ts` para por qué el
 * formulario de alta que este bloque tenía se sacó entero. Lo que estas
 * pruebas fijan:
 *
 * 1. **El bloque sólo tiene la tabla.** Sin `<form>`, sin barra de casos de
 *    demostración: lo único que se pinta es «Diagnósticos de esta persona».
 * 2. **El estado sale del catálogo, no de la etiqueta.** Sólo un presuntivo
 *    («En estudio») ofrece Confirmar/Rechazar.
 * 3. **Confirmar/Rechazar relee la lista del servidor** y avisa al
 *    expediente — nunca se pinta la fila a mano con la respuesta.
 * 4. **Sin borrador que perder.** `tieneCambiosPendientes` (contrato de
 *    `DraftBlock`) es siempre `false`: no hay formulario que deje algo a
 *    medio escribir.
 */

/** El resumen clínico sin diagnósticos: lo que la tabla lee por omisión. */
const RESUMEN_VACIO = {
  patientProfileId: 'p-1',
  conditions: [],
  allergies: [],
  medicationRequests: [],
  observations: [],
  encounters: [],
  careEpisodes: [],
  limit: 50,
  truncated: [],
};

const RESUMEN = {
  ...RESUMEN_VACIO,
  conditions: [
    {
      id: 'c-1',
      codeConceptId: 'dx-hta',
      clinicalStatusConceptId: 'st-activa',
      verificationStatusConceptId: 'st-provisional',
      onsetAt: '2026-09-01T00:00:00.000Z',
      createdAt: '2026-09-20T10:00:00.000Z',
    },
    {
      id: 'c-2',
      codeConceptId: 'dx-hta',
      clinicalStatusConceptId: 'st-activa',
      verificationStatusConceptId: 'st-confirmada',
      createdAt: '2026-09-10T10:00:00.000Z',
      verification: {
        outcome: 'CONFIRMED',
        decidedAt: '2026-09-12T10:00:00.000Z',
        decidedByProfileId: 'pr-1',
        reasonText: 'Por el informe',
        basedOn: { kind: 'ANALYSIS', serviceRequestId: 'o-1' },
      },
    },
  ],
};

/** Los códigos que `diagnosisStateOf` necesita, con sus etiquetas. */
const ETIQUETAS = {
  items: [
    {
      conceptId: 'dx-hta',
      code: 'I10',
      display: 'Hipertensión esencial',
      codeSystemVersionId: 'v',
    },
    { conceptId: 'st-activa', code: 'COND-ACTIVE', display: 'Activa', codeSystemVersionId: 'v' },
    {
      conceptId: 'st-provisional',
      code: 'DXV-PROVISIONAL',
      display: 'Provisional',
      codeSystemVersionId: 'v',
    },
    {
      conceptId: 'st-confirmada',
      code: 'DXV-CONFIRMED',
      display: 'Confirmado',
      codeSystemVersionId: 'v',
    },
  ],
  count: 4,
  limit: 200,
};

/** base64url **sobre UTF-8**, como el token real. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('DiagnosisBlock', () => {
  let fixture: ComponentFixture<DiagnosisBlock>;
  let componente: DiagnosisBlock;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
    fixture = TestBed.createComponent(DiagnosisBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
  });

  afterEach(() => {
    // `app-diagnosis-verify-dialog` pide sus propios catálogos (por ejemplo el
    // curso clínico) cuando queda montado tras Confirmar/Rechazar: es su
    // asunto, no el de esta tabla, así que acá sólo se drenan para que
    // `http.verify()` no tropiece con una petición que este bloque no abrió.
    for (const opcional of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      opcional.flush({
        code: 'opcional',
        name: 'Opcional',
        definitionId: 'def-opcional',
        valueSetId: 'vs-opcional',
        allowCustomValue: false,
        options: [],
      });
    }
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function elemento(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function porTestId(id: string): HTMLElement | null {
    return elemento().querySelector(`[data-testid="${id}"]`);
  }

  /** Pinta el bloque: resumen y etiquetas de la tabla. */
  function cargar(resumen: unknown = RESUMEN): void {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/clinical/patients/p-1/summary').flush(resumen as object);
    fixture.detectChanges();
    for (const etiquetas of http.match((r) => r.url === '/terminology/concepts')) {
      etiquetas.flush(ETIQUETAS);
    }
    fixture.detectChanges();
  }

  it('el bloque sólo tiene la tabla: no hay formulario de alta', () => {
    cargar();
    expect(porTestId('diagnostico-tabla')).not.toBeNull();
    expect(elemento().querySelector('form')).toBeNull();
  });

  it('tieneCambiosPendientes es siempre falso: no hay formulario que deje borrador', () => {
    expect(componente.tieneCambiosPendientes()).toBe(false);
    cargar();
    expect(componente.tieneCambiosPendientes()).toBe(false);
  });

  it('lista los diagnósticos con su estado, y sólo el presuntivo se puede confirmar o rechazar', () => {
    cargar();

    expect(porTestId('diagnostico-fila-c-1')?.textContent).toContain('Hipertensión esencial');
    expect(elemento().textContent).toContain('En estudio');
    expect(elemento().textContent).toContain('Enfermedad activa');
    // La evidencia de la decisión ya tomada, en dos palabras.
    expect(elemento().textContent).toContain('Orden · Por el informe');
    expect(porTestId('diagnostico-confirmar-c-1')).not.toBeNull();
    expect(porTestId('diagnostico-rechazar-c-1')).not.toBeNull();
    expect(porTestId('diagnostico-confirmar-c-2')).toBeNull();
    expect(porTestId('diagnostico-rechazar-c-2')).toBeNull();
  });

  it('sin diagnósticos lo dice, sin ofrecer ningún formulario', () => {
    cargar(RESUMEN_VACIO);

    expect(elemento().textContent).toContain('todavía no tiene diagnósticos registrados');
    expect(elemento().querySelector('form')).toBeNull();
  });

  it('si la lectura del resumen falla, la tabla lo cuenta', () => {
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush(
        {
          statusCode: 500,
          code: 'INTERNAL',
          message: 'Se rompió',
          error: 'Error',
          requestId: 'req-9',
        },
        { status: 500, statusText: 'Internal Server Error' },
      );
    fixture.detectChanges();

    expect(interno<() => { status: string }>('filas')().status).not.toBe('ready');
    expect(interno<() => { status: string }>('filas')().status).not.toBe('loading');
  });

  it('confirmar abre el diálogo y, decidido, relee la lista y avisa al expediente', () => {
    cargar();
    let avisos = 0;
    componente.cambio.subscribe(() => (avisos += 1));

    porTestId('diagnostico-confirmar-c-1')!.click();
    fixture.detectChanges();

    expect(elemento().querySelector('app-diagnosis-verify-dialog')).not.toBeNull();
    // El diálogo lee el circuito y las notas de la persona; acá se responden vacíos.
    for (const lectura of http.match((r) => r.url === '/diagnostics/patients/p-1/orders')) {
      lectura.flush({ patientProfileId: 'p-1', orders: [], reports: [], limit: 50, truncated: [] });
    }
    for (const lectura of http.match((r) => r.url === '/charts/notes')) {
      lectura.flush({ items: [], count: 0, limit: 50, nextCursor: null });
    }
    fixture.detectChanges();

    const decidida = {
      ...RESUMEN.conditions[0]!,
      verificationStatusConceptId: 'st-confirmada',
      onsetAt: new Date('2026-09-01T00:00:00.000Z'),
      createdAt: new Date('2026-09-20T10:00:00.000Z'),
      verification: {
        outcome: 'CONFIRMED' as const,
        decidedAt: '2026-09-26T10:00:00.000Z',
        decidedByProfileId: 'pr-1',
        reasonText: 'Cuadro compatible',
        basedOn: null,
      },
    };
    interno<(c: unknown) => void>('alVerificar')(decidida);
    fixture.detectChanges();

    expect(elemento().querySelector('app-diagnosis-verify-dialog')).toBeNull();
    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush({ ...RESUMEN, conditions: [decidida, RESUMEN.conditions[1]!] });
    fixture.detectChanges();
    for (const etiquetas of http.match((r) => r.url === '/terminology/concepts')) {
      etiquetas.flush(ETIQUETAS);
    }
    fixture.detectChanges();

    expect(avisos).toBe(1);
    expect(porTestId('diagnostico-confirmar-c-1')).toBeNull();
  });
});
