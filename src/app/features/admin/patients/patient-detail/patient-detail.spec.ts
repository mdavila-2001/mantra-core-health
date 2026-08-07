import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

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
        provideRouter([
          { path: 'administracion/pacientes/:profileId', component: PatientDetail },
        ]),
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

    http.expectOne((r) => r.url === '/terminology/concepts').flush({
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

    const contactos = interno<
      () => readonly { nombre: string; vinculo: string; esTutor: boolean; esEmergencia: boolean }[]
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
