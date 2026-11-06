import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import type { BulkRowResult } from '../../../../core/data-access/pharmacy/pharmacy-bulk.types';
import type { PharmacyDirectoryPage } from '../../../../core/data-access/pharmacy/pharmacy.types';
import { CsvExportService } from '../../../../shared/utils/csv-export/csv-export';
import type { ImportEntity } from './entity-csv';
import { EntityImport } from './entity-import';

const PHARMACY = { id: '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63', name: 'Farmacia del Centro' };
const DIRECTORY: PharmacyDirectoryPage = {
  items: [{ ...PHARMACY, code: 'FC-01', siteCount: 1, productCount: 1 }],
  count: 1,
};

interface Internal {
  onFilesChange: (files: readonly File[]) => Promise<void>;
}

describe('EntityImport', () => {
  let fixture: ComponentFixture<EntityImport>;
  let http: HttpTestingController;
  let download: ReturnType<typeof vi.fn>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);
  const textOf = (id: string): string => byId(id)?.textContent ?? '';
  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const bulkUrl = (entity: string): string => `/pharmacies/${PHARMACY.id}/${entity}/bulk`;

  function mount(entity: ImportEntity): void {
    fixture = TestBed.createComponent(EntityImport);
    fixture.componentRef.setInput('entity', entity);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/pharmacy/pharmacies')).flush(DIRECTORY);
    fixture.detectChanges();
  }

  async function upload(content: string): Promise<void> {
    await internal().onFilesChange([new File([content], 'carga.csv', { type: 'text/csv' })]);
    fixture.detectChanges();
  }

  function answer(request: TestRequest, outcomes: (index: number) => Partial<BulkRowResult> = () => ({})): void {
    const body = request.request.body as { dryRun?: boolean; rows: unknown[] };
    request.flush({
      dryRun: body.dryRun === true,
      results: body.rows.map((_, index) => ({ row: index + 1, outcome: 'CREATED', ...outcomes(index) })),
    });
    fixture.detectChanges();
  }

  function click(id: string): void {
    (byId(id) as HTMLButtonElement).click();
    fixture.detectChanges();
  }

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

  it('«Descargar plantilla» baja el CSV de la entidad con sus encabezados en castellano', () => {
    mount('categories');

    click('entity-import-template');

    const [rows, columns, filename] = download.mock.calls[0]!;
    expect(filename).toBe('plantilla-categorias.csv');
    expect((columns as { header: string }[]).map((column) => column.header)).toEqual(['nombre']);
    const first = (rows as string[][])[0]!;
    expect((columns as { value: (row: string[]) => string }[])[0]!.value(first)).toBe('Vitaminas');
  });

  it('sin farmacia publicada igual muestra las columnas y la plantilla: el formato no depende de ella', () => {
    fixture = TestBed.createComponent(EntityImport);
    fixture.componentRef.setInput('entity', 'categories');
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/pharmacy/pharmacies')).flush({ items: [], count: 0 });
    fixture.detectChanges();

    expect(root().textContent).toContain('Su organización todavía no tiene una farmacia publicada.');
    expect(byId('entity-import-categories')).toBeNull();
    expect(root().querySelector('app-import-columns-help')?.textContent).toContain('nombre');
    click('entity-import-template');
    expect(download.mock.calls[0]![2]).toBe('plantilla-categorias.csv');
  });

  it('subir el archivo pide la vista previa con dryRun y muestra el resultado y el motivo de cada fila', async () => {
    mount('categories');
    await upload('nombre;nota\nVitaminas;\n;vacía\nTercera;\nvitaminas;\nOtra;\n');

    // While the dry run is in flight the dropzone shows its upload spinner.
    expect(fixture.nativeElement.querySelector('[data-testid="file-input-uploading"]')).not.toBeNull();
    // «Vitaminas» y «vitaminas» son la misma clave: no viaja ninguna de las dos.
    const preview = http.expectOne(bulkUrl('categories'));
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual({
      mode: 'UPSERT',
      dryRun: true,
      rows: [{ name: '' }, { name: 'Tercera' }, { name: 'Otra' }],
    });
    answer(preview, (index) =>
      index === 0
        ? { outcome: 'REJECTED', errors: [{ field: 'name', reason: 'REQUIRED', message: 'El nombre es obligatorio' }] }
        : index === 1
          ? { outcome: 'REJECTED', errors: [{ field: 'name', reason: 'DUPLICATE_IN_FILE' }] }
          : {},
    );

    expect(textOf('entity-import-figures')).toMatch(/1\s+se crearían/);
    expect(textOf('entity-import-figures')).toMatch(/2\s+rechazadas por el servidor/);
    const table = textOf('entity-import-rows');
    expect(table).toContain('Creado');
    expect(table).toContain('El nombre es obligatorio');
    expect(table).toContain('La clave aparece más de una vez en el archivo.');
    expect(table).toContain('La misma clave está en las líneas 2, 5: no se envía ninguna.');
    expect(textOf('entity-import-ignored')).toContain('nota');
  });

  it('en el teléfono el motivo va en la ficha de cada fila, no detrás del detalle', async () => {
    mount('categories');
    await upload('nombre;nota\n;vacía\n');
    answer(http.expectOne(bulkUrl('categories')), () => ({
      outcome: 'REJECTED',
      errors: [{ field: 'name', reason: 'REQUIRED', message: 'El nombre es obligatorio' }],
    }));

    const table = byId('entity-import-rows');
    expect(table?.classList).toContain('data-table--apilada');
    expect(table?.querySelector('.data-table__secondary')).toBeNull();
    expect(table?.querySelector('.data-table__detail-toggle')).toBeNull();
  });

  it('«Aplicar» manda lo mismo sin dryRun y muestra el resultado escrito', async () => {
    mount('categories');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await upload('nombre\nVitaminas\nBebés\n');
    answer(http.expectOne(bulkUrl('categories')));
    expect(textOf('entity-import-apply')).toContain('Aplicar 2 filas');

    click('entity-import-apply');
    expect(byId('entity-import-apply')?.getAttribute('aria-busy')).toBe('true');

    const write = http.expectOne(bulkUrl('categories'));
    expect(write.request.body).toEqual({ mode: 'UPSERT', rows: [{ name: 'Vitaminas' }, { name: 'Bebés' }] });
    answer(write, (index) =>
      index === 0
        ? { outcome: 'UPDATED', id: 'c-1' }
        : { outcome: 'REJECTED', errors: [{ field: 'name', reason: 'TOO_LONG', message: 'El nombre es muy largo' }] },
    );

    expect(textOf('entity-import-figures')).toMatch(/1\s+actualizadas/);
    const table = textOf('entity-import-rows');
    expect(table).toContain('Actualizado');
    expect(table).toContain('El nombre es muy largo');
    expect(byId('entity-import-apply')).toBeNull();

    click('entity-import-done');
    expect(navigate).toHaveBeenCalledWith('/administration/pharmacy-catalog?tab=categories');
  });

  it('no ofrece elegir el modo: siempre manda `UPSERT` y lo dice', async () => {
    mount('categories');
    expect(root().querySelector('[aria-label="Qué hacer con las filas del archivo"]')).toBeNull();
    expect(textOf('entity-import-upsert')).toContain('Lo nuevo se crea y lo que ya existe se actualiza');

    await upload('nombre\nVitaminas\n');
    const preview = http.expectOne(bulkUrl('categories'));
    expect(preview.request.body).toEqual({ mode: 'UPSERT', dryRun: true, rows: [{ name: 'Vitaminas' }] });
    answer(preview);
  });

  it('un 413 se dice en pantalla y no deja aplicar', async () => {
    mount('categories');
    await upload('nombre\nVitaminas\n');

    http
      .expectOne(bulkUrl('categories'))
      .flush({ message: 'request entity too large' }, { status: 413, statusText: 'Payload Too Large' });
    fixture.detectChanges();

    expect(textOf('entity-import-failure')).toContain('pasó de 1 MB');
    expect(byId('entity-import-apply')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('un error de red al aplicar se dice en pantalla y lo que no salió queda «sin enviar»', async () => {
    mount('categories');
    await upload('nombre\nVitaminas\n');
    answer(http.expectOne(bulkUrl('categories')));

    click('entity-import-apply');
    http.expectOne(bulkUrl('categories')).error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();

    expect(textOf('entity-import-failure')).toContain('Sin conexión con el servidor');
    expect(textOf('entity-import-rows')).toContain('Sin enviar');
  });

  it('un archivo sin la columna obligatoria no se manda', async () => {
    mount('categories');
    await upload('categoria\nVitaminas\n');

    expect(textOf('entity-import-file-error')).toContain('Falta la columna «nombre»');
    http.expectNone(bulkUrl('categories'));
    expect(byId('entity-import-review')).toBeNull();
  });
});
