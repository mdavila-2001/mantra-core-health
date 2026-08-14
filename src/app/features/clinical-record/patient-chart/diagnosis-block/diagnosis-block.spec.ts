import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import { DiagnosisBlock, TARGET_DIAGNOSTICO } from './diagnosis-block';

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
  options: [
    { conceptId: 'dx-hta', code: 'I10', display: 'Hipertensión esencial', ordinal: 1 },
  ],
};

/** Categoría, severidad y lateralidad: los tres catálogos opcionales. */
const CATALOGO_OPCIONAL = {
  ...CATALOGO,
  code: 'condition-severity',
  options: [{ conceptId: 'sev-leve', code: 'COND_SEV_MILD', display: 'Mild', ordinal: 1 }],
};

/** Una condición tal como vuelve del alta. */
const RESPUESTA = {
  id: 'c-1',
  patientProfileId: 'p-1',
  clinicalStatus: 'st-activa',
  verificationStatus: 'st-confirmada',
  createdAt: '2026-08-13T12:00:00.000Z',
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
    for (const opcional of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      opcional.flush(CATALOGO_OPCIONAL);
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
        opcional.flush(CATALOGO_OPCIONAL);
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

    http.expectOne('/clinical/conditions').flush(
      { code: 'INTERNAL', message: 'Error interno del servidor', timestamp: '', path: '' },
      { status: 500, statusText: 'Internal Server Error' },
    );
    fixture.detectChanges();

    expect(interno<() => string | null>('avisoDeDuplicado')()).toBeNull();
    expect(interno<() => string | null>('errorDelDiagnostico')()).toContain(
      'Error interno del servidor',
    );
  });
});
