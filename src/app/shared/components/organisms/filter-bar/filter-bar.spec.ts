import { readFileSync } from 'node:fs';

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { SearchField } from '../../molecules/search-field/search-field';
import { chooseSelectOption, selectTrigger } from '../../../../../testing/select';
import { FilterBar, SEARCH_PARAM, type FilterDef } from './filter-bar';

@Component({
  selector: 'app-listado-prueba',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-filter-bar [filters]="filtros()" (filtersChanged)="emisiones.push($event)" />
  `,
})
class HostComponent {
  readonly filtros = signal<readonly FilterDef[]>(FILTROS);
  readonly emisiones: Readonly<Record<string, string>>[] = [];
}

@Component({
  imports: [FilterBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-filter-bar [filters]="filtros()">
      <button filter-bar-action type="button">Agregar</button>
    </app-filter-bar>
  `,
})
class HostComponentConProyeccion {
  readonly filtros = signal<readonly FilterDef[]>(FILTROS);
}

@Component({
  imports: [FilterBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-filter-bar [filters]="filtros()">
      <button filter-bar-action type="button">Primero</button>
      <button filter-bar-action type="button">Segundo</button>
    </app-filter-bar>
  `,
})
class HostComponentConDosProyecciones {
  readonly filtros = signal<readonly FilterDef[]>(FILTROS);
}

/** Dos tablas en la misma pantalla, cada una con su barra y su clave de búsqueda. */
@Component({
  imports: [FilterBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-filter-bar searchParam="qTitulos" (filtersChanged)="titulos.push($event)" />
    <app-filter-bar searchParam="qMatriculas" (filtersChanged)="matriculas.push($event)" />
  `,
})
class HostComponentConDosBarras {
  readonly titulos: Readonly<Record<string, string>>[] = [];
  readonly matriculas: Readonly<Record<string, string>>[] = [];
}

/** Búsqueda fuera de la URL: el término lo guarda quien consume. */
@Component({
  imports: [FilterBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-filter-bar
      [filters]="filtros()"
      [searchInUrl]="false"
      [searchValue]="termino()"
      (searchChanged)="alBuscar($event)"
      (filtersChanged)="emisiones.push($event)"
    />
  `,
})
class HostComponentWithoutUrl {
  readonly filtros = signal<readonly FilterDef[]>(FILTROS);
  readonly termino = signal('');
  readonly avisos: string[] = [];
  readonly emisiones: Readonly<Record<string, string>>[] = [];

  alBuscar(term: string): void {
    this.avisos.push(term);
    this.termino.set(term);
  }
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

  /** Los desplegables de la barra: el host de cada `app-select`. */
  function selects(): HTMLElement[] {
    return [...root().querySelectorAll<HTMLElement>('app-select')];
  }

  async function irA(queryParams: Record<string, string>): Promise<void> {
    await router.navigate(['/listado'], { queryParams });
    await fixture.whenStable();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        HostComponent,
        HostComponentConProyeccion,
        HostComponentConDosProyecciones,
        HostComponentConDosBarras,
        HostComponentWithoutUrl,
      ],
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
      await chooseSelectOption(fixture, selects()[0], 0);

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
      const deshabilitados = selects().filter((select) => selectTrigger(select).disabled);

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

  describe('hueco de la acción, proyectado (ADR-0015, regla 5)', () => {
    it('límite: sin proyección, el hueco queda vacío y no visible (no suma separación)', () => {
      // el host de arriba (HostComponent) no proyecta nada
      const hueco = root().querySelector('.filter-bar__action');
      expect(hueco?.childNodes.length ?? 0).toBe(0);
      expect(hueco && getComputedStyle(hueco).display).toBe('none');
    });

    it('correcto: con proyección, el botón aparece dentro del hueco', async () => {
      const otraFixture = TestBed.createComponent(HostComponentConProyeccion);
      otraFixture.detectChanges();
      await otraFixture.whenStable();

      const hueco = (otraFixture.nativeElement as HTMLElement).querySelector(
        '.filter-bar__action',
      );
      expect(hueco?.querySelector('button')?.textContent?.trim()).toBe('Agregar');
    });

    it('inválido: con dos proyecciones, las dos entran al mismo hueco (no hay mecanismo para elegir una) — declarado, no oculto', async () => {
      const otraFixture = TestBed.createComponent(HostComponentConDosProyecciones);
      otraFixture.detectChanges();
      await otraFixture.whenStable();

      const hueco = (otraFixture.nativeElement as HTMLElement).querySelector(
        '.filter-bar__action',
      );
      const botones = [...(hueco?.querySelectorAll('button') ?? [])];
      expect(botones.map((boton) => boton.textContent?.trim())).toEqual(['Primero', 'Segundo']);
    });
  });

  describe('clave de búsqueda propia (searchParam)', () => {
    function buscadores(de: ComponentFixture<unknown>): SearchField[] {
      return de.debugElement
        .queryAll(By.directive(SearchField))
        .map((nodo) => nodo.componentInstance as SearchField);
    }

    function parametros() {
      return router.parseUrl(router.url).queryParamMap;
    }

    async function montarDosBarras(): Promise<ComponentFixture<HostComponentConDosBarras>> {
      const dos = TestBed.createComponent(HostComponentConDosBarras);
      await dos.whenStable();
      return dos;
    }

    it('sin la entrada, escribe y emite bajo `q`, como siempre', async () => {
      buscadores(fixture)[0].searched.emit('peña');
      await fixture.whenStable();

      expect(parametros().get(SEARCH_PARAM)).toBe('peña');
      expect(host.emisiones.at(-1)).toEqual({ [SEARCH_PARAM]: 'peña' });
    });

    it('buscar en una barra no toca la clave ni el campo de la otra', async () => {
      const dos = await montarDosBarras();

      buscadores(dos)[0].searched.emit('umsa');
      await dos.whenStable();

      expect(parametros().get('qTitulos')).toBe('umsa');
      expect(parametros().has('qMatriculas')).toBe(false);
      expect(parametros().has(SEARCH_PARAM)).toBe(false);
      expect(dos.componentInstance.titulos.at(-1)).toEqual({ qTitulos: 'umsa' });
      expect(dos.componentInstance.matriculas).toHaveLength(0);
      expect(buscadores(dos)[1].value()).toBe('');
      dos.destroy();
    });

    it('al entrar, cada barra muestra el término de su clave', async () => {
      await irA({ qTitulos: 'umsa', qMatriculas: 'lp-12' });
      const dos = await montarDosBarras();

      expect(buscadores(dos).map((buscador) => buscador.value())).toEqual(['umsa', 'lp-12']);
      dos.destroy();
    });

    it('«limpiar todo» de una barra deja la búsqueda de la otra', async () => {
      await irA({ qTitulos: 'umsa', qMatriculas: 'lp-12' });
      const dos = await montarDosBarras();
      const primera = (dos.nativeElement as HTMLElement).querySelector('app-filter-bar');

      [...(primera?.querySelectorAll('button') ?? [])]
        .find((boton) => boton.textContent?.trim() === 'Limpiar todo')
        ?.click();
      await dos.whenStable();

      expect(parametros().has('qTitulos')).toBe(false);
      expect(parametros().get('qMatriculas')).toBe('lp-12');
      dos.destroy();
    });
  });

  /**
   * `searchInUrl=false`: lo tecleado es el nombre o el documento de una
   * persona, y la URL lo dejaría en el historial y en los logs del servidor.
   */
  describe('búsqueda fuera de la URL (searchInUrl=false)', () => {
    function buscador(de: ComponentFixture<unknown>): SearchField {
      return de.debugElement.query(By.directive(SearchField)).componentInstance as SearchField;
    }

    async function montar(): Promise<ComponentFixture<HostComponentWithoutUrl>> {
      const withoutUrl = TestBed.createComponent(HostComponentWithoutUrl);
      await withoutUrl.whenStable();
      return withoutUrl;
    }

    it('correcto — buscar avisa el término y no lo escribe en la URL', async () => {
      const withoutUrl = await montar();

      buscador(withoutUrl).searched.emit('Ana Quispe');
      await withoutUrl.whenStable();

      expect(withoutUrl.componentInstance.avisos).toEqual(['Ana Quispe']);
      expect(router.url).toBe('/listado');
      expect(withoutUrl.componentInstance.emisiones.at(-1)).toEqual({ [SEARCH_PARAM]: 'Ana Quispe' });
      withoutUrl.destroy();
    });

    it('correcto — el campo muestra `searchValue`, no lo que diga la URL', async () => {
      await irA({ [SEARCH_PARAM]: 'de-la-url' });
      const withoutUrl = await montar();
      withoutUrl.componentInstance.termino.set('guardado');
      await withoutUrl.whenStable();

      expect(buscador(withoutUrl).value()).toBe('guardado');
      withoutUrl.destroy();
    });

    it('límite — los filtros de catálogo siguen en la URL, junto al término guardado', async () => {
      const withoutUrl = await montar();
      withoutUrl.componentInstance.termino.set('Ana');
      await withoutUrl.whenStable();

      const select = (withoutUrl.nativeElement as HTMLElement).querySelector<HTMLElement>('app-select')!;
      await chooseSelectOption(withoutUrl, select, 0);

      expect(router.url).toContain('servicio=card');
      expect(router.url).not.toContain('Ana');
      expect(withoutUrl.componentInstance.emisiones.at(-1)?.[SEARCH_PARAM]).toBe('Ana');
      withoutUrl.destroy();
    });

    it('inválido — «limpiar todo» avisa un término vacío y además saca una `q` vieja de la URL', async () => {
      await irA({ [SEARCH_PARAM]: 'enlace-viejo', servicio: 'card' });
      const withoutUrl = await montar();
      withoutUrl.componentInstance.termino.set('Ana');
      await withoutUrl.whenStable();

      [...(withoutUrl.nativeElement as HTMLElement).querySelectorAll('button')]
        .find((boton) => boton.textContent?.trim() === 'Limpiar todo')
        ?.click();
      await withoutUrl.whenStable();

      expect(withoutUrl.componentInstance.avisos.at(-1)).toBe('');
      expect(router.url).toBe('/listado');
      withoutUrl.destroy();
    });
  });
});

@Component({
  imports: [FilterBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-filter-bar [filters]="filtros" [wrap]="envolver()" />`,
})
class HostConWrap {
  readonly filtros = FILTROS;
  readonly envolver = signal(false);
}

describe('FilterBar · wrap (opt-in)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('por omisión no cambia nada: los consumidores existentes siguen en una fila', () => {
    const fixture = TestBed.createComponent(HostConWrap);
    fixture.detectChanges();
    const barra = fixture.debugElement.query(By.directive(FilterBar)).nativeElement as HTMLElement;
    expect(barra.classList.contains('filter-bar--wrap')).toBe(false);
  });

  it('con `wrap` el host lleva la clase que deja bajar los controles de renglón', () => {
    const fixture = TestBed.createComponent(HostConWrap);
    fixture.componentInstance.envolver.set(true);
    fixture.detectChanges();
    const barra = fixture.debugElement.query(By.directive(FilterBar)).nativeElement as HTMLElement;
    expect(barra.classList.contains('filter-bar--wrap')).toBe(true);
  });
});

describe('FilterBar · columna de facetas', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  function montar(): HTMLElement {
    const fixture = TestBed.createComponent(FilterBar);
    fixture.componentRef.setInput('layout', 'facets');
    fixture.componentRef.setInput('showSearch', false);
    fixture.componentRef.setInput('filters', [
      {
        key: 'departamento',
        label: 'Departamento',
        icon: 'pin',
        asChips: true,
        options: [
          { value: 'sc', label: 'Santa Cruz (160)' },
          { value: 'lp', label: 'La Paz' },
        ],
      },
    ]);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('dibuja el ícono del filtro en el rótulo, sin buscador', () => {
    const raiz = montar();
    expect(raiz.querySelector('.filter-bar__faceta-rotulo app-nav-icon')).not.toBeNull();
    expect(raiz.querySelector('app-search-field')).toBeNull();
  });

  it('separa la cantidad del nombre para dibujarla aparte', () => {
    const raiz = montar();
    const opciones = [...raiz.querySelectorAll('.filter-bar__faceta-opcion')];
    expect(opciones[0]!.querySelector('.filter-bar__faceta-texto')!.textContent!.trim()).toBe(
      'Santa Cruz',
    );
    expect(opciones[0]!.querySelector('.filter-bar__faceta-cantidad')!.textContent!.trim()).toBe(
      '160',
    );
    // Un rótulo sin cantidad va entero y sin pastilla.
    expect(opciones[1]!.querySelector('.filter-bar__faceta-cantidad')).toBeNull();
  });
});

// Propietario, 24/10/2026: «un buscador y un paginador estético para los
// filtros». La faceta larga ya no se estira con «Ver 38 más».
describe('FilterBar · faceta larga con buscador y páginas', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  const ESPECIALIDADES = [
    'Cardiología', 'Dermatología', 'Gastroenterología', 'Neurología', 'Oftalmología',
    'Pediatría', 'Psiquiatría', 'Traumatología', 'Urología', 'Odontología', 'Nefrología',
    'Neumología', 'Endocrinología', 'Hematología', 'Reumatología', 'Oncología', 'Geriatría',
    'Infectología',
  ];

  function montar(): ComponentFixture<FilterBar> {
    const fixture = TestBed.createComponent(FilterBar);
    fixture.componentRef.setInput('layout', 'facets');
    fixture.componentRef.setInput('showSearch', false);
    fixture.componentRef.setInput('filters', [
      {
        key: 'especialidad',
        label: 'Especialidad',
        asChips: true,
        options: ESPECIALIDADES.map((nombre, i) => ({ value: `e${i}`, label: `${nombre} (${i + 1})` })),
      },
    ]);
    fixture.detectChanges();
    return fixture;
  }

  function textos(raiz: HTMLElement): string[] {
    return [...raiz.querySelectorAll('.filter-bar__faceta-texto')].map((t) => t.textContent!.trim());
  }

  it('muestra una página de ocho, con su paginador y sin «Ver más»', () => {
    const raiz = montar().nativeElement as HTMLElement;
    expect(textos(raiz)).toEqual(ESPECIALIDADES.slice(0, 8));
    expect(raiz.querySelector('.filter-bar__faceta-paginas')).not.toBeNull();
    expect(raiz.querySelectorAll('.filter-bar__faceta-punto').length).toBe(3);
    expect(raiz.textContent).not.toContain('Ver ');
  });

  it('las flechas son botones de ícono con nombre, y la primera empieza deshabilitada', () => {
    const raiz = montar().nativeElement as HTMLElement;
    const [anterior, siguiente] = [
      ...raiz.querySelectorAll<HTMLButtonElement>('.filter-bar__faceta-flecha'),
    ];
    expect(anterior!.classList).toContain('btn--icon-only');
    expect(anterior!.getAttribute('aria-label')).toBe('Página anterior');
    expect(anterior!.getAttribute('aria-disabled')).toBe('true');
    expect(siguiente!.getAttribute('aria-label')).toBe('Página siguiente');
  });

  it('pasa de página con la flecha y con los puntos', () => {
    const fixture = montar();
    const raiz = fixture.nativeElement as HTMLElement;
    raiz.querySelectorAll<HTMLButtonElement>('.filter-bar__faceta-flecha')[1]!.click();
    fixture.detectChanges();
    expect(textos(raiz)).toEqual(ESPECIALIDADES.slice(8, 16));

    raiz.querySelectorAll<HTMLButtonElement>('.filter-bar__faceta-punto')[2]!.click();
    fixture.detectChanges();
    expect(textos(raiz)).toEqual(ESPECIALIDADES.slice(16));
    expect(
      raiz.querySelectorAll('.filter-bar__faceta-punto')[2]!.getAttribute('aria-current'),
    ).toBe('page');
  });

  it('el buscador de la faceta encuentra sin tildes y vuelve a la primera página', async () => {
    const fixture = montar();
    const raiz = fixture.nativeElement as HTMLElement;
    raiz.querySelectorAll<HTMLButtonElement>('.filter-bar__faceta-flecha')[1]!.click();
    fixture.detectChanges();

    const campo = fixture.debugElement.query(By.directive(SearchField))
      .componentInstance as SearchField;
    campo.value.set('logia');
    fixture.detectChanges();
    await new Promise((listo) => setTimeout(listo, 0));
    fixture.detectChanges();

    // «logía» con tilde, buscada sin ella: todas las que terminan así.
    expect(textos(raiz)).toEqual(
      ESPECIALIDADES.filter((e) => e.normalize('NFD').replace(/[̀-ͯ]/g, '').includes('logia')).slice(0, 8),
    );
    expect(raiz.querySelector('.filter-bar__faceta-punto[aria-current="page"]')).toBe(
      raiz.querySelector('.filter-bar__faceta-punto'),
    );
  });

  it('dice que no hay coincidencias en vez de dejar la lista vacía', async () => {
    const fixture = montar();
    const campo = fixture.debugElement.query(By.directive(SearchField))
      .componentInstance as SearchField;
    campo.value.set('zzz');
    fixture.detectChanges();
    await new Promise((listo) => setTimeout(listo, 0));
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.filter-bar__faceta-sin-coincidencias')?.textContent).toContain(
      'Ninguna opción coincide con «zzz»',
    );
    expect(raiz.querySelector('.filter-bar__faceta-paginas')).toBeNull();
  });

  it('la opción elegida en otra página se ve arriba de la lista', async () => {
    const fixture = montar();
    const router = TestBed.inject(Router);
    await router.navigate([], { queryParams: { especialidad: 'e17' } });
    fixture.detectChanges();

    expect(textos(fixture.nativeElement as HTMLElement)[0]).toBe('Infectología');
  });
});

@Component({
  imports: [FilterBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-filter-bar [filters]="filters" [collapsible]="collapsible()" />`,
})
class CollapsibleHost {
  readonly filters = FILTROS;
  readonly collapsible = signal(false);
}

describe('FilterBar · filtros plegables en teléfono (opt-in)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  function mount(collapsible: boolean): { fixture: ComponentFixture<CollapsibleHost>; bar: HTMLElement } {
    const fixture = TestBed.createComponent(CollapsibleHost);
    fixture.componentInstance.collapsible.set(collapsible);
    fixture.detectChanges();
    const bar = fixture.debugElement.query(By.directive(FilterBar)).nativeElement as HTMLElement;
    return { fixture, bar };
  }

  it('por omisión no dibuja el botón ni pliega nada', () => {
    const { bar } = mount(false);
    expect(bar.querySelector('[data-testid="filter-bar-toggle"]')).toBeNull();
    expect(bar.classList.contains('filter-bar--folded')).toBe(false);
  });

  it('con `collapsible` arranca plegada y el botón «Filtros» la despliega y la vuelve a plegar', async () => {
    const { fixture, bar } = mount(true);
    const toggle = bar.querySelector<HTMLButtonElement>('[data-testid="filter-bar-toggle"]')!;
    expect(bar.classList.contains('filter-bar--folded')).toBe(true);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.textContent?.trim()).toBe('Filtros');

    toggle.click();
    await fixture.whenStable();
    expect(bar.classList.contains('filter-bar--folded')).toBe(false);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.textContent?.trim()).toBe('Ocultar filtros');

    toggle.click();
    await fixture.whenStable();
    expect(bar.classList.contains('filter-bar--folded')).toBe(true);
  });

  it('el CSS pliega sólo en teléfono: desde 780 px los desplegables se ven y el botón no', () => {
    const css = readFileSync('src/app/shared/components/organisms/filter-bar/filter-bar.css', 'utf8');
    const desktop = css.slice(css.indexOf('@media (min-width: 780px)'));
    expect(css.indexOf(':host(.filter-bar--folded) .filter-bar__filter')).toBeLessThan(
      css.indexOf('@media (min-width: 780px)'),
    );
    expect(desktop).toMatch(/\.filter-bar__toggle \{\s+display: none;/);
    expect(desktop).toMatch(/:host\(\.filter-bar--folded\) \.filter-bar__filter \{\s+display: block;/);
  });
});
