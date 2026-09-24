import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

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

  /**
   * Los parámetros de la URL con la que se entra al editor.
   *
   * Vive acá y no dentro de la prueba que lo usa porque el `ActivatedRoute`
   * falso se provee una sola vez, en el armado: reconfigurar el `TestBed` a
   * mitad de un archivo deja el inyector anterior a medio desmontar y ensucia
   * los demás specs del lote —comprobado: hacerlo puso en rojo pruebas de dos
   * pantallas que no tienen nada que ver con ésta—. El `getter` es lo que
   * permite que cada prueba lo cambie antes de montar.
   */
  let parametros: Record<string, string> = {};

  beforeEach(() => {
    parametros = {};
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get queryParamMap() {
                return convertToParamMap(parametros);
              },
            },
          },
        },
      ],
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

  /**
   * Monta **con vista**, que es lo que hace falta para mirar el panel abierto:
   * las demás pruebas de este archivo hablan con el componente y no necesitan
   * dibujarlo.
   *
   * Dibujarlo trae dos lecturas de más —el catálogo del tipo de credencial y
   * las etiquetas de los conceptos— y se responden acá en vez de en el
   * `afterEach` general: sólo aparecen cuando hay vista, así que drenarlas
   * para todo el archivo aflojaría el `verify()` de las otras treinta pruebas
   * sin necesidad.
   */
  function montarConVista(perfil: object = {}): ComponentFixture<PractitionerProfileEdit> {
    const fixture = TestBed.createComponent(PractitionerProfileEdit);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    http.expectOne('/profiles/practitioners/me/summary').flush({ ...PERFIL_BASE, ...perfil });
    responderCatalogo();
    fixture.detectChanges();
    for (const pendiente of http.match((r) => r.url.startsWith('/system-context/'))) {
      /* La forma sí importa: `app-concept-select` hace `options.map(…)` sin red
         de contención, así que una respuesta vacía mal formada revienta el
         render entero en vez de dejar el select sin opciones. */
      pendiente.flush({
        code: 'credential-type',
        name: 'Tipo de credencial',
        definitionId: 'def-1',
        valueSetId: 'vs-1',
        allowCustomValue: false,
        options: [],
      });
    }
    fixture.detectChanges();
    return fixture;
  }

  /** El panel que se está viendo. Los otros seis quedan en el DOM, ocultos. */
  function panelAbierto(fixture: ComponentFixture<PractitionerProfileEdit>): HTMLElement {
    const paneles = [...fixture.nativeElement.querySelectorAll('[role="tabpanel"]')];
    const abierto = paneles.find((p) => !(p as HTMLElement).hasAttribute('hidden'));
    expect(abierto).toBeDefined();
    return abierto as HTMLElement;
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
      expect(
        pedidos.map((r) => (r.request.body as { specialtyConceptId: string }).specialtyConceptId),
      ).toEqual(['esp-cardio', 'esp-pediatria']);
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

  /* ---- facturación: el NIT, que el alta no pregunta ------------------------
     El médico emite comprobantes y no tenía dónde declarar a nombre de quién
     salen (propietario, 19/09/2026). Viajan en el MISMO `PATCH` que el resto de
     la presentación, y con el mismo criterio: sólo si cambiaron. */

  it('siembra el NIT y la razón social que ya tenía el perfil', () => {
    montarYCargar({ taxId: '5414404011', taxHolderName: 'Consultorio Dra. Salas S.R.L.' });

    expect(interno<() => string>('nit')()).toBe('5414404011');
    expect(interno<() => string>('razonSocial')()).toBe('Consultorio Dra. Salas S.R.L.');
  });

  it('guardarPresentacion manda el NIT nuevo, y sólo el NIT', () => {
    montarYCargar();

    señal<string>('nit').set('5414404011');
    interno<() => void>('guardarPresentacion')();

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ taxId: '5414404011' });
    req.flush({ ...PERFIL_BASE, taxId: '5414404011' });
  });

  it('vaciar el NIT lo BORRA: viaja la cadena vacía, no se descarta', () => {
    // Es la única forma de sacar un NIT cargado mal. Descartar los vacíos
    // dejaría el número viejo para siempre.
    montarYCargar({ taxId: '5414404011' });

    señal<string>('nit').set('');
    interno<() => void>('guardarPresentacion')();

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.body).toEqual({ taxId: '' });
    req.flush({ ...PERFIL_BASE, taxId: '' });
  });

  it('el botón de guardar también se ofrece en la pestaña «Facturación»', () => {
    // Los tres paneles son un solo formulario: si el botón no se dibuja ahí,
    // el NIT se escribe y no hay cómo guardarlo.
    montarYCargar();

    señal<number>('pestana').set(2);
    expect(interno<() => boolean>('editandoPresentacion')()).toBe(true);
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

  /**
   * Se mudaron de «Credenciales» a «Datos personales» el 24/09/2026 (pedido
   * del propietario): la ficha ya las lee ahí, y el editor quedaba
   * desalineado con la pestaña que dice corregir.
   */
  it('«Agregar especialidades» vive en «Datos personales», no en «Credenciales»', () => {
    const fixture = montarConVista();

    // Pestaña 0, «Datos personales»: el select de especialidad está.
    expect(
      panelAbierto(fixture).querySelector('[data-testid="especialidad-select"]'),
    ).not.toBeNull();

    señal<number>('pestana').set(5);
    fixture.detectChanges();

    // Pestaña 5, «Credenciales»: ya no queda ni el formulario ni la tabla.
    const credenciales = panelAbierto(fixture);
    expect(credenciales.querySelector('[data-testid="especialidad-select"]')).toBeNull();
    expect(credenciales.querySelector('[data-testid="tabla-especialidades"]')).toBeNull();
    expect(credenciales.textContent).not.toContain('Agregar especialidades');
    // La matrícula, que sí es de esta pestaña, sigue estando.
    expect(credenciales.textContent).toContain('Agregar una matrícula');
  });

  it('el botón de agregar especialidad exige haber elegido una', () => {
    montarYCargar();

    expect(interno<() => boolean>('puedeAgregarEspecialidad')()).toBe(false);

    señal<string>('nuevaEspecialidad').set('esp-cardio');
    expect(interno<() => boolean>('puedeAgregarEspecialidad')()).toBe(true);
  });

  it('con tres especialidades cargadas deja agregar la cuarta, pero no otra casilla', () => {
    montarYCargar({
      specialties: [
        { id: 's-1', specialtyConceptId: 'esp-cardio', isPrimary: true },
        { id: 's-2', specialtyConceptId: 'esp-pediatria', isPrimary: false },
        { id: 's-3', specialtyConceptId: 'esp-endo', isPrimary: false },
      ],
    });

    señal<string>('nuevaEspecialidad').set('esp-orto');
    expect(interno<() => boolean>('puedeAgregarEspecialidad')()).toBe(true);

    interno<() => void>('agregarCasillaDeEspecialidad')();
    expect(interno<() => readonly string[]>('especialidadesExtra')()).toEqual([]);
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
    http
      .expectOne('/profiles/practitioners/per-1/jurisdiction-authorizations')
      .flush({ id: 'ja-1' });
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
    http
      .expectOne('/profiles/practitioners/per-1/jurisdiction-authorizations')
      .flush({ id: 'ja-1' });
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

    expect(http.match('/profiles/practitioners/per-1/jurisdiction-authorizations')).toHaveLength(0);
    expect(interno<() => boolean>('guardandoMatricula')()).toBe(false);
  });

  it('la matrícula ofrece tres autoridades, con el colegio del título', () => {
    montarYCargar({ professionalTitle: 'Odontólogo / Odontóloga' });

    const opciones =
      interno<() => readonly { value: string; label: string }[]>('opcionesAutoridad')();
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
      expect.objectContaining({
        especialidad: 'Cardiología',
        rol: 'Principal',
        estado: 'Verificada',
      }),
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

  it('Contacto ofrece una dirección de trabajo separada del domicilio', () => {
    const fixture = montarConVista();
    señal<number>('pestana').set(1);
    fixture.detectChanges();

    expect(
      panelAbierto(fixture).querySelector('[data-testid="edicion-direccion-trabajo"]'),
    ).not.toBeNull();
  });

  it('siembra la dirección laboral y su punto sin mezclarlos con el domicilio', () => {
    montarYCargar({
      homeAddress: { lines: 'Av. Brasil 1234', latitude: -16.5, longitude: -68.15 },
      workAddress: { lines: 'Calle Warnes 45', latitude: -17.78, longitude: -63.18 },
    });

    expect(interno<() => string>('direccionTrabajo')()).toBe('Calle Warnes 45');
    expect(señal<unknown>('gpsDomicilioGuardado')()).toEqual({ lat: -16.5, lng: -68.15 });
    expect(señal<unknown>('gpsTrabajoGuardado')()).toEqual({ lat: -17.78, lng: -63.18 });
  });

  it('guardarPresentacion manda workAddressLines sólo cuando cambia', () => {
    montarYCargar({ workAddress: { lines: 'Calle Warnes 45' } });

    señal<string>('direccionTrabajo').set('Av. Melchor Pinto 620');
    interno<() => void>('guardarPresentacion')();

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.body).toEqual({ workAddressLines: 'Av. Melchor Pinto 620' });
    req.flush({ ...PERFIL_BASE, workAddress: { lines: 'Av. Melchor Pinto 620' } });
  });

  it('guarda y quita el GPS laboral como par, separado del GPS del domicilio', () => {
    montarYCargar({
      homeAddress: { lines: 'Av. Brasil 1234', latitude: -16.5, longitude: -68.15 },
      workAddress: { lines: 'Calle Warnes 45', latitude: -17.78, longitude: -63.18 },
    });

    señal<unknown>('gpsTrabajo').set({ lat: -17.8, lng: -63.2 });
    interno<() => void>('guardarPresentacion')();

    const guardar = http.expectOne('/profiles/practitioners/me');
    expect(guardar.request.body).toEqual({ workLatitude: -17.8, workLongitude: -63.2 });
    guardar.flush(PERFIL_BASE);

    señal<unknown>('gpsTrabajo').set(null);
    interno<() => void>('guardarPresentacion')();

    const quitar = http.expectOne('/profiles/practitioners/me');
    expect(quitar.request.body).toEqual({ workLatitude: null, workLongitude: null });
    quitar.flush(PERFIL_BASE);
  });

  it('Contacto muestra selectores GPS independientes para domicilio y trabajo', () => {
    const fixture = montarConVista();
    señal<number>('pestana').set(1);
    fixture.detectChanges();

    const panel = panelAbierto(fixture);
    expect(panel.querySelector('app-ubicacion-picker[pinid="edicion-domicilio"]')).not.toBeNull();
    expect(panel.querySelector('app-ubicacion-picker[pinid="edicion-trabajo"]')).not.toBeNull();
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
    // La institución sale del catálogo desde el 13/09/2026: lo que viaja sigue
    // siendo el nombre, así que el cuerpo del POST no cambia de forma.
    señal<string>('institucionElegida').set('Universidad Mayor de San Andrés');

    interno<() => void>('agregarCredencial')();

    const req = http.expectOne('/profiles/practitioners/me/credentials');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      credentialTypeConceptId: 'cred-titulo',
      number: 'Médico cirujano',
      issuingInstitutionText: 'Universidad Mayor de San Andrés',
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

  /* ======================================================================
      Institución como lista, y las acciones de las tres tablas
      (propietario, 13/09/2026)
     ====================================================================== */

  describe('la institución sale de un catálogo, no del teclado', () => {
    it('lo elegido del catálogo viaja como el nombre de la institución', () => {
      montarYCargar();
      señal<string>('nuevoTipoCredencial').set('cred-titulo');
      señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
      señal<string>('institucionElegida').set('Universidad Mayor de San Simón');

      interno<() => void>('agregarCredencial')();

      const req = http.expectOne('/profiles/practitioners/me/credentials');
      // El valor de la opción ES el nombre: el contrato sigue recibiendo
      // `issuingInstitutionText`, no un id que el backend no sabría resolver.
      expect(req.request.body.issuingInstitutionText).toBe('Universidad Mayor de San Simón');
      req.flush({ id: 'cred-1' });
      http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
    });

    it('«otra» abre el campo a mano y manda lo escrito', () => {
      // Sin esta salida, una lista de universidades bolivianas le impide cargar
      // el título a cualquiera que se formó en el exterior.
      montarYCargar();
      señal<string>('nuevoTipoCredencial').set('cred-titulo');
      señal<string>('nuevoNumeroCredencial').set('Médico cirujano');

      expect(interno<() => boolean>('institucionFueraDeCatalogo')()).toBe(false);
      señal<string>('institucionElegida').set('__otra__');
      expect(interno<() => boolean>('institucionFueraDeCatalogo')()).toBe(true);

      señal<string>('institucionEscrita').set('  Universidad de La Habana  ');
      interno<() => void>('agregarCredencial')();

      const req = http.expectOne('/profiles/practitioners/me/credentials');
      expect(req.request.body.issuingInstitutionText).toBe('Universidad de La Habana');
      req.flush({ id: 'cred-1' });
      http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
    });

    it('sin elegir institución no viaja el campo', () => {
      montarYCargar();
      señal<string>('nuevoTipoCredencial').set('cred-titulo');
      señal<string>('nuevoNumeroCredencial').set('Médico cirujano');

      interno<() => void>('agregarCredencial')();

      const req = http.expectOne('/profiles/practitioners/me/credentials');
      expect('issuingInstitutionText' in req.request.body).toBe(false);
      req.flush({ id: 'cred-1' });
      http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
    });
  });

  describe('las acciones de las tablas', () => {
    /** Un perfil con una fila de cada cosa, para que las tablas tengan qué mostrar. */
    const PERFIL_CON_FILAS = {
      credentials: [
        {
          id: 'cred-9',
          credentialTypeConceptId: 'cred-titulo',
          number: 'TIT-1',
          issuingInstitutionText: 'Universidad Mayor de San Andrés',
          issueDate: '2016-03-01T12:00:00.000Z',
          stateConceptId: 'st-pending',
          fileId: 'file-diploma',
        },
        {
          // Verificado: ni se corrige ni se retira, y la tabla no ofrece el botón.
          id: 'cred-10',
          credentialTypeConceptId: 'cred-titulo',
          number: 'TIT-2',
          stateConceptId: 'st-ok',
          verifiedAt: '2020-01-01T00:00:00.000Z',
        },
      ],
      specialties: [
        {
          id: 'spec-9',
          specialtyConceptId: 'esp-cardio',
          isPrimary: true,
          boardCertified: false,
          verificationStatusConceptId: 'st-pending',
          verified: false,
        },
      ],
      licenses: [
        {
          id: 'lic-9',
          jurisdictionConceptId: 'jur-bo',
          licenseNumber: 'MP-123',
          regulatoryAuthority: 'SEDES Santa Cruz',
          stateConceptId: 'st-ok',
          fileId: 'file-carnet',
        },
      ],
    };

    /** Responde que sí al diálogo de confirmación, sin montar el `<dialog>`. */
    function confirmarSiempre(): void {
      const dialogos = interno<{ confirm: () => Promise<boolean> }>('dialogs');
      dialogos.confirm = () => Promise.resolve(true);
    }

    it('editar una especialidad no ofrece el seleccionable de certificación de junta', () => {
      const fixture = montarConVista({
        ...PERFIL_CON_FILAS,
        specialties: [{ ...PERFIL_CON_FILAS.specialties[0], boardCertified: true }],
      });
      const fila = interno<() => readonly { id: string }[]>('filasEspecialidades')()[0]!;
      interno<(f: unknown) => void>('editarEspecialidad')(fila);
      fixture.detectChanges();

      const dialogo = fixture.nativeElement.querySelector('[data-testid="edicion-dialogo"]');
      expect(dialogo).not.toBeNull();
      expect(dialogo.textContent).not.toContain('Certificada por el colegio o consejo');
      expect(dialogo.querySelector('app-switch')).toBeNull();

      señal<string | null>('edicionEspecialidad').set('esp-pediatria');
      interno<() => void>('guardarEdicion')();
      const request = http.expectOne('/profiles/practitioners/me/specialties/spec-9');
      expect(request.request.method).toBe('PATCH');
      expect(request.request.body).toEqual({ specialtyConceptId: 'esp-pediatria' });
      request.flush(null);
      http
        .expectOne('/profiles/practitioners/me/summary')
        .flush({ ...PERFIL_BASE, ...PERFIL_CON_FILAS });
    });

    it('la fila pendiente se puede corregir y retirar; la verificada no', () => {
      montarYCargar(PERFIL_CON_FILAS);

      const filas =
        interno<() => readonly { id: string; pendiente: boolean }[]>('filasFormacion')();
      expect(filas.find((f) => f.id === 'cred-9')?.pendiente).toBe(true);
      // Un título ya verificado es un hecho de quien lo comprobó: el servidor
      // responde 422 y la tabla no ofrece el botón.
      expect(filas.find((f) => f.id === 'cred-10')?.pendiente).toBe(false);
    });

    it('retirar un título confirma primero y después hace el DELETE', async () => {
      montarYCargar(PERFIL_CON_FILAS);
      confirmarSiempre();

      const fila = interno<() => readonly { id: string }[]>('filasFormacion')().find(
        (f) => f.id === 'cred-9',
      );
      interno<(f: unknown) => void>('retirarFormacion')(fila);
      await Promise.resolve();
      await Promise.resolve();

      const req = http.expectOne('/profiles/practitioners/me/credentials/cred-9');
      expect(req.request.method).toBe('DELETE');
      req.flush(null);
      http
        .expectOne('/profiles/practitioners/me/summary')
        .flush({ ...PERFIL_BASE, ...PERFIL_CON_FILAS });
    });

    it('retirar una especialidad y una matrícula pega en su propia ruta', async () => {
      montarYCargar(PERFIL_CON_FILAS);
      confirmarSiempre();

      const especialidad = interno<() => readonly { id: string }[]>('filasEspecialidades')()[0];
      interno<(f: unknown) => void>('retirarEspecialidad')(especialidad);
      await Promise.resolve();
      await Promise.resolve();

      const reqEspecialidad = http.expectOne('/profiles/practitioners/me/specialties/spec-9');
      expect(reqEspecialidad.request.method).toBe('DELETE');
      reqEspecialidad.flush(null);
      http
        .expectOne('/profiles/practitioners/me/summary')
        .flush({ ...PERFIL_BASE, ...PERFIL_CON_FILAS });

      const matricula = interno<() => readonly { id: string }[]>('filasMatriculas')()[0];
      interno<(f: unknown) => void>('retirarMatricula')(matricula);
      await Promise.resolve();
      await Promise.resolve();

      const reqMatricula = http.expectOne(
        '/profiles/practitioners/me/jurisdiction-authorizations/lic-9',
      );
      expect(reqMatricula.request.method).toBe('DELETE');
      reqMatricula.flush(null);
      http
        .expectOne('/profiles/practitioners/me/summary')
        .flush({ ...PERFIL_BASE, ...PERFIL_CON_FILAS });
    });

    it('editar un título siembra el diálogo con lo que hay y manda un PATCH', () => {
      montarYCargar(PERFIL_CON_FILAS);

      const fila = interno<() => readonly { id: string }[]>('filasFormacion')().find(
        (f) => f.id === 'cred-9',
      );
      interno<(f: unknown) => void>('editarFormacion')(fila);

      // Los valores salen del perfil CRUDO: la fila de la tabla lleva las
      // etiquetas ya resueltas, y devolverlas mandaría texto donde el servidor
      // espera un uuid de concepto.
      expect(señal<string>('edicionTipo')()).toBe('cred-titulo');
      expect(señal<string>('edicionNumero')()).toBe('TIT-1');
      // La institución estaba en el catálogo, así que se siembra el desplegable
      // y no el campo a mano.
      expect(señal<string>('edicionInstitucionElegida')()).toBe('Universidad Mayor de San Andrés');
      expect(interno<() => boolean>('edicionInstitucionFueraDeCatalogo')()).toBe(false);

      señal<string>('edicionNumero').set('TIT-1-CORREGIDO');
      interno<() => void>('guardarEdicion')();

      const req = http.expectOne('/profiles/practitioners/me/credentials/cred-9');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({
        credentialTypeConceptId: 'cred-titulo',
        number: 'TIT-1-CORREGIDO',
        issuingInstitutionText: 'Universidad Mayor de San Andrés',
        issueDate: '2016-03-01',
      });
      req.flush(null);
      expect(señal<unknown>('edicion')()).toBeNull();
      http
        .expectOne('/profiles/practitioners/me/summary')
        .flush({ ...PERFIL_BASE, ...PERFIL_CON_FILAS });
    });

    it('una institución vieja escrita a mano abre el campo a mano, no se pisa', () => {
      // Mismo criterio que el título profesional: un dato cargado antes de la
      // lista no se corrige solo al abrir la pantalla.
      montarYCargar({
        ...PERFIL_CON_FILAS,
        credentials: [
          { ...PERFIL_CON_FILAS.credentials[0], issuingInstitutionText: 'UMSA' },
          PERFIL_CON_FILAS.credentials[1],
        ],
      });

      const fila = interno<() => readonly { id: string }[]>('filasFormacion')().find(
        (f) => f.id === 'cred-9',
      );
      interno<(f: unknown) => void>('editarFormacion')(fila);

      expect(señal<string>('edicionInstitucionElegida')()).toBe('__otra__');
      expect(señal<string>('edicionInstitucionEscrita')()).toBe('UMSA');
    });

    it('descargar el diploma pide el CONTENIDO del archivo, no una URL firmada', () => {
      montarYCargar(PERFIL_CON_FILAS);

      const fila = interno<() => readonly { id: string }[]>('filasFormacion')().find(
        (f) => f.id === 'cred-9',
      );
      interno<(f: unknown) => void>('descargarDiploma')(fila);

      // Por `/content` y no por `/download-url`: la CSP del servidor deja
      // `connect-src` en `'self'` y la URL firmada apunta a `file://local/<sha>`,
      // que el navegador no abre — el mismo defecto que ya tenía la foto de perfil.
      const req = http.expectOne('/common/files/file-diploma/content');
      expect(req.request.method).toBe('GET');
      expect(interno<() => string | null>('descargando')()).toBe('cred-9');
      req.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    });

    it('la matrícula baja su propio respaldo', () => {
      montarYCargar(PERFIL_CON_FILAS);

      const fila = interno<() => readonly { id: string }[]>('filasMatriculas')()[0];
      interno<(f: unknown) => void>('descargarCarnet')(fila);

      http.expectOne('/common/files/file-carnet/content').flush(new Blob(['%PDF']));
    });

    it('si la descarga falla, lo dice y el botón deja de estar cargando', () => {
      montarYCargar(PERFIL_CON_FILAS);

      const fila = interno<() => readonly { id: string }[]>('filasFormacion')().find(
        (f) => f.id === 'cred-9',
      );
      interno<(f: unknown) => void>('descargarDiploma')(fila);

      http
        .expectOne('/common/files/file-diploma/content')
        .flush(null, { status: 500, statusText: 'Server Error' });

      // Sin esto, un fallo dejaba el botón girando para siempre y bloqueaba las
      // descargas de las otras filas, que comparten la señal.
      expect(interno<() => string | null>('descargando')()).toBeNull();
    });
  });

  /**
   * Disciplina de tablas: buscador y paginación (pedido del propietario,
   * 24/09/2026). Las tres tablas —Formación, Especialidades y Matrículas—
   * comparten la misma implementación, así que se prueba a fondo en una y se
   * repite el filtro en las otras dos.
   */
  describe('buscador y paginación de las tres tablas', () => {
    /** Siete títulos: más que una página (5), para poder probar el corte. */
    const SIETE_TITULOS = Array.from({ length: 7 }, (_, i) => ({
      id: `cred-${i}`,
      credentialTypeConceptId: 'cred-titulo',
      number: `TIT-${i}`,
      issuingInstitutionText:
        i === 0 ? 'Universidad Mayor de San Andrés' : 'Universidad Católica Boliviana',
      issueDate: `2016-0${(i % 9) + 1}-01T12:00:00.000Z`,
      stateConceptId: 'st-pending',
    }));

    it('arranca mostrando la primera página, sin recortar por búsqueda', () => {
      montarYCargar({ credentials: SIETE_TITULOS });

      expect(interno<() => number>('totalFormacion')()).toBe(7);
      expect(interno<() => number>('totalFormacionFiltrada')()).toBe(7);
      expect(interno<() => readonly unknown[]>('formacionEnPagina')()).toHaveLength(5);
      expect(interno<() => number>('paginaActualFormacion')()).toBe(1);
    });

    it('el buscador filtra por tipo, número o institución, sin tildes ni mayúsculas', () => {
      montarYCargar({ credentials: SIETE_TITULOS });

      interno<(texto: string) => void>('buscarEnFormacion')('andres');

      expect(interno<() => number>('totalFormacionFiltrada')()).toBe(1);
      expect(
        interno<() => readonly { numero: string }[]>('formacionEnPagina')().map((f) => f.numero),
      ).toEqual(['TIT-0']);
      // El total sin filtrar no cambia: el buscador recorta la VISTA, no borra nada.
      expect(interno<() => number>('totalFormacion')()).toBe(7);
    });

    it('paginar corta el resultado, y buscar vuelve a la página 1', () => {
      montarYCargar({ credentials: SIETE_TITULOS });

      interno<(pagina: number) => void>('irAPaginaDeFormacion')(2);
      expect(interno<() => readonly unknown[]>('formacionEnPagina')()).toHaveLength(2);
      expect(interno<() => number>('paginaActualFormacion')()).toBe(2);

      // Buscar algo que da una sola página: quedarse en la 2 mostraría una
      // tabla vacía con el paginador diciendo que hay más.
      interno<(texto: string) => void>('buscarEnFormacion')('catolica');
      expect(interno<() => number>('paginaActualFormacion')()).toBe(1);
      expect(interno<() => number>('totalFormacionFiltrada')()).toBe(6);
    });

    it('sin coincidencias, lo dice sin tocar la lectura completa', () => {
      montarYCargar({ credentials: SIETE_TITULOS });

      interno<(texto: string) => void>('buscarEnFormacion')('inexistente');

      expect(interno<() => boolean>('sinCoincidenciasFormacion')()).toBe(true);
      expect(interno<() => readonly unknown[]>('formacionEnPagina')()).toHaveLength(0);
      expect(interno<() => number>('totalFormacion')()).toBe(7);
    });

    it('sin nada cargado no hay «sin coincidencias»: es el vacío de siempre', () => {
      montarYCargar({ credentials: [] });

      expect(interno<() => boolean>('sinCoincidenciasFormacion')()).toBe(false);
      expect(interno<() => number>('totalFormacion')()).toBe(0);
    });

    it('la misma disciplina en Especialidades: buscador y «sin coincidencias»', () => {
      montarYCargar({
        specialties: [
          {
            id: 'spec-1',
            specialtyConceptId: 'esp-cardio',
            isPrimary: true,
            boardCertified: false,
            verificationStatusConceptId: 'st-pending',
            verified: false,
          },
          {
            id: 'spec-2',
            specialtyConceptId: 'esp-pediatria',
            isPrimary: false,
            boardCertified: false,
            verificationStatusConceptId: 'st-pending',
            verified: false,
          },
        ],
      });

      interno<(texto: string) => void>('buscarEnEspecialidades')('cardio');
      expect(interno<() => number>('totalEspecialidadesFiltrada')()).toBe(1);

      interno<(texto: string) => void>('buscarEnEspecialidades')('no existe');
      expect(interno<() => boolean>('sinCoincidenciasEspecialidades')()).toBe(true);
    });

    it('la misma disciplina en Matrículas: buscador y «sin coincidencias»', () => {
      montarYCargar({
        licenses: [
          {
            id: 'lic-1',
            jurisdictionConceptId: 'jur-bo',
            licenseNumber: 'MP-123',
            regulatoryAuthority: 'SEDES Santa Cruz',
            stateConceptId: 'st-ok',
          },
          {
            id: 'lic-2',
            jurisdictionConceptId: 'jur-bo',
            licenseNumber: 'MP-456',
            regulatoryAuthority: 'Ministerio de Salud',
            stateConceptId: 'st-ok',
          },
        ],
      });

      interno<(texto: string) => void>('buscarEnMatriculas')('sedes');
      expect(interno<() => number>('totalMatriculasFiltrada')()).toBe(1);

      interno<(texto: string) => void>('buscarEnMatriculas')('no existe');
      expect(interno<() => boolean>('sinCoincidenciasMatriculas')()).toBe(true);
    });
  });

  /**
   * «Actividad»: la pestaña que existe **para** decir que no se edita.
   *
   * El doctor pidió que el editor tenga todas las pestañas de la ficha (C-05).
   * Los cuatro contadores no se editan —son cuentas de lo que ya pasó, y uno
   * escrito a mano deja de contar—, así que la respuesta no fue sacar la
   * pestaña sino tenerla sin un solo campo y explicando por qué.
   *
   * Las dos mitades se fijan acá, porque cada una se puede romper sin la otra:
   * alguien puede volver a quitar la pestaña, y alguien puede «completarla»
   * poniéndole controles.
   */
  describe('la pestaña «Actividad» del editor', () => {
    it('está, y enumera los cuatro contadores', () => {
      const fixture = montarConVista();

      señal<number>('pestana').set(6);
      fixture.detectChanges();

      const lista = fixture.nativeElement.querySelector('[data-testid="edicion-actividad"]');
      expect(lista).not.toBeNull();
      expect(lista.querySelectorAll('li')).toHaveLength(4);
    });

    it('no ofrece ni un control para escribir', () => {
      const fixture = montarConVista();

      señal<number>('pestana').set(6);
      fixture.detectChanges();

      /* El panel VISIBLE, no el primero del documento: buscar en «Datos
         personales» —que sí tiene campos— daría rojo por mirar donde no es. */
      expect(panelAbierto(fixture).querySelectorAll('input, select, textarea')).toHaveLength(0);
    });

    it('no muestra «Guardar cambios», porque no hay nada que guardar', () => {
      montarConVista();

      señal<number>('pestana').set(6);
      expect(interno<() => boolean>('editandoPresentacion')()).toBe(false);
    });
  });

  /**
   * Lo que el alta pregunta, el editor muestra y nadie puede corregir acá.
   *
   * «Editar muestre TODOS los campos» (C-05). Estos tres no se pueden escribir
   * —el contrato del perfil no los acepta, y el correo de trabajo está
   * excluido a propósito porque es la identidad de acceso—, y hasta el
   * 21/09/2026 el editor sencillamente no los mostraba: quien venía a
   * corregirlos no encontraba ni el dato ni el motivo.
   *
   * Las tres pruebas cubren las tres formas de romperlo: que el dato
   * desaparezca, que alguien le ponga un control, y que alguien lo mande en el
   * `PATCH` creyendo que ahí se guarda.
   */
  describe('lo que se muestra y no se corrige', () => {
    const CON_IDENTIDAD = {
      nationalId: '5414404',
      issuerAdministrativeAreaConceptId: 'dep-scz',
      email: 'dra.salas@alovida.mock',
    };

    it('«Datos personales» muestra el documento, sin control para escribirlo', () => {
      const fixture = montarConVista(CON_IDENTIDAD);

      const bloque = panelAbierto(fixture).querySelector('[data-testid="edicion-documento"]');
      expect(bloque).not.toBeNull();
      expect(bloque?.textContent).toContain('5414404');
      expect(bloque?.querySelectorAll('input, select, textarea')).toHaveLength(0);
    });

    it('«Contacto» muestra el correo de trabajo, sin control para escribirlo', () => {
      const fixture = montarConVista(CON_IDENTIDAD);

      señal<number>('pestana').set(1);
      fixture.detectChanges();

      const bloque = panelAbierto(fixture).querySelector('[data-testid="edicion-correo-trabajo"]');
      expect(bloque).not.toBeNull();
      expect(bloque?.textContent).toContain('dra.salas@alovida.mock');
      expect(bloque?.querySelectorAll('input, select, textarea')).toHaveLength(0);
    });

    it('prefiere workEmail cuando el correo de acceso es personal', () => {
      const fixture = montarConVista({
        ...CON_IDENTIDAD,
        email: 'dra.salas.personal@alovida.mock',
        workEmail: 'dra.salas@hospital.mock',
      });

      señal<number>('pestana').set(1);
      fixture.detectChanges();

      const bloque = panelAbierto(fixture).querySelector('[data-testid="edicion-correo-trabajo"]');
      expect(bloque?.textContent).toContain('dra.salas@hospital.mock');
      expect(bloque?.textContent).not.toContain('dra.salas.personal@alovida.mock');
    });

    it('guardar no manda ninguno de los tres', () => {
      montarYCargar(CON_IDENTIDAD);

      señal<string>('titulo').set('Cardióloga intervencionista');
      interno<() => void>('guardarPresentacion')();

      const req = http.expectOne('/profiles/practitioners/me');
      expect(req.request.body).toEqual({ professionalTitle: 'Cardióloga intervencionista' });
      req.flush(PERFIL_BASE);
    });
  });

  /**
   * El rechazo del servidor, anclado al campo que nombra.
   *
   * Hasta el 21/09/2026 un `PATCH` rechazado decía sólo «No se pudo guardar el
   * cambio»: el detalle que el servidor manda se tiraba entero. Con quince
   * campos en un mismo formulario, eso deja probando de nuevo lo mismo.
   *
   * El cuerpo de los rechazos es el del contrato del proyecto
   * (`details.violations`, con el nombre del campo al frente del mensaje), no
   * uno inventado para la prueba.
   */
  describe('cuando el servidor rechaza el guardado', () => {
    function rechazar(cuerpo: object, status = 422): void {
      montarYCargar();
      señal<string>('nit').set('12345678');
      interno<() => void>('guardarPresentacion')();
      http
        .expectOne('/profiles/practitioners/me')
        .flush(cuerpo, { status, statusText: 'Unprocessable Entity' });
    }

    it('el mensaje del campo queda pegado a ese campo', () => {
      rechazar({
        code: 'VALIDATION_FAILED',
        message: 'Validación fallida',
        details: { violations: ['taxId no existe en el padrón.'] },
        timestamp: '2026-09-21T00:00:00.000Z',
        path: '/profiles/practitioners/me',
      });

      expect(interno<(c: string) => string>('errorDelServidor')('taxId')).toContain('padrón');
      // Y no se derrama sobre los demás: un campo sin problema queda limpio.
      expect(interno<(c: string) => string>('errorDelServidor')('personalEmail')).toBe('');
    });

    it('un rechazo sin campo sigue saliendo por el aviso general', () => {
      rechazar(
        {
          code: 'INTERNAL',
          message: 'Algo salió mal',
          timestamp: '2026-09-21T00:00:00.000Z',
          path: '/profiles/practitioners/me',
        },
        500,
      );

      expect(interno<(c: string) => string>('errorDelServidor')('taxId')).toBe('');
    });

    /**
     * El nivel inválido del contrato: un cuerpo que NO tiene la forma que el
     * proyecto documenta. Pasa de verdad —un balanceador que devuelve su
     * propio HTML, un servicio que contesta texto plano— y lo que no puede
     * pasar es que el formulario se quede mudo o se caiga: sin campo que
     * señalar, el mensaje tiene que salir igual por el aviso general.
     */
    it('un cuerpo que no respeta el contrato de errores no deja al formulario mudo', () => {
      rechazar('502 Bad Gateway' as unknown as object, 502);

      expect(interno<(c: string) => string>('errorDelServidor')('taxId')).toBe('');
      // Y lo que se escribió sigue ahí: un cuerpo raro no puede costarle a
      // nadie lo que ya había tecleado.
      expect(señal<string>('nit')()).toBe('12345678');
    });

    /**
     * Segundo nivel inválido: el cuerpo tiene la forma correcta pero
     * `violations` no es la lista de textos que el contrato promete. Leerla
     * como si lo fuera es la forma más barata de romper la pantalla con un
     * dato del servidor.
     */
    it('unas violaciones con la forma equivocada tampoco rompen nada', () => {
      rechazar({
        code: 'VALIDATION_ERROR',
        message: 'Revisá los datos',
        timestamp: '2026-09-21T00:00:00.000Z',
        path: '/profiles/practitioners/me',
        details: { violations: { taxId: 'no es una lista' } },
      });

      expect(interno<(c: string) => string>('errorDelServidor')('taxId')).toBe('');
      expect(señal<string>('nit')()).toBe('12345678');
    });

    /**
     * Que el getter devuelva el mensaje no prueba que se vea: falta que esté
     * enlazado al campo correcto, que es el error que un `errorMessage` mal
     * puesto comete en silencio. Esta prueba mira el DOM del panel abierto.
     */
    it('y se pinta debajo del campo que nombra, no en otro', () => {
      const fixture = montarConVista();

      señal<number>('pestana').set(2);
      señal<string>('nit').set('12345678');
      interno<() => void>('guardarPresentacion')();
      http.expectOne('/profiles/practitioners/me').flush(
        {
          code: 'VALIDATION_FAILED',
          message: 'Validación fallida',
          details: { violations: ['taxId no existe en el padrón.'] },
          timestamp: '2026-09-21T00:00:00.000Z',
          path: '/profiles/practitioners/me',
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
      fixture.detectChanges();

      const campos = [...panelAbierto(fixture).querySelectorAll('app-form-field')];
      const nit = campos.find((c) => (c.textContent ?? '').includes('NIT'));
      const razonSocial = campos.find((c) => (c.textContent ?? '').includes('Razón social'));

      expect(nit?.textContent).toContain('padrón');
      expect(razonSocial?.textContent).not.toContain('padrón');
    });

    it('un guardado nuevo limpia los rechazos del anterior', () => {
      rechazar({
        code: 'VALIDATION_FAILED',
        message: 'Validación fallida',
        details: { violations: ['taxId no existe en el padrón.'] },
        timestamp: '2026-09-21T00:00:00.000Z',
        path: '/profiles/practitioners/me',
      });
      expect(interno<(c: string) => string>('errorDelServidor')('taxId')).toContain('padrón');

      // Sin esto, un NIT corregido seguiría mostrando el error del intento
      // anterior aunque el servidor ya lo haya aceptado.
      señal<string>('nit').set('87654321');
      interno<() => void>('guardarPresentacion')();
      http.expectOne('/profiles/practitioners/me').flush(PERFIL_BASE);

      expect(interno<(c: string) => string>('errorDelServidor')('taxId')).toBe('');
    });

    /**
     * Un intento que no llega al servidor no tiene quién confirme los rechazos
     * del anterior. Hasta el 22/09/2026 se quedaban pintados: la persona
     * devolvía el valor a lo guardado, apretaba Guardar, leía «No había ningún
     * cambio para guardar» y el campo seguía en rojo por un valor que ya no
     * estaba escrito.
     */
    it('volver a lo guardado y apretar Guardar no deja el mensaje de un valor que ya no está', () => {
      rechazar({
        code: 'VALIDATION_FAILED',
        message: 'Validación fallida',
        details: { violations: ['taxId no existe en el padrón.'] },
        timestamp: '2026-09-21T00:00:00.000Z',
        path: '/profiles/practitioners/me',
      });
      expect(interno<(c: string) => string>('errorDelServidor')('taxId')).toContain('padrón');

      señal<string>('nit').set('');
      interno<() => void>('guardarPresentacion')();

      http.expectNone('/profiles/practitioners/me');
      expect(interno<(c: string) => string>('errorDelServidor')('taxId')).toBe('');
    });

    it('un intento frenado por un teléfono a medias tampoco deja rechazos viejos pintados', () => {
      rechazar({
        code: 'VALIDATION_FAILED',
        message: 'Validación fallida',
        details: { violations: ['taxId no existe en el padrón.'] },
        timestamp: '2026-09-21T00:00:00.000Z',
        path: '/profiles/practitioners/me',
      });

      interno<{ setValue(valor: string): void }>('celularTrabajo').setValue('+591 7001');
      interno<() => void>('guardarPresentacion')();

      http.expectNone('/profiles/practitioners/me');
      expect(interno<(c: string) => string>('errorDelServidor')('taxId')).toBe('');
    });
  });

  /**
   * El lápiz de la ficha manda `?pestana=`, y hasta el 21/09/2026 nadie lo
   * leía: el editor prometía abrirse donde uno venía mirando y siempre abría
   * en la primera.
   */
  describe('con qué pestaña se entra', () => {
    it('abre en la pestaña que pide la URL', () => {
      parametros = { pestana: '5' };

      montarYCargar();

      expect(interno<() => number>('pestana')()).toBe(5);
    });

    it('sin parámetro abre en la primera, como siempre', () => {
      montarYCargar();

      expect(interno<() => number>('pestana')()).toBe(0);
    });

    it('un número fuera de rango no deja el editor sin panel', () => {
      // Escrito a mano en la barra de direcciones. Siete pestañas: el 99 no
      // puede dejar `app-tabs` apuntando a la nada.
      parametros = { pestana: '99' };

      montarYCargar();

      expect(interno<() => number>('pestana')()).toBe(0);
    });

    it('un parámetro que no es un número tampoco', () => {
      parametros = { pestana: 'credenciales' };

      montarYCargar();

      expect(interno<() => number>('pestana')()).toBe(0);
    });
  });

  /**
   * «Falta un botón en editar perfil para cancelar edición» (pedido del
   * propietario, 24/09/2026). Datos personales, Contacto y Facturación son
   * UN formulario con UN botón de guardar: cancelar descarta lo tipeado en
   * los tres paneles sin salir de la pantalla ni pegarle a la red.
   */
  describe('cancelar la edición de Datos personales, Contacto y Facturación', () => {
    it('vuelve a sembrar el formulario con lo último guardado, sin pegarle al servidor', () => {
      montarYCargar({ professionalTitle: 'Cardióloga' });

      señal<string>('titulo').set('Un título a medio escribir');
      interno<() => void>('cancelarEdicion')();

      expect(señal<string>('titulo')()).toBe('Cardióloga');
      // `http.verify()` del `afterEach` ya se encarga de que no haya quedado
      // ninguna petición pendiente — cancelar no debe disparar ninguna.
    });

    it('no hace nada mientras hay un guardado en curso', () => {
      montarYCargar({ professionalTitle: 'Cardióloga' });

      señal<string>('titulo').set('Un título a medio escribir');
      señal<boolean>('guardandoPresentacion').set(true);
      interno<() => void>('cancelarEdicion')();

      // Cancelar a mitad de un `PATCH` dejaría el formulario mostrando un
      // valor que la respuesta, todavía en vuelo, podría pisar igual.
      expect(señal<string>('titulo')()).toBe('Un título a medio escribir');
      señal<boolean>('guardandoPresentacion').set(false);
    });
  });
});
