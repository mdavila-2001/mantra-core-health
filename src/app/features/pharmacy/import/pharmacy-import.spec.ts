import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import type { BulkRowResult } from '../../../core/data-access/pharmacy/pharmacy-bulk.types';
import type {
  PharmacyCategoryPage,
  PharmacyDirectoryPage,
  PharmacyProduct,
  PharmacyProductSearchPage,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import { CsvExportService } from '../../../shared/utils/csv-export/csv-export';
import type { ProductFields, LoadMode } from '../catalog-rules/catalog.rules';
import { chooseSelectOption, selectOptionLabels } from '../../../../testing/select';
import { PharmacyImport } from './pharmacy-import';
import { afterAll, beforeAll } from 'vitest';
import { environment } from '../../../../environments/environment';

/**
 * «Importación masiva» del catálogo de la farmacia.
 *
 * Migra los casos de importación del `PharmacyCatalog` de una sola tarjeta con
 * tres pestañas (`pharmacy-catalog.spec.ts`) y agrega los del recorrido nuevo:
 * el paso de columnas, el modo «sólo actualizar» y las categorías de la
 * farmacia. Se fija contra la API simulada con `HttpTestingController`: qué
 * petición sale, con qué cuerpo, en qué orden.
 *
 * Qué cambió respecto del original, y por qué las aserciones que cambiaron lo
 * hicieron:
 *
 * - Subir el archivo ya no lleva directo a la revisión: pasa por «Asignar
 *   columnas», así que donde el original leía la revisión ahora se avanza un
 *   paso con «Continuar» (`revisar()` abajo).
 * - El catálogo contra el que se comparan los códigos se pide con
 *   `managed=true` (con borradores y retirados, que también reservan el código).
 * - Terminada la carga ya **no** se relee el catálogo ni se cambia de pestaña:
 *   la lista de productos es otra ruta. Esa parte del original (`esperarListado`
 *   tras publicar) no tiene equivalente; en su lugar se prueba «Ver productos».
 * - FAR-05: ya no hay un `POST`/`PATCH` por fila. «Revisar datos» pide la vista
 *   previa del servidor (`POST …/products/bulk` con `dryRun: true`) y «Cargar»
 *   manda lo mismo sin `dryRun`, en lotes de 250. Los casos de publicación de
 *   antes se conservan con sus mismas afirmaciones de resultado; lo que cambió
 *   es por dónde viaja cada fila.
 */
const PHARMACY = { id: '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63', name: 'Farmacia del Centro' };
const OTHER_PHARMACY = { id: '2b9e6c10-4a7d-4f3b-8d15-9c0e7a1f5b22', name: 'Farmacia Sur' };

const DIRECTORY: PharmacyDirectoryPage = {
  items: [{ ...PHARMACY, code: 'FC-01', siteCount: 1, productCount: 1 }],
  count: 1,
};

const TWO_PHARMACIES: PharmacyDirectoryPage = {
  items: [
    { ...PHARMACY, code: 'FC-01', siteCount: 1, productCount: 1 },
    { ...OTHER_PHARMACY, code: 'FS-01', siteCount: 1, productCount: 0 },
  ],
  count: 2,
};

const CATEGORIES: PharmacyCategoryPage = {
  items: [
    { id: 'c-1', name: 'Ortopedia', productCount: 3 },
    { id: 'c-2', name: 'Óptica', productCount: 0 },
  ],
};

function product(partial: Partial<PharmacyProduct>): PharmacyProduct {
  return {
    id: 'p-1',
    pharmacyId: PHARMACY.id,
    pharmacyName: PHARMACY.name,
    productCode: 'PAR-500',
    brandName: 'Paracetamol Bagó',
    genericName: 'Paracetamol',
    strengthText: '500 mg',
    packageSizeText: 'Caja x 20',
    dosageForm: null,
    medication: null,
    requiresPrescription: false,
    ...partial,
  };
}

function page(items: readonly PharmacyProduct[], truncated = false): PharmacyProductSearchPage {
  return { items, limit: 500, truncated };
}

/** Lo que la spec toca del componente: señales y métodos protegidos. */
interface Internal {
  step: () => string;
  mode: () => LoadMode;
  onFilesChange: (files: readonly File[]) => Promise<void>;
  publish: () => void;
  stop: () => void;
  goTo: (step: 'file' | 'columns' | 'review') => void;
  setMode: (mode: LoadMode | null) => void;
  choosePharmacy: (id: string | null) => void;
  downloadTemplate: () => void;
}

describe('PharmacyImport', () => {
  // Las escrituras de farmacia son «sólo simulador»: sin esto la petición no sale.
  const originalMockBackend = environment.mockBackend;
  beforeAll(() => Object.assign(environment, { mockBackend: true }));
  afterAll(() => Object.assign(environment, { mockBackend: originalMockBackend }));

  let fixture: ComponentFixture<PharmacyImport>;
  let http: HttpTestingController;
  let download: ReturnType<typeof vi.fn>;

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => root().textContent ?? '';
  const byId = (id: string): HTMLElement | null =>
    root().querySelector(`[data-testid="${id}"]`);
  const textOf = (id: string): string => byId(id)?.textContent ?? '';

  const categoriesUrl = (pharmacyId: string): string => `/pharmacies/${pharmacyId}/categories`;
  const productsUrl = (pharmacyId: string): string => `/pharmacies/${pharmacyId}/products`;
  const bulkUrl = (pharmacyId: string): string => `/pharmacies/${pharmacyId}/products/bulk`;

  /** Una respuesta de la carga masiva: `CREATED` salvo lo que diga `outcomes` por fila. */
  function bulkAnswer(
    request: TestRequest,
    outcomes: (row: { productCode: string }, index: number) => Partial<BulkRowResult> = () => ({}),
  ): void {
    const body = request.request.body as { dryRun?: boolean; rows: { productCode: string }[] };
    request.flush({
      dryRun: body.dryRun === true,
      results: body.rows.map((row, index) => ({ row: index + 1, outcome: 'CREATED', ...outcomes(row, index) })),
    });
  }

  /**
   * Contesta la vista previa del servidor (`dryRun`), lote por lote: devuelve
   * los pedidos que salieron, para mirar su cuerpo.
   */
  function answerPreview(
    outcomes?: (row: { productCode: string }, index: number) => Partial<BulkRowResult>,
  ): TestRequest[] {
    const seen: TestRequest[] = [];
    for (let pending = http.match(bulkUrl(PHARMACY.id)); pending.length > 0; pending = http.match(bulkUrl(PHARMACY.id))) {
      expect(pending).toHaveLength(1);
      expect(pending[0]!.request.body.dryRun).toBe(true);
      seen.push(pending[0]!);
      bulkAnswer(pending[0]!, outcomes);
      fixture.detectChanges();
    }
    return seen;
  }

  /** Monta la pantalla con una sola farmacia: queda elegida sola y pide sus categorías. */
  function mount(categories: PharmacyCategoryPage = CATEGORIES): void {
    fixture = TestBed.createComponent(PharmacyImport);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/pharmacy/pharmacies')).flush(DIRECTORY);
    fixture.detectChanges();
    http.expectOne(categoriesUrl(PHARMACY.id)).flush(categories);
    fixture.detectChanges();
  }

  /** El catálogo se relee **completo** (`managed`) al subir un archivo. */
  function expectCatalogRead(items: readonly PharmacyProduct[], truncated = false): void {
    const request = http.expectOne((r) => r.url.endsWith('/pharmacy/products'));
    expect(request.request.params.get('pharmacyId')).toBe(PHARMACY.id);
    expect(request.request.params.get('managed')).toBe('true');
    expect(request.request.params.get('limit')).toBe('500');
    request.flush(page(items, truncated));
    fixture.detectChanges();
  }

  function csvFile(content: string, name = 'catalogo.csv'): File {
    return new File([content], name, { type: 'text/csv' });
  }

  /** Sube un archivo y contesta la relectura del catálogo: queda en «Asignar columnas». */
  async function upload(
    content: string,
    catalog: readonly PharmacyProduct[] = [product({})],
  ): Promise<void> {
    await internal().onFilesChange([csvFile(content)]);
    expectCatalogRead(catalog);
  }

  /** Avanza de «Asignar columnas» a «Revisar datos» con «Continuar» y contesta la vista previa. */
  function review(
    outcomes?: (row: { productCode: string }, index: number) => Partial<BulkRowResult>,
  ): TestRequest[] {
    (byId('import-continue-columns') as HTMLButtonElement).click();
    fixture.detectChanges();
    return answerPreview(outcomes);
  }

  function publishByClick(): void {
    (byId('import-publish') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  const CSV = [
    'codigo;marca;generico;receta',
    'A-1;Uno;;no',
    'A-2;;Dos;sí',
    'PAR-500;Ya está;;no',
    ';Sin código;;',
  ].join('\n');

  beforeEach(() => {
    download = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CsvExportService, useValue: { download } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('la pantalla', () => {
    it('montada como pestaña de «Catálogo» (`embedded`) no dibuja su membrete', () => {
      mount();
      const host = fixture.nativeElement as HTMLElement;
      expect(host.querySelector('app-page-header')).not.toBeNull();

      fixture.componentRef.setInput('embedded', true);
      fixture.detectChanges();

      expect(host.querySelector('app-page-header')).toBeNull();
    });

    it('con una sola farmacia no pregunta cuál y muestra los cuatro pasos en una sola tarjeta', () => {
      mount();

      expect(root().querySelector('.import__pharmacy')).toBeNull();
      expect(root().querySelectorAll('app-card')).toHaveLength(0);
      expect(byId('import-card')).not.toBeNull();
      expect(root().querySelector('h1')?.textContent).toContain('Importación masiva');
      for (const label of ['Subir archivo', 'Asignar columnas', 'Revisar datos', 'Resultado']) {
        expect(text()).toContain(label);
      }
      expect(root().querySelector('[aria-current="step"]')?.textContent).toContain('Subir archivo');
    });

    it('sin categorías cargadas no ofrece el archivo: dice que las está cargando', () => {
      fixture = TestBed.createComponent(PharmacyImport);
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/pharmacy/pharmacies')).flush(DIRECTORY);
      fixture.detectChanges();

      expect(byId('import-categories-loading')).not.toBeNull();
      expect(root().querySelector('app-file-input')).toBeNull();

      http.expectOne(categoriesUrl(PHARMACY.id)).flush(CATEGORIES);
      fixture.detectChanges();

      expect(byId('import-categories-loading')).toBeNull();
      expect(root().querySelector('app-file-input')).not.toBeNull();
    });

    it('si fallan las categorías lo dice, no ofrece el archivo y reintentar las vuelve a pedir', () => {
      fixture = TestBed.createComponent(PharmacyImport);
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/pharmacy/pharmacies')).flush(DIRECTORY);
      fixture.detectChanges();
      http
        .expectOne(categoriesUrl(PHARMACY.id))
        .flush({ statusCode: 500, message: 'boom' }, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(byId('import-categories-error')).not.toBeNull();
      expect(root().querySelector('app-file-input')).toBeNull();

      (byId('import-categories-error')?.querySelector('button') as HTMLButtonElement).click();
      fixture.detectChanges();
      http.expectOne(categoriesUrl(PHARMACY.id)).flush(CATEGORIES);
      fixture.detectChanges();

      expect(root().querySelector('app-file-input')).not.toBeNull();
    });

    it('con varias farmacias pregunta cuál y pide las categorías de la que se elige', () => {
      fixture = TestBed.createComponent(PharmacyImport);
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/pharmacy/pharmacies')).flush(TWO_PHARMACIES);
      fixture.detectChanges();

      expect(root().querySelector('.import__pharmacy')).not.toBeNull();
      // Sin farmacia elegida no hay tarjeta ni petición de categorías.
      expect(byId('import-card')).toBeNull();
      http.expectNone(categoriesUrl(OTHER_PHARMACY.id));

      internal().choosePharmacy(OTHER_PHARMACY.id);
      fixture.detectChanges();
      http.expectOne(categoriesUrl(OTHER_PHARMACY.id)).flush(CATEGORIES);
      fixture.detectChanges();

      expect(byId('import-card')).not.toBeNull();
    });

    it('«Descargar plantilla» arma las filas de ejemplo con una categoría de esta farmacia', () => {
      mount();

      (byId('import-template') as HTMLButtonElement).click();

      expect(download).toHaveBeenCalledTimes(1);
      const [rows, columns, filename] = download.mock.calls[0]!;
      expect(filename).toBe('plantilla-catalogo-farmacia.csv');
      expect((rows as ProductFields[]).map((row) => row.categoria)).toEqual([
        'Ortopedia',
        'Ortopedia',
        'Ortopedia',
      ]);
      expect((columns as { header: string }[]).map((column) => column.header)).toContain('categoria');
    });

    it('la ayuda de columnas dice las categorías de la farmacia, no las fijas', () => {
      mount();

      expect(text()).toContain('Una de las suyas: Ortopedia · Óptica.');
      expect(text()).not.toContain('Dermocosmética');
    });
  });

  describe('paso 2 · asignar columnas', () => {
    it('sube el archivo, compara contra el catálogo completo y muestra cada columna con su campo', async () => {
      mount();
      await upload('SKU;Nombre;lote;precio\nA-1;Uno;L-1;10\n');

      expect(internal().step()).toBe('columns');
      expect(root().querySelector('[aria-current="step"]')?.textContent).toContain('Asignar columnas');

      const mapping = textOf('import-mapping');
      expect(mapping).toContain('SKU');
      expect(mapping).toContain('Código interno (SKU)');
      expect(mapping).toContain('lo reconocimos como «codigo»');
      expect(mapping).toContain('Marca o nombre comercial');
      expect(mapping).toContain('Precio de venta (Bs)');
      // La columna que el catálogo no guarda queda marcada como ignorada.
      expect(mapping).toContain('lote');
      expect(mapping).toContain('Se ignora');
      expect(textOf('import-columns-summary')).toMatch(/3\s+columnas se cargan/);
      expect(textOf('import-columns-summary')).toMatch(/1\s+columna se ignora/);
      expect(textOf('import-ignored')).toContain('lote');
    });

    it('avisa qué campos no trae el archivo y que sin «disponible» una actualización lo vuelve a poner a la venta', async () => {
      mount();
      await upload('codigo;marca\nA-1;Uno\n');

      expect(textOf('import-missing')).toContain('Precio de venta (Bs)');
      expect(textOf('import-missing')).not.toContain('Código interno');
      expect(byId('import-no-availability')).not.toBeNull();
    });

    it('con la columna «disponible» no lanza ese aviso', async () => {
      mount();
      await upload('codigo;marca;disponible\nA-1;Uno;sí\n');

      expect(byId('import-no-availability')).toBeNull();
    });

    it('«Continuar» pasa a revisar y «Volver» regresa sin volver a pedir el catálogo', async () => {
      mount();
      await upload(CSV);

      review();
      expect(internal().step()).toBe('review');
      expect(byId('import-review')).not.toBeNull();

      (root().querySelector('.import__footer button') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(internal().step()).toBe('columns');
      http.expectNone((r) => r.url.endsWith('/pharmacy/products'));
    });

    it('rechaza el archivo entero si no trae la columna del código y no avanza', async () => {
      mount();

      await internal().onFilesChange([csvFile('marca\nUno\n', 'x.csv')]);
      fixture.detectChanges();

      expect(textOf('import-file-error')).toContain('Falta la columna «codigo»');
      expect(internal().step()).toBe('file');
    });

    it('si no se puede leer el catálogo no avanza: sin él, «sólo actualizar» rechazaría todo por error', async () => {
      mount();

      await internal().onFilesChange([csvFile(CSV)]);
      http
        .expectOne((r) => r.url.endsWith('/pharmacy/products'))
        .flush({ statusCode: 500, message: 'boom' }, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(internal().step()).toBe('file');
      expect(textOf('import-file-error')).toContain('No pudimos leer su catálogo');
    });

    it('cambiar de farmacia con un archivo leído lo suelta y vuelve al primer paso', async () => {
      fixture = TestBed.createComponent(PharmacyImport);
      fixture.detectChanges();
      http.expectOne((r) => r.url.endsWith('/pharmacy/pharmacies')).flush(TWO_PHARMACIES);
      fixture.detectChanges();
      internal().choosePharmacy(PHARMACY.id);
      fixture.detectChanges();
      http.expectOne(categoriesUrl(PHARMACY.id)).flush(CATEGORIES);
      fixture.detectChanges();
      await upload(CSV);
      expect(internal().step()).toBe('columns');

      internal().choosePharmacy(OTHER_PHARMACY.id);
      fixture.detectChanges();
      http.expectOne(categoriesUrl(OTHER_PHARMACY.id)).flush(CATEGORIES);
      fixture.detectChanges();

      expect(internal().step()).toBe('file');
      expect(byId('import-mapping')).toBeNull();
    });
  });

  describe('paso 3 · revisar datos', () => {
    it('separa las filas listas de las que hay que corregir antes de mandar nada', async () => {
      mount();
      await upload(CSV);
      review();

      const revision = textOf('import-review');
      expect(revision).toMatch(/2\s+productos nuevos/);
      expect(revision).toMatch(/1\s+se actualiza/);
      expect(revision).toMatch(/1\s+fila a corregir/);
      http.expectNone(productsUrl(PHARMACY.id));
    });

    it('un código que ya está en el catálogo pero retirado también cuenta como existente', async () => {
      mount();
      await upload('codigo;marca\nRET-1;Retirado\n', [
        product({ id: 'p-9', productCode: 'RET-1', status: 'WITHDRAWN' }),
      ]);
      review();

      expect(textOf('import-review')).toMatch(/1\s+se actualiza/);
    });

    it('dice cuántas filas comparten código dentro del archivo y las rechaza todas', async () => {
      mount();
      await upload('codigo;marca\nD-1;Uno\nD-1;Otro\nD-2;Dos\n');
      review();

      expect(textOf('import-duplicates')).toMatch(/2\s+filas comparten/);
      expect(textOf('import-problems')).toContain('El código D-1 aparece más de una vez en el archivo.');
      expect(textOf('import-review')).toMatch(/1\s+producto nuevo/);
      expect(textOf('import-review')).toMatch(/2\s+filas a corregir/);
    });

    it('un CSV guardado por Excel en Windows-1252 conserva las tildes', async () => {
      mount();
      const bytes = new Uint8Array([
        ...new TextEncoder().encode('codigo;marca\nB-1;C'),
        0xe1,
        ...new TextEncoder().encode('psulas\n'),
      ]);

      await internal().onFilesChange([new File([bytes], 'excel.csv', { type: 'text/csv' })]);
      expectCatalogRead([]);
      review();

      expect(byId('import-encoding')).not.toBeNull();
      expect(textOf('import-sample')).toContain('Cápsulas');
    });

    it('«Descargar errores» baja las filas rechazadas con el motivo, con los encabezados de la plantilla', async () => {
      mount();
      await upload(CSV);
      review();

      (byId('import-download-errors') as HTMLButtonElement).click();

      const [rows, columns, filename] = download.mock.calls[0]!;
      expect(filename).toBe('catalogo-filas-a-corregir.csv');
      expect(rows).toHaveLength(1);
      expect((rows as { problema: string }[])[0]!.problema).toContain('Falta el código del producto.');
      expect((columns as { header: string }[]).map((column) => column.header)).toEqual([
        'codigo',
        'marca',
        'generico',
        'concentracion',
        'presentacion',
        'receta',
        'medicamento',
        'cadena_frio',
        'codigo_barras',
        'precio',
        'categoria',
        'descripcion',
        'disponible',
        'problema',
      ]);
    });

    it('avisa si el catálogo pasó del tope de lectura, porque puede haber códigos sin comparar', async () => {
      mount();
      await internal().onFilesChange([csvFile(CSV)]);
      expectCatalogRead([product({})], true);
      review();

      expect(byId('import-truncated')).not.toBeNull();
    });
  });

  describe('modo', () => {
    const MODE_CSV = ['codigo;marca', 'A-1;Nuevo', 'PAR-500;Ya está', ''].join('\n');

    it('ofrece las tres opciones con sus rótulos y cambiarla en el desplegable cambia el modo', async () => {
      mount();

      const select = root().querySelector('app-select') as HTMLElement;
      const labels = await selectOptionLabels(fixture, select);
      expect(labels).toEqual(['Crear y actualizar', 'Sólo crear', 'Sólo actualizar']);
      expect(text()).toContain('Los códigos nuevos se crean y los que ya están en su catálogo se actualizan');

      await chooseSelectOption(fixture, select, 'Sólo actualizar');
      fixture.detectChanges();

      expect(internal().mode()).toBe('SOLO_ACTUALIZAR');
      expect(text()).toContain('Sólo se actualizan los productos que ya están en su catálogo');
    });

    it('«sólo actualizar» rechaza el código que no existe, con un mensaje claro, y actualiza el que sí', async () => {
      mount();
      internal().setMode('SOLO_ACTUALIZAR');
      await upload(MODE_CSV);
      review();

      const revision = textOf('import-review');
      expect(revision).toMatch(/0\s+productos nuevos/);
      expect(revision).toMatch(/1\s+se actualiza/);
      expect(revision).toMatch(/1\s+fila a corregir/);
      expect(textOf('import-problems')).toContain('El código A-1 no está en su catálogo (eligió «sólo actualizar»).');
      expect(textOf('import-not-in-catalog')).toMatch(/1\s+fila no se actualiza/);

      publishByClick();
      // Nada se da de alta: sólo viaja la actualización, en modo `UPDATE`.
      http.expectNone(productsUrl(PHARMACY.id));
      http.expectNone(`${productsUrl(PHARMACY.id)}/p-1`);
      const bulk = http.expectOne(bulkUrl(PHARMACY.id));
      expect(bulk.request.method).toBe('POST');
      expect(bulk.request.body).toEqual({
        mode: 'UPDATE',
        rows: [{ productCode: 'PAR-500', brandName: 'Ya está', inStock: true }],
      });
      bulkAnswer(bulk, () => ({ outcome: 'UPDATED', id: 'p-1' }));
      fixture.detectChanges();

      expect(textOf('import-result')).toMatch(/1\s+actualizado/);
      expect(textOf('import-result')).toMatch(/0\s+productos publicados/);
      expect(textOf('import-result')).toMatch(/1\s+no enviados por errores del archivo/);
    });

    it('si ninguna fila se puede cargar en ese modo lo dice y no deja publicar', async () => {
      mount();
      internal().setMode('SOLO_ACTUALIZAR');
      await upload('codigo;marca\nA-1;Nuevo\n');
      review();

      expect(byId('import-nothing')).not.toBeNull();
      expect((byId('import-publish') as HTMLButtonElement).getAttribute('aria-disabled')).toBe('true');
    });

    it('cambiar el modo con el archivo ya leído recalcula la revisión sin volver a pedir el catálogo', async () => {
      mount();
      await upload(MODE_CSV);
      review();
      expect(textOf('import-review')).toMatch(/1\s+producto nuevo/);
      expect(textOf('import-review')).toMatch(/1\s+se actualiza/);

      internal().setMode('SOLO_CREAR');
      fixture.detectChanges();
      // La vista previa del servidor se vuelve a pedir, con el modo nuevo.
      const [again] = http.match(bulkUrl(PHARMACY.id));
      expect(again!.request.body.mode).toBe('CREATE');
      bulkAnswer(again!);
      fixture.detectChanges();

      expect(textOf('import-review')).toMatch(/1\s+producto nuevo/);
      expect(textOf('import-review')).toMatch(/0\s+se actualizan/);
      expect(textOf('import-review')).toMatch(/1\s+fila a corregir/);
      expect(textOf('import-problems')).toContain('El código PAR-500 ya está en su catálogo');
      http.expectNone((r) => r.url.endsWith('/pharmacy/products'));
    });
  });

  describe('categorías de la farmacia', () => {
    const CATEGORY_CSV = [
      'codigo;marca;categoria',
      'C-1;Uno;Ortopedia',
      'C-2;Dos;Medicamentos',
      'C-3;Tres;optica',
    ].join('\n');

    it('valida contra las categorías de la farmacia: las suyas pasan y las fijas de antes ya no', async () => {
      mount();
      await upload(CATEGORY_CSV, []);
      review();

      expect(textOf('import-review')).toMatch(/2\s+productos nuevos/);
      expect(textOf('import-review')).toMatch(/1\s+fila a corregir/);
      // Una categoría desconocida es error de fila, con el mensaje de siempre y la lista de la farmacia.
      expect(textOf('import-problems')).toContain(
        'La categoría tiene que ser una de estas: Ortopedia, Óptica.',
      );
    });

    it('publica la categoría con la grafía de la farmacia aunque el archivo la traiga sin tilde ni mayúscula', async () => {
      mount();
      await upload(CATEGORY_CSV, []);
      review();

      publishByClick();
      const bulk = http.expectOne(bulkUrl(PHARMACY.id));
      expect(bulk.request.body.rows).toEqual([
        expect.objectContaining({ productCode: 'C-1', category: 'Ortopedia' }),
        expect.objectContaining({ productCode: 'C-3', category: 'Óptica' }),
      ]);
      bulkAnswer(bulk);
    });

    it('con una farmacia sin categorías, poner una es error de fila y dejarla vacía no', async () => {
      mount({ items: [] });
      await upload('codigo;marca;categoria\nC-1;Uno;Bienestar\nC-2;Dos;\n', []);
      review();

      expect(textOf('import-review')).toMatch(/1\s+producto nuevo/);
      expect(textOf('import-problems')).toContain('Su farmacia todavía no tiene categorías');
    });
  });

  describe('vista previa del servidor', () => {
    it('«Revisar datos» manda las filas listas con dryRun y muestra lo que el servidor rechazaría, con su motivo', async () => {
      mount();
      await upload(CSV);

      const [preview] = review((row) =>
        row.productCode === 'A-2'
          ? {
              outcome: 'REJECTED',
              errors: [{ field: 'productCode', reason: 'PRODUCT_RETIRED', message: 'El producto de ese código está retirado' }],
            }
          : row.productCode === 'PAR-500'
            ? { outcome: 'UNCHANGED' }
            : {},
      );

      // Sólo las tres filas listas; la que no tiene código no viaja.
      expect(preview!.request.body).toEqual({
        mode: 'UPSERT',
        dryRun: true,
        rows: [
          { productCode: 'A-1', brandName: 'Uno', requiresPrescription: false, inStock: true },
          { productCode: 'A-2', genericName: 'Dos', requiresPrescription: true, inStock: true },
          { productCode: 'PAR-500', brandName: 'Ya está', requiresPrescription: false, inStock: true },
        ],
      });
      const figures = textOf('import-preview-figures');
      expect(figures).toMatch(/1\s+se crearían/);
      expect(figures).toMatch(/1\s+sin cambios/);
      expect(figures).toMatch(/1\s+rechazadas por el servidor/);
      const rejected = textOf('import-preview-rejected');
      expect(rejected).toContain('A-2');
      expect(rejected).toContain('El producto de ese código está retirado');
      // La revisión local sigue ahí, arriba de la del servidor.
      expect(textOf('import-review')).toMatch(/1\s+fila a corregir/);
      // Nada se publicó: ni un alta ni un cambio por fila.
      http.expectNone(productsUrl(PHARMACY.id));
    });

    it('300 filas: la vista previa sale en dos pedidos en serie, de 250 y 50', async () => {
      mount();
      const rows = Array.from({ length: 300 }, (_, i) => `M-${i + 1};Producto ${i + 1}`);
      await upload(['codigo;marca', ...rows].join('\n'), []);

      const sent = review();

      expect(sent.map((request) => request.request.body.rows.length)).toEqual([250, 50]);
      expect(sent[1]!.request.body.rows[0].productCode).toBe('M-251');
      expect(textOf('import-preview-figures')).toMatch(/300\s+se crearían/);
    });

    it('si la vista previa falla lo dice en pantalla (un 413 como tamaño) y «Reintentar» la vuelve a pedir', async () => {
      mount();
      await upload('codigo;marca\nA-1;Uno\n', []);
      (byId('import-continue-columns') as HTMLButtonElement).click();
      fixture.detectChanges();

      http
        .expectOne(bulkUrl(PHARMACY.id))
        .flush({ message: 'request entity too large' }, { status: 413, statusText: 'Payload Too Large' });
      fixture.detectChanges();

      expect(textOf('import-preview-error')).toContain('pasó de 1 MB');
      (byId('import-preview-error')?.querySelector('button') as HTMLButtonElement).click();
      fixture.detectChanges();
      answerPreview();
      expect(byId('import-preview-error')).toBeNull();
      expect(textOf('import-preview-figures')).toMatch(/1\s+se crearían/);
    });

    it('mientras el servidor no contestó la vista previa no deja cargar', async () => {
      mount();
      await upload('codigo;marca\nA-1;Uno\n', []);
      (byId('import-continue-columns') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect((byId('import-publish') as HTMLButtonElement).getAttribute('aria-disabled')).toBe('true');
      answerPreview();
      expect((byId('import-publish') as HTMLButtonElement).getAttribute('aria-disabled')).not.toBe('true');
    });
    it('con la vista previa fallida tampoco deja cargar: no se publica sin saber qué diría el servidor', async () => {
      mount();
      await upload('codigo;marca\nA-1;Uno\n', []);
      (byId('import-continue-columns') as HTMLButtonElement).click();
      fixture.detectChanges();
      http
        .expectOne(bulkUrl(PHARMACY.id))
        .flush({ message: 'caído' }, { status: 503, statusText: 'Service Unavailable' });
      fixture.detectChanges();

      expect(byId('import-preview-error')).not.toBeNull();
      expect((byId('import-publish') as HTMLButtonElement).getAttribute('aria-disabled')).toBe('true');
    });

    it('la columna «medicamento» viaja como medicationName y un recetable sin medicamento se avisa antes de cargar', async () => {
      mount();
      await upload('codigo;generico;receta;medicamento\nA-1;Amoxicilina;sí;Amoxicilina\nA-2;Otro;sí;\n', []);

      const [preview] = review((row) =>
        row.productCode === 'A-2'
          ? {
              warnings: [
                { field: 'medicationConceptId', reason: 'MEDICATION_NOT_LINKED', message: 'Pide receta sin medicamento' },
              ],
            }
          : {},
      );

      expect(preview!.request.body.rows[0]).toMatchObject({ productCode: 'A-1', medicationName: 'Amoxicilina' });
      expect(preview!.request.body.rows[1]).not.toHaveProperty('medicationName');
      expect(textOf('import-preview-warned')).toContain('1 fila se cargaría');
    });
  });

  describe('paso 4 · publicar y resultado', () => {
    it('publica las filas listas en un pedido masivo, sin dryRun ni llamadas por fila, y cuenta lo que la API rechazó', async () => {
      mount();
      await upload(CSV);
      review();

      publishByClick();
      expect(root().querySelector('[aria-current="step"]')?.textContent).toContain('Resultado');

      const bulk = http.expectOne(bulkUrl(PHARMACY.id));
      expect(bulk.request.method).toBe('POST');
      // El código que ya estaba va como cambio: lo vacío de la fila no pisa lo
      // que el producto ya tenía.
      expect(bulk.request.body).toEqual({
        mode: 'UPSERT',
        rows: [
          { productCode: 'A-1', brandName: 'Uno', requiresPrescription: false, inStock: true },
          { productCode: 'A-2', genericName: 'Dos', requiresPrescription: true, inStock: true },
          { productCode: 'PAR-500', brandName: 'Ya está', requiresPrescription: false, inStock: true },
        ],
      });
      bulkAnswer(bulk, (_, index) =>
        index === 1
          ? {
              outcome: 'REJECTED',
              errors: [{ field: 'productCode', reason: 'ALREADY_EXISTS', message: 'Ya existe un producto con ese código en la farmacia' }],
            }
          : index === 2
            ? { outcome: 'UPDATED', id: 'p-1' }
            : { id: 'n-1' },
      );
      fixture.detectChanges();

      // Ni un alta ni un cambio sueltos, y no se relee el catálogo.
      http.expectNone(productsUrl(PHARMACY.id));
      http.expectNone(`${productsUrl(PHARMACY.id)}/p-1`);
      http.expectNone((r) => r.url.endsWith('/pharmacy/products'));

      const result = textOf('import-result');
      expect(result).toMatch(/1\s+producto publicado/);
      expect(result).toMatch(/1\s+actualizado/);
      expect(result).toMatch(/1\s+rechazados por la API/);
      expect(result).toMatch(/1\s+no enviados por errores del archivo/);
      expect(text()).toContain('Ya existe un producto con ese código');
    });

    it('la tabla del resultado dice qué pasó con cada fila del archivo, línea por línea', async () => {
      mount();
      await upload(CSV);
      review();
      publishByClick();
      bulkAnswer(http.expectOne(bulkUrl(PHARMACY.id)), (_, index) =>
        index === 1
          ? { outcome: 'REJECTED', errors: [{ field: 'productCode', reason: 'PRODUCT_RETIRED' }] }
          : index === 2
            ? { outcome: 'UNCHANGED' }
            : {},
      );
      fixture.detectChanges();

      const table = textOf('import-results');
      for (const outcome of ['Creado', 'Rechazado', 'Sin cambios', 'No enviada']) {
        expect(table).toContain(outcome);
      }
      expect(table).toContain('Falta el código del producto.');
      // Sin `message` de la API, el motivo se dice con su código conocido.
      expect(table).toContain('El producto de ese código está retirado.');
      expect(textOf('import-result')).toMatch(/1\s+sin cambios/);
    });

    it('un 403 no es de una fila: corta la carga y lo que no salió queda «sin enviar»', async () => {
      mount();
      await upload(CSV);
      review();

      publishByClick();
      http
        .expectOne(bulkUrl(PHARMACY.id))
        .flush(
          { statusCode: 403, code: 'FORBIDDEN', message: 'Forbidden resource' },
          { status: 403, statusText: 'Forbidden' },
        );
      fixture.detectChanges();

      http.expectNone(bulkUrl(PHARMACY.id));
      expect(byId('import-general-failure')).not.toBeNull();
      expect(textOf('import-results')).toContain('Sin enviar');
    });

    it('un error de red al publicar se dice en pantalla', async () => {
      mount();
      await upload('codigo;marca\nA-1;Uno\n', []);
      review();

      publishByClick();
      http.expectOne(bulkUrl(PHARMACY.id)).error(new ProgressEvent('error'), { status: 0 });
      fixture.detectChanges();

      expect(textOf('import-general-failure')).toContain('Sin conexión con el servidor');
    });

    it('detener espera a que vuelva el lote en camino y no manda el siguiente', async () => {
      mount();
      const rows = Array.from({ length: 260 }, (_, i) => `M-${i + 1};Producto ${i + 1}`);
      await upload(['codigo;marca', ...rows].join('\n'), []);
      review();

      publishByClick();
      const inFlight = http.expectOne(bulkUrl(PHARMACY.id));
      expect(inFlight.request.body.rows).toHaveLength(250);
      (byId('import-stop') as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(textOf('import-stop')).toContain('Deteniendo después de este lote');
      // El lote en vuelo no se cancela: puede haberse guardado en el servidor.
      expect(inFlight.cancelled).toBe(false);
      bulkAnswer(inFlight);
      fixture.detectChanges();

      http.expectNone(bulkUrl(PHARMACY.id));
      expect(textOf('import-result')).toMatch(/250\s+productos publicados/);
      expect(byId('import-stopped')).not.toBeNull();
      expect(textOf('import-results')).toContain('Sin enviar');
    });

    it('mientras carga avisa al cerrar la pestaña, y después ya no', async () => {
      mount();
      await upload(CSV);
      review();
      const event = (): Event => new Event('beforeunload', { cancelable: true });

      const idle = event();
      window.dispatchEvent(idle);
      expect(idle.defaultPrevented).toBe(false);

      publishByClick();
      const loading = event();
      window.dispatchEvent(loading);
      expect(loading.defaultPrevented).toBe(true);

      internal().stop();
      bulkAnswer(http.expectOne(bulkUrl(PHARMACY.id)));
      fixture.detectChanges();
      const done = event();
      window.dispatchEvent(done);
      expect(done.defaultPrevented).toBe(false);
    });

    it('«Ver productos» lleva al catálogo', async () => {
      mount();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      await upload('codigo;marca\nA-1;Uno\n', []);
      review();
      publishByClick();
      bulkAnswer(http.expectOne(bulkUrl(PHARMACY.id)));
      fixture.detectChanges();

      (byId('import-view-products') as HTMLButtonElement).click();

      expect(navigate).toHaveBeenCalledWith('/administration/pharmacy-catalog');
    });

    it('«Importar otro archivo» vuelve al primer paso sin restos del anterior', async () => {
      mount();
      await upload('codigo;marca\nA-1;Uno\n', []);
      review();
      publishByClick();
      bulkAnswer(http.expectOne(bulkUrl(PHARMACY.id)));
      fixture.detectChanges();

      const buttons = Array.from(root().querySelectorAll('.import__footer button'));
      (buttons.find((b) => b.textContent?.includes('Importar otro archivo')) as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(internal().step()).toBe('file');
      expect(byId('import-result')).toBeNull();
      expect(root().querySelector('app-file-input')).not.toBeNull();
    });
  });
});
