import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BranchDraft } from '../../../utils/branch-import/branch-import';
import { CsvExportService } from '../../../utils/csv-export/csv-export';
import { BranchBulkImport } from './branch-bulk-import';

/**
 * «Subir sucursales en lote»: revisa el CSV sin mandar nada, dice qué filas
 * valen y cuáles no, y recién al confirmar emite las válidas.
 */
interface Internal {
  choose: (files: readonly File[]) => Promise<void>;
  confirm: () => void;
  downloadTemplate: () => void;
}

describe('BranchBulkImport', () => {
  let fixture: ComponentFixture<BranchBulkImport>;
  let emitted: (readonly BranchDraft[])[];
  const download = vi.fn();

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);
  const text = (id: string): string => byTestId(id)?.textContent?.trim() ?? '';

  async function upload(content: string): Promise<void> {
    await internal().choose([new File([content], 'sucursales.csv', { type: 'text/csv' })]);
    fixture.detectChanges();
  }

  beforeEach(() => {
    emitted = [];
    download.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: CsvExportService, useValue: { download } }],
    });
    fixture = TestBed.createComponent(BranchBulkImport);
    fixture.componentRef.setInput('existingNames', ['Central']);
    fixture.componentInstance.imported.subscribe((drafts) => emitted.push(drafts));
    fixture.detectChanges();
  });

  it('muestra las columnas del archivo con la obligatoria marcada', () => {
    const columnas = root().querySelector('[aria-label="Columnas del archivo"]')?.textContent ?? '';

    expect(columnas).toContain('nombre');
    expect(columnas).toContain('descripcion');
    expect(columnas).toContain('url_ubicacion');
    expect(columnas).toContain('obligatoria');
  });

  it('revisa el archivo: cuenta las buenas, lista las malas con su línea y no emite nada', async () => {
    await upload(
      'nombre;descripcion;url_ubicacion\n' +
        'Norte;Planta baja;https://www.google.com/maps/@-17.76,-63.19,17z\n' +
        'Central;repetida;\n' +
        ';sin nombre;\n',
    );

    expect(text('branch-import-valid-count')).toBe('1');
    expect(text('branch-import-problem-count')).toBe('2');
    expect(text('branch-import-problems')).toContain('Línea 3');
    expect(text('branch-import-problems')).toContain('Línea 4');
    expect(text('branch-import-preview')).toContain('Norte');
    expect(text('branch-import-preview')).toContain('Punto en el mapa');
    expect(emitted).toEqual([]);
  });

  it('al confirmar emite sólo las válidas', async () => {
    await upload('nombre,descripcion\nNorte,Planta baja\nSur,\n');

    expect(text('branch-import-confirm')).toBe('Agregar 2 sucursales');
    internal().confirm();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]!.map((draft) => draft.name)).toEqual(['Norte', 'Sur']);
  });

  it('un archivo sin columna nombre se rechaza entero y no deja confirmar', async () => {
    await upload('descripcion\nalgo\n');

    expect(text('branch-import-file-error')).toContain('Falta la columna «nombre»');
    expect((byTestId('branch-import-confirm') as HTMLButtonElement).getAttribute('aria-disabled')).toBe(
      'true',
    );
    internal().confirm();
    expect(emitted).toEqual([]);
  });

  it('la plantilla trae las cinco columnas en orden', () => {
    internal().downloadTemplate();

    expect(download).toHaveBeenCalledTimes(1);
    const [rows, columns, filename] = download.mock.calls[0]!;
    expect(filename).toBe('plantilla-sucursales.csv');
    expect((columns as { header: string }[]).map((c) => c.header)).toEqual([
      'nombre',
      'descripcion',
      'url_ubicacion',
      'direccion',
      'codigo',
    ]);
    expect((rows as unknown[]).length).toBeGreaterThan(0);
  });
});
