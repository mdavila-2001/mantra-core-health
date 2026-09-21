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

/**
 * El medicamento tal como sale del buscador: uuid a persistir, denominación a
 * mostrar y el código ATC como segunda línea.
 */
const VANCOMICINA = { value: 'med-vanco', label: 'Vancomycin', hint: 'J01XA01' };

const CATALOGO = {
  code: 'medication',
  name: 'Medicamento',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  allowCustomValue: false,
  options: [
    { conceptId: 'med-amoxi', code: 'J01CA04', display: 'Amoxicilina', ordinal: 1 },
    { conceptId: 'med-vanco', code: 'J01XA01', display: 'Vancomicina', ordinal: 2 },
    { conceptId: 'med-losar', code: 'C09CA01', display: 'Losartán', ordinal: 3 },
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

  /** La vía se pide cuando el formulario se pinta, después del catálogo. */
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

  it('no ofrece descarga, demostración ni favoritos y tampoco los consulta', () => {
    responderCatalogo();
    fixture.detectChanges();

    expect(texto()).not.toContain('Descargar PDF');
    expect(texto()).not.toContain('Casos de demostración');
    expect(texto()).not.toContain('favorito');
    expect(http.match('/prescription-favorites')).toHaveLength(0);
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

    // Con el motivo puesto y sin medicamento sigue sin poder: el medicamento es
    // obligatorio en el DTO y esta prueba mide **eso**, no el motivo.
    señal<string | null>('indicacion').set('cond-1');
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

  /* ── v4.1.6 · la indicación diagnóstica ───────────────────────────────── */

  it('manda el diagnóstico elegido como indicación de la receta', async () => {
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    señal<string | null>('indicacion').set('cond-1');
    await interno<() => Promise<void>>('recetar')();

    const req = http.expectOne('/clinical/medication-requests');
    expect((req.request.body as Record<string, unknown>)['indicationConditionId']).toBe('cond-1');

    req.flush(RESPUESTA);
  });

  it('sin diagnóstico elegido la clave no viaja: la receta sintomática es legítima', async () => {
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    await interno<() => Promise<void>>('recetar')();

    const req = http.expectOne('/clinical/medication-requests');
    expect(Object.keys(req.request.body as object)).not.toContain('indicationConditionId');

    req.flush(RESPUESTA);
  });

  it('ofrece los diagnósticos de la ficha, con la opción vacía primero', () => {
    responderCatalogo();

    fixture.componentRef.setInput('diagnosticos', [
      { id: 'cond-1', etiqueta: 'Faringitis aguda' },
      { id: 'cond-2', etiqueta: 'Hipertensión · Resuelto' },
    ]);
    fixture.detectChanges();

    const opciones = interno<() => readonly { value: string | null; label: string }[]>(
      'opcionesDeIndicacion',
    )();
    expect(opciones[0].value).toBeNull();
    // La vacía primero, los diagnósticos en el medio y la salida para escribir
    // el motivo al final: es la que destraba los casos sin diagnóstico previo.
    expect(opciones.map((o) => o.value)).toEqual([null, 'cond-1', 'cond-2', '__otro_motivo__']);
    expect(opciones[3]?.label).toBe('Otro motivo — escribirlo');
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

  it('manda la vía como concepto cuando se eligió', async () => {
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    señal<string>('via').set('via-oral');
    await interno<() => Promise<void>>('recetar')();

    const req = http.expectOne('/clinical/medication-requests');
    const body = req.request.body as Record<string, unknown>;
    expect(body['routeConceptId']).toBe('via-oral');

    req.flush(RESPUESTA);
  });

  it('sin elegir vía, su clave no viaja', async () => {
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    await interno<() => Promise<void>>('recetar')();

    const req = http.expectOne('/clinical/medication-requests');
    const body = req.request.body as object;
    expect('routeConceptId' in body).toBe(false);

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
    expect(interno<() => string>('indicacionesPaciente')()).toBe('');
  });

  it('manda inicio y fin de vigencia como fechas ISO cuando están configurados', async () => {
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    señal<Date>('validFrom').set(new Date('2026-08-20T10:00:00.000Z'));
    señal<Date>('validTo').set(new Date('2026-08-27T10:00:00.000Z'));
    await interno<() => Promise<void>>('recetar')();

    const req = http.expectOne('/clinical/medication-requests');
    const body = req.request.body as Record<string, unknown>;
    expect(body['validFrom']).toBe('2026-08-20T10:00:00.000Z');
    expect(body['validTo']).toBe('2026-08-27T10:00:00.000Z');

    req.flush(RESPUESTA);
  });

  it('las indicaciones al paciente viajan separadas de la dosis (v4.1.3)', async () => {
    responderCatalogo();

    señal<string>('medicamento').set('med-amoxi');
    señal<string>('dosis').set('500 mg');
    señal<string>('indicacionesPaciente').set('  Tomar con las comidas  ');
    await interno<() => Promise<void>>('recetar')();

    const req = http.expectOne('/clinical/medication-requests');
    const body = req.request.body as Record<string, unknown>;
    // La posología queda limpia —es lo que farmacia lee para dispensar—:
    // concatenarle las indicaciones fue el interino que v4.1.3 retiró.
    expect(body['doseText']).toBe('500 mg');
    expect(body['patientInstructionsText']).toBe('Tomar con las comidas');

    req.flush(RESPUESTA);
  });

  /* ---- pauta, duración y cantidad sugerida -------------------------------- */

  it('la pauta sugiere la cantidad sin pisar lo tecleado a mano', () => {
    responderCatalogo();

    interno<(p: string) => void>('fijarFrecuenciaRapida')('Cada 8 horas');
    interno<(d: number | null) => void>('fijarDuracion')(7);
    expect(String(señal<string | number | null>('cantidad')())).toBe('21');

    // Recalcula sobre su propia sugerencia…
    interno<(d: number | null) => void>('fijarDuracion')(10);
    expect(String(señal<string | number | null>('cantidad')())).toBe('30');

    // …pero jamás sobre lo que quien receta tecleó.
    señal<string | number | null>('cantidad').set('12');
    interno<(d: number | null) => void>('fijarDuracion')(3);
    expect(String(señal<string | number | null>('cantidad')())).toBe('12');
  });

  it('«Crónico» no aparece elegido al abrir, y al elegirlo borra el fin de vigencia', () => {
    responderCatalogo();

    // Sin elección no hay estado: `null === null` no es haber elegido crónico.
    expect(interno<() => boolean>('esCronico')()).toBe(false);

    interno<(d: number | null) => void>('fijarDuracion')(null);
    expect(interno<() => boolean>('esCronico')()).toBe(true);
    expect(interno<() => Date | null>('validTo')()).toBeNull();
  });

  it('usa selects para las pautas y conserva la frecuencia como texto editable', () => {
    responderCatalogo();
    fixture.detectChanges();

    const pantalla = fixture.nativeElement as HTMLElement;
    expect(pantalla.querySelectorAll('app-select').length).toBeGreaterThanOrEqual(3);
    expect(pantalla.querySelector('app-chip')).toBeNull();

    interno<(pauta: string) => void>('fijarFrecuenciaRapida')('Cada 12 horas');
    expect(señal<string>('frecuencia')()).toBe('Cada 12 horas');
    señal<string>('frecuencia').set('cada 10 horas según evolución');
    expect(señal<string>('frecuencia')()).toBe('cada 10 horas según evolución');
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

    http.expectOne('/cds/check-interactions').flush({ alerts: [], count: 0 });
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

    http
      .expectOne('/cds/check-interactions')
      .flush(
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

    expect(interno<() => string | null>('avisoDePrecondicion')()).toContain('necesita tu firma');
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

  it('una receta emitida no ofrece firmar ni emitir: es inmutable', () => {
    fixture.componentRef.setInput('recetas', [
      { ...BORRADOR, firmada: true, emitida: true, estado: 'Emitida' },
    ]);
    responderCatalogo();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('Firmar');
    expect(texto).not.toContain('Emitir');
  });

  it('agrupa las acciones editables en el menú estándar', () => {
    fixture.componentRef.setInput('recetas', [BORRADOR]);
    responderCatalogo();
    fixture.detectChanges();

    const pantalla = fixture.nativeElement as HTMLElement;
    expect(pantalla.querySelector('app-menu')).not.toBeNull();
    expect(pantalla.querySelector('[aria-label="Acciones de la receta"]')).not.toBeNull();
  });

  it('el sello distingue las tres etapas del ciclo', () => {
    responderCatalogo();

    const sello = interno<(r: RecetaEnFicha) => string>('selloDe');
    expect(sello(BORRADOR)).toBe('pending');
    expect(sello(FIRMADA)).toBe('in-review');
    expect(sello({ ...FIRMADA, emitida: true })).toBe('approved');
  });

  /* ---- elegir del catálogo: buscar y componer la posología ---------------- */

  /** Responde la ficha del concepto con las propiedades que se le pasen. */
  function responderFicha(properties: Record<string, unknown>): void {
    const req = http.expectOne(`/terminology/concepts/${VANCOMICINA.value}`);
    req.flush({
      conceptId: VANCOMICINA.value,
      code: 'J01XA01',
      display: 'Vancomycin',
      codeSystemVersionId: 'csv-vademecum',
      properties,
    });
  }

  it('busca dentro del vademécum, sin pedirle nada a la terminología', () => {
    // Antes preguntaba a `searchConcepts` sin acotar y devolvía el mismo
    // medicamento repetido —vademécum en inglés, catálogo de prescripción y
    // glosario— más conceptos que no son medicamentos. Ahora filtra el catálogo
    // que la pantalla ya cargó: lo que se ofrece y lo que el backend acepta son
    // lo mismo, y no hay una petición por tecla.
    responderCatalogo();

    interno<(texto: string) => void>('buscarMedicamento')('vanco');

    const opciones =
      interno<() => readonly { value: string; label: string; hint?: string }[]>(
        'opcionesDeMedicamento',
      )();
    expect(opciones).toEqual([{ value: 'med-vanco', label: 'Vancomicina', hint: 'J01XA01' }]);
    // Ni una petición: si saliera, `http.verify()` la denunciaría.
  });

  it('encuentra sin tilde lo que el catálogo escribe con tilde', () => {
    // Un médico teclea «losartan»; el catálogo dice «Losartán». Exigir el
    // acento al escribir es exigir de más.
    responderCatalogo();

    interno<(texto: string) => void>('buscarMedicamento')('losartan');

    expect(
      interno<() => readonly { label: string }[]>('opcionesDeMedicamento')().map((o) => o.label),
    ).toEqual(['Losartán']);
  });

  it('también busca por código ATC', () => {
    responderCatalogo();

    interno<(texto: string) => void>('buscarMedicamento')('J01CA04');

    expect(
      interno<() => readonly { label: string }[]>('opcionesDeMedicamento')().map((o) => o.label),
    ).toEqual(['Amoxicilina']);
  });

  it('sin texto ofrece el catálogo entero, no una lista vacía', () => {
    responderCatalogo();

    interno<(texto: string) => void>('buscarMedicamento')('');

    expect(interno<() => readonly unknown[]>('opcionesDeMedicamento')()).toHaveLength(3);
  });

  it('al elegir, lee la ficha y ofrece presentaciones y concentraciones', () => {
    responderCatalogo();

    interno<(o: unknown) => void>('onMedicamentoElegido')(VANCOMICINA);
    responderFicha({
      dose_forms: ['oral capsule', 'oral solution'],
      strengths: ['500 mg', '1 g'],
      // Ruido del catálogo que esta pantalla no ofrece: no debe estorbar.
      rxnorm_cui: '11124',
    });

    expect(interno<() => readonly { value: string }[]>('presentaciones')()).toEqual([
      { value: 'oral capsule', label: 'oral capsule' },
      { value: 'oral solution', label: 'oral solution' },
    ]);
    expect(interno<() => readonly { value: string }[]>('concentraciones')()).toEqual([
      { value: '500 mg', label: '500 mg' },
      { value: '1 g', label: '1 g' },
    ]);
    expect(interno<() => boolean>('hayPosologia')()).toBe(true);
  });

  it('los valores del catálogo completan la dosis, pero el texto libre manda', async () => {
    responderCatalogo();

    señal<string>('medicamento').set(VANCOMICINA.value);
    interno<(o: unknown) => void>('onMedicamentoElegido')(VANCOMICINA);
    responderFicha({ dose_forms: ['oral capsule'], strengths: ['1 g'] });

    interno<(valor: string | null) => void>('elegirConcentracion')('1 g');
    interno<(valor: string | null) => void>('elegirPresentacion')('oral capsule');
    expect(señal<string>('dosis')()).toBe('1 g · oral capsule');

    señal<string>('dosis').set('900 mg ajustados');
    await interno<() => Promise<void>>('recetar')();

    const req = http.expectOne('/clinical/medication-requests');
    expect((req.request.body as Record<string, unknown>)['doseText']).toBe('900 mg ajustados');

    req.flush(RESPUESTA);
  });

  it('un medicamento sin propiedades declaradas cae al texto libre de siempre', async () => {
    responderCatalogo();

    señal<string>('medicamento').set(VANCOMICINA.value);
    interno<(o: unknown) => void>('onMedicamentoElegido')(VANCOMICINA);
    responderFicha({ rxnorm_cui: '11124' });

    expect(interno<() => boolean>('hayPosologia')()).toBe(false);

    señal<string>('dosis').set('500 mg');
    await interno<() => Promise<void>>('recetar')();

    const req = http.expectOne('/clinical/medication-requests');
    expect((req.request.body as Record<string, unknown>)['doseText']).toBe('500 mg');

    req.flush(RESPUESTA);
  });

  /**
   * La ficha puede fallar —o traer una forma que esta pantalla no sabe leer— y
   * eso no puede impedir prescribir: el medicamento ya está elegido y es lo
   * único obligatorio. Se cae al texto libre, que es como funcionaba la
   * pantalla entera antes de que el catálogo publicara presentaciones.
   */
  it('si la ficha falla, el medicamento sigue siendo prescribible', () => {
    responderCatalogo();

    señal<string>('medicamento').set(VANCOMICINA.value);
    interno<(o: unknown) => void>('onMedicamentoElegido')(VANCOMICINA);
    http
      .expectOne(`/terminology/concepts/${VANCOMICINA.value}`)
      .flush(
        { code: 'NOT_FOUND', message: 'Concepto no encontrado', timestamp: '', path: '' },
        { status: 404, statusText: 'Not Found' },
      );

    expect(interno<() => boolean>('hayPosologia')()).toBe(false);
    expect(interno<() => boolean>('puedeRecetar')()).toBe(true);
  });

  it('cambiar de medicamento descarta la posología del anterior', () => {
    responderCatalogo();

    interno<(o: unknown) => void>('onMedicamentoElegido')(VANCOMICINA);
    responderFicha({ strengths: ['1 g'] });
    señal<string>('concentracion').set('1 g');

    // Borrar la elección: el combobox emite `null`.
    interno<(o: unknown) => void>('onMedicamentoElegido')(null);

    expect(interno<() => readonly unknown[]>('concentraciones')()).toEqual([]);
    expect(interno<() => string | null>('concentracion')()).toBeNull();
    expect(interno<() => boolean>('hayPosologia')()).toBe(false);
  });
  /* -- El porqué de la receta (pedido del cliente) ------------------------- */

  describe('el porqué de la receta', () => {
    it('sin diagnóstico ni motivo sigue dejando prescribir: ambos son opcionales', () => {
      responderCatalogo();
      señal<string>('medicamento').set('med-amoxi');

      expect(interno<() => boolean>('puedeRecetar')()).toBe(true);
    });

    it('un diagnóstico de la historia alcanza', () => {
      responderCatalogo();
      señal<string>('medicamento').set('med-amoxi');
      señal<string | null>('indicacion').set('cond-1');

      expect(interno<() => boolean>('puedeRecetar')()).toBe(true);
    });

    /**
     * El caso que el cliente nombró: «sólo se fue a hacer recetar y no
     * necesitaría diagnóstico existente previo, sobre todo casos
     * psiquiátricos».
     */
    it('ofrece motivo libre aun sin diagnóstico asociado', () => {
      responderCatalogo();
      señal<string>('medicamento').set('med-amoxi');

      expect(interno<() => boolean>('motivoEsLibre')()).toBe(true);
      señal<string>('motivoLibre').set('Trastorno de ansiedad generalizada');
      expect(interno<() => boolean>('puedeRecetar')()).toBe(true);
    });

    it('sin diagnóstico, un motivo libre viaja como texto', async () => {
      responderCatalogo();
      señal<string>('medicamento').set('med-amoxi');
      señal<string>('motivoLibre').set('Control de síntomas');

      await interno<() => Promise<void>>('recetar')();

      const req = http.expectOne('/clinical/medication-requests');
      const body = req.request.body as Record<string, unknown>;
      expect(body['indicationText']).toBe('Control de síntomas');
      expect('indicationConditionId' in body).toBe(false);
      req.flush(RESPUESTA);
    });

    /** Son excluyentes: `__otro_motivo__` no es el id de ninguna condición. */
    it('con «Otro motivo» viaja el texto y NO la condición', async () => {
      responderCatalogo();
      señal<string>('medicamento').set('med-amoxi');
      interno<(v: string | null) => void>('elegirIndicacion')('__otro_motivo__');
      señal<string>('motivoLibre').set('Insomnio de conciliación');

      await interno<() => Promise<void>>('recetar')();

      const req = http.expectOne('/clinical/medication-requests');
      expect(req.request.body.indicationText).toBe('Insomnio de conciliación');
      expect('indicationConditionId' in req.request.body).toBe(false);
      req.flush(RESPUESTA);
    });

    /** Y al revés: elegido un diagnóstico, el texto no viaja. */
    it('con un diagnóstico elegido viaja la condición y no el texto', async () => {
      responderCatalogo();
      señal<string>('medicamento').set('med-amoxi');
      interno<(v: string | null) => void>('elegirIndicacion')('cond-1');

      await interno<() => Promise<void>>('recetar')();

      const req = http.expectOne('/clinical/medication-requests');
      expect(req.request.body.indicationConditionId).toBe('cond-1');
      expect('indicationText' in req.request.body).toBe(false);
      req.flush(RESPUESTA);
    });

    /** Cambiar de opción borra lo escrito: un motivo que ya no describe nada. */
    it('salir de «Otro motivo» borra el texto', () => {
      responderCatalogo();
      interno<(v: string | null) => void>('elegirIndicacion')('__otro_motivo__');
      señal<string>('motivoLibre').set('Algo');

      interno<(v: string | null) => void>('elegirIndicacion')('cond-1');

      expect(interno<() => string>('motivoLibre')()).toBe('');
    });
  });
});
