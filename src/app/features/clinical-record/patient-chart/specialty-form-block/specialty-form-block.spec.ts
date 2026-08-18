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
 * 6. **Con una instancia previa, el bloque entra en modo lectura**: muestra lo
 *    respondido, no ofrece crear otra, y los valores enmascarados salen como
 *    marcador — nunca el contenido.
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

  function peticionDeRespuesta() {
    return http.expectOne(
      (r) =>
        r.url === '/forms/instances' &&
        r.method === 'GET' &&
        r.params.get('encounter') === 'enc-1',
    );
  }

  const LISTADO_VACIO = { encounterId: 'enc-1', items: [], limit: 50, truncated: false };

  const INSTANCIA = {
    id: 'inst-9',
    resourceId: 'enc-1',
    resourceTypeConceptId: 'rt-1',
    schemaVersion: 1,
    stateConceptId: 'st-cerrada',
    closedAt: '2026-08-17T15:00:00.000Z',
    createdAt: '2026-08-17T14:00:00.000Z',
  };

  const DETALLE = {
    ...INSTANCIA,
    values: [
      { id: 'v-1', fieldId: 'f-1', dataType: 'string', value: 'Buena', ordinal: 0, masked: false },
      { id: 'v-2', fieldId: 'f-2', dataType: 'boolean', value: 'SECRETO', ordinal: 1, masked: true },
    ],
  };

  /** Deja el bloque en modo lectura: plantillas + una instancia ya respondida. */
  function llegarAModoLectura() {
    peticionDePlantillas().flush([PLANTILLA]);
    fixture.detectChanges();
    peticionDeRespuesta().flush({ ...LISTADO_VACIO, items: [INSTANCIA] });
    http
      .expectOne((r) => r.url === '/forms/instances/inst-9' && r.method === 'GET')
      .flush(DETALLE);
    fixture.detectChanges();
  }

  it('con una sola plantilla, la preselecciona', () => {
    peticionDePlantillas().flush([PLANTILLA]);

    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-1');
  });

  it('sin plantillas, lo dice y no ofrece formulario', () => {
    peticionDePlantillas().flush([]);
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
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

    // Tras guardar, el bloque relee lo respondido del backend.
    peticionDeRespuesta().flush(LISTADO_VACIO);

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
    peticionDeRespuesta().flush(LISTADO_VACIO);
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
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    expect(interno<() => string | null>('avisoDeDuplicado')()).toContain('ya se completó');
    expect(interno<() => string | null>('errorDeCompletado')()).toBeNull();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="formulario-especialidad-duplicado"]')).not.toBeNull();
    expect(html.querySelector('[data-testid="formulario-especialidad-error"]')).toBeNull();
  });

  it('con una instancia previa entra en modo lectura y no ofrece captura', () => {
    llegarAModoLectura();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="formulario-respondido"]')).not.toBeNull();
    // La captura no se ofrece: sin campos ni botón de completar.
    expect(html.querySelector('[data-testid="campo-especialidad"]')).toBeNull();
    expect(html.querySelector('form')).toBeNull();

    const texto = html.textContent ?? '';
    expect(texto).toContain('Ficha de cardiología');
    expect(texto).toContain('Tolerancia al ejercicio');
    expect(texto).toContain('Buena');
    // `http.verify()` del afterEach certifica que no se disparó ningún POST.
  });

  it('un valor enmascarado muestra el marcador y jamás el contenido', () => {
    llegarAModoLectura();

    const html = fixture.nativeElement as HTMLElement;
    const marcador = html.querySelector('[data-testid="respuesta-enmascarada"]');
    expect(marcador).not.toBeNull();
    expect(marcador?.textContent).toContain('No disponible por reglas de acceso');
    // Aunque el backend mandara algo por error, el bloque no lo expone.
    expect(html.textContent ?? '').not.toContain('SECRETO');
  });

  it('tras guardar con éxito, relee y pasa a modo lectura', () => {
    peticionDePlantillas().flush([PLANTILLA]);
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');
    interno<() => void>('completar')();

    http
      .expectOne((r) => r.url === '/forms/instances' && r.method === 'POST')
      .flush({ id: 'inst-9', schemaVersion: 1, state: 'open' });
    http.expectOne('/forms/instances/inst-9/values').flush({ ids: ['v-1'] });
    http.expectOne('/forms/instances/inst-9/close').flush({ ok: true });

    // La relectura posterior encuentra la instancia recién guardada.
    peticionDeRespuesta().flush({ ...LISTADO_VACIO, items: [INSTANCIA] });
    http
      .expectOne((r) => r.url === '/forms/instances/inst-9' && r.method === 'GET')
      .flush(DETALLE);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="formulario-respondido"]')).not.toBeNull();
    expect(html.querySelector('form')).toBeNull();
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
