import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { SpecialtyFormBlock } from './specialty-form-block';

/**
 * Completar la plantilla de la especialidad dentro del encuentro — carril 2,
 * punto 1. Lo que estas pruebas fijan:
 *
 * 1. **Vive dentro del encuentro abierto**, igual que el diagnóstico y la
 *    receta: sin uno, no hay dónde adjuntar la instancia de `forms`.
 * 2. **Una sola plantilla se preselecciona sola**; con más de una, se elige.
 * 3. **Los obligatorios del esquema gobiernan el envío**, no sólo el DTO.
 * 4. **Completar encadena las tres llamadas de `forms`** — abrir, capturar,
 *    cerrar — y limpia el formulario al terminar.
 * 5. **El `409` de una instancia repetida es un aviso, no un error rojo** —
 *    mismo criterio que el duplicado del diagnóstico.
 */

const PLANTILLA = {
  id: 'tpl-1',
  specialtyConceptId: 'sp-1',
  code: 'CARDIO_INTAKE',
  name: 'Ficha de cardiología',
  version: 1,
  statusConceptId: 'st-1',
  fields: [
    {
      assignmentId: 'as-1',
      fieldId: 'f-1',
      code: 'tolerancia',
      name: 'Tolerancia al ejercicio',
      dataType: 'string',
      required: true,
    },
    {
      assignmentId: 'as-2',
      fieldId: 'f-2',
      code: 'edema',
      name: 'Edema',
      dataType: 'boolean',
      required: false,
    },
  ],
};

describe('SpecialtyFormBlock', () => {
  let fixture: ComponentFixture<SpecialtyFormBlock>;
  let componente: SpecialtyFormBlock;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SpecialtyFormBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('encounterId', 'enc-1');
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function señal<T>(nombre: string): { set: (v: T) => void } {
    return (componente as unknown as Record<string, { set: (v: T) => void }>)[nombre];
  }

  function peticionDePlantillas() {
    return http.expectOne((r) => r.url === '/charts/templates' && r.method === 'GET');
  }

  it('con una sola plantilla, la preselecciona', () => {
    peticionDePlantillas().flush([PLANTILLA]);

    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-1');
  });

  it('sin plantillas, lo dice y no ofrece formulario', () => {
    peticionDePlantillas().flush([]);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('todavía no tiene una plantilla');
  });

  it('sin encuentro abierto no deja completar', () => {
    fixture.componentRef.setInput('encounterId', null);
    peticionDePlantillas().flush([PLANTILLA]);

    expect(interno<() => boolean>('hayEncuentro')()).toBe(false);
    expect(interno<() => boolean>('puedeCompletar')()).toBe(false);
  });

  it('no deja completar sin los campos obligatorios del esquema', () => {
    peticionDePlantillas().flush([PLANTILLA]);

    expect(interno<() => boolean>('puedeCompletar')()).toBe(false);

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');

    expect(interno<() => boolean>('puedeCompletar')()).toBe(true);
  });

  it('completar abre, captura y cierra la instancia, y limpia el formulario', () => {
    peticionDePlantillas().flush([PLANTILLA]);

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');
    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-2', true);

    let releido = 0;
    componente.cambio.subscribe(() => (releido += 1));

    interno<() => void>('completar')();

    const apertura = http.expectOne((r) => r.url === '/forms/instances' && r.method === 'POST');
    expect(apertura.request.body).toEqual({ resourceId: 'enc-1' });
    apertura.flush({ id: 'inst-1', schemaVersion: 1, state: 'open' });

    const captura = http.expectOne(
      (r) => r.url === '/forms/instances/inst-1/values' && r.method === 'POST',
    );
    expect(captura.request.body).toEqual({
      values: [
        { fieldId: 'f-1', dataType: 'string', value: 'Buena', assignmentId: 'as-1', ordinal: 0 },
        { fieldId: 'f-2', dataType: 'boolean', value: true, assignmentId: 'as-2', ordinal: 1 },
      ],
    });
    captura.flush({ ids: ['v-1', 'v-2'] });

    const cierre = http.expectOne(
      (r) => r.url === '/forms/instances/inst-1/close' && r.method === 'POST',
    );
    cierre.flush({ ok: true });

    expect(releido).toBe(1);
    expect(interno<() => Record<string, unknown>>('valores')()).toEqual({});
  });

  it('omite del envío los campos opcionales sin valor', () => {
    peticionDePlantillas().flush([PLANTILLA]);

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');
    interno<() => void>('completar')();

    const apertura = http.expectOne((r) => r.url === '/forms/instances');
    apertura.flush({ id: 'inst-1', schemaVersion: 1, state: 'open' });

    const captura = http.expectOne((r) => r.url === '/forms/instances/inst-1/values');
    expect((captura.request.body as { values: unknown[] }).values).toHaveLength(1);
    captura.flush({ ids: ['v-1'] });

    http.expectOne('/forms/instances/inst-1/close').flush({ ok: true });
  });

  it('el 409 de una instancia repetida se cuenta como aviso, no como error', () => {
    peticionDePlantillas().flush([PLANTILLA]);

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');
    interno<() => void>('completar')();

    http
      .expectOne((r) => r.url === '/forms/instances')
      .flush(
        {
          code: 'CONFLICT',
          message: 'Ya existe una instancia para el recurso y versión',
          timestamp: '',
          path: '',
        },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(interno<() => string | null>('avisoDeDuplicado')()).toContain('ya se completó');
    expect(interno<() => string | null>('errorDeCompletado')()).toBeNull();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="formulario-especialidad-duplicado"]')).not.toBeNull();
    expect(html.querySelector('[data-testid="formulario-especialidad-error"]')).toBeNull();
  });

  it('elegirPlantilla vacía los valores de la anterior', () => {
    const dosPlantillas = [PLANTILLA, { ...PLANTILLA, id: 'tpl-2', name: 'Otra' }];
    peticionDePlantillas().flush(dosPlantillas);

    // Con dos, no se preselecciona ninguna.
    expect(interno<() => string | null>('plantillaId')()).toBeNull();

    señal<string>('plantillaId').set('tpl-1');
    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');
    expect(interno<() => Record<string, unknown>>('valores')()).not.toEqual({});

    interno<(id: string) => void>('elegirPlantilla')('tpl-2');
    expect(interno<() => Record<string, unknown>>('valores')()).toEqual({});
  });
});
