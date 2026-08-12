import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../core/auth/session.store';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
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
   * El bloque de medicación pregunta por su catálogo apenas se crea, y esa
   * petición aparece en cualquier prueba que llegue a pintar el expediente.
   *
   * Se responde con el `404` de «sin binding declarado» —el estado real hoy—
   * para que `verify()` no tropiece con ella. Lo que el bloque hace con esa
   * respuesta lo fijan sus propias pruebas: acá sólo importa que no se cuele
   * como una petición huérfana del expediente.
   */
  function responderCatalogoDeMedicacion(): void {
    for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      req.flush(
        { code: 'NOT_FOUND', message: 'Enumeración no encontrada', timestamp: '', path: '' },
        { status: 404, statusText: 'Not Found' },
      );
    }
  }

  afterEach(() => {
    responderCatalogoDeMedicacion();
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
          { id: 'e-1', statusConceptId: 'st-activa', reasonText: 'Control', startAt: HACE_UNA_HORA },
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
});
