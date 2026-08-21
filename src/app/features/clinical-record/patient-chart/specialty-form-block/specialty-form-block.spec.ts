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

  afterEach(() => {
    // El bloque pregunta con qué especialidad se presenta quien atiende para
    // preseleccionar su plantilla. La mayoría de los casos no la ejerce, así
    // que se drena acá: sin perfil profesional —lo que responde el 404— el
    // bloque sigue funcionando con el selector de siempre.
    for (const perfil of http.match(
      (r) => r.url === '/profiles/practitioners/me/summary',
    )) {
      if (!perfil.cancelled) {
        perfil.flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
      }
    }
    http.verify();
  });

  /** La especialidad de quien atiende, para los casos que la ejercen. */
  function responderEspecialidad(specialtyConceptId: string): void {
    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush({
        profileId: 'hp-1',
        personId: 'per-1',
        practitionerCode: 'MP-1',
        specialties: [
          {
            id: 'sp-1',
            specialtyConceptId,
            isPrimary: true,
            boardCertified: false,
            verificationStatusConceptId: 'vs-1',
          },
        ],
        credentials: [],
        licenses: [],
        languages: [],
        affiliations: [],
        activity: {},
        createdAt: '2026-08-17T14:00:00.000Z',
      });
  }

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

  /* ---- la plantilla de tu especialidad ------------------------------------ */

  it('preselecciona la plantilla de la especialidad de quien atiende', () => {
    const odonto = { ...PLANTILLA, id: 'tpl-odo', specialtyConceptId: 'sp-odo' };
    peticionDePlantillas().flush([PLANTILLA, odonto]);
    // Con dos plantillas y sin especialidad todavía, no se elige ninguna.
    expect(interno<() => string | null>('plantillaId')()).toBeNull();

    responderEspecialidad('sp-odo');

    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-odo');
  });

  it('el selector sigue ofreciendo el catálogo entero: preselecciona, no filtra', () => {
    const odonto = { ...PLANTILLA, id: 'tpl-odo', specialtyConceptId: 'sp-odo' };
    peticionDePlantillas().flush([PLANTILLA, odonto]);
    responderEspecialidad('sp-odo');

    // Las transversales y las de otras especialidades siguen a mano.
    expect(interno<() => readonly unknown[]>('opcionesDePlantilla')()).toHaveLength(2);
    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-odo');
  });

  it('una elección manual no la pisa la especialidad que llega después', () => {
    const odonto = { ...PLANTILLA, id: 'tpl-odo', specialtyConceptId: 'sp-odo' };
    peticionDePlantillas().flush([PLANTILLA, odonto]);

    interno<(id: string) => void>('elegirPlantilla')('tpl-1');
    responderEspecialidad('sp-odo');

    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-1');
  });

  it('sin perfil profesional no rompe: queda el selector de siempre', () => {
    peticionDePlantillas().flush([PLANTILLA, { ...PLANTILLA, id: 'tpl-2' }]);

    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });

    expect(interno<() => string | null>('plantillaId')()).toBeNull();
    expect(interno<() => readonly unknown[]>('opcionesDePlantilla')()).toHaveLength(2);
  });

  it('una especialidad que ya no ejerce no decide la plantilla', () => {
    peticionDePlantillas().flush([PLANTILLA, { ...PLANTILLA, id: 'tpl-2' }]);

    http.expectOne((r) => r.url === '/profiles/practitioners/me/summary').flush({
      profileId: 'hp-1',
      personId: 'per-1',
      practitionerCode: 'MP-1',
      specialties: [
        {
          id: 'sp-vieja',
          specialtyConceptId: 'sp-1',
          isPrimary: true,
          boardCertified: false,
          verificationStatusConceptId: 'vs-1',
          // Dejó de ejercerla: no puede decidir qué ficha se le ofrece hoy.
          validTo: '2025-01-01',
        },
      ],
      credentials: [],
      licenses: [],
      languages: [],
      affiliations: [],
      activity: {},
      createdAt: '2026-08-17T14:00:00.000Z',
    });

    expect(interno<() => string | null>('plantillaId')()).toBeNull();
  });

  /* ---- el odontograma ------------------------------------------------------ */

  /** La plantilla del odontograma, con su campo json y los conteos del CPO-D. */
  const PLANTILLA_ODONTO = {
    ...PLANTILLA,
    id: 'tpl-odo',
    code: 'ODONTO_ODONTOGRAMA_OMS',
    name: 'Odontograma OMS',
    fields: [
      {
        assignmentId: 'as-o',
        fieldId: 'f-odo',
        code: 'ODONTO_ODONTOGRAMA_OMS.odontograma_fdi',
        name: 'Odontograma',
        dataType: 'json',
        required: false,
      },
      {
        assignmentId: 'as-c',
        fieldId: 'f-car',
        code: 'ODONTO_ODONTOGRAMA_OMS.dientes_cariados',
        name: 'Cariados',
        dataType: 'integer',
        required: false,
      },
      {
        assignmentId: 'as-i',
        fieldId: 'f-cpod',
        code: 'ODONTO_ODONTOGRAMA_OMS.indice_cpod',
        name: 'CPO-D',
        dataType: 'decimal',
        required: false,
      },
    ],
  };

  it('reconoce el campo del odontograma por su código, no por el tipo', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);

    const esOdontograma = interno<(campo: unknown) => boolean>('esOdontograma');
    expect(esOdontograma(PLANTILLA_ODONTO.fields[0])).toBe(true);
    // Otro campo `json` cualquiera NO se dibuja como una boca.
    expect(
      esOdontograma({ ...PLANTILLA_ODONTO.fields[0], code: 'X.otra_cosa' }),
    ).toBe(false);
  });

  it('registrar el estado de una pieza arma el mapa y sugiere los índices', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);

    interno<(fdi: string) => void>('abrirPieza')('16');
    interno<(fieldId: string, codigo: string) => void>('fijarEstado')('f-odo', '1');

    const valores = interno<() => Record<string, unknown>>('valores')();
    expect(valores['f-odo']).toEqual({ '16': '1' });
    // Una cariada: el conteo y el índice se rellenan solos.
    expect(valores['f-car']).toBe(1);
    expect(valores['f-cpod']).toBe(1);
  });

  it('volver a elegir el mismo estado lo borra', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);

    interno<(fdi: string) => void>('abrirPieza')('16');
    interno<(fieldId: string, codigo: string) => void>('fijarEstado')('f-odo', '1');
    interno<(fdi: string) => void>('abrirPieza')('16');
    interno<(fieldId: string, codigo: string) => void>('fijarEstado')('f-odo', '1');

    expect(interno<() => Record<string, unknown>>('valores')()['f-odo']).toEqual({});
  });

  it('la sugerencia no pisa un conteo tecleado a mano', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-car', 7);
    interno<(fdi: string) => void>('abrirPieza')('16');
    interno<(fieldId: string, codigo: string) => void>('fijarEstado')('f-odo', '1');

    const valores = interno<() => Record<string, unknown>>('valores')();
    expect(valores['f-car']).toBe(7);
    // El que estaba vacío sí se sugiere.
    expect(valores['f-cpod']).toBe(1);
  });

  it('un odontograma sin ninguna pieza tocada no viaja', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-odo', {});
    interno<() => void>('completar')();

    // Sin ningún valor que mandar, `completar` ni siquiera abre la instancia.
    http.expectNone((r) => r.url === '/forms/instances' && r.method === 'POST');
  });

  it('el mapa del odontograma viaja como json', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);

    interno<(fdi: string) => void>('abrirPieza')('16');
    interno<(fieldId: string, codigo: string) => void>('fijarEstado')('f-odo', '1');
    interno<() => void>('completar')();

    const apertura = http.expectOne(
      (r) => r.url === '/forms/instances' && r.method === 'POST',
    );
    apertura.flush(INSTANCIA);

    const captura = http.expectOne(
      (r) => r.url === '/forms/instances/inst-9/values' && r.method === 'POST',
    );
    const body = captura.request.body as { values: { fieldId: string; dataType: string; value: unknown }[] };
    const odontograma = body.values.find((valor) => valor.fieldId === 'f-odo')!;
    expect(odontograma.dataType).toBe('json');
    expect(odontograma.value).toEqual({ '16': '1' });

    captura.flush({ ids: ['v-1'] });
    http.expectOne((r) => r.url === '/forms/instances/inst-9/close').flush({});
    // Tras guardar, el bloque relee para pasar a modo lectura.
    peticionDeRespuesta().flush(LISTADO_VACIO);
  });
});
