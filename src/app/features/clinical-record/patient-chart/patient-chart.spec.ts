import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../core/auth/session.store';
import type { ClinicalSummary } from '../../../core/data-access/clinical/clinical.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
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
    /**
     * `abrirAdjuntos` recibe la fila y su bloque: de la fila salen el id y el
     * título del modal, y del bloque la ruta del vínculo y el tipo de dueño.
     * Sólo se leen esos dos campos, así que la prueba no arma una fila entera.
     */
    function abridorDeAdjuntos(): (id: string, principal: string, bloque: string) => void {
      const abrir =
        interno<(fila: { id: string; principal: string }, bloque: string) => void>(
          'abrirAdjuntos',
        );
      return (id, principal, bloque) => abrir({ id, principal }, bloque);
    }

    /**
     * Abre y cierra, ya no alterna: el subidor vive en un modal, y un botón de
     * menú que cerrara el modal que está encima de él no tendría sentido —el
     * modal se cierra por su propia salida—.
     */
    it('abre el modal de adjuntos de ESA fila, y se cierra por su salida', () => {
      responderNombre();
      responderExpediente();

      const abrir = abridorDeAdjuntos();
      expect(interno<() => unknown>('adjuntandoA')()).toBeNull();

      abrir('c-1', 'Diabetes tipo 2', 'diagnosticos');
      expect(interno<() => { id: string } | null>('adjuntandoA')()?.id).toBe('c-1');

      // Volver a pedirlo sobre la misma fila no lo cierra: un método que
      // conmutaba era justamente lo que abría la tabla en dos.
      abrir('c-1', 'Diabetes tipo 2', 'diagnosticos');
      expect(interno<() => { id: string } | null>('adjuntandoA')()?.id).toBe('c-1');

      interno<() => void>('cerrarAdjuntos')();
      expect(interno<() => unknown>('adjuntandoA')()).toBeNull();
    });

    /** El menú deja de deformar la tabla: la celda ya no despliega nada. */
    it('la celda de acciones no despliega el subidor dentro de la tabla', () => {
      responderNombre();
      responderExpediente();
      harness.fixture.detectChanges();

      abridorDeAdjuntos()('c-1', 'Diabetes tipo 2', 'diagnosticos');
      harness.fixture.detectChanges();

      const raiz = harness.fixture.nativeElement as HTMLElement;
      // El subidor está dentro del modal, no dentro de la tabla.
      expect(raiz.querySelector('app-attachment-dialog')).not.toBeNull();
      expect(raiz.querySelector('app-data-table app-attachment-uploader')).toBeNull();
    });

    /**
     * El lote hereda paciente, el registro padre y los vínculos que ese
     * registro ya resolvió, y el modal los **muestra**: el vínculo lo da la
     * ruta de `clinical`, no un campo que alguien vuelva a elegir.
     */
    it('el contexto del lote sale del registro padre y de sus vínculos', () => {
      responderNombre();
      responderExpediente();

      abridorDeAdjuntos()('c-1', 'Diabetes tipo 2', 'diagnosticos');

      const contexto =
        interno<() => readonly { rotulo: string; valor: string }[]>('contextoDeLosAdjuntos')();

      expect(contexto.map((dato) => dato.rotulo)).toEqual(['Paciente', 'Registro', 'Encuentro']);
      expect(contexto[1]?.valor).toBe('Diabetes tipo 2');
    });

    /**
     * Cada bloque liga por **su** ruta de `clinical`: el genérico de `common` no
     * exige rol ni verifica que el dueño exista, y esto es dato clínico.
     */
    it('el vínculo pasa por la ruta de `clinical` del bloque, no por la genérica', () => {
      responderNombre();
      responderExpediente();

      const abrir = abridorDeAdjuntos();
      const enlazar = interno<
        (fileId: string, ownerId: string) => { subscribe: (o: unknown) => void }
      >('enlazarAdjunto');

      abrir('c-1', 'Diabetes tipo 2', 'diagnosticos');
      enlazar('file-1', 'c-1').subscribe({ next: () => undefined });
      http
        .expectOne('/clinical/conditions/c-1/attachments')
        .flush({ id: 'link-1', fileId: 'file-1', ownerId: 'c-1', createdAt: '2026-01-01' });

      abrir('rx-1', 'Enalapril', 'medicacion');
      enlazar('file-2', 'rx-1').subscribe({ next: () => undefined });
      http
        .expectOne('/clinical/medication-requests/rx-1/attachments')
        .flush({ id: 'link-2', fileId: 'file-2', ownerId: 'rx-1', createdAt: '2026-01-01' });

      abrir('al-1', 'Penicilina', 'alergias');
      enlazar('file-3', 'al-1').subscribe({ next: () => undefined });
      http
        .expectOne('/clinical/allergy-intolerances/al-1/attachments')
        .flush({ id: 'link-3', fileId: 'file-3', ownerId: 'al-1', createdAt: '2026-01-01' });
    });

    /** El tipo de dueño acompaña al bloque; el encuentro cae al genérico. */
    it('el tipo de dueño sale del bloque de la fila', () => {
      responderNombre();
      responderExpediente();

      const abrir = abridorDeAdjuntos();
      const dueno = interno<() => string>('duenoDelAdjunto');
      const enlace = interno<() => unknown>('enlaceDelAdjunto');

      abrir('rx-1', 'Enalapril', 'medicacion');
      expect(dueno()).toBe('MEDICATION_REQUEST');
      expect(enlace()).not.toBeNull();

      abrir('enc-1', 'Consulta', 'encuentros');
      expect(dueno()).toBe('ENCOUNTER');
      // Los encuentros todavía no tienen ruta propia en `clinical`.
      expect(enlace()).toBeNull();
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

  /* ---- el aviso de apertura ---------------------------------------------- */

  /**
   * Las alergias salen de la segunda pestaña y se dicen al entrar.
   *
   * Es el único bloque que cambia una conducta **antes** de leerlo: recetar sin
   * haberlas visto es el error que el aviso existe para evitar, y en una pestaña
   * había que acordarse de ir a mirarlas. En una banda fija arriba también se
   * dejaban de leer, así que ahora van en el modal que abre la pantalla.
   */
  it('destaca las alergias en el aviso de apertura', () => {
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
    harness.fixture.detectChanges();

    const destacadas = interno<() => readonly Record<string, unknown>[]>('alergiasDestacadas')();
    expect(destacadas).toHaveLength(1);
    expect(destacadas[0]['principal']).toBe('Diabetes tipo 2');

    expect(interno<() => boolean>('avisosVisibles')()).toBe(true);
    const html: string = harness.fixture.nativeElement.innerHTML;
    expect(html).toContain('expediente-avisos');
  });

  /**
   * Sin alergias y sin consulta abierta no hay nada que avisar: un modal vacío
   * que hay que cerrar sería peor que la banda que reemplaza.
   */
  it('sin nada que avisar no se interpone ningún modal', () => {
    responderNombre();
    responderExpediente();
    harness.fixture.detectChanges();

    expect(interno<() => readonly unknown[]>('alergiasDestacadas')()).toHaveLength(0);
    expect(interno<() => boolean>('avisosVisibles')()).toBe(false);
    const html: string = harness.fixture.nativeElement.innerHTML;
    expect(html).not.toContain('expediente-avisos');
  });

  /** Cerrado una vez, no vuelve: el expediente se lee sin nada encima. */
  it('el aviso no vuelve una vez cerrado', () => {
    responderNombre();
    responderExpediente({
      resumen: {
        encounters: [
          { id: 'e-1', classConceptId: 'st-activa', startAt: '2026-05-20T10:00:00.000Z' },
        ],
      },
    });
    harness.fixture.detectChanges();
    expect(interno<() => boolean>('avisosVisibles')()).toBe(true);

    interno<() => void>('cerrarAvisos')();
    harness.fixture.detectChanges();

    expect(interno<() => boolean>('avisosVisibles')()).toBe(false);
    const html: string = harness.fixture.nativeElement.innerHTML;
    expect(html).not.toContain('expediente-avisos');
  });

  /**
   * Las cifras de la banda —cuántos diagnósticos, cuánta medicación, la última
   * atención— se fueron enteras: nadie las pidió y se comían la franja de
   * arriba de las pestañas. Cada pestaña ya dice cuántos registros trae.
   */
  it('no dibuja la banda de cifras', () => {
    responderNombre();
    responderExpediente();
    harness.fixture.detectChanges();

    const html: string = harness.fixture.nativeElement.innerHTML;
    expect(html).not.toContain('expediente__cifras');
    expect(html).not.toContain('Última atención');
  });

  /* ---- el expediente dejó de ser un origen de la atención ----------------- */

  /**
   * Fase 1 del plan de atención: atender nace **sólo** de «Mis citas», donde
   * está el turno que lo justifica. Entrar a atender desde el expediente
   * salteaba ese paso y dejaba consultas sin cita detrás.
   */
  it('no ofrece «Atender»: el expediente es lectura', () => {
    responderNombre();
    responderExpediente();
    harness.fixture.detectChanges();

    const html: string = harness.fixture.nativeElement.innerHTML;
    expect(html).not.toContain('expediente-abrir-atencion');
  });

  /**
   * Lo que sí corresponde es la continuación: un encuentro sin `endAt` está
   * abierto, y quien vino a consultar un antecedente tiene por dónde volver.
   */
  it('con un encuentro abierto ofrece volver a la consulta', () => {
    responderNombre();
    responderExpediente({
      resumen: {
        encounters: [
          { id: 'e-1', classConceptId: 'st-activa', startAt: '2026-05-20T10:00:00.000Z' },
        ],
      },
    });
    harness.fixture.detectChanges();

    expect(interno<() => boolean>('atencionEnCurso')()).toBe(true);
    const html: string = harness.fixture.nativeElement.innerHTML;
    expect(html).toContain('expediente-volver-atencion');
  });

  it('con todos los encuentros cerrados no ofrece volver a ninguna consulta', () => {
    responderNombre();
    responderExpediente({
      resumen: {
        encounters: [
          {
            id: 'e-1',
            classConceptId: 'st-activa',
            startAt: '2026-05-20T10:00:00.000Z',
            endAt: '2026-05-20T11:00:00.000Z',
          },
        ],
      },
    });
    harness.fixture.detectChanges();

    expect(interno<() => boolean>('atencionEnCurso')()).toBe(false);
    const html: string = harness.fixture.nativeElement.innerHTML;
    expect(html).not.toContain('expediente-volver-atencion');
  });

  /** Fase 3.1: era texto de arquitectura interna en la pantalla del médico. */
  it('ya no muestra la tarjeta «Qué se está mirando»', () => {
    responderNombre();
    responderExpediente();
    harness.fixture.detectChanges();

    const texto: string = harness.fixture.nativeElement.textContent ?? '';
    expect(texto).not.toContain('Qué se está mirando');
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
    // Las tres que siempre están, más `acciones` (Patch v4.0.8: sólo
    // diagnósticos) y `ver`, que la lleva **todo** bloque desde la corrección
    // del 10/09/2026: el detalle se abre en modal y esa es su puerta.
    expect(diagnosticos?.columnas.map((c) => c.key)).toEqual([
      'principal',
      'estado',
      'cuando',
      'acciones',
      'ver',
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

  /* ---- lo que se mudó a «Atención» -----------------------------------
     Abrir y cerrar el encuentro, la receta y la internación ya no viven acá:
     sus pruebas están en `consultation/consultation.spec.ts`. Lo que queda es lo
     único que el expediente sigue escribiendo —el estado clínico de un
     diagnóstico y su adjunto— y los papeles que genera. */

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
    return bloquesDeReceta(recetaDesdeResumen(INDICACION_GUARDADA, contexto, (id) => id ?? ''))
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
        {
          ...MATRICULA_VIGENTE,
          id: 'lic-0',
          licenseNumber: 'MP 1',
          validTo: '2025-01-01T00:00:00.000Z',
        },
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

  /* ═══ Vínculos clínicos y detalle en modal ════════════════════════════════
     La corrección del 10/09/2026: cada registro dice con qué encuentro y con
     qué diagnóstico está relacionado, y lo dice en un modal —nunca desplegado
     dentro del listado—. Donde el contrato no guarda el vínculo, lo declara en
     voz alta en vez de mostrar una asociación fabricada. */

  describe('vínculos clínicos de cada bloque', () => {
    it('un diagnóstico sin encuentro lo dice, no se le asigna el último', () => {
      responderNombre();
      responderExpediente();

      const filas =
        interno<() => readonly { vinculos: { rotulo: string; valor: string }[] }[]>(
          'diagnosticos',
        )();

      expect(filas[0]?.vinculos).toEqual([
        { rotulo: 'Encuentro', valor: 'Sin encuentro registrado' },
      ]);
    });

    it('un diagnóstico con encuentro lo nombra con su clase y su fecha', () => {
      responderNombre();
      responderExpediente({
        resumen: {
          conditions: [
            {
              id: 'c-1',
              codeConceptId: 'con-diabetes',
              clinicalStatusConceptId: 'st-activa',
              encounterId: 'e-1',
              createdAt: '2026-01-03T00:00:00.000Z',
            },
          ],
          encounters: [
            {
              id: 'e-1',
              statusConceptId: 'st-final',
              classConceptId: 'st-activa',
              startAt: '2026-01-03T10:00:00.000Z',
            },
          ],
        },
      });

      const filas =
        interno<() => readonly { vinculos: { rotulo: string; valor: string }[] }[]>(
          'diagnosticos',
        )();

      expect(filas[0]?.vinculos[0]?.valor).toContain('Activa');
      expect(filas[0]?.vinculos[0]?.valor).toContain('2026');
    });

    /**
     * El vínculo que la corrección hace verificable: `indicationConditionId`
     * viene de la lectura, así que sobrevive a recargar. Antes el tipo no lo
     * declaraba y el diagnóstico de la receta desaparecía al releer.
     */
    it('la receta nombra el diagnóstico que la motiva, leído del resumen', () => {
      responderNombre();
      responderExpediente({
        resumen: {
          medicationRequests: [
            {
              id: 'm-1',
              medicationConceptId: 'con-diabetes',
              statusConceptId: 'st-activa',
              indicationConditionId: 'c-1',
              createdAt: '2026-01-05T00:00:00.000Z',
            },
          ],
        },
      });

      const filas =
        interno<() => readonly { vinculos: { rotulo: string; valor: string }[] }[]>('medicacion')();

      expect(filas[0]?.vinculos[0]).toEqual({
        rotulo: 'Diagnóstico',
        valor: 'Diabetes tipo 2',
      });
    });

    it('una receta sin diagnóstico asociado lo dice: es un caso legítimo', () => {
      responderNombre();
      responderExpediente({
        resumen: {
          medicationRequests: [
            {
              id: 'm-1',
              medicationConceptId: 'con-diabetes',
              statusConceptId: 'st-activa',
              createdAt: '2026-01-05T00:00:00.000Z',
            },
          ],
        },
      });

      const filas =
        interno<() => readonly { vinculos: { rotulo: string; valor: string }[] }[]>('medicacion')();

      expect(filas[0]?.vinculos[0]?.valor).toBe('Sin diagnóstico asociado');
    });

    /**
     * `AllergyIntolerance` no tiene encuentro ni condición ni en la escritura ni
     * en la lectura. Decirlo es lo honesto: una etiqueta de encuentro acá sería
     * exactamente la «relación sólo visual» que el pedido prohíbe.
     */
    it('la alergia declara que su contrato no guarda vínculos', () => {
      responderNombre();
      responderExpediente({
        resumen: {
          allergies: [
            {
              id: 'a-1',
              substanceConceptId: 'con-diabetes',
              clinicalStatusConceptId: 'st-activa',
              createdAt: '2026-01-04T00:00:00.000Z',
            },
          ],
        },
      });

      const filas =
        interno<() => readonly { vinculos: { rotulo: string; valor: string }[] }[]>('alergias')();

      expect(filas[0]?.vinculos[0]?.valor).toContain('no guarda encuentro ni diagnóstico');
    });

    /** El sentido correcto: el encuentro es el contexto y el diagnóstico cuelga. */
    it('el encuentro lista los diagnósticos que se documentaron en él', () => {
      responderNombre();
      responderExpediente({
        resumen: {
          conditions: [
            {
              id: 'c-1',
              codeConceptId: 'con-diabetes',
              clinicalStatusConceptId: 'st-activa',
              encounterId: 'e-1',
              createdAt: '2026-01-03T00:00:00.000Z',
            },
          ],
          encounters: [
            { id: 'e-1', statusConceptId: 'st-final', startAt: '2026-01-03T10:00:00.000Z' },
          ],
        },
      });

      const filas =
        interno<() => readonly { vinculos: { rotulo: string; valor: string }[] }[]>('encuentros')();

      expect(filas[0]?.vinculos[0]).toEqual({
        rotulo: 'Diagnósticos del encuentro',
        valor: 'Diabetes tipo 2',
      });
    });
  });

  describe('el detalle se abre en modal', () => {
    it('abre con la fila pedida y con el título del bloque, y cierra', () => {
      responderNombre();
      responderExpediente();

      const fila = interno<() => readonly { id: string }[]>('observaciones')()[0]!;

      expect(interno<() => unknown>('filaEnDetalle')()).toBeNull();

      interno<(f: unknown) => void>('verDetalle')(fila);

      expect(interno<() => { bloque: string } | null>('filaEnDetalle')()?.bloque).toBe(
        'observaciones',
      );
      // Un título específico, nunca «Formulario» ni «Detalle» a secas.
      expect(interno<() => string>('tituloDelDetalle')()).toBe('Detalle de la observación');

      interno<() => void>('cerrarDetalle')();
      expect(interno<() => unknown>('filaEnDetalle')()).toBeNull();
    });

    /**
     * El bloque se deduce de dónde está la fila: la plantilla de celda es una
     * sola para las ocho tablas y sólo recibe la fila.
     */
    it('deduce el bloque de la fila, no de un parámetro', () => {
      responderNombre();
      responderExpediente();

      const diagnostico = interno<() => readonly { id: string }[]>('diagnosticos')()[0]!;
      interno<(f: unknown) => void>('verDetalle')(diagnostico);

      expect(interno<() => string>('tituloDelDetalle')()).toBe('Detalle del diagnóstico');
    });
  });

  /**
   * El alta y el cambio de estado clínico son los dos modales editables del
   * expediente: cerrarlos con algo sin registrar tiene que preguntar, igual
   * que `attachment-dialog` ya hace con sus archivos. El detalle de lectura es
   * el contraste — nunca pregunta, porque no hay nada que perder.
   */
  describe('el alta pregunta antes de descartar lo escrito', () => {
    /** Simula `DialogService.confirm`, contando cuántas veces se preguntó. */
    function simularConfirmacion(resultado: boolean): { llamados: number } {
      const contador = { llamados: 0 };
      TestBed.inject(DialogService).confirm = () => {
        contador.llamados++;
        return Promise.resolve(resultado);
      };
      return contador;
    }

    it('recién abierta, sin nada escrito, no tiene cambios pendientes', () => {
      responderNombre();
      responderExpediente();
      interno<(c: string) => void>('abrirAlta')('documentos');
      harness.fixture.detectChanges();

      expect(interno<() => boolean>('altaSinCambios')()).toBe(true);
    });

    it('con el bloque de documentos con algo escrito, hay cambios pendientes', () => {
      responderNombre();
      responderExpediente();
      interno<(c: string) => void>('abrirAlta')('documentos');
      harness.fixture.detectChanges();

      const bloque =
        interno<() => { tieneCambiosPendientes: () => boolean } | undefined>('bloqueDelAlta')();
      expect(bloque).toBeDefined();

      const titulo = (bloque as unknown as Record<string, { set(v: string): void }>)['titulo'];
      titulo.set('Laboratorio completo');
      harness.fixture.detectChanges();

      expect(interno<() => boolean>('altaSinCambios')()).toBe(false);
    });

    it('con algo escrito, pedir el descarte pregunta y cancelar deja el alta abierta', async () => {
      responderNombre();
      responderExpediente();
      interno<(c: string) => void>('abrirAlta')('documentos');
      harness.fixture.detectChanges();

      const bloque =
        interno<() => { tieneCambiosPendientes: () => boolean } | undefined>('bloqueDelAlta')();
      const titulo = (bloque as unknown as Record<string, { set(v: string): void }>)['titulo'];
      titulo.set('Laboratorio completo');
      harness.fixture.detectChanges();

      const contador = simularConfirmacion(false);
      await interno<() => Promise<void>>('pedirDescarteDelAlta')();

      expect(contador.llamados).toBe(1);
      expect(interno<() => string | null>('altaAbierta')()).toBe('documentos');
    });

    it('confirmar el descarte cierra el alta', async () => {
      responderNombre();
      responderExpediente();
      interno<(c: string) => void>('abrirAlta')('documentos');
      harness.fixture.detectChanges();

      const bloque =
        interno<() => { tieneCambiosPendientes: () => boolean } | undefined>('bloqueDelAlta')();
      const titulo = (bloque as unknown as Record<string, { set(v: string): void }>)['titulo'];
      titulo.set('Laboratorio completo');
      harness.fixture.detectChanges();

      simularConfirmacion(true);
      await interno<() => Promise<void>>('pedirDescarteDelAlta')();
      harness.fixture.detectChanges();

      expect(interno<() => string | null>('altaAbierta')()).toBeNull();
    });

    it('sin nada escrito, el modal se puede cerrar sin preguntar', () => {
      responderNombre();
      responderExpediente();
      interno<(c: string) => void>('abrirAlta')('documentos');
      harness.fixture.detectChanges();

      const contador = simularConfirmacion(false);
      interno<() => void>('cerrarAlta')();

      expect(contador.llamados).toBe(0);
      expect(interno<() => string | null>('altaAbierta')()).toBeNull();
    });

    it('el detalle de lectura nunca pregunta: no tiene nada que perder', () => {
      responderNombre();
      responderExpediente();

      const contador = simularConfirmacion(false);
      const fila = interno<() => readonly { id: string }[]>('observaciones')()[0]!;
      interno<(f: unknown) => void>('verDetalle')(fila);
      interno<() => void>('cerrarDetalle')();

      expect(contador.llamados).toBe(0);
    });
  });

  describe('cambiar el estado clínico pregunta antes de descartar el destino elegido', () => {
    function simularConfirmacion(resultado: boolean): { llamados: number } {
      const contador = { llamados: 0 };
      TestBed.inject(DialogService).confirm = () => {
        contador.llamados++;
        return Promise.resolve(resultado);
      };
      return contador;
    }

    it('sin destino elegido, el modal se cierra sin preguntar', () => {
      responderNombre();
      responderExpediente();
      const fila = interno<() => readonly { id: string }[]>('diagnosticos')()[0]!;
      interno<(f: unknown) => void>('abrirCambioDeEstado')(fila);
      harness.fixture.detectChanges();

      const contador = simularConfirmacion(false);
      interno<() => void>('cerrarCambioDeEstado')();

      expect(contador.llamados).toBe(0);
      expect(interno<() => unknown>('cambiandoEstadoDe')()).toBeNull();
    });

    it('con un destino elegido y no aplicado, pedir el descarte pregunta', async () => {
      responderNombre();
      responderExpediente();
      const fila = interno<() => readonly { id: string }[]>('diagnosticos')()[0]!;
      interno<(f: unknown) => void>('abrirCambioDeEstado')(fila);
      harness.fixture.detectChanges();
      interno<(id: string, destino: string | null) => void>('elegirDestinoEstado')(
        fila.id,
        'st-resuelta',
      );

      expect(interno<() => boolean>('estadoSinCambios')()).toBe(false);

      const contador = simularConfirmacion(true);
      await interno<() => Promise<void>>('pedirDescarteDelEstado')();

      expect(contador.llamados).toBe(1);
    });

    it('confirmado el descarte, el destino elegido se limpia', async () => {
      responderNombre();
      responderExpediente();
      const fila = interno<() => readonly { id: string }[]>('diagnosticos')()[0]!;
      interno<(f: unknown) => void>('abrirCambioDeEstado')(fila);
      harness.fixture.detectChanges();
      interno<(id: string, destino: string | null) => void>('elegirDestinoEstado')(
        fila.id,
        'st-resuelta',
      );

      simularConfirmacion(true);
      await interno<() => Promise<void>>('pedirDescarteDelEstado')();
      // El propio `close()` del organismo emitiría `closed`; acá se ejercita
      // el efecto que ese evento dispara, igual que hacen el resto de las
      // pruebas de este archivo con `cerrarDetalle`/`cerrarAlta`.
      interno<() => void>('cerrarCambioDeEstado')();

      expect(interno<(id: string) => string | null>('destinoEstadoDe')(fila.id)).toBeNull();
    });
  });
});
