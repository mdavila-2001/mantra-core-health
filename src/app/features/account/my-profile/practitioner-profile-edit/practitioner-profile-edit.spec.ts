import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { FilterBar } from '../../../../shared/components/organisms/filter-bar/filter-bar';
import { WorkHistory } from '../work-history/work-history';

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
            // La barra de las tablas (`app-filter-bar`) lee la URL como flujo.
            get queryParams() {
              return of(parametros);
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
   * Responde el diálogo de confirmación sin montar el `<dialog>`, y cuenta las
   * veces que se preguntó. `confirmarCambios` y `confirmarDescarte` pasan por
   * `confirm`, así que alcanza con reemplazar ése.
   */
  function responderConfirmacion(respuesta: boolean): { preguntas: number } {
    const registro = { preguntas: 0 };
    const dialogos = interno<{ confirm: () => Promise<boolean> }>('dialogs');
    dialogos.confirm = () => {
      registro.preguntas += 1;
      return Promise.resolve(respuesta);
    };
    return registro;
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

    it('agrega TODAS las especialidades elegidas, no la primera', async () => {
      montarYCargar();

      señal<string>('nuevaEspecialidad').set('esp-cardio');
      interno<() => void>('agregarCasillaDeEspecialidad')();
      interno<(i: number, v: string | null) => void>('elegirEspecialidadExtra')(0, 'esp-pediatria');

      responderConfirmacion(true);
      await interno<() => Promise<void>>('agregarEspecialidad')();

      const pedidos = http.match('/profiles/practitioners/per-1/specialties');
      expect(pedidos).toHaveLength(2);
      expect(
        pedidos.map((r) => (r.request.body as { specialtyConceptId: string }).specialtyConceptId),
      ).toEqual(['esp-cardio', 'esp-pediatria']);
      for (const pedido of pedidos) pedido.flush({ id: 'sp-x' });

      http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
    });

    it('elegir dos veces la misma declara una, no dos filas iguales', async () => {
      montarYCargar();

      señal<string>('nuevaEspecialidad').set('esp-cardio');
      interno<() => void>('agregarCasillaDeEspecialidad')();
      interno<(i: number, v: string | null) => void>('elegirEspecialidadExtra')(0, 'esp-cardio');

      responderConfirmacion(true);
      await interno<() => Promise<void>>('agregarEspecialidad')();

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

    interno<{ setValue(valor: string): void }>('celularPersonal').setValue('+591 7001');
    interno<() => void>('guardarPresentacion')();

    http.expectNone('/profiles/practitioners/me');
    expect(interno<() => number>('pestana')()).toBe(1);
  });

  it('un teléfono completo viaja con su prefijo', () => {
    montarYCargar();

    interno<{ setValue(valor: string): void }>('celularPersonal').setValue('+591 70012345');
    interno<() => void>('guardarPresentacion')();

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.body).toEqual({ mobilePhone: '+591 70012345' });
    req.flush(PERFIL_BASE);
  });

  /* ---- especialidades: sólo se agregan ------------------------------------- */

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

  it('agregarEspecialidad hace un POST y recarga el perfil', async () => {
    montarYCargar();
    señal<string>('nuevaEspecialidad').set('esp-cardio');

    responderConfirmacion(true);
    await interno<() => Promise<void>>('agregarEspecialidad')();

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

  it('agregarMatricula hace un POST y recarga el perfil', async () => {
    montarYCargar();
    señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
    señal<string>('nuevaAutoridad').set('Colegio Médico');

    responderConfirmacion(true);
    await interno<() => Promise<void>>('agregarMatricula')();

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

  it('limpia el respaldo local cuando la matrícula queda agregada', async () => {
    montarYCargar();
    señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
    señal<readonly File[]>('archivoDeMatricula').set([
      new File(['matrícula'], 'matricula.pdf', { type: 'application/pdf' }),
    ]);

    responderConfirmacion(true);
    await interno<() => Promise<void>>('agregarMatricula')();
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

  it('sin respaldo no sube nada: la matrícula va derecha', async () => {
    montarYCargar();
    señal<string>('nuevoNumeroDeMatricula').set('LIC-9');

    responderConfirmacion(true);
    await interno<() => Promise<void>>('agregarMatricula')();

    // Ni una petición al almacén de archivos.
    expect(http.match('/common/files/upload')).toHaveLength(0);
    http
      .expectOne('/profiles/practitioners/per-1/jurisdiction-authorizations')
      .flush({ id: 'ja-1' });
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
  });

  it('con respaldo sube primero el archivo y manda su id como fileId', async () => {
    montarYCargar();
    señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
    señal<string>('nuevaAutoridad').set('Colegio Médico');
    señal<readonly File[]>('archivoDeMatricula').set([
      new File(['x'], 'matricula.pdf', { type: 'application/pdf' }),
    ]);

    responderConfirmacion(true);
    await interno<() => Promise<void>>('agregarMatricula')();

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

  it('si la subida falla, la matrícula NO se crea', async () => {
    // Una matrícula sin el carnet que la persona creyó haber adjuntado es peor
    // que un error: nadie se entera hasta que se la rechazan.
    montarYCargar();
    señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
    señal<readonly File[]>('archivoDeMatricula').set([
      new File(['x'], 'matricula.pdf', { type: 'application/pdf' }),
    ]);

    responderConfirmacion(true);
    await interno<() => Promise<void>>('agregarMatricula')();

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
        estado: 'Verificada',
      }),
    ]);
    expect(interno<() => readonly object[]>('filasMatriculas')()).toEqual([
      expect.objectContaining({ numero: 'MP-1', autoridad: 'Ministerio de Salud y Deportes' }),
    ]);
  });

  /* -- Todas por igual (D-01, 23/09/2026) -----------------------------------
     El médico pidió que ninguna especialidad se distinga como principal. Hasta
     entonces la tabla ponía la principal primero y la columna «Tipo» decía
     «Principal»/«Adicional» y ofrecía «Marcar como principal». El dato
     `isPrimary` sigue llegando del contrato: la pantalla no lo usa. */

  /** La principal llega SEGUNDA a propósito: si algo la adelantara, se vería. */
  const PRINCIPAL_AL_FINAL = {
    specialties: [
      {
        id: 'e-2',
        specialtyConceptId: 'esp-pediatria',
        isPrimary: false,
        boardCertified: false,
        verificationStatusConceptId: 'st-v',
        verified: true,
      },
      {
        id: 'e-1',
        specialtyConceptId: 'esp-cardio',
        isPrimary: true,
        boardCertified: true,
        verificationStatusConceptId: 'st-v',
        verified: true,
      },
    ],
  };

  it('las especialidades van en el orden en que llegan: la principal no se adelanta', () => {
    montarYCargar(PRINCIPAL_AL_FINAL);

    const filas = interno<() => readonly Record<string, unknown>[]>('filasEspecialidades')();
    expect(filas.map((fila) => fila['id'])).toEqual(['e-2', 'e-1']);
  });

  it('ninguna fila dice cuál es la principal, y no queda gesto para marcarla', () => {
    montarYCargar(PRINCIPAL_AL_FINAL);

    for (const fila of interno<() => readonly Record<string, unknown>[]>('filasEspecialidades')()) {
      expect(fila).not.toHaveProperty('rol');
      expect(fila).not.toHaveProperty('esPrincipal');
    }
    expect(
      interno<() => readonly { header: string }[]>('columnasEspecialidades')().map((c) => c.header),
    ).toEqual(['Especialidad', 'Desde', 'Estado', 'Acciones']);
    expect(interno<unknown>('marcarComoPrincipal')).toBeUndefined();
    expect(http.match((r) => r.url.endsWith('/primary'))).toHaveLength(0);
  });

  it('dibujada, la tabla de especialidades no dice «principal» en ninguna fila', () => {
    const fixture = montarConVista(PRINCIPAL_AL_FINAL);
    // Las especialidades viven en «Datos personales» desde el 24/09/2026.
    señal<number>('pestana').set(0);
    fixture.detectChanges();

    const tabla = panelAbierto(fixture).querySelector('[data-testid="tabla-especialidades"]');
    const texto = (tabla?.textContent ?? '').replace(/\s+/g, ' ');
    expect(texto).toContain('Cardiología');
    expect(texto).toContain('Pediatría');
    expect(texto).not.toMatch(/principal/i);
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

  it('agregarCredencial hace un POST y recarga el perfil', async () => {
    montarYCargar();
    señal<string>('nuevoTipoCredencial').set('cred-titulo');
    señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
    // La institución sale del catálogo desde el 13/09/2026: lo que viaja sigue
    // siendo el nombre, así que el cuerpo del POST no cambia de forma.
    señal<string>('institucionElegida').set('Universidad Mayor de San Andrés');

    responderConfirmacion(true);
    await interno<() => Promise<void>>('agregarCredencial')();

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

  it('sin diploma no sube nada: el título va derecho', async () => {
    montarYCargar();
    señal<string>('nuevoTipoCredencial').set('cred-titulo');
    señal<string>('nuevoNumeroCredencial').set('Médico cirujano');

    responderConfirmacion(true);
    await interno<() => Promise<void>>('agregarCredencial')();

    // Ni una petición al almacén de archivos.
    expect(http.match('/common/files/upload')).toHaveLength(0);
    http.expectOne('/profiles/practitioners/me/credentials').flush({ id: 'cred-1' });
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
  });

  it('con diploma sube primero el archivo y manda su id como fileId', async () => {
    montarYCargar();
    señal<string>('nuevoTipoCredencial').set('cred-titulo');
    señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
    señal<readonly File[]>('archivoDeCredencial').set([
      new File(['x'], 'diploma.pdf', { type: 'application/pdf' }),
    ]);

    responderConfirmacion(true);
    await interno<() => Promise<void>>('agregarCredencial')();

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

  it('si la subida falla, el título NO se crea', async () => {
    // Un título sin el diploma que la persona creyó haber adjuntado es peor que
    // un error: nadie se entera hasta que se lo rechazan.
    montarYCargar();
    señal<string>('nuevoTipoCredencial').set('cred-titulo');
    señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
    señal<readonly File[]>('archivoDeCredencial').set([
      new File(['x'], 'diploma.pdf', { type: 'application/pdf' }),
    ]);

    responderConfirmacion(true);
    await interno<() => Promise<void>>('agregarCredencial')();

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
    it('lo elegido del catálogo viaja como el nombre de la institución', async () => {
      montarYCargar();
      señal<string>('nuevoTipoCredencial').set('cred-titulo');
      señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
      señal<string>('institucionElegida').set('Universidad Mayor de San Simón');

      responderConfirmacion(true);
      await interno<() => Promise<void>>('agregarCredencial')();

      const req = http.expectOne('/profiles/practitioners/me/credentials');
      // El valor de la opción ES el nombre: el contrato sigue recibiendo
      // `issuingInstitutionText`, no un id que el backend no sabría resolver.
      expect(req.request.body.issuingInstitutionText).toBe('Universidad Mayor de San Simón');
      req.flush({ id: 'cred-1' });
      http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
    });

    it('«otra» abre el campo a mano y manda lo escrito', async () => {
      // Sin esta salida, una lista de universidades bolivianas le impide cargar
      // el título a cualquiera que se formó en el exterior.
      montarYCargar();
      señal<string>('nuevoTipoCredencial').set('cred-titulo');
      señal<string>('nuevoNumeroCredencial').set('Médico cirujano');

      expect(interno<() => boolean>('institucionFueraDeCatalogo')()).toBe(false);
      señal<string>('institucionElegida').set('__otra__');
      expect(interno<() => boolean>('institucionFueraDeCatalogo')()).toBe(true);

      señal<string>('institucionEscrita').set('  Universidad de La Habana  ');
      responderConfirmacion(true);
      await interno<() => Promise<void>>('agregarCredencial')();

      const req = http.expectOne('/profiles/practitioners/me/credentials');
      expect(req.request.body.issuingInstitutionText).toBe('Universidad de La Habana');
      req.flush({ id: 'cred-1' });
      http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
    });

    it('sin elegir institución no viaja el campo', async () => {
      montarYCargar();
      señal<string>('nuevoTipoCredencial').set('cred-titulo');
      señal<string>('nuevoNumeroCredencial').set('Médico cirujano');

      responderConfirmacion(true);
      await interno<() => Promise<void>>('agregarCredencial')();

      const req = http.expectOne('/profiles/practitioners/me/credentials');
      expect('issuingInstitutionText' in req.request.body).toBe(false);
      req.flush({ id: 'cred-1' });
      http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);
    });
  });

  /* ======================================================================
      El alta del título en un modal, y la barra de su tabla
      (D-04 y D-10, 23/09/2026)
     ====================================================================== */

  describe('el alta del título vive en un modal', () => {
    it('sin confirmar no viaja nada y lo escrito queda', async () => {
      montarYCargar();
      señal<string>('nuevoTipoCredencial').set('cred-titulo');
      señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
      const confirmacion = responderConfirmacion(false);

      await interno<() => Promise<void>>('agregarCredencial')();

      expect(confirmacion.preguntas).toBe(1);
      expect(http.match('/profiles/practitioners/me/credentials')).toHaveLength(0);
      expect(interno<() => string>('nuevoNumeroCredencial')()).toBe('Médico cirujano');
    });

    it('la pregunta es «¿Confirmás estos datos?»', async () => {
      montarYCargar();
      señal<string>('nuevoTipoCredencial').set('cred-titulo');
      señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
      let titulo = '';
      const dialogos = interno<{ confirm: (c: { title: string }) => Promise<boolean> }>('dialogs');
      dialogos.confirm = (config) => {
        titulo = config.title;
        return Promise.resolve(false);
      };

      await interno<() => Promise<void>>('agregarCredencial')();

      expect(titulo).toBe('¿Confirmás estos datos?');
    });

    it('al agregar se cierra el modal y el próximo alta empieza en blanco', async () => {
      montarYCargar();
      señal<boolean>('altaDeTituloAbierta').set(true);
      señal<string>('nuevoTipoCredencial').set('cred-titulo');
      señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
      señal<string>('institucionElegida').set('Universidad Mayor de San Andrés');
      responderConfirmacion(true);

      await interno<() => Promise<void>>('agregarCredencial')();
      http.expectOne('/profiles/practitioners/me/credentials').flush({ id: 'cred-1' });
      http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);

      expect(interno<() => boolean>('altaDeTituloAbierta')()).toBe(false);
      expect(interno<() => string | null>('nuevoTipoCredencial')()).toBeNull();
      expect(interno<() => string>('nuevoNumeroCredencial')()).toBe('');
      expect(interno<() => string | null>('institucionElegida')()).toBeNull();
    });

    it('si el alta falla, el modal sigue abierto con lo escrito', async () => {
      montarYCargar();
      señal<boolean>('altaDeTituloAbierta').set(true);
      señal<string>('nuevoTipoCredencial').set('cred-titulo');
      señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
      responderConfirmacion(true);

      await interno<() => Promise<void>>('agregarCredencial')();
      http
        .expectOne('/profiles/practitioners/me/credentials')
        .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });

      expect(interno<() => boolean>('altaDeTituloAbierta')()).toBe(true);
      expect(interno<() => string>('nuevoNumeroCredencial')()).toBe('Médico cirujano');
    });

    it('sin nada escrito, cerrar no pregunta', async () => {
      montarYCargar();
      const confirmacion = responderConfirmacion(false);

      const permitido = await interno<() => boolean | Promise<boolean>>('guardaDeAltaDeTitulo')();

      expect(permitido).toBe(true);
      expect(confirmacion.preguntas).toBe(0);
    });

    it('con algo escrito, cerrar pregunta si se descarta y respeta la respuesta', async () => {
      montarYCargar();
      señal<string>('nuevoNumeroCredencial').set('Médico cirujano');
      const guarda = interno<() => boolean | Promise<boolean>>('guardaDeAltaDeTitulo');

      const noDescarta = responderConfirmacion(false);
      expect(await guarda()).toBe(false);
      expect(noDescarta.preguntas).toBe(1);

      responderConfirmacion(true);
      expect(await guarda()).toBe(true);
    });

    it('Trayectoria ya no tiene el formulario en línea: se abre desde «Agregar título»', () => {
      const fixture = montarConVista();
      componente.pestana.set(4);
      fixture.detectChanges();
      const panel = panelAbierto(fixture);

      expect(panel.querySelector('[data-testid="credencial-tipo"]')).toBeNull();
      const boton = panel.querySelector<HTMLButtonElement>(
        'app-filter-bar [data-testid="credencial-agregar"]',
      );
      expect(boton?.textContent).toContain('Agregar título');

      boton?.click();
      fixture.detectChanges();
      for (const pendiente of http.match((r) => r.url.startsWith('/system-context/'))) {
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

      const dialogo = fixture.nativeElement.querySelector('[data-testid="alta-titulo-dialogo"]');
      expect(dialogo).not.toBeNull();
      expect(dialogo.querySelector('[data-testid="credencial-tipo"]')).not.toBeNull();
      expect(dialogo.querySelector('[data-testid="credencial-archivo"]')).not.toBeNull();
    });
  });

  describe('el alta de especialidades vive en un modal', () => {
    /** Un título pendiente y uno verificado: sólo el segundo puede respaldar. */
    const CON_TITULOS = {
      credentials: [
        {
          id: 'cred-a',
          credentialTypeConceptId: 'cred-titulo',
          number: 'TIT-1',
          issuingInstitutionText: 'Universidad Mayor de San Andrés',
          stateConceptId: 'st-pending',
        },
        {
          id: 'cred-b',
          credentialTypeConceptId: 'cred-titulo',
          number: 'TIT-2',
          issuingInstitutionText: 'Universidad de La Habana',
          stateConceptId: 'st-ok',
          verifiedAt: '2013-01-01T00:00:00.000Z',
        },
      ],
    };

    function cuerpos(): readonly Record<string, unknown>[] {
      return http.match('/profiles/practitioners/per-1/specialties').map((pedido) => {
        const cuerpo = pedido.request.body as Record<string, unknown>;
        pedido.flush({ id: 'sp-x' });
        return cuerpo;
      });
    }

    it('sin confirmar no se agrega nada y el modal sigue abierto con lo elegido', async () => {
      montarYCargar();
      interno<() => void>('abrirAltaDeEspecialidad')();
      señal<string>('nuevaEspecialidad').set('esp-cardio');
      const noConfirma = responderConfirmacion(false);

      await interno<() => Promise<void>>('agregarEspecialidad')();

      expect(noConfirma.preguntas).toBe(1);
      expect(http.match('/profiles/practitioners/per-1/specialties')).toHaveLength(0);
      expect(interno<() => boolean>('altaDeEspecialidadAbierta')()).toBe(true);
      expect(señal<string | null>('nuevaEspecialidad')()).toBe('esp-cardio');
    });

    it('pregunta «¿Confirmás estos datos?» y, guardadas, cierra el modal y lo deja en blanco', async () => {
      montarYCargar(CON_TITULOS);
      interno<() => void>('abrirAltaDeEspecialidad')();
      señal<string>('nuevaEspecialidad').set('esp-cardio');
      señal<string | null>('tituloDeRespaldo').set('cred-b');
      const titulos: string[] = [];
      interno<{ confirm: (c: { title: string }) => Promise<boolean> }>('dialogs').confirm = (c) => {
        titulos.push(c.title);
        return Promise.resolve(true);
      };

      await interno<() => Promise<void>>('agregarEspecialidad')();
      cuerpos();
      http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);

      expect(titulos).toEqual(['¿Confirmás estos datos?']);
      expect(interno<() => boolean>('altaDeEspecialidadAbierta')()).toBe(false);
      expect(señal<string | null>('nuevaEspecialidad')()).toBeNull();
      expect(señal<string | null>('tituloDeRespaldo')()).toBeNull();
    });

    it('el respaldo ofrece sólo los títulos verificados', () => {
      montarYCargar(CON_TITULOS);

      const opciones =
        interno<() => readonly { value: string; label: string }[]>('opcionesDeRespaldo')();

      expect(opciones.map((o) => o.value)).toEqual(['cred-b']);
      expect(opciones[0]?.label).toContain('TIT-2');
      expect(opciones[0]?.label).toContain('Universidad de La Habana');
    });

    it('el título elegido viaja como supportingCredentialId en cada especialidad del envío', async () => {
      montarYCargar(CON_TITULOS);
      señal<string>('nuevaEspecialidad').set('esp-cardio');
      interno<() => void>('agregarCasillaDeEspecialidad')();
      interno<(i: number, v: string | null) => void>('elegirEspecialidadExtra')(0, 'esp-pediatria');
      señal<string | null>('tituloDeRespaldo').set('cred-b');
      responderConfirmacion(true);

      await interno<() => Promise<void>>('agregarEspecialidad')();
      const enviados = cuerpos();
      http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);

      expect(enviados).toHaveLength(2);
      expect(enviados.map((c) => c['supportingCredentialId'])).toEqual(['cred-b', 'cred-b']);
    });

    it('sin nada elegido, cerrar no pregunta; con sólo el respaldo elegido, sí', async () => {
      montarYCargar(CON_TITULOS);
      const guarda = interno<() => boolean | Promise<boolean>>('guardaDeAltaDeEspecialidad');
      const pregunta = responderConfirmacion(false);

      expect(await guarda()).toBe(true);
      expect(pregunta.preguntas).toBe(0);

      señal<string | null>('tituloDeRespaldo').set('cred-b');
      expect(await guarda()).toBe(false);
      expect(pregunta.preguntas).toBe(1);
    });

    it('no hay formulario en línea: el alta se abre desde «Agregar especialidad», en «Datos personales»', () => {
      const fixture = montarConVista();
      componente.pestana.set(0);
      fixture.detectChanges();
      const panel = panelAbierto(fixture);

      expect(panel.querySelector('[data-testid="especialidad-select"]')).toBeNull();
      const boton = panel.querySelector<HTMLButtonElement>(
        'app-filter-bar [data-testid="especialidad-agregar"]',
      );
      expect(boton?.textContent).toContain('Agregar especialidad');

      boton?.click();
      fixture.detectChanges();

      const dialogo = fixture.nativeElement.querySelector(
        '[data-testid="alta-especialidad-dialogo"]',
      );
      expect(dialogo).not.toBeNull();
      expect(dialogo.querySelector('[data-testid="especialidad-select"]')).not.toBeNull();
      expect(dialogo.querySelector('[data-testid="agregar-casilla-especialidad"]')).not.toBeNull();
      // Sin títulos verificados no hay desplegable vacío: se dice por qué.
      expect(dialogo.querySelector('[data-testid="especialidad-respaldo"]')).toBeNull();
      expect(dialogo.querySelector('[data-testid="especialidad-sin-respaldo"]')).not.toBeNull();
    });
  });

  describe('la barra de la tabla de especialidades', () => {
    const CON_ESPECIALIDADES = {
      specialties: [
        {
          id: 's-1',
          specialtyConceptId: 'esp-cardio',
          isPrimary: false,
          boardCertified: false,
          verificationStatusConceptId: 'st-v',
          verified: true,
        },
        {
          id: 's-2',
          specialtyConceptId: 'esp-pediatria',
          isPrimary: false,
          boardCertified: false,
          verificationStatusConceptId: 'st-p',
          verified: false,
        },
      ],
    };

    function visibles(): readonly string[] {
      return interno<() => readonly { id: string }[]>('filasEspecialidadesVisibles')().map(
        (f) => f.id,
      );
    }

    it('busca por el nombre sin distinguir tildes ni mayúsculas', () => {
      montarYCargar(CON_ESPECIALIDADES);
      const filtrar = interno<(a: Record<string, string>) => void>('onFiltrosEspecialidades');

      filtrar({ qEspecialidades: 'PEDIATRIA' });
      expect(visibles()).toEqual(['s-2']);

      filtrar({ qMatriculas: 'pediatria' });
      expect(visibles()).toEqual(['s-1', 's-2']);
    });

    it('arranca con la búsqueda que ya trae la URL', () => {
      parametros = { qEspecialidades: 'cardio' };
      montarYCargar(CON_ESPECIALIDADES);

      expect(visibles()).toEqual(['s-1']);
    });

    it('la barra de especialidades y la de matrículas escriben cada una en su clave', () => {
      const fixture = montarConVista(CON_ESPECIALIDADES);
      /** Las claves de las barras de la pestaña abierta. */
      const clavesDe = (pestana: number): readonly string[] => {
        componente.pestana.set(pestana);
        fixture.detectChanges();
        const abierto = fixture.debugElement
          .queryAll(By.css('[role="tabpanel"]'))
          .find((panel) => !(panel.nativeElement as HTMLElement).hasAttribute('hidden'));
        return (abierto?.queryAll(By.directive(FilterBar)) ?? []).map((barra) =>
          (barra.componentInstance as FilterBar).searchParam(),
        );
      };
      expect(clavesDe(0)).toEqual(['qEspecialidades']);
      expect(clavesDe(5)).toEqual(['qMatriculas']);
    });
  });

  describe('el alta de la matrícula vive en un modal', () => {
    it('sin confirmar no se agrega nada y el modal sigue abierto con lo escrito', async () => {
      montarYCargar();
      interno<() => void>('abrirAltaDeMatricula')();
      señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
      const noConfirma = responderConfirmacion(false);

      await interno<() => Promise<void>>('agregarMatricula')();

      expect(noConfirma.preguntas).toBe(1);
      expect(http.match('/profiles/practitioners/per-1/jurisdiction-authorizations')).toHaveLength(
        0,
      );
      expect(interno<() => boolean>('altaDeMatriculaAbierta')()).toBe(true);
      expect(señal<string>('nuevoNumeroDeMatricula')()).toBe('LIC-9');
    });

    it('pregunta «¿Confirmás estos datos?» y, guardada, cierra el modal y lo deja en blanco', async () => {
      montarYCargar();
      interno<() => void>('abrirAltaDeMatricula')();
      señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
      señal<string>('nuevaAutoridad').set('Colegio Médico');
      const titulos: string[] = [];
      interno<{ confirm: (c: { title: string }) => Promise<boolean> }>('dialogs').confirm = (c) => {
        titulos.push(c.title);
        return Promise.resolve(true);
      };

      await interno<() => Promise<void>>('agregarMatricula')();
      http
        .expectOne('/profiles/practitioners/per-1/jurisdiction-authorizations')
        .flush({ id: 'ja-1' });
      http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_BASE);

      expect(titulos).toEqual(['¿Confirmás estos datos?']);
      expect(interno<() => boolean>('altaDeMatriculaAbierta')()).toBe(false);
      expect(señal<string>('nuevoNumeroDeMatricula')()).toBe('');
      expect(señal<string>('nuevaAutoridad')()).toBe('');
    });

    it('sin nada escrito, cerrar no pregunta', async () => {
      montarYCargar();
      const pregunta = responderConfirmacion(false);

      expect(await interno<() => boolean | Promise<boolean>>('guardaDeAltaDeMatricula')()).toBe(
        true,
      );
      expect(pregunta.preguntas).toBe(0);
    });

    it('con algo escrito, cerrar pregunta si se descarta y respeta la respuesta', async () => {
      montarYCargar();
      señal<string>('nuevoNumeroDeMatricula').set('LIC-9');
      const guarda = interno<() => boolean | Promise<boolean>>('guardaDeAltaDeMatricula');

      const noDescarta = responderConfirmacion(false);
      expect(await guarda()).toBe(false);
      expect(noDescarta.preguntas).toBe(1);

      responderConfirmacion(true);
      expect(await guarda()).toBe(true);
    });

    it('Credenciales ya no tiene el formulario en línea: se abre desde «Agregar matrícula»', () => {
      const fixture = montarConVista();
      componente.pestana.set(5);
      fixture.detectChanges();
      const panel = panelAbierto(fixture);

      expect(panel.querySelector('[data-testid="matricula-numero"]')).toBeNull();
      const boton = panel.querySelector<HTMLButtonElement>(
        'app-filter-bar [data-testid="matricula-agregar"]',
      );
      expect(boton?.textContent).toContain('Agregar matrícula');

      boton?.click();
      fixture.detectChanges();

      const dialogo = fixture.nativeElement.querySelector('[data-testid="alta-matricula-dialogo"]');
      expect(dialogo).not.toBeNull();
      expect(dialogo.querySelector('[data-testid="matricula-numero"]')).not.toBeNull();
      expect(dialogo.querySelector('[data-testid="matricula-archivo"]')).not.toBeNull();
    });
  });

  describe('la barra de la tabla de matrículas', () => {
    const CON_MATRICULAS = {
      licenses: [
        {
          id: 'lic-a',
          jurisdictionConceptId: 'jur-1',
          licenseNumber: 'MP-100',
          regulatoryAuthority: 'Ministerio de Salud y Deportes',
          stateConceptId: 'st-a',
        },
        {
          id: 'lic-b',
          jurisdictionConceptId: 'jur-1',
          licenseNumber: 'SC-200',
          regulatoryAuthority: 'SEDES Santa Cruz',
          stateConceptId: 'st-a',
        },
      ],
    };

    function visibles(): readonly string[] {
      return interno<() => readonly { id: string }[]>('filasMatriculasVisibles')().map((f) => f.id);
    }

    it('busca por autoridad sin distinguir tildes ni mayúsculas, y por número', () => {
      montarYCargar(CON_MATRICULAS);
      const filtrar = interno<(a: Record<string, string>) => void>('onFiltrosMatriculas');

      filtrar({ qMatriculas: 'MINISTERIO' });
      expect(visibles()).toEqual(['lic-a']);

      filtrar({ qMatriculas: 'sc-200' });
      expect(visibles()).toEqual(['lic-b']);

      filtrar({});
      expect(visibles()).toEqual(['lic-a', 'lic-b']);
    });

    it('la búsqueda de otra tabla no filtra las matrículas', () => {
      montarYCargar(CON_MATRICULAS);

      interno<(a: Record<string, string>) => void>('onFiltrosMatriculas')({
        qTitulos: 'sedes',
        q: 'sedes',
      });

      expect(visibles()).toEqual(['lic-a', 'lic-b']);
    });

    it('arranca con la búsqueda que ya trae la URL', () => {
      parametros = { qMatriculas: 'sedes' };
      montarYCargar(CON_MATRICULAS);

      expect(visibles()).toEqual(['lic-b']);
    });

    it('la barra de matrículas escribe en su propia clave', () => {
      const fixture = montarConVista(CON_MATRICULAS);
      componente.pestana.set(5);
      fixture.detectChanges();

      const barras = fixture.debugElement
        .queryAll(By.directive(FilterBar))
        .map((barra) => (barra.componentInstance as FilterBar).searchParam());
      expect(barras).toContain('qMatriculas');
    });
  });

  describe('la barra de la tabla de títulos', () => {
    const CON_TITULOS = {
      credentials: [
        {
          id: 'cred-a',
          credentialTypeConceptId: 'cred-titulo',
          number: 'TIT-1',
          issuingInstitutionText: 'Universidad Mayor de San Andrés',
          issueDate: '2016-03-01T12:00:00.000Z',
          stateConceptId: 'st-pending',
        },
        {
          id: 'cred-b',
          credentialTypeConceptId: 'cred-titulo',
          number: 'TIT-2',
          issuingInstitutionText: 'Universidad de La Habana',
          issueDate: '2012-03-01T12:00:00.000Z',
          stateConceptId: 'st-ok',
          verifiedAt: '2013-01-01T00:00:00.000Z',
        },
      ],
    };

    function visibles(): readonly string[] {
      return interno<() => readonly { id: string }[]>('filasFormacionVisibles')().map((f) => f.id);
    }

    it('busca en la institución sin distinguir tildes ni mayúsculas', () => {
      montarYCargar(CON_TITULOS);

      interno<(a: Record<string, string>) => void>('onFiltrosFormacion')({
        qTitulos: 'SAN ANDRES',
      });

      expect(visibles()).toEqual(['cred-a']);
    });

    it('la institución del catálogo se lee con su sigla y la escrita a mano, tal cual (Q-8)', () => {
      const fixture = montarConVista(CON_TITULOS);
      componente.pestana.set(4);
      fixture.detectChanges();

      const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(texto).toContain('Universidad Mayor de San Andrés (UMSA)');
      expect(texto).toContain('Universidad de La Habana');
      expect(texto).not.toContain('Universidad de La Habana (');
    });

    it('«umsa» encuentra el título de la UMSA aunque lo guardado sea sólo el nombre', () => {
      montarYCargar(CON_TITULOS);

      interno<(a: Record<string, string>) => void>('onFiltrosFormacion')({ qTitulos: 'umsa' });

      expect(visibles()).toEqual(['cred-a']);
    });

    it('busca también en el número', () => {
      montarYCargar(CON_TITULOS);

      interno<(a: Record<string, string>) => void>('onFiltrosFormacion')({ qTitulos: 'tit-2' });

      expect(visibles()).toEqual(['cred-b']);
    });

    it('el filtro «Estado» separa lo pendiente de lo verificado', () => {
      montarYCargar(CON_TITULOS);
      const filtrar = interno<(a: Record<string, string>) => void>('onFiltrosFormacion');

      filtrar({ estadoTitulo: 'pendiente' });
      expect(visibles()).toEqual(['cred-a']);

      filtrar({ estadoTitulo: 'verificado' });
      expect(visibles()).toEqual(['cred-b']);

      filtrar({});
      expect(visibles()).toEqual(['cred-a', 'cred-b']);
    });

    it('arranca con la búsqueda que ya trae la URL, que es la que la barra muestra', () => {
      parametros = { qTitulos: 'habana' };
      montarYCargar(CON_TITULOS);

      expect(visibles()).toEqual(['cred-b']);
    });

    it('la búsqueda del historial laboral (`q`) no filtra los títulos', () => {
      parametros = { q: 'habana' };
      montarYCargar(CON_TITULOS);
      expect(visibles()).toEqual(['cred-a', 'cred-b']);

      interno<(a: Record<string, string>) => void>('onFiltrosFormacion')({ q: 'habana' });
      expect(visibles()).toEqual(['cred-a', 'cred-b']);
    });

    it('Trayectoria monta el historial laboral como tabla debajo de los títulos', () => {
      const fixture = montarConVista();
      componente.pestana.set(4);
      fixture.detectChanges();

      const historial = fixture.debugElement.query(By.directive(WorkHistory));
      expect(historial).not.toBeNull();
      const bloque = historial.componentInstance as WorkHistory;
      expect(bloque.secciones()).toBe('historial');
      expect(bloque.layout()).toBe('tabla');
      const titulos = panelAbierto(fixture).querySelector(
        '[data-testid="edicion-formacion-cargada"]',
      );
      const posicion = titulos?.compareDocumentPosition(historial.nativeElement as Node) ?? 0;
      expect(posicion & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('con otra pestaña abierta, el historial de Trayectoria no se monta', () => {
      const fixture = montarConVista();
      componente.pestana.set(0);
      fixture.detectChanges();

      expect(fixture.debugElement.query(By.directive(WorkHistory))).toBeNull();
    });

    it('la barra de títulos escribe en su propia clave', () => {
      const fixture = montarConVista();
      componente.pestana.set(4);
      fixture.detectChanges();

      const barra = fixture.debugElement.query(By.directive(FilterBar))
        .componentInstance as FilterBar;
      expect(barra.searchParam()).toBe('qTitulos');
    });

    it('cambiar de pestaña olvida las búsquedas de las tablas, también la del historial', () => {
      parametros = { qTitulos: 'habana', estadoTitulo: 'verificado' };
      montarYCargar(CON_TITULOS);
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'url', 'get').mockReturnValue(
        '/my-account/edit?pestana=4&qTitulos=habana&q=umsa&estadoTitulo=verificado&qMatriculas=lp',
      );
      const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      interno<() => void>('olvidarBusquedaDeLasTablas')();

      expect(visibles()).toEqual(['cred-a', 'cred-b']);
      expect(navegar).toHaveBeenCalledTimes(1);
      const [destino, opciones] = navegar.mock.calls[0];
      expect(String(destino)).toBe('/my-account/edit?pestana=4');
      expect(opciones).toEqual({ replaceUrl: true });
    });

    it('sin búsqueda en la URL, cambiar de pestaña no navega', () => {
      montarYCargar(CON_TITULOS);
      const router = TestBed.inject(Router);
      vi.spyOn(router, 'url', 'get').mockReturnValue('/my-account/edit?pestana=4');
      const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

      interno<() => void>('olvidarBusquedaDeLasTablas')();

      expect(navegar).not.toHaveBeenCalled();
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

    it('editar una especialidad no ofrece el seleccionable de certificación de junta', async () => {
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
      responderConfirmacion(true);
      await interno<() => Promise<void>>('guardarEdicion')();
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

    it('editar un título siembra el diálogo con lo que hay y manda un PATCH', async () => {
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
      responderConfirmacion(true);
      await interno<() => Promise<void>>('guardarEdicion')();

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

    /* ---- Corregir: guardar por cambios, confirmar y adjuntar (D-08) ------- */

    function abrirTitulo(): void {
      const fila = interno<() => readonly { id: string }[]>('filasFormacion')().find(
        (f) => f.id === 'cred-9',
      );
      interno<(f: unknown) => void>('editarFormacion')(fila);
    }

    it('abrir y no tocar nada deja «Guardar cambios» apagado; volver al original lo apaga de nuevo', () => {
      montarYCargar(PERFIL_CON_FILAS);
      abrirTitulo();
      const puedeGuardar = interno<() => boolean>('puedeGuardarEdicion');

      expect(puedeGuardar()).toBe(false);

      señal<string>('edicionNumero').set('TIT-1-CORREGIDO');
      expect(puedeGuardar()).toBe(true);

      // Un espacio de más no es un cambio: así no viaja.
      señal<string>('edicionNumero').set('TIT-1 ');
      expect(puedeGuardar()).toBe(false);
    });

    it('el diálogo sabe que el título ya tiene diploma, para ofrecer reemplazarlo', () => {
      montarYCargar(PERFIL_CON_FILAS);
      abrirTitulo();

      expect(interno<() => { archivoActual: boolean }>('edicion')().archivoActual).toBe(true);
    });

    it('guardar pregunta primero; sin confirmar no viaja nada y el diálogo sigue abierto', async () => {
      montarYCargar(PERFIL_CON_FILAS);
      abrirTitulo();
      señal<string>('edicionNumero').set('TIT-1-CORREGIDO');
      const confirmacion = responderConfirmacion(false);

      await interno<() => Promise<void>>('guardarEdicion')();

      expect(confirmacion.preguntas).toBe(1);
      expect(http.match('/profiles/practitioners/me/credentials/cred-9')).toHaveLength(0);
      expect(señal<unknown>('edicion')()).not.toBeNull();
      expect(señal<string>('edicionNumero')()).toBe('TIT-1-CORREGIDO');
    });

    it('con un diploma nuevo sube primero el archivo y manda su id como fileId', async () => {
      montarYCargar(PERFIL_CON_FILAS);
      abrirTitulo();
      // Elegir un archivo ya es un cambio, aunque no se toque ningún campo.
      señal<readonly File[]>('archivoDeEdicion').set([
        new File(['x'], 'diploma-nuevo.pdf', { type: 'application/pdf' }),
      ]);
      expect(interno<() => boolean>('puedeGuardarEdicion')()).toBe(true);
      responderConfirmacion(true);

      await interno<() => Promise<void>>('guardarEdicion')();

      http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'file-88' });
      const req = http.expectOne('/profiles/practitioners/me/credentials/cred-9');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body.fileId).toBe('file-88');
      req.flush(null);
      http
        .expectOne('/profiles/practitioners/me/summary')
        .flush({ ...PERFIL_BASE, ...PERFIL_CON_FILAS });
      expect(señal<unknown>('edicion')()).toBeNull();
    });

    it('si la subida del diploma falla, no se corrige nada y el diálogo sigue abierto', async () => {
      montarYCargar(PERFIL_CON_FILAS);
      abrirTitulo();
      señal<readonly File[]>('archivoDeEdicion').set([
        new File(['x'], 'diploma-nuevo.pdf', { type: 'application/pdf' }),
      ]);
      responderConfirmacion(true);

      await interno<() => Promise<void>>('guardarEdicion')();
      http
        .expectOne((r) => r.url.endsWith('/common/files/upload'))
        .flush({ message: 'nope' }, { status: 500, statusText: 'Server Error' });

      expect(http.match('/profiles/practitioners/me/credentials/cred-9')).toHaveLength(0);
      expect(señal<unknown>('edicion')()).not.toBeNull();
      expect(interno<() => boolean>('guardandoEdicion')()).toBe(false);
    });

    it('corregir una matrícula con un respaldo nuevo también manda fileId', async () => {
      montarYCargar(PERFIL_CON_FILAS);
      const fila = interno<() => readonly { id: string }[]>('filasMatriculas')().find(
        (f) => f.id === 'lic-9',
      );
      interno<(f: unknown) => void>('editarMatricula')(fila);
      señal<readonly File[]>('archivoDeEdicion').set([
        new File(['x'], 'carnet.pdf', { type: 'application/pdf' }),
      ]);
      responderConfirmacion(true);

      await interno<() => Promise<void>>('guardarEdicion')();

      http.expectOne((r) => r.url.endsWith('/common/files/upload')).flush({ id: 'file-99' });
      const req = http.expectOne('/profiles/practitioners/me/jurisdiction-authorizations/lic-9');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body.fileId).toBe('file-99');
      req.flush(null);
      http
        .expectOne('/profiles/practitioners/me/summary')
        .flush({ ...PERFIL_BASE, ...PERFIL_CON_FILAS });
    });

    it('cerrar sin cambios no pregunta; con cambios pregunta si se descartan', async () => {
      montarYCargar(PERFIL_CON_FILAS);
      abrirTitulo();
      const guarda = interno<() => boolean | Promise<boolean>>('guardaDeEdicion');

      const sinCambios = responderConfirmacion(false);
      expect(await guarda()).toBe(true);
      expect(sinCambios.preguntas).toBe(0);

      señal<string>('edicionNumero').set('TIT-1-CORREGIDO');
      const conCambios = responderConfirmacion(false);
      expect(await guarda()).toBe(false);
      expect(conCambios.preguntas).toBe(1);

      responderConfirmacion(true);
      expect(await guarda()).toBe(true);
    });

    it('mientras guarda, el diálogo no se deja cerrar', async () => {
      montarYCargar(PERFIL_CON_FILAS);
      abrirTitulo();
      señal<boolean>('guardandoEdicion').set(true);

      expect(await interno<() => boolean | Promise<boolean>>('guardaDeEdicion')()).toBe(false);
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
  describe('las tres tablas: paginación, filtro «Estado» y acciones de fila (H4.S3)', () => {
    /** Doce títulos pendientes, del 2020 hacia atrás: la tabla los ordena del más reciente al más antiguo. */
    const DOCE_TITULOS = {
      credentials: Array.from({ length: 12 }, (_, i) => ({
        id: `cred-${String(i + 1).padStart(2, '0')}`,
        credentialTypeConceptId: 'cred-titulo',
        number: `TIT-${i + 1}`,
        issueDate: `${2020 - i}-03-01T12:00:00.000Z`,
        stateConceptId: 'st-pending',
      })),
    };

    /** Una especialidad verificada y una pendiente; una matrícula activa y una pendiente. */
    const CON_ESTADOS = {
      specialties: [
        {
          id: 'spec-ok',
          specialtyConceptId: 'esp-cardio',
          isPrimary: false,
          boardCertified: false,
          verificationStatusConceptId: 'st-ok',
          verified: true,
        },
        {
          id: 'spec-pend',
          specialtyConceptId: 'esp-pediatria',
          isPrimary: false,
          boardCertified: false,
          verificationStatusConceptId: 'st-pending',
          verified: false,
        },
      ],
      licenses: [
        {
          id: 'lic-activa',
          jurisdictionConceptId: 'jur-bo',
          licenseNumber: 'MP-1',
          regulatoryAuthority: 'SEDES Santa Cruz',
          stateConceptId: 'st-activo',
          fileId: 'file-carnet',
        },
        {
          id: 'lic-pendiente',
          jurisdictionConceptId: 'jur-bo',
          licenseNumber: 'MP-2',
          stateConceptId: 'st-pendiente',
        },
      ],
    };

    /** Los ids de lo que la tabla dibuja en la página actual. */
    function enLaPagina(estado: string): readonly string[] {
      const vista = interno<() => { status: string; data?: readonly { id: string }[] }>(estado)();
      return (vista.data ?? []).map((fila) => fila.id);
    }

    function codigos(acciones: readonly { code: string }[]): readonly string[] {
      return acciones.map((accion) => accion.code);
    }

    /** Las etiquetas de los dos estados de matrícula de `CON_ESTADOS`, con el código del simulador. */
    function darEtiquetasDeMatricula(): void {
      const estado = (conceptId: string, code: string, display: string) =>
        [conceptId, { conceptId, code, display, codeSystemVersionId: 'csv-1' }] as const;
      señal<ReadonlyMap<string, unknown>>('etiquetas').set(
        new Map([
          estado('st-activo', 'ST-ACTIVE', 'Activo'),
          estado('st-pendiente', 'ST-PENDING', 'Pendiente'),
        ]),
      );
    }

    it('con doce títulos se ven diez y el paginador dice «1–10 de 12»; la página 2 trae los otros dos', () => {
      const fixture = montarConVista(DOCE_TITULOS);
      componente.pestana.set(4);
      fixture.detectChanges();

      const tabla = panelAbierto(fixture);
      expect(
        tabla.querySelectorAll('[data-testid="tabla-formacion"] tbody tr.data-table__row'),
      ).toHaveLength(10);
      expect(tabla.querySelector('[data-testid="paginacion-formacion"]')?.textContent).toContain(
        '1–10 de 12',
      );

      señal<number>('paginaFormacion').set(2);
      fixture.detectChanges();

      expect(enLaPagina('estadoFormacion')).toEqual(['cred-11', 'cred-12']);
      expect(tabla.querySelector('[data-testid="paginacion-formacion"]')?.textContent).toContain(
        '11–12 de 12',
      );
    });

    it('buscar o filtrar vuelve a la primera página; un aviso sin cambios no la mueve', () => {
      montarYCargar(DOCE_TITULOS);
      const filtrar = interno<(a: Record<string, string>) => void>('onFiltrosFormacion');
      const pagina = señal<number>('paginaFormacion');

      pagina.set(2);
      filtrar({});
      expect(pagina()).toBe(2);

      filtrar({ qTitulos: 'tit' });
      expect(pagina()).toBe(1);

      pagina.set(2);
      filtrar({ qTitulos: 'tit', estadoTitulo: 'pendiente' });
      expect(pagina()).toBe(1);
    });

    it('la página de especialidades y la de matrículas también vuelven a la primera al buscar', () => {
      montarYCargar(CON_ESTADOS);
      señal<number>('paginaEspecialidades').set(3);
      señal<number>('paginaMatriculas').set(3);

      interno<(a: Record<string, string>) => void>('onFiltrosEspecialidades')({
        qEspecialidades: 'x',
      });
      interno<(a: Record<string, string>) => void>('onFiltrosMatriculas')({ qMatriculas: 'x' });

      expect(señal<number>('paginaEspecialidades')()).toBe(1);
      expect(señal<number>('paginaMatriculas')()).toBe(1);
    });

    it('el filtro «Estado» de especialidades separa lo pendiente de lo verificado', () => {
      montarYCargar(CON_ESTADOS);
      const filtrar = interno<(a: Record<string, string>) => void>('onFiltrosEspecialidades');

      filtrar({ estadoEspecialidad: 'pendiente' });
      expect(enLaPagina('estadoEspecialidades')).toEqual(['spec-pend']);

      filtrar({ estadoEspecialidad: 'verificado' });
      expect(enLaPagina('estadoEspecialidades')).toEqual(['spec-ok']);

      filtrar({});
      expect(enLaPagina('estadoEspecialidades')).toEqual(['spec-ok', 'spec-pend']);
    });

    it('el filtro «Estado» de matrículas ofrece los estados que traen y filtra por el concepto', () => {
      montarYCargar(CON_ESTADOS);

      const [filtro] =
        interno<() => readonly { key: string; options: readonly { value: string }[] }[]>(
          'filtrosMatriculas',
        )();
      expect(filtro?.key).toBe('estadoMatricula');
      expect(filtro?.options.map((opcion) => opcion.value)).toEqual(['st-activo', 'st-pendiente']);

      interno<(a: Record<string, string>) => void>('onFiltrosMatriculas')({
        estadoMatricula: 'st-pendiente',
      });
      expect(enLaPagina('estadoMatriculas')).toEqual(['lic-pendiente']);
    });

    it('la búsqueda y el estado arrancan con lo que ya trae la URL', () => {
      parametros = { estadoEspecialidad: 'pendiente', estadoMatricula: 'st-activo' };
      montarYCargar(CON_ESTADOS);

      expect(enLaPagina('estadoEspecialidades')).toEqual(['spec-pend']);
      expect(enLaPagina('estadoMatriculas')).toEqual(['lic-activa']);
    });

    it('al cambiar de pestaña se olvidan los filtros de estado y cada tabla vuelve a su primera página', () => {
      parametros = { estadoEspecialidad: 'pendiente', estadoMatricula: 'st-activo' };
      montarYCargar(CON_ESTADOS);
      señal<number>('paginaFormacion').set(2);

      interno<() => void>('olvidarBusquedaDeLasTablas')();

      expect(enLaPagina('estadoEspecialidades')).toEqual(['spec-ok', 'spec-pend']);
      expect(enLaPagina('estadoMatriculas')).toEqual(['lic-activa', 'lic-pendiente']);
      expect(señal<number>('paginaFormacion')()).toBe(1);
    });

    it('las acciones de cada fila: lo verificado sólo se descarga; lo pendiente se edita y se retira', () => {
      montarYCargar({
        ...CON_ESTADOS,
        credentials: [
          {
            id: 'c-pend-archivo',
            credentialTypeConceptId: 'cred-titulo',
            number: 'T-1',
            stateConceptId: 'st-pending',
            fileId: 'f-1',
          },
          {
            id: 'c-pend',
            credentialTypeConceptId: 'cred-titulo',
            number: 'T-2',
            stateConceptId: 'st-pending',
          },
          {
            id: 'c-ok-archivo',
            credentialTypeConceptId: 'cred-titulo',
            number: 'T-3',
            stateConceptId: 'st-ok',
            verifiedAt: '2020-01-01T00:00:00.000Z',
            fileId: 'f-3',
          },
          {
            id: 'c-ok',
            credentialTypeConceptId: 'cred-titulo',
            number: 'T-4',
            stateConceptId: 'st-ok',
            verifiedAt: '2020-01-01T00:00:00.000Z',
          },
        ],
      });
      const titulos = interno<() => readonly { id: string }[]>('filasFormacion')();
      const accionesDe =
        interno<(fila: unknown) => readonly { code: string }[]>('accionesDeFormacion');
      const porId = (id: string) => accionesDe(titulos.find((fila) => fila.id === id));

      expect(codigos(porId('c-pend-archivo'))).toEqual(['editar', 'descargar', 'retirar']);
      expect(codigos(porId('c-pend'))).toEqual(['editar', 'retirar']);
      expect(codigos(porId('c-ok-archivo'))).toEqual(['descargar']);
      expect(codigos(porId('c-ok'))).toEqual([]);

      // Lo verificado de especialidades y matrículas, igual que los títulos (24/09/2026).
      const [verificada, pendiente] = interno<() => readonly unknown[]>('filasEspecialidades')();
      const accionesDeEspecialidad =
        interno<(f: unknown) => readonly { code: string }[]>('accionesDeEspecialidad');
      expect(codigos(accionesDeEspecialidad(verificada))).toEqual([]);
      expect(codigos(accionesDeEspecialidad(pendiente))).toEqual(['editar', 'retirar']);

      darEtiquetasDeMatricula();
      const [activa, porVerificar] = interno<() => readonly unknown[]>('filasMatriculas')();
      const accionesDeMatricula =
        interno<(f: unknown) => readonly { code: string }[]>('accionesDeMatricula');
      expect(codigos(accionesDeMatricula(activa))).toEqual(['descargar']);
      expect(codigos(accionesDeMatricula(porVerificar))).toEqual(['editar', 'retirar']);
    });

    it('mientras no llega el estado de una matrícula, se la trata como pendiente: es lo que dice la fila', () => {
      montarYCargar(CON_ESTADOS);
      const [activa] = interno<() => readonly unknown[]>('filasMatriculas')();
      expect(
        codigos(
          interno<(f: unknown) => readonly { code: string }[]>('accionesDeMatricula')(activa),
        ),
      ).toEqual(['editar', 'descargar', 'retirar']);
    });

    it('lo verificado dice por qué no tiene botones: «Verificada: ya no se corrige», «Activo: ya no se corrige»', () => {
      const fixture = montarConVista(CON_ESTADOS);
      darEtiquetasDeMatricula();
      /** La nota de la fila, buscada en la pestaña abierta. */
      const nota = (testId: string) =>
        panelAbierto(fixture)
          .querySelector(`[data-testid="${testId}"]`)
          ?.parentElement?.querySelector('.edicion__acciones-nota')
          ?.textContent?.trim();
      componente.pestana.set(0);
      fixture.detectChanges();
      expect(nota('especialidad-acciones-spec-ok')).toBe('Verificada: ya no se corrige');
      expect(nota('especialidad-acciones-spec-pend')).toBeUndefined();

      componente.pestana.set(5);
      fixture.detectChanges();
      expect(nota('matricula-acciones-lic-activa')).toBe('Activo: ya no se corrige');
      expect(nota('matricula-acciones-lic-pendiente')).toBeUndefined();
    });

    it('con tres acciones la fila muestra un solo disparador; con dos, los botones con su texto', () => {
      const fixture = montarConVista({
        ...CON_ESTADOS,
        credentials: [
          {
            id: 'c-pend-archivo',
            credentialTypeConceptId: 'cred-titulo',
            number: 'T-1',
            stateConceptId: 'st-pending',
            fileId: 'f-1',
          },
        ],
      });
      componente.pestana.set(4);
      fixture.detectChanges();
      const titulo = panelAbierto(fixture).querySelector(
        '[data-testid="formacion-acciones-c-pend-archivo"]',
      );
      expect(titulo?.querySelectorAll('[data-testid="row-actions-trigger"]')).toHaveLength(1);
      expect(titulo?.querySelectorAll('.row-actions__inline')).toHaveLength(0);

      componente.pestana.set(0);
      fixture.detectChanges();
      const especialidad = panelAbierto(fixture).querySelector(
        '[data-testid="especialidad-acciones-spec-pend"]',
      );
      const botones = [...(especialidad?.querySelectorAll('.row-actions__inline') ?? [])].map((b) =>
        b.textContent?.trim(),
      );
      expect(botones).toEqual(['Editar', 'Retirar']);
    });

    it('el estado va debajo del identificador en las tres tablas, para cuando su columna pasa al detalle', () => {
      const fixture = montarConVista({
        ...CON_ESTADOS,
        credentials: [
          {
            id: 'c-pend',
            credentialTypeConceptId: 'cred-titulo',
            number: 'T-1',
            stateConceptId: 'st-pending',
          },
        ],
      });
      componente.pestana.set(4);
      fixture.detectChanges();
      const titulo = panelAbierto(fixture).querySelector(
        '[data-testid="tabla-formacion"] [data-testid="formacion-estado-en-fila"]',
      );
      expect(titulo?.closest('.edicion__celda-principal')?.textContent).toContain('T-1');
      expect(titulo?.textContent?.trim()).toBeTruthy();

      componente.pestana.set(0);
      fixture.detectChanges();
      const especialidades = [
        ...panelAbierto(fixture).querySelectorAll('[data-testid="especialidad-estado-en-fila"]'),
      ].map((e) => e.textContent?.trim());
      expect(especialidades).toContain('Verificada');
      expect(especialidades).toHaveLength(2);

      componente.pestana.set(5);
      fixture.detectChanges();
      expect(
        panelAbierto(fixture).querySelectorAll('[data-testid="matricula-estado-en-fila"]'),
      ).toHaveLength(2);
    });

    it('el filtro «Estado» de especialidades dice «Verificada», como la tabla', () => {
      const filtro =
        interno<readonly { options: readonly { label: string }[] }[]>('filtrosEspecialidades')[0]!;
      expect(filtro.options.map((o) => o.label)).toEqual(['Pendiente', 'Verificada']);
    });

    it('cada acción elegida llama a lo que hacía su botón', () => {
      montarYCargar({
        credentials: [
          {
            id: 'c-1',
            credentialTypeConceptId: 'cred-titulo',
            number: 'T-1',
            stateConceptId: 'st-pending',
            fileId: 'f-1',
          },
        ],
      });
      const [fila] = interno<() => readonly unknown[]>('filasFormacion')();
      const llamadas: string[] = [];
      const espia = componente as unknown as Record<string, (f: unknown) => void>;
      for (const metodo of ['editarFormacion', 'descargarDiploma', 'retirarFormacion']) {
        espia[metodo] = () => llamadas.push(metodo);
      }

      const ejecutar = interno<(code: string, f: unknown) => void>('ejecutarAccionDeFormacion');
      ejecutar('editar', fila);
      ejecutar('descargar', fila);
      ejecutar('retirar', fila);
      ejecutar('otra', fila);

      expect(llamadas).toEqual(['editarFormacion', 'descargarDiploma', 'retirarFormacion']);
    });

    it('mientras baja un archivo o se retira una fila, esas acciones se apagan y lo dicen', () => {
      montarYCargar({
        credentials: [
          {
            id: 'c-1',
            credentialTypeConceptId: 'cred-titulo',
            number: 'T-1',
            stateConceptId: 'st-pending',
            fileId: 'f-1',
          },
          {
            id: 'c-2',
            credentialTypeConceptId: 'cred-titulo',
            number: 'T-2',
            stateConceptId: 'st-pending',
            fileId: 'f-2',
          },
        ],
      });
      const filas = interno<() => readonly { id: string }[]>('filasFormacion')();
      const accionesDe =
        interno<(f: unknown) => readonly { code: string; label: string; disabled?: boolean }[]>(
          'accionesDeFormacion',
        );
      const accion = (id: string, code: string) =>
        accionesDe(filas.find((f) => f.id === id)).find((a) => a.code === code);

      señal<string | null>('descargando').set('c-1');
      expect(accion('c-1', 'descargar')).toMatchObject({ label: 'Descargando…', disabled: true });
      expect(accion('c-2', 'descargar')).toMatchObject({ label: 'Descargar', disabled: true });

      señal<string | null>('retirando').set('c-2');
      expect(accion('c-2', 'retirar')).toMatchObject({ label: 'Retirando…', disabled: true });
      expect(accion('c-1', 'retirar')).toMatchObject({ label: 'Retirar', disabled: true });
    });
  });

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

    it('«Datos personales» muestra el correo de acceso, sin control para escribirlo (D-03)', () => {
      const fixture = montarConVista(CON_IDENTIDAD);

      const bloque = panelAbierto(fixture).querySelector('[data-testid="edicion-correo-acceso"]');
      expect(bloque).not.toBeNull();
      expect(bloque?.textContent).toContain('dra.salas@alovida.mock');
      expect(bloque?.querySelectorAll('input, select, textarea')).toHaveLength(0);
    });

    it('«Contacto» no ofrece celular, fijo ni correo del trabajo (D-03); la dirección del trabajo sí', () => {
      const fixture = montarConVista(CON_IDENTIDAD);

      señal<number>('pestana').set(1);
      fixture.detectChanges();

      const panel = panelAbierto(fixture);
      for (const testId of ['edicion-celular-trabajo', 'edicion-fijo-trabajo', 'edicion-correo-trabajo']) {
        expect(panel.querySelector(`[data-testid="${testId}"]`), testId).toBeNull();
      }
      const texto = (panel.textContent ?? '').replace(/\s+/g, ' ');
      expect(texto).not.toMatch(/(celular|fijo|tel[eé]fono|correo)[^.]{0,20}\b(del|de) trabajo/i);
      expect(panel.textContent).not.toContain('dra.salas@alovida.mock');
      // D-03 cubre teléfonos y correo; la dirección donde atiende se queda (24/09/2026).
      expect(panel.querySelector('[data-testid="edicion-direccion-trabajo"]')).not.toBeNull();
    });

    it('guardar no manda los contactos del trabajo: lo guardado no se borra (D-03)', () => {
      montarYCargar({
        ...CON_IDENTIDAD,
        workMobilePhone: '+591 70088888',
        workLandline: '+591 33000000',
        workEmail: 'consultorio@example.test',
      });

      interno<{ setValue(valor: string): void }>('celularPersonal').setValue('+591 70012345');
      interno<() => void>('guardarPresentacion')();

      const req = http.expectOne('/profiles/practitioners/me');
      expect(req.request.body).toEqual({ mobilePhone: '+591 70012345' });
      req.flush(PERFIL_BASE);
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

      interno<{ setValue(valor: string): void }>('celularPersonal').setValue('+591 7001');
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
