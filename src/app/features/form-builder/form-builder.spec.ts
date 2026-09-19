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

  /**
   * El listado resuelve el rótulo de cada especialidad en una lectura aparte
   * (`GET /terminology/concepts?ids=`), que ninguna de estas pruebas mira: se
   * responde vacía acá para que `verify()` siga denunciando lo que sí importa.
   * Sin rótulos, la pantalla muestra las tarjetas igual y el filtro de
   * especialidad queda deshabilitado con su motivo.
   */
  afterEach(() => {
    for (const pendiente of http.match((r) => r.url === '/terminology/concepts')) {
      pendiente.flush({ items: [], count: 0, limit: 0, nextCursor: null });
    }
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
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

  it('la vista previa se muestra sólo cuando se la pide', () => {
    // Antes estaba fija en una columna al lado del editor, que dejaba el
    // trabajo en media pantalla. Ahora es una cosa o la otra.
    abrirPlantilla();
    expect(interno<() => boolean>('enPrevia')()).toBe(false);

    interno<() => void>('alternarPrevia')();
    expect(interno<() => boolean>('enPrevia')()).toBe(true);

    interno<() => void>('alternarPrevia')();
    expect(interno<() => boolean>('enPrevia')()).toBe(false);
  });

  it('agregar un campo declara la definición y después la cuelga de la sección', () => {
    abrirPlantilla();

    interno<() => void>('agregarCampo')();

    // El campo nace vacío y se escribe encima, como en un editor: el nombre
    // provisional existe porque el backend no acepta uno en blanco.
    const definicion = http.expectOne('/forms/field-definitions');
    expect(definicion.request.body).toEqual(
      expect.objectContaining({ name: 'Pregunta sin título', dataType: 'string' }),
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

    harness.detectChanges();

    expect(interno<() => boolean>('admiteCamposPropios')()).toBe(false);
    expect(interno<() => boolean>('puedeCrear')()).toBe(false);
  });

  it('con el presupuesto agotado tampoco', () => {
    abrirPlantilla(PLANTILLA, { ...PRESUPUESTO, used: 12, remaining: 0 });

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

    harness.detectChanges();

    expect(interno<() => boolean>('puedeCrear')()).toBe(true);
  });

  /* -- Campos de elección (opción múltiple) --------------------------------- */

  /** Un campo propio de una sola respuesta, con sus opciones. */
  const ELECCION = {
    assignmentId: 'as-9',
    fieldId: 'f-9',
    code: 'ANAMNESIS.fuma',
    name: '¿Fuma?',
    dataType: 'code',
    required: false,
    ordinal: 9,
    own: true,
    options: ['Nunca', 'Ex fumador', 'Fumador'],
    multiple: false,
  };

  /** Los campos que la vista previa arma, ya aplanados. */
  function camposDeLaPrevia(): readonly Record<string, unknown>[] {
    const paginas = interno<
      () => readonly { campos: readonly Record<string, unknown>[] }[]
    >('paginas')();
    return paginas.flatMap((pagina) => pagina.campos);
  }

  it('un campo de elección se sirve como grupo de opciones, no como caja de texto', () => {
    // Es lo que separa «opción múltiple» de «texto corto» en la pantalla que
    // completa el paciente: si la vista previa lo pintara como una caja de
    // texto, el editor estaría prometiendo algo que el motor no hace.
    abrirPlantilla({ ...PLANTILLA, fields: [ELECCION] });

    const campo = camposDeLaPrevia()[0]!;

    expect(campo['control']).toBe('radio');
    expect(campo['options']).toEqual([
      { value: 'Nunca', label: 'Nunca' },
      { value: 'Ex fumador', label: 'Ex fumador' },
      { value: 'Fumador', label: 'Fumador' },
    ]);
  });

  it('con muchas opciones se despliega en vez de ocupar media página', () => {
    // Hasta cuatro se ven; la quinta ya empuja el resto de la página fuera de
    // la pantalla, y ahí el desplegable gana.
    abrirPlantilla({
      ...PLANTILLA,
      fields: [{ ...ELECCION, options: ['a', 'b', 'c', 'd', 'e'] }],
    });

    expect(camposDeLaPrevia()[0]!['control']).toBe('select');
  });

  it('el de varias respuestas se sirve con casillas, aunque tenga muchas', () => {
    // Un desplegable no deja marcar más de una: degradarlo a `select` por
    // cantidad convertiría la pregunta en otra.
    abrirPlantilla({
      ...PLANTILLA,
      fields: [{ ...ELECCION, multiple: true, options: ['a', 'b', 'c', 'd', 'e'] }],
    });

    expect(camposDeLaPrevia()[0]!['control']).toBe('checkboxes');
  });

  it('el control de casillas de la vista previa nace vacío y no en cadena', () => {
    // Con `''` el motor evalúa `''.includes(opcion)` al pintar y marcaría
    // opciones que nadie marcó.
    abrirPlantilla({ ...PLANTILLA, fields: [{ ...ELECCION, multiple: true }] });

    const grupo = interno<() => { get(k: string): { value: unknown } | null }>(
      'formularioDeMuestra',
    )();
    expect(grupo.get('f-9')?.value).toEqual([]);
  });

  /** Lo que el editor emite: el campo entero, con lo que cambió puesto. */
  function cambios(extra: Record<string, unknown> = {}) {
    return {
      name: '¿Fuma?',
      dataType: 'code',
      required: false,
      description: null,
      options: ['Nunca', 'Fumador'],
      multiple: false,
      allowOther: false,
      cardinalityMin: null,
      cardinalityMax: null,
      ...extra,
    };
  }

  function guardar(campo: unknown, extra: Record<string, unknown> = {}): void {
    interno<(c: unknown, cambios: unknown) => void>('guardarCampo')(campo, cambios(extra));
  }

  function campoPropio(): Record<string, unknown> {
    return interno<() => readonly Record<string, unknown>[]>('camposPropios')()[0]!;
  }

  it('cambiar las opciones de un campo propio guarda la lista entera', () => {
    // Enteras y no una suelta: el orden importa y un parche por índice se
    // rompe en cuanto alguien inserta una en el medio.
    abrirPlantilla({ ...PLANTILLA, fields: [ELECCION] });

    guardar(ELECCION);

    const definicion = http.expectOne(
      (r) => r.url === '/forms/field-definitions/f-9' && r.method === 'PATCH',
    );
    expect(definicion.request.body).toMatchObject({
      options: ['Nunca', 'Fumador'],
      multiple: false,
    });
    definicion.flush({ ok: true });

    // Y NO relee la plantilla: la pantalla ya aplicó el cambio. Releer era lo
    // que reseteaba el editor mientras se escribía. El `afterEach` verifica
    // que no quedó ninguna petición colgando.
    expect(campoPropio()['options']).toEqual(['Nunca', 'Fumador']);
  });

  it('el cambio se ve en la pantalla antes de que el servidor conteste', () => {
    // Es lo que hace que la vista previa y la cabecera respondan al teclear,
    // y lo que evita que una relectura pise lo que se está escribiendo.
    abrirPlantilla({ ...PLANTILLA, fields: [ELECCION] });

    guardar(ELECCION, { name: '¿Fumás?' });

    expect(campoPropio()['name']).toBe('¿Fumás?');
    http.expectOne((r) => r.method === 'PATCH').flush({ ok: true });
  });

  it('un cambio que llega mientras el anterior viaja espera y sale después, no se pierde', () => {
    // Antes se descartaba en silencio: elegir «Opción múltiple» y escribir la
    // primera opción antes de que volviera el guardado dejaba la opción sin
    // guardar y el editor reseteado.
    abrirPlantilla({ ...PLANTILLA, fields: [ELECCION] });

    guardar(ELECCION, { options: ['Nunca', 'Fu'] });
    guardar(ELECCION, { options: ['Nunca', 'Fum'] });
    guardar(ELECCION, { options: ['Nunca', 'Fumador'] });

    // Una sola en vuelo: la primera.
    const primera = http.expectOne((r) => r.method === 'PATCH');
    expect(primera.request.body).toMatchObject({ options: ['Nunca', 'Fu'] });
    primera.flush({ ok: true });

    // Al volver sale la ÚLTIMA, no la del medio: cada emisión trae el campo
    // entero y la última ya contiene a la anterior.
    const segunda = http.expectOne((r) => r.method === 'PATCH');
    expect(segunda.request.body).toMatchObject({ options: ['Nunca', 'Fumador'] });
    segunda.flush({ ok: true });

    expect(campoPropio()['options']).toEqual(['Nunca', 'Fumador']);
  });

  it('si el guardado falla se relee del servidor, porque la pantalla ya no sabe qué quedó', () => {
    abrirPlantilla({ ...PLANTILLA, fields: [ELECCION] });

    guardar(ELECCION, { name: 'Roto' });
    http
      .expectOne((r) => r.method === 'PATCH')
      .flush('nope', { status: 500, statusText: 'Server Error' });

    http.expectOne((r) => r.url === '/charts/templates/tpl-1').flush({
      ...PLANTILLA,
      fields: [ELECCION],
    });
    http.expectOne((r) => r.url.startsWith('/forms/assignments/budget')).flush(PRESUPUESTO);

    expect(campoPropio()['name']).toBe('¿Fuma?');
    expect(interno<() => string | null>('errorDelAlta')()).not.toBeNull();
  });

  it('duplicar declara una definición NUEVA con lo mismo y la cuelga debajo', () => {
    // Nueva y no la misma colgada dos veces: son dos preguntas que van a
    // divergir, y una definición compartida haría que corregir una corrigiera
    // la otra.
    const original = {
      ...ELECCION,
      required: true,
      allowOther: true,
      description: 'Desde el último',
    };
    abrirPlantilla({ ...PLANTILLA, fields: [original] });

    interno<(c: unknown) => void>('duplicarCampo')(original);

    const definicion = http.expectOne('/forms/field-definitions');
    expect(definicion.request.body).toEqual(
      expect.objectContaining({
        name: '¿Fuma? (copia)',
        dataType: 'code',
        options: ['Nunca', 'Ex fumador', 'Fumador'],
        multiple: false,
        allowOther: true,
        description: 'Desde el último',
      }),
    );
    expect(definicion.request.body.code).not.toBe(ELECCION.code);
    definicion.flush({ id: 'f-copia' });

    const asignacion = http.expectOne('/forms/assignments');
    expect(asignacion.request.body).toEqual(
      expect.objectContaining({ fieldId: 'f-copia', required: true }),
    );
    asignacion.flush({ id: 'as-copia' });

    http.expectOne((r) => r.url === '/charts/templates/tpl-1').flush(PLANTILLA);
    http.expectOne((r) => r.url.startsWith('/forms/assignments/budget')).flush(PRESUPUESTO);
  });

  /* -- Lo que la vista previa sirve de lo nuevo ------------------------------ */

  it('la descripción se sirve como la ayuda bajo el campo', () => {
    abrirPlantilla({
      ...PLANTILLA,
      fields: [{ ...ELECCION, description: 'Contá desde el último cigarrillo.' }],
    });

    expect(camposDeLaPrevia()[0]!['hint']).toBe('Contá desde el último cigarrillo.');
  });

  it('con «Otro» se sirve a la vista aunque tenga muchas opciones: un desplegable no tiene dónde escribir', () => {
    abrirPlantilla({
      ...PLANTILLA,
      fields: [{ ...ELECCION, allowOther: true, options: ['a', 'b', 'c', 'd', 'e'] }],
    });

    const campo = camposDeLaPrevia()[0]!;
    expect(campo['control']).toBe('radio');
    expect(campo['otro']).toBe(true);
  });

  it('los topes de un campo de varias validan en la vista previa', () => {
    // Marcar tres donde se pedían dos tiene que decirlo acá, no cuando el
    // paciente lo vea.
    abrirPlantilla({
      ...PLANTILLA,
      fields: [{ ...ELECCION, multiple: true, cardinalityMin: 2, cardinalityMax: 2 }],
    });

    const grupo = interno<
      () => { get(k: string): { setValue(v: unknown): void; errors: unknown } | null }
    >('formularioDeMuestra')();
    const control = grupo.get('f-9')!;

    control.setValue(['Nunca']);
    expect(control.errors).toEqual({ exactSelections: { required: 2, actual: 1 } });

    control.setValue(['Nunca', 'Fumador']);
    expect(control.errors).toBeNull();
  });

  /* -- El formulario estándar está bloqueado, y se dice por qué -------------- */

  it('muestra de dónde salió el formulario, que es lo que explica el bloqueo', () => {
    // No es una regla del producto: es que el documento es de un organismo y
    // se usa bajo una licencia. Muchos formularios clínicos estándar tienen
    // derechos de autor y eso tiene que estar en pantalla.
    abrirPlantilla({
      ...PLANTILLA,
      provenance: {
        sourceTitle: 'Guía de práctica clínica',
        organization: 'Ministerio de Salud',
        url: 'https://www.minsalud.gob.bo',
        license: 'CC BY 4.0',
        retrievedAt: '2026-01-15',
      },
    });

    const aviso = harness.routeNativeElement?.querySelector('[data-testid="aviso-estandar"]');
    expect(aviso?.textContent).toContain('formulario estándar internacional');
    expect(aviso?.textContent).toContain('Ministerio de Salud');
    expect(aviso?.textContent).toContain('CC BY 4.0');
  });

  it('el aviso de bloqueo va igual cuando la plantilla no declara procedencia', () => {
    // Las que arma un administrador a mano no la traen. El bloqueo sigue
    // siendo cierto: lo que falta es la mitad que lo explica, no el hecho.
    abrirPlantilla();

    const aviso = harness.routeNativeElement?.querySelector('[data-testid="aviso-estandar"]');
    expect(aviso?.textContent).toContain('No podés modificar esto');
    expect(interno<() => unknown>('procedencia')()).toBeNull();
  });

  it('los campos del estándar se siguen mostrando, no se esconden por bloqueados', () => {
    // Esconderlos dejaría al doctor sin saber qué pregunta ya está cubierta
    // antes de agregar la suya.
    abrirPlantilla();

    const tarjetas =
      harness.routeNativeElement?.querySelectorAll('[data-testid="campo-estandar"]') ?? [];
    expect(tarjetas.length).toBe(3);
  });

  /* -- Arrastrar para reordenar --------------------------------------------- */

  /** Un `DragEvent` con lo justo que el código toca. */
  function arrastre(): DragEvent {
    // `preventDefault` no hace nada acá a propósito: lo que declara la zona
    // como válida para soltar es el navegador, y en un test no hay ninguna.
    return {
      preventDefault: () => undefined,
      dataTransfer: null,
    } as unknown as DragEvent;
  }

  it('soltar una tarjeta sobre otra manda el orden entero, como las flechas', () => {
    const uno = { ...estandar(1), own: true, assignmentId: 'p1' };
    const dos = { ...estandar(2), own: true, assignmentId: 'p2' };
    abrirPlantilla({ ...PLANTILLA, fields: [uno, dos] });

    interno<(c: unknown, e: DragEvent) => void>('empezarArrastre')(dos, arrastre());
    interno<(c: unknown, e: DragEvent) => void>('soltar')(uno, arrastre());

    const orden = http.expectOne(
      (r) => r.url === '/forms/assignments/order' && r.method === 'PUT',
    );
    // El segundo pasa a primero: se manda la lista final, no «subí éste».
    expect(orden.request.body).toEqual({
      targetResourceConceptId: 'target-1',
      assignmentIds: ['p2', 'p1'],
    });
    orden.flush({ ok: true });

    http.expectOne((r) => r.url === '/charts/templates/tpl-1').flush(PLANTILLA);
    http.expectOne((r) => r.url.startsWith('/forms/assignments/budget')).flush(PRESUPUESTO);
  });

  it('soltar una tarjeta sobre sí misma no pide nada', () => {
    const uno = { ...estandar(1), own: true, assignmentId: 'p1' };
    abrirPlantilla({ ...PLANTILLA, fields: [uno] });

    interno<(c: unknown, e: DragEvent) => void>('empezarArrastre')(uno, arrastre());
    interno<(c: unknown, e: DragEvent) => void>('soltar')(uno, arrastre());

    // El `afterEach` verifica que no quedó ninguna petición sin atender.
    expect(interno<() => string | null>('arrastrando')()).toBeNull();
  });

  it('sólo es arrastrable la tarjeta cuyo agarre está apretado', () => {
    // Con toda la lista arrastrable, seleccionar el texto del nombre empezaba
    // un arrastre en vez de seleccionar.
    const uno = { ...estandar(1), own: true, assignmentId: 'p1' };
    abrirPlantilla({ ...PLANTILLA, fields: [uno] });

    expect(interno<() => string | null>('agarrado')()).toBeNull();
    interno<(c: unknown, apretado: boolean) => void>('agarrar')(uno, true);
    expect(interno<() => string | null>('agarrado')()).toBe('p1');
    interno<(c: unknown, apretado: boolean) => void>('agarrar')(uno, false);
    expect(interno<() => string | null>('agarrado')()).toBeNull();
  });
  /* ---- buscador y filtros del catálogo ------------------------------------ */

  describe('buscador y filtros del catálogo', () => {
    const OTRA: ChartTemplate = {
      ...PLANTILLA,
      id: 'tpl-2',
      specialtyConceptId: 'sp-2',
      code: 'CARDIO_FICHA_BASE',
      name: 'Ficha cardiológica',
      fields: [estandar(4)],
    };

    /** Navega publicando los filtros en la URL, que es como los publica la barra. */
    async function irA(filtros: Record<string, string>): Promise<void> {
      const query = new URLSearchParams(filtros).toString();
      componente = await harness.navigateByUrl(
        query === '' ? RUTA : `${RUTA}?${query}`,
        FormBuilder,
      );
      await harness.fixture.whenStable();
    }

    function listarDos(): void {
      http
        .expectOne((r) => r.url === '/charts/templates' && r.method === 'GET')
        .flush([PLANTILLA, OTRA]);
      harness.detectChanges();
    }

    /** Los rótulos de especialidad llegan en una lectura aparte. */
    function responderEspecialidades(): void {
      http.expectOne((r) => r.url === '/terminology/concepts').flush({
        items: [
          { conceptId: 'sp-1', code: 'GEN', display: 'Medicina general', codeSystemVersionId: 'v1' },
          { conceptId: 'sp-2', code: 'CARD', display: 'Cardiología', codeSystemVersionId: 'v1' },
        ],
        count: 2,
        limit: 200,
        nextCursor: null,
      });
      harness.detectChanges();
    }

    function filtrados(): readonly ChartTemplate[] | null {
      return interno<() => readonly ChartTemplate[] | null>('filtrados')();
    }

    it('el catálogo se resuelve sin pedir nada más al escribir: filtra lo ya leído', async () => {
      listarDos();
      responderEspecialidades();

      await irA({ q: 'cardio' });

      expect(filtrados()?.map((p) => p.code)).toEqual(['CARDIO_FICHA_BASE']);
      // `http.verify()` del afterEach falla si escribir hubiera pedido una
      // lista nueva: `GET /charts/templates` no pagina y ya vino entera.
    });

    it('la búsqueda ignora tildes y encuentra por especialidad y por organismo', async () => {
      listarDos();
      responderEspecialidades();

      await irA({ q: 'cardiologia' });

      expect(filtrados()?.map((p) => p.id)).toEqual(['tpl-2']);
    });

    it('el filtro de especialidad sólo ofrece las que tienen formulario', async () => {
      listarDos();
      responderEspecialidades();

      const filtros = interno<() => readonly { key: string; options: readonly unknown[] }[]>(
        'filtros',
      )();
      const especialidad = filtros.find((f) => f.key === 'especialidad');
      expect(especialidad?.options).toEqual([
        { value: 'sp-2', label: 'Cardiología' },
        { value: 'sp-1', label: 'Medicina general' },
      ]);
    });

    it('sin rótulos de especialidad el listado sigue en pie, con el filtro sin opciones', () => {
      listarDos();
      http
        .expectOne((r) => r.url === '/terminology/concepts')
        .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });
      harness.detectChanges();

      // Lo que importa: las tarjetas siguen ahí. Perder el rótulo no puede
      // dejar a nadie sin catálogo.
      expect(filtrados()?.length).toBe(2);
      const filtros = interno<() => readonly { key: string; options: readonly unknown[] }[]>(
        'filtros',
      )();
      expect(filtros.find((f) => f.key === 'especialidad')?.options).toEqual([]);
    });

    it('lo vacío del filtro no es lo vacío del catálogo', async () => {
      listarDos();
      responderEspecialidades();

      await irA({ q: 'no-existe-nada-asi' });

      expect(filtrados()).toEqual([]);
      expect(interno<() => boolean>('hayCriterios')()).toBe(true);
      const html = harness.routeNativeElement?.textContent ?? '';
      expect(html).toContain('Ningún formulario coincide');
      expect(html).not.toContain('Todavía no hay formularios');
    });
  });
});
