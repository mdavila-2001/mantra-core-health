import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../core/auth/session.store';
import { MedicalRecord } from './medical-record';

/**
 * El archivo clínico del paciente (carril 09) — el cierre del P0.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **Se pide la historia propia y ninguna otra.** El aislamiento lo hace el
 *    servidor, pero esta pantalla no puede ni intentar pedir otra.
 * 2. **Sin perfil de paciente no se pide nada.** Una cuenta de personal de
 *    salud tiene sesión válida y esta pantalla no le corresponde.
 * 3. **Ningún uuid llega a la pantalla**: todo `*ConceptId` se traduce.
 * 4. **Lo que el catálogo no resuelva se muestra como ausencia**, no como
 *    identificador.
 */

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

const RESUMEN = {
  patientProfileId: 'pp-1',
  conditions: [
    {
      id: 'c-1',
      codeConceptId: 'con-faringitis',
      clinicalStatusConceptId: 'st-activa',
      encounterId: 'e-1',
      createdAt: '2026-03-01T10:10:00.000Z',
    },
  ],
  allergies: [],
  medicationRequests: [
    {
      id: 'm-1',
      medicationConceptId: 'med-amoxi',
      statusConceptId: 'st-activa',
      doseText: '500 mg',
      frequencyText: 'cada 8 horas',
      issuedAt: '2026-03-01T11:00:00.000Z',
      createdAt: '2026-03-01T10:30:00.000Z',
    },
  ],
  observations: [],
  encounters: [
    {
      id: 'e-1',
      statusConceptId: 'st-activa',
      reasonText: 'Dolor de garganta',
      startAt: '2026-03-01T10:00:00.000Z',
      endAt: '2026-03-01T10:40:00.000Z',
    },
  ],
  careEpisodes: [],
  limit: 50,
  truncated: [],
};

/** El listado propio de formularios: una instancia respondida en la atención e-1. */
const FORMULARIOS = {
  items: [
    {
      id: 'fi-1',
      resourceId: 'e-1',
      resourceTypeConceptId: 'rt-1',
      schemaVersion: 1,
      closedAt: '2026-03-01T10:35:00.000Z',
      createdAt: '2026-03-01T10:20:00.000Z',
    },
  ],
  limit: 50,
  truncated: false,
};

/** El detalle: una respuesta legible y una que el backend enmascaró. */
const FORMULARIO_DETALLE = {
  ...FORMULARIOS.items[0],
  values: [
    {
      id: 'v-1',
      fieldId: 'f-1',
      dataType: 'string',
      fieldName: 'Tolerancia al ejercicio',
      value: 'Buena',
      ordinal: 0,
      masked: false,
    },
    {
      id: 'v-2',
      fieldId: 'f-2',
      dataType: 'string',
      fieldName: 'Serología',
      // Un backend con un error jamás debería mandar el valor enmascarado;
      // si igual lo mandara, la pantalla no puede mostrarlo.
      value: 'SECRETO',
      ordinal: 1,
      masked: true,
    },
  ],
};

const SIN_FORMULARIOS = { items: [], limit: 50, truncated: false };

const CONCEPTOS = {
  items: [
    {
      conceptId: 'con-faringitis',
      code: 'J02',
      display: 'Faringitis aguda',
      codeSystemVersionId: 'v1',
    },
    { conceptId: 'st-activa', code: 'ACTIVE', display: 'Activa', codeSystemVersionId: 'v1' },
    {
      conceptId: 'med-amoxi',
      code: 'J01CA04',
      display: 'Amoxicilina',
      codeSystemVersionId: 'v1',
    },
  ],
  count: 3,
  limit: 200,
};

describe('MedicalRecord', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'my-account/medical-record', component: MedicalRecord }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Abre sesión con perfil de paciente (`pid`) antes de montar. */
  async function montar(claims: Record<string, unknown> = { pid: 'pp-1' }): Promise<void> {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], ...claims }),
      refreshToken: 'r-1',
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/my-account/medical-record', MedicalRecord);
  }

  function responder(resumen: object = RESUMEN, conceptos: object = CONCEPTOS): void {
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(resumen);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(conceptos);
    responderFormularios();
    harness.detectChanges();
  }

  /** Resuelve la lectura de formularios propios: listado y detalle de cada uno. */
  function responderFormularios(listado: object = FORMULARIOS): void {
    http.expectOne((r) => r.url === '/forms/me/instances').flush(listado);
    if (listado === FORMULARIOS) {
      http.expectOne((r) => r.url === '/forms/me/instances/fi-1').flush(FORMULARIO_DETALLE);
    }
    harness.detectChanges();
  }

  it('pide la historia del perfil propio, con su tope por bloque', async () => {
    await montar();

    const req = http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary');
    expect(req.request.params.get('limit')).toBe('50');
    req.flush(RESUMEN);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);

    // Los formularios se piden por la ruta propia, sin ningún identificador
    // de paciente: el servidor lo toma de la sesión.
    const formularios = http.expectOne((r) => r.url === '/forms/me/instances');
    expect(formularios.request.params.keys()).toEqual(['limit']);
    formularios.flush(SIN_FORMULARIOS);
  });

  it('sin perfil de paciente no sale ninguna lectura', async () => {
    // Una cuenta de personal de salud: sesión válida, sin `pid`.
    await montar({});

    // El `http.verify()` del afterEach falla si algo salió a la red.
    expect(harness.routeNativeElement?.textContent).toContain('Esta sección es para pacientes');
  });

  it('muestra la atención con su motivo y sus diagnósticos, sin uuid', async () => {
    await montar();
    responder();

    const texto = harness.routeNativeElement?.textContent ?? '';
    expect(texto).toContain('Dolor de garganta');
    expect(texto).toContain('Faringitis aguda');
    expect(texto).not.toContain('con-faringitis');
  });

  it('muestra la receta traducida y su indicación', async () => {
    await montar();
    responder();

    const texto = harness.routeNativeElement?.textContent ?? '';
    expect(texto).toContain('Amoxicilina');
    expect(texto).toContain('500 mg · cada 8 horas');
  });

  it('cada atención y cada receta ofrecen su descarga (corrección #16)', async () => {
    await montar();
    responder();

    const raiz = harness.routeNativeElement;
    expect(raiz?.querySelector('[data-testid="historia-descargar-atencion"]')).not.toBeNull();
    expect(raiz?.querySelector('[data-testid="historia-descargar-receta"]')).not.toBeNull();
  });

  it('una historia sin nada registrado lo dice, con su salida', async () => {
    await montar();
    // Sin registros no hay conceptos que traducir, así que la lectura del
    // catálogo ni sale: pedirla vacía sería una petición que se sabe inútil.
    http
      .expectOne((r) => r.url === '/clinical/patients/pp-1/summary')
      .flush({
        ...RESUMEN,
        conditions: [],
        medicationRequests: [],
        encounters: [],
      });
    responderFormularios(SIN_FORMULARIOS);
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain('Todavía no hay atenciones');
  });

  it('si el catálogo falla, la historia igual se muestra', async () => {
    await montar();
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(RESUMEN);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush(
        { code: 'ERROR', message: 'Catálogo caído', timestamp: '', path: '' },
        { status: 500, statusText: 'Server Error' },
      );
    responderFormularios(SIN_FORMULARIOS);
    harness.detectChanges();

    const texto = harness.routeNativeElement?.textContent ?? '';
    // La atención sigue: perder la traducción no justifica perder la historia.
    expect(texto).toContain('Dolor de garganta');
    // Y lo que no se pudo traducir sale como ausencia, nunca como uuid.
    expect(texto).toContain('Sin registrar');
    expect(texto).not.toContain('med-amoxi');
  });

  it('lo recortado se declara: callarlo se lee como «no hay nada más»', async () => {
    await montar();
    responder({ ...RESUMEN, truncated: ['observations'] });

    expect(harness.routeNativeElement?.textContent).toContain('observations');
  });

  /* ---- J3 · la descarga de la historia completa --------------------------- */

  it('no pide órdenes ni resultados al abrir la pantalla', async () => {
    await montar();
    responder();

    // Son dos lecturas más que la mayoría de las visitas no necesita: pagarlas
    // siempre para que un botón esté listo por si acaso es cobrarle a todos por
    // lo que usan pocos.
    http.expectNone((r) => r.url === '/diagnostic-results/me/orders');
    http.expectNone((r) => r.url === '/diagnostic-results/me');
  });

  it('al pedir la historia completa trae órdenes y resultados', async () => {
    await montar();
    responder();

    const boton = [
      ...(harness.routeNativeElement?.querySelectorAll('button[app-button]') ?? []),
    ].find((b) => (b.textContent ?? '').includes('historia completa')) as HTMLButtonElement;
    expect(boton).toBeDefined();
    boton.click();
    harness.detectChanges();

    http
      .expectOne((r) => r.url === '/diagnostic-results/me/orders')
      .flush({ patientProfileId: 'pp-1', items: [], limit: 50, truncated: false });
    http
      .expectOne((r) => r.url === '/diagnostic-results/me')
      .flush({ patientProfileId: 'pp-1', items: [], limit: 50, truncated: false });
  });

  it('si las lecturas secundarias fallan, la descarga sigue en pie', async () => {
    await montar();
    responder();

    const boton = [
      ...(harness.routeNativeElement?.querySelectorAll('button[app-button]') ?? []),
    ].find((b) => (b.textContent ?? '').includes('historia completa')) as HTMLButtonElement;
    boton.click();
    harness.detectChanges();

    // Un PDF con las atenciones y sin las órdenes sigue sirviendo; negarle la
    // descarga entera a alguien porque una lectura secundaria falló, no.
    http
      .expectOne((r) => r.url === '/diagnostic-results/me/orders')
      .flush(null, { status: 500, statusText: 'Server Error' });
    http
      .expectOne((r) => r.url === '/diagnostic-results/me')
      .flush(null, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).not.toContain('No pudimos armar');
  });

  /* ---- los formularios clínicos respondidos ------------------------------- */

  it('muestra los formularios respondidos con sus etiquetas y valores legibles', async () => {
    await montar();
    responder();

    const raiz = harness.routeNativeElement;
    const seccion = raiz?.querySelector('[data-testid="historia-formularios"]');
    expect(seccion).not.toBeNull();
    const texto = seccion?.textContent ?? '';
    expect(texto).toContain('Formulario clínico');
    expect(texto).toContain('Tolerancia al ejercicio');
    expect(texto).toContain('Buena');
    // La sección es de sólo lectura: ningún formulario de captura ni envío.
    expect(seccion?.querySelector('form')).toBeNull();
    expect(seccion?.querySelector('input')).toBeNull();
  });

  it('el valor enmascarado muestra el marcador y jamás el contenido', async () => {
    await montar();
    responder();

    const raiz = harness.routeNativeElement;
    const marcador = raiz?.querySelector('[data-testid="historia-respuesta-enmascarada"]');
    expect(marcador?.textContent).toContain('No disponible por reglas de acceso');
    // Ni en la respuesta enmascarada ni en ningún otro lugar del documento.
    expect(raiz?.textContent).not.toContain('SECRETO');
  });

  it('una cuenta sin formularios ve el vacío declarado', async () => {
    await montar();
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(RESUMEN);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    responderFormularios(SIN_FORMULARIOS);
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).toContain(
      'Todavía no tenés formularios respondidos',
    );
  });

  it('si los formularios fallan, la historia igual se muestra y se ofrece reintentar', async () => {
    await montar();
    http.expectOne((r) => r.url === '/clinical/patients/pp-1/summary').flush(RESUMEN);
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    http
      .expectOne((r) => r.url === '/forms/me/instances')
      .flush(
        { code: 'ERROR', message: 'Forms caído', timestamp: '', path: '' },
        { status: 500, statusText: 'Server Error' },
      );
    harness.detectChanges();

    const raiz = harness.routeNativeElement;
    const texto = raiz?.textContent ?? '';
    // La historia sigue: un fallo de forms no se lleva puestas las atenciones.
    expect(texto).toContain('Dolor de garganta');
    expect(raiz?.querySelector('[data-testid="historia-formularios-error"]')).not.toBeNull();
    expect(texto).toContain('Reintentar');
  });
});
