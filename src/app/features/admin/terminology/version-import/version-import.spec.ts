import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FileDownloader } from '../../../../core/data-access/files/file-downloader';
import { CsvExportService } from '../../../../shared/utils/csv-export/csv-export';
import { VersionImport } from './version-import';

/**
 * La carga masiva de terminología, de punta a punta contra el doble del cliente.
 *
 * Lo que estas pruebas fijan, en orden de importancia:
 *
 * 1. **No se importa sin validar antes** (Q-8). «Importar» se habilita sólo
 *    tras una validación con 0 errores, y cualquier cosa que invalide esa
 *    validación —cambiar el archivo, la versión o el perfil— lo vuelve a
 *    deshabilitar.
 * 2. **Ante un fallo no se pierde nada.** Un corte de red, un 413 o un 422 no
 *    borran el archivo elegido ni las tres selecciones: quien cargó un archivo
 *    de 8 MB no tiene que volver a buscarlo en el disco.
 * 3. **Sólo se ofrecen versiones que admiten conceptos** —una publicada da 422
 *    al enviar, y descubrirlo ahí es tarde— y **publicar es un paso propio**:
 *    sin él los conceptos importados son invisibles a toda expansión y **no da
 *    error**, que es el modo de fallo más callado del catálogo.
 *
 * > **Nota de mantenimiento (2026-09-25).** Las cinco pruebas originales siguen
 * > acá. Dos cambiaron de forma porque cambió el contrato, no porque molestaran:
 * > «manda el archivo directo al importador» ahora recorre las **dos** llamadas
 * > —validar y después importar—, que es una aserción más fuerte que la
 * > anterior; y la que leía la señal `resultado` lee `informe` y `resumen`, que
 * > son los dos estados en que se partió. Ninguna aserción se debilitó.
 */
const SISTEMAS = [
  {
    id: 'cs-1',
    internalCode: 'icd10cm',
    name: 'CIE-10-CM',
    canonicalUrl: 'http://hl7.org/fhir/sid/icd-10-cm',
  },
];

const VERSIONES = [
  {
    id: 'v-borrador',
    version: '2026',
    state: 'DRAFT',
    isDefault: false,
    publishedAt: null,
    acceptsConcepts: true,
  },
  {
    id: 'v-publicada',
    version: '2025',
    state: 'ACTIVE',
    isDefault: true,
    publishedAt: '2025-01-01T00:00:00.000Z',
    acceptsConcepts: false,
  },
  {
    // El caso real de los importadores externos: sin estado, y admite conceptos.
    id: 'v-sin-estado',
    version: '2024',
    state: 'UNKNOWN',
    isDefault: false,
    publishedAt: null,
    acceptsConcepts: true,
  },
];

const IMPORT_URL = '/terminology/versions/v-borrador/import-file';

/** El informe de un dry-run sin problemas, con la vista previa del servidor. */
const VALIDACION_OK = {
  batchId: null,
  format: 'csv',
  profile: 'conceptos',
  dryRun: true,
  aborted: false,
  totalRead: 50,
  inserted: 0,
  skipped: 0,
  errors: 0,
  errorSamples: [],
  preview: [
    { line: 2, code: 'ZZ-001', display: 'Concepto sintético ZZ-001', definition: 'Ejemplo.' },
    { line: 3, code: 'ZZ-002', display: 'Concepto sintético ZZ-002' },
  ],
};

/** Los 5 problemas de `con-errores` (§4 del contrato), con su columna. */
const VALIDACION_CON_ERRORES = {
  batchId: null,
  format: 'xlsx',
  profile: 'conceptos',
  dryRun: true,
  aborted: true,
  totalRead: 50,
  inserted: 0,
  skipped: 0,
  errors: 5,
  errorSamples: [
    { line: 5, column: 'display', message: 'está vacía' },
    { line: 9, column: 'code', message: 'está vacía' },
    { line: 14, column: 'code', message: 'supera los 255 caracteres' },
    { line: 20, column: 'code', message: 'ZZ-003 ya aparece antes en el archivo' },
    { line: 33, column: 'display', message: 'supera los 255 caracteres' },
  ],
  preview: [],
};

const IMPORTACION_OK = {
  batchId: 'lote-ZZ-1',
  format: 'csv',
  profile: 'conceptos',
  dryRun: false,
  aborted: false,
  totalRead: 50,
  inserted: 50,
  skipped: 0,
  errors: 0,
  errorSamples: [],
  preview: [],
};

describe('VersionImport', () => {
  let fixture: ComponentFixture<VersionImport>;
  let http: HttpTestingController;
  let csvDescargado: { filas: readonly unknown[]; nombre: string } | null;
  let descargas: { nombre: string }[];

  beforeEach(async () => {
    csvDescargado = null;
    descargas = [];

    await TestBed.configureTestingModule({
      imports: [VersionImport],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
        {
          // El servicio real crea un `<a>` y lo clickea: en jsdom eso navega.
          // El doble deja ver **qué** se bajó y con qué nombre, que es lo único
          // que esta pantalla decide.
          provide: CsvExportService,
          useValue: {
            download: (filas: readonly unknown[], _columnas: unknown, nombre: string) => {
              csvDescargado = { filas, nombre };
            },
          },
        },
        {
          provide: FileDownloader,
          useValue: { trigger: (_url: string, nombre: string) => descargas.push({ nombre }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VersionImport);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne('/terminology/code-systems').flush({ items: SISTEMAS });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  function crudo<T>(nombre: string): T {
    return (fixture.componentInstance as unknown as Record<string, unknown>)[nombre] as T;
  }

  function señal<T>(nombre: string): T {
    return crudo<() => T>(nombre).call(fixture.componentInstance);
  }

  function porTestId(testId: string): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${testId}"]`);
  }

  function texto(testId: string): string {
    return (porTestId(testId)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  /** Elige el sistema y responde sus versiones. */
  function elegirSistema(): void {
    interno<(id: string) => void>('cambiarSistema')('cs-1');
    http.expectOne('/terminology/code-systems/cs-1/versions').flush({ items: VERSIONES });
    fixture.detectChanges();
  }

  function archivo(nombre = 'ok-50.csv'): File {
    return new File(['code,display\nZZ-001,Uno\n'], nombre, { type: 'text/csv' });
  }

  /** Deja la pantalla con perfil, sistema, versión y archivo listos. */
  function prepararArchivo(nombre = 'ok-50.csv'): void {
    elegirSistema();
    interno<(id: string) => void>('cambiarVersion')('v-borrador');
    interno<(archivos: readonly File[]) => void>('cambiarArchivo')([archivo(nombre)]);
    fixture.detectChanges();
  }

  /** Valida y responde con el informe dado. */
  function validarCon(respuesta: object): void {
    interno<() => void>('validar')();
    http.expectOne(IMPORT_URL).flush(respuesta);
    fixture.detectChanges();
  }

  /* -- Paso 1 · qué se carga ------------------------------------------------ */

  it('sólo ofrece las versiones que admiten conceptos', () => {
    // Ofrecer una publicada sería preparar un 422 que se descubre al enviar.
    elegirSistema();

    const opciones = señal<readonly { value: string }[]>('opcionesDeVersion');
    expect(opciones.map((o) => o.value)).toEqual(['v-borrador', 'v-sin-estado']);
  });

  it('los catorce `data-testid` del contrato existen una sola vez cada uno', () => {
    // Marcelo escribe su E2E contra estos nombres: un renombre «para que quede
    // más claro» le rompe el spec, y un duplicado le da un locator ambiguo.
    prepararArchivo();
    validarCon(VALIDACION_CON_ERRORES);

    const presentes = [
      'carga-perfil',
      'carga-sistema',
      'carga-version',
      'carga-plantilla-csv',
      'carga-plantilla-xlsx',
      'carga-archivo',
      'carga-validar',
      'carga-importar',
      'carga-informe',
      'carga-preview',
      'carga-errores',
      'carga-descargar-errores',
    ];
    const raiz = fixture.nativeElement as HTMLElement;
    for (const testId of presentes) {
      expect(raiz.querySelectorAll(`[data-testid="${testId}"]`), testId).toHaveLength(1);
    }
  });

  it('el perfil empieza en «Conceptos» y cambiarlo limpia el resultado anterior', () => {
    prepararArchivo();
    validarCon(VALIDACION_OK);
    expect(señal<unknown>('informe')).not.toBeNull();

    interno<(p: string | null) => void>('cambiarPerfil')('designaciones');
    fixture.detectChanges();

    expect(señal<string | null>('perfil')).toBe('designaciones');
    // El informe describía un archivo leído con OTRO perfil: conservarlo
    // habilitaría «Importar» con una validación que ya no aplica.
    expect(señal<unknown>('informe')).toBeNull();
    expect(señal<boolean>('puedeImportar')).toBe(false);
  });

  it('el texto de ayuda de las columnas cambia con el perfil', () => {
    expect(señal<string>('ayudaDeColumnas')).toContain('display (obligatoria)');

    interno<(p: string | null) => void>('cambiarPerfil')('designaciones');

    expect(señal<string>('ayudaDeColumnas')).toContain('language (obligatoria)');
  });

  it('la plantilla se pide con el perfil y el formato, y se guarda con el nombre del servidor', () => {
    interno<(f: string) => void>('descargarPlantilla')('csv');

    const req = http.expectOne((r) => r.url === '/terminology/import-template');
    expect(req.request.params.get('profile')).toBe('conceptos');
    expect(req.request.params.get('format')).toBe('csv');
    req.flush(new Blob(['code,display,definition']), {
      headers: { 'Content-Disposition': 'attachment; filename="plantilla-conceptos.csv"' },
    });

    // `blobToDataUrl` usa `FileReader`, que es asíncrono: se comprueba que la
    // petición salió bien formada; el guardado en sí lo cubre el spec del
    // `FileDownloader`.
    expect(señal<boolean>('descargandoPlantilla')).toBe(false);
  });

  it('un fallo al bajar la plantilla no rompe la pantalla ni pierde la selección', () => {
    prepararArchivo();

    interno<(f: string) => void>('descargarPlantilla')('xlsx');
    http
      .expectOne((r) => r.url === '/terminology/import-template')
      // `responseType: 'blob'` no admite un cuerpo de objeto ni en el error:
      // el runner no sabe convertirlo. El fallo se emite como tal.
      .error(new ProgressEvent('error'), { status: 422, statusText: 'Unprocessable' });
    fixture.detectChanges();

    expect(señal<boolean>('descargandoPlantilla')).toBe(false);
    expect(señal<readonly File[]>('archivos')).toHaveLength(1);
  });

  /* -- Paso 2 · validar sin guardar ---------------------------------------- */

  it('«Validar sin guardar» manda el archivo con `dryRun=true` y no escribe nada', () => {
    prepararArchivo();

    interno<() => void>('validar')();

    const validacion = http.expectOne(IMPORT_URL);
    expect(validacion.request.method).toBe('POST');
    expect(validacion.request.body).toBeInstanceOf(FormData);
    const form = validacion.request.body as FormData;
    expect(form.get('file')).toBeInstanceOf(File);
    expect(form.get('dryRun')).toBe('true');
    expect(form.get('profile')).toBe('conceptos');
    validacion.flush(VALIDACION_OK);
    fixture.detectChanges();

    expect(señal<{ totalRead: number } | null>('informe')?.totalRead).toBe(50);
    // Un dry-run no deja resumen: no se guardó nada que resumir.
    expect(señal<unknown>('resumen')).toBeNull();
  });

  it('dos clics rápidos en «Validar» mandan una sola petición', () => {
    prepararArchivo();

    interno<() => void>('validar')();
    interno<() => void>('validar')();

    // `expectOne` falla si hubo dos: el bloqueo de doble envío es la señal
    // `validando`, que el segundo clic encuentra encendida.
    http.expectOne(IMPORT_URL).flush(VALIDACION_OK);
  });

  it('mientras valida, el paso 3 dice que está leyendo y no finge un vacío', () => {
    prepararArchivo();

    interno<() => void>('validar')();
    fixture.detectChanges();

    expect(señal<boolean>('validando')).toBe(true);
    expect(texto('carga-validando')).toContain('Leyendo y validando');

    http.expectOne(IMPORT_URL).flush(VALIDACION_OK);
  });

  it('el informe dice leídas, con error, formato y perfil', () => {
    prepararArchivo();

    validarCon(VALIDACION_OK);

    const informe = texto('carga-informe');
    expect(informe).toContain('Leídas');
    expect(informe).toContain('50');
    expect(informe).toContain('Con error');
    expect(informe).toContain('CSV');
    expect(informe).toContain('Conceptos');
  });

  it('la vista previa muestra las filas que devolvió el servidor', () => {
    // Q-5: la vista previa NO se calcula en el navegador.
    prepararArchivo();

    validarCon(VALIDACION_OK);

    expect(texto('carga-preview')).toContain('ZZ-001');
    expect(texto('carga-preview')).toContain('ZZ-002');
  });

  it('un archivo sin ninguna fila válida muestra el vacío que orienta, no una tabla muda', () => {
    prepararArchivo();

    validarCon({ ...VALIDACION_OK, preview: [] });

    const estado = señal<{ status: string; message?: string }>('estadoDeVistaPrevia');
    expect(estado.status).toBe('empty');
    expect(estado.message).toContain('ninguna fila');
  });

  /* -- Errores del archivo -------------------------------------------------- */

  it('con errores muestra la tabla con fila, columna y motivo, y dice que no se guardó nada', () => {
    prepararArchivo('con-errores.xlsx');

    validarCon(VALIDACION_CON_ERRORES);

    const errores = texto('carga-errores');
    expect(errores).toContain('5');
    expect(errores).toContain('display');
    expect(errores).toContain('está vacía');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No se guardó nada');
  });

  it('sin errores la tabla de errores no existe', () => {
    prepararArchivo();

    validarCon(VALIDACION_OK);

    expect(porTestId('carga-errores')).toBeNull();
  });

  it('cuando hay más errores que la muestra, lo dice con los dos números', () => {
    prepararArchivo('con-errores.xlsx');

    validarCon({ ...VALIDACION_CON_ERRORES, errors: 137 });

    expect(señal<string>('leyendaDeErrores')).toBe(
      'Se muestran los primeros 5 de 137 errores.',
    );
  });

  it('el CSV de errores lleva fila, columna y motivo, y neutraliza las fórmulas', () => {
    prepararArchivo('con-errores.xlsx');
    validarCon({
      ...VALIDACION_CON_ERRORES,
      errorSamples: [{ line: 7, column: 'display', message: '=1+1' }],
      errors: 1,
    });

    interno<() => void>('descargarErrores')();

    expect(csvDescargado?.filas).toHaveLength(1);
    // Sin lote —el dry-run no registra ninguno (Q-4)— el nombre lleva la fecha.
    expect(csvDescargado?.nombre).toMatch(/^errores-\d{4}-\d{2}-\d{2}\.csv$/);
    // La neutralización de `= + - @` la hace `CsvExportService`, que ya la
    // tenía probada: acá se fija que el motivo crudo llega hasta él sin que la
    // pantalla lo recorte ni lo escape por su cuenta.
    expect((csvDescargado?.filas[0] as { message: string }).message).toBe('=1+1');
  });

  it('sin errores no hay nada que descargar', () => {
    prepararArchivo();
    validarCon(VALIDACION_OK);

    interno<() => void>('descargarErrores')();

    expect(csvDescargado).toBeNull();
  });

  /* -- Paso 3 · importar ---------------------------------------------------- */

  it('sin validar, «Importar» está deshabilitado y no manda nada', () => {
    // Q-8: desde la interfaz no se importa sin validar antes.
    prepararArchivo();

    expect(señal<boolean>('puedeImportar')).toBe(false);
    // El AppButton no pone el atributo `disabled` nativo: lo dice con
    // `aria-disabled` e intercepta el clic, para que el botón siga siendo
    // alcanzable con el teclado y pueda explicar por qué no se puede todavía.
    expect(porTestId('carga-importar')?.getAttribute('aria-disabled')).toBe('true');

    interno<() => void>('importar')();
    http.expectNone(IMPORT_URL);
  });

  it('con errores, «Importar» sigue deshabilitado', () => {
    prepararArchivo('con-errores.xlsx');

    validarCon(VALIDACION_CON_ERRORES);

    expect(señal<boolean>('puedeImportar')).toBe(false);
    interno<() => void>('importar')();
    http.expectNone(IMPORT_URL);
  });

  it('manda el archivo directo al importador: valida y después importa el mismo archivo', () => {
    // Una sola llamada por paso, con el archivo como multipart. No pasa por
    // `common/files`: esa subida sólo admite PDF e imágenes.
    prepararArchivo();
    validarCon(VALIDACION_OK);

    expect(señal<boolean>('puedeImportar')).toBe(true);
    expect(texto('carga-importar')).toContain('Importar 50 conceptos');

    interno<() => void>('importar')();

    const importacion = http.expectOne(IMPORT_URL);
    expect(importacion.request.method).toBe('POST');
    expect((importacion.request.body as FormData).get('file')).toBeInstanceOf(File);
    expect((importacion.request.body as FormData).get('dryRun')).toBe('false');
    importacion.flush(IMPORTACION_OK);
    fixture.detectChanges();

    expect(señal<{ inserted: number } | null>('resumen')?.inserted).toBe(50);
  });

  it('dos clics rápidos en «Importar» mandan una sola petición', () => {
    prepararArchivo();
    validarCon(VALIDACION_OK);

    interno<() => void>('importar')();
    interno<() => void>('importar')();

    http.expectOne(IMPORT_URL).flush(IMPORTACION_OK);
  });

  it('el resumen dice leídas, insertadas, omitidas, errores, el lote y qué son las omitidas', () => {
    prepararArchivo();
    validarCon(VALIDACION_OK);

    interno<() => void>('importar')();
    http.expectOne(IMPORT_URL).flush({ ...IMPORTACION_OK, inserted: 0, skipped: 50 });
    fixture.detectChanges();

    const resumen = texto('carga-resumen');
    expect(resumen).toContain('Insertadas');
    expect(resumen).toContain('Omitidas');
    expect(resumen).toContain('50');
    expect(resumen).toContain('lote-ZZ-1');
    // Q-7: «omitidas» no es «falló», y hay que decir por qué.
    expect(resumen).toContain('ya existía en esta versión');
    // Q-J3: tras importar se muestra sólo el resumen, no la vista previa otra vez.
    expect(porTestId('carga-preview')).toBeNull();
    expect(porTestId('carga-informe')).toBeNull();
  });

  it('cambiar el archivo después de validar vuelve a deshabilitar «Importar»', () => {
    // Sin esto, validar `ok-50.csv` y después elegir `con-errores.csv` dejaría
    // importar el segundo amparado por la validación del primero.
    prepararArchivo();
    validarCon(VALIDACION_OK);
    expect(señal<boolean>('puedeImportar')).toBe(true);

    interno<(archivos: readonly File[]) => void>('cambiarArchivo')([archivo('con-errores.csv')]);
    fixture.detectChanges();

    expect(señal<unknown>('informe')).toBeNull();
    expect(señal<boolean>('puedeImportar')).toBe(false);
  });

  it('cambiar la versión después de validar también lo deshabilita', () => {
    prepararArchivo();
    validarCon(VALIDACION_OK);

    interno<(id: string) => void>('cambiarVersion')('v-sin-estado');

    expect(señal<boolean>('puedeImportar')).toBe(false);
  });

  it('«Cargar otro archivo» limpia el paso 2 y el 3, y conserva el paso 1', () => {
    prepararArchivo();
    validarCon(VALIDACION_OK);
    interno<() => void>('importar')();
    http.expectOne(IMPORT_URL).flush(IMPORTACION_OK);
    fixture.detectChanges();

    interno<() => void>('cargarOtro')();
    fixture.detectChanges();

    expect(señal<readonly File[]>('archivos')).toHaveLength(0);
    expect(señal<unknown>('informe')).toBeNull();
    expect(señal<unknown>('resumen')).toBeNull();
    // Lo que no cambió no se vuelve a preguntar.
    expect(señal<string | null>('perfil')).toBe('conceptos');
    expect(señal<string | null>('sistema')).toBe('cs-1');
    expect(señal<string | null>('version')).toBe('v-borrador');
  });

  /* -- Fallos: los datos no se pierden -------------------------------------- */

  it('un fallo de red no borra el archivo ni las tres selecciones, y ofrece reintentar', () => {
    prepararArchivo();

    interno<() => void>('validar')();
    http.expectOne(IMPORT_URL).error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();

    // S8 del M34: la petición no llegó.
    expect(señal<{ status: string } | null>('fallo')?.status).toBe('offline');
    expect(señal<readonly File[]>('archivos')).toHaveLength(1);
    expect(señal<string | null>('version')).toBe('v-borrador');
    expect(señal<string | null>('sistema')).toBe('cs-1');
    expect(señal<boolean>('validando')).toBe(false);
    const raiz = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(raiz).toContain('Revisá tu conexión');
    expect(raiz).toContain('Lo que elegiste sigue acá');
  });

  it('un 413 se explica con el tope y conserva el archivo', () => {
    prepararArchivo('grande-10k.xlsx');

    interno<() => void>('validar')();
    http
      .expectOne(IMPORT_URL)
      .flush(
        { statusCode: 413, code: 'PAYLOAD_TOO_LARGE', message: 'El archivo supera los 10 MB.' },
        { status: 413, statusText: 'Payload Too Large' },
      );
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('supera los 10 MB');
    expect(señal<readonly File[]>('archivos')).toHaveLength(1);
  });

  it('un 422 `IMPORT_FORMAT_UNSUPPORTED` dice qué formatos sí, no el error crudo', () => {
    prepararArchivo('no-es-nada.pdf');

    interno<() => void>('validar')();
    http.expectOne(IMPORT_URL).flush(
      {
        statusCode: 422,
        code: 'IMPORT_FORMAT_UNSUPPORTED',
        message: 'FormatoNoAdmitidoError: %PDF-1.4',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    const raiz = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(raiz).toContain('no es CSV, XLSX ni NDJSON');
    // El mensaje crudo del backend no se muestra: no le dice nada a nadie.
    expect(raiz).not.toContain('FormatoNoAdmitidoError');
  });

  it('un 422 `IMPORT_EMPTY_FILE` y uno `IMPORT_PROFILE_UNKNOWN` tienen su propia frase', () => {
    prepararArchivo('vacio-solo-encabezado.csv');

    interno<() => void>('validar')();
    http
      .expectOne(IMPORT_URL)
      .flush({ code: 'IMPORT_EMPTY_FILE', message: 'x' }, { status: 422, statusText: 'x' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('no tiene filas');

    interno<() => void>('validar')();
    http
      .expectOne(IMPORT_URL)
      .flush({ code: 'IMPORT_PROFILE_UNKNOWN', message: 'x' }, { status: 422, statusText: 'x' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Elegí qué vas a cargar');
  });

  it('un 403 es el muro del M34: dice que falta permiso y no ofrece una salida falsa', () => {
    prepararArchivo();

    interno<() => void>('validar')();
    http
      .expectOne(IMPORT_URL)
      .flush(
        { statusCode: 403, code: 'FORBIDDEN', message: 'Hace falta administración de seguridad.' },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();

    expect(señal<{ status: string } | null>('fallo')?.status).toBe('forbidden');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'administración de seguridad',
    );
  });

  it('un 500 muestra el identificador de la petición, que es lo único accionable', () => {
    prepararArchivo();

    interno<() => void>('validar')();
    http.expectOne(IMPORT_URL).flush(
      { statusCode: 500, code: 'INTERNAL', message: 'Ocurrió un error.', correlationId: 'req-77' },
      { status: 500, statusText: 'Internal Server Error' },
    );
    fixture.detectChanges();

    expect(señal<{ status: string } | null>('fallo')?.status).toBe('error');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('req-77');
  });

  it('un fallo al importar conserva la validación: se puede reintentar sin volver a validar', () => {
    prepararArchivo();
    validarCon(VALIDACION_OK);

    interno<() => void>('importar')();
    http.expectOne(IMPORT_URL).error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();

    expect(señal<unknown>('informe')).not.toBeNull();
    expect(señal<boolean>('puedeImportar')).toBe(true);
    expect(señal<readonly File[]>('archivos')).toHaveLength(1);
  });

  it('un archivo rechazado por el átomo deja el motivo anclado, no sólo en un aviso que se va', () => {
    prepararArchivo();

    interno<(r: readonly { file: File; reason: string }[]) => void>('avisarRechazos')([
      { file: archivo('enorme.csv'), reason: 'tamaño' },
    ]);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('pasa los 10 MB');
  });

  /* -- Lo que ya estaba ----------------------------------------------------- */

  it('sin versión o sin archivo no valida', () => {
    elegirSistema();

    // Con versión pero sin archivo.
    interno<(id: string) => void>('cambiarVersion')('v-borrador');
    expect(señal<boolean>('puedeValidar')).toBe(false);

    interno<() => void>('validar')();
    http.expectNone(IMPORT_URL);
  });

  it('publicar es un paso propio y relee las versiones', () => {
    // Sin publicar, los conceptos importados son invisibles a toda expansión y
    // no da ningún error: por eso la pantalla lo ofrece aparte y lo dice.
    elegirSistema();
    interno<(id: string) => void>('cambiarVersion')('v-borrador');

    interno<() => void>('publicar')();

    const publicacion = http.expectOne('/terminology/versions/v-borrador/publish');
    expect(publicacion.request.method).toBe('POST');
    publicacion.flush({ id: 'v-borrador', state: 'TERM_ACTIVE' });

    // Y relee: la versión cambió de estado y ya no admite conceptos.
    http.expectOne('/terminology/code-systems/cs-1/versions').flush({ items: VERSIONES });
  });

  it('cambiar de sistema limpia la versión y el resultado anterior', () => {
    prepararArchivo();
    validarCon(VALIDACION_OK);

    interno<(id: string | null) => void>('cambiarSistema')(null);

    expect(señal<string | null>('version')).toBeNull();
    expect(señal<unknown>('informe')).toBeNull();
    expect(señal<unknown>('resumen')).toBeNull();
  });

  /* -- Accesibilidad -------------------------------------------------------- */

  it('el resultado vive en una región viva y el informe recibe el foco', () => {
    prepararArchivo();

    validarCon(VALIDACION_OK);

    const informe = porTestId('carga-informe');
    expect(informe?.closest('[aria-live="polite"]')).not.toBeNull();
    // `tabindex="-1"` es lo que permite enfocar un bloque que no es un control.
    expect(informe?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(informe);
  });

  it('tras importar, el foco va al resumen', () => {
    prepararArchivo();
    validarCon(VALIDACION_OK);

    interno<() => void>('importar')();
    http.expectOne(IMPORT_URL).flush(IMPORTACION_OK);
    fixture.detectChanges();

    expect(document.activeElement).toBe(porTestId('carga-resumen'));
  });

  it('cada botón y cada tabla tienen nombre accesible', () => {
    prepararArchivo('con-errores.xlsx');
    validarCon(VALIDACION_CON_ERRORES);

    const raiz = fixture.nativeElement as HTMLElement;
    for (const boton of Array.from(raiz.querySelectorAll('button'))) {
      const nombre = boton.getAttribute('aria-label') ?? boton.textContent ?? '';
      expect(nombre.trim().length, boton.outerHTML.slice(0, 80)).toBeGreaterThan(0);
    }
    // La tabla se nombra por su `<caption>`, aunque sea sólo para lectores.
    expect(raiz.querySelector('[data-testid="carga-errores"] caption')?.textContent).toContain(
      'problemas',
    );
  });
});
