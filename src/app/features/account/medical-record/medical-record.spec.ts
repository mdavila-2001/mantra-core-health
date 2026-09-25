import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../core/auth/session.store';
import { FileDownloader } from '../../../core/data-access/files/file-downloader';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
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
 * 5. **Ni los diagnósticos ni los formularios se listan sueltos** (F-42): el
 *    diagnóstico se lee dentro de la atención que lo registró, y los
 *    formularios se siguen leyendo porque los llevan los documentos.
 */

/** Los encabezados de sección, con los espacios normalizados. */
function encabezados(raiz: HTMLElement | null | undefined): readonly string[] {
  return [...(raiz?.querySelectorAll('h2') ?? [])].map((titulo) =>
    (titulo.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

/** Los rótulos de las pestañas de la historia (FT-20). */
function pestanas(raiz: HTMLElement | null | undefined): readonly string[] {
  return [...(raiz?.querySelectorAll('[role="tab"]') ?? [])].map((tab) =>
    (tab.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

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

/* ---- C6 · lo que la línea del encuentro necesita -------------------------- */

/**
 * El expediente: una nota liberada al paciente y otra que **no** lo está.
 *
 * La segunda existe a propósito: `releasedToPatient` es la decisión del
 * profesional sobre si esa nota se comparte, y la pantalla no puede ser la que
 * la muestre.
 */
const EXPEDIENTE = {
  patientProfileId: 'pp-1',
  notes: [
    {
      noteId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeea1b2',
      encounterId: 'e-1',
      lifecycleStatusConceptId: 'st-activa',
      chiefComplaintText: 'Odinofagia de tres días',
      planText: 'Reposo e hidratación',
      releasedToPatient: true,
      signedAt: '2026-03-01T10:20:00.000Z',
      createdAt: '2026-03-01T10:15:00.000Z',
    },
    {
      noteId: 'ffffffff-bbbb-4ccc-8ddd-eeeeeeee9999',
      encounterId: 'e-1',
      lifecycleStatusConceptId: 'st-activa',
      chiefComplaintText: 'BORRADOR INTERNO',
      releasedToPatient: false,
      createdAt: '2026-03-01T10:16:00.000Z',
    },
  ],
  carePlans: [],
  documents: [],
  limit: 50,
  truncated: [],
};

/** Las órdenes propias: un hemograma de esa misma atención. */
const ORDENES = {
  patientProfileId: 'pp-1',
  items: [
    {
      id: 'o-1',
      encounterId: 'e-1',
      codeConceptId: 'lab-hemograma',
      categoryConceptId: 'cat-lab',
      statusConceptId: 'st-cumplida',
      hasReleasedResult: true,
      createdAt: '2026-03-01T10:25:00.000Z',
    },
  ],
  limit: 50,
  truncated: false,
};

/** Los conceptos que sólo traen las órdenes: la segunda lectura del catálogo. */
const CONCEPTOS_DE_ORDENES = {
  items: [
    {
      conceptId: 'lab-hemograma',
      code: 'HEM',
      display: 'Hemograma',
      codeSystemVersionId: 'v1',
    },
    {
      conceptId: 'cat-lab',
      code: 'LAB',
      display: 'Análisis de laboratorio',
      codeSystemVersionId: 'v1',
    },
    { conceptId: 'st-cumplida', code: 'DONE', display: 'Cumplida', codeSystemVersionId: 'v1' },
    // C8: el estado de la reconsulta también es un concepto, y viaja en la
    // misma lectura del catálogo que los de las órdenes.
    {
      conceptId: 'st-confirmada',
      code: 'BK_CONFIRMED',
      display: 'Confirmada',
      codeSystemVersionId: 'v1',
    },
  ],
  count: 4,
  limit: 200,
};

/**
 * Las citas del titular: una reconsulta que salió de la atención `e-1` (C4).
 *
 * Los identificadores son cortos a propósito — ninguno se dibuja, y un uuid de
 * adorno haría pasar por casualidad la prueba que comprueba que no sale ninguno.
 */
const CITAS = {
  items: [
    {
      id: 'b-9',
      statusConceptId: 'st-confirmada',
      startAt: '2026-03-15T14:30:00.000Z',
      endAt: '2026-03-15T15:00:00.000Z',
      followUpOf: { bookingId: 'b-1', encounterId: 'e-1', startAt: '2026-03-01T10:00:00.000Z' },
      createdAt: '2026-03-01T11:30:00.000Z',
    },
  ],
  count: 1,
  limit: 50,
  truncated: false,
};

/**
 * Tres diagnósticos, uno por bloque, con los códigos **reales** del catálogo.
 *
 * `dx-refutada` es el kill-test de C6: un diagnóstico que el profesional
 * descartó no puede aparecer nunca entre las enfermedades activas.
 */
const RESUMEN_CON_TRES_DIAGNOSTICOS = {
  ...RESUMEN,
  conditions: [
    {
      id: 'dx-activa',
      codeConceptId: 'con-hipertension',
      clinicalStatusConceptId: 'st-cond-activa',
      verificationStatusConceptId: 'st-confirmado',
      expectedResolutionAt: '2026-11-24T00:00:00.000Z',
      encounterId: 'e-1',
      onsetAt: '2024-01-10T00:00:00.000Z',
      createdAt: '2024-01-10T00:00:00.000Z',
    },
    {
      id: 'dx-en-estudio',
      codeConceptId: 'con-dislipidemia',
      clinicalStatusConceptId: 'st-cond-activa',
      verificationStatusConceptId: 'st-provisional',
      encounterId: 'e-1',
      createdAt: '2026-02-01T00:00:00.000Z',
    },
    {
      id: 'dx-refutada',
      codeConceptId: 'con-faringitis',
      // Activa en lo clínico y **descartada** en la certeza: si el bloque se
      // decidiera por el estado clínico, ésta caería entre las activas.
      clinicalStatusConceptId: 'st-cond-activa',
      verificationStatusConceptId: 'st-descartado',
      encounterId: 'e-1',
      createdAt: '2026-02-05T00:00:00.000Z',
    },
  ],
};

/** El catálogo de esos tres diagnósticos, con los códigos publicados. */
const CONCEPTOS_DE_DIAGNOSTICOS = {
  items: [
    {
      conceptId: 'con-hipertension',
      code: 'I10',
      display: 'Hipertensión',
      codeSystemVersionId: 'v1',
    },
    {
      conceptId: 'con-dislipidemia',
      code: 'E78.5',
      display: 'Dislipidemia',
      codeSystemVersionId: 'v1',
    },
    {
      conceptId: 'con-faringitis',
      code: 'J02',
      display: 'Faringitis aguda',
      codeSystemVersionId: 'v1',
    },
    {
      conceptId: 'st-cond-activa',
      code: 'COND-ACTIVE',
      display: 'Activa',
      codeSystemVersionId: 'v1',
    },
    {
      conceptId: 'st-confirmado',
      code: 'DXV-CONFIRMED',
      display: 'Confirmado',
      codeSystemVersionId: 'v1',
    },
    {
      conceptId: 'st-provisional',
      code: 'DXV-PROVISIONAL',
      display: 'Provisional',
      codeSystemVersionId: 'v1',
    },
    {
      conceptId: 'st-descartado',
      code: 'DXV-REFUTED',
      display: 'Descartado',
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
  count: 9,
  limit: 200,
};

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

  /** Espía de los toasts (B.3): esta pantalla no monta el contenedor real. */
  const toasts = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    toasts.success.mockClear();
    toasts.error.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'my-account/medical-record', component: MedicalRecord }]),
        { provide: ToastService, useValue: toasts },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /**
   * Se resuelve cuando `FileDownloader.trigger` se llama de verdad, con el
   * nombre del archivo ofrecido (B.3). Hace falta porque el contenido pasa
   * por `FileReader` (`blobToDataUrl`), que no es una tarea de la zona de
   * Angular: `whenStable()`/`detectChanges()` vuelven antes de que termine.
   * Mismo patrón que `verification-cases.spec.ts`.
   */
  function nombreDescargado(): Promise<{ dataUrl: string; fileName: string }> {
    return new Promise((resolve) => {
      TestBed.inject(FileDownloader).trigger = (dataUrl: string, fileName: string) => {
        resolve({ dataUrl, fileName });
      };
    });
  }

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

  /**
   * Abre una de las pestañas de la historia (FT-20).
   *
   * `await` de la navegación y no sólo `detectChanges`: la pestaña abierta vive
   * en la URL, así que el cambio pasa por el router y no está aplicado cuando
   * el clic vuelve.
   */
  async function abrirPestana(indice: number): Promise<void> {
    harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[indice].click();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  /**
   * Despliega una atención del acordeón (C6).
   *
   * Hace falta en casi toda prueba de «Atenciones» porque el contenido plegado
   * **no está en el DOM**: es lo que hace que una historia de cuarenta consultas
   * no dibuje cuarenta líneas para mostrar una.
   */
  function desplegarAtencion(indice = 0): void {
    const triggers = harness.routeNativeElement?.querySelectorAll<HTMLButtonElement>(
      '.accordion-panel__trigger',
    );
    triggers?.[indice]?.click();
    harness.detectChanges();
  }

  /**
   * Resuelve las tres lecturas perezosas de la línea: expediente, órdenes y
   * citas. La tercera la agregó C8: es de donde sale la reconsulta.
   */
  function responderDetalle(
    expediente: object = EXPEDIENTE,
    ordenes: object = ORDENES,
    conceptos: object | null = CONCEPTOS_DE_ORDENES,
    citas: object = CITAS,
  ): void {
    http.expectOne((r) => r.url === '/charts/patients/pp-1/chart').flush(expediente);
    http.expectOne((r) => r.url === '/diagnostic-results/me/orders').flush(ordenes);
    http.expectOne((r) => r.url === '/scheduling/bookings').flush(citas);
    if (conceptos !== null) {
      http.expectOne((r) => r.url === '/terminology/concepts').flush(conceptos);
    }
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
    // de paciente: el servidor lo toma de la sesión. La lectura sale aunque la
    // pantalla no los liste: es lo que los documentos incorporan.
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

  /**
   * C6 · cambió el requisito, no la aserción de fondo.
   *
   * Hasta C6 esta prueba fijaba además que **no** hubiera una lista suelta de
   * diagnósticos (F-42). El carril C6 pide exactamente esa lista, en su propia
   * pestaña, así que aquellas dos cláusulas se trasladaron a las pruebas de la
   * pestaña «Diagnósticos» de más abajo: no se borraron, cambiaron de sitio
   * porque cambió lo que el producto tiene que hacer. Lo que esta prueba sigue
   * fijando —y era lo que importaba— es que el diagnóstico **también** se lea
   * dentro de la consulta que lo registró y que nunca salga como uuid.
   */
  it('el diagnóstico se lee dentro de la atención que lo registró', async () => {
    await montar();
    responder();
    desplegarAtencion();
    responderDetalle();

    const raiz = harness.routeNativeElement;
    const atenciones = raiz?.querySelector('[data-testid="historia-atenciones"]');
    const texto = atenciones?.textContent ?? '';
    expect(texto).toContain('Dolor de garganta');
    // El diagnóstico es el contexto de esa consulta, no un registro suelto.
    expect(texto).toContain('Faringitis aguda');
    expect(texto).not.toContain('con-faringitis');
    // Y se lee dentro de la línea del encuentro, no como un renglón más.
    expect(raiz?.querySelector('[data-testid="historia-linea-encuentro"]')).not.toBeNull();
  });

  it('muestra la receta traducida y su indicación', async () => {
    await montar();
    responder();
    // Desde FT-20 las recetas viven en su pestaña: sólo el panel abierto se
    // dibuja, que es lo que hace que una historia larga no cargue las cuatro
    // listas para mostrar una.
    await abrirPestana(1);

    const texto = harness.routeNativeElement?.textContent ?? '';
    expect(texto).toContain('Amoxicilina');
    expect(texto).toContain('500 mg · cada 8 horas');
  });

  it('cada atención y cada receta ofrecen su descarga (corrección #16)', async () => {
    await montar();
    responder();

    const raiz = harness.routeNativeElement;
    // La descarga de una atención vive dentro de su panel: plegado no existe.
    desplegarAtencion();
    responderDetalle();
    expect(raiz?.querySelector('[data-testid="historia-descargar-atencion"]')).not.toBeNull();

    await abrirPestana(1);
    expect(raiz?.querySelector('[data-testid="historia-descargar-receta"]')).not.toBeNull();
  });

  /* ---- B.3 · el PDF oficial de la receta, desde la API ------------------- */

  it('descargar la receta pide el PDF oficial a la API y dispara la descarga', async () => {
    await montar();
    responder();
    await abrirPestana(1);

    const boton = harness.routeNativeElement?.querySelector<HTMLButtonElement>(
      '[data-testid="historia-descargar-receta"]',
    );
    boton?.click();
    harness.detectChanges();

    const descargado = nombreDescargado();

    const req = http.expectOne((r) => r.url === '/clinical/prescriptions/m-1/pdf');
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('blob');

    req.flush(new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: 'application/pdf' }), {
      headers: { 'Content-Disposition': "attachment; filename*=UTF-8''receta-m-1.pdf" },
    });

    const { dataUrl, fileName } = await descargado;
    harness.detectChanges();

    expect(dataUrl).toMatch(/^data:application\/pdf;base64,/);
    expect(fileName).toBe('receta-m-1.pdf');
    expect(toasts.success).toHaveBeenCalledWith('Descarga iniciada exitosamente', 'Receta oficial');
  });

  it('si la API falla, avisa el error y el botón vuelve a estar disponible', async () => {
    await montar();
    responder();
    await abrirPestana(1);

    const boton = harness.routeNativeElement?.querySelector<HTMLButtonElement>(
      '[data-testid="historia-descargar-receta"]',
    );
    boton?.click();
    harness.detectChanges();

    http
      .expectOne((r) => r.url === '/clinical/prescriptions/m-1/pdf')
      .flush(null, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    expect(toasts.error).toHaveBeenCalledWith(
      'No pudimos descargar la receta oficial. Reintentá en un momento.',
      'Receta oficial',
    );
    expect(toasts.success).not.toHaveBeenCalled();
    // El botón no queda trabado: una segunda descarga sí sale a la red.
    boton?.click();
    harness.detectChanges();
    http.expectOne((r) => r.url === '/clinical/prescriptions/m-1/pdf').flush(new Blob([]));
  });

  it('una segunda descarga no sale mientras la primera está en vuelo', async () => {
    await montar();
    responder();
    await abrirPestana(1);

    const boton = harness.routeNativeElement?.querySelector<HTMLButtonElement>(
      '[data-testid="historia-descargar-receta"]',
    );
    boton?.click();
    boton?.click();
    harness.detectChanges();

    // Sólo una petición en vuelo: `http.expectOne` revienta si hubiera dos.
    http.expectOne((r) => r.url === '/clinical/prescriptions/m-1/pdf').flush(new Blob([]));
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

    // La atención sigue: perder la traducción no justifica perder la historia.
    expect(harness.routeNativeElement?.textContent).toContain('Dolor de garganta');

    // Y lo que no se pudo traducir sale como ausencia, nunca como uuid. Se
    // mira en la pestaña de recetas, que es donde vive `med-amoxi`.
    await abrirPestana(1);
    const texto = harness.routeNativeElement?.textContent ?? '';
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
    // C6 · sin órdenes no hay conceptos nuevos que traducir: la lectura ni sale.
    http.expectNone((r) => r.url === '/terminology/concepts');
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
    http.expectNone((r) => r.url === '/terminology/concepts');
    harness.detectChanges();

    expect(harness.routeNativeElement?.textContent).not.toContain('No pudimos armar');
  });

  /* ---- FT-20 · la historia por pestañas ----------------------------------- */

  /** FT-20-R01/R02/R03 + C6 · cinco pestañas, con la primera abierta. */
  it('organiza la historia en pestañas clickeables con estado activo', async () => {
    await montar();
    responder();

    const raiz = harness.routeNativeElement;
    const tabs = [...(raiz?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])];
    expect(tabs.length).toBe(5);
    expect(pestanas(raiz).map((t) => t.split(' (')[0])).toEqual([
      'Atenciones',
      'Recetas',
      'Alergias',
      'Resultados',
      // C6 · al final para no mover los enlaces `?seccion=` que ya circulan.
      'Diagnósticos',
    ]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  /** FT-20-R04 · cada pestaña muestra lo suyo y sólo lo suyo. */
  it('cambiar de pestaña cambia el contenido', async () => {
    await montar();
    responder();

    const raiz = harness.routeNativeElement;
    expect(raiz?.querySelector('[data-testid="historia-atenciones"]')).not.toBeNull();
    expect(raiz?.querySelector('[data-testid="historia-recetas"]')).toBeNull();

    await abrirPestana(1);

    expect(raiz?.querySelector('[data-testid="historia-recetas"]')).not.toBeNull();
    expect(raiz?.querySelector('[data-testid="historia-atenciones"]')).toBeNull();
  });

  /**
   * FT-20-R05 · el enlace apunta a la sección que se estaba leyendo. Es lo que
   * permite mandar «mirá mis resultados» como enlace y no como instrucción.
   */
  it('la pestaña abierta se puede enlazar', async () => {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], pid: 'pp-1' }),
      refreshToken: 'r-1',
    });
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/my-account/medical-record?seccion=recetas', MedicalRecord);
    responder();

    const raiz = harness.routeNativeElement;
    expect(
      raiz?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[1].getAttribute('aria-selected'),
    ).toBe('true');
    expect(raiz?.querySelector('[data-testid="historia-recetas"]')).not.toBeNull();
  });

  /**
   * FT-20-R06/R07 · «Descargar todo» no vive dentro de ninguna pestaña: se
   * alcanza desde cualquiera de las cuatro.
   */
  it('la descarga completa se ve desde cualquier pestaña', async () => {
    await montar();
    responder();

    const raiz = harness.routeNativeElement;
    expect(raiz?.querySelector('[data-testid="historia-descargar-todo"]')).not.toBeNull();

    await abrirPestana(3);

    expect(raiz?.querySelector('[data-testid="historia-descargar-todo"]')).not.toBeNull();
  });

  /* ---- las dos listas que dejaron de mostrarse (F-42) --------------------- */

  /**
   * C6 · la mitad de F-42 sigue en pie y la otra mitad cambió por requisito.
   *
   * **Sigue:** los formularios clínicos no se listan — se leen porque los
   * llevan los documentos, no porque haya una lista— y el valor que el backend
   * enmascaró no llega a la pantalla por ningún lado.
   *
   * **Cambió:** los diagnósticos ahora tienen su propia pestaña, que es lo que
   * el carril C6 pide. Aquella aserción no se debilitó: se invirtió, porque el
   * producto invirtió su requisito, y su contrato nuevo lo fijan las pruebas de
   * la pestaña «Diagnósticos».
   */
  it('los formularios siguen sin listarse, y los diagnósticos ya tienen su pestaña', async () => {
    await montar();
    responder();

    const raiz = harness.routeNativeElement;
    // Desde FT-20 las secciones son pestañas: el nombre de cada una vive en su
    // pestaña, y sólo el panel abierto tiene su encabezado en el DOM.
    const titulos = [...encabezados(raiz), ...pestanas(raiz)];
    // Lo que el paciente viene a buscar sigue en pie…
    expect(titulos.some((titulo) => titulo.startsWith('Atenciones'))).toBe(true);
    expect(titulos.some((titulo) => titulo.startsWith('Recetas'))).toBe(true);
    // …los diagnósticos ya son una pestaña (C6)…
    expect(titulos.some((titulo) => titulo.startsWith('Diagnósticos'))).toBe(true);
    // …y la lista de formularios sigue sin existir.
    expect(titulos).not.toContain('Formularios clínicos');
    expect(raiz?.querySelector('[data-testid="historia-formularios"]')).toBeNull();

    const texto = raiz?.textContent ?? '';
    expect(texto).not.toContain('Tolerancia al ejercicio');
    // El valor que el backend enmascaró no llega a la pantalla por ningún lado.
    expect(texto).not.toContain('SECRETO');
  });

  it('si la lectura de formularios falla, la historia se muestra igual', async () => {
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
    // Son dos estados separados: un fallo de formularios no se lleva puestas
    // las atenciones.
    expect(texto).toContain('Dolor de garganta');
    // Y como la pantalla ya no los lista, no hay aviso que dar: lo que se
    // degrada es el bloque de formularios de los documentos.
    expect(raiz?.querySelector('[data-testid="historia-formularios-error"]')).toBeNull();
    expect(texto).not.toContain('Reintentar');
  });

  /**
   * C6 · una historia con sólo diagnósticos **ya no está vacía**.
   *
   * Antes lo estaba, y con razón: las condiciones no se listaban por su cuenta,
   * así que un archivo que sólo las tuviera no dibujaba ni una fila. Desde que
   * existe la pestaña «Diagnósticos» sí hay tres bloques que leer, y decirle a
   * esa persona que su historia está vacía sería falso.
   */
  it('una historia con sólo diagnósticos ya no se declara vacía', async () => {
    await montar();
    http
      .expectOne((r) => r.url === '/clinical/patients/pp-1/summary')
      .flush({ ...RESUMEN, medicationRequests: [], encounters: [] });
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    responderFormularios(SIN_FORMULARIOS);
    harness.detectChanges();

    const texto = harness.routeNativeElement?.textContent ?? '';
    expect(texto).not.toContain('Todavía no hay atenciones');
    expect(texto).toContain('Diagnósticos (1)');

    // Y el diagnóstico se lee en su pestaña, en palabras y sin uuid.
    await abrirPestana(4);
    const conDiagnosticos = harness.routeNativeElement?.textContent ?? '';
    expect(conDiagnosticos).toContain('Faringitis aguda');
    expect(conDiagnosticos).not.toContain('con-faringitis');
  });

  /* ---- C6 · la pestaña «Diagnósticos» ------------------------------------ */

  /** Abre la pestaña «Diagnósticos» con los tres casos del catálogo cargados. */
  async function abrirDiagnosticos(): Promise<void> {
    await montar();
    responder(RESUMEN_CON_TRES_DIAGNOSTICOS, CONCEPTOS_DE_DIAGNOSTICOS);
    await abrirPestana(4);
  }

  /** El texto de un bloque, con los espacios normalizados. */
  function bloque(testId: string): string {
    const nodo = harness.routeNativeElement?.querySelector(`[data-testid="${testId}"]`);
    return (nodo?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  it('reparte los diagnósticos en los tres bloques, por código de catálogo', async () => {
    await abrirDiagnosticos();

    expect(bloque('historia-en-estudio')).toContain('Dislipidemia');
    expect(bloque('historia-activas')).toContain('Hipertensión');
    expect(bloque('historia-historicos')).toContain('Faringitis aguda');
  });

  /**
   * **El kill-test del carril.** Si un diagnóstico rechazado apareciera como
   * enfermedad activa, la historia estaría afirmando que la persona tiene algo
   * que su médico descartó. Es activo en lo clínico (`COND-ACTIVE`) y descartado
   * en la certeza (`DXV-REFUTED`): la certeza manda.
   */
  it('un diagnóstico descartado NUNCA aparece como enfermedad activa', async () => {
    await abrirDiagnosticos();

    expect(bloque('historia-activas')).not.toContain('Faringitis aguda');
    expect(bloque('historia-en-estudio')).not.toContain('Faringitis aguda');
    expect(bloque('historia-historicos')).toContain('Faringitis aguda');
    // Y dice por qué es histórico, con la etiqueta del catálogo.
    expect(bloque('historia-historicos')).toContain('Descartado');
  });

  it('una enfermedad activa dice hasta cuándo', async () => {
    await abrirDiagnosticos();

    expect(bloque('historia-activas')).toContain('hasta el 24/11/2026');
  });

  it('un diagnóstico crónico dice «crónica» en vez de una fecha', async () => {
    await montar();
    responder(
      {
        ...RESUMEN_CON_TRES_DIAGNOSTICOS,
        conditions: [
          {
            ...RESUMEN_CON_TRES_DIAGNOSTICOS.conditions[0],
            clinicalCourseConceptId: 'st-cronica',
            expectedResolutionAt: undefined,
          },
        ],
      },
      {
        ...CONCEPTOS_DE_DIAGNOSTICOS,
        items: [
          ...CONCEPTOS_DE_DIAGNOSTICOS.items,
          {
            conceptId: 'st-cronica',
            code: 'COND_COURSE_CHRONIC',
            display: 'Crónica',
            codeSystemVersionId: 'v1',
          },
        ],
      },
    );
    await abrirPestana(4);

    expect(bloque('historia-activas')).toContain('crónica');
    expect(bloque('historia-activas')).not.toContain('hasta el');
  });

  it('los tres bloques existen aunque estén vacíos, y cada vacío orienta', async () => {
    await montar();
    responder({ ...RESUMEN_CON_TRES_DIAGNOSTICOS, conditions: [] }, CONCEPTOS_DE_DIAGNOSTICOS);
    await abrirPestana(4);

    // Sin ni un diagnóstico, la pestaña lo dice con su orientación (S3).
    const texto = harness.routeNativeElement?.textContent ?? '';
    expect(texto).toContain('Todavía no tenés diagnósticos registrados');
  });

  it('ningún uuid llega al HTML de la pestaña de diagnósticos', async () => {
    await abrirDiagnosticos();

    expect(harness.routeNativeElement?.innerHTML ?? '').not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  /* ---- C6 · la línea del encuentro --------------------------------------- */

  it('al abrir la pantalla NO pide el expediente ni las órdenes', async () => {
    await montar();
    responder();

    // Son dos lecturas que sólo sirven cuando alguien quiere ver qué pasó en
    // una consulta. Cobrárselas a todos para que el acordeón esté listo por si
    // acaso es exactamente lo que el carril prohíbe.
    http.expectNone((r) => r.url === '/charts/patients/pp-1/chart');
    http.expectNone((r) => r.url === '/diagnostic-results/me/orders');
    http.expectNone((r) => r.url === '/scheduling/bookings');
  });

  it('el primer despliegue pide las tres lecturas, y el segundo ninguna', async () => {
    await montar();
    responder();

    desplegarAtencion();
    responderDetalle();

    // Plegar y volver a desplegar no vuelve a salir a la red: `expectNone`
    // revienta si hubiera una segunda lectura.
    desplegarAtencion();
    desplegarAtencion();
    http.expectNone((r) => r.url === '/charts/patients/pp-1/chart');
    http.expectNone((r) => r.url === '/diagnostic-results/me/orders');
    http.expectNone((r) => r.url === '/scheduling/bookings');
  });

  it('la línea cuenta la consulta: nota, estudio, diagnóstico y receta', async () => {
    await montar();
    responder();
    desplegarAtencion();
    responderDetalle();

    const linea = harness.routeNativeElement?.querySelector(
      '[data-testid="historia-linea-encuentro"]',
    );
    const texto = (linea?.textContent ?? '').replace(/\s+/g, ' ').trim();
    expect(texto).toContain('Nota #a1b2');
    expect(texto).toContain('Análisis de laboratorio: Hemograma — resultado disponible');
    expect(texto).toContain('Faringitis aguda');
  });

  /* ---- C8 · la reconsulta de C4 dentro de la línea de C6 ----------------- */

  it('la reconsulta que salió de esa atención se nombra en su línea', async () => {
    await montar();
    responder();
    desplegarAtencion();
    responderDetalle();

    const linea = harness.routeNativeElement?.querySelector(
      '[data-testid="historia-linea-encuentro"]',
    );
    const texto = (linea?.textContent ?? '').replace(/\s+/g, ' ').trim();
    // La frase la arma el organismo con la fecha de la cita nueva, no con la
    // de la atención de la que salió.
    expect(texto).toContain('Reconsulta el 15/03');
    // Y su estado sale del catálogo: sin la traducción sería un uuid o un
    // «Sin registrar», y los dos sobran en la historia de una persona.
    expect(texto).toContain('Confirmada');
  });

  it('una reconsulta de otra atención no se cuela en esta línea', async () => {
    await montar();
    responder();
    desplegarAtencion();
    // Mismo paciente, misma cita, pero derivada de un encuentro que no es el
    // que se está mirando: el vínculo es por `followUpOf.encounterId`, y una
    // reconsulta atribuida a la consulta equivocada es un dato clínico falso.
    responderDetalle(EXPEDIENTE, ORDENES, CONCEPTOS_DE_ORDENES, {
      ...CITAS,
      items: [
        {
          ...CITAS.items[0],
          followUpOf: { bookingId: 'b-1', encounterId: 'e-otro', startAt: null },
        },
      ],
    });

    const linea = harness.routeNativeElement?.querySelector(
      '[data-testid="historia-linea-encuentro"]',
    );
    expect(linea?.textContent ?? '').not.toContain('Reconsulta');
  });

  it('una cita que no es reconsulta no agrega nada a la línea', async () => {
    await montar();
    responder();
    desplegarAtencion();
    // Sin `followUpOf` es una cita corriente. Se pregunta por el origen y no
    // por el tipo de cita: una cita sin origen no es una reconsulta por más
    // que el catálogo la clasifique así.
    responderDetalle(EXPEDIENTE, ORDENES, CONCEPTOS_DE_ORDENES, {
      ...CITAS,
      items: [{ id: 'b-8', statusConceptId: 'st-confirmada', createdAt: '2026-03-01T09:00:00.000Z' }],
    });

    const linea = harness.routeNativeElement?.querySelector(
      '[data-testid="historia-linea-encuentro"]',
    );
    expect(linea?.textContent ?? '').not.toContain('Reconsulta');
    // Y lo demás sigue en pie: perder la reconsulta no puede costar la nota.
    expect(linea?.textContent ?? '').toContain('Nota #a1b2');
  });

  it('si las citas no se pueden leer, la línea se dibuja sin la reconsulta', async () => {
    await montar();
    responder();
    desplegarAtencion();

    http.expectOne((r) => r.url === '/charts/patients/pp-1/chart').flush(EXPEDIENTE);
    http.expectOne((r) => r.url === '/diagnostic-results/me/orders').flush(ORDENES);
    http
      .expectOne((r) => r.url === '/scheduling/bookings')
      .flush(
        { code: 'ERROR', message: 'Agenda caída', timestamp: '', path: '' },
        { status: 500, statusText: 'Server Error' },
      );
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS_DE_ORDENES);
    harness.detectChanges();

    const linea = harness.routeNativeElement?.querySelector(
      '[data-testid="historia-linea-encuentro"]',
    );
    // La atención no se pierde por una lectura secundaria: se pierde el hecho
    // que esa lectura aportaba, y nada más.
    expect(linea?.textContent ?? '').toContain('Nota #a1b2');
    expect(linea?.textContent ?? '').not.toContain('Reconsulta');
  });

  it('una nota no liberada al paciente no se dibuja', async () => {
    await montar();
    responder();
    desplegarAtencion();
    responderDetalle();

    // `releasedToPatient: false` es la decisión del profesional sobre si esa
    // nota se comparte: aunque el servidor la mandara, la pantalla no la pinta.
    expect(harness.routeNativeElement?.textContent).not.toContain('BORRADOR INTERNO');
  });

  it('si el expediente falla, la atención se muestra igual y lo declara', async () => {
    await montar();
    responder();
    desplegarAtencion();

    // Las órdenes primero: las dos lecturas van en un `forkJoin`, y el fallo de
    // una cancela a la hermana. Al revés, `flush` reventaría con «Cannot flush a
    // cancelled request» — que es un detalle del harness, no del producto.
    http.expectOne((r) => r.url === '/diagnostic-results/me/orders').flush(ORDENES);
    http.expectOne((r) => r.url === '/scheduling/bookings').flush(CITAS);
    http
      .expectOne((r) => r.url === '/charts/patients/pp-1/chart')
      .flush(
        { code: 'ERROR', message: 'Chart caído', timestamp: '', path: '' },
        { status: 500, statusText: 'Server Error' },
      );
    harness.detectChanges();

    const texto = harness.routeNativeElement?.textContent ?? '';
    // El diagnóstico del resumen sigue en la línea…
    expect(texto).toContain('Faringitis aguda');
    // …y la pérdida se declara en vez de callarse.
    expect(texto).toContain('Falta parte del detalle');
  });

  it('ningún uuid llega al HTML con la línea desplegada', async () => {
    await montar();
    responder();
    desplegarAtencion();
    responderDetalle();

    expect(harness.routeNativeElement?.innerHTML ?? '').not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });
});
