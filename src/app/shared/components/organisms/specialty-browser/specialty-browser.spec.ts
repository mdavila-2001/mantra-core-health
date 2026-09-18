import { Component, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { offline, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { SEARCH_PARAM, type FilterDef } from '../filter-bar/filter-bar';
import { SpecialtyBrowser } from './specialty-browser';
import type { SpecialtyGroup } from './specialty-browser.types';

interface Formulario {
  readonly id: string;
  readonly nombre: string;
}

const GRUPOS: readonly SpecialtyGroup<Formulario>[] = [
  {
    conceptId: 'esp-cardio',
    label: 'Cardiología',
    items: [
      { id: 'a', nombre: 'Ficha cardiológica' },
      { id: 'b', nombre: 'Riesgo cardiovascular' },
    ],
  },
  {
    conceptId: 'esp-pedia',
    label: 'Pediatría',
    items: [{ id: 'c', nombre: 'Control de niño sano' }],
  },
];

const FILTROS: readonly FilterDef[] = [
  {
    key: 'origen',
    label: 'Origen',
    options: [
      { value: 'oms', label: 'OMS' },
      { value: 'propio', label: 'De la organización' },
    ],
  },
];

@Component({ selector: 'app-vista-prueba', template: '' })
class VistaPrueba {}

@Component({
  imports: [SpecialtyBrowser],
  template: `
    <app-specialty-browser
      [state]="estado()"
      [groups]="grupos()"
      [filters]="filtros()"
      [hasMore]="hayMas()"
      [collapsible]="plegable()"
      [expandAll]="abrirTodos()"
      noMatchesText="Nada coincide con lo que buscaste."
      (filtersChanged)="emisiones.push($event)"
      (retry)="reintentos = reintentos + 1"
      (moreRequested)="pedidosDeMas = pedidosDeMas + 1"
    >
      <ng-template let-formulario let-grupo="group">
        <article class="tarjeta-prueba" [attr.data-grupo]="grupo.label">
          {{ formulario.nombre }}
        </article>
      </ng-template>
    </app-specialty-browser>
  `,
})
class HostComponent {
  readonly estado = signal<ViewState<unknown>>(ready(null));
  readonly grupos = signal<readonly SpecialtyGroup<Formulario>[]>(GRUPOS);
  readonly filtros = signal<readonly FilterDef[]>(FILTROS);
  readonly hayMas = signal(false);
  readonly plegable = signal(false);
  readonly abrirTodos = signal(false);
  readonly emisiones: Readonly<Record<string, string>>[] = [];
  reintentos = 0;
  pedidosDeMas = 0;
}

describe('SpecialtyBrowser', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let router: Router;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function encabezados(): string[] {
    return [...root().querySelectorAll('.specialty-browser__group-title')].map((titulo) =>
      (titulo.textContent ?? '').trim(),
    );
  }

  function tarjetas(): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>('.tarjeta-prueba')];
  }

  function botonPorTexto(texto: string): HTMLButtonElement | undefined {
    return [...root().querySelectorAll<HTMLButtonElement>('button')].find(
      (boton) => boton.textContent?.trim() === texto,
    );
  }

  async function irA(queryParams: Record<string, string>): Promise<void> {
    await router.navigate(['/catalogo'], { queryParams });
    await fixture.whenStable();
  }

  /** Elegir la primera opción del único desplegable de filtro. */
  async function elegirOrigen(): Promise<void> {
    const select = root().querySelector<HTMLSelectElement>('select');
    if (select) {
      select.value = '0';
      select.dispatchEvent(new Event('change'));
    }
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([{ path: 'catalogo', component: VistaPrueba }])],
    }).compileComponents();

    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    router = TestBed.inject(Router);
    await router.navigate(['/catalogo']);
    await fixture.whenStable();
  });

  describe('la grilla agrupada', () => {
    it('dibuja un encabezado por grupo, en el orden en que llegaron', () => {
      // El organismo no ordena: los grupos llegan ya ordenados por quien tiene
      // los datos, y respetarlos es parte del contrato.
      expect(encabezados()).toHaveLength(2);
      expect(encabezados()[0]).toContain('Cardiología');
      expect(encabezados()[1]).toContain('Pediatría');
    });

    it('cada encabezado dice cuántos trae su tramo', () => {
      expect(encabezados()[0]).toContain('2');
      expect(encabezados()[1]).toContain('1');
    });

    it('los ítems cuelgan de su propio grupo, no de una lista plana', () => {
      const grillas = [...root().querySelectorAll('.specialty-browser__grid')];

      expect(grillas).toHaveLength(2);
      expect(grillas[0].querySelectorAll('li')).toHaveLength(2);
      expect(grillas[1].querySelectorAll('li')).toHaveLength(1);
    });

    it('el encabezado queda atado a su grilla por aria-labelledby', () => {
      const seccion = root().querySelector('.specialty-browser__group');
      const titulo = seccion?.querySelector('.specialty-browser__group-title');

      expect(seccion?.getAttribute('aria-labelledby')).toBe(titulo?.id);
      expect(titulo?.id).toBeTruthy();
    });
  });

  describe('la tarjeta la pone el consumidor', () => {
    it('estampa la plantilla proyectada una vez por ítem, con el ítem correcto', () => {
      expect(tarjetas().map((tarjeta) => tarjeta.textContent?.trim())).toEqual([
        'Ficha cardiológica',
        'Riesgo cardiovascular',
        'Control de niño sano',
      ]);
    });

    it('el contexto lleva también el grupo, para que la tarjeta pueda nombrarlo', () => {
      expect(tarjetas()[0].dataset['grupo']).toBe('Cardiología');
      expect(tarjetas()[2].dataset['grupo']).toBe('Pediatría');
    });

    it('el organismo no dibuja acciones propias: las trae la tarjeta', () => {
      // Sin `hasMore` no hay ningún botón fuera de la barra de filtros: las
      // acciones de un ítem viven en la plantilla proyectada.
      const fueraDelFiltro = [...root().querySelectorAll('button')].filter(
        (boton) => boton.closest('app-filter-bar') === null,
      );

      expect(fueraDelFiltro).toHaveLength(0);
    });
  });

  describe('vacío filtrado ≠ catálogo vacío', () => {
    it('sin nada que mostrar y con un filtro puesto, lo dice', async () => {
      host.grupos.set([]);
      await irA({ origen: 'oms' });

      expect(
        root().querySelector('[data-testid="specialty-browser-empty"]')?.textContent,
      ).toContain('Nada coincide con lo que buscaste.');
    });

    it('el término de búsqueda también cuenta como filtro puesto', async () => {
      host.grupos.set([]);
      await irA({ [SEARCH_PARAM]: 'cardio' });

      expect(root().querySelector('[data-testid="specialty-browser-empty"]')).not.toBeNull();
    });

    it('sin filtros, el vacío es del ViewState y el organismo se calla', async () => {
      host.grupos.set([]);
      await fixture.whenStable();

      // «Todavía no hay nada cargado» lo dice el estado del consumidor; decirlo
      // acá también sería contar dos cosas distintas con la misma frase.
      expect(root().querySelector('[data-testid="specialty-browser-empty"]')).toBeNull();
    });
  });

  describe('retransmisión de eventos', () => {
    it('reemite los filtros de la barra, con el CÓDIGO del value set', async () => {
      await elegirOrigen();

      expect(host.emisiones.at(-1)?.['origen']).toBe('oms');
    });

    it('la búsqueda viaja en la misma emisión, bajo su clave', async () => {
      await irA({ [SEARCH_PARAM]: 'cardio' });
      await elegirOrigen();

      const ultima = host.emisiones.at(-1);
      expect(ultima?.[SEARCH_PARAM]).toBe('cardio');
      expect(ultima?.['origen']).toBe('oms');
    });

    it('reemite el reintento del host de estados: el botón tiene que hacer algo', async () => {
      host.estado.set(offline());
      await fixture.whenStable();

      const boton = botonPorTexto('Reintentar');
      expect(boton, 'el host de estados dibuja el botón de reintento').toBeDefined();

      boton?.click();
      await fixture.whenStable();

      expect(host.reintentos).toBe(1);
    });
  });

  describe('«Cargar más»', () => {
    it('no se dibuja si el consumidor no dijo que hay más', () => {
      expect(root().querySelector('[data-testid="specialty-browser-more"]')).toBeNull();
    });

    it('pide más cuando lo pulsan', async () => {
      host.hayMas.set(true);
      await fixture.whenStable();

      root().querySelector<HTMLButtonElement>('[data-testid="specialty-browser-more"]')?.click();
      await fixture.whenStable();

      expect(host.pedidosDeMas).toBe(1);
    });
  });

  describe('grupos plegables (refactor UX)', () => {
    function grupos(): HTMLDetailsElement[] {
      return [...root().querySelectorAll<HTMLDetailsElement>('details.specialty-browser__group')];
    }

    it('sin collapsible no cambia nada: secciones abiertas como siempre', () => {
      expect(grupos()).toHaveLength(0);
      expect(root().querySelectorAll('section.specialty-browser__group')).toHaveLength(2);
    });

    it('plegables: el primero abierto, el resto cerrado, y el título con su cuenta en el resumen', async () => {
      host.plegable.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(grupos().map((g) => g.open)).toEqual([true, false]);
      expect(grupos()[1].querySelector('summary')?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
        'Pediatría 1',
      );
    });

    it('con expandAll (una búsqueda activa) se abren todos', async () => {
      host.plegable.set(true);
      host.abrirTodos.set(true);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(grupos().map((g) => g.open)).toEqual([true, true]);
    });
  });
});
