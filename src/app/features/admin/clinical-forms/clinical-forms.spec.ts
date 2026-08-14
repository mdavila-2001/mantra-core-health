import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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
    const req = peticionDeListado();
    expect(req.request.params.keys()).toEqual([]);

    req.flush([PLANTILLA]);
    expect(interno<() => { status: string }>('plantillas')().status).toBe('ready');
  });

  it('no deja crear sin especialidad, código, nombre y al menos un campo completo', () => {
    peticionDeListado().flush([]);

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
    peticionDeListado().flush([]);

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
    peticionDeListado().flush([]);

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
    peticionDeListado().flush([]);

    señal<string>('especialidad').set('sp-1');
    interno<() => void>('onEspecialidadElegida')();

    const req = http.expectOne((r) => r.url === '/charts/templates' && r.method === 'GET');
    expect(req.request.params.get('specialtyId')).toBe('sp-1');
    req.flush([PLANTILLA]);
  });
});
