import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { CarePlanBlock } from '../patient-chart/care-plan-block/care-plan-block';
import { DiagnosisBlock } from '../patient-chart/diagnosis-block/diagnosis-block';
import { PresuntivoForm } from '../patient-chart/diagnosis-block/presuntivo-form/presuntivo-form';
import { FormResponsePicker } from '../patient-chart/form-response-picker/form-response-picker';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ReferralBlock } from '../patient-chart/referral-block/referral-block';
import { Consultation } from './consultation';
import { CONSULTATION_FORBIDDEN_MESSAGE } from './consultation-forbidden';

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
  // «Derivar» entró el 24/10/2026 por pedido del propietario: recomendar a otro
  // profesional, con aviso a la persona. Va junto a la reconsulta.
  'derivacion',
  'pagos',
];
const TITULOS = [
  'Formulario médico',
  'Orden de análisis',
  'Diagnóstico',
  'Receta',
  'Plan de cuidados',
  'Reconsulta',
  'Derivar',
  'Pagos',
];

/** Una derivación ya emitida, tal como la lista la API. */
const REFERRAL = {
  id: 'ref-1',
  patientProfileId: 'p-1',
  statusConceptId: 'st-solicitada',
  createdAt: '2026-10-20T12:00:00.000Z',
  referralType: 'TREATMENT',
  targetDisplayName: 'Hospital San Lucas',
  targetServiceName: 'Fisioterapia',
};

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
    referrals: readonly object[] = [REFERRAL],
  ): Promise<void> {
    // Las derivaciones van por su lado: la casilla las cuenta.
    http
      .expectOne((r) => r.url === '/referrals' && r.params.get('patientProfileId') === 'p-1')
      .flush(referrals);
    http
      .expectOne((r) => r.url === '/profiles/patients/p-1')
      .flush({ profileId: 'p-1', displayName: 'Ana Pérez', patientCode: 'P1' });
    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush({ ...RESUMEN, ...resumen });
    http.expectOne((r) => r.url === '/charts/patients/p-1/chart').flush({ ...CHART, ...chart });
    // Sin conceptos la etiqueta cae a «Sin registrar»: lo que se prueba acá es
    // la rejilla, no la traducción. Las pruebas de la línea del encuentro sí
    // los mandan, porque ahí el nombre del diagnóstico es lo que se lee.
    http
      .match((r) => r.url === '/terminology/concepts')
      .forEach((req) => req.flush({ items: conceptos, count: conceptos.length, limit: 200 }));
    await harness.fixture.whenStable();
  }

  /** La lectura del expediente cuando las derivaciones ya se respondieron aparte. */
  async function flushChartReadsOnly(): Promise<void> {
    http
      .expectOne((r) => r.url === '/profiles/patients/p-1')
      .flush({ profileId: 'p-1', displayName: 'Ana Pérez', patientCode: 'P1' });
    http.expectOne((r) => r.url === '/clinical/patients/p-1/summary').flush(RESUMEN);
    http.expectOne((r) => r.url === '/charts/patients/p-1/chart').flush(CHART);
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

  it('ofrece las ocho posibilidades en la rejilla, con su cantidad', async () => {
    await responderLectura();

    const casillas =
      interno<() => readonly { clave: string; titulo: string; cantidad: number | null }[]>(
        'casillas',
      )();
    expect(casillas.map((c) => c.clave)).toEqual(CLAVES);
    expect(casillas.map((c) => c.titulo)).toEqual(TITULOS);
    expect(casillas.find((c) => c.clave === 'ordenes')?.cantidad).toBeNull();
    expect(casillas.find((c) => c.clave === 'reconsulta')?.cantidad).toBeNull();
    // Las derivaciones se leen aparte, y la casilla dice cuántas hay.
    expect(casillas.find((c) => c.clave === 'derivacion')?.cantidad).toBe(1);
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

  it('«Derivar» abre su bloque en el modal, con el encabezado y la bajada propios', async () => {
    await responderLectura();

    (componente as unknown as { abrir(clave: string): void }).abrir('derivacion');
    harness.detectChanges();

    expect(interno<() => string>('tituloDelModal')()).toBe(
      'Derivar a otro profesional u organización',
    );
    // La API no dice si el aviso salió (cuenta de portal, destino activo): la
    // bajada no lo promete.
    expect(interno<() => string>('descripcionDelModal')()).toContain(
      'La derivación queda registrada en su historia',
    );
    // Neutral: no contradice al éxito de un destino externo, que no recibe aviso.
    expect(interno<() => string>('descripcionDelModal')()).not.toContain('aviso');
    expect(interno<() => string>('descripcionDelModal')()).toContain('organización médica');
    expect(harness.routeNativeElement!.querySelector('app-referral-block')).not.toBeNull();
    // El bloque recibe la misma lectura que cuenta la casilla.
    http
      .match((r) => r.url === '/terminology/concepts')
      .forEach((req) => req.flush({ items: [], count: 0, limit: 200 }));
    harness.detectChanges();
    expect(
      harness.routeNativeElement!.querySelectorAll('[data-testid="referral-row"]'),
    ).toHaveLength(1);
  });

  it('H07: un 403 al leer la historia deja S5 con el texto del profesional y «Pedir acceso a su historia»', async () => {
    http.expectOne((r) => r.url === '/referrals').flush([]);
    http
      .expectOne((r) => r.url === '/profiles/patients/p-1')
      .flush({ profileId: 'p-1', displayName: 'Ana Pérez', patientCode: 'P1' });
    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush(
        {
          code: 'FORBIDDEN',
          message: 'Sólo puede consultar su propia historia clínica.',
          correlationId: 'req-403',
        },
        { status: 403, statusText: 'Forbidden' },
      );
    // forkJoin cancela la lectura del chart al fallar el resumen.
    http
      .match((r) => r.url === '/charts/patients/p-1/chart')
      .forEach((req) => {
        if (!req.cancelled) req.flush(CHART);
      });
    await harness.fixture.whenStable();
    harness.detectChanges();

    const state = interno<
      () => {
        status: string;
        message?: string;
        requestId?: string;
        nextAction?: { label: string; route?: string };
      }
    >('consulta')();
    expect(state.status).toBe('forbidden');
    expect(state.message).toBe(CONSULTATION_FORBIDDEN_MESSAGE);
    expect(state.requestId).toBe('req-403');
    expect(state.nextAction).toEqual({
      label: 'Pedir acceso a su historia',
      route: '/medical-records/p-1/request-access',
    });

    const text = harness.routeNativeElement!.textContent ?? '';
    expect(text).toContain(CONSULTATION_FORBIDDEN_MESSAGE);
    expect(text).toContain('Pedir acceso a su historia');
    expect(text).not.toContain('Sólo puede consultar su propia historia clínica');
  });

  it('si las derivaciones no se pueden leer, la casilla no inventa un cero y la rejilla sigue', async () => {
    http
      .expectOne((r) => r.url === '/referrals')
      .flush({ code: 'FORBIDDEN', message: '' }, { status: 403, statusText: 'Forbidden' });
    await flushChartReadsOnly();

    const casillas = interno<() => readonly { clave: string; cantidad: number | null }[]>(
      'casillas',
    )();
    expect(casillas.find((c) => c.clave === 'derivacion')?.cantidad).toBeNull();
    expect(casillas.find((c) => c.clave === 'diagnosticos')?.cantidad).toBe(2);
  });

  it('tras derivar relee las derivaciones, y el contador sale de la relectura', async () => {
    await responderLectura({}, {}, [], []);
    expect(
      interno<() => readonly { clave: string; cantidad: number | null }[]>('casillas')().find(
        (c) => c.clave === 'derivacion',
      )?.cantidad,
    ).toBe(0);

    interno<{ reload(): void }>('referrals').reload();
    http.expectOne((r) => r.url === '/referrals').flush([REFERRAL, { ...REFERRAL, id: 'ref-2' }]);

    expect(
      interno<() => readonly { clave: string; cantidad: number | null }[]>('casillas')().find(
        (c) => c.clave === 'derivacion',
      )?.cantidad,
    ).toBe(2);
  });

  /**
   * La alergia se carga como diagnóstico (cliente, 02/10/2026). Ofrecerla acá
   * dejaba un registro que el expediente ya no muestra en ninguna pestaña: lo
   * cargado en la consulta tiene que ser lo que la historia muestra.
   */
  it('no ofrece la alergia como casilla aparte', async () => {
    await responderLectura();

    expect(
      harness.routeNativeElement!.querySelector('[data-testid="consulta-casilla-alergias"]'),
    ).toBeNull();
    expect(
      interno<() => readonly { clave: string }[]>('casillas')().map((c) => c.clave),
    ).not.toContain('alergias');
  });

  /**
   * Cambio de requisito (30/10/2026, pedido del cliente): el médico puede
   * emitir sin haber llenado el formulario médico. La respuesta se **ofrece**,
   * viene cargada y se puede desvincular, pero ya no se exige.
   */
  it('el plan de cuidados ofrece la respuesta del formulario médico, sin exigirla, y viene cargada', async () => {
    await responderLectura({
      encounters: [{ id: 'e-1', statusConceptId: 'st', startAt: '2026-03-01T10:00:00Z' }],
    });
    interno<(key: string) => void>('abrir').call(componente, 'planes');
    await harness.fixture.whenStable();

    const plan = harness.fixture.debugElement.query(By.directive(CarePlanBlock))
      .componentInstance as CarePlanBlock;
    expect(plan.exigeRespuesta()).toBe(false);
    expect(plan.ofreceRespuesta()).toBe(true);

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
    // Una sola respuesta: elegida sola. El selector queda habilitado porque ya
    // no es obligatorio: «Sin formulario médico» es una opción real.
    expect(picker.seleccionada()).toBe('inst-1');
    const selector = harness.routeNativeElement!.querySelector(
      '[data-testid="respuesta-del-formulario"]',
    );
    expect(selector).not.toBeNull();
    expect(selector!.querySelector('[disabled], [aria-disabled="true"]')).toBeNull();
  });

  it('destruye el modal al cerrar y permite reabrir la misma casilla de inmediato', async () => {
    await responderLectura();
    const tile = harness.routeNativeElement!.querySelector<HTMLButtonElement>(
      '[data-testid="consulta-casilla-planes"]',
    )!;
    tile.click();
    await harness.fixture.whenStable();
    const previous = harness.routeNativeElement!.querySelector('dialog')!;
    expect(previous.open).toBe(true);

    harness
      .routeNativeElement!.querySelector<HTMLButtonElement>('[data-testid="content-dialog-close"]')!
      .click();
    expect(previous.isConnected).toBe(false);
    tile.click();
    await harness.fixture.whenStable();
    const reopened = harness.routeNativeElement!.querySelector('dialog')!;
    expect(reopened).not.toBe(previous);
    expect(reopened.open).toBe(true);
    expect(harness.routeNativeElement!.querySelectorAll('dialog')).toHaveLength(1);
  });

  /**
   * El modal de una casilla no tiraba en silencio lo escrito sólo si nadie lo escribía: no
   * tenía guarda de borrador (el expediente sí). Con el alta de un presuntivo, que carga
   * filas de motivos, `Escape` o la X perdían todo sin preguntar.
   */
  describe('cerrar una casilla con algo escrito', () => {
    /**
     * Devuelve el alta del presuntivo, que es quien guarda lo escrito (`hallazgos`,
     * `registrado`): el `DiagnosisBlock` sólo reenvía su `DraftBlock`.
     */
    async function abrirDiagnostico(): Promise<PresuntivoForm> {
      await responderLectura();
      interno<(clave: string) => void>('abrir').call(componente, 'diagnosticos');
      await harness.fixture.whenStable();
      // Lo que el bloque lee al montarse: su tabla y los catálogos del selector.
      http
        .match((r) => r.url === '/clinical/patients/p-1/summary')
        .forEach((r) =>
          r.flush({ patientProfileId: 'p-1', conditions: [], allergies: [], medicationRequests: [], observations: [], encounters: [], careEpisodes: [], limit: 50, truncated: [] }),
        );
      http
        .match((r) => r.url === '/system-context/dynamic-enums')
        .forEach((r) =>
          r.flush({ code: 'x', name: 'x', definitionId: 'd', valueSetId: 'v', allowCustomValue: false, options: [] }),
        );
      http
        .match((r) => r.url === '/terminology/concepts')
        .forEach((r) => r.flush({ items: [], count: 0, limit: 200 }));
      await harness.fixture.whenStable();
      expect(harness.fixture.debugElement.query(By.directive(DiagnosisBlock))).not.toBeNull();
      return harness.fixture.debugElement.query(By.directive(PresuntivoForm))
        .componentInstance as PresuntivoForm;
    }

    it('sin nada escrito se cierra sin preguntar', async () => {
      await abrirDiagnostico();

      expect(interno<() => boolean>('casillaSinCambios')()).toBe(true);
    });

    it('con algo escrito no se cierra solo: pregunta, y si se confirma descarta', async () => {
      const bloque = await abrirDiagnostico();
      (bloque as unknown as { hallazgos: { set(v: string): void } }).hallazgos.set('Cuadro febril');
      harness.fixture.detectChanges();
      expect(interno<() => boolean>('casillaSinCambios')()).toBe(false);

      const confirmar = vi
        .spyOn(TestBed.inject(DialogService), 'confirm')
        .mockResolvedValue(true);
      await interno<() => Promise<void>>('pedirDescarteDeLaCasilla').call(componente);

      expect(confirmar).toHaveBeenCalledOnce();
      expect(confirmar.mock.calls[0]?.[0].message).toContain('Todavía no se registró');
    });

    it('si el diagnóstico ya quedó registrado el aviso no miente y, al descartar, relee la consulta', async () => {
      const bloque = await abrirDiagnostico();
      (bloque as unknown as { registrado: { set(v: unknown): void } }).registrado.set({
        id: 'c-9',
        patientProfileId: 'p-1',
        clinicalStatus: null,
        verificationStatus: null,
        clinicalCourse: null,
        createdAt: new Date(),
      });
      harness.fixture.detectChanges();

      const confirmar = vi
        .spyOn(TestBed.inject(DialogService), 'confirm')
        .mockResolvedValue(true);
      await interno<() => Promise<void>>('pedirDescarteDeLaCasilla').call(componente);

      const mensaje = confirmar.mock.calls[0]?.[0].message ?? '';
      expect(mensaje).toContain('ya quedó registrado');
      expect(mensaje).not.toContain('Todavía no se registró');
      // El servidor ya tiene el diagnóstico: la consulta vuelve a leer sus dos lecturas.
      expect(
        http.match((r) => r.url === '/clinical/patients/p-1/summary').length,
      ).toBeGreaterThanOrEqual(1);
      http.match(() => true);
    });

    it('si se elige «Seguir escribiendo» no se cierra ni se relee', async () => {
      const bloque = await abrirDiagnostico();
      (bloque as unknown as { hallazgos: { set(v: string): void } }).hallazgos.set('Cuadro febril');
      vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(false);

      await interno<() => Promise<void>>('pedirDescarteDeLaCasilla').call(componente);

      expect(interno<() => string | null>('casillaAbierta')()).toBe('diagnosticos');
      http.expectNone((r) => r.url === '/clinical/patients/p-1/summary');
    });
  });

  it('distingue la reserva de reconsulta de la cita clínica del check-in', async () => {
    await responderLectura();
    componente = await harness.navigateByUrl(
      '/medical-records/p-1/consultation?cita=ap-1&booking=b-1',
      Consultation,
    );
    expect(interno<() => string | null>('originBookingId')()).toBe('b-1');
    expect(interno<() => string | null>('citaDeOrigen')()).toBe('ap-1');
    componente = await harness.navigateByUrl(
      '/medical-records/p-1/consultation?cita=ap-1',
      Consultation,
    );
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
    abrir('planes');
    expect(interno<() => string | null>('casillaAbierta')()).toBe('planes');
    expect(interno<() => string>('tituloDelModal')()).toBe('Abrir un plan de cuidados');

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
      code: 'COND_CONFIRMED',
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

  /* ---- Derivar: casilla, cierre con el envío en vuelo y salida al encuentro */

  interface TileUnderTest {
    clave: string;
    cantidad: number | null;
    rotuloDeCantidad: string;
    lecturaDeCantidad: string | null;
  }
  const referralTile = (): TileUnderTest =>
    interno<() => readonly TileUnderTest[]>('casillas')().find((c) => c.clave === 'derivacion')!;

  it('la casilla «Derivar» nombra lo que cuenta: derivaciones, no «en la historia»', async () => {
    await responderLectura({}, {}, [], [REFERRAL, { ...REFERRAL, id: 'ref-2' }]);
    harness.detectChanges();
    expect(referralTile().rotuloDeCantidad).toBe('derivaciones');
    expect(
      interno<() => readonly TileUnderTest[]>('casillas')().find((c) => c.clave === 'diagnosticos')
        ?.rotuloDeCantidad,
    ).toBe('en la historia');
    expect(
      harness.routeNativeElement!.querySelector('[data-testid="consulta-casilla-derivacion"]')?.textContent,
    ).toMatch(/2\s+derivaciones/);
  });

  it('la casilla «Derivar» distingue «leyendo» de «no se pudo leer»', async () => {
    // Antes de responder: se está leyendo.
    expect(referralTile().lecturaDeCantidad).toBe('loading');
    http
      .expectOne((r) => r.url === '/referrals')
      .flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });
    await flushChartReadsOnly();
    harness.detectChanges();
    expect(referralTile().lecturaDeCantidad).toBe('failed');
    const uncounted = harness.routeNativeElement!.querySelector(
      '[data-testid="consulta-casilla-derivacion-uncounted"]',
    );
    expect(uncounted).not.toBeNull();
    // Con tono de aviso, no el gris de «Contando…».
    expect(uncounted?.classList.contains('consulta__casilla-cantidad--fallida')).toBe(true);
  });

  it('las migas no repiten «Consulta» mientras no se conoce el nombre (NG0955)', () => {
    // Antes de leer el perfil, `nombre()` es '' y el título vale «Consulta».
    const labels = interno<() => readonly { label: string }[]>('breadcrumbs')().map((b) => b.label);
    expect(labels.length).toBeGreaterThan(1);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels.at(-1)).toBe('Consulta');
  });

  it('si la relectura falla con cifra, la casilla dice «al menos N» con tono de aviso', async () => {
    await responderLectura({}, {}, [], [REFERRAL]);
    interno<{ reload(): void }>('referrals').reload();
    http
      .expectOne((r) => r.url === '/referrals')
      .flush({ code: 'INTERNAL', message: 'x', correlationId: 'r' }, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();
    expect(referralTile().lecturaDeCantidad).toBe('stale');
    const stalePill = harness.routeNativeElement!.querySelector('[data-testid="consulta-casilla-derivacion-stale"]');
    expect(stalePill?.textContent).toMatch(/al menos\s+1\s+derivación/);
    expect(stalePill?.classList.contains('consulta__casilla-cantidad--fallida')).toBe(true);
  });

  it('cerrar el modal con la derivación en vuelo igual relee la lista y la cifra', async () => {
    await responderLectura({ encounters: [ENCUENTRO_ABIERTO] }, {}, [], []);
    (componente as unknown as { abrir(clave: string): void }).abrir('derivacion');
    harness.detectChanges();
    const block = harness.fixture.debugElement.query(By.directive(ReferralBlock))
      .componentInstance as unknown as Record<string, unknown>;
    const call = <T>(name: string) => (block[name] as (...a: unknown[]) => T).bind(block);

    call('search')('lu');
    http.expectOne((r) => r.url === '/referrals/targets').flush({
      items: [{ kind: 'PRACTITIONER', id: 'hp-1', displayName: 'Dra. Lucía', tenantId: 't', subtitle: null }],
    });
    call('choose')((call<readonly ReferenceOption[]>('targetOptions'))()[0]);
    http.expectOne((r) => r.url === '/referrals/target-services').flush({
      items: [{ id: 's-1', code: 'S', name: 'Servicio', description: null, price: 100, currency: 'BOB', tenantId: 't', practiceName: null }],
    });
    (block['selectedService'] as { set(v: string): void }).set('s-1');
    (block['referralType'] as { set(v: string): void }).set('CONSULTATION');
    call('submit')();
    const post = http.expectOne((r) => r.url === '/referrals' && r.method === 'POST');

    // El médico cierra el modal antes de que vuelva la respuesta.
    interno<() => void>('cerrarCasilla').call(componente);
    expect(harness.routeNativeElement!.querySelector('app-referral-block')).toBeNull();

    post.flush({ id: 'ref-9', patientProfileId: 'p-1', statusConceptId: 'st', createdAt: '2026-10-31T10:00:00Z' });
    http.expectOne((r) => r.url === '/referrals' && r.method === 'GET').flush([REFERRAL]);
    expect(referralTile().cantidad).toBe(1);
  });

  it('sin encuentro, «Ir a abrir el encuentro» cierra el modal y deja el foco en el encuentro', async () => {
    await responderLectura();
    (componente as unknown as { abrir(clave: string): void }).abrir('derivacion');
    harness.detectChanges();
    http
      .match((r) => r.url === '/terminology/concepts')
      .forEach((req) => req.flush({ items: [], count: 0, limit: 200 }));
    harness.detectChanges();

    const ir = harness.routeNativeElement!.querySelector<HTMLElement>('[data-testid="referral-open-encounter"]');
    expect(ir).not.toBeNull();
    ir!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(interno<() => string | null>('casillaAbierta')()).toBeNull();
    // En esta prueba no hay organización activa: «Abrir encuentro» no se puede
    // usar y la sección dice qué falta, así que el foco va a la sección. Con
    // organización, va al botón (`enfocarAperturaDelEncuentro`).
    expect(document.activeElement).toBe(
      harness.routeNativeElement!.querySelector('[data-testid="consulta-encuentro"]'),
    );
  });
});
