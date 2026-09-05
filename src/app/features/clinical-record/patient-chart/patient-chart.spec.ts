import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../core/auth/session.store';
import type { ClinicalSummary } from '../../../core/data-access/clinical/clinical.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import {
  bloquesDeAtencion,
  bloquesDeReceta,
} from '../../../shared/utils/clinical-pdf/clinical-pdf';
import {
  atencionDesdeResumen,
  recetaDesdeResumen,
  type ContextoDelDocumento,
} from '../../../shared/utils/clinical-pdf/from-summary';
import { PatientChart } from './patient-chart';

/**
 * El expediente de una persona. Lo que estas pruebas fijan:
 *
 * 1. **Las dos lecturas son obligatorias.** Media historia clínica no se
 *    distingue de una completa sin antecedentes, y esa confusión en clínica no
 *    es cosmética.
 * 2. **El nombre es opcional.** `GET /profiles/patients/:id` pide
 *    `SECURITY_ADMIN`; un 403 ahí no puede llevarse puesto el expediente.
 * 3. **Lo recortado se dice.** `truncated` nombra bloques, y callarlo se lee
 *    como «no hay antecedentes».
 * 4. **Ningún uuid llega a la pantalla.** Todo `*ConceptId` se traduce, y lo que
 *    el catálogo no conozca se muestra como ausencia, no como identificador.
 */

const RESUMEN = {
  patientProfileId: 'p-1',
  conditions: [
    {
      id: 'c-1',
      codeConceptId: 'con-diabetes',
      clinicalStatusConceptId: 'st-activa',
      createdAt: '2026-01-03T00:00:00.000Z',
    },
  ],
  allergies: [],
  medicationRequests: [],
  observations: [
    {
      id: 'o-1',
      codeConceptId: 'obs-peso',
      statusConceptId: 'st-final',
      quantityValue: '78.5',
      quantityUnitConceptId: 'u-kg',
    },
  ],
  encounters: [],
  limit: 50,
  truncated: [],
};

const CHART = {
  patientProfileId: 'p-1',
  notes: [],
  carePlans: [],
  documents: [],
  limit: 50,
  truncated: [],
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

/** Un encuentro recién abierto: `endAt` llega `null`, no ausente. */
const ENCUENTRO_ABIERTO = {
  id: 'e-1',
  patientProfileId: 'p-1',
  episodeId: null,
  status: 'st-activa',
  participantIds: [],
  locationIds: [],
  startAt: '2026-03-01T10:00:00.000Z',
  endAt: null,
  createdAt: '2026-03-01T10:00:00.000Z',
};

const HACE_UNA_HORA = '2026-03-01T10:00:00.000Z';

const CONCEPTOS = {
  items: [
    {
      conceptId: 'con-diabetes',
      code: 'E11',
      display: 'Diabetes tipo 2',
      codeSystemVersionId: 'v1',
    },
    { conceptId: 'st-activa', code: 'ACTIVE', display: 'Activa', codeSystemVersionId: 'v1' },
    { conceptId: 'obs-peso', code: '29463-7', display: 'Peso corporal', codeSystemVersionId: 'v1' },
    { conceptId: 'st-final', code: 'FINAL', display: 'Final', codeSystemVersionId: 'v1' },
    { conceptId: 'u-kg', code: 'kg', display: 'kg', codeSystemVersionId: 'v1' },
  ],
  count: 5,
  limit: 200,
};

describe('PatientChart', () => {
  let harness: RouterTestingHarness;
  let componente: PatientChart;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'medical-records/:profileId', component: PatientChart }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl('/medical-records/p-1', PatientChart);
  });

  /**
   * Los bloques de medicación y de diagnóstico preguntan por su catálogo
   * apenas se crean, y esas peticiones aparecen en cualquier prueba que llegue
   * a pintar el expediente.
   *
   * Se responden con el `404` de «sin binding declarado» para que `verify()`
   * no tropiece con ellas. Lo que cada bloque hace con esa respuesta lo fijan
   * sus propias pruebas: acá sólo importa que no se cuelen como peticiones
   * huérfanas del expediente.
   */
  /**
   * Los favoritos que el bloque de medicación pide al montarse (v4.1.7).
   *
   * Se drenan vacíos: son una comodidad de captura del profesional y no
   * intervienen en nada de lo que esta pantalla afirma.
   */
  function responderFavoritosDeReceta(): void {
    for (const req of http.match((r) => r.url === '/prescription-favorites')) {
      req.flush([]);
    }
  }

  function responderCatalogoDeMedicacion(): void {
    for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      req.flush(
        { code: 'NOT_FOUND', message: 'Enumeración no encontrada', timestamp: '', path: '' },
        { status: 404, statusText: 'Not Found' },
      );
    }
  }

  /**
   * El bloque de laboratorio e imagenología lee **lo suyo**, a diferencia del de
   * medicación, al que el expediente le baja las recetas ya hechas.
   *
   * Y es a propósito: el circuito diagnóstico no sale de
   * `GET /clinical/patients/:id/summary` —es otro módulo y otra lectura—, así
   * que el bloque la hace suya y el expediente no cambia por eso. El precio es
   * esta petición, que aparece en cualquier prueba que llegue a pintar la ficha
   * y que acá sólo hay que drenar: lo que el bloque hace con la respuesta lo
   * fijan sus propias pruebas.
   */
  function responderCircuitoDiagnostico(): void {
    for (const req of http.match((r) => r.url.startsWith('/diagnostics/patients/'))) {
      req.flush({
        patientProfileId: 'p-1',
        orders: [],
        reports: [],
        limit: 25,
        truncated: [],
      });
    }
  }

  /**
   * El histórico de procedimientos lee lo suyo, por el mismo motivo que el
   * circuito diagnóstico: cirugías y odontología son otro módulo y no salen de
   * `GET /clinical/patients/:id/summary`.
   *
   * Son tres peticiones y no una porque las dos mitades del bloque tienen
   * permisos distintos —de ahí que no vayan en un `forkJoin`— y el catálogo
   * odontológico es una lectura aparte. Acá sólo se drenan: lo que el bloque
   * hace con cada respuesta lo fijan sus propias pruebas.
   */
  function responderHistoricoDeProcedimientos(): void {
    for (const req of http.match((r) => r.url === '/procedure-cases')) {
      req.flush({ items: [], total: 0 });
    }
    for (const req of http.match((r) => r.url === '/dental-procedures')) {
      req.flush({ items: [], total: 0 });
    }
    for (const req of http.match((r) => r.url === '/dental-procedures/catalog')) {
      req.flush({ procedureCodes: [], teeth: [], quadrants: [] });
    }
  }

  /**
   * `specialty-form-block` pregunta por las plantillas de chart apenas se
   * crea, igual que medicación pregunta por su catálogo. Se responde vacío
   * —«sin plantillas todavía»— para que `verify()` no tropiece con ella; lo
   * que el bloque hace con esa respuesta lo fija su propia prueba.
   */
  function responderPlantillasDeEspecialidad(): void {
    for (const req of http.match((r) => r.url === '/charts/templates')) {
      req.flush([]);
    }
  }

  /**
   * El perfil profesional de quien atiende, que el bloque de formularios pide
   * para preseleccionar la plantilla de su especialidad. Responde 404 —la
   * sesión de las pruebas no ejerce ninguna—, que es el caso que el bloque ya
   * sabe manejar sin romperse.
   */
  function responderPerfilProfesional(): void {
    for (const req of http.match(
      (r) => r.url === '/profiles/practitioners/me/summary',
    )) {
      req.flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    }
  }

  /**
   * El mismo perfil, pero **respondido**: es de donde sale la matrícula que
   * firma el papel. Contesta todas las peticiones pendientes a ese recurso —el
   * expediente pide la suya y el bloque de formularios la propia— con el mismo
   * cuerpo, que es lo que haría el backend.
   */
  function responderPerfilPropio(perfil: Record<string, unknown>): void {
    const pedidos = http.match((r) => r.url === '/profiles/practitioners/me/summary');
    expect(pedidos.length).toBeGreaterThan(0);
    for (const req of pedidos) {
      req.flush(perfil);
    }
  }

  afterEach(() => {
    responderCatalogoDeMedicacion();
    responderCircuitoDiagnostico();
    responderHistoricoDeProcedimientos();
    responderPlantillasDeEspecialidad();
    responderPerfilProfesional();
    responderFavoritosDeReceta();
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /**
   * Una señal escribible, **sin `bind`**.
   *
   * `interno` liga las funciones al componente, y `bind` devuelve una función
   * nueva que no conserva las propiedades de la original: la señal ligada se
   * puede leer pero pierde su `.set`. Para escribir hace falta la señal tal cual.
   */
  function señal<T>(nombre: string): WritableSignal<T> {
    return (componente as unknown as Record<string, WritableSignal<T>>)[nombre];
  }

  function motivo(): WritableSignal<string> {
    return señal<string>('motivo');
  }

  /** Abre sesión con organización activa: sin ella no hay encuentro que registrar. */
  function abrirSesion(claims: Record<string, unknown> = {}): void {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({
        sub: 'u-1',
        roles: ['PRACTITIONER'],
        tenants: ['t-1'],
        ...claims,
      }),
      refreshToken: 'r-1',
    });
  }

  function estado() {
    return interno<() => { status: string }>('expediente')();
  }

  /** Responde el nombre del paciente. Es la lectura cosmética y va aparte. */
  function responderNombre(prohibido = false): void {
    const req = http.expectOne((r) => r.url === '/profiles/patients/p-1');
    if (prohibido) {
      req.flush(
        { code: 'FORBIDDEN', message: 'Rol insuficiente', timestamp: '', path: '' },
        { status: 403, statusText: 'Forbidden' },
      );
      return;
    }
    req.flush({
      profileId: 'p-1',
      personId: 'per-1',
      patientCode: 'PAC-1',
      displayName: 'Andrea Peña Rojas',
      relatedPersons: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  }

  function responderExpediente(
    opciones: { resumen?: object; chart?: object; conceptos?: object } = {},
  ): void {
    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush({ ...RESUMEN, ...opciones.resumen });
    http
      .expectOne((r) => r.url === '/charts/patients/p-1/chart')
      .flush({ ...CHART, ...opciones.chart });
    http.expectOne((r) => r.url === '/terminology/concepts').flush(opciones.conceptos ?? CONCEPTOS);
  }

  it('pide las dos lecturas con el tope por bloque', () => {
    responderNombre();

    const resumen = http.expectOne((r) => r.url === '/clinical/patients/p-1/summary');
    expect(resumen.request.params.get('limit')).toBe('50');
    resumen.flush(RESUMEN);

    const chart = http.expectOne((r) => r.url === '/charts/patients/p-1/chart');
    expect(chart.request.params.get('limit')).toBe('50');
    chart.flush(CHART);

    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);

    expect(estado().status).toBe('ready');
  });

  it('traduce los conceptos: ningún uuid queda en pantalla', () => {
    responderNombre();
    responderExpediente();

    const diagnostico = interno<() => readonly Record<string, unknown>[]>('diagnosticos')()[0];
    expect(diagnostico['principal']).toBe('Diabetes tipo 2');
    expect(diagnostico['estado']).toBe('Activa');
  });

  /**
   * ALV-033: adjuntar un archivo a un diagnóstico YA registrado, no sólo al
   * recién creado por `app-diagnosis-block`. Es fila por fila —no una señal
   * compartida— porque el expediente puede listar varios diagnósticos a la vez.
   */
  describe('adjuntar un archivo a un diagnóstico ya registrado (ALV-033)', () => {
    it('alternarAdjuntos abre y cierra el subidor de ESA fila', () => {
      responderNombre();
      responderExpediente();

      expect(interno<() => string | null>('adjuntandoArchivoA')()).toBeNull();

      interno<(id: string) => void>('alternarAdjuntos')('c-1');
      expect(interno<() => string | null>('adjuntandoArchivoA')()).toBe('c-1');

      interno<(id: string) => void>('alternarAdjuntos')('c-1');
      expect(interno<() => string | null>('adjuntandoArchivoA')()).toBeNull();
    });

    it('el vínculo del adjunto pasa por `clinical`, no por el genérico de `common`', () => {
      responderNombre();
      responderExpediente();

      const enlazar =
        interno<(fileId: string, conditionId: string) => { subscribe: (o: unknown) => void }>(
          'enlazarAdjuntoAlDiagnostico',
        );
      enlazar('file-1', 'c-1').subscribe({ next: () => undefined });

      http
        .expectOne('/clinical/conditions/c-1/attachments')
        .flush({ id: 'link-1', fileId: 'file-1', ownerId: 'c-1', createdAt: '2026-01-01' });
    });
  });

  /**
   * Cinco caminos excluyentes para el valor de una observación. Con cantidad y
   * unidad, la unidad acompaña al número — mostrarlos separados obligaría a
   * leer dos columnas para saber si son 78 kilos o 78 libras.
   */
  it('la observación con cantidad muestra el número con su unidad', () => {
    responderNombre();
    responderExpediente();

    const observacion = interno<() => readonly Record<string, unknown>[]>('observaciones')()[0];
    expect(observacion['secundario']).toBe('78.5 kg');
  });

  /* ---- la banda de contexto --------------------------------------------- */

  /**
   * Las alergias salen de la segunda pestaña y suben a la banda.
   *
   * Es el único bloque que cambia una conducta **antes** de leerlo: recetar sin
   * haberlas visto es el error que la banda existe para evitar, y en una pestaña
   * había que acordarse de ir a mirarlas.
   */
  it('destaca las alergias fuera de las pestañas', () => {
    responderNombre();
    responderExpediente({
      resumen: {
        allergies: [
          {
            id: 'a-1',
            substanceConceptId: 'con-diabetes',
            clinicalStatusConceptId: 'st-activa',
            criticalityConceptId: 'st-final',
            createdAt: '2026-02-01T00:00:00.000Z',
          },
        ],
      },
    });

    const destacadas = interno<() => readonly Record<string, unknown>[]>('alergiasDestacadas')();
    expect(destacadas).toHaveLength(1);
    expect(destacadas[0]['principal']).toBe('Diabetes tipo 2');
  });

  it('sin alergias no dibuja la banda de alergias', () => {
    responderNombre();
    responderExpediente();

    expect(interno<() => readonly unknown[]>('alergiasDestacadas')()).toHaveLength(0);
  });

  /** Cuánto expediente hay, sin abrir pestaña por pestaña. */
  it('cuenta los bloques en la banda de contexto', () => {
    responderNombre();
    responderExpediente();

    const cifras = interno<() => readonly { clave: string; valor: number }[]>('cifras')();
    expect(cifras.find((c) => c.clave === 'diagnosticos')?.valor).toBe(1);
    expect(cifras.find((c) => c.clave === 'observaciones')?.valor).toBe(1);
    expect(cifras.find((c) => c.clave === 'medicacion')?.valor).toBe(0);
  });

  /**
   * Sin encuentros no se afirma «sin atención previa»: el bloque puede venir
   * recortado, o la atención puede constar en otra organización.
   */
  it('sin encuentros no inventa una última atención', () => {
    responderNombre();
    responderExpediente();

    expect(interno<() => Date | null>('ultimaAtencion')()).toBeNull();
  });

  it('la última atención es la más reciente de los encuentros', () => {
    responderNombre();
    responderExpediente({
      resumen: {
        encounters: [
          { id: 'e-1', classConceptId: 'st-activa', startAt: '2026-01-10T10:00:00.000Z' },
          { id: 'e-2', classConceptId: 'st-activa', startAt: '2026-05-20T10:00:00.000Z' },
          { id: 'e-3', classConceptId: 'st-activa', startAt: '2026-03-02T10:00:00.000Z' },
        ],
      },
    });

    expect(interno<() => Date | null>('ultimaAtencion')()?.toISOString()).toBe(
      '2026-05-20T10:00:00.000Z',
    );
  });

  /* ---- columnas por bloque ----------------------------------------------- */

  /**
   * Una columna «Detalle» vacía de punta a punta se lee como un dato que no
   * cargó, y se come el ancho que la tabla necesita para lo que sí trae.
   */
  it('el bloque sin detalle no dibuja la columna Detalle', () => {
    responderNombre();
    responderExpediente();

    const bloques =
      interno<() => readonly { clave: string; columnas: { key: string }[] }[]>('bloques')();
    const diagnosticos = bloques.find((b) => b.clave === 'diagnosticos');
    expect(diagnosticos?.columnas.some((c) => c.key === 'detalle')).toBe(false);
    // Las tres que siempre están, más `acciones` (Patch v4.0.8: sólo diagnósticos).
    expect(diagnosticos?.columnas.map((c) => c.key)).toEqual([
      'principal',
      'estado',
      'cuando',
      'acciones',
    ]);
  });

  it('el bloque que sí trae detalle la dibuja', () => {
    responderNombre();
    responderExpediente({
      resumen: {
        encounters: [
          {
            id: 'e-1',
            classConceptId: 'st-activa',
            startAt: '2026-01-10T10:00:00.000Z',
            // Con `endAt` el detalle dice «Cerrado»: hay algo que mostrar.
            endAt: '2026-01-10T11:00:00.000Z',
          },
        ],
      },
    });

    const bloques =
      interno<() => readonly { clave: string; columnas: { key: string }[] }[]>('bloques')();
    expect(
      bloques.find((b) => b.clave === 'encuentros')?.columnas.some((c) => c.key === 'detalle'),
    ).toBe(true);
  });

  it('un 403 al leer el nombre no tumba el expediente', () => {
    responderNombre(true);
    responderExpediente();

    expect(estado().status).toBe('ready');
    expect(interno<() => string>('titulo')()).toBe('Expediente clínico');
  });

  it('con nombre leído, el encabezado lo usa', () => {
    responderNombre();
    responderExpediente();

    expect(interno<() => string>('titulo')()).toBe('Andrea Peña Rojas');
  });

  it('un fallo del catálogo degrada las etiquetas pero no el expediente', () => {
    responderNombre();
    http.expectOne((r) => r.url === '/clinical/patients/p-1/summary').flush(RESUMEN);
    http.expectOne((r) => r.url === '/charts/patients/p-1/chart').flush(CHART);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(estado().status).toBe('ready');
    expect(
      interno<() => readonly Record<string, unknown>[]>('diagnosticos')()[0]['principal'],
    ).toBe('Sin registrar');
  });

  /**
   * El `forkJoin` cancela la lectura hermana en cuanto una falla, así que la
   * del expediente narrativo queda abortada y **no se responde**: intentarlo
   * fallaría con «Cannot flush a cancelled request». Es el comportamiento
   * correcto —media historia no sirve— y por eso la prueba lo refleja en vez de
   * forzar la respuesta.
   */
  it('un 403 en el expediente sí es S5: es lo que se vino a ver', () => {
    responderNombre(true);
    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush(
        { code: 'FORBIDDEN', message: 'Rol insuficiente', timestamp: '', path: '' },
        { status: 403, statusText: 'Forbidden' },
      );

    expect(estado().status).toBe('forbidden');
    http.expectOne((r) => r.url === '/charts/patients/p-1/chart');
  });

  it('nombra en palabras los bloques que quedaron recortados', () => {
    responderNombre();
    responderExpediente({
      resumen: { truncated: ['observations'] },
      chart: { truncated: ['notes'] },
    });

    expect(interno<() => string>('recorte')()).toBe('observaciones, notas');
  });

  it('sin recorte no dice nada', () => {
    responderNombre();
    responderExpediente();

    expect(interno<() => string>('recorte')()).toBe('');
  });

  it('un bloque vacío ofrece salida, no un vacío mudo', () => {
    responderNombre();
    responderExpediente();

    const vacio = interno<
      (
        filas: readonly unknown[],
        titulo: string,
      ) => { status: string; nextAction?: { label: string } }
    >('estadoDe')([], 'Alergias');
    expect(vacio.status).toBe('empty');
    expect(vacio.nextAction?.label).toBe('Elegir otra persona');
  });

  /* ---- el encuentro: la única escritura de la pantalla -------------------- */

  it('sin organización activa no ofrece registrar: `tenantId` es obligatorio', () => {
    responderNombre();
    responderExpediente();

    expect(interno<() => boolean>('sinOrganizacion')()).toBe(true);
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);
  });

  it('con el expediente todavía sin leer no se puede registrar a ciegas', () => {
    abrirSesion();
    responderNombre();

    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);

    responderExpediente();
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(true);
  });

  it('registrar abre el encuentro con el paciente de la ruta y la organización activa', () => {
    abrirSesion();
    responderNombre();
    responderExpediente();

    motivo().set('Dolor abdominal');
    interno<() => void>('registrarEncuentro')();

    const req = http.expectOne('/clinical/encounters/check-in');
    expect(req.request.body).toEqual({
      patientProfileId: 'p-1',
      tenantId: 't-1',
      reasonText: 'Dolor abdominal',
    });
    req.flush(ENCUENTRO_ABIERTO);

    // Releer no es opcional: el encuentro recién abierto tiene que aparecer en
    // su bloque, o la pantalla afirmaría un registro que no muestra.
    responderNombre();
    responderExpediente();
    expect(estado().status).toBe('ready');
  });

  /**
   * El vínculo con el turno. `?cita=` trae el `appointmentId` de la reserva, que
   * es una clave foránea real hacia `clinical.appointments`.
   */
  it('manda la cita de origen cuando se llegó desde la agenda', async () => {
    abrirSesion();
    responderNombre();
    responderExpediente();

    // Se llega con el turno puesto, como hace el enlace de la agenda. Mismo
    // paciente, así que el expediente no se relee: sólo cambian los parámetros.
    await harness.navigateByUrl('/medical-records/p-1?cita=ap-1&motivo=Control');

    interno<() => void>('registrarEncuentro')();

    const req = http.expectOne('/clinical/encounters/check-in');
    expect(req.request.body).toEqual({
      patientProfileId: 'p-1',
      tenantId: 't-1',
      reasonText: 'Control',
      appointmentId: 'ap-1',
    });
    req.flush(ENCUENTRO_ABIERTO);

    responderNombre();
    responderExpediente();
  });

  /**
   * Un encuentro sin profesional es una marca de tiempo sin autor. El dato sale
   * del claim `hpid`, que existe justamente porque no hay lectura que lo dé.
   */
  it('manda al profesional de la sesión como responsable', () => {
    abrirSesion({ hpid: 'hp-1' });
    responderNombre();
    responderExpediente();

    interno<() => void>('registrarEncuentro')();

    const req = http.expectOne('/clinical/encounters/check-in');
    expect((req.request.body as Record<string, unknown>)['primaryPractitionerId']).toBe('hp-1');
    req.flush(ENCUENTRO_ABIERTO);

    responderNombre();
    responderExpediente();
  });

  it('una cuenta sin perfil profesional no manda responsable', () => {
    abrirSesion();
    responderNombre();
    responderExpediente();

    interno<() => void>('registrarEncuentro')();

    const req = http.expectOne('/clinical/encounters/check-in');
    expect(req.request.body).not.toHaveProperty('primaryPractitionerId');
    req.flush(ENCUENTRO_ABIERTO);

    responderNombre();
    responderExpediente();
  });

  /**
   * Una cadena vacía sería un motivo registrado que no dice nada, y se lee peor
   * que su ausencia — el contrato lo declara opcional.
   */
  it('un motivo en blanco no viaja', () => {
    abrirSesion();
    responderNombre();
    responderExpediente();

    motivo().set('   ');
    interno<() => void>('registrarEncuentro')();

    const req = http.expectOne('/clinical/encounters/check-in');
    expect(Object.keys(req.request.body as object).sort()).toEqual([
      'patientProfileId',
      'tenantId',
    ]);
    req.flush(ENCUENTRO_ABIERTO);

    responderNombre();
    responderExpediente();
  });

  it('sólo los encuentros sin fin están en curso', () => {
    abrirSesion();
    responderNombre();
    responderExpediente({
      resumen: {
        encounters: [
          {
            id: 'e-1',
            statusConceptId: 'st-activa',
            reasonText: 'Control',
            startAt: HACE_UNA_HORA,
          },
          {
            id: 'e-2',
            statusConceptId: 'st-activa',
            reasonText: 'Anterior',
            startAt: HACE_UNA_HORA,
            endAt: HACE_UNA_HORA,
          },
        ],
      },
    });

    const enCurso = interno<() => readonly Record<string, unknown>[]>('encuentrosEnCurso')();
    expect(enCurso.map((e) => e['id'])).toEqual(['e-1']);
    expect(enCurso[0]['motivo']).toBe('Control');
  });

  /**
   * El `422` de «el encuentro no está en curso» llega como validación con su
   * código. Se reconoce por el código y no por el mensaje —que es texto humano
   * y puede cambiar de redacción— y la salida que se ofrece es recargar, que es
   * la única que sirve.
   */
  it('traduce el 422 de un encuentro que ya no está en curso', () => {
    abrirSesion();
    responderNombre();
    responderExpediente();

    señal<ViewState<null>>('registro').set(
      errorToViewState<null>(
        new HttpErrorResponse({
          status: 422,
          statusText: 'Unprocessable Entity',
          error: {
            code: 'PRECONDITION_FAILED',
            message: 'El encuentro no está en curso',
            timestamp: '',
            path: '',
          },
        }),
      ),
    );

    expect(interno<() => string | null>('errorDelRegistro')()).toContain('Recargá el expediente');
  });

  /* ---- lo que baja al bloque de medicación -------------------------------- */

  /**
   * «Firmada» y «emitida» salen de `signedAt` e `issuedAt`, no del estado: el
   * estado es un uuid de concepto, y ramificar por su valor ataría la pantalla
   * a un identificador de catálogo.
   */
  it('resuelve el ciclo de cada receta por sus instantes, no por su estado', () => {
    abrirSesion();
    responderNombre();
    responderExpediente({
      resumen: {
        medicationRequests: [
          {
            id: 'rx-1',
            medicationConceptId: 'con-diabetes',
            statusConceptId: 'st-activa',
            doseText: '500 mg',
            frequencyText: 'cada 8 horas',
            createdAt: HACE_UNA_HORA,
          },
          {
            id: 'rx-2',
            medicationConceptId: 'con-diabetes',
            statusConceptId: 'st-activa',
            signedAt: HACE_UNA_HORA,
            issuedAt: HACE_UNA_HORA,
            createdAt: HACE_UNA_HORA,
          },
        ],
      },
    });

    const recetas = interno<() => readonly Record<string, unknown>[]>('recetas')();
    expect(recetas[0]['firmada']).toBe(false);
    expect(recetas[0]['emitida']).toBe(false);
    // Y traducida: ningún uuid baja al bloque.
    expect(recetas[0]['medicamento']).toBe('Diabetes tipo 2');
    expect(recetas[0]['indicacion']).toBe('500 mg · cada 8 horas');
    expect(recetas[1]['firmada']).toBe(true);
    expect(recetas[1]['emitida']).toBe(true);
  });

  it('sin encuentro abierto no baja ninguno: la receta vive dentro de la consulta', () => {
    abrirSesion();
    responderNombre();
    responderExpediente();

    expect(interno<() => string | null>('encuentroParaRecetar')()).toBeNull();
  });

  it('con un encuentro en curso, es ese el que recibe la receta', () => {
    abrirSesion();
    responderNombre();
    responderExpediente({
      resumen: {
        encounters: [{ id: 'e-1', statusConceptId: 'st-activa', startAt: HACE_UNA_HORA }],
      },
    });

    expect(interno<() => string | null>('encuentroParaRecetar')()).toBe('e-1');
  });

  /* ---- quién firma el papel ----------------------------------------------
     El motor del PDF sabe imprimir «Matrícula:» y «Organización:» desde el
     primer día: sólo las imprime si le llegan, y el contexto de esta pantalla
     viajaba con paciente y profesional y nada más. Se prueba sobre el texto
     del documento —no sobre el objeto de contexto— porque lo que estaba mal
     era el papel, y `jsPDF` no participa: `bloquesDeReceta` decide qué dice el
     documento y el render tiene sus propias pruebas. */

  /** La indicación ya convertida, tal como la deja el cliente HTTP. */
  const INDICACION_GUARDADA = {
    id: 'rx-1',
    medicationConceptId: 'con-diabetes',
    statusConceptId: 'st-activa',
    doseText: '500 mg',
    frequencyText: 'cada 8 horas',
    createdAt: new Date('2026-03-01T10:30:00.000Z'),
  };

  /** El perfil profesional de quien mira el expediente, con su matrícula. */
  function perfilConMatriculas(licenses: readonly Record<string, unknown>[]) {
    return {
      profileId: 'hp-1',
      personId: 'per-9',
      practitionerCode: 'PRAC-1',
      displayName: 'Dra. Salas',
      practitionerCategoryConceptId: 'cat-1',
      verificationStatusConceptId: 'st-activa',
      practiceStatusConceptId: 'st-activa',
      acceptsNewPatients: true,
      telehealthAvailable: false,
      specialties: [],
      credentials: [],
      licenses,
      languages: [],
      affiliations: [],
      activity: { encounters: 0, medicationRequests: 0, clinicalNotes: 0, documents: 0 },
      createdAt: '2026-01-01T00:00:00.000Z',
    };
  }

  const MATRICULA_VIGENTE = {
    id: 'lic-1',
    jurisdictionConceptId: 'st-activa',
    licenseNumber: 'MP 4821',
    stateConceptId: 'st-activa',
  };

  /** El texto entero de la receta que esta pantalla genera. */
  function papelDeLaReceta(): string {
    const contexto = interno<() => ContextoDelDocumento>('contextoDelDocumento')();
    return bloquesDeReceta(
      recetaDesdeResumen(INDICACION_GUARDADA, contexto, (id) => id ?? ''),
    )
      .map((bloque) => bloque.text)
      .join('\n');
  }

  it('la receta imprime la matrícula del profesional y la organización', () => {
    abrirSesion({
      hpid: 'hp-1',
      name: 'Dra. Salas',
      tenantNames: { 't-1': 'Hospital Central' },
    });
    TestBed.tick(); // el perfil propio se pide en un effect, al abrirse la sesión
    responderPerfilPropio(perfilConMatriculas([MATRICULA_VIGENTE]));
    responderNombre();
    responderExpediente();

    const texto = papelDeLaReceta();
    expect(texto).toContain('Profesional: Dra. Salas');
    expect(texto).toContain('Matrícula: MP 4821');
    expect(texto).toContain('Organización: Hospital Central');
    expect(texto).not.toContain('undefined');
  });

  /**
   * La historia de la atención comparte el contexto con la receta, así que la
   * cabecera tiene que decir lo mismo: el mismo hecho clínico no puede salir
   * firmado en un papel y anónimo en el otro.
   */
  it('la historia de la atención lleva la misma firma que la receta', () => {
    abrirSesion({
      hpid: 'hp-1',
      name: 'Dra. Salas',
      tenantNames: { 't-1': 'Hospital Central' },
    });
    TestBed.tick();
    responderPerfilPropio(perfilConMatriculas([MATRICULA_VIGENTE]));
    responderNombre();
    responderExpediente({
      resumen: {
        encounters: [{ id: 'e-1', statusConceptId: 'st-activa', startAt: HACE_UNA_HORA }],
      },
    });

    const contexto = interno<() => ContextoDelDocumento>('contextoDelDocumento')();
    const datos = interno<() => { resumen: ClinicalSummary } | null>('datos')();
    const encuentro = datos!.resumen.encounters[0]!;
    const texto = bloquesDeAtencion(
      atencionDesdeResumen(encuentro, datos!.resumen, contexto, (id) => id ?? ''),
    )
      .map((bloque) => bloque.text)
      .join('\n');

    expect(texto).toContain('Matrícula: MP 4821');
    expect(texto).toContain('Organización: Hospital Central');
  });

  /**
   * Sin el dato no hay renglón: ni «Matrícula: » colgando ni un `undefined`
   * impreso. Y sin nombre de organización tampoco se imprime su identificador
   * —un uuid en un papel clínico no le dice nada a quien lo lee—.
   */
  it('sin matrícula ni nombre de organización no imprime renglones vacíos', () => {
    abrirSesion({ hpid: 'hp-1', name: 'Dra. Salas' });
    TestBed.tick();
    responderPerfilPropio(perfilConMatriculas([]));
    responderNombre();
    responderExpediente();

    const texto = papelDeLaReceta();
    expect(texto).toContain('Profesional: Dra. Salas');
    expect(texto).not.toContain('Matrícula');
    expect(texto).not.toContain('Organización');
    expect(texto).not.toContain('undefined');
    // El tenant activo existe, pero el token no trae su nombre: se calla.
    expect(texto).not.toContain('t-1');
  });

  /**
   * Vigente es una ventana, no una bandera: una matrícula real se renueva y por
   * eso declara vencimiento. Descartarla por traerlo dejaría sin firma justo a
   * quien la tiene en regla.
   */
  it('una matrícula con vencimiento futuro sigue firmando el papel', () => {
    abrirSesion({ hpid: 'hp-1', name: 'Dra. Salas' });
    TestBed.tick();
    responderPerfilPropio(
      perfilConMatriculas([{ ...MATRICULA_VIGENTE, validTo: '2030-12-31T00:00:00.000Z' }]),
    );
    responderNombre();
    responderExpediente();

    expect(papelDeLaReceta()).toContain('Matrícula: MP 4821');
  });

  /** Una matrícula caducada no habilita a nadie: firmar con ella es peor que no firmar. */
  it('una matrícula vencida no firma el papel', () => {
    abrirSesion({ hpid: 'hp-1', name: 'Dra. Salas' });
    TestBed.tick();
    responderPerfilPropio(
      perfilConMatriculas([{ ...MATRICULA_VIGENTE, validTo: '2025-12-31T00:00:00.000Z' }]),
    );
    responderNombre();
    responderExpediente();

    expect(papelDeLaReceta()).not.toContain('Matrícula');
  });

  /**
   * La ventana tiene dos extremos. Una matrícula ya cargada pero que habilita
   * recién dentro de un mes no habilita hoy: imprimirla afirma una habilitación
   * que todavía no existe, que es el mismo daño que firmar con una vencida.
   */
  it('una matrícula que todavía no entró en vigencia no firma el papel', () => {
    abrirSesion({ hpid: 'hp-1', name: 'Dra. Salas' });
    TestBed.tick();
    responderPerfilPropio(
      perfilConMatriculas([{ ...MATRICULA_VIGENTE, validFrom: '2030-01-01T00:00:00.000Z' }]),
    );
    responderNombre();
    responderExpediente();

    expect(papelDeLaReceta()).not.toContain('Matrícula');
  });

  /** Y la que ya empezó y todavía no termina sí: es el caso normal con fechas. */
  it('una matrícula con la ventana abierta firma el papel', () => {
    abrirSesion({ hpid: 'hp-1', name: 'Dra. Salas' });
    TestBed.tick();
    responderPerfilPropio(
      perfilConMatriculas([
        {
          ...MATRICULA_VIGENTE,
          validFrom: '2020-01-01T00:00:00.000Z',
          validTo: '2030-12-31T00:00:00.000Z',
        },
      ]),
    );
    responderNombre();
    responderExpediente();

    expect(papelDeLaReceta()).toContain('Matrícula: MP 4821');
  });

  /**
   * Con varias cargadas gana la primera **vigente**, no la primera a secas: si
   * la vencida encabezara la lista, el papel saldría firmado con ella.
   */
  it('entre varias matrículas elige la vigente, no la primera', () => {
    abrirSesion({ hpid: 'hp-1', name: 'Dra. Salas' });
    TestBed.tick();
    responderPerfilPropio(
      perfilConMatriculas([
        { ...MATRICULA_VIGENTE, id: 'lic-0', licenseNumber: 'MP 1', validTo: '2025-01-01T00:00:00.000Z' },
        { ...MATRICULA_VIGENTE, id: 'lic-1', licenseNumber: 'MP 4821' },
      ]),
    );
    responderNombre();
    responderExpediente();

    const texto = papelDeLaReceta();
    expect(texto).toContain('Matrícula: MP 4821');
    expect(texto).not.toContain('Matrícula: MP 1');
  });

  /**
   * Una cuenta sin perfil profesional —recepción, administración— sigue
   * pudiendo descargar el papel: lo que no hace es inventarle una matrícula.
   */
  it('una cuenta sin perfil profesional no imprime matrícula', () => {
    abrirSesion({ tenantNames: { 't-1': 'Hospital Central' } });
    TestBed.tick();
    responderNombre();
    responderExpediente();

    const texto = papelDeLaReceta();
    expect(texto).toContain('Profesional: No registrado');
    expect(texto).not.toContain('Matrícula');
    expect(texto).toContain('Organización: Hospital Central');
  });
});
