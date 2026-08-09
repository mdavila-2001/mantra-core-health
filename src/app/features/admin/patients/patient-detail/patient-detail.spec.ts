import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import { PatientDetail, type FichaCampo } from './patient-detail';

/**
 * La ficha F-01 tiene una obligación que ninguna otra pantalla tiene tan clara:
 * **no mostrar uuid**. El contrato le entrega once `*ConceptId` y la persona que
 * la mira necesita palabras, no identificadores internos.
 *
 * La segunda obligación es de resistencia: el catálogo es una lectura aparte, y
 * su caída no puede llevarse puesta la ficha.
 */
const GENERO = '11111111-1111-4111-8111-111111111111';
const ESTADO = '22222222-2222-4222-8222-222222222222';
const VINCULO = '33333333-3333-4333-8333-333333333333';

const FICHA = {
  profileId: 'pp-1',
  personId: 'p-1',
  patientCode: 'PAC-1',
  displayName: 'Ana Salas',
  birthDate: '1985-03-14',
  administrativeGenderConceptId: GENERO,
  personStatusConceptId: ESTADO,
  relatedPersons: [
    {
      id: 'rp-1',
      displayName: 'Juan Salas',
      relationshipConceptId: VINCULO,
      isEmergencyContact: true,
      isLegalGuardian: false,
    },
  ],
  createdAt: '2026-07-31T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
};

describe('PatientDetail', () => {
  let harness: RouterTestingHarness;
  let componente: PatientDetail;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administracion/pacientes/:profileId', component: PatientDetail }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl('/administracion/pacientes/pp-1', PatientDetail);
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /** Responde la ficha y, después, el catálogo. Ese es el orden real. */
  function responder(etiquetas: unknown[] | 'falla' = []) {
    http.expectOne('/profiles/patients/pp-1').flush(FICHA);

    const catalogo = http.expectOne((r) => r.url === '/terminology/concepts');
    if (etiquetas === 'falla') {
      catalogo.error(new ProgressEvent('error'), { status: 500 });
    } else {
      catalogo.flush({ items: etiquetas, count: etiquetas.length, limit: 50 });
    }
    harness.detectChanges();
  }

  function campo(grupo: string, etiqueta: string): string | undefined {
    return interno<() => readonly FichaCampo[]>(grupo)().find((c) => c.etiqueta === etiqueta)
      ?.valor;
  }

  it('lee la ficha por el identificador de la ruta', () => {
    const req = http.expectOne('/profiles/patients/pp-1');
    expect(req.request.method).toBe('GET');
    req.flush(FICHA);

    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [],
        count: 0,
        limit: 50,
      });
  });

  it('pide las etiquetas de todos los conceptos en UNA sola petición', () => {
    http.expectOne('/profiles/patients/pp-1').flush(FICHA);

    const catalogo = http.expectOne((r) => r.url === '/terminology/concepts');
    const ids = catalogo.request.params.get('ids') ?? '';

    // Los tres que la ficha trae, incluido el vínculo del contacto.
    expect(ids).toContain(GENERO);
    expect(ids).toContain(ESTADO);
    expect(ids).toContain(VINCULO);

    catalogo.flush({ items: [], count: 0, limit: 50 });
  });

  it('muestra la etiqueta del concepto, nunca su uuid', () => {
    responder([
      { conceptId: GENERO, code: 'F', display: 'Femenino', codeSystemVersionId: 'csv-1' },
    ]);

    expect(campo('demograficos', 'Género administrativo')).toBe('Femenino');
  });

  /**
   * Lo que la persona vino a ver es el nombre, el código y la fecha. Perderlos
   * porque el catálogo no respondió sería cambiar un problema chico por uno
   * grande.
   */
  it('si el catálogo falla, la ficha se muestra igual y sin uuid a la vista', () => {
    responder('falla');

    expect(interno<() => { status: string }>('ficha')().status).toBe('ready');
    expect(campo('identificacion', 'Código de paciente')).toBe('PAC-1');
    expect(campo('demograficos', 'Género administrativo')).toBe('Sin registrar');
  });

  it('un concepto que el catálogo no conoce se dice, no se inventa', () => {
    responder([]);

    expect(campo('estado', 'Estado de la persona')).toBe('Sin registrar');
  });

  it('un campo que la ficha no trae queda como sin registrar', () => {
    responder([]);

    expect(campo('identificacion', 'Índice maestro (MPI)')).toBe('Sin registrar');
  });

  it('el contacto llega con su vínculo traducido y sus dos roles separados', () => {
    responder([
      { conceptId: VINCULO, code: 'BRO', display: 'Hermano/a', codeSystemVersionId: 'csv-1' },
    ]);

    const contactos =
      interno<
        () => readonly {
          nombre: string;
          vinculo: string;
          esTutor: boolean;
          esEmergencia: boolean;
        }[]
      >('contactos')();

    expect(contactos).toHaveLength(1);
    expect(contactos[0]?.vinculo).toBe('Hermano/a');
    expect(contactos[0]?.esEmergencia).toBe(true);
    expect(contactos[0]?.esTutor).toBe(false);
  });

  it('el breadcrumb termina en el paciente y deja el listado como enlace', () => {
    responder([]);

    const ruta = interno<() => readonly { label: string; routerLink?: unknown }[]>('breadcrumbs')();
    const ultimo = ruta.at(-1);
    const anteultimo = ruta.at(-2);

    expect(ultimo?.label).toBe('Ana Salas');
    expect(ultimo?.routerLink).toBeUndefined();
    expect(anteultimo?.routerLink).toBe('/administracion/pacientes');
  });

  it('un 404 se traduce a S6 sin filtrar si el registro existe', () => {
    http
      .expectOne('/profiles/patients/pp-1')
      .flush(
        { code: 'NOT_FOUND', message: 'No existe el paciente pp-1' },
        { status: 404, statusText: 'Not Found' },
      );
    harness.detectChanges();

    const estado = interno<() => { status: string; message?: string }>('ficha')();
    expect(estado.status).toBe('not-found');
    // El mensaje del backend se descarta: repetirlo confirmaría que se consultó
    // por algo concreto.
    expect(estado.message).toBeUndefined();
  });
});

/**
 * Las relaciones asistenciales (V06-01) son un **bloque aparte** de la ficha, y
 * eso es lo que estas pruebas fijan: su lectura pide `CLINICIAN` o
 * `SECURITY_ADMIN`, y un `403` ahí no puede llevarse puesta la filiación, que es
 * lo que la persona vino a ver.
 *
 * Van en su propio `describe` porque necesitan **sesión con organización**: sin
 * `tenantId` la lectura no sale, que es el otro caso que se comprueba.
 */
describe('PatientDetail · relaciones asistenciales', () => {
  let harness: RouterTestingHarness;
  let componente: PatientDetail;
  let http: HttpTestingController;

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

  async function montar(conOrganizacion: boolean): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administracion/pacientes/:profileId', component: PatientDetail }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).start({
      accessToken: jwt({
        sub: 'u-1',
        roles: ['SECURITY_ADMIN'],
        tenants: conOrganizacion ? ['t-1'] : [],
      }),
      refreshToken: 'r-1',
    });

    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl('/administracion/pacientes/pp-1', PatientDetail);
  }

  function relaciones() {
    return (
      componente as unknown as {
        relaciones: () => { estado: string; items: readonly Record<string, unknown>[] };
      }
    ).relaciones();
  }

  /** La ficha y su catálogo, que salen igual haya relaciones o no. */
  function responderFicha(): void {
    http.expectOne('/profiles/patients/pp-1').flush(FICHA);
    http
      .expectOne((r) => r.url === '/terminology/concepts' && r.params.get('ids') !== null)
      .flush({ items: [], count: 0, limit: 50 });
  }

  afterEach(() => http.verify());

  it('pide las relaciones con la organización activa y el paciente de la ruta', async () => {
    await montar(true);

    const req = http.expectOne((r) => r.url === '/authz/care-relationships');
    expect(req.request.params.get('tenantId')).toBe('t-1');
    expect(req.request.params.get('patientProfileId')).toBe('pp-1');
    req.flush([]);

    responderFicha();
    expect(relaciones().estado).toBe('vacio');
  });

  it('sin organización activa no pide nada', async () => {
    await montar(false);
    responderFicha();

    // `http.verify()` del `afterEach` es la aserción: si hubiera salido la
    // lectura de relaciones, quedaría una petición sin responder.
    expect(relaciones().estado).toBe('vacio');
  });

  it('traduce el tipo de relación y calcula si está vigente', async () => {
    await montar(true);

    http.expectOne((r) => r.url === '/authz/care-relationships').flush([
      {
        id: 'cr-1',
        patientProfileId: 'pp-1',
        practitionerProfileId: 'pr-1',
        relationshipTypeConceptId: 'c-tratante',
        statusConceptId: 'c-act',
        validFrom: '2020-01-01T00:00:00.000Z',
      },
      {
        id: 'cr-2',
        patientProfileId: 'pp-1',
        practitionerProfileId: 'pr-2',
        relationshipTypeConceptId: 'c-tratante',
        statusConceptId: 'c-act',
        validFrom: '2020-01-01T00:00:00.000Z',
        validTo: '2021-01-01T00:00:00.000Z',
      },
    ]);

    // Las etiquetas de las relaciones se piden aparte: llegan después de la ficha.
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [
          {
            conceptId: 'c-tratante',
            code: 'ATTENDING',
            display: 'Médico tratante',
            codeSystemVersionId: 'v1',
          },
        ],
        count: 1,
        limit: 50,
      });

    responderFicha();

    const items = relaciones().items;
    expect(relaciones().estado).toBe('listo');
    expect(items[0]['tipo']).toBe('Médico tratante');
    // Sin `validTo`, la relación sigue abierta.
    expect(items[0]['vigente']).toBe(true);
    // Con un fin en el pasado, no.
    expect(items[1]['vigente']).toBe(false);
  });

  it('un 403 en las relaciones no tumba la ficha', async () => {
    await montar(true);

    http
      .expectOne((r) => r.url === '/authz/care-relationships')
      .flush(
        { code: 'FORBIDDEN', message: 'Rol insuficiente' },
        { status: 403, statusText: 'Forbidden' },
      );

    responderFicha();

    expect(relaciones().estado).toBe('sin-permiso');
    // Lo que importa: la filiación sigue en pie.
    expect(
      (componente as unknown as { ficha: () => { status: string } }).ficha().status,
    ).toBe('ready');
  });
});
