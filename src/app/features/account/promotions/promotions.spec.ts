import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '@core/data-access/terminology/bo-municipalities.service';
import type { GrupoDeDirectorio } from '@shared/components/organisms/directory-page/directory-page.types';
import type { FilterDef } from '@shared/components/organisms/filter-bar/filter-bar';

import { routes } from '../../../app.routes';
import { APP_SECTIONS } from '../../../core/navigation/navigation.map';
import { NAV_SUBGROUPS } from '../../../core/navigation/navigation.subgroups';
import { seccionRolesGuard } from '../../../core/navigation/section-roles.guard';
import { Promotions } from './promotions';
import { promocionesDeEjemplo } from './promotions.fixtures';

const RAMAS: readonly RamaDepartamento[] = [
  {
    conceptId: 'geo:bo:department:SC',
    sigla: 'SC',
    nombre: 'Santa Cruz',
    municipios: [
      { conceptId: 'm-sc-1', nombre: 'Santa Cruz de la Sierra', ine: '070101' },
      { conceptId: 'm-sc-2', nombre: 'Montero', ine: '070201' },
    ],
  },
  {
    conceptId: 'geo:bo:department:LP',
    sigla: 'LP',
    nombre: 'La Paz',
    municipios: [
      { conceptId: 'm-lp-1', nombre: 'La Paz', ine: '020101' },
      { conceptId: 'm-lp-2', nombre: 'El Alto', ine: '020105' },
    ],
  },
];

/**
 * «Promociones» del paciente con la anatomía de los directorios: buscador,
 * chips y mapa, todos leídos de la URL.
 */
describe('Promotions', () => {
  let fixture: ComponentFixture<Promotions>;
  let params: BehaviorSubject<Record<string, string>>;

  function montar(inicial: Record<string, string> = {}): void {
    params = new BehaviorSubject(inicial);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { queryParams: params } },
        {
          provide: BoMunicipalitiesCatalog,
          useValue: { listar: () => of(RAMAS), olvidar: () => undefined },
        },
      ],
    });
    fixture = TestBed.createComponent(Promotions);
    fixture.detectChanges();
  }

  function interno<T>(clave: string): T {
    return (fixture.componentInstance as unknown as Record<string, () => T>)[clave]();
  }

  const tramos = (): readonly GrupoDeDirectorio[] => interno('tramos');
  const titulos = (): string[] => tramos().flatMap((t) => t.resultados.map((r) => r.title));
  const filtros = (): readonly FilterDef[] => interno('filtros');

  it('muestra todas las promociones agrupadas por ciudad, con buscador y filtros', () => {
    montar();
    const pantalla = fixture.nativeElement as HTMLElement;

    expect(titulos().length).toBe(promocionesDeEjemplo().length);
    expect(pantalla.querySelector('app-filter-bar')).not.toBeNull();
    expect(pantalla.querySelectorAll('[app-result-card]').length).toBe(
      promocionesDeEjemplo().length,
    );
    expect(filtros().map((f) => f.key)).toEqual(['categoria', 'vigentes']);
  });

  it('el buscador acota por farmacia, título o medicamento', () => {
    montar({ q: 'loratadina' });

    expect(titulos()).toEqual(['Alergias de primavera']);
  });

  it('«Sólo vigentes» saca las vencidas', () => {
    montar({ vigentes: 'true' });

    expect(titulos()).not.toContain('Campaña de invierno');
    expect(titulos().length).toBe(
      promocionesDeEjemplo().filter((p) => p.estado !== 'vencida').length,
    );
  });

  it('el departamento acota y recién ahí aparecen los chips de ciudad', () => {
    montar({ departamento: 'geo:bo:department:LP' });

    expect(tramos().map((t) => t.nombre)).toEqual(['El Alto', 'La Paz']);
    expect(filtros()[0].key).toBe('ciudad');

    params.next({ departamento: 'geo:bo:department:LP', ciudad: 'El Alto' });
    expect(tramos().map((t) => t.nombre)).toEqual(['El Alto']);
  });

  it('la categoría acota por chip', () => {
    montar({ categoria: 'vitaminas' });

    expect(
      tramos()
        .flatMap((t) => t.resultados)
        .every((r) => r.meta?.[0].text === 'Vitaminas y suplementos'),
    ).toBe(true);
  });

  it('sin coincidencias lo dice, en vez de mostrar el vacío del directorio', () => {
    montar({ q: 'no-existe-nada' });

    expect(interno<string | null>('sinCoincidencias')).toContain('Ninguna promoción coincide');
  });
});

describe('Promotions en la navegación', () => {
  const PATH = 'my-account/promotions';

  it('aparece una sola vez en APP_SECTIONS, restringida a PATIENT y fuera del menú lateral', () => {
    const secciones = APP_SECTIONS.filter((section) => section.path === PATH);

    expect(secciones.length).toBe(1);
    expect(secciones[0].roles).toEqual(['PATIENT']);
    expect(secciones[0].group).toBe('Mi cuenta');
    expect(secciones[0].fueraDelMenuPara?.length).toBeGreaterThan(0);
  });

  it('está una sola vez en «Mis gestiones», junto a lo que ya estaba', () => {
    const conElPath = NAV_SUBGROUPS.filter((subgrupo) => subgrupo.paths.includes(PATH));

    expect(conElPath.map((subgrupo) => subgrupo.label)).toEqual(['Mis gestiones']);
    expect(conElPath[0].paths.filter((path) => path === PATH).length).toBe(1);
  });

  it('la ruta carga Promotions, detrás del guard de roles', async () => {
    const armazon = routes.find(
      (route) => route.path === '' && route.component !== undefined && route.children !== undefined,
    );
    const ruta = armazon?.children?.find((route) => route.path === PATH);

    expect(ruta).toBeDefined();
    expect(ruta?.canActivate).toContain(seccionRolesGuard);
    const componente = await (ruta?.loadComponent as () => Promise<unknown>)();
    expect(componente).toBe(Promotions);
  });
});
