import { Component, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FilterBar, SEARCH_PARAM, type FilterDef } from './filter-bar';

@Component({ selector: 'app-listado-prueba', template: '' })
class VistaListado {}

const FILTROS: readonly FilterDef[] = [
  {
    key: 'servicio',
    label: 'Servicio',
    options: [
      { value: 'card', label: 'Cardiología' },
      { value: 'pedi', label: 'Pediatría' },
    ],
  },
  {
    key: 'estado',
    label: 'Estado',
    options: [{ value: 'act', label: 'Activo' }],
  },
];

/** Filtro cuyo value set no llegó: debe quedar deshabilitado, no libre. */
const FILTRO_SIN_VALUE_SET: FilterDef = {
  key: 'diagnostico',
  label: 'Diagnóstico',
  options: [],
  unavailableReason: 'No se pudo cargar el catálogo de diagnósticos.',
};

@Component({
  imports: [FilterBar],
  template: `
    <app-filter-bar [filters]="filtros()" (filtersChanged)="emisiones.push($event)" />
  `,
})
class HostComponent {
  readonly filtros = signal<readonly FilterDef[]>(FILTROS);
  readonly emisiones: Readonly<Record<string, string>>[] = [];
}

describe('FilterBar', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let router: Router;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function chips(): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>('app-chip')];
  }

  function selects(): HTMLSelectElement[] {
    return [...root().querySelectorAll<HTMLSelectElement>('select')];
  }

  async function irA(queryParams: Record<string, string>): Promise<void> {
    await router.navigate(['/listado'], { queryParams });
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([{ path: 'listado', component: VistaListado }])],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    router = TestBed.inject(Router);
    await router.navigate(['/listado']);
    await fixture.whenStable();
  });

  describe('la URL es la fuente de verdad', () => {
    it('sin query params no hay filtros activos', () => {
      expect(chips()).toHaveLength(0);
    });

    it('los filtros de la URL se reflejan como chips al entrar', async () => {
      await irA({ servicio: 'card' });

      expect(chips()).toHaveLength(1);
      expect(chips()[0].textContent).toContain('Cardiología');
    });

    it('recargar con la misma URL reproduce el mismo estado', async () => {
      await irA({ servicio: 'card', [SEARCH_PARAM]: 'peña' });

      const otra = TestBed.createComponent(HostComponent);
      await otra.whenStable();

      const chipsNuevos = (otra.nativeElement as HTMLElement).querySelectorAll('app-chip');
      expect(chipsNuevos).toHaveLength(1);
      expect(chipsNuevos[0].textContent).toContain('Cardiología');
      otra.destroy();
    });

    it('elegir un filtro lo escribe en la URL', async () => {
      selects()[0].value = '0';
      selects()[0].dispatchEvent(new Event('change'));
      await fixture.whenStable();

      expect(router.url).toContain('servicio=card');
    });

    it('el estado no se guarda aparte: cambiar la URL manda', async () => {
      await irA({ servicio: 'card' });
      expect(chips()).toHaveLength(1);

      await irA({});
      expect(chips()).toHaveLength(0);
    });
  });

  describe('chips activos', () => {
    it('muestran la etiqueta legible, no el código', async () => {
      await irA({ servicio: 'card' });

      expect(chips()[0].textContent).toContain('Servicio: Cardiología');
      expect(chips()[0].textContent).not.toContain('card');
    });

    it('emiten el CÓDIGO, no la etiqueta', async () => {
      await irA({ servicio: 'card' });
      host.emisiones.length = 0;

      // quitar un chip dispara una emisión con lo que queda
      await irA({ servicio: 'card', estado: 'act' });
      const quitar = chips()[0].querySelector<HTMLButtonElement>('.chip__remove');
      quitar?.click();
      await fixture.whenStable();

      const ultima = host.emisiones.at(-1);
      expect(ultima?.['estado']).toBe('act');
      expect(ultima?.['servicio']).toBeUndefined();
    });

    it('«limpiar todo» vacía la URL', async () => {
      await irA({ servicio: 'card', estado: 'act', [SEARCH_PARAM]: 'peña' });

      const limpiar = [...root().querySelectorAll('button')].find(
        (boton) => boton.textContent?.trim() === 'Limpiar todo',
      );
      limpiar?.click();
      await fixture.whenStable();

      expect(chips()).toHaveLength(0);
      expect(router.url).not.toContain('servicio=');
      expect(router.url).not.toContain('estado=');
    });
  });

  describe('value set no disponible', () => {
    beforeEach(async () => {
      host.filtros.set([...FILTROS, FILTRO_SIN_VALUE_SET]);
      await fixture.whenStable();
    });

    it('el filtro queda deshabilitado, nunca como texto libre', () => {
      const deshabilitados = selects().filter((select) => select.disabled);

      expect(deshabilitados).toHaveLength(1);
      // no hay ningún input de texto suelto haciendo de filtro de terminología
      expect(root().querySelectorAll('.filter-bar__filter input')).toHaveLength(0);
    });

    it('el motivo está a la vista', () => {
      expect(root().querySelector('.filter-bar__unavailable')?.textContent).toContain(
        'No se pudo cargar el catálogo de diagnósticos.',
      );
    });
  });
});
