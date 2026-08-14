import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import {
  MedicationBlock,
  TARGET_MEDICAMENTO,
  type RecetaEnFicha,
} from './medication-block';

/**
 * Prescribir, firmar y emitir desde la ficha — V08-01. Lo que estas pruebas
 * fijan:
 *
 * 1. **El binding manda.** Sin catálogo declarado para
 *    `clinical.medication_requests.medication_concept_id` no se ofrece el
 *    formulario y se dice por qué. El selector no cae a texto libre: un uuid
 *    tecleado a mano es un dato inválido o, peor, uno válido de otro conjunto.
 * 2. **Lo opcional vacío se omite.** El backend valida con
 *    `forbidNonWhitelisted`, y una dosis en blanco no es una dosis.
 * 3. **El 422 de emitir sin firmar es un aviso, no un error rojo.** La política
 *    D-05 describe un paso que falta, con salida a un click.
 * 4. **Después de escribir se relee.** El bloque avisa; no pinta lo que el
 *    servidor no le confirmó.
 */

const BORRADOR: RecetaEnFicha = {
  id: 'rx-1',
  medicamento: 'Amoxicilina 500 mg',
  indicacion: '500 mg · cada 8 horas',
  estado: 'Borrador',
  firmada: false,
  emitida: false,
};

const FIRMADA: RecetaEnFicha = { ...BORRADOR, id: 'rx-2', estado: 'Firmada', firmada: true };

const CATALOGO = {
  code: 'medication',
  name: 'Medicamento',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  allowCustomValue: false,
  options: [
    { conceptId: 'med-amoxi', code: 'AMOXI', display: 'Amoxicilina', ordinal: 1 },
  ],
};

/** Vía y unidad: los dos catálogos opcionales del formulario. */
const CATALOGO_OPCIONAL = {
  ...CATALOGO,
  code: 'medication-route',
  options: [{ conceptId: 'via-oral', code: 'ROUTE_ORAL', display: 'Oral route', ordinal: 1 }],
};

/** Una receta tal como vuelve de las tres escrituras. */
const RESPUESTA = {
  id: 'rx-1',
  patientProfileId: 'p-1',
  status: 'st-borrador',
  replacesRequestId: null,
  replacedByRequestId: null,
  renewedFromRequestId: null,
  signedAt: null,
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

describe('MedicationBlock', () => {
  let fixture: ComponentFixture<MedicationBlock>;
  let componente: MedicationBlock;
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

    fixture = TestBed.createComponent(MedicationBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    fixture.componentRef.setInput('encounterId', 'enc-1');
    fixture.componentRef.setInput('recetas', []);
  });

  /**
   * Vía y unidad se piden cuando el formulario se pinta, que puede ser después
   * de `responderCatalogo` —en cuanto una prueba llama a `detectChanges`—. Se
   * drenan acá para que `verify()` no tropiece con ellas: lo que gobierna si el
   * alta se ofrece es el catálogo del medicamento, y eso lo cubren las pruebas
   * de arriba.
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
   * Responde el catálogo del medicamento: con binding, o con el 404 de su
   * ausencia.
   *
   * Los de vía y unidad se responden después y siempre con opciones: son
   * **opcionales** en el contrato, no gobiernan si el formulario se ofrece, y
   * sólo aparecen una vez que el formulario existe.
   */
  function responderCatalogo(hayBinding = true): void {
    fixture.detectChanges();
    const req = http.expectOne((r) => r.params.get('target') === TARGET_MEDICAMENTO);
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
    expect(texto()).toContain('El catálogo de medicamentos no está publicado');
    // Y nada de texto libre: sin catálogo no hay dónde escribir un medicamento.
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
  });

  it('con binding declarado ofrece el formulario', () => {
    responderCatalogo();
    fixture.detectChanges();

    expect(interno<() => boolean | null>('catalogoListo')()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).not.toBeNull();
  });

  it('sin encuentro abierto no receta: la receta vive dentro de la consulta', () => {
    fixture.componentRef.setInput('encounterId', null);
    responderCatalogo();
    fixture.detectChanges();

    expect(texto()).toContain('Abrí el encuentro para recetar');
    expect(interno<() => boolean>('puedeRecetar')()).toBe(false);
  });

  /* ---- prescribir --------------------------------------------------------- */

  it('no envía sin medicamento elegido: es obligatorio en el DTO', () => {
    responderCatalogo();

    expect(interno<() => boolean>('puedeRecetar')()).toBe(false);

    señal<string>('medicamento').set('med-amoxi');
    expect(interno<() => boolean>('puedeRecetar')()).toBe(true);
  });

  it('manda los tres obligatorios y el encuentro, y omite lo vacío', async () => {
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    await interno<() => Promise<void>>('recetar')();

    const req = http.expectOne('/clinical/medication-requests');
    expect(Object.keys(req.request.body as object).sort()).toEqual([
      'custodianTenantId',
      'encounterId',
      'medicationConceptId',
      'patientProfileId',
    ]);
    expect((req.request.body as Record<string, unknown>)['custodianTenantId']).toBe('t-1');

    req.flush(RESPUESTA);
  });

  it('manda dosis, frecuencia y cantidad cuando se cargaron', async () => {
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    señal<string>('dosis').set('  500 mg  ');
    señal<string>('frecuencia').set('cada 8 horas');
    señal<string>('cantidad').set('21');
    await interno<() => Promise<void>>('recetar')();

    const req = http.expectOne('/clinical/medication-requests');
    const body = req.request.body as Record<string, unknown>;
    expect(body['doseText']).toBe('500 mg');
    expect(body['frequencyText']).toBe('cada 8 horas');
    // Numérico, no el texto del control: el DTO lo valida con `IsNumber`.
    expect(body['quantityDecimal']).toBe(21);

    req.flush(RESPUESTA);
  });

  /**
   * Vía y unidad son opcionales del DTO: se mandan si se eligieron y, si no, la
   * clave no viaja. Es el mismo criterio que los textos libres, y el que
   * permite que el alta funcione aunque sus catálogos no estén publicados.
   */
  it('manda vía y unidad como conceptos cuando se eligieron', async () => {
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    señal<string>('via').set('via-oral');
    señal<string>('unidad').set('u-mg');
    await interno<() => Promise<void>>('recetar')();

    const req = http.expectOne('/clinical/medication-requests');
    const body = req.request.body as Record<string, unknown>;
    expect(body['routeConceptId']).toBe('via-oral');
    expect(body['unitConceptId']).toBe('u-mg');

    req.flush(RESPUESTA);
  });

  it('sin elegir vía ni unidad, esas claves no viajan', async () => {
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    await interno<() => Promise<void>>('recetar')();

    const req = http.expectOne('/clinical/medication-requests');
    const body = req.request.body as object;
    expect('routeConceptId' in body).toBe(false);
    expect('unitConceptId' in body).toBe(false);

    req.flush(RESPUESTA);
  });

  /**
   * `Number('')` es `0`, y «cantidad cero» en una indicación médica no es lo
   * mismo que no haber escrito cantidad.
   */
  it('una cantidad en blanco no viaja como cero', async () => {
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    señal<string>('cantidad').set('');
    await interno<() => Promise<void>>('recetar')();

    const req = http.expectOne('/clinical/medication-requests');
    expect('quantityDecimal' in (req.request.body as object)).toBe(false);

    req.flush(RESPUESTA);
  });

  it('tras prescribir avisa para releer y limpia el formulario', async () => {
    responderCatalogo();

    let releido = 0;
    componente.cambio.subscribe(() => (releido += 1));

    señal<string>('medicamento').set('med-amoxi');
    señal<string>('dosis').set('500 mg');
    await interno<() => Promise<void>>('recetar')();
    http.expectOne('/clinical/medication-requests').flush(RESPUESTA);

    expect(releido).toBe(1);
    expect(interno<() => string | null>('medicamento')()).toBeNull();
    expect(interno<() => string>('dosis')()).toBe('');
  });

  /* ---- el chequeo de interacciones ---------------------------------------- */

  /**
   * Sin medicación previa registrada no hay con qué comparar —el contrato
   * exige al menos dos sustancias—, así que ni siquiera se pide el chequeo.
   * Ya lo cubren las pruebas de arriba (todas parten de `recetas: []`); ésta
   * lo deja explícito.
   */
  it('sin medicación activa, prescribe sin pedir el chequeo de interacciones', async () => {
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    await interno<() => Promise<void>>('recetar')();

    http.expectOne('/clinical/medication-requests').flush(RESPUESTA);
    http.expectNone('/cds/check-interactions');
  });

  it('con medicación activa y sin interacciones, prescribe sin confirmar nada', async () => {
    fixture.componentRef.setInput('medicacionActivaConceptIds', ['med-previo']);
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    const prescribiendo = interno<() => Promise<void>>('recetar')();

    http
      .expectOne('/cds/check-interactions')
      .flush({ alerts: [], count: 0 });
    await prescribiendo;

    http.expectOne('/clinical/medication-requests').flush(RESPUESTA);
  });

  it('con interacciones encontradas, pide confirmar antes de prescribir', async () => {
    fixture.componentRef.setInput('medicacionActivaConceptIds', ['med-previo']);
    responderCatalogo();

    TestBed.inject(DialogService).confirm = () => Promise.resolve(true);
    señal<string>('medicamento').set('med-amoxi');
    const prescribiendo = interno<() => Promise<void>>('recetar')();

    const chequeo = http.expectOne('/cds/check-interactions');
    expect((chequeo.request.body as { substanceConceptIds: string[] }).substanceConceptIds).toEqual(
      ['med-previo', 'med-amoxi'],
    );
    chequeo.flush({
      alerts: [{ id: 'al-1', alertTypeConceptId: 'tipo-1', severityConceptId: 'sev-1' }],
      count: 1,
    });
    await prescribiendo;

    http.expectOne('/clinical/medication-requests').flush(RESPUESTA);
  });

  it('si se rechaza la confirmación de interacciones, no prescribe', async () => {
    fixture.componentRef.setInput('medicacionActivaConceptIds', ['med-previo']);
    responderCatalogo();

    TestBed.inject(DialogService).confirm = () => Promise.resolve(false);
    señal<string>('medicamento').set('med-amoxi');
    const prescribiendo = interno<() => Promise<void>>('recetar')();

    http.expectOne('/cds/check-interactions').flush({
      alerts: [{ id: 'al-1', alertTypeConceptId: 'tipo-1', severityConceptId: 'sev-1' }],
      count: 1,
    });
    await prescribiendo;

    http.expectNone('/clinical/medication-requests');
  });

  /**
   * Si el chequeo mismo no responde, prescribir no se bloquea por eso: hoy la
   * ausencia total de esta alerta es el estado normal, y una caída puntual no
   * puede ser más restrictiva que eso.
   */
  it('si el chequeo de interacciones falla, prescribe igual', async () => {
    fixture.componentRef.setInput('medicacionActivaConceptIds', ['med-previo']);
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    const prescribiendo = interno<() => Promise<void>>('recetar')();

    http.expectOne('/cds/check-interactions').flush(
      { code: 'INTERNAL', message: 'Error interno', timestamp: '', path: '' },
      { status: 500, statusText: 'Internal Server Error' },
    );
    await prescribiendo;

    http.expectOne('/clinical/medication-requests').flush(RESPUESTA);
  });

  /* ---- firmar y emitir ---------------------------------------------------- */

  it('firmar pega contra `sign` sin cuerpo y pide releer', () => {
    fixture.componentRef.setInput('recetas', [BORRADOR]);
    responderCatalogo();

    let releido = 0;
    componente.cambio.subscribe(() => (releido += 1));

    interno<(r: RecetaEnFicha) => void>('firmar')(BORRADOR);

    const req = http.expectOne('/clinical/medication-requests/rx-1/sign');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ ...RESPUESTA, signedAt: '2026-08-13T12:30:00.000Z' });

    expect(releido).toBe(1);
  });

  /**
   * Emitir es sin vuelta —la receta queda inmutable— así que se confirma, igual
   * que el cierre de un encuentro. Sin confirmación no sale ninguna petición.
   */
  it('emitir sin confirmar no manda nada', async () => {
    fixture.componentRef.setInput('recetas', [FIRMADA]);
    responderCatalogo();

    TestBed.inject(DialogService).confirm = () => Promise.resolve(false);
    await interno<(r: RecetaEnFicha) => Promise<void>>('emitir')(FIRMADA);

    http.expectNone('/clinical/medication-requests/rx-2/issue');
  });

  it('emitir confirmado pega contra `issue` y pide releer', async () => {
    fixture.componentRef.setInput('recetas', [FIRMADA]);
    responderCatalogo();

    TestBed.inject(DialogService).confirm = () => Promise.resolve(true);
    let releido = 0;
    componente.cambio.subscribe(() => (releido += 1));

    await interno<(r: RecetaEnFicha) => Promise<void>>('emitir')(FIRMADA);

    const req = http.expectOne('/clinical/medication-requests/rx-2/issue');
    expect(req.request.method).toBe('POST');
    req.flush({ ...RESPUESTA, id: 'rx-2', status: 'st-emitida' });

    expect(releido).toBe(1);
  });

  /**
   * El camino que hay que contar bien: la política D-05 rechaza con `422
   * PRECONDITION_FAILED` (la excepción del proyecto es 422, **no** 412). Es un
   * paso que falta, no un fallo, y la salida está al lado.
   */
  it('emitir sin firmar muestra el 422 como aviso de precondición, no como error', async () => {
    fixture.componentRef.setInput('recetas', [BORRADOR]);
    responderCatalogo();

    TestBed.inject(DialogService).confirm = () => Promise.resolve(true);
    await interno<(r: RecetaEnFicha) => Promise<void>>('emitir')(BORRADOR);

    http.expectOne('/clinical/medication-requests/rx-1/issue').flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'La política vigente exige firmar la receta antes de emitirla',
        timestamp: '',
        path: '',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    expect(interno<() => string | null>('avisoDePrecondicion')()).toContain(
      'necesita tu firma',
    );
    // Y no se pinta además en rojo: sería decir dos veces lo mismo con dos
    // tonos que se contradicen.
    expect(interno<() => string | null>('errorDeLaReceta')()).toBeNull();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="receta-precondicion"]')).not.toBeNull();
    expect(html.querySelector('[data-testid="receta-error"]')).toBeNull();
  });

  /**
   * La misma precondición sobre una receta **ya firmada** no es «falta la
   * firma»: es que el estado en pantalla quedó viejo, y la salida es recargar.
   */
  it('la precondición sobre una receta firmada se cuenta como estado viejo', async () => {
    fixture.componentRef.setInput('recetas', [FIRMADA]);
    responderCatalogo();

    TestBed.inject(DialogService).confirm = () => Promise.resolve(true);
    await interno<(r: RecetaEnFicha) => Promise<void>>('emitir')(FIRMADA);

    http.expectOne('/clinical/medication-requests/rx-2/issue').flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'Solo un borrador (DRAFT) puede emitirse',
        timestamp: '',
        path: '',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    expect(interno<() => string | null>('avisoDePrecondicion')()).toBeNull();
    expect(interno<() => string | null>('errorDeLaReceta')()).toContain('Recargá el expediente');
  });

  it('una receta emitida no ofrece acciones: es inmutable', () => {
    fixture.componentRef.setInput('recetas', [
      { ...BORRADOR, firmada: true, emitida: true, estado: 'Emitida' },
    ]);
    responderCatalogo();
    fixture.detectChanges();

    const acciones = (fixture.nativeElement as HTMLElement).querySelector('.receta__acciones');
    expect(acciones).toBeNull();
  });

  it('el sello distingue las tres etapas del ciclo', () => {
    responderCatalogo();

    const sello = interno<(r: RecetaEnFicha) => string>('selloDe');
    expect(sello(BORRADOR)).toBe('pending');
    expect(sello(FIRMADA)).toBe('in-review');
    expect(sello({ ...FIRMADA, emitida: true })).toBe('approved');
  });
});
