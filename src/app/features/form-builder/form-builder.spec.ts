import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { FormBuilder } from './form-builder';
import type { ChartTemplate } from '../../core/data-access/chart-templates/chart-templates.types';
import { MAX_CAMPOS_POR_PAGINA } from '../../shared/forms/paginated/paginated-form.types';

const RUTA = '/form-builder';

/** Un campo del formulario estándar: existe, no se toca. */
function estandar(n: number) {
  return {
    assignmentId: `as-${n}`,
    fieldId: `f-${n}`,
    code: `ANAMNESIS.campo_${n}`,
    name: `Campo ${n}`,
    dataType: 'string',
    required: false,
    ordinal: n,
    own: false,
  };
}

const PLANTILLA: ChartTemplate = {
  id: 'tpl-1',
  specialtyConceptId: 'sp-1',
  code: 'ANAMNESIS',
  name: 'Anamnesis general',
  version: 1,
  statusConceptId: 'st-1',
  sectionId: 'sec-1',
  fieldTargetConceptId: 'target-1',
  fields: [estandar(1), estandar(2), estandar(3)],
};

const PRESUPUESTO = {
  targetResourceConceptId: 'target-1',
  allowTenantFields: true,
  maximumFields: 12,
  used: 0,
  remaining: 12,
};

describe('FormBuilder', () => {
  let harness: RouterTestingHarness;
  let componente: FormBuilder;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'form-builder', component: FormBuilder }]),
      ],
    });

    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    componente = await harness.navigateByUrl(RUTA, FormBuilder);
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  /**
   * Una señal escribible, **sin `bind`**: `bind` devuelve una función nueva que
   * no conserva `.set`/`.update`, que son propiedades de la señal original y no
   * del prototipo de función.
   */
  function señal<T>(nombre: string): { set: (v: T) => void } {
    return (componente as unknown as Record<string, { set: (v: T) => void }>)[
      nombre
    ];
  }

  /** Deja la pantalla con la plantilla abierta y su presupuesto leído. */
  function abrirPlantilla(
    plantilla: ChartTemplate = PLANTILLA,
    presupuesto = PRESUPUESTO,
  ): void {
    http
      .expectOne((r) => r.url === '/charts/templates' && r.method === 'GET')
      .flush([plantilla]);
    harness.detectChanges();

    interno<(p: ChartTemplate) => void>('abrir')(plantilla);
    http
      .expectOne((r) => r.url === `/charts/templates/${plantilla.id}`)
      .flush(plantilla);
    http
      .expectOne((r) => r.url.startsWith('/forms/assignments/budget'))
      .flush(presupuesto);
    harness.detectChanges();
  }

  it('lista los formularios estándar al entrar', () => {
    const peticion = http.expectOne(
      (r) => r.url === '/charts/templates' && r.method === 'GET',
    );
    expect(peticion.request.method).toBe('GET');
    peticion.flush([PLANTILLA]);
    harness.detectChanges();

    expect(interno<() => readonly ChartTemplate[] | null>('listado')()).toEqual([
      PLANTILLA,
    ]);
  });

  it('al abrir un formulario pide su presupuesto de extensión con el target de la plantilla', () => {
    http
      .expectOne((r) => r.url === '/charts/templates' && r.method === 'GET')
      .flush([PLANTILLA]);
    harness.detectChanges();

    interno<(p: ChartTemplate) => void>('abrir')(PLANTILLA);
    http.expectOne((r) => r.url === '/charts/templates/tpl-1').flush(PLANTILLA);

    const budget = http.expectOne((r) =>
      r.url.startsWith('/forms/assignments/budget'),
    );
    expect(budget.request.params.get('targetResourceConceptId')).toBe('target-1');
    budget.flush(PRESUPUESTO);
  });

  it('separa los campos del estándar de los de la organización', () => {
    abrirPlantilla({
      ...PLANTILLA,
      fields: [estandar(1), { ...estandar(2), own: true, name: '¿Fuma?' }],
    });

    expect(interno<() => readonly unknown[]>('camposEstandar')()).toHaveLength(1);
    expect(interno<() => readonly unknown[]>('camposPropios')()).toHaveLength(1);
  });

  it('la vista previa nunca pone más de cuatro campos en una página', () => {
    // Siete campos: el motor tiene que dar dos páginas, cuatro y tres. Es la
    // misma disciplina que sirve el formulario de verdad, así que lo que la
    // vista previa muestra es lo que el paciente va a ver.
    abrirPlantilla({
      ...PLANTILLA,
      fields: [1, 2, 3, 4, 5, 6, 7].map(estandar),
    });

    const paginas = interno<() => readonly { campos: readonly unknown[] }[]>(
      'paginas',
    )();
    expect(paginas).toHaveLength(2);
    for (const pagina of paginas) {
      expect(pagina.campos.length).toBeLessThanOrEqual(MAX_CAMPOS_POR_PAGINA);
    }
  });

  it('el campo que se está escribiendo ya aparece en la vista previa', () => {
    // Es lo que convierte la vista previa en una respuesta y no en un resumen:
    // el quinto campo abre una página nueva **mientras** se decide agregarlo.
    abrirPlantilla({ ...PLANTILLA, fields: [1, 2, 3, 4].map(estandar) });
    expect(interno<() => readonly unknown[]>('paginas')()).toHaveLength(1);

    señal<string>('nombreDelCampo').set('¿Fuma?');
    harness.detectChanges();

    expect(interno<() => readonly unknown[]>('paginas')()).toHaveLength(2);
  });

  it('agregar un campo declara la definición y después la cuelga de la sección', () => {
    abrirPlantilla();

    señal<string>('nombreDelCampo').set('¿Fuma?');
    señal<string>('tipoDelCampo').set('boolean');
    harness.detectChanges();

    interno<() => void>('agregarCampo')();

    const definicion = http.expectOne('/forms/field-definitions');
    expect(definicion.request.body).toEqual(
      expect.objectContaining({ name: '¿Fuma?', dataType: 'boolean' }),
    );
    // El código lleva el prefijo de la plantilla: `dynamic_field_definitions`
    // es una tabla global y dos consultorios chocarían por «Fuma».
    expect(String(definicion.request.body.code)).toMatch(/^ANAMNESIS\./);
    definicion.flush({ id: 'field-nuevo' });

    const asignacion = http.expectOne('/forms/assignments');
    expect(asignacion.request.body).toEqual(
      expect.objectContaining({
        fieldId: 'field-nuevo',
        targetResourceConceptId: 'target-1',
        sectionId: 'sec-1',
      }),
    );
    // El tenant NO viaja en el cuerpo: lo fija el backend con el de la sesión y
    // rechaza cualquier otro. Mandarlo sería pedir algo que no se puede.
    expect(asignacion.request.body).not.toHaveProperty('tenantId');
    asignacion.flush({ id: 'as-nueva' });

    // Releer la plantilla es cómo el campo nuevo aparece en la lista y en la
    // vista previa, y cómo el presupuesto se actualiza.
    http.expectOne((r) => r.url === '/charts/templates/tpl-1').flush(PLANTILLA);
    http
      .expectOne((r) => r.url.startsWith('/forms/assignments/budget'))
      .flush({ ...PRESUPUESTO, used: 1, remaining: 11 });
  });

  it('con la política cerrada no deja agregar, y lo dice antes de escribir nada', () => {
    abrirPlantilla(PLANTILLA, {
      ...PRESUPUESTO,
      allowTenantFields: false,
      remaining: 0,
    });

    señal<string>('nombreDelCampo').set('¿Fuma?');
    harness.detectChanges();

    expect(interno<() => boolean>('admiteCamposPropios')()).toBe(false);
    expect(interno<() => boolean>('puedeCrear')()).toBe(false);
  });

  it('con el presupuesto agotado tampoco', () => {
    abrirPlantilla(PLANTILLA, { ...PRESUPUESTO, used: 12, remaining: 0 });

    señal<string>('nombreDelCampo').set('Otro');
    harness.detectChanges();

    expect(interno<() => boolean>('quedanCampos')()).toBe(false);
    expect(interno<() => boolean>('puedeCrear')()).toBe(false);
  });

  it('si el presupuesto no se pudo leer, no se bloquea el alta por inventar una regla', () => {
    http
      .expectOne((r) => r.url === '/charts/templates' && r.method === 'GET')
      .flush([PLANTILLA]);
    harness.detectChanges();

    interno<(p: ChartTemplate) => void>('abrir')(PLANTILLA);
    http.expectOne((r) => r.url === '/charts/templates/tpl-1').flush(PLANTILLA);
    http
      .expectOne((r) => r.url.startsWith('/forms/assignments/budget'))
      .flush('nope', { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    señal<string>('nombreDelCampo').set('¿Fuma?');
    harness.detectChanges();

    expect(interno<() => boolean>('puedeCrear')()).toBe(true);
  });
});
