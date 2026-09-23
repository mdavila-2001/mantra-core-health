import { TestBed } from '@angular/core/testing';

import { PracticeSitesMap } from './practice-sites-map';
import {
  CARGADOR_DE_LEAFLET,
  type CargadorDeLeaflet,
} from '../../../../../../shared/components/organisms/map/map';
import type { PinMapa } from '../../../../../../shared/components/organisms/map/pin-mapa.types';
import type { SedeVisible } from '../practitioner-profile-view.types';

/**
 * El bloque «Tus consultorios y sedes», que el cliente pidió como mapa el
 * 19/09/2026.
 *
 * Leaflet entra doblado: acá se prueba qué pines se le pasan y qué dice la
 * lista, no la cartografía — el organismo del mapa tiene su propio spec.
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

describe('PracticeSitesMap', () => {
  const sede = (over: Partial<SedeVisible> = {}): SedeVisible => ({
    id: 'sede-1',
    nombre: 'Consultorio Dra. Rojas',
    direccion: 'CALLE LIBERTAD N.º 240',
    punto: { lat: -17.78, lng: -63.18 },
    ...over,
  });

  function montar(sedes: readonly SedeVisible[]) {
    TestBed.configureTestingModule({
      imports: [PracticeSitesMap],
      providers: [
        {
          provide: CARGADOR_DE_LEAFLET,
          useValue: (() => Promise.resolve(leafletDoblado())) as CargadorDeLeaflet,
        },
      ],
    });
    const fixture = TestBed.createComponent(PracticeSitesMap);
    fixture.componentRef.setInput('sedes', sedes);
    fixture.detectChanges();
    return fixture;
  }

  /** Los pines que el componente le pasa al mapa. */
  function pines(fixture: ReturnType<typeof montar>): readonly PinMapa[] {
    return (fixture.componentInstance as unknown as { pines: () => readonly PinMapa[] }).pines();
  }

  it('pone un pin por sede ubicada, con el mismo número que la lista', () => {
    const fixture = montar([
      sede(),
      sede({ id: 'sede-2', nombre: 'Clínica Los Olivos', punto: { lat: -17.75, lng: -63.16 } }),
    ]);

    expect(pines(fixture).map((pin) => [pin.id, pin.codigo])).toEqual([
      ['sede-1', '1'],
      ['sede-2', '2'],
    ]);
    const raiz = fixture.nativeElement as HTMLElement;
    expect([...raiz.querySelectorAll('.sedes__orden')].map((o) => o.textContent?.trim())).toEqual([
      '1',
      '2',
    ]);
  });

  it('una sede sin coordenadas se lista igual, sin pin y diciendo por qué', () => {
    // Esconderla sería borrar del perfil un consultorio por un dato que falta.
    const fixture = montar([sede({ id: 'sede-3', nombre: 'Hospital San Lucas', punto: null })]);
    const raiz = fixture.nativeElement as HTMLElement;

    expect(pines(fixture)).toHaveLength(0);
    expect(raiz.querySelectorAll('[data-testid="perfil-sede"]')).toHaveLength(1);
    expect(raiz.querySelector('.sedes__aviso')?.textContent).toContain('Sin ubicación cargada');
    // Y sin punto no hay ruta que ofrecer.
    expect(raiz.querySelector('.sedes__ruta')).toBeNull();
  });

  it('si ninguna está ubicada no dibuja el mapa', () => {
    const fixture = montar([sede({ punto: null })]);

    expect((fixture.nativeElement as HTMLElement).querySelector('app-map')).toBeNull();
  });

  it('tocar un renglón resalta su pin, y volver a tocarlo lo suelta', () => {
    // Los pines de Leaflet no participan del orden de tabulación: la lista ES
    // el camino por teclado, así que el estado tiene que oírse.
    const fixture = montar([sede(), sede({ id: 'sede-2', nombre: 'Clínica Los Olivos' })]);
    const raiz = fixture.nativeElement as HTMLElement;
    const primero = raiz.querySelector<HTMLButtonElement>('.sedes__boton')!;

    primero.click();
    fixture.detectChanges();
    expect(primero.getAttribute('aria-pressed')).toBe('true');

    primero.click();
    fixture.detectChanges();
    expect(primero.getAttribute('aria-pressed')).toBe('false');
  });

  it('el pie dice cuántas quedaron fuera del mapa', () => {
    const fixture = montar([sede(), sede({ id: 'sede-2', punto: null })]);

    const pie = (fixture.nativeElement as HTMLElement).querySelector('.sedes__pie');
    expect(pie?.textContent?.replace(/\s+/g, ' ')).toContain('1 de tus 2 sedes');
  });
});
