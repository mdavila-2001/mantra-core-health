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

  it('el diagnóstico se lee dentro de su atención y no como lista aparte', async () => {
    await montar();
    responder();

    const raiz = harness.routeNativeElement;
    const atenciones = raiz?.querySelector('[data-testid="historia-atenciones"]');
    const texto = atenciones?.textContent ?? '';
    expect(texto).toContain('Dolor de garganta');
    // El diagnóstico es el contexto de esa consulta, no un registro suelto.
    expect(texto).toContain('Faringitis aguda');
    expect(texto).not.toContain('con-faringitis');
    // Y la lista suelta no existe: ésa es la herramienta del profesional.
    expect(raiz?.querySelector('#historia-diagnosticos')).toBeNull();
    expect(encabezados(raiz).some((titulo) => titulo.startsWith('Diagnósticos'))).toBe(false);
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

  /* ---- FT-20 · la historia por pestañas ----------------------------------- */

  /** FT-20-R01/R02/R03 · cuatro pestañas, con la primera abierta. */
  it('organiza la historia en pestañas clickeables con estado activo', async () => {
    await montar();
    responder();

    const raiz = harness.routeNativeElement;
    const tabs = [...(raiz?.querySelectorAll<HTMLButtonElement>('[role="tab"]') ?? [])];
    expect(tabs.length).toBe(4);
    expect(pestanas(raiz).map((t) => t.split(' (')[0])).toEqual([
      'Atenciones',
      'Recetas',
      'Alergias',
      'Resultados',
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

  it('con diagnósticos y formularios cargados, ninguna de las dos listas se dibuja', async () => {
    await montar();
    // `RESUMEN` trae una condición y `FORMULARIOS` una instancia respondida:
    // hay datos para ambas listas, y aun así ninguna se pinta.
    responder();

    const raiz = harness.routeNativeElement;
    // Desde FT-20 las secciones son pestañas: el nombre de cada una vive en su
    // pestaña, y sólo el panel abierto tiene su encabezado en el DOM.
    const titulos = [...encabezados(raiz), ...pestanas(raiz)];
    // Lo que el paciente viene a buscar sigue en pie…
    expect(titulos.some((titulo) => titulo.startsWith('Atenciones'))).toBe(true);
    expect(titulos.some((titulo) => titulo.startsWith('Recetas'))).toBe(true);
    // …y las dos listas sueltas no están, ni por encabezado ni por contenido.
    expect(titulos.some((titulo) => titulo.startsWith('Diagnósticos'))).toBe(false);
    expect(titulos).not.toContain('Formularios clínicos');
    expect(raiz?.querySelector('#historia-diagnosticos')).toBeNull();
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

  it('una historia con sólo condiciones se declara vacía', async () => {
    await montar();
    // Las condiciones no se listan por su cuenta: sin atenciones, recetas,
    // alergias ni resultados no queda una sola fila que mirar, y decir que hay
    // algo registrado sería mandar a buscar lo que no se ve.
    http
      .expectOne((r) => r.url === '/clinical/patients/pp-1/summary')
      .flush({ ...RESUMEN, medicationRequests: [], encounters: [] });
    http.expectOne((r) => r.url === '/terminology/concepts').flush(CONCEPTOS);
    responderFormularios(SIN_FORMULARIOS);
    harness.detectChanges();

    const texto = harness.routeNativeElement?.textContent ?? '';
    expect(texto).toContain('Todavía no hay atenciones');
    // El vacío llega con su salida, no como una pantalla en blanco.
    expect(texto).toContain('Pedir un turno');
    expect(texto).not.toContain('Faringitis aguda');
  });
});
