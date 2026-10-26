import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import type { RamaDepartamento } from '@core/data-access/terminology/bo-municipalities.service';
import {
  CONTORNOS_DE_MUNICIPIOS,
  PROYECCION_DE_BOLIVIA,
} from '@shared/components/organisms/department-map/bolivia-municipalities.geometry';
import { AppMap, CARGADOR_DE_LEAFLET } from '@shared/components/organisms/map/map';
import { CARGADOR_DE_PROVINCIAS } from '@shared/components/organisms/map/provinces';

import { AddressByMap, unirCalleYDistrito } from './address-by-map';

/** Dos departamentos con los municipios que se usan, con su INE real. */
const RAMAS: readonly RamaDepartamento[] = [
  {
    conceptId: 'dep-sc',
    sigla: 'SC',
    nombre: 'Santa Cruz',
    municipios: [
      { conceptId: 'mun-torno', nombre: 'El Torno', ine: '070105' },
      { conceptId: 'mun-warnes', nombre: 'Warnes', ine: '070201' },
    ],
  },
  {
    conceptId: 'dep-cb',
    sigla: 'CB',
    nombre: 'Cochabamba',
    municipios: [{ conceptId: 'mun-sacaba', nombre: 'Sacaba', ine: '031001' }],
  },
];

/** Un punto dentro del municipio: el interior que declara su contorno. */
function puntoDe(ine: string): { lat: number; lng: number } {
  const c = CONTORNOS_DE_MUNICIPIOS.find((m) => m.ine === ine);
  expect(c, `no hay contorno para ${ine}`).toBeDefined();
  const p = PROYECCION_DE_BOLIVIA;
  return {
    lat: p.lat1 - (c?.y ?? 0) / p.escala,
    lng: (c?.x ?? 0) / (p.coseno * p.escala) + p.lng0,
  };
}

describe('unirCalleYDistrito', () => {
  it('pega el distrito a la calle y lo rotula', () => {
    expect(unirCalleYDistrito('Av. Banzer #42', '5')).toBe('Av. Banzer #42, Distrito 5');
  });

  it('respeta un distrito que ya empieza por «Distrito»', () => {
    expect(unirCalleYDistrito('Av. Banzer #42', 'distrito 12')).toBe(
      'Av. Banzer #42, distrito 12',
    );
  });

  it('un distrito sin calle viaja solo', () => {
    expect(unirCalleYDistrito('', '5')).toBe('Distrito 5');
  });

  it('recorta los espacios y, sin ninguno de los dos, queda vacía', () => {
    expect(unirCalleYDistrito('  Calle 3  ', '  ')).toBe('Calle 3');
    expect(unirCalleYDistrito(' ', ' ')).toBe('');
  });
});

describe('AddressByMap', () => {
  let fixture: ComponentFixture<AddressByMap>;
  let component: AddressByMap;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddressByMap],
      providers: [
        // Sin Leaflet real ni descarga de provincias: el toque se simula por la
        // salida del mapa, que es lo que Leaflet emitiría.
        { provide: CARGADOR_DE_LEAFLET, useValue: () => new Promise(() => undefined) },
        { provide: CARGADOR_DE_PROVINCIAS, useValue: () => Promise.resolve(null) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AddressByMap);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('ramas', RAMAS);
    fixture.componentRef.setInput('testId', 'dir');
    fixture.detectChanges();
  });

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function porId(id: string): HTMLElement | null {
    return raiz().querySelector<HTMLElement>(`[data-testid="${id}"]`);
  }

  async function tocar(punto: { lat: number; lng: number }): Promise<void> {
    const mapa = fixture.debugElement.query(By.directive(AppMap));
    (mapa.componentInstance as AppMap).pointPicked.emit(punto);
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(porId('dir-buscando')).toBeNull();
    });
  }

  it('empieza por el mapa de Bolivia, que espera un toque, y sin formulario', () => {
    const mapa = fixture.debugElement.query(By.directive(AppMap)).componentInstance as AppMap;

    expect(mapa.vistaDeBolivia()).toBe(true);
    expect(mapa.seleccionable()).toBe(true);
    expect(mapa.centro()).toBeNull();
    expect(porId('dir-formulario')).toBeNull();
    expect(porId('dir-indicacion')).not.toBeNull();
    expect(porId('dir-usar-ubicacion')).not.toBeNull();
    expect(porId('dir-a-mano')).not.toBeNull();
  });

  it('al tocar, acerca el mapa al punto y abre el formulario lleno', async () => {
    const punto = puntoDe('070105');

    await tocar(punto);

    const mapa = fixture.debugElement.query(By.directive(AppMap)).componentInstance as AppMap;
    expect(mapa.centro()).toEqual(punto);
    expect(mapa.zoom()).toBe(15);
    expect(mapa.pines()).toHaveLength(1);
    expect(porId('dir-formulario')).not.toBeNull();
    expect(component.punto()).toEqual(punto);
    expect(component.municipio()).toBe('mun-torno');
    expect(porId('dir-municipio')?.textContent).toContain('El Torno');
    expect(porId('dir-departamento')?.textContent).toContain('Santa Cruz');
    // Los cinco datos están en pantalla.
    for (const id of ['dir-calle', 'dir-distrito', 'dir-municipio', 'dir-provincia', 'dir-departamento']) {
      expect(porId(id), id).not.toBeNull();
    }
  });

  it('el municipio de un toque en otro departamento reemplaza al anterior', async () => {
    await tocar(puntoDe('070105'));
    await tocar(puntoDe('031001'));

    expect(component.municipio()).toBe('mun-sacaba');
    expect(porId('dir-departamento')?.textContent).toContain('Cochabamba');
  });

  /**
   * Un toque en Brasil o en el océano no es una dirección: no abre el
   * formulario, no pone pin y lo dice.
   */
  it('un punto fuera de Bolivia lo dice, no pone pin y no abre el formulario', async () => {
    await tocar({ lat: -12.04, lng: -77.03 });

    expect(porId('dir-sin-lugar')).not.toBeNull();
    expect(component.punto()).toBeNull();
    expect(component.municipio()).toBeNull();
    expect(porId('dir-formulario')).toBeNull();
    const mapa = fixture.debugElement.query(By.directive(AppMap)).componentInstance as AppMap;
    expect(mapa.pines()).toEqual([]);
  });

  it('un toque fuera de Bolivia no vacía la calle ni mueve el punto que ya estaba', async () => {
    const punto = puntoDe('070105');
    await tocar(punto);
    component.calle.set('Av. Banzer #42');
    fixture.detectChanges();

    await tocar({ lat: 0, lng: 0 });

    expect(porId('dir-sin-lugar')).not.toBeNull();
    expect(component.punto()).toEqual(punto);
    expect(component.municipio()).toBe('mun-torno');
    expect(component.calle()).toBe('Av. Banzer #42');
    expect(porId('dir-formulario')).not.toBeNull();
  });

  it('tocar vacía la calle y el distrito escritos, y lo avisa hasta que se vuelve a escribir', async () => {
    await tocar(puntoDe('070105'));
    component.calle.set('Av. Banzer #42');
    component.distrito.set('5');
    fixture.detectChanges();

    await tocar(puntoDe('070201'));

    expect(component.calle()).toBe('');
    expect(component.distrito()).toBe('');
    expect(porId('dir-reescribir')).not.toBeNull();

    const calle = porId('dir-calle') as HTMLInputElement;
    calle.value = 'Calle 3';
    calle.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.calle()).toBe('Calle 3');
    expect(porId('dir-reescribir')).toBeNull();
  });

  it('sin calle escrita, tocar no muestra el aviso de reescribir', async () => {
    await tocar(puntoDe('070105'));

    expect(porId('dir-reescribir')).toBeNull();
  });

  it('«completar a mano» abre el formulario sin punto', () => {
    porId('dir-a-mano')?.click();
    fixture.detectChanges();

    expect(porId('dir-formulario')).not.toBeNull();
    expect(component.punto()).toBeNull();
    // Sin departamento todavía, el municipio no tiene opciones que ofrecer.
    expect(porId('dir-municipio')?.querySelector('[aria-disabled="true"], [disabled]')).not.toBeNull();
  });

  it('desde un municipio ya elegido, por ejemplo al volver de otra página, muestra el formulario', () => {
    fixture.componentRef.setInput('municipio', 'mun-warnes');
    fixture.detectChanges();

    expect(porId('dir-formulario')).not.toBeNull();
    expect(porId('dir-departamento')?.textContent).toContain('Santa Cruz');
    expect(porId('dir-municipio')?.textContent).toContain('Warnes');
  });

  it('«marcar otro lugar desde cero» suelta todo y vuelve al mapa de Bolivia', async () => {
    await tocar(puntoDe('070105'));
    component.calle.set('Av. Banzer #42');
    fixture.detectChanges();

    porId('dir-reiniciar')?.click();
    fixture.detectChanges();

    expect(component.punto()).toBeNull();
    expect(component.municipio()).toBeNull();
    expect(component.calle()).toBe('');
    expect(porId('dir-formulario')).toBeNull();
    const mapa = fixture.debugElement.query(By.directive(AppMap)).componentInstance as AppMap;
    expect(mapa.centro()).toBeNull();
    expect(mapa.pines()).toEqual([]);
  });

  it('muestra el error del municipio cuando es obligatorio y falta, con el mapa solo', () => {
    fixture.componentRef.setInput('required', true);
    fixture.componentRef.setInput('errorMessage', 'Marque su lugar en el mapa.');
    fixture.detectChanges();

    expect(porId('dir-error')?.textContent).toContain('Marque su lugar en el mapa.');
  });

  it('usar mi ubicación pasa por el mismo camino que un toque', async () => {
    const punto = puntoDe('070105');
    const geo = {
      getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) =>
        ok({ coords: { latitude: punto.lat, longitude: punto.lng } }),
    };
    Object.defineProperty(window.navigator, 'geolocation', { value: geo, configurable: true });

    porId('dir-usar-ubicacion')?.click();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(component.municipio()).toBe('mun-torno');
    });

    expect(component.punto()).toEqual(punto);
    Reflect.deleteProperty(window.navigator, 'geolocation');
  });

  it('si el navegador no da la ubicación, lo dice y deja tocar el mapa', () => {
    const geo = {
      getCurrentPosition: (_ok: unknown, mal: () => void) => mal(),
    };
    Object.defineProperty(window.navigator, 'geolocation', { value: geo, configurable: true });

    porId('dir-usar-ubicacion')?.click();
    fixture.detectChanges();

    expect(raiz().textContent).toContain('No pudimos obtener su ubicación');
    expect(component.punto()).toBeNull();
    Reflect.deleteProperty(window.navigator, 'geolocation');
  });
});
