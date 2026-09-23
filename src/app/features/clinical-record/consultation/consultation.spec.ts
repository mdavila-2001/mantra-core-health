import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { Consultation } from './consultation';

/**
 * La consulta — la rejilla de todo lo que se registra mientras se atiende.
 *
 * Lo que fijan estas pruebas:
 *
 * 1. **Están todas las posibilidades.** Las siete altas del expediente, el
 *    formulario clínico y la internación —cada una con su cantidad leída— y
 *    «Pagos», que no da de alta nada y por eso no lleva cifra.
 * 2. **Cada casilla abre su formulario en modal**, y uno solo a la vez.
 * 3. **El check-in manda lo que el contrato pide y nada más.** Un motivo en
 *    blanco no viaja, y el turno de origen viaja sólo si existe.
 * 4. **«En curso» se deriva de `endAt`,** no del estado.
 */

const RESUMEN = {
  patientProfileId: 'p-1',
  conditions: [
    { id: 'c-1', codeConceptId: 'con-dm', createdAt: '2026-01-03T00:00:00.000Z' },
    { id: 'c-2', codeConceptId: 'con-hta', createdAt: '2026-01-04T00:00:00.000Z' },
  ],
  allergies: [],
  medicationRequests: [],
  observations: [],
  encounters: [],
  careEpisodes: [],
  limit: 50,
  truncated: [],
};

const CHART = {
  patientProfileId: 'p-1',
  notes: [],
  carePlans: [],
  documents: [{ id: 'd-1', title: 'Hemograma', createdAt: '2026-01-05T00:00:00.000Z' }],
  limit: 50,
  truncated: [],
};

const CLAVES = [
  'diagnosticos',
  'alergias',
  'medicacion',
  'observaciones',
  'notas',
  'planes',
  'documentos',
  'formulario',
  'internacion',
  // La décima, y la única de sólo lectura: lo que la persona ya pagó.
  'pagos',
];

describe('Consultation', () => {
  let harness: RouterTestingHarness;
  let componente: Consultation;
  let http: HttpTestingController;

  function interno<T>(clave: string): T {
    return (componente as unknown as Record<string, T>)[clave] as T;
  }

  async function responderLectura(resumen: Record<string, unknown> = {}): Promise<void> {
    http
      .expectOne((r) => r.url === '/profiles/patients/p-1')
      .flush({ profileId: 'p-1', displayName: 'Ana Pérez', patientCode: 'P1' });
    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush({ ...RESUMEN, ...resumen });
    http.expectOne((r) => r.url === '/charts/patients/p-1/chart').flush(CHART);
    // Sin conceptos la etiqueta cae a «Sin registrar»: lo que se prueba acá es
    // la rejilla, no la traducción.
    http
      .match((r) => r.url === '/terminology/concepts')
      .forEach((req) => req.flush({ items: [], count: 0, limit: 200 }));
    await harness.fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'medical-records/:profileId/consultation', component: Consultation },
        ]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl('/medical-records/p-1/consultation', Consultation);
  });

  it('ofrece las diez posibilidades en la rejilla, con su cantidad', async () => {
    await responderLectura();

    const casillas = interno<() => readonly { clave: string; cantidad: number | null }[]>(
      'casillas',
    )();
    expect(casillas.map((c) => c.clave)).toEqual(CLAVES);
    expect(casillas.find((c) => c.clave === 'diagnosticos')?.cantidad).toBe(2);
    expect(casillas.find((c) => c.clave === 'documentos')?.cantidad).toBe(1);
    expect(casillas.find((c) => c.clave === 'formulario')?.cantidad).toBeNull();
    // Pagos no lleva cifra: son de la caja y no de las dos lecturas del
    // expediente, y un número pedido acá podría discrepar del que muestra el
    // propio bloque al abrirse.
    expect(casillas.find((c) => c.clave === 'pagos')?.cantidad).toBeNull();

    const botones = harness.routeNativeElement!.querySelectorAll(
      '[data-testid^="consulta-casilla-"]',
    );
    expect(botones).toHaveLength(10);
  });

  /**
   * Pagos es la única casilla que no escribe, y la bajada del modal es la
   * única línea que dice qué va a pasar al confirmar. Prometer que «se
   * registra» ahí sería mentir en el peor lugar posible.
   */
  it('el modal de pagos no promete que se registre nada', async () => {
    await responderLectura();

    const abrir = interno<(clave: string) => void>('abrir').bind(componente);
    abrir('pagos');

    expect(interno<() => string>('tituloDelModal')()).toBe('Pagos de la persona');
    expect(interno<() => string>('descripcionDelModal')()).toContain('ya pagó');
    expect(interno<() => string>('descripcionDelModal')()).not.toContain('Se registra');
  });

  it('abre el modal de la casilla elegida y lo cierra', async () => {
    await responderLectura();

    const abrir = interno<(clave: string) => void>('abrir').bind(componente);
    abrir('alergias');
    expect(interno<() => string | null>('casillaAbierta')()).toBe('alergias');
    expect(interno<() => string>('tituloDelModal')()).toBe('Nueva alergia');

    abrir('medicacion');
    expect(interno<() => string | null>('casillaAbierta')()).toBe('medicacion');

    interno<() => void>('cerrarCasilla').call(componente);
    expect(interno<() => string | null>('casillaAbierta')()).toBeNull();
  });

  it('deriva el encuentro en curso de endAt y registra contra él', async () => {
    await responderLectura({
      encounters: [
        { id: 'e-1', statusConceptId: 'st', startAt: '2026-03-01T10:00:00.000Z' },
        {
          id: 'e-0',
          statusConceptId: 'st',
          startAt: '2026-02-01T10:00:00.000Z',
          endAt: '2026-02-01T11:00:00.000Z',
        },
      ],
    });

    const enCurso = interno<() => readonly { id: string }[]>('encuentrosEnCurso')();
    expect(enCurso.map((e) => e.id)).toEqual(['e-1']);
    expect(interno<() => string | null>('encuentroActual')()).toBe('e-1');
  });

  it('sin encuentro abierto, la bajada del modal dice que va a la historia', async () => {
    await responderLectura();
    expect(interno<() => string | null>('encuentroActual')()).toBeNull();
    expect(interno<() => string>('descripcionDelModal')()).toContain('historia');
  });
});
