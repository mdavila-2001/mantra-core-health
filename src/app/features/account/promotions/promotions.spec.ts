import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
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
import { SAMPLE_DATA_ENABLED } from '../../../core/mock/sample-data';
import type { MyPromotionDto } from '@core/data-access/promotions/promotions.dto';
import { Promotions, promotionFromContract } from './promotions';
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
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SAMPLE_DATA_ENABLED, useValue: true },
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

/** Una promoción tal como la devuelve `GET /promotions/me`. */
function promocionDelContrato(extra: Partial<MyPromotionDto> = {}): MyPromotionDto {
  return {
    id: '5b1f0c2e-0000-4000-8000-00000000d001',
    code: 'PROMO-TEMPORADA',
    name: 'Descuento de primavera',
    description: null,
    type: { code: 'PROMO_AUTO', display: 'Automatic promotion' },
    validFrom: '2026-09-19T00:00:00.000Z',
    validTo: '2026-10-19T00:00:00.000Z',
    discounts: [
      {
        type: { code: 'DISC_PERCENT', display: 'Percentage discount' },
        percentage: '15',
        fixedAmount: null,
        currency: null,
        minPurchaseAmount: '50.00',
        maxDiscountAmount: null,
        appliesTo: { code: 'TARGET_ORDER', display: 'Whole order' },
      },
    ],
    coupons: [],
    ...extra,
  };
}

describe('promotionFromContract', () => {
  it('toma nombre, porcentaje y vigencia, y deja null lo que el contrato no relaciona', () => {
    const promo = promotionFromContract(promocionDelContrato());

    expect(promo).toMatchObject({
      titulo: 'Descuento de primavera',
      porcentaje: 15,
      montoFijo: null,
      farmacia: null,
      ciudad: null,
      medicamento: null,
      farmaciaVerificada: false,
      categoria: { code: 'toda-la-compra', label: 'En toda la compra' },
      estado: 'vista',
      cupones: [],
    });
    expect(promo.hasta?.toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });

  it('un monto fijo va con su moneda, y el cupón propio viaja con la promoción', () => {
    const promo = promotionFromContract(
      promocionDelContrato({
        validTo: null,
        discounts: [
          {
            type: { code: 'DISC_FIXED', display: 'Fixed amount discount' },
            percentage: null,
            fixedAmount: '20.00',
            currency: { code: 'BOB', display: 'Boliviano' },
            minPurchaseAmount: null,
            maxDiscountAmount: null,
            appliesTo: null,
          },
        ],
        coupons: [{ code: 'BIENV-7Q2X', validTo: null }],
      }),
    );

    expect(promo.porcentaje).toBeNull();
    expect(promo.montoFijo).toBe('20.00 BOB');
    expect(promo.hasta).toBeNull();
    expect(promo.categoria.label).toBe('Promoción');
    expect(promo.cupones).toEqual(['BIENV-7Q2X']);
  });
});

/**
 * Contra la API real (`production-api`): las promociones salen de
 * `GET /promotions/me`, y ninguna de ejemplo se asoma.
 */
describe('Promotions contra la API real', () => {
  let fixture: ComponentFixture<Promotions>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { queryParams: new BehaviorSubject({}) } },
        {
          provide: BoMunicipalitiesCatalog,
          useValue: { listar: () => of(RAMAS), olvidar: () => undefined },
        },
        { provide: SAMPLE_DATA_ENABLED, useValue: false },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Promotions);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    http.verify();
  });

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('muestra las vigentes del contrato, sin ninguna de ejemplo', () => {
    const request = http.expectOne('/promotions/me');
    expect(request.request.method).toBe('GET');
    request.flush({
      items: [
        promocionDelContrato(),
        promocionDelContrato({
          id: '5b1f0c2e-0000-4000-8000-00000000d002',
          name: 'Bienvenida a la app',
          coupons: [{ code: 'BIENV-7Q2X', validTo: null }],
        }),
      ],
      count: 2,
    });
    fixture.detectChanges();

    expect(texto()).toContain('Descuento de primavera');
    expect(texto()).toContain('Tu cupón: BIENV-7Q2X');
    expect(texto()).toContain('Sin ciudad declarada');
    for (const promo of promocionesDeEjemplo()) {
      expect(texto()).not.toContain(promo.titulo);
    }
  });

  it('sin vigentes, lo dice y ofrece buscar farmacias', () => {
    http.expectOne('/promotions/me').flush({ items: [], count: 0 });
    fixture.detectChanges();

    expect(texto()).toContain('Por ahora no tenés promociones vigentes');
    expect(texto()).toContain('Buscar farmacias');
  });

  it('si la lectura falla, ofrece reintentar y el reintento vuelve a pedir', () => {
    http
      .expectOne('/promotions/me')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const reintentar = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    ).find((boton) => (boton.textContent ?? '').includes('Reintentar'));
    expect(reintentar).toBeDefined();
    reintentar?.click();
    fixture.detectChanges();

    http.expectOne('/promotions/me').flush({ items: [], count: 0 });
  });
});
