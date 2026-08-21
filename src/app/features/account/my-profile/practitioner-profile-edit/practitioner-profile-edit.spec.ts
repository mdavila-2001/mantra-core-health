import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PractitionerProfileEdit } from './practitioner-profile-edit';

/**
 * Configurar el perfil profesional.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **Sólo se manda lo que cambió.** Un `PATCH` con los cuatro campos siempre
 *    funcionaría, pero mandar sólo el cambio es lo que hace que el registro de
 *    auditoría del backend diga qué tocó la persona, no que reescribió todo.
 * 2. **Especialidad y matrícula se agregan, nunca se editan.** Cada envío es un
 *    `POST` independiente del `PATCH` de presentación.
 * 3. **Sin nada que agregar, el botón queda deshabilitado.**
 */

const PERFIL_BASE = {
  profileId: 'per-1',
  personId: 'per-1',
  practitionerCode: 'MED-7',
  displayName: 'Dra. Salas',
  professionalTitle: 'Cardióloga',
  professionalBio: 'Bio actual.',
  photoFileId: null,
  practitionerCategoryConceptId: 'cat-1',
  verificationStatusConceptId: 'st-1',
  practiceStatusConceptId: 'st-2',
  acceptsNewPatients: true,
  telehealthAvailable: false,
  specialties: [],
  credentials: [],
  licenses: [],
  languages: [],
  affiliations: [],
  activity: { encounters: 0, medicationRequests: 0, clinicalNotes: 0, documents: 0 },
  createdAt: '2024-02-01T00:00:00.000Z',
};

describe('PractitionerProfileEdit', () => {
  let componente: PractitionerProfileEdit;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // El catálogo de departamentos bolivianos lo pide el constructor y ninguna
    // de estas pruebas habla de él. Se da por atendido acá para que `verify()`
    // siga vigilando lo que cada prueba sí afirma, en vez de fallar en todas
    // por una lectura que es de otra pantalla.
    for (const pendiente of http.match((r) => r.url.startsWith('/terminology/'))) {
      pendiente.flush({ items: [], count: 0, limit: 50, nextCursor: null });
    }
    http.verify();
  });

  /** El código interno del conjunto de especialidades (`MedicalSpecialtiesCatalog`). */
  const CODIGO_ESPECIALIDADES = 'VS_MEDICAL_SPECIALTY';

  /** Las dos especialidades con las que se responde el catálogo (TJ-3). */
  const CATALOGO = [
    {
      conceptId: 'esp-cardio',
      code: 'CARDIOLOGIA',
      display: 'Cardiología',
      codeSystemVersionId: 'csv-1',
    },
    {
      conceptId: 'esp-pediatria',
      code: 'PEDIATRIA',
      display: 'Pediatría',
      codeSystemVersionId: 'csv-1',
    },
  ];

  /**
   * La lectura del conjunto por su **código interno**.
   *
   * Discrimina por `?code=` y no sólo por la URL porque la pantalla lee dos
   * catálogos distintos de la misma ruta —especialidades y departamentos
   * bolivianos— y un `expectOne` por URL encuentra dos peticiones y falla.
   */
  function pedidoDeConjunto(codigo: string) {
    return http.expectOne(
      (r) => r.url === '/terminology/value-sets' && r.params.get('code') === codigo,
    );
  }

  /**
   * Responde las DOS lecturas del catálogo de especialidades: primero se
   * resuelve el conjunto por su código interno y después se expande. Va en el
   * armado porque la pantalla las pide al construirse, y sin respuesta el
   * `http.verify()` del cierre falla en todas las pruebas.
   *
   * El conjunto se busca **por su código**: desde que la pantalla también pide
   * el de departamentos bolivianos (`VS_ADMINISTRATIVE_AREA`) hay dos lecturas contra
   * `/terminology/value-sets`, y un `expectOne` sin filtro las encuentra a las
   * dos y falla. El de departamentos lo drena {@link responderDepartamentos}.
   */
  function responderCatalogo(opciones: readonly object[] = CATALOGO): void {
    pedidoDeConjunto(CODIGO_ESPECIALIDADES).flush({
      items: [
        {
          id: 'vs-esp',
          internalCode: CODIGO_ESPECIALIDADES,
          name: 'Especialidades',
          defaultVersionId: 'v1',
        },
      ],
      count: 1,
      limit: 50,
      nextCursor: null,
    });
    http
      .expectOne((r) => r.url.includes('/terminology/value-sets/vs-esp/$expand'))
      .flush({
        valueSetId: 'vs-esp',
        items: opciones,
        count: opciones.length,
        limit: 200,
        nextCursor: null,
      });
  }

  /**
   * Drena el catálogo de departamentos bolivianos, que la pantalla pide al
   * construirse para «departamento que expidió el documento». Ninguna de estas
   * pruebas lo mira; sin drenarlo, el `http.verify()` del cierre falla.
   */
  function responderDepartamentos(): void {
    for (const pedido of http.match(
      (r) =>
        r.url === '/terminology/value-sets' && r.params.get('code') === 'VS_ADMINISTRATIVE_AREA',
    )) {
      pedido.flush({ items: [], count: 0, limit: 50, nextCursor: null });
    }
  }

  function montarYCargar(perfil: object = {}): void {
    componente = TestBed.createComponent(PractitionerProfileEdit).componentInstance;
    http.expectOne('/profiles/practitioners/me/summary').flush({ ...PERFIL_BASE, ...perfil });
    responderCatalogo();
    responderDepartamentos();
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /**
   * Una señal escribible, **sin `bind`**.
   *
   * `interno` liga las funciones al componente, y `bind` devuelve una función
   * nueva que no conserva las propiedades de la original: la señal ligada se
   * puede leer pero pierde su `.set`.
   */
  function señal<T>(nombre: string): WritableSignal<T> {
    return (componente as unknown as Record<string, WritableSignal<T>>)[nombre];
  }

  it('siembra el formulario con lo ya guardado', () => {
    montarYCargar();

    expect(interno<() => string>('titulo')()).toBe('Cardióloga');
    expect(interno<() => string>('bio')()).toBe('Bio actual.');
    expect(interno<() => boolean>('aceptaNuevos')()).toBe(true);
  });

  /**
   * Un `PATCH` con los cuatro campos siempre funcionaría; mandar sólo el
   * cambio es lo que hace que el registro de auditoría diga qué se tocó.
   */
  it('guardarPresentacion manda sólo el campo que cambió', () => {
    montarYCargar();

    señal<string>('titulo').set('Cardióloga intervencionista');
    interno<() => void>('guardarPresentacion')();

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ professionalTitle: 'Cardióloga intervencionista' });
    req.flush({ ...PERFIL_BASE, professionalTitle: 'Cardióloga intervencionista' });
  });

  it('sin cambios, guardarPresentacion no manda ninguna petición', () => {
    montarYCargar();

    interno<() => void>('guardarPresentacion')();

    http.expectNone('/profiles/practitioners/me');
  });

  it('un booleano que vuelve a false también se detecta como cambio', () => {
    montarYCargar({ acceptsNewPatients: true });

    señal<boolean>('aceptaNuevos').set(false);
    interno<() => void>('guardarPresentacion')();

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.body).toEqual({ acceptsNewPatients: false });
    req.flush(PERFIL_BASE);
  });

  /* ---- especialidades: sólo se agregan ------------------------------------- */

  it('el botón de agregar especialidad exige haber elegido una', () => {
    montarYCargar();

    expect(interno<() => boolean>('puedeAgregarEspecialidad')()).toBe(false);

    señal<string>('nuevaEspecialidad').set('esp-cardio');
    expect(interno<() => boolean>('puedeAgregarEspecialidad')()).toBe(true);
  });

  it('agregarEspecialidad hace un POST y recarga el perfil', () => {
    montarYCargar();
    señal<string>('nuevaEspecialidad').set('esp-cardio');
    señal<boolean>('nuevaEspecialidadPrincipal').set(true);

    interno<() => void>('agregarEspecialidad')();

    const req = http.expectOne('/profiles/practitioners/per-1/specialties');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      specialtyConceptId: 'esp-cardio',
      isPrimary: true,
      boardCertified: false,
    });
    req.flush({ id: 'sp-1' });

    // Recarga: el perfil se vuelve a pedir entero.
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
  });

  /* ---- matrículas: sólo se agregan ------------------------------------------ */

  it('el botón de agregar matrícula exige un número', () => {
    montarYCargar();

    expect(interno<() => boolean>('puedeAgregarMatricula')()).toBe(false);

    señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
    expect(interno<() => boolean>('puedeAgregarMatricula')()).toBe(true);
  });

  it('agregarMatricula hace un POST y recarga el perfil', () => {
    montarYCargar();
    señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
    señal<string>('nuevaAutoridad').set('Colegio Médico');

    interno<() => void>('agregarMatricula')();

    const req = http.expectOne('/profiles/practitioners/per-1/jurisdiction-authorizations');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      licenseNumber: 'LIC-9',
      regulatoryAuthority: 'Colegio Médico',
    });
    req.flush({ id: 'ja-1' });

    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
  });

  /* -- Catálogo de especialidades (TJ-3 · F-19) ----------------------------- */

  it('ofrece las especialidades del catálogo del modelo, en castellano', () => {
    montarYCargar();

    // Antes esto pedía el catálogo por CAMPO DESTINO y llegaba una sola opción
    // («General medicine specialty»), que además no la usa ninguna fila.
    const opciones = interno<() => readonly { value: string; label: string }[]>('especialidades')();
    expect(opciones.map((o) => o.label)).toEqual(['Cardiología', 'Pediatría']);
    expect(interno<() => boolean>('catalogoCaido')()).toBe(false);
  });

  it('si el catálogo se cae, el resto del perfil sigue siendo editable', () => {
    componente = TestBed.createComponent(PractitionerProfileEdit).componentInstance;
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
    // Se cae SÓLO el de especialidades: el de departamentos es otra lectura y
    // se drena aparte, si no `expectOne` encuentra las dos.
    pedidoDeConjunto(CODIGO_ESPECIALIDADES).error(new ProgressEvent('error'), { status: 500 });
    responderDepartamentos();

    // Perder el catálogo no es perder el perfil: se avisa en su bloque y el
    // formulario de presentación queda intacto.
    expect(interno<() => boolean>('catalogoCaido')()).toBe(true);
    expect(interno<() => readonly unknown[]>('especialidades')()).toHaveLength(0);
    expect(señal<string>('titulo')()).toBe(PERFIL_BASE.professionalTitle);
  });

  it('reintentar vuelve a tocar la red: el fallo cacheado no dura la sesión', () => {
    componente = TestBed.createComponent(PractitionerProfileEdit).componentInstance;
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
    pedidoDeConjunto(CODIGO_ESPECIALIDADES).error(new ProgressEvent('error'), { status: 500 });
    responderDepartamentos();

    interno<() => void>('reintentarEspecialidades')();
    responderCatalogo();

    expect(interno<() => boolean>('catalogoCaido')()).toBe(false);
    expect(interno<() => readonly unknown[]>('especialidades')()).toHaveLength(2);
  });
});
