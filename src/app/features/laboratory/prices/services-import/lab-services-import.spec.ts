import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import type {
  LabImportResult,
  LabImportRow,
} from '../../../../core/data-access/lab-portal/lab-portal.types';
import { CsvExportService, toCsv, type CsvColumn } from '../../../../shared/utils/csv-export/csv-export';
import { LabServicesImport } from './lab-services-import';

/**
 * «Importar análisis (CSV)»: revisa el archivo sin mandar nada, manda sólo las
 * filas válidas y muestra lo que respondió la API fila por fila.
 */
interface Internal {
  choose: (files: readonly File[]) => Promise<void>;
  confirm: () => void;
  downloadTemplate: () => void;
  finish: () => void;
}

const CATEGORIES = [
  { id: 'cat-hem', name: 'Hematología', serviceCount: 1 },
  { id: 'cat-qui', name: 'Química sanguínea', serviceCount: 3 },
];

const HEADER =
  'codigo;nombre;categoria;tipo_muestra;precio_bs;descuento_alovida;requiere_orden;horas_resultado;disponible';

describe('LabServicesImport', () => {
  let fixture: ComponentFixture<LabServicesImport>;
  let importServices: ReturnType<typeof vi.fn>;
  let closed: boolean[];
  const download = vi.fn();

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);
  const text = (id: string): string => byTestId(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  async function upload(content: string): Promise<void> {
    await internal().choose([new File([content], 'analisis.csv', { type: 'text/csv' })]);
    fixture.detectChanges();
  }

  function respond(result: LabImportResult): void {
    importServices.mockReturnValue(of(result));
  }

  beforeEach(() => {
    download.mockReset();
    closed = [];
    importServices = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CsvExportService, useValue: { download } },
        {
          provide: LabPortalClient,
          useValue: {
            listServices: vi.fn(() =>
              of({ items: [{ code: 'STUDY-HEMOGRAMA' }, { code: 'OLD-RETIRADO' }], count: 2 }),
            ),
            listCategories: vi.fn(() => of({ items: CATEGORIES, count: CATEGORIES.length })),
            importServices,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(LabServicesImport);
    fixture.componentInstance.closed.subscribe((value) => closed.push(value));
    fixture.detectChanges();
  });

  it('lista las columnas con las obligatorias marcadas y las categorías de hoy', () => {
    const columns = text('lab-import-columns');
    for (const header of ['codigo', 'nombre', 'categoria', 'precio_bs', 'descuento_alovida', 'disponible']) {
      expect(columns).toContain(header);
    }
    expect(columns.match(/obligatoria/g)).toHaveLength(3);
    expect(columns).toContain('Hoy: Hematología, Química sanguínea.');
  });

  it('la plantilla se llama plantilla-analisis-laboratorio.csv y trae los encabezados en orden', () => {
    internal().downloadTemplate();

    expect(download).toHaveBeenCalledTimes(1);
    const [rows, columns, filename] = download.mock.calls[0]! as [
      readonly object[],
      readonly CsvColumn<object>[],
      string,
    ];
    expect(filename).toBe('plantilla-analisis-laboratorio.csv');
    const [headerLine, ...lines] = toCsv(rows, columns).split('\r\n');
    expect(headerLine).toBe(
      'codigo,nombre,categoria,tipo_muestra,preparacion,descripcion,precio_bs,descuento_alovida,' +
        'requiere_orden,toma_a_domicilio,horas_resultado,disponible',
    );
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('LAB-FERRITINA');
    expect(lines[0]).toContain('Química sanguínea');
  });

  it('revisa el archivo: cuenta nuevos, actualizaciones y filas a corregir con su motivo', async () => {
    await upload(
      [
        HEADER,
        'LAB-PCR;Proteína C reactiva;química sanguínea;Sangre venosa;55,50;10;no;24;sí',
        'STUDY-HEMOGRAMA;Hemograma completo;Hematología;Sangre venosa;90;;no;4;si',
        ';Sin código;;;10;;;;',
        'LAB-X;;;;10;;;;',
        'LAB-CARO;Caro;;;ochenta;;;;',
        'LAB-DESC;Descuento alto;;;10;150;;;',
        'LAB-CAT;Categoría inventada;Genética;;10;;;;',
        'LAB-PCR;Repetido;;;10;;;;',
      ].join('\n'),
    );

    expect(text('lab-import-new-count')).toBe('1');
    expect(text('lab-import-update-count')).toBe('1');
    expect(text('lab-import-problem-count')).toBe('6');
    const problems = text('lab-import-problems');
    expect(problems).toContain('Falta el código.');
    expect(problems).toContain('Falta el nombre.');
    expect(problems).toContain('El precio va en bolivianos');
    expect(problems).toContain('El descuento es un número de 0 a 100');
    expect(problems).toContain('La categoría «Genética» no existe. Use una de: Hematología, Química sanguínea.');
    expect(problems).toContain('El código se repite más arriba en el mismo archivo.');
    expect(text('lab-import-confirm')).toBe('Cargar 2 análisis');
    expect(importServices).not.toHaveBeenCalled();
  });

  it('un archivo sin la columna precio_bs se rechaza entero', async () => {
    await upload('codigo,nombre\nLAB-1,Algo\n');

    expect(text('lab-import-file-error')).toContain('Falta la columna «precio_bs»');
    expect(byTestId('lab-import-confirm')?.getAttribute('aria-disabled')).toBe('true');
  });

  it('carga sólo las filas válidas, en modo crear o actualizar, ya convertidas', async () => {
    respond({ created: 1, updated: 1, unchanged: 0, rejected: 0, rows: [] });
    await upload(
      [
        HEADER,
        'LAB-PCR;Proteína C reactiva;química sanguínea;Sangre venosa;55,50;10;no;24;sí',
        'LAB-MAL;Mal;;;gratis;;;;',
        'STUDY-HEMOGRAMA;Hemograma completo;;;90;;;;',
      ].join('\n'),
    );

    internal().confirm();

    expect(importServices).toHaveBeenCalledTimes(1);
    const [mode, rows] = importServices.mock.calls[0]! as [string, readonly LabImportRow[]];
    expect(mode).toBe('CREATE_OR_UPDATE');
    expect(rows).toEqual([
      {
        line: 2,
        service: {
          code: 'LAB-PCR',
          name: 'Proteína C reactiva',
          categoryId: 'cat-qui',
          sampleType: 'Sangre venosa',
          price: '55.50',
          alovidaDiscountPercent: 10,
          requiresMedicalOrder: false,
          turnaroundHours: 24,
          available: true,
        },
      },
      {
        line: 4,
        service: {
          code: 'STUDY-HEMOGRAMA',
          name: 'Hemograma completo',
          categoryId: null,
          sampleType: null,
          price: '90.00',
          alovidaDiscountPercent: null,
          turnaroundHours: null,
        },
      },
    ]);
  });

  it('muestra el resultado de cada fila y al cerrar pide releer la lista', async () => {
    respond({
      created: 1,
      updated: 1,
      unchanged: 1,
      rejected: 1,
      rows: [
        { line: 2, code: 'LAB-A', outcome: 'CREATED', reason: null },
        { line: 3, code: 'LAB-B', outcome: 'UPDATED', reason: null },
        { line: 4, code: 'LAB-C', outcome: 'UNCHANGED', reason: null },
        { line: 5, code: 'LAB-D', outcome: 'REJECTED', reason: 'Ya tiene un servicio con el código «LAB-D».' },
      ],
    });
    await upload('codigo,nombre,precio_bs\nLAB-A,Alfa,1\nLAB-B,Beta,2\nLAB-C,Gama,3\nLAB-D,Delta,4\n');
    internal().confirm();
    fixture.detectChanges();

    expect(text('lab-import-created')).toBe('1');
    expect(text('lab-import-rejected')).toBe('1');
    const table = text('lab-import-result-table');
    expect(table).toContain('Creado');
    expect(table).toContain('Actualizado');
    expect(table).toContain('Sin cambios');
    expect(table).toContain('Rechazado');
    expect(table).toContain('Ya tiene un servicio con el código «LAB-D».');
    expect(table).toContain('Delta');
    expect(byTestId('lab-import-confirm')).toBeNull();

    internal().finish();
    expect(closed).toEqual([true]);
  });

  it('un fallo de la API muestra el código de petición y deja reintentar', async () => {
    importServices.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 500,
            error: { code: 'INTERNAL', message: 'Falló el servidor.', correlationId: 'req-lab-42' },
          }),
      ),
    );
    await upload('codigo,nombre,precio_bs\nLAB-A,Alfa,1\n');
    internal().confirm();
    fixture.detectChanges();

    const error = text('lab-import-error');
    expect(error).toContain('req-lab-42');
    expect(error).toContain('Reintentar');
    expect(byTestId('lab-import-confirm')?.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('cerrar sin cargar nada no pide releer', () => {
    internal().finish();
    expect(closed).toEqual([false]);
  });
});
