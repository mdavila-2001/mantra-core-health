/* ============================================================================
    Los dos marcos son lo único escrito a mano de todo el port: las 126
    pantallas son generadas y se prueban contra un navegador. Acá se fija lo
    que el marco decide por su cuenta y podría equivocarse en silencio — qué
    módulo despliega, qué módulo declara sin destino, y qué pinta el header.
    ========================================================================== */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { MODULOS_REDSAT } from '../redsat-nav.data';
import { RedsatPublicShell } from './redsat-public-shell';
import { RedsatShell } from './redsat-shell';

describe('RedsatShell', () => {
  let fixture: ComponentFixture<RedsatShell>;
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
      imports: [RedsatShell],
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

    fixture = TestBed.createComponent(RedsatShell);
    router = TestBed.inject(Router);
  });

  it('monta la geometría de REDSAT: nav, y una columna con header y contenido', () => {
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

    const modulo = MODULOS_REDSAT.find((m) => m.segmento === 'directorio');
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
});

describe('RedsatPublicShell', () => {
  let fixture: ComponentFixture<RedsatPublicShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RedsatPublicShell],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(RedsatPublicShell);
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
});
