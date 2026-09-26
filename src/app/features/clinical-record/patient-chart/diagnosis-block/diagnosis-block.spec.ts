import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import { CASOS_DIAGNOSTICO_DEMO } from '../demo-presets';
import {
  DiagnosisBlock,
  TARGET_CATEGORIA,
  TARGET_CURSO_CLINICO,
  TARGET_DIAGNOSTICO,
  TARGET_LATERALIDAD,
  TARGET_SEVERIDAD,
} from './diagnosis-block';

/**
 * Registrar el diagnóstico desde la ficha — V08-08. Lo que estas pruebas fijan:
 *
 * 1. **El binding manda.** Sin catálogo declarado para
 *    `clinical.conditions.code_concept_id` no se ofrece el formulario y se dice
 *    por qué. El selector no cae a texto libre.
 * 2. **Lo opcional sin elegir se omite.** El backend valida con
 *    `forbidNonWhitelisted`, y una clave en null no es «sin especificar».
 * 3. **El 409 del duplicado es un aviso, no un error rojo.** La historia se
 *    niega a decir dos veces lo mismo, y el registro que ya existe está en la
 *    pestaña de abajo.
 * 4. **Después de escribir se relee.** El bloque avisa; no pinta lo que el
 *    servidor no le confirmó.
 */

const CATALOGO = {
  code: 'condition-code',
  name: 'Diagnóstico',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  allowCustomValue: false,
  options: [{ conceptId: 'dx-hta', code: 'I10', display: 'Hipertensión esencial', ordinal: 1 }],
};

/** Categoría, severidad y lateralidad: los tres catálogos opcionales. */
const CATALOGO_OPCIONAL = {
  ...CATALOGO,
  code: 'condition-severity',
  options: [{ conceptId: 'sev-leve', code: 'COND_SEV_MILD', display: 'Mild', ordinal: 1 }],
};

/**
 * El catálogo del **curso clínico**, con los códigos del backend.
 *
 * Los códigos importan: la pantalla busca el crónico por `COND_COURSE_CHRONIC`
 * —no por posición— porque el orden de una expansión no es contrato.
 */
const CATALOGO_DE_CURSO = {
  ...CATALOGO,
  code: 'condition-clinical-course',
  options: [
    { conceptId: 'curso-agudo', code: 'COND_COURSE_ACUTE', display: 'Acute', ordinal: 1 },
    { conceptId: 'curso-cronico', code: 'COND_COURSE_CHRONIC', display: 'Chronic', ordinal: 2 },
    { conceptId: 'curso-subagudo', code: 'COND_COURSE_SUBACUTE', display: 'Subacute', ordinal: 3 },
  ],
};

/** Una condición tal como vuelve del alta. */
const RESPUESTA = {
  id: 'c-1',
  patientProfileId: 'p-1',
  clinicalStatus: 'st-activa',
  verificationStatus: 'st-confirmada',
  clinicalCourse: null,
  createdAt: '2026-08-13T12:00:00.000Z',
};

/** El resumen clínico sin diagnósticos: lo que la tabla de C3 lee por omisión. */
const RESUMEN_VACIO = {
  patientProfileId: 'p-1',
  conditions: [],
  allergies: [],
  medicationRequests: [],
  observations: [],
  encounters: [],
  careEpisodes: [],
  limit: 50,
  truncated: [],
};

/** base64url **sobre UTF-8**, como el token real. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('DiagnosisBlock', () => {
  let fixture: ComponentFixture<DiagnosisBlock>;
  let componente: DiagnosisBlock;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });

    fixture = TestBed.createComponent(DiagnosisBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.componentRef.setInput('encounterId', 'enc-1');
  });

  /**
   * Categoría, severidad y lateralidad se piden cuando el formulario se pinta.
   * Se drenan acá para que `verify()` no tropiece con ellas: lo que gobierna si
   * el alta se ofrece es el catálogo del diagnóstico, y eso lo cubren las
   * pruebas de arriba.
   */
  afterEach(() => {
    // La tabla de presuntivos (C3) lee el resumen al pintarse; estas pruebas
    // son del alta y la responden vacía para que `verify()` no tropiece.
    for (const resumen of http.match((r) => r.url === '/clinical/patients/p-1/summary')) {
      resumen.flush(RESUMEN_VACIO);
    }
    for (const opcional of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      opcional.flush(
        opcional.request.params.get('target')?.includes('clinical_course') === true
          ? CATALOGO_DE_CURSO
          : CATALOGO_OPCIONAL,
      );
    }
    http.verify();
  });

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
   * Responde el catálogo del diagnóstico: con binding, o con el 404 de su
   * ausencia. Los opcionales se responden después y siempre con opciones: no
   * gobiernan si el formulario se ofrece.
   */
  function responderCatalogo(hayBinding = true): void {
    fixture.detectChanges();
    const req = http.expectOne((r) => r.params.get('target') === TARGET_DIAGNOSTICO);
    if (hayBinding) {
      req.flush(CATALOGO);
      fixture.detectChanges();
      for (const opcional of http.match((r) => r.url === '/system-context/dynamic-enums')) {
        opcional.flush(
          opcional.request.params.get('target')?.includes('clinical_course') === true
            ? CATALOGO_DE_CURSO
            : CATALOGO_OPCIONAL,
        );
      }
      return;
    }
    req.flush(
      { code: 'NOT_FOUND', message: 'Enumeración no encontrada', timestamp: '', path: '' },
      { status: 404, statusText: 'Not Found' },
    );
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  /* ---- paso 0: el binding del selector ----------------------------------- */

  it('sin binding declarado no ofrece el formulario y explica por qué', () => {
    responderCatalogo(false);
    fixture.detectChanges();

    expect(interno<() => boolean | null>('catalogoListo')()).toBe(false);
    expect(texto()).toContain('El catálogo de diagnósticos no está publicado');
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
  });

  it('con binding declarado ofrece el formulario', () => {
    responderCatalogo();
    fixture.detectChanges();

    expect(interno<() => boolean | null>('catalogoListo')()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).not.toBeNull();
  });

  it('sin encuentro abierto no registra: el diagnóstico vive dentro de la consulta', () => {
    fixture.componentRef.setInput('encounterId', null);
    responderCatalogo();
    fixture.detectChanges();

    expect(texto()).toContain('Abrí el encuentro para registrar');
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);
  });

  /* ---- registrar ---------------------------------------------------------- */

  it('no envía sin diagnóstico elegido: es obligatorio en el DTO', () => {
    responderCatalogo();

    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);

    señal<string>('diagnostico').set('dx-hta');
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(true);
  });

  it('manda los tres obligatorios y el encuentro, y omite lo que no se eligió', () => {
    responderCatalogo();

    señal<string>('diagnostico').set('dx-hta');
    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/conditions');
    expect(req.request.method).toBe('POST');
    expect(Object.keys(req.request.body as object).sort()).toEqual([
      'codeConceptId',
      'custodianTenantId',
      'encounterId',
      'patientProfileId',
    ]);
    expect((req.request.body as Record<string, unknown>)['custodianTenantId']).toBe('t-1');

    req.flush(RESPUESTA);
  });

  it('manda categoría, severidad y lateralidad como conceptos cuando se eligieron', () => {
    responderCatalogo();

    señal<string>('diagnostico').set('dx-hta');
    señal<string>('categoria').set('cat-dx');
    señal<string>('severidad').set('sev-leve');
    señal<string>('lateralidad').set('lat-izq');
    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/conditions');
    const body = req.request.body as Record<string, unknown>;
    expect(body['categoryConceptId']).toBe('cat-dx');
    expect(body['severityConceptId']).toBe('sev-leve');
    expect(body['lateralityConceptId']).toBe('lat-izq');

    req.flush(RESPUESTA);
  });

  it('el inicio viaja como instante ISO, no como Date serializado a ojo', () => {
    responderCatalogo();

    señal<string>('diagnostico').set('dx-hta');
    señal<Date>('inicio').set(new Date('2026-07-01T00:00:00.000Z'));
    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/conditions');
    expect((req.request.body as Record<string, unknown>)['onsetAt']).toBe(
      '2026-07-01T00:00:00.000Z',
    );

    req.flush(RESPUESTA);
  });

  it('manda el curso clínico y la fecha esperada de resolución cuando se eligieron', () => {
    responderCatalogo();

    señal<string>('diagnostico').set('dx-hta');
    señal<string>('cursoClinico').set('curso-agudo');
    señal<Date>('fechaEsperada').set(new Date('2026-08-01T00:00:00.000Z'));
    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/conditions');
    const body = req.request.body as Record<string, unknown>;
    expect(body['clinicalCourseConceptId']).toBe('curso-agudo');
    expect(body['expectedResolutionAt']).toBe('2026-08-01T00:00:00.000Z');

    req.flush(RESPUESTA);
  });

  it('tras registrar avisa para releer y limpia el formulario', () => {
    responderCatalogo();

    let releido = 0;
    componente.cambio.subscribe(() => (releido += 1));

    señal<string>('diagnostico').set('dx-hta');
    señal<string>('severidad').set('sev-leve');
    interno<() => void>('registrar')();
    http.expectOne('/clinical/conditions').flush(RESPUESTA);

    expect(releido).toBe(1);
    expect(interno<() => string | null>('diagnostico')()).toBeNull();
    expect(interno<() => string | null>('severidad')()).toBeNull();
    expect(interno<() => string>('notasClinicas')()).toBe('');
  });

  /* ---- adjuntar un archivo (ALV-033) --------------------------------------- */

  describe('el panel de adjuntos tras registrar', () => {
    it('aparece con el id de la condición recién creada', () => {
      responderCatalogo();
      señal<string>('diagnostico').set('dx-hta');
      interno<() => void>('registrar')();
      http.expectOne('/clinical/conditions').flush(RESPUESTA);
      fixture.detectChanges();

      expect(interno<() => string | null>('diagnosticoRecienRegistrado')()).toBe('c-1');
      const html = fixture.nativeElement as HTMLElement;
      // El subidor pasó a vivir dentro de `app-attachment-dialog`, así que lo
      // que se comprueba es que el modal esté montado con esa condición: el
      // `ownerType` viaja como entrada de señal y no como atributo del DOM.
      const modal = html.querySelector('app-attachment-dialog');
      expect(modal).not.toBeNull();
      expect(modal?.querySelector('app-attachment-uploader')).not.toBeNull();
    });

    it('«Listo, sin adjuntar» lo cierra sin subir nada', () => {
      responderCatalogo();
      señal<string>('diagnostico').set('dx-hta');
      interno<() => void>('registrar')();
      http.expectOne('/clinical/conditions').flush(RESPUESTA);
      fixture.detectChanges();

      interno<() => void>('cerrarAdjuntos')();
      fixture.detectChanges();

      expect(interno<() => string | null>('diagnosticoRecienRegistrado')()).toBeNull();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('app-attachment-uploader'),
      ).toBeNull();
    });

    it('el vínculo del adjunto pasa por `clinical`, no por el genérico de `common`', () => {
      responderCatalogo();
      señal<string>('diagnostico').set('dx-hta');
      interno<() => void>('registrar')();
      http.expectOne('/clinical/conditions').flush(RESPUESTA);
      fixture.detectChanges();

      const enlazar = interno<
        (fileId: string, conditionId: string) => { subscribe: (o: unknown) => void }
      >('enlazarAdjuntoAlDiagnostico');
      enlazar('file-1', 'c-1').subscribe({ next: () => undefined });

      http
        .expectOne('/clinical/conditions/c-1/attachments')
        .flush({ id: 'link-1', fileId: 'file-1', ownerId: 'c-1', createdAt: '2026-01-01' });
    });
  });

  it('las notas clínicas viajan como noteText, recortadas', () => {
    responderCatalogo();

    señal<string>('diagnostico').set('dx-hta');
    señal<string>('notasClinicas').set('  Faringe eritematosa sin exudado.  ');
    interno<() => void>('registrar')();

    const req = http.expectOne('/clinical/conditions');
    expect((req.request.body as Record<string, unknown>)['noteText']).toBe(
      'Faringe eritematosa sin exudado.',
    );

    req.flush(RESPUESTA);
  });

  /* ---- los casos de demostración ------------------------------------------ */

  /**
   * Lo que estas dos fijan: un caso NO escribe códigos en señales que viajan
   * como conceptId —eso fue el 400 de la primera versión—, sino que resuelve
   * cada código contra su catálogo; y lo que el catálogo no tiene queda sin
   * elegir, jamás «la primera opción de la lista».
   */
  it('un caso de demostración resuelve cada código a su conceptId del catálogo', () => {
    fixture.detectChanges();
    const responder = (target: string, conceptId: string, code: string): void => {
      http
        .expectOne((r) => r.params.get('target') === target)
        .flush({ ...CATALOGO, options: [{ conceptId, code, display: code, ordinal: 1 }] });
    };
    responder(TARGET_DIAGNOSTICO, 'dx-hta', 'I10');
    responder(TARGET_CATEGORIA, 'cat-dx', 'COND_DIAGNOSIS');
    responder(TARGET_SEVERIDAD, 'sev-mod', 'COND_SEV_MODERATE');
    responder(TARGET_LATERALIDAD, 'lat-izq', 'COND_LAT_LEFT');
    responder(TARGET_CURSO_CLINICO, 'curso-cronico', 'COND_COURSE_CHRONIC');

    // Hipertensión: I10, crónica, moderada, sin lateralidad ni resolución.
    componente.aplicarCasoDemo(CASOS_DIAGNOSTICO_DEMO[1]);

    expect(interno<() => string | null>('diagnostico')()).toBe('dx-hta');
    expect(interno<() => string | null>('categoria')()).toBe('cat-dx');
    expect(interno<() => string | null>('severidad')()).toBe('sev-mod');
    expect(interno<() => string | null>('cursoClinico')()).toBe('curso-cronico');
    expect(interno<() => string | null>('lateralidad')()).toBeNull();
    expect(interno<() => Date | null>('inicio')()).not.toBeNull();
    expect(interno<() => Date | null>('fechaEsperada')()).toBeNull();
    expect(interno<() => string>('notasClinicas')()).toBe(CASOS_DIAGNOSTICO_DEMO[1].notas);
  });

  it('lo que el catálogo no tiene queda sin elegir: jamás la primera opción', () => {
    // El catálogo sólo trae I10 y COND_SEV_MILD; Diabetes (E11.9, moderada)
    // no resuelve nada.
    responderCatalogo();

    componente.aplicarCasoDemo(CASOS_DIAGNOSTICO_DEMO[2]);

    expect(interno<() => string | null>('diagnostico')()).toBeNull();
    expect(interno<() => string | null>('severidad')()).toBeNull();
    // El curso sí resuelve, y no es una excepción a la regla: el catálogo de
    // curso de esta prueba **tiene** `COND_COURSE_CHRONIC`. Lo que la regla
    // prohíbe es caer en la primera opción cuando el valor no está, y eso
    // siguen midiéndolo el diagnóstico y la severidad, que no están.
    expect(interno<() => string | null>('cursoClinico')()).toBe('curso-cronico');
  });

  /* ---- el 409 del duplicado ------------------------------------------------ */

  /**
   * El camino que hay que contar bien: la persona ya tiene esa condición
   * activa y el backend responde `409 CONFLICT`. Es la historia protegiéndose,
   * no un fallo — se cuenta en ámbar, con la salida señalada.
   */
  it('el duplicado activo se cuenta como aviso, no como error', () => {
    responderCatalogo();

    señal<string>('diagnostico').set('dx-hta');
    interno<() => void>('registrar')();

    http.expectOne('/clinical/conditions').flush(
      {
        code: 'CONFLICT',
        message: 'El paciente ya tiene esa condición activa',
        timestamp: '',
        path: '',
      },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(interno<() => string | null>('avisoDeDuplicado')()).toContain(
      'ya tiene ese diagnóstico activo',
    );
    // Y no se pinta además en rojo: sería decir dos veces lo mismo con dos
    // tonos que se contradicen.
    expect(interno<() => string | null>('errorDelDiagnostico')()).toBeNull();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="diagnostico-duplicado"]')).not.toBeNull();
    expect(html.querySelector('[data-testid="diagnostico-error"]')).toBeNull();
  });

  it('un error de verdad sí se pinta como error', () => {
    responderCatalogo();

    señal<string>('diagnostico').set('dx-hta');
    interno<() => void>('registrar')();

    http
      .expectOne('/clinical/conditions')
      .flush(
        { code: 'INTERNAL', message: 'Error interno del servidor', timestamp: '', path: '' },
        { status: 500, statusText: 'Internal Server Error' },
      );
    fixture.detectChanges();

    expect(interno<() => string | null>('avisoDeDuplicado')()).toBeNull();
    expect(interno<() => string | null>('errorDelDiagnostico')()).toContain(
      'Error interno del servidor',
    );
  });
  /* -- La duración estimada y el crónico (pedido del cliente) -------------- */

  describe('la duración estimada', () => {
    /**
     * «Debería poderse poner una duración promedio del diagnóstico, y en caso
     * de ser crónico debería aparecer la opción.» Elegir días deriva la fecha y
     * sugiere el curso; nadie calcula a mano.
     */
    it('elegir días fija la fecha esperada y sugiere curso agudo', () => {
      responderCatalogo();

      señal<Date | null>('inicio').set(new Date(2026, 8, 1));
      interno<(dias: number | null) => void>('fijarDuracion')(14);

      const esperada = señal<Date | null>('fechaEsperada')();
      expect(esperada?.getDate()).toBe(15);
      expect(esperada?.getMonth()).toBe(8);
      expect(señal<string | null>('cursoClinico')()).toBe('curso-agudo');
      expect(interno<() => boolean>('cursoEsCronico')()).toBe(false);
    });

    /** Más de un mes deja de ser agudo: el corte clínico corriente. */
    it('más de 30 días sugiere subagudo, no agudo', () => {
      responderCatalogo();

      interno<(dias: number | null) => void>('fijarDuracion')(90);

      expect(señal<string | null>('cursoClinico')()).toBe('curso-subagudo');
    });

    /**
     * Una condición de seguimiento continuo **no resuelve**: dejar el campo de
     * fecha esperada invita a inventar una.
     */
    it('elegir crónico pone el curso crónico y borra la fecha esperada', () => {
      responderCatalogo();

      interno<(dias: number | null) => void>('fijarDuracion')(14);
      expect(señal<Date | null>('fechaEsperada')()).not.toBeNull();

      interno<(dias: number | null) => void>('fijarDuracion')(null);

      expect(señal<string | null>('cursoClinico')()).toBe('curso-cronico');
      expect(señal<Date | null>('fechaEsperada')()).toBeNull();
      expect(interno<() => boolean>('cursoEsCronico')()).toBe(true);
    });

    /**
     * Quien registra sabe más que la heurística. Elegido el curso a mano, la
     * duración deja de pisarlo.
     */
    it('el curso elegido a mano gana sobre la sugerencia de la duración', () => {
      responderCatalogo();

      interno<(id: string | null) => void>('elegirCurso')('curso-cronico');
      interno<(dias: number | null) => void>('fijarDuracion')(7);

      expect(señal<string | null>('cursoClinico')()).toBe('curso-cronico');
    });

    /**
     * El chip de crónico no puede aparecer marcado con el formulario recién
     * abierto: es el defecto que la receta ya había corregido comparando
     * `null === null`.
     */
    it('con el formulario recién abierto no hay ninguna duración elegida', () => {
      responderCatalogo();

      expect(interno<() => boolean>('esCronico')()).toBe(false);
      expect(señal<number | null>('duracionDias')()).toBeNull();
    });

    /** Lo elegido viaja: el contrato declara los dos campos desde v4.0.8. */
    it('el curso y la fecha esperada viajan en el alta', () => {
      responderCatalogo();
      señal<string | null>('diagnostico').set('dx-1');
      señal<Date | null>('inicio').set(new Date(2026, 8, 1));
      interno<(dias: number | null) => void>('fijarDuracion')(7);

      interno<() => void>('registrar')();

      const req = http.expectOne('/clinical/conditions');
      expect(req.request.body.clinicalCourseConceptId).toBe('curso-agudo');
      expect(req.request.body.expectedResolutionAt).toContain('2026-09-08');
      req.flush(RESPUESTA);
    });
  });
  /* -- La cita en la que se detectó (pedido del cliente) ------------------- */

  describe('el selector de cita', () => {
    /** «Un campo select para colocar la enfermedad detectada en base a una cita
     * ya existente y/o finalizada» — textual del cliente. */
    it('sin citas que ofrecer, el campo no se dibuja', () => {
      responderCatalogo();

      expect(fixture.nativeElement.querySelector('[data-testid="diagnostico-cita"]')).toBeNull();
    });

    it('con citas, las ofrece y marca cuál sigue en curso', () => {
      fixture.componentRef.setInput('citas', [
        { id: 'enc-9', etiqueta: '7 sept 2026, 09:00 · Control', enCurso: false },
        { id: 'enc-1', etiqueta: '10 sept 2026, 08:00 · Chequeo', enCurso: true },
      ]);
      responderCatalogo();

      const opciones =
        interno<() => readonly { value: string | null; label: string }[]>('opcionesDeCita')();
      expect(opciones[0]).toEqual({ value: null, label: 'Sin cita asociada' });
      expect(opciones[1]?.label).toBe('7 sept 2026, 09:00 · Control');
      expect(opciones[2]?.label).toContain('en curso');
    });

    /** La cita elegida gana sobre el encuentro que pasó el anfitrión. */
    it('la cita elegida es la que viaja, no el encuentro en curso', () => {
      fixture.componentRef.setInput('citas', [
        { id: 'enc-9', etiqueta: '7 sept 2026, 09:00 · Control', enCurso: false },
      ]);
      responderCatalogo();
      señal<string | null>('diagnostico').set('dx-1');
      señal<string | null>('citaElegida').set('enc-9');

      interno<() => void>('registrar')();

      const req = http.expectOne('/clinical/conditions');
      expect(req.request.body.encounterId).toBe('enc-9');
      req.flush(RESPUESTA);
    });
  });

  /* -- El bloque fuera de «Atención» --------------------------------------- */

  describe('sin exigir encuentro (expediente)', () => {
    /**
     * En el expediente el diagnóstico se ata a una cita **elegida**, o a
     * ninguna: el contrato declara `encounterId` opcional, y una condición que
     * la persona ya traía no nace de ninguna consulta.
     */
    it('deja registrar sin encuentro, y la clave no viaja', () => {
      fixture.componentRef.setInput('encounterId', null);
      fixture.componentRef.setInput('exigeEncuentro', false);
      responderCatalogo();
      señal<string | null>('diagnostico').set('dx-1');

      expect(interno<() => boolean>('puedeRegistrar')()).toBe(true);

      interno<() => void>('registrar')();

      const req = http.expectOne('/clinical/conditions');
      expect('encounterId' in req.request.body).toBe(false);
      req.flush(RESPUESTA);
    });

    /** En «Atención» el encuentro sigue siendo el contexto y sigue exigiéndose. */
    it('con `exigeEncuentro`, sin encuentro no deja registrar', () => {
      fixture.componentRef.setInput('encounterId', null);
      responderCatalogo();
      señal<string | null>('diagnostico').set('dx-1');

      expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);
    });
  });

  describe('tieneCambiosPendientes — contrato de DraftBlock', () => {
    it('recién montado no tiene cambios pendientes', () => {
      responderCatalogo();
      expect(componente.tieneCambiosPendientes()).toBe(false);
    });

    it('con el diagnóstico elegido tiene cambios pendientes', () => {
      responderCatalogo();
      señal<string | null>('diagnostico').set('dx-1');
      expect(componente.tieneCambiosPendientes()).toBe(true);
    });

    it('con sólo notas clínicas escritas también cuenta', () => {
      responderCatalogo();
      señal<string>('notasClinicas').set('Paciente refiere mejoría parcial.');
      expect(componente.tieneCambiosPendientes()).toBe(true);
    });
  });
});

/**
 * La tabla de presuntivos (C3, 2026-09-26). Aparte del alta a propósito: el
 * `describe` de arriba fija el formulario y responde el resumen vacío; acá el
 * resumen trae diagnósticos y lo que se fija es cómo se leen y se deciden.
 */
describe('DiagnosisBlock · la tabla de presuntivos (C3)', () => {
  const RESUMEN = {
    ...RESUMEN_VACIO,
    conditions: [
      {
        id: 'c-1',
        codeConceptId: 'dx-hta',
        clinicalStatusConceptId: 'st-activa',
        verificationStatusConceptId: 'st-provisional',
        onsetAt: '2026-09-01T00:00:00.000Z',
        createdAt: '2026-09-20T10:00:00.000Z',
      },
      {
        id: 'c-2',
        codeConceptId: 'dx-hta',
        clinicalStatusConceptId: 'st-activa',
        verificationStatusConceptId: 'st-confirmada',
        createdAt: '2026-09-10T10:00:00.000Z',
        verification: {
          outcome: 'CONFIRMED',
          decidedAt: '2026-09-12T10:00:00.000Z',
          decidedByProfileId: 'pr-1',
          reasonText: 'Por el informe',
          basedOn: { kind: 'ANALYSIS', serviceRequestId: 'o-1' },
        },
      },
    ],
  };

  /** Los códigos que `diagnosisStateOf` necesita, con sus etiquetas. */
  const ETIQUETAS = {
    items: [
      {
        conceptId: 'dx-hta',
        code: 'I10',
        display: 'Hipertensión esencial',
        codeSystemVersionId: 'v',
      },
      { conceptId: 'st-activa', code: 'COND-ACTIVE', display: 'Activa', codeSystemVersionId: 'v' },
      {
        conceptId: 'st-provisional',
        code: 'DXV-PROVISIONAL',
        display: 'Provisional',
        codeSystemVersionId: 'v',
      },
      {
        conceptId: 'st-confirmada',
        code: 'DXV-CONFIRMED',
        display: 'Confirmado',
        codeSystemVersionId: 'v',
      },
    ],
    count: 4,
    limit: 200,
  };

  let fixture: ComponentFixture<DiagnosisBlock>;
  let componente: DiagnosisBlock;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
    fixture = TestBed.createComponent(DiagnosisBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.componentRef.setInput('encounterId', 'enc-1');
  });

  afterEach(() => {
    for (const opcional of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      opcional.flush(
        opcional.request.params.get('target')?.includes('clinical_course') === true
          ? CATALOGO_DE_CURSO
          : CATALOGO_OPCIONAL,
      );
    }
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function elemento(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function porTestId(id: string): HTMLElement | null {
    return elemento().querySelector(`[data-testid="${id}"]`);
  }

  /** Pinta el bloque: catálogo del alta, resumen y etiquetas de la tabla. */
  function cargar(resumen: unknown = RESUMEN): void {
    fixture.detectChanges();
    http.expectOne((r) => r.params.get('target') === TARGET_DIAGNOSTICO).flush(CATALOGO);
    http.expectOne((r) => r.url === '/clinical/patients/p-1/summary').flush(resumen as object);
    fixture.detectChanges();
    for (const etiquetas of http.match((r) => r.url === '/terminology/concepts')) {
      etiquetas.flush(ETIQUETAS);
    }
    fixture.detectChanges();
  }

  it('lista los diagnósticos con su estado, y sólo el presuntivo se puede confirmar o rechazar', () => {
    cargar();

    expect(porTestId('diagnostico-tabla')).not.toBeNull();
    expect(porTestId('diagnostico-fila-c-1')?.textContent).toContain('Hipertensión esencial');
    expect(elemento().textContent).toContain('En estudio');
    expect(elemento().textContent).toContain('Enfermedad activa');
    // La evidencia de la decisión ya tomada, en dos palabras.
    expect(elemento().textContent).toContain('Orden · Por el informe');
    expect(porTestId('diagnostico-confirmar-c-1')).not.toBeNull();
    expect(porTestId('diagnostico-rechazar-c-1')).not.toBeNull();
    expect(porTestId('diagnostico-confirmar-c-2')).toBeNull();
    expect(porTestId('diagnostico-rechazar-c-2')).toBeNull();
  });

  it('sin diagnósticos lo dice, y el alta sigue disponible', () => {
    cargar(RESUMEN_VACIO);

    expect(elemento().textContent).toContain('todavía no tiene diagnósticos registrados');
    expect(elemento().querySelector('form')).not.toBeNull();
  });

  it('si la lectura del resumen falla, la tabla lo cuenta y el alta sigue disponible', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.params.get('target') === TARGET_DIAGNOSTICO).flush(CATALOGO);
    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush(
        {
          statusCode: 500,
          code: 'INTERNAL',
          message: 'Se rompió',
          error: 'Error',
          requestId: 'req-9',
        },
        { status: 500, statusText: 'Internal Server Error' },
      );
    fixture.detectChanges();

    expect(interno<() => { status: string }>('filas')().status).not.toBe('ready');
    expect(interno<() => { status: string }>('filas')().status).not.toBe('loading');
    expect(elemento().querySelector('form')).not.toBeNull();
  });

  it('confirmar abre el diálogo y, decidido, relee la lista y avisa al expediente', () => {
    cargar();
    let avisos = 0;
    componente.cambio.subscribe(() => (avisos += 1));

    porTestId('diagnostico-confirmar-c-1')!.click();
    fixture.detectChanges();

    expect(elemento().querySelector('app-diagnosis-verify-dialog')).not.toBeNull();
    // El diálogo lee el circuito y las notas de la persona; acá se responden vacíos.
    for (const lectura of http.match((r) => r.url === '/diagnostics/patients/p-1/orders')) {
      lectura.flush({ patientProfileId: 'p-1', orders: [], reports: [], limit: 50, truncated: [] });
    }
    for (const lectura of http.match((r) => r.url === '/charts/notes')) {
      lectura.flush({ items: [], count: 0, limit: 50, nextCursor: null });
    }
    fixture.detectChanges();

    const decidida = {
      ...RESUMEN.conditions[0]!,
      verificationStatusConceptId: 'st-confirmada',
      onsetAt: new Date('2026-09-01T00:00:00.000Z'),
      createdAt: new Date('2026-09-20T10:00:00.000Z'),
      verification: {
        outcome: 'CONFIRMED' as const,
        decidedAt: '2026-09-26T10:00:00.000Z',
        decidedByProfileId: 'pr-1',
        reasonText: 'Cuadro compatible',
        basedOn: null,
      },
    };
    interno<(c: unknown) => void>('alVerificar')(decidida);
    fixture.detectChanges();

    expect(elemento().querySelector('app-diagnosis-verify-dialog')).toBeNull();
    http
      .expectOne((r) => r.url === '/clinical/patients/p-1/summary')
      .flush({ ...RESUMEN, conditions: [decidida, RESUMEN.conditions[1]!] });
    fixture.detectChanges();
    for (const etiquetas of http.match((r) => r.url === '/terminology/concepts')) {
      etiquetas.flush(ETIQUETAS);
    }
    fixture.detectChanges();

    expect(avisos).toBe(1);
    expect(porTestId('diagnostico-confirmar-c-1')).toBeNull();
  });
});
