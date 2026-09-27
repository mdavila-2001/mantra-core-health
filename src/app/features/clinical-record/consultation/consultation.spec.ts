import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { CarePlanBlock } from '../patient-chart/care-plan-block/care-plan-block';
import { FormResponsePicker } from '../patient-chart/form-response-picker/form-response-picker';
import { Consultation } from './consultation';

/**
 * La consulta — la rejilla de todo lo que se registra mientras se atiende.
 *
 * Lo que fijan estas pruebas:
 *
 * 1. **Están las ocho posibilidades** —sin Medición ni Internación,
 *    retiradas el 25/09/2026, ni Nota médica ni Documento, que absorbió el
 *    formulario médico el 26/09/2026—, en orden y con cantidades leídas.
 *    Órdenes, reconsulta y Pagos no agregan lecturas para ofrecer una cifra.
 * 2. **Cada casilla abre su formulario en modal**, y uno solo a la vez.
 * 3. **El check-in manda lo que el contrato pide y nada más.** Un motivo en
 *    blanco no viaja, y el turno de origen viaja sólo si existe.
 * 4. **«En curso» se deriva de `endAt`,** no del estado.
 * 5. **«Lo registrado en este encuentro» (C8)**: la línea del encuentro montada
 *    del lado de quien escribe, con los hechos del encuentro abierto y sólo
 *    de ése.
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
  'formulario',
  'ordenes',
  'diagnosticos',
  'medicacion',
  'planes',
  'reconsulta',
  'alergias',
  'pagos',
];
const TITULOS = [
  'Formulario médico',
  'Orden de análisis',
  'Diagnóstico',
  'Receta',
  'Plan de cuidados',
  'Reconsulta',
  'Alergia',
  'Pagos',
];

describe('Consultation', () => {
  let harness: RouterTestingHarness;
  let componente: Consultation;
  let http: HttpTestingController;

  function interno<T>(clave: string): T {
    return (componente as unknown as Record<string, T>)[clave] as T;
  }

  async function responderLectura(
    resumen: Record<string, unknown> = {},
    chart: Record<string, unknown> = {},
    conceptos: readonly object[] = [],
  ): Promise<void> {
    http
      .expectOne((r) => r.url === '/profiles/patients/p-1')
      .flush({ profileId: 'p-1', displayName: 'Ana Pérez', patientCode: 'P1' });
    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush({ ...RESUMEN, ...resumen });
    http
      .expectOne((r) => r.url === '/charts/patients/p-1/chart')
      .flush({ ...CHART, ...chart });
    // Sin conceptos la etiqueta cae a «Sin registrar»: lo que se prueba acá es
    // la rejilla, no la traducción. Las pruebas de la línea del encuentro sí
    // los mandan, porque ahí el nombre del diagnóstico es lo que se lee.
    http
      .match((r) => r.url === '/terminology/concepts')
      .forEach((req) => req.flush({ items: conceptos, count: conceptos.length, limit: 200 }));
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

  it('ofrece las ocho posibilidades en la rejilla, con su cantidad', async () => {
    await responderLectura();

    const casillas = interno<() => readonly { clave: string; titulo: string; cantidad: number | null }[]>(
      'casillas',
    )();
    expect(casillas.map((c) => c.clave)).toEqual(CLAVES);
    expect(casillas.map((c) => c.titulo)).toEqual(TITULOS);
    expect(casillas.find((c) => c.clave === 'ordenes')?.cantidad).toBeNull();
    expect(casillas.find((c) => c.clave === 'reconsulta')?.cantidad).toBeNull();
    expect(casillas.find((c) => c.clave === 'diagnosticos')?.cantidad).toBe(2);
    expect(casillas.find((c) => c.clave === 'formulario')?.cantidad).toBeNull();
    // Pagos no lleva cifra: son de la caja y no de las dos lecturas del
    // expediente, y un número pedido acá podría discrepar del que muestra el
    // propio bloque al abrirse.
    expect(casillas.find((c) => c.clave === 'pagos')?.cantidad).toBeNull();

    const botones = harness.routeNativeElement!.querySelectorAll(
      '[data-testid^="consulta-casilla-"]',
    );
    expect(botones).toHaveLength(8);
  });

  /**
   * Pagos es la única casilla que no escribe, y la bajada del modal es la
   * única línea que dice qué va a pasar al confirmar. Prometer que «se
   * registra» ahí sería mentir en el peor lugar posible.
   */
  it('el plan de cuidados exige la respuesta del formulario médico, y viene cargada', async () => {
    await responderLectura({
      encounters: [{ id: 'e-1', statusConceptId: 'st', startAt: '2026-03-01T10:00:00Z' }],
    });
    interno<(key: string) => void>('abrir').call(componente, 'planes');
    await harness.fixture.whenStable();

    const plan = harness.fixture.debugElement.query(By.directive(CarePlanBlock))
      .componentInstance as CarePlanBlock;
    expect(plan.exigeRespuesta()).toBe(true);

    const pedido = http.expectOne(
      (r) =>
        r.method === 'GET' && r.url === '/forms/instances' && r.params.get('encounter') === 'e-1',
    );
    pedido.flush({
      encounterId: 'e-1',
      items: [
        {
          id: 'inst-1',
          resourceId: 'e-1',
          resourceTypeConceptId: 'rt',
          schemaVersion: 1,
          closedAt: '2026-03-01T10:30:00Z',
          createdAt: '2026-03-01T10:05:00Z',
        },
      ],
      limit: 50,
      truncated: false,
    });
    await harness.fixture.whenStable();

    const picker = harness.fixture.debugElement.query(By.directive(FormResponsePicker))
      .componentInstance as FormResponsePicker;
    // Una sola respuesta: elegida sola, y el selector no se puede tocar.
    expect(picker.seleccionada()).toBe('inst-1');
    const selector = harness.routeNativeElement!.querySelector(
      '[data-testid="respuesta-del-formulario"]',
    );
    expect(selector).not.toBeNull();
    expect(selector!.querySelector('[disabled], [aria-disabled="true"]')).not.toBeNull();
  });

  it('destruye el modal al cerrar y permite reabrir la misma casilla de inmediato', async () => {
    await responderLectura();
    const tile = harness.routeNativeElement!.querySelector<HTMLButtonElement>(
      '[data-testid="consulta-casilla-alergias"]',
    )!;
    tile.click();
    await harness.fixture.whenStable();
    const previous = harness.routeNativeElement!.querySelector('dialog')!;
    expect(previous.open).toBe(true);

    harness.routeNativeElement!.querySelector<HTMLButtonElement>('[data-testid="content-dialog-close"]')!.click();
    expect(previous.isConnected).toBe(false);
    tile.click();
    await harness.fixture.whenStable();
    const reopened = harness.routeNativeElement!.querySelector('dialog')!;
    expect(reopened).not.toBe(previous);
    expect(reopened.open).toBe(true);
    expect(harness.routeNativeElement!.querySelectorAll('dialog')).toHaveLength(1);
  });

  it('distingue la reserva de reconsulta de la cita clínica del check-in', async () => {
    await responderLectura();
    componente = await harness.navigateByUrl('/medical-records/p-1/consultation?cita=ap-1&booking=b-1', Consultation);
    expect(interno<() => string | null>('originBookingId')()).toBe('b-1');
    expect(interno<() => string | null>('citaDeOrigen')()).toBe('ap-1');
    componente = await harness.navigateByUrl('/medical-records/p-1/consultation?cita=ap-1', Consultation);
    expect(interno<() => string | null>('originBookingId')()).toBeNull();
  });

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

  /* ---- C8 · «Lo registrado en este encuentro» ----------------------------- */

  const ENCUENTRO_ABIERTO = {
    id: 'e-1',
    statusConceptId: 'st',
    reasonText: 'Dolor de garganta',
    startAt: '2026-03-01T10:00:00.000Z',
  };

  const CONCEPTOS = [
    { conceptId: 'con-dm', code: 'DM2', display: 'Diabetes tipo 2', codeSystemVersionId: 'v1' },
    {
      conceptId: 'ver-confirmado',
      code: 'DXV-CONFIRMED',
      display: 'Diagnóstico confirmado',
      codeSystemVersionId: 'v1',
    },
  ];

  it('la línea del encuentro cuenta lo que se registró en el que está abierto', async () => {
    await responderLectura(
      {
        encounters: [ENCUENTRO_ABIERTO],
        conditions: [
          {
            id: 'c-1',
            codeConceptId: 'con-dm',
            verificationStatusConceptId: 'ver-confirmado',
            encounterId: 'e-1',
            createdAt: '2026-03-01T10:10:00.000Z',
          },
        ],
      },
      {
        notes: [
          {
            noteId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeea1b2',
            encounterId: 'e-1',
            lifecycleStatusConceptId: 'st',
            chiefComplaintText: 'Odinofagia de tres días',
            planText: 'Reposo e hidratación',
            releasedToPatient: false,
            signedAt: '2026-03-01T10:20:00.000Z',
            createdAt: '2026-03-01T10:15:00.000Z',
          },
        ],
      },
      CONCEPTOS,
    );

    const linea = harness.routeNativeElement?.querySelector(
      '[data-testid="consulta-linea-encuentro"]',
    );
    const texto = (linea?.textContent ?? '').replace(/\s+/g, ' ').trim();
    // La nota va aunque NO esté liberada al paciente: ésta es la pantalla de
    // quien la escribió, y esconderle su propio trabajo no tendría sentido.
    expect(texto).toContain('Nota #a1b2');
    expect(texto).toContain('Odinofagia de tres días');
    expect(texto).toContain('Diagnóstico confirmado: Diabetes tipo 2');
    expect(texto).toContain('Atención en curso');
  });

  it('un hecho de otro encuentro no se cuela en la línea del que está abierto', async () => {
    await responderLectura(
      {
        encounters: [
          ENCUENTRO_ABIERTO,
          {
            id: 'e-0',
            statusConceptId: 'st',
            startAt: '2026-02-01T10:00:00.000Z',
            endAt: '2026-02-01T11:00:00.000Z',
          },
        ],
        conditions: [
          {
            id: 'c-9',
            codeConceptId: 'con-dm',
            encounterId: 'e-0',
            createdAt: '2026-02-01T10:10:00.000Z',
          },
        ],
      },
      {},
      CONCEPTOS,
    );

    const linea = harness.routeNativeElement?.querySelector(
      '[data-testid="consulta-linea-encuentro"]',
    );
    // Atribuirle a esta consulta un diagnóstico de la anterior sería un dato
    // clínico falso, no un detalle de presentación.
    expect(linea?.textContent ?? '').not.toContain('Diabetes tipo 2');
    expect(linea?.textContent ?? '').toContain('todavía no quedó nada registrado');
  });

  it('sin encuentro abierto la sección no se dibuja', async () => {
    await responderLectura();

    expect(interno<() => unknown>('loRegistrado')()).toBeNull();
    expect(
      harness.routeNativeElement?.querySelector('[data-testid="consulta-lo-registrado"]'),
    ).toBeNull();
  });

  it('una nota sin firmar se rotula como borrador', async () => {
    await responderLectura(
      { encounters: [ENCUENTRO_ABIERTO] },
      {
        notes: [
          {
            noteId: 'ffffffff-bbbb-4ccc-8ddd-eeeeeeee9999',
            encounterId: 'e-1',
            lifecycleStatusConceptId: 'st',
            chiefComplaintText: 'A medio escribir',
            releasedToPatient: false,
            createdAt: '2026-03-01T10:16:00.000Z',
          },
        ],
      },
      CONCEPTOS,
    );

    const linea = harness.routeNativeElement?.querySelector(
      '[data-testid="consulta-linea-encuentro"]',
    );
    // Firmada y sin firmar no son lo mismo, y quien atiende tiene que poder
    // distinguirlas de un vistazo antes de cerrar la consulta.
    expect(linea?.textContent ?? '').toContain('Borrador #9999');
  });

  it('ningún uuid llega al HTML de la línea del encuentro', async () => {
    await responderLectura(
      { encounters: [ENCUENTRO_ABIERTO] },
      {
        notes: [
          {
            noteId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeea1b2',
            encounterId: 'e-1',
            lifecycleStatusConceptId: 'st',
            chiefComplaintText: 'Odinofagia de tres días',
            releasedToPatient: true,
            createdAt: '2026-03-01T10:15:00.000Z',
          },
        ],
      },
      CONCEPTOS,
    );

    const seccion = harness.routeNativeElement?.querySelector(
      '[data-testid="consulta-lo-registrado"]',
    );
    expect(seccion?.innerHTML ?? '').not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });
});
