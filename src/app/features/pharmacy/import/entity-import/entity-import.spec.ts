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
  setMode: (mode: 'CREATE' | 'UPDATE' | 'UPSERT' | null) => void;
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
    mount('sites');

    click('entity-import-template');

    const [rows, columns, filename] = download.mock.calls[0]!;
    expect(filename).toBe('plantilla-sucursales.csv');
    expect((columns as { header: string }[]).map((column) => column.header)).toEqual([
      'codigo',
      'nombre',
      'direccion',
      'latitud',
      'longitud',
      'retiro',
      'envio',
    ]);
    const first = (rows as string[][])[0]!;
    expect((columns as { value: (row: string[]) => string }[])[5]!.value(first)).toBe('si');
  });

  it('sucursales: avisa que se crean como sedes de venta y no en «Sucursales»', () => {
    mount('sites');

    expect(textOf('entity-import-note')).toContain('sedes de venta');
    expect(textOf('entity-import-note')).toContain('Horario y turnos');
    expect(textOf('entity-import-note')).toContain('no en la pantalla «Sucursales»');
  });

  it('subir el archivo pide la vista previa con dryRun y muestra el resultado y el motivo de cada fila', async () => {
    mount('categories');
    await upload('nombre;nota\nVitaminas;\n;vacía\nvitaminas;\n');

    const preview = http.expectOne(bulkUrl('categories'));
    expect(preview.request.method).toBe('POST');
    expect(preview.request.body).toEqual({
      mode: 'UPSERT',
      dryRun: true,
      rows: [{ name: 'Vitaminas' }, { name: '' }, { name: 'vitaminas' }],
    });
    answer(preview, (index) =>
      index === 1
        ? { outcome: 'REJECTED', errors: [{ field: 'name', reason: 'REQUIRED', message: 'El nombre es obligatorio' }] }
        : index === 2
          ? { outcome: 'REJECTED', errors: [{ field: 'name', reason: 'DUPLICATE_IN_FILE' }] }
          : {},
    );

    expect(textOf('entity-import-figures')).toMatch(/1\s+se crearían/);
    expect(textOf('entity-import-figures')).toMatch(/2\s+rechazadas por el servidor/);
    const table = textOf('entity-import-rows');
    expect(table).toContain('Creado');
    expect(table).toContain('El nombre es obligatorio');
    expect(table).toContain('La clave aparece más de una vez en el archivo.');
    expect(textOf('entity-import-ignored')).toContain('nota');
  });

  it('«Aplicar» manda lo mismo sin dryRun y muestra el resultado escrito', async () => {
    mount('prices');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    await upload('codigo,precio\nF05B-1,"12,50"\nF05B-X,3\nF05B-2,doce\n');
    answer(http.expectOne(bulkUrl('prices')));
    expect(textOf('entity-import-apply')).toContain('Aplicar 2 filas');

    click('entity-import-apply');

    const write = http.expectOne(bulkUrl('prices'));
    expect(write.request.body).toEqual({
      mode: 'UPSERT',
      rows: [
        { productCode: 'F05B-1', unitPrice: 12.5 },
        { productCode: 'F05B-X', unitPrice: 3 },
      ],
    });
    answer(write, (index) =>
      index === 0
        ? { outcome: 'UPDATED', id: 'pr-1' }
        : { outcome: 'REJECTED', errors: [{ field: 'productCode', reason: 'PRODUCT_NOT_FOUND', message: 'No hay un producto con ese código' }] },
    );

    expect(textOf('entity-import-figures')).toMatch(/1\s+actualizadas/);
    expect(textOf('entity-import-figures')).toMatch(/1\s+no enviadas por errores del archivo/);
    const table = textOf('entity-import-rows');
    expect(table).toContain('Actualizado');
    expect(table).toContain('No hay un producto con ese código');
    expect(table).toContain('No enviada');
    expect(byId('entity-import-apply')).toBeNull();

    click('entity-import-done');
    expect(navigate).toHaveBeenCalledWith('/administration/pharmacy-catalog?tab=prices');
  });

  it('cambiar el modo vuelve a pedir la vista previa con el modo nuevo', async () => {
    mount('sites');
    await upload('codigo,nombre\nSUR,Sucursal Sur\n');
    answer(http.expectOne(bulkUrl('sites')));

    internal().setMode('UPDATE');
    fixture.detectChanges();

    const again = http.expectOne(bulkUrl('sites'));
    expect(again.request.body).toEqual({ mode: 'UPDATE', dryRun: true, rows: [{ code: 'SUR', name: 'Sucursal Sur' }] });
    answer(again, () => ({ outcome: 'REJECTED', errors: [{ field: 'code', reason: 'NOT_FOUND' }] }));
    expect(textOf('entity-import-rows')).toContain('No existe: eligió sólo actualizar.');
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
    mount('prices');
    await upload('codigo\nP-1\n');

    expect(textOf('entity-import-file-error')).toContain('Falta la columna «precio»');
    http.expectNone(bulkUrl('prices'));
    expect(byId('entity-import-review')).toBeNull();
  });
});
