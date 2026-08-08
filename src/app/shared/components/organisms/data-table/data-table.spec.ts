import { readFileSync } from 'node:fs';

import { Component, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { loading, offline, ready, stale } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { DataTable } from './data-table';
import type { ColumnDef, CursorState, SortState } from './data-table.types';

const DATA_TABLE_CSS = 'src/app/shared/components/organisms/data-table/data-table.css';

interface Paciente {
  readonly id: string;
  readonly apellido: string;
  readonly documento: string;
  readonly obraSocial: string;
}

const FILAS: readonly Paciente[] = [
  { id: 'p-1', apellido: 'Peña', documento: '4821133', obraSocial: 'Caja Nacional' },
  { id: 'p-2', apellido: 'Salas', documento: '7233901', obraSocial: 'Particular' },
];

/** `priority` 1 = imprescindible; ≥ 2 se pliega al detalle en móvil. */
const COLUMNAS: readonly ColumnDef<Paciente>[] = [
  { key: 'apellido', header: 'Apellido', priority: 1, sortable: true },
  { key: 'documento', header: 'Documento', priority: 1, align: 'end' },
  { key: 'obraSocial', header: 'Obra social', priority: 2 },
];

@Component({
  imports: [DataTable],
  template: `
    <app-data-table
      [state]="state()"
      [columns]="columnas"
      [trackBy]="porId"
      [caption]="caption()"
      [selectable]="selectable()"
      [sort]="sort()"
      [cursor]="cursor()"
      (sortChanged)="ordenes.push($event)"
      (cursorChanged)="cursores.push($event)"
      (selectionChanged)="selecciones.push($event)"
      (retry)="reintentos = reintentos + 1"
      (refresh)="refrescos = refrescos + 1"
    />
  `,
})
class HostComponent {
  readonly state = signal<ViewState<readonly Paciente[]>>(ready(FILAS));
  readonly columnas = COLUMNAS;
  readonly porId = (row: Paciente): string => row.id;
  readonly caption = signal('Pacientes del servicio');
  readonly selectable = signal(false);
  readonly sort = signal<SortState | null>(null);
  readonly cursor = signal<CursorState>({});
  readonly ordenes: SortState[] = [];
  readonly cursores: string[] = [];
  readonly selecciones: (readonly Paciente[])[] = [];
  reintentos = 0;
  refrescos = 0;
}

describe('DataTable', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function encabezados(): HTMLTableCellElement[] {
    return [...root().querySelectorAll<HTMLTableCellElement>('thead th')];
  }

  function botonPorTexto(texto: string): HTMLButtonElement | undefined {
    return [...root().querySelectorAll('button')].find(
      (boton) => boton.textContent?.trim() === texto,
    );
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    await fixture.whenStable();
  });

  describe('semántica de tabla', () => {
    it('es una <table> de verdad, no divs con role', () => {
      expect(root().querySelector('table')).not.toBeNull();
      expect(root().querySelector('[role="table"]')).toBeNull();
      expect(root().querySelector('thead')).not.toBeNull();
    });

    it('tiene caption, aunque sea solo para lectores de pantalla', () => {
      const caption = root().querySelector('caption');

      expect(caption?.textContent?.trim()).toBe('Pacientes del servicio');
      expect(caption?.classList.contains('sr-only')).toBe(true);
    });

    it('cada encabezado declara scope="col"', () => {
      for (const th of encabezados()) {
        expect(th.getAttribute('scope')).toBe('col');
      }
    });

    it('pinta una fila por dato', () => {
      expect(root().querySelectorAll('tbody tr.data-table__row')).toHaveLength(2);
      expect(root().textContent).toContain('Peña');
      expect(root().textContent).toContain('4821133');
    });
  });

  describe('delegación de estados', () => {
    it('los 9 estados los dibuja el view-state-host, no la tabla', () => {
      expect(root().querySelector('app-view-state-host')).not.toBeNull();
    });

    it('cargando no muestra la tabla', async () => {
      host.state.set(loading());
      await fixture.whenStable();

      expect(root().querySelector('table')).toBeNull();
      expect(root().querySelector('app-skeleton')).not.toBeNull();
    });

    /**
     * Delegar los estados obliga a **devolver** lo que el host emite.
     *
     * Sin esto el botón «Reintentar» de S8/S9 se dibujaba dentro de la tabla y
     * no hacía absolutamente nada: el host emitía `retry`, la tabla no lo
     * escuchaba, y ahí moría. Un control visible que no responde es peor que no
     * ofrecerlo — quien lo pulsa concluye que la aplicación está rota, y tiene
     * razón.
     */
    it('reemite el reintento del host: el botón de S8 tiene que hacer algo', async () => {
      host.state.set(offline());
      await fixture.whenStable();

      const boton = botonPorTexto('Reintentar');
      expect(boton, 'el host de estados dibuja el botón de reintento').toBeDefined();

      boton?.click();
      await fixture.whenStable();

      expect(host.reintentos).toBe(1);
    });

    it('reemite el pedido de datos frescos de S7', async () => {
      host.state.set(stale(FILAS, new Date('2026-08-01T10:00:00Z')));
      await fixture.whenStable();

      const boton = botonPorTexto('Actualizar');
      expect(boton, 'el host de estados dibuja el botón de refresco').toBeDefined();

      boton?.click();
      await fixture.whenStable();

      expect(host.refrescos).toBe(1);
    });
  });

  describe('orden', () => {
    it('solo las columnas ordenables declaran aria-sort', () => {
      const [apellido, documento] = encabezados();

      expect(apellido.getAttribute('aria-sort')).toBe('none');
      expect(documento.hasAttribute('aria-sort')).toBe(false);
    });

    it('aria-sort refleja la dirección activa', async () => {
      host.sort.set({ key: 'apellido', direction: 'asc' });
      await fixture.whenStable();

      expect(encabezados()[0].getAttribute('aria-sort')).toBe('ascending');

      host.sort.set({ key: 'apellido', direction: 'desc' });
      await fixture.whenStable();
      expect(encabezados()[0].getAttribute('aria-sort')).toBe('descending');
    });

    it('emite el CÓDIGO de la columna, nunca su etiqueta', async () => {
      encabezados()[0].querySelector('button')?.click();
      await fixture.whenStable();

      expect(host.ordenes).toEqual([{ key: 'apellido', direction: 'asc' }]);
      expect(host.ordenes[0].key).not.toBe('Apellido');
    });

    it('vuelve a pulsar y da vuelta la dirección', async () => {
      host.sort.set({ key: 'apellido', direction: 'asc' });
      await fixture.whenStable();

      encabezados()[0].querySelector('button')?.click();
      await fixture.whenStable();

      expect(host.ordenes.at(-1)).toEqual({ key: 'apellido', direction: 'desc' });
    });

    it('una columna no ordenable no ofrece botón', () => {
      expect(encabezados()[1].querySelector('button')).toBeNull();
    });
  });

  describe('paginación por cursor', () => {
    it('no hay números de página ni total: un cursor no los conoce', async () => {
      host.cursor.set({ nextCursor: 'cur-sig' });
      await fixture.whenStable();

      const paginacion = root().querySelector('nav[aria-label="Paginación del listado"]');

      expect(paginacion?.textContent).toContain('Anterior');
      expect(paginacion?.textContent).toContain('Siguiente');
      expect(paginacion?.textContent).not.toMatch(/\d/);
      expect(root().querySelector('app-pagination')).toBeNull();
    });

    /**
     * Antes los dos botones se dibujaban siempre, apagados. Eran controles
     * muertos: ocupan lugar, prometen una función que no existe y hacen que la
     * pantalla parezca rota.
     *
     * El caso no es hipotético — la búsqueda del catálogo de terminología no
     * pagina, porque la API la acota con `limit` y no publica cursor— y tampoco
     * es raro: cualquier listado que entra en una sola página cae acá.
     */
    it('sin cursores, la paginación no se dibuja', () => {
      expect(root().querySelector('nav[aria-label="Paginación del listado"]')).toBeNull();
      expect(botonPorTexto('Anterior')).toBeUndefined();
      expect(botonPorTexto('Siguiente')).toBeUndefined();
    });

    it('con un solo cursor, la paginación aparece y el otro botón queda apagado', async () => {
      // La primera página del listado de pacientes: hay siguiente y no hay
      // anterior. El control tiene que estar, y tiene que decir que no se puede.
      host.cursor.set({ nextCursor: 'cur-sig' });
      await fixture.whenStable();

      expect(botonPorTexto('Anterior')?.getAttribute('aria-disabled')).toBe('true');
      expect(botonPorTexto('Siguiente')?.getAttribute('aria-disabled')).not.toBe('true');
    });

    it('emite el cursor recibido, no un número', async () => {
      host.cursor.set({ prevCursor: 'cur-ant', nextCursor: 'cur-sig' });
      await fixture.whenStable();

      botonPorTexto('Siguiente')?.click();
      await fixture.whenStable();
      expect(host.cursores).toEqual(['cur-sig']);

      botonPorTexto('Anterior')?.click();
      await fixture.whenStable();
      expect(host.cursores).toEqual(['cur-sig', 'cur-ant']);
    });
  });

  describe('selección', () => {
    beforeEach(async () => {
      host.selectable.set(true);
      await fixture.whenStable();
    });

    it('«seleccionar todo» abarca solo la página visible', () => {
      const cabecera = encabezados()[0].querySelector('app-checkbox');

      expect(cabecera?.textContent).toContain('Seleccionar las filas visibles');
      // no promete «todo el conjunto»: con cursor no se conoce
      expect(cabecera?.textContent).not.toContain('todos los resultados');
    });

    it('marca y desmarca las filas visibles', async () => {
      const casillaCabecera = encabezados()[0].querySelector<HTMLInputElement>('input');
      casillaCabecera?.click();
      await fixture.whenStable();

      expect(host.selecciones.at(-1)).toHaveLength(2);

      casillaCabecera?.click();
      await fixture.whenStable();
      expect(host.selecciones.at(-1)).toHaveLength(0);
    });

    it('con selección parcial, la cabecera queda indeterminada', async () => {
      const primeraFila = root().querySelector<HTMLInputElement>('tbody input[type="checkbox"]');
      primeraFila?.click();
      await fixture.whenStable();

      const casillaCabecera = encabezados()[0].querySelector<HTMLInputElement>('input');
      expect(casillaCabecera?.indeterminate).toBe(true);
      expect(casillaCabecera?.checked).toBe(false);
    });
  });

  describe('prioridad en móvil', () => {
    it('las columnas de baja prioridad NO se ocultan: van al detalle', async () => {
      // el encabezado secundario existe en el DOM (el CSS lo pliega en móvil)
      const secundarias = root().querySelectorAll('.data-table__secondary');
      expect(secundarias.length).toBeGreaterThan(0);

      const detalle = root().querySelector<HTMLButtonElement>('.data-table__detail-toggle');
      expect(detalle?.getAttribute('aria-expanded')).toBe('false');

      detalle?.click();
      await fixture.whenStable();

      const fila = root().querySelector('.data-table__detail-row');
      expect(fila?.textContent).toContain('Obra social');
      expect(fila?.textContent).toContain('Caja Nacional');
    });

    it('el CSS pliega, no oculta contenido clínico, y es mobile-first', () => {
      const css = readFileSync(DATA_TABLE_CSS, 'utf8');

      expect(css).not.toContain('max-width:');
      expect(css).toContain('@media (min-width: 780px)');
      // la fila de detalle existe justamente para no perder esas columnas
      expect(css).toContain('.data-table__detail-row');
    });
  });
});
