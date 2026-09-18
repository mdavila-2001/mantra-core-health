import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { environment } from '../../../../environments/environment';
import { routes } from '../../../app.routes';
import { APP_SECTIONS } from '../../../core/navigation/navigation.map';
import { NAV_SUBGROUPS } from '../../../core/navigation/navigation.subgroups';
import { seccionRolesGuard } from '../../../core/navigation/section-roles.guard';
import { Promotions } from './promotions';

/**
 * «Promociones» (R-T-E7) en `dev`: sin lectura real en la API no hay datos, así
 * que la pantalla es un vacío honesto y no fabrica tarjetas, ni siquiera con
 * `campaignsDemo` encendido. La maqueta vive en la rama `mockup`.
 */

/** El texto como lo lee una persona: sin los saltos de la plantilla. */
function normalizado(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\s+/g, ' ').trim();
}

describe('Promotions', () => {
  const entorno = environment as { campaignsDemo: boolean };
  const original = entorno.campaignsDemo;

  afterEach(() => {
    entorno.campaignsDemo = original;
  });

  function montar(): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Promotions);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  for (const campaignsDemo of [true, false]) {
    it(`con campaignsDemo=${campaignsDemo} muestra el vacío honesto, sin datos de ejemplo`, () => {
      entorno.campaignsDemo = campaignsDemo;
      const raiz = montar();
      const leido = normalizado(raiz.textContent);

      expect(leido).toContain('Cuando las farmacias te manden promociones, van a aparecer acá.');
      expect(leido).toContain('Buscar farmacias');
      expect(raiz.querySelector('[data-testid="promocion-tarjeta"]')).toBeNull();
      expect(raiz.querySelector('[data-testid="promociones-chip-demo"]')).toBeNull();
      expect(leido).not.toMatch(/DEMO|Farmacia Central|Puntos x|Lote próximo a vencer/);
    });
  }

  it('no afirma que la persona no recibió promociones', () => {
    const leido = normalizado(montar().textContent);

    expect(leido).not.toMatch(/no recibiste/i);
  });

  it('la salida del vacío lleva a buscar farmacias', () => {
    const enlace = [...montar().querySelectorAll('a')].find(
      (a) => normalizado(a.textContent) === 'Buscar farmacias',
    );

    expect(enlace?.getAttribute('href')).toBe('/search/medications');
  });
});

/**
 * El registro de la sección: una sola entrada en el menú, sólo para pacientes,
 * dentro de «Mis gestiones», y la ruta carga esta pantalla y no el placeholder.
 */
describe('Promotions en la navegación', () => {
  const PATH = 'my-account/promotions';

  it('aparece una sola vez en APP_SECTIONS, restringida a PATIENT', () => {
    const secciones = APP_SECTIONS.filter((section) => section.path === PATH);

    expect(secciones.length).toBe(1);
    expect(secciones[0].roles).toEqual(['PATIENT']);
    expect(secciones[0].group).toBe('Mi cuenta');
  });

  it('está una sola vez en «Mis gestiones», junto a lo que ya estaba', () => {
    const conElPath = NAV_SUBGROUPS.filter((subgrupo) => subgrupo.paths.includes(PATH));

    expect(conElPath.map((subgrupo) => subgrupo.label)).toEqual(['Mis gestiones']);
    expect(conElPath[0].paths.filter((path) => path === PATH).length).toBe(1);
    expect(conElPath[0].paths).toEqual(
      expect.arrayContaining([
        'my-account/appointments',
        'my-account/pharmacy-orders',
        'my-account/loyalty',
      ]),
    );
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
