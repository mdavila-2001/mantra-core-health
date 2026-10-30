import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { TablaReporte } from '@core/data-access/reporting/reporting.types';
import { ReportTable } from './report-table';

const INFO = { definicion: 'd', formula: 'f', fuente: 's', frescura: 'x' };

function table(filas: number, columnas: number, vacia = false): TablaReporte {
  return {
    id: 't',
    titulo: 'Tabla de prueba',
    columnas: Array.from({ length: columnas }, (_, c) => ({ clave: `c${c}`, etiqueta: `Col ${c}` })),
    filas: Array.from({ length: filas }, (_, r) =>
      Object.fromEntries(Array.from({ length: columnas }, (_, c) => [`c${c}`, vacia && c === 1 ? '' : `v${r}-${c}`])),
    ),
    info: INFO,
  };
}

async function mount(t: TablaReporte): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(ReportTable);
  fixture.componentRef.setInput('table', t);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

describe('ReportTable: tarjetas en móvil', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }));

  it('una tabla corta pasa a tarjetas y cada celda lleva su etiqueta de columna', async () => {
    const root = await mount(table(5, 4));
    expect(root.querySelector('.rt')?.classList.contains('rt--cards')).toBe(true);
    const celdas = root.querySelectorAll('tbody td');
    expect(celdas.length).toBeGreaterThan(0);
    expect(celdas[0]?.getAttribute('data-label')).toBe('Col 1');
  });

  it('una tabla con más de 12 filas, o demasiadas celdas, NO pasa a tarjetas: sería una columna interminable', async () => {
    expect((await mount(table(13, 3))).querySelector('.rt')?.classList.contains('rt--cards')).toBe(false);
    expect((await mount(table(12, 6))).querySelector('.rt')?.classList.contains('rt--cards')).toBe(false);
  });

  it('una celda vacía se marca para ocultarla en la tarjeta en vez de dejar una etiqueta sin valor', async () => {
    const root = await mount(table(3, 4, true));
    expect(root.querySelectorAll('td.rt__blank').length).toBe(3);
  });

  it('con 8 columnas o más no parte el texto (la clave no puede quedar fuera de la vista) y avisa del desplazamiento', async () => {
    const ancha = (await mount(table(3, 8))).querySelector('.rt');
    expect(ancha?.classList.contains('rt--wide')).toBe(true);
    expect(ancha?.classList.contains('rt--prose')).toBe(false);
    const corta = (await mount(table(3, 4))).querySelector('.rt');
    expect(corta?.classList.contains('rt--prose')).toBe(true);
    expect(corta?.classList.contains('rt--wide')).toBe(false);
  });

  it('conserva la semántica de tabla aunque en móvil se muestre como tarjetas', async () => {
    const root = await mount(table(2, 3));
    expect(root.querySelector('table')?.getAttribute('role')).toBe('table');
    expect(root.querySelectorAll('tbody tr[role="row"]').length).toBe(2);
    expect(root.querySelectorAll('tbody th[role="rowheader"]').length).toBe(2);
    expect(root.querySelectorAll('thead th[role="columnheader"]').length).toBe(3);
  });
});
