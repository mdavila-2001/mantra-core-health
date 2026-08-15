import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { ClinicalForms } from './clinical-forms';

/**
 * Carril 2 · punto 1: crear una plantilla de chart con su esquema de campos, y
 * ver las que ya existen. El backend hasta ahora sólo **asignaba** una
 * plantilla (UC-15-12); acá se prueban los tres endpoints nuevos.
 */
const RUTA = '/administration/clinical-forms';

const PLANTILLA = {
  id: 'tpl-1',
  specialtyConceptId: 'sp-1',
  code: 'CARDIO_INTAKE',
  name: 'Ficha de cardiología',
  version: 1,
  statusConceptId: 'st-1',
  fields: [],
};

describe('ClinicalForms', () => {
  let harness: RouterTestingHarness;
  let componente: ClinicalForms;
  let http: HttpTestingController;
  /** El listado que pide la pantalla de armado al entrar. */
  let listadoInicial: TestRequest;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administration/clinical-forms', component: ClinicalForms }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, ClinicalForms);

    // El catálogo de formularios estándar (carril R2-5) va embebido al final de
    // esta pantalla y pide su propio listado —sin filtrar, porque agrupa por
    // especialidad—. La pantalla pide primero, en su constructor; el catálogo
    // después, al renderizarse. Se descarta acá para que cada prueba hable sólo
    // de la pantalla de armado; el catálogo tiene su propio spec.
    const [pantalla, ...delCatalogo] = http.match(
      (r) => r.url === '/charts/templates' && r.method === 'GET',
    );
    listadoInicial = pantalla;
    delCatalogo.forEach((peticion) => peticion.flush([]));
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /**
   * Una señal escribible, **sin `bind`**: `bind` devuelve una función nueva
   * que no conserva `.set`/`.update`, que son propiedades de la señal
   * original y no del prototipo de función.
   */
  function señal<T>(nombre: string): { set: (v: T) => void } {
    return (componente as unknown as Record<string, { set: (v: T) => void }>)[nombre];
  }

  function peticionDeListado() {
    return http.expectOne((r) => r.url === '/charts/templates' && r.method === 'GET');
  }

  it('al entrar pide el listado de plantillas sin filtro de especialidad', () => {
    expect(listadoInicial.request.params.keys()).toEqual([]);

    listadoInicial.flush([PLANTILLA]);
    expect(interno<() => { status: string }>('plantillas')().status).toBe('ready');
  });

  it('no deja crear sin especialidad, código, nombre y al menos un campo completo', () => {
    listadoInicial.flush([]);

    expect(interno<() => boolean>('puedeCrear')()).toBe(false);

    señal<string>('especialidad').set('sp-1');
    señal<string>('codigo').set('CARDIO_INTAKE');
    señal<string>('nombre').set('Ficha de cardiología');

    // Especialidad, código y nombre solos no alcanzan: falta un campo.
    expect(interno<() => boolean>('puedeCrear')()).toBe(false);

    interno<(clave: string, cambios: Record<string, unknown>) => void>('actualizarCampo')(
      interno<() => readonly { clave: string }[]>('campos')()[0].clave,
      { code: 'f1', name: 'Campo 1' },
    );

    expect(interno<() => boolean>('puedeCrear')()).toBe(true);
  });

  it('crear manda la especialidad, el código, el nombre y los campos completos', () => {
    listadoInicial.flush([]);

    señal<string>('especialidad').set('sp-1');
    señal<string>('codigo').set('CARDIO_INTAKE');
    señal<string>('nombre').set('Ficha de cardiología');
    interno<(clave: string, cambios: Record<string, unknown>) => void>('actualizarCampo')(
      interno<() => readonly { clave: string }[]>('campos')()[0].clave,
      { code: 'ejercicio_tolerancia', name: 'Tolerancia al ejercicio', dataType: 'string' },
    );

    interno<() => void>('crear')();

    const req = http.expectOne((r) => r.url === '/charts/templates' && r.method === 'POST');
    expect(req.request.body).toEqual({
      specialtyConceptId: 'sp-1',
      code: 'CARDIO_INTAKE',
      name: 'Ficha de cardiología',
      fields: [
        {
          code: 'ejercicio_tolerancia',
          name: 'Tolerancia al ejercicio',
          dataType: 'string',
          required: false,
          ordinal: 0,
        },
      ],
    });

    req.flush(PLANTILLA);

    // Tras crear, se releen las plantillas.
    peticionDeListado().flush([PLANTILLA]);

    expect(interno<() => string>('codigo')()).toBe('');
    expect(interno<() => string>('nombre')()).toBe('');
  });

  it('una fila de campo a medias (código sin nombre) no habilita crear ni manda nada', () => {
    listadoInicial.flush([]);

    señal<string>('especialidad').set('sp-1');
    señal<string>('codigo').set('C1');
    señal<string>('nombre').set('N1');
    // La única fila queda con código pero sin nombre.
    interno<(clave: string, cambios: Record<string, unknown>) => void>('actualizarCampo')(
      interno<() => readonly { clave: string }[]>('campos')()[0].clave,
      { code: 'solo_codigo' },
    );

    expect(interno<() => boolean>('puedeCrear')()).toBe(false);

    interno<() => void>('crear')();

    // `http.verify()` en el afterEach falla si algo salió a la red.
    http.expectNone((r) => r.url === '/charts/templates' && r.method === 'POST');
  });

  it('elegir una especialidad vuelve a pedir el listado filtrado', () => {
    listadoInicial.flush([]);

    señal<string>('especialidad').set('sp-1');
    interno<() => void>('onEspecialidadElegida')();

    const req = http.expectOne((r) => r.url === '/charts/templates' && r.method === 'GET');
    expect(req.request.params.get('specialtyId')).toBe('sp-1');
    req.flush([PLANTILLA]);
  });

  /* -- Carril R2-5: duplicar un formulario del catálogo --------------------- */

  it('duplicar del catálogo precarga el alta con los campos del formulario', () => {
    listadoInicial.flush([]);

    interno<(p: unknown) => void>('duplicarDelCatalogo')({
      id: 'tpl-cat',
      specialtyConceptId: 'esp-cardio',
      code: 'CARDIO_FICHA_BASE',
      name: 'Ficha cardiológica',
      version: 1,
      statusConceptId: 'st-1',
      fields: [
        {
          assignmentId: 'a1',
          fieldId: 'f1',
          // El catálogo prefija el código con el de su plantilla; al editarlo
          // el admin trabaja con el código pelado.
          code: 'CARDIO_FICHA_BASE.dolor_toracico',
          name: 'Dolor torácico',
          dataType: 'boolean',
          required: true,
        },
      ],
    });

    expect(interno<() => string>('especialidad')()).toBe('esp-cardio');
    expect(interno<() => string>('codigo')()).toBe('CARDIO_FICHA_BASE_ADAPTADA');
    expect(interno<() => string>('nombre')()).toBe('Ficha cardiológica (adaptada)');

    const campos = interno<
      () => readonly { code: string; name: string; dataType: string; required: boolean }[]
    >('campos')();
    expect(campos).toHaveLength(1);
    expect(campos[0].code).toBe('dolor_toracico');
    expect(campos[0].name).toBe('Dolor torácico');
    expect(campos[0].dataType).toBe('boolean');
    expect(campos[0].required).toBe(true);

    // Duplicar no crea nada del lado del servidor: lo que hace es dejar el alta
    // listo. Sí vuelve a leer el listado, ahora filtrado por la especialidad.
    http.expectNone((r) => r.method === 'POST');
    peticionDeListado().flush([]);
  });
});
