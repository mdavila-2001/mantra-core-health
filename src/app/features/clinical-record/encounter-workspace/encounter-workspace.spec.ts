import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../core/auth/session.store';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { bloquesDeReceta } from '../../../shared/utils/clinical-pdf/clinical-pdf';
import {
  recetaDesdeResumen,
  type ContextoDelDocumento,
} from '../../../shared/utils/clinical-pdf/from-summary';
import { EncounterWorkspace } from './encounter-workspace';

/**
 * La atención clínica — lo que se ESCRIBE durante una consulta. Estas pruebas
 * viajaron con el código desde `patient-chart.spec.ts`, y lo que fijan no
 * cambió:
 *
 * 1. **El check-in manda lo que el contrato pide y nada más.** Un motivo en
 *    blanco no viaja, y el turno de origen viaja sólo si existe: es una clave
 *    foránea real, no un dato aproximado.
 * 2. **«En curso» se deriva de `endAt`,** no del estado, que es un uuid de
 *    catálogo.
 * 3. **El papel se firma con la matrícula vigente,** o no se firma.
 *
 * Lo que sí cambió es la lectura: acá sólo se pide
 * `GET /clinical/patients/:id/summary`. La narrativa —notas, planes,
 * documentos— es historia y su lugar es el expediente.
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
  observations: [],
  encounters: [],
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
  ],
  count: 2,
  limit: 200,
};

describe('EncounterWorkspace', () => {
  let harness: RouterTestingHarness;
  let componente: EncounterWorkspace;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'medical-records/:profileId/encounter', component: EncounterWorkspace },
        ]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(
      '/medical-records/p-1/encounter',
      EncounterWorkspace,
    );
  });

  /**
   * Las peticiones de los bloques hijos.
   *
   * Sólo se monta el panel activo —`app-tabs` no dibuja los inactivos—, así que
   * en la práctica es el formulario de especialidad el que pregunta. Se drenan
   * todas de todos modos: lo que cada bloque hace con su respuesta lo fijan sus
   * propias pruebas, y acá sólo importa que no se cuelen como huérfanas.
   */
  function responderBloques(): void {
    for (const req of http.match((r) => r.url === '/charts/templates')) {
      req.flush([]);
    }
    for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      req.flush(
        { code: 'NOT_FOUND', message: 'Enumeración no encontrada', timestamp: '', path: '' },
        { status: 404, statusText: 'Not Found' },
      );
    }
    for (const req of http.match((r) => r.url === '/prescription-favorites')) {
      req.flush([]);
    }
  }

  /**
   * El perfil profesional de quien atiende, sin responder con datos: la sesión
   * de las pruebas no ejerce ninguna, que es el caso que los bloques ya saben
   * manejar sin romperse.
   */
  function responderPerfilProfesional(): void {
    for (const req of http.match((r) => r.url === '/profiles/practitioners/me/summary')) {
      req.flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    }
  }

  /**
   * El mismo perfil, pero **respondido**: es de donde sale la matrícula que
   * firma el papel.
   */
  function responderPerfilPropio(perfil: Record<string, unknown>): void {
    const pedidos = http.match((r) => r.url === '/profiles/practitioners/me/summary');
    expect(pedidos.length).toBeGreaterThan(0);
    for (const req of pedidos) {
      req.flush(perfil);
    }
  }

  afterEach(() => {
    responderBloques();
    responderPerfilProfesional();
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /**
   * Una señal escribible, **sin `bind`**: `interno` liga las funciones al
   * componente y la señal ligada pierde su `.set`.
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
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'], ...claims }),
      refreshToken: 'r-1',
    });
  }

  function estado() {
    return interno<() => { status: string }>('resumenClinico')();
  }

  /** Responde el nombre del paciente. Es la lectura cosmética y va aparte. */
  function responderNombre(): void {
    http.expectOne((r) => r.url === '/profiles/patients/p-1').flush({
      profileId: 'p-1',
      personId: 'per-1',
      patientCode: 'PAC-1',
      displayName: 'Andrea Peña Rojas',
      relatedPersons: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
  }

  function responderResumen(opciones: { resumen?: object; conceptos?: object } = {}): void {
    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush({ ...RESUMEN, ...opciones.resumen });
    http.expectOne((r) => r.url === '/terminology/concepts').flush(opciones.conceptos ?? CONCEPTOS);
  }

  /* ---- la lectura --------------------------------------------------------- */

  it('pide el resumen clínico con el tope y NO la lectura narrativa', () => {
    responderNombre();

    const resumen = http.expectOne((r) => r.url === '/clinical/patients/p-1/summary');
    expect(resumen.request.params.get('limit')).toBe('50');
    resumen.flush(RESUMEN);

    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    http.expectNone((r) => r.url.startsWith('/charts/patients/'));

    expect(estado().status).toBe('ready');
  });

  /* ---- el encuentro ------------------------------------------------------- */

  it('sin organización activa no ofrece registrar: `tenantId` es obligatorio', () => {
    responderNombre();
    responderResumen();

    expect(interno<() => boolean>('sinOrganizacion')()).toBe(true);
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);
  });

  it('con el resumen todavía sin leer no se puede registrar a ciegas', () => {
    abrirSesion();
    responderNombre();

    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);

    responderResumen();
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(true);
  });

  it('registrar abre el encuentro con el paciente de la ruta y la organización activa', () => {
    abrirSesion();
    responderNombre();
    responderResumen();

    motivo().set('Dolor abdominal');
    interno<() => void>('registrarEncuentro')();

    const req = http.expectOne('/clinical/encounters/check-in');
    expect(req.request.body).toEqual({
      patientProfileId: 'p-1',
      tenantId: 't-1',
      reasonText: 'Dolor abdominal',
    });
    req.flush(ENCUENTRO_ABIERTO);

    // Releer no es opcional: el encuentro recién abierto tiene que aparecer, o
    // la pantalla afirmaría un registro que no muestra.
    responderNombre();
    responderResumen();
    expect(estado().status).toBe('ready');
  });

  /**
   * El vínculo con el turno. `?cita=` trae el `appointmentId` de la reserva, que
   * es una clave foránea real hacia `clinical.appointments`.
   */
  it('manda la cita de origen cuando se llegó desde la agenda', async () => {
    abrirSesion();
    responderNombre();
    responderResumen();

    // Se llega con el turno puesto, como hace el enlace de la agenda. Mismo
    // paciente, así que la lectura no se repite: sólo cambian los parámetros.
    await harness.navigateByUrl('/medical-records/p-1/encounter?cita=ap-1&motivo=Control');

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
    responderResumen();
  });

  /**
   * Un encuentro sin profesional es una marca de tiempo sin autor. El dato sale
   * del claim `hpid`, que existe justamente porque no hay lectura que lo dé.
   */
  it('manda al profesional de la sesión como responsable', () => {
    abrirSesion({ hpid: 'hp-1' });
    responderNombre();
    responderResumen();

    interno<() => void>('registrarEncuentro')();

    const req = http.expectOne('/clinical/encounters/check-in');
    expect((req.request.body as Record<string, unknown>)['primaryPractitionerId']).toBe('hp-1');
    req.flush(ENCUENTRO_ABIERTO);

    responderNombre();
    responderResumen();
  });

  it('una cuenta sin perfil profesional no manda responsable', () => {
    abrirSesion();
    responderNombre();
    responderResumen();

    interno<() => void>('registrarEncuentro')();

    const req = http.expectOne('/clinical/encounters/check-in');
    expect(req.request.body).not.toHaveProperty('primaryPractitionerId');
    req.flush(ENCUENTRO_ABIERTO);

    responderNombre();
    responderResumen();
  });

  /**
   * Una cadena vacía sería un motivo registrado que no dice nada, y se lee peor
   * que su ausencia — el contrato lo declara opcional.
   */
  it('un motivo en blanco no viaja', () => {
    abrirSesion();
    responderNombre();
    responderResumen();

    motivo().set('   ');
    interno<() => void>('registrarEncuentro')();

    const req = http.expectOne('/clinical/encounters/check-in');
    expect(Object.keys(req.request.body as object).sort()).toEqual([
      'patientProfileId',
      'tenantId',
    ]);
    req.flush(ENCUENTRO_ABIERTO);

    responderNombre();
    responderResumen();
  });

  it('sólo los encuentros sin fin están en curso', () => {
    abrirSesion();
    responderNombre();
    responderResumen({
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
   * y puede cambiar de redacción— y la salida que se ofrece es recargar.
   */
  it('traduce el 422 de un encuentro que ya no está en curso', () => {
    abrirSesion();
    responderNombre();
    responderResumen();

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

    expect(interno<() => string | null>('errorDelRegistro')()).toContain('Recargá la atención');
  });

  /* ---- lo que baja a los bloques ------------------------------------------ */

  /**
   * «Firmada» y «emitida» salen de `signedAt` e `issuedAt`, no del estado: el
   * estado es un uuid de concepto, y ramificar por su valor ataría la pantalla
   * a un identificador de catálogo.
   */
  it('resuelve el ciclo de cada receta por sus instantes, no por su estado', () => {
    abrirSesion();
    responderNombre();
    responderResumen({
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
    responderResumen();

    expect(interno<() => string | null>('encuentroParaRecetar')()).toBeNull();
  });

  it('con un encuentro en curso, es ese el que recibe la receta', () => {
    abrirSesion();
    responderNombre();
    responderResumen({
      resumen: {
        encounters: [{ id: 'e-1', statusConceptId: 'st-activa', startAt: HACE_UNA_HORA }],
      },
    });

    expect(interno<() => string | null>('encuentroParaRecetar')()).toBe('e-1');
  });

  /**
   * «Abierta» se deriva de `endAt`, por lo mismo que en los encuentros. Una
   * internación abierta que se leyera como cerrada esconde que la persona sigue
   * internada.
   */
  it('la internación abierta se deriva de `endAt`, no del estado', () => {
    abrirSesion();
    responderNombre();
    responderResumen({
      resumen: {
        careEpisodes: [
          { id: 'ep-1', startAt: HACE_UNA_HORA },
          { id: 'ep-2', startAt: HACE_UNA_HORA, endAt: HACE_UNA_HORA },
        ],
      },
    });

    const internaciones =
      interno<() => readonly Record<string, unknown>[]>('internaciones')();
    expect(internaciones.map((i) => i['abierta'])).toEqual([true, false]);
  });

  /**
   * Los diagnósticos se ofrecen **todos** como indicación de una receta:
   * renovar el tratamiento de una condición resuelta es legítimo, y esconderla
   * dejaría la receta sin indicación. Lo que lleva la etiqueta es el estado.
   */
  it('ofrece todos los diagnósticos como indicación, y dice cuál está resuelto', () => {
    abrirSesion();
    responderNombre();
    responderResumen({
      resumen: {
        conditions: [
          { id: 'c-1', codeConceptId: 'con-diabetes', createdAt: HACE_UNA_HORA },
          {
            id: 'c-2',
            codeConceptId: 'con-diabetes',
            createdAt: HACE_UNA_HORA,
            resolvedAt: HACE_UNA_HORA,
          },
        ],
      },
    });

    const opciones = interno<() => readonly Record<string, unknown>[]>('diagnosticosParaReceta')();
    expect(opciones.map((o) => o['etiqueta'])).toEqual([
      'Diabetes tipo 2',
      'Diabetes tipo 2 · Resuelto',
    ]);
  });

  /* ---- quién firma el papel -----------------------------------------------
     La regla vive en `firma-de-la-sesion` y tiene sus propias pruebas de
     vigencia; acá se fija que ESTA pantalla la alimenta con los datos de su
     sesión, que es lo que estaba mal cuando el contexto viajaba con paciente y
     profesional y nada más. */

  it('la receta imprime la matrícula del profesional y la organización', () => {
    abrirSesion({
      hpid: 'hp-1',
      name: 'Dra. Salas',
      tenantNames: { 't-1': 'Hospital Central' },
    });
    TestBed.tick(); // el perfil propio se pide en un effect, al abrirse la sesión
    responderPerfilPropio({
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
      licenses: [
        {
          id: 'lic-1',
          jurisdictionConceptId: 'st-activa',
          licenseNumber: 'MP 4821',
          stateConceptId: 'st-activa',
        },
      ],
      languages: [],
      affiliations: [],
      activity: { encounters: 0, medicationRequests: 0, clinicalNotes: 0, documents: 0 },
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    responderNombre();
    responderResumen();

    const contexto = interno<() => ContextoDelDocumento>('contextoDelDocumento')();
    const texto = bloquesDeReceta(
      recetaDesdeResumen(
        {
          id: 'rx-1',
          medicationConceptId: 'con-diabetes',
          statusConceptId: 'st-activa',
          doseText: '500 mg',
          frequencyText: 'cada 8 horas',
          createdAt: new Date('2026-03-01T10:30:00.000Z'),
        },
        contexto,
        (id) => id ?? '',
      ),
    )
      .map((bloque) => bloque.text)
      .join('\n');

    expect(texto).toContain('Profesional: Dra. Salas');
    expect(texto).toContain('Matrícula: MP 4821');
    expect(texto).toContain('Organización: Hospital Central');
    expect(texto).not.toContain('undefined');
  });
});
