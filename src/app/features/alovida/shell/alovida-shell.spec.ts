/* ============================================================================
    Los dos marcos son lo único escrito a mano de todo el port: las 126
    pantallas son generadas y se prueban contra un navegador. Acá se fija lo
    que el marco decide por su cuenta y podría equivocarse en silencio — qué
    módulo despliega, qué módulo declara sin destino, y qué pinta el header.
    ========================================================================== */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { MODULOS_ALOVIDA } from '../alovida-nav.data';
import { AlovidaPublicShell } from './alovida-public-shell';
import { AlovidaShell } from './alovida-shell';

describe('AlovidaShell', () => {
  let fixture: ComponentFixture<AlovidaShell>;
  let router: Router;

  function raiz(): HTMLElement {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** Navega de verdad para que el marco resuelva el módulo desde la URL. */
  async function ir(url: string) {
    await router.navigateByUrl(url);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlovidaShell],
      // Rutas de mentira con los mismos segmentos: al marco sólo le importa el
      // primer segmento de la URL, no qué componente hay del otro lado.
      providers: [
        provideRouter([
          { path: 'directorio/:pantalla', children: [] },
          { path: 'personas/:pantalla', children: [] },
          { path: 'nada', children: [] },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AlovidaShell);
    router = TestBed.inject(Router);
  });

  it('monta la geometría de ALOVIDA: nav, y una columna con header y contenido', () => {
    const marco = raiz().querySelector('.app-shell');

    expect(marco?.children[0]?.classList.contains('app-side-nav')).toBe(true);
    expect(marco?.querySelector('.app-main > .app-header')).not.toBeNull();
    expect(marco?.querySelector('.app-main > .app-main__inner router-outlet')).not.toBeNull();
  });

  it('el nav declara los diez módulos de la bóveda, en su orden', () => {
    const rotulos = [...raiz().querySelectorAll('.app-side-nav__group > a span:last-child')].map(
      (s) => s.textContent?.trim(),
    );

    expect(rotulos).toEqual([
      'Inicio',
      'Identidad y accesos',
      'Datos compartidos',
      'Terminología',
      'Organizaciones',
      'Personas',
      'Agenda',
      'Historia clínica',
      'Facturación',
      'Auditoría',
    ]);
  });

  it('un módulo sin pantallas portadas se declara, pero sin destino', () => {
    // Está en el mapa de la plataforma y todavía no se maquetó: esconderlo
    // haría creer que la plataforma es más chica, y darle ruta llevaría a 404.
    const sinDestino = [...raiz().querySelectorAll('.app-side-nav__item[data-sin-destino]')].map(
      (a) => a.textContent?.trim(),
    );

    expect(sinDestino).toContain('Agenda');
    expect(sinDestino).toContain('Auditoría');
    expect(sinDestino.every((r) => !r?.includes('Organizaciones'))).toBe(true);
  });

  it('sólo el módulo de la URL despliega sus secciones', async () => {
    await ir('/directorio/organizaciones-listado');

    const desplegados = raiz().querySelectorAll('.app-side-nav__sub');
    expect(desplegados).toHaveLength(1);

    const modulo = MODULOS_ALOVIDA.find((m) => m.segmento === 'directorio');
    const etiquetas = [...desplegados[0].querySelectorAll('a')].map((a) => a.textContent?.trim());
    expect(etiquetas).toEqual(modulo?.secciones.map((s) => s.etiqueta));
  });

  it('cambiar de módulo cambia lo desplegado', async () => {
    await ir('/directorio/organizaciones-listado');
    await ir('/personas/profesionales-listado');

    const activo = raiz().querySelector('.app-side-nav__item[aria-current="true"]');
    expect(activo?.textContent?.trim()).toBe('Personas');
    expect(raiz().querySelectorAll('.app-side-nav__sub')).toHaveLength(1);
  });

  it('en un segmento que no es de la bóveda no se despliega nada', async () => {
    await ir('/nada');

    expect(raiz().querySelectorAll('.app-side-nav__sub')).toHaveLength(0);
    expect(raiz().querySelector('.app-side-nav__item[aria-current="true"]')).toBeNull();
  });

  it('el avatar lleva dos iniciales, no el nombre entero ni el rol', () => {
    // El nombre de sesión viene como «Rocío Salazar · Administración de
    // seguridad»: el rol va después del punto y no debe entrar en el círculo.
    expect(raiz().querySelector('.app-avatar')?.textContent?.trim()).toBe('RS');
  });

  /* -- Carril 01: la maqueta tiene que decir que es una maqueta ------------- */

  it('el marco declara que lo de adentro es una referencia de diseño', () => {
    // Estas rutas NO pasan por `authGuard` y su marcado es estático: sin este
    // aviso, la pantalla es indistinguible del producto (corrección #7).
    const aviso = raiz().querySelector('app-alovida-design-notice .app-alert');

    expect(aviso).not.toBeNull();
    expect(aviso?.getAttribute('data-tono')).toBe('aviso');
    expect(aviso?.textContent).toContain('Referencia de diseño');
  });

  it('el aviso va antes del contenido, no debajo', () => {
    // Debajo del fold no lo lee nadie, y el punto entero es que se lea antes de
    // creerle a la pantalla.
    const interior = raiz().querySelector('.app-main__inner');

    expect(interior?.children[0]?.tagName.toLowerCase()).toBe('app-alovida-design-notice');
  });

  it('el aviso no se puede cerrar: no informa de un estado, dice qué es la pantalla', () => {
    const aviso = raiz().querySelector('app-alovida-design-notice');

    expect(aviso?.querySelector('button')).toBeNull();
  });

  it('cuando el módulo tiene pantalla real construida, el aviso lleva a ella', async () => {
    await ir('/personas/profesionales-listado');

    const salida = raiz().querySelector('app-alovida-design-notice a');
    expect(salida?.getAttribute('href')).toBe('/administration/patients');
  });

  it('cuando no la tiene, el aviso no inventa un destino', async () => {
    await ir('/nada');

    expect(raiz().querySelector('app-alovida-design-notice a')).toBeNull();
  });

  it('la identidad del header se declara de ejemplo', () => {
    // El marco anunciaba «Rocío Salazar · Administración de seguridad» a quien
    // no tiene ninguna sesión. Una captura de eso pasaba por producto.
    const cabecera = raiz().querySelector('.app-header__derecha');

    expect(cabecera?.querySelector('.solo-lectores')?.textContent).toContain('(ejemplo)');
    expect(cabecera?.querySelector('.app-tenant-switcher')?.getAttribute('aria-label')).toContain(
      '(ejemplo)',
    );
  });
});

describe('AlovidaPublicShell', () => {
  let fixture: ComponentFixture<AlovidaPublicShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlovidaPublicShell],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AlovidaPublicShell);
    fixture.detectChanges();
  });

  it('no lleva nav lateral: quien busca todavía no tiene organización', () => {
    expect((fixture.nativeElement as HTMLElement).querySelector('.app-side-nav')).toBeNull();
  });

  it('el pie declara las cuatro cosas que la ficha exige en toda pantalla pública', () => {
    // Van en el marco y no en cada vista: repetirlas por pantalla es garantizar
    // que en alguna falten.
    const parrafos = (fixture.nativeElement as HTMLElement).querySelectorAll('.app-public-pie p');

    expect(parrafos).toHaveLength(4);
    expect(parrafos[0].textContent).toContain('Quién paga lo que ves');
  });

  it('ofrece entrar y crear cuenta, contra las rutas de sesión que ya existen', () => {
    const enlaces = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.app-public-header__acciones a'),
    ].map((a) => a.getAttribute('href'));

    expect(enlaces).toEqual(['/auth', '/auth/register']);
  });

  it('también declara que el buscador público es una referencia de diseño', () => {
    // Acá importa más que en el marco de sesión: las fichas de profesionales y
    // farmacias del buscador son inventadas y cualquiera las alcanza sin entrar.
    const aviso = (fixture.nativeElement as HTMLElement).querySelector(
      '.app-main__inner > app-alovida-design-notice',
    );

    expect(aviso?.textContent).toContain('Referencia de diseño');
  });
});
