import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { DatosDeLaEmpresa } from './datos-de-la-empresa';
import { EMPRESA_DE_EJEMPLO } from '../pharmacy-profile.fixtures';
import { AppMap, CARGADOR_DE_LEAFLET } from '../../../../shared/components/organisms/map/map';
import type { CargadorDeLeaflet } from '../../../../shared/components/organisms/map/map';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import { TIPOS_DE_SOCIEDAD } from '../pharmacy-profile.types';
import type { DatosLegalesDeLaEmpresa } from '../pharmacy-profile.types';
import type { ViewState } from '../../../../core/view-state/view-state.types';

/**
 * El organismo del mapa entra con Leaflet doblado: acá se prueba la ficha, no
 * la cartografía — el mapa tiene su propio spec.
 */
function leafletDoblado(): unknown {
  const marcador = {
    bindPopup: () => marcador,
    on: () => marcador,
    addTo: () => marcador,
    getElement: () => document.createElement('div'),
  };
  return {
    map: () => ({
      setView: () => undefined,
      fitBounds: () => undefined,
      remove: () => undefined,
    }),
    tileLayer: () => ({ addTo: () => undefined }),
    layerGroup: () => ({ addTo: () => undefined, remove: () => undefined }),
    marker: () => marcador,
    divIcon: (opciones: unknown) => opciones,
    latLngBounds: (limites: unknown) => limites,
  };
}

describe('DatosDeLaEmpresa', () => {
  let fixture: ComponentFixture<DatosDeLaEmpresa>;
  let toasts: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: CARGADOR_DE_LEAFLET,
          useValue: (() => Promise.resolve(leafletDoblado())) as CargadorDeLeaflet,
        },
      ],
    });
  });

  function montar(state: ViewState<DatosLegalesDeLaEmpresa> = ready(EMPRESA_DE_EJEMPLO)): HTMLElement {
    fixture = TestBed.createComponent(DatosDeLaEmpresa);
    toasts = TestBed.inject(ToastService);
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function escribir(root: HTMLElement, testId: string, texto: string): void {
    const campo = root.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
    expect(campo).not.toBeNull();
    campo!.value = texto;
    campo!.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  afterEach(() => fixture.destroy());

  it('se abre en lectura: los datos a la vista y ningún formulario', () => {
    const root = montar();

    expect(root.querySelector('[data-testid="ficha-empresa"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="ficha-razon-social"]')).toBeNull();
    const texto = root.textContent ?? '';
    expect(texto).toContain('Farmacia Andina S.R.L.');
    expect(texto).toContain('SRL');
    expect(texto).toContain('1028394027');
    expect(texto).toContain('Av. Cañoto 245');
  });

  it('explica por qué el tipo de sociedad no admite texto libre, también al leer', () => {
    expect(montar().textContent ?? '').toContain('la plataforma cuenta cuántos proveedores');
  });

  it('el formulario se abre en la misma pestaña, con lo que ya había cargado', () => {
    const root = montar();

    root.querySelector<HTMLButtonElement>('[data-testid="ficha-editar-empresa"]')?.click();
    fixture.detectChanges();

    const razon = root.querySelector<HTMLInputElement>('[data-testid="ficha-razon-social"]');
    expect(razon?.value).toBe('Farmacia Andina S.R.L.');
    expect(root.querySelector('[data-testid="ficha-empresa"]')).toBeNull();
  });

  it('el tipo de sociedad ofrece los ocho del registro, en su orden y sin traducir', () => {
    const root = montar();
    root.querySelector<HTMLButtonElement>('[data-testid="ficha-editar-empresa"]')?.click();
    fixture.detectChanges();

    const opciones = Array.from(root.querySelectorAll('option'))
      .map((opcion) => opcion.textContent?.trim())
      .filter((texto) => texto !== 'Elegí el tipo de sociedad');
    expect(opciones).toEqual([...TIPOS_DE_SOCIEDAD]);
  });

  it('el formulario avisa que lo escrito no se guarda todavía', () => {
    const root = montar();
    root.querySelector<HTMLButtonElement>('[data-testid="ficha-editar-empresa"]')?.click();
    fixture.detectChanges();

    expect(root.querySelector('app-alert')?.textContent ?? '').toContain('se pierde al recargar');
  });

  it('descartar vuelve a la ficha sin tocar ningún dato', () => {
    const root = montar();
    root.querySelector<HTMLButtonElement>('[data-testid="ficha-editar-empresa"]')?.click();
    fixture.detectChanges();
    escribir(root, 'ficha-razon-social', 'Otra razón social');

    root.querySelector<HTMLButtonElement>('[data-testid="ficha-descartar"]')?.click();
    fixture.detectChanges();

    const texto = root.textContent ?? '';
    expect(texto).toContain('Farmacia Andina S.R.L.');
    expect(texto).not.toContain('Otra razón social');
  });

  it('aplicar deja la ficha con lo escrito y dice que todavía no se guarda', () => {
    const root = montar();
    root.querySelector<HTMLButtonElement>('[data-testid="ficha-editar-empresa"]')?.click();
    fixture.detectChanges();
    escribir(root, 'ficha-razon-social', 'Farmacia Andina Ltda.');

    root.querySelector<HTMLButtonElement>('[data-testid="ficha-aplicar"]')?.click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="ficha-empresa"]')?.textContent).toContain(
      'Farmacia Andina Ltda.',
    );
    const aviso = toasts.toasts().at(-1);
    expect(aviso?.title).toBe('Cambios sólo en pantalla');
  });

  it('el punto de la central también se dice en texto, no sólo en el mapa', () => {
    const punto = montar().querySelector('[data-testid="ficha-punto"]')?.textContent ?? '';

    expect(punto).toMatch(/17[.,]7863/);
    expect(punto).toMatch(/63[.,]1812/);
  });

  it('en lectura, tocar el mapa no mueve el punto de la ficha', () => {
    const root = montar();
    const antes = root.querySelector('[data-testid="ficha-punto"]')?.textContent;

    fixture.debugElement
      .query(By.directive(AppMap))
      .componentInstance.pointPicked.emit({ lat: -16.5, lng: -68.15 });
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="ficha-punto"]')?.textContent).toBe(antes);
  });

  it('con el formulario abierto, el punto marcado en el mapa sí entra a la ficha', () => {
    const root = montar();
    root.querySelector<HTMLButtonElement>('[data-testid="ficha-editar-empresa"]')?.click();
    fixture.detectChanges();

    fixture.debugElement
      .query(By.directive(AppMap))
      .componentInstance.pointPicked.emit({ lat: -16.5, lng: -68.15 });
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="ficha-punto"]')?.textContent).toMatch(/16[.,]5000/);
  });

  it('mientras carga muestra el esqueleto y ningún dato de la empresa', () => {
    const root = montar(loading());

    expect(root.querySelector('app-skeleton')).not.toBeNull();
    expect(root.textContent ?? '').not.toContain('Farmacia Andina');
  });
});
