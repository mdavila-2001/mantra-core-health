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
      expect.objectContaining({ name: 'Campo nuevo', dataType: 'string' }),
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

  it('cambiar las opciones de un campo propio guarda la lista entera', () => {
    // Enteras y no una suelta: el orden importa y un parche por índice se
    // rompe en cuanto alguien inserta una en el medio.
    abrirPlantilla({ ...PLANTILLA, fields: [ELECCION] });

    interno<(c: unknown, cambios: unknown) => void>('guardarCampo')(ELECCION, {
      name: '¿Fuma?',
      dataType: 'code',
      required: false,
      options: ['Nunca', 'Fumador'],
      multiple: false,
    });

    const definicion = http.expectOne(
      (r) => r.url === '/forms/field-definitions/f-9' && r.method === 'PATCH',
    );
    expect(definicion.request.body).toMatchObject({
      options: ['Nunca', 'Fumador'],
      multiple: false,
    });
    definicion.flush({ ok: true });

    // Y relee la plantilla, que es de donde la pantalla dibuja.
    http.expectOne((r) => r.url === '/charts/templates/tpl-1').flush(PLANTILLA);
    http.expectOne((r) => r.url.startsWith('/forms/assignments/budget')).flush(PRESUPUESTO);
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
});
