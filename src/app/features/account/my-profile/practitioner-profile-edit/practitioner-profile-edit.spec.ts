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
      // El catálogo de municipios (ALV-003) se pide al sembrar el formulario y
      // se cancela al desmontar: una petición cancelada no se puede flushear.
      if (!pendiente.cancelled) {
        pendiente.flush({ items: [], count: 0, limit: 50, nextCursor: null });
      }
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
   * El conjunto se busca **por su código**: la pantalla también pide, más
   * tarde —al sembrar el formulario, ALV-003—, el árbol de municipios
   * (`VS_BO_DEPARTMENT` + `VS_BO_MUNICIPALITY`) contra la misma ruta; ninguna
   * de estas pruebas lo mira y el `afterEach` genérico lo drena.
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

  function montarYCargar(perfil: object = {}): void {
    componente = TestBed.createComponent(PractitionerProfileEdit).componentInstance;
    http.expectOne('/profiles/practitioners/me/summary').flush({ ...PERFIL_BASE, ...perfil });
    responderCatalogo();
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

  /**
   * El editor tiene que ofrecer lo mismo que el registro — pedido del
   * propietario: «basarse completamente en el registro del doctor».
   *
   * Dos huecos que tenía y el contrato del `PATCH` ya aceptaba: el punto del
   * domicilio en el mapa y el título como lista cerrada. El registro los
   * preguntaba desde siempre; el perfil no dejaba tocarlos.
   */
  describe('lo que el registro pregunta y el editor no ofrecía', () => {
    it('siembra el mapa con el punto guardado del domicilio', () => {
      montarYCargar({
        homeAddress: { lines: 'Av. Banzer 3er anillo', latitude: -17.78, longitude: -63.18 },
      });

      expect(señal<unknown>('gpsDomicilioGuardado')()).toEqual({ lat: -17.78, lng: -63.18 });
    });

    it('media coordenada no siembra el mapa', () => {
      montarYCargar({ homeAddress: { lines: 'Av. Banzer', latitude: -17.78 } });

      expect(señal<unknown>('gpsDomicilioGuardado')()).toBeNull();
    });

    it('mover el punto lo manda como par, y no tocarlo no manda nada', () => {
      montarYCargar();

      señal<unknown>('gpsDomicilio').set({ lat: -16.5, lng: -68.15 });
      interno<() => void>('guardarPresentacion')();

      const req = http.expectOne('/profiles/practitioners/me');
      expect(req.request.body).toEqual({ homeLatitude: -16.5, homeLongitude: -68.15 });
      req.flush(PERFIL_BASE);
    });

    it('quitar el punto lo manda como null en los dos extremos', () => {
      montarYCargar();

      señal<unknown>('gpsDomicilio').set(null);
      interno<() => void>('guardarPresentacion')();

      const req = http.expectOne('/profiles/practitioners/me');
      expect(req.request.body).toEqual({ homeLatitude: null, homeLongitude: null });
      req.flush(PERFIL_BASE);
    });

    it('el título se elige de la MISMA lista cerrada que el registro', () => {
      // Escrito a mano, la misma profesión terminaba en «Médico», «medico» y
      // «Dr. en Medicina», y de ese título dependen el colegio de la
      // habilitación y qué especialidades se ofrecen.
      montarYCargar();

      const opciones = interno<readonly { value: string }[]>('titulosProfesionales');
      expect(opciones).toHaveLength(12);
      expect(opciones.map((o) => o.value)).toContain('Odontólogo / Odontóloga');
    });

    it('un título viejo fuera de la lista se avisa, no se borra solo', () => {
      // `PERFIL_BASE` trae «Cardióloga», que es de antes de la lista cerrada.
      montarYCargar();

      expect(interno<() => string>('titulo')()).toBe('Cardióloga');
      expect(interno<() => boolean>('tituloFueraDeLista')()).toBe(true);
    });

    it('un título de la lista no dispara el aviso', () => {
      montarYCargar({ professionalTitle: 'Médico / Médica' });

      expect(interno<() => boolean>('tituloFueraDeLista')()).toBe(false);
    });
  });

  /**
   * Las casillas que el alta de médico tiene y el editor no ofrecía.
   *
   * El alta pregunta tres nombres y deja sumar los que hagan falta —hay gente
   * con cuatro y con cinco— y ofrece varias especialidades de una sola vez. El
   * editor pedía UN segundo nombre y UNA especialidad por envío, así que quien
   * se registró con tres nombres los perdía al corregir cualquier otra cosa.
   */
  describe('las casillas sumables del registro', () => {
    it('reparte lo guardado en las tres casillas y en las agregadas', () => {
      montarYCargar({ middleName: 'Lucía María Belén' });

      expect(interno<() => string>('segundoNombre')()).toBe('Lucía');
      expect(interno<() => string>('tercerNombre')()).toBe('María');
      expect(interno<() => readonly string[]>('nombresExtra')()).toEqual(['Belén']);
    });

    it('los tres nombres viajan como UN solo campo del contrato', () => {
      montarYCargar({ middleName: 'Lucía' });

      señal<string>('tercerNombre').set('María');
      interno<() => void>('guardarPresentacion')();

      const req = http.expectOne('/profiles/practitioners/me');
      expect(req.request.body).toEqual({ middleName: 'Lucía María' });
      req.flush({ ...PERFIL_BASE, middleName: 'Lucía María' });
    });

    it('una casilla agregada y no llenada no manda un espacio de más', () => {
      montarYCargar({ middleName: 'Lucía' });

      interno<() => void>('agregarNombre')();
      interno<() => void>('guardarPresentacion')();

      // Nada cambió: la casilla vacía no es un cambio.
      http.expectNone('/profiles/practitioners/me');
    });

    it('quitar el segundo nombre lo manda vacío, que es cómo se borra', () => {
      montarYCargar({ middleName: 'Lucía' });

      señal<string>('segundoNombre').set('');
      interno<() => void>('guardarPresentacion')();

      const req = http.expectOne('/profiles/practitioners/me');
      expect(req.request.body).toEqual({ middleName: '' });
      req.flush(PERFIL_BASE);
    });

    it('agrega TODAS las especialidades elegidas, no la primera', () => {
      montarYCargar();

      señal<string>('nuevaEspecialidad').set('esp-cardio');
      interno<() => void>('agregarCasillaDeEspecialidad')();
      interno<(i: number, v: string | null) => void>('elegirEspecialidadExtra')(0, 'esp-pediatria');

      interno<() => void>('agregarEspecialidad')();

      const pedidos = http.match('/profiles/practitioners/per-1/specialties');
      expect(pedidos).toHaveLength(2);
      expect(pedidos.map((r) => (r.request.body as { specialtyConceptId: string }).specialtyConceptId)).toEqual([
        'esp-cardio',
        'esp-pediatria',
      ]);
      for (const pedido of pedidos) pedido.flush({ id: 'sp-x' });

      http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
    });

    it('elegir dos veces la misma declara una, no dos filas iguales', () => {
      montarYCargar();

      señal<string>('nuevaEspecialidad').set('esp-cardio');
      interno<() => void>('agregarCasillaDeEspecialidad')();
      interno<(i: number, v: string | null) => void>('elegirEspecialidadExtra')(0, 'esp-cardio');

      interno<() => void>('agregarEspecialidad')();

      const pedidos = http.match('/profiles/practitioners/per-1/specialties');
      expect(pedidos).toHaveLength(1);
      pedidos[0]!.flush({ id: 'sp-x' });

      http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
    });

    it('una casilla agregada alcanza para habilitar el botón', () => {
      montarYCargar();

      expect(interno<() => boolean>('puedeAgregarEspecialidad')()).toBe(false);

      interno<() => void>('agregarCasillaDeEspecialidad')();
      expect(interno<() => boolean>('puedeAgregarEspecialidad')()).toBe(false);

      interno<(i: number, v: string | null) => void>('elegirEspecialidadExtra')(0, 'esp-pediatria');
      expect(interno<() => boolean>('puedeAgregarEspecialidad')()).toBe(true);
    });

    it('quitar una casilla la saca de lo que se va a mandar', () => {
      montarYCargar();

      interno<() => void>('agregarCasillaDeEspecialidad')();
      interno<(i: number, v: string | null) => void>('elegirEspecialidadExtra')(0, 'esp-pediatria');
      interno<(i: number) => void>('quitarCasillaDeEspecialidad')(0);

      expect(interno<() => readonly string[]>('especialidadesElegidas')()).toEqual([]);
    });
  });

  it('siembra el formulario con lo ya guardado', () => {
    montarYCargar();

    expect(interno<() => string>('titulo')()).toBe('Cardióloga');
    expect(interno<() => string>('bio')()).toBe('Bio actual.');
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

  /**
   * «Acepto pacientes nuevos» ya no se pregunta (propietario, 13/09/2026):
   * siempre está habilitado. Un perfil viejo que lo tenía apagado se corrige en
   * el primer guardado.
   */
  it('un perfil que no aceptaba pacientes nuevos queda habilitado al guardar', () => {
    montarYCargar({ acceptsNewPatients: false });

    interno<() => void>('guardarPresentacion')();

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.body).toEqual({ acceptsNewPatients: true });
    req.flush(PERFIL_BASE);
  });

  /* ---- teléfonos: el campo del alta, con país ------------------------------ */

  it('no guarda con un teléfono a medias y lleva a «Contacto»', () => {
    montarYCargar();

    interno<{ setValue(valor: string): void }>('celularTrabajo').setValue('+591 7001');
    interno<() => void>('guardarPresentacion')();

    http.expectNone('/profiles/practitioners/me');
    expect(interno<() => number>('pestana')()).toBe(1);
  });

  it('un teléfono completo viaja con su prefijo', () => {
    montarYCargar();

    interno<{ setValue(valor: string): void }>('celularTrabajo').setValue('+591 70012345');
    interno<() => void>('guardarPresentacion')();

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.body).toEqual({ workMobilePhone: '+591 70012345' });
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

    interno<() => void>('agregarEspecialidad')();

    const req = http.expectOne('/profiles/practitioners/per-1/specialties');
    expect(req.request.method).toBe('POST');
    // Los dos interruptores se sacaron el 2026-09-10 —el alta de médico no los
    // tiene y esta pantalla se adapta a ella—, así que una especialidad que se
    // agrega después del alta es **adicional**: nunca desplaza a la principal, y
    // nadie declaró certificación de junta. Eso es lo que viaja, y por eso se
    // fija acá: si alguien vuelve a mandar `isPrimary: true` sin decidirlo,
    // esta prueba lo dice.
    expect(req.request.body).toEqual({
      specialtyConceptId: 'esp-cardio',
      isPrimary: false,
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

  it('conserva el respaldo local de matrícula mientras se completa el formulario', () => {
    montarYCargar();
    const respaldo = new File(['matrícula'], 'matricula.pdf', { type: 'application/pdf' });

    señal<readonly File[]>('archivoDeMatricula').set([respaldo]);

    expect(señal<readonly File[]>('archivoDeMatricula')()).toEqual([respaldo]);
  });

  it('limpia el respaldo local cuando la matrícula queda agregada', () => {
    montarYCargar();
    señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
    señal<readonly File[]>('archivoDeMatricula').set([
      new File(['matrícula'], 'matricula.pdf', { type: 'application/pdf' }),
    ]);

    interno<() => void>('agregarMatricula')();
    http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'file-9' });
    http.expectOne('/profiles/practitioners/per-1/jurisdiction-authorizations').flush({ id: 'ja-1' });
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);

    expect(señal<readonly File[]>('archivoDeMatricula')()).toEqual([]);
  });

  /* ---- el respaldo de la matrícula (2026-09-13) ----------------------------
     El pedido del propietario del 2026-09-10 —«poder agregar las matrículas y
     adjuntos en base a su módulo de creación de médico»— quedó a medias porque
     `NewJurisdictionAuthorization` no declaraba `fileId`. El selector estaba en
     la pantalla igual, así que aceptaba el PDF y lo tiraba al guardar. El campo
     existe desde el modelo v4.2.11; estas tres pruebas son las del diploma,
     aplicadas a la matrícula. */

  it('sin respaldo no sube nada: la matrícula va derecha', () => {
    montarYCargar();
    señal<string>('nuevoNumeroDeMatricula').set('LIC-9');

    interno<() => void>('agregarMatricula')();

    // Ni una petición al almacén de archivos.
    expect(http.match('/common/files/upload')).toHaveLength(0);
    http.expectOne('/profiles/practitioners/per-1/jurisdiction-authorizations').flush({ id: 'ja-1' });
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
  });

  it('con respaldo sube primero el archivo y manda su id como fileId', () => {
    montarYCargar();
    señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
    señal<string>('nuevaAutoridad').set('Colegio Médico');
    señal<readonly File[]>('archivoDeMatricula').set([
      new File(['x'], 'matricula.pdf', { type: 'application/pdf' }),
    ]);

    interno<() => void>('agregarMatricula')();

    // Primero el archivo…
    const subida = http.expectOne((r) => r.url.endsWith('/common/files/upload'));
    expect(subida.request.method).toBe('POST');
    subida.flush({ id: 'file-88' });

    // …y recién entonces la matrícula, con el identificador que devolvió.
    const req = http.expectOne('/profiles/practitioners/per-1/jurisdiction-authorizations');
    expect(req.request.body).toEqual({
      licenseNumber: 'LIC-9',
      regulatoryAuthority: 'Colegio Médico',
      fileId: 'file-88',
    });
    req.flush({ id: 'ja-1' });
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
  });

  it('si la subida falla, la matrícula NO se crea', () => {
    // Una matrícula sin el carnet que la persona creyó haber adjuntado es peor
    // que un error: nadie se entera hasta que se la rechazan.
    montarYCargar();
    señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
    señal<readonly File[]>('archivoDeMatricula').set([
      new File(['x'], 'matricula.pdf', { type: 'application/pdf' }),
    ]);

    interno<() => void>('agregarMatricula')();

    http
      .expectOne((r) => r.url.endsWith('/common/files/upload'))
      .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });

    expect(
      http.match('/profiles/practitioners/per-1/jurisdiction-authorizations'),
    ).toHaveLength(0);
    expect(interno<() => boolean>('guardandoMatricula')()).toBe(false);
  });

  it('la matrícula ofrece tres autoridades, con el colegio del título', () => {
    montarYCargar({ professionalTitle: 'Odontólogo / Odontóloga' });

    const opciones = interno<() => readonly { value: string; label: string }[]>('opcionesAutoridad')();
    expect(opciones.map((o) => o.label)).toEqual([
      'Ministerio de Salud',
      'SEDES (Gobernación)',
      'Colegio de la profesión (Colegio de Odontólogos de Bolivia)',
    ]);
    expect(opciones[2]?.value).toBe('Colegio de Odontólogos de Bolivia');
  });

  /* -- Las tablas de lo ya cargado (13/09/2026) ------------------------------ */

  it('las tres tablas muestran lo que el perfil ya tiene cargado', () => {
    montarYCargar({
      credentials: [
        { id: 'c-1', credentialTypeConceptId: 'tipo-1', number: 'TIT-1', stateConceptId: 'st-p' },
      ],
      specialties: [
        {
          id: 's-1',
          specialtyConceptId: 'esp-cardio',
          isPrimary: true,
          boardCertified: false,
          verificationStatusConceptId: 'st-v',
          verified: true,
        },
      ],
      licenses: [
        {
          id: 'l-1',
          jurisdictionConceptId: 'jur-1',
          licenseNumber: 'MP-1',
          regulatoryAuthority: 'Ministerio de Salud y Deportes',
          stateConceptId: 'st-a',
        },
      ],
    });

    expect(interno<() => readonly object[]>('filasFormacion')()).toEqual([
      expect.objectContaining({ id: 'c-1', numero: 'TIT-1', institucion: '—' }),
    ]);
    // Sin etiqueta del concepto, el nombre sale del catálogo de especialidades.
    expect(interno<() => readonly object[]>('filasEspecialidades')()).toEqual([
      expect.objectContaining({ especialidad: 'Cardiología', rol: 'Principal', estado: 'Verificada' }),
    ]);
    expect(interno<() => readonly object[]>('filasMatriculas')()).toEqual([
      expect.objectContaining({ numero: 'MP-1', autoridad: 'Ministerio de Salud y Deportes' }),
    ]);
  });

  /* -- Cuál es la principal (2026-09-13) -------------------------------------
     El bloqueo del 2026-09-10: al adaptar el editor al formulario del alta
     salieron los interruptores sueltos, y con ellos «Es mi especialidad
     principal». Vuelve como gesto sobre una fila que ya existe. */

  const DOS_ESPECIALIDADES = {
    specialties: [
      {
        id: 'e-1',
        specialtyConceptId: 'esp-cardio',
        isPrimary: true,
        boardCertified: true,
        verificationStatusConceptId: 'st-v',
        verified: true,
      },
      {
        id: 'e-2',
        specialtyConceptId: 'esp-pedia',
        isPrimary: false,
        boardCertified: false,
        verificationStatusConceptId: 'st-v',
        verified: true,
      },
    ],
  };

  it('cada fila dice si es la principal y si sigue vigente', () => {
    montarYCargar({
      specialties: [
        ...DOS_ESPECIALIDADES.specialties,
        {
          id: 'e-3',
          specialtyConceptId: 'esp-pedia',
          isPrimary: false,
          boardCertified: false,
          verificationStatusConceptId: 'st-v',
          verified: true,
          validTo: '2025-12-31T00:00:00.000Z',
        },
      ],
    });

    const filas = interno<() => readonly Record<string, unknown>[]>('filasEspecialidades')();
    expect(filas).toEqual([
      expect.objectContaining({ id: 'e-1', esPrincipal: true, vigente: true }),
      expect.objectContaining({ id: 'e-2', esPrincipal: false, vigente: true }),
      expect.objectContaining({ id: 'e-3', esPrincipal: false, vigente: false }),
    ]);
  });

  it('marcar como principal hace PATCH sin ningún profileId y recarga el perfil', () => {
    montarYCargar(DOS_ESPECIALIDADES);

    const fila = interno<() => readonly { id: string }[]>('filasEspecialidades')()[1]!;
    interno<(f: unknown) => void>('marcarComoPrincipal')(fila);

    // `me`, no el perfil de la petición: no hay especialidad ajena que marcar
    // escribiendo una URL.
    const req = http.expectOne('/profiles/practitioners/me/specialties/e-2/primary');
    expect(req.request.method).toBe('PATCH');
    req.flush({ id: 'e-2', isPrimary: true });

    http.expectOne('/profiles/practitioners/me/summary').flush({
      ...PERFIL_BASE,
      specialties: [
        { ...DOS_ESPECIALIDADES.specialties[0], isPrimary: false },
        { ...DOS_ESPECIALIDADES.specialties[1], isPrimary: true },
      ],
    });
    // Las lecturas de terminología que dispara la recarga las drena el
    // `afterEach`: el catálogo ya está resuelto y esta prueba no lo mira.

    expect(interno<() => string | null>('marcandoPrincipal')()).toBeNull();
    expect(interno<() => readonly Record<string, unknown>[]>('filasEspecialidades')()).toEqual([
      expect.objectContaining({ id: 'e-2', esPrincipal: true }),
      expect.objectContaining({ id: 'e-1', esPrincipal: false }),
    ]);
  });

  it('la que ya es principal no se vuelve a marcar', () => {
    montarYCargar(DOS_ESPECIALIDADES);

    const principal = interno<() => readonly { id: string }[]>('filasEspecialidades')()[0]!;
    interno<(f: unknown) => void>('marcarComoPrincipal')(principal);

    expect(http.match((r) => r.url.includes('/specialties/'))).toHaveLength(0);
  });

  it('una que ya no se ejerce no se puede marcar', () => {
    // El servidor la rechaza con 412; ofrecerlo sería prometer lo que no se
    // puede cumplir, así que ni se pide.
    montarYCargar({
      specialties: [
        {
          id: 'e-9',
          specialtyConceptId: 'esp-pedia',
          isPrimary: false,
          boardCertified: false,
          verificationStatusConceptId: 'st-v',
          verified: true,
          validTo: '2025-12-31T00:00:00.000Z',
        },
      ],
    });

    const vieja = interno<() => readonly { id: string }[]>('filasEspecialidades')()[0]!;
    interno<(f: unknown) => void>('marcarComoPrincipal')(vieja);

    expect(http.match((r) => r.url.includes('/specialties/'))).toHaveLength(0);
  });

  it('si el cambio falla, el perfil no se recarga y el botón se destraba', () => {
    montarYCargar(DOS_ESPECIALIDADES);

    const fila = interno<() => readonly { id: string }[]>('filasEspecialidades')()[1]!;
    interno<(f: unknown) => void>('marcarComoPrincipal')(fila);

    http
      .expectOne('/profiles/practitioners/me/specialties/e-2/primary')
      .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });

    expect(http.match('/profiles/practitioners/me/summary')).toHaveLength(0);
    expect(interno<() => string | null>('marcandoPrincipal')()).toBeNull();
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
    // Se cae SÓLO el de especialidades: el árbol de municipios es otra
    // lectura y el `afterEach` genérico la drena, si no `expectOne`
    // encontraría las dos.
    pedidoDeConjunto(CODIGO_ESPECIALIDADES).error(new ProgressEvent('error'), { status: 500 });

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

    interno<() => void>('reintentarEspecialidades')();
    responderCatalogo();

    expect(interno<() => boolean>('catalogoCaido')()).toBe(false);
    expect(interno<() => readonly unknown[]>('especialidades')()).toHaveLength(2);
  });

  /* ---- dirección (ALV-009): va con presentación, no es un formulario aparte -- */

  it('siembra la dirección con lo ya guardado', () => {
    montarYCargar({ homeAddress: { lines: 'Av. Brasil 1234' } });

    expect(interno<() => string>('direccion')()).toBe('Av. Brasil 1234');
  });

  it('guardarPresentacion manda homeAddressLines si la dirección cambió', () => {
    montarYCargar();

    señal<string>('direccion').set('Av. Brasil 1234');
    interno<() => void>('guardarPresentacion')();

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.body).toEqual({ homeAddressLines: 'Av. Brasil 1234' });
    req.flush({ ...PERFIL_BASE, homeAddress: { lines: 'Av. Brasil 1234' } });
  });

  /* ---- formación: sólo se agrega ------------------------------------------- */

  it('el botón de agregar formación exige tipo y número', () => {
    montarYCargar();

    expect(interno<() => boolean>('puedeAgregarCredencial')()).toBe(false);

    señal<string>('nuevoTipoCredencial').set('cred-titulo');
    expect(interno<() => boolean>('puedeAgregarCredencial')()).toBe(false);

    señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
    expect(interno<() => boolean>('puedeAgregarCredencial')()).toBe(true);
  });

  it('agregarCredencial hace un POST y recarga el perfil', () => {
    montarYCargar();
    señal<string>('nuevoTipoCredencial').set('cred-titulo');
    señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
    señal<string>('nuevaInstitucionCredencial').set('UMSA');

    interno<() => void>('agregarCredencial')();

    const req = http.expectOne('/profiles/practitioners/me/credentials');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      credentialTypeConceptId: 'cred-titulo',
      number: 'Médico cirujano',
      issuingInstitutionText: 'UMSA',
    });
    req.flush({ id: 'cred-1' });

    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
  });

  /* ---- el diploma del título (2026-09-10) ---------------------------------- */

  it('sin diploma no sube nada: el título va derecho', () => {
    montarYCargar();
    señal<string>('nuevoTipoCredencial').set('cred-titulo');
    señal<string>('nuevoNumeroCredencial').set('Médico cirujano');

    interno<() => void>('agregarCredencial')();

    // Ni una petición al almacén de archivos.
    expect(http.match('/common/files/upload')).toHaveLength(0);
    http.expectOne('/profiles/practitioners/me/credentials').flush({ id: 'cred-1' });
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
  });

  it('con diploma sube primero el archivo y manda su id como fileId', () => {
    montarYCargar();
    señal<string>('nuevoTipoCredencial').set('cred-titulo');
    señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
    señal<readonly File[]>('archivoDeCredencial').set([
      new File(['x'], 'diploma.pdf', { type: 'application/pdf' }),
    ]);

    interno<() => void>('agregarCredencial')();

    // Primero el archivo…
    const subida = http.expectOne((r) => r.url.endsWith('/common/files/upload'));
    expect(subida.request.method).toBe('POST');
    subida.flush({ id: 'file-77' });

    // …y recién entonces el título, con el identificador que devolvió.
    const req = http.expectOne('/profiles/practitioners/me/credentials');
    expect(req.request.body).toEqual({
      credentialTypeConceptId: 'cred-titulo',
      number: 'Médico cirujano',
      fileId: 'file-77',
    });
    req.flush({ id: 'cred-1' });
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
  });

  it('si la subida falla, el título NO se crea', () => {
    // Un título sin el diploma que la persona creyó haber adjuntado es peor que
    // un error: nadie se entera hasta que se lo rechazan.
    montarYCargar();
    señal<string>('nuevoTipoCredencial').set('cred-titulo');
    señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
    señal<readonly File[]>('archivoDeCredencial').set([
      new File(['x'], 'diploma.pdf', { type: 'application/pdf' }),
    ]);

    interno<() => void>('agregarCredencial')();

    http
      .expectOne((r) => r.url.endsWith('/common/files/upload'))
      .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });

    expect(http.match('/profiles/practitioners/me/credentials')).toHaveLength(0);
    expect(interno<() => boolean>('guardandoCredencial')()).toBe(false);
  });
});
