/**
 * El organismo de mapa, sin Leaflet real: jsdom no da layout y el chunk
 * dinámico es justamente lo que no queremos en la suite. El doble entra por
 * `CARGADOR_DE_LEAFLET` y registra lo que el componente le pide — lo que se
 * fija acá es el contrato: pines dibujados, selección cruzada, encuadre,
 * CSS enganchado una vez, y el render de servidor que no monta nada.
 */
import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppMap, CARGADOR_DE_LEAFLET, construirPopup } from './map';
import type { CargadorDeLeaflet } from './map';
import type { PinMapa } from './pin-mapa.types';

/* ---- el doble de Leaflet -------------------------------------------------- */

interface IconoFalso {
  readonly html: HTMLElement;
}

class MarcadorFalso {
  popup: HTMLElement | null = null;
  private readonly manejadores = new Map<string, () => void>();
  private readonly elemento = document.createElement('div');

  constructor(
    readonly coordenadas: readonly [number, number],
    readonly opciones: { icon: IconoFalso; alt: string; keyboard: boolean },
  ) {
    this.elemento.appendChild(opciones.icon.html);
  }

  bindPopup(contenido: HTMLElement): this {
    this.popup = contenido;
    return this;
  }

  on(evento: string, manejador: () => void): this {
    this.manejadores.set(evento, manejador);
    return this;
  }

  addTo(): this {
    return this;
  }

  getElement(): HTMLElement {
    return this.elemento;
  }

  simular(evento: string): void {
    this.manejadores.get(evento)?.();
  }
}

class RegistroLeaflet {
  readonly vistas: unknown[] = [];
  readonly encuadres: unknown[] = [];
  readonly marcadores: MarcadorFalso[] = [];
  readonly tiles: string[] = [];
  gruposQuitados = 0;
  mapasQuitados = 0;
}

function leafletFalso(registro: RegistroLeaflet): unknown {
  return {
    map: () => ({
      setView: (centro: unknown, zoom: unknown) => registro.vistas.push([centro, zoom]),
      fitBounds: (limites: unknown) => registro.encuadres.push(limites),
      remove: () => {
        registro.mapasQuitados += 1;
      },
    }),
    tileLayer: (url: string) => {
      registro.tiles.push(url);
      return { addTo: () => undefined };
    },
    layerGroup: () => ({
      addTo: () => undefined,
      remove: () => {
        registro.gruposQuitados += 1;
      },
    }),
    marker: (coordenadas: readonly [number, number], opciones: MarcadorFalso['opciones']) => {
      const marcador = new MarcadorFalso(coordenadas, opciones);
      registro.marcadores.push(marcador);
      return marcador;
    },
    divIcon: (opciones: IconoFalso) => opciones,
    latLngBounds: (limites: unknown) => limites,
  };
}

/* ---- arnés ---------------------------------------------------------------- */

const PINES: readonly PinMapa[] = [
  {
    id: 'A',
    codigo: 'A',
    lat: -17.7833,
    lng: -63.1821,
    titulo: 'Farmacia Central · Sede Centro',
    subtitulo: '1,2 km en línea recta',
    estado: { etiqueta: 'Tiene todo', tono: 'success' },
    ctaEtiqueta: 'Ver en la lista',
  },
  {
    id: 'B',
    codigo: 'B',
    lat: -17.8,
    lng: -63.2,
    titulo: 'Farmacia Sur · Sede Parque',
    estado: { etiqueta: 'Le falta algo', tono: 'warning' },
  },
];

async function crearMontado(
  pines: readonly PinMapa[] = PINES,
): Promise<{ fixture: ComponentFixture<AppMap>; registro: RegistroLeaflet }> {
  const registro = new RegistroLeaflet();
  TestBed.configureTestingModule({
    imports: [AppMap],
    providers: [
      {
        provide: CARGADOR_DE_LEAFLET,
        useValue: (() => Promise.resolve(leafletFalso(registro))) as CargadorDeLeaflet,
      },
    ],
  });
  const fixture = TestBed.createComponent(AppMap);
  fixture.componentRef.setInput('pines', pines);
  fixture.componentRef.setInput('etiqueta', 'Sucursales en el mapa; la lista está debajo.');
  await fixture.whenStable();
  // `montar()` espera el import dinámico: dos microtareas y un render más.
  await Promise.resolve();
  await Promise.resolve();
  fixture.detectChanges();
  return { fixture, registro };
}

afterEach(() => {
  document.getElementById('leaflet-css')?.remove();
});

/* ---- specs ---------------------------------------------------------------- */

describe('AppMap', () => {
  it('muestra el aviso de espera y lo quita al montar', async () => {
    const { fixture } = await crearMontado();
    expect(fixture.nativeElement.textContent).not.toContain('Cargando el mapa');
  });

  it('en el servidor no monta nada: queda el aviso y Leaflet no se pide', async () => {
    let cargas = 0;
    TestBed.configureTestingModule({
      imports: [AppMap],
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: CARGADOR_DE_LEAFLET,
          useValue: (() => {
            cargas += 1;
            return Promise.resolve(leafletFalso(new RegistroLeaflet()));
          }) as CargadorDeLeaflet,
        },
      ],
    });
    const fixture = TestBed.createComponent(AppMap);
    fixture.componentRef.setInput('pines', PINES);
    fixture.componentRef.setInput('etiqueta', 'Mapa');
    await fixture.whenStable();
    expect(cargas).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Cargando el mapa');
  });

  it('engancha el CSS de Leaflet una sola vez por documento', async () => {
    await crearMontado();
    expect(document.querySelectorAll('#leaflet-css')).toHaveLength(1);
  });

  it('dibuja un pin por lugar, con su código, su tono y su título', async () => {
    const { registro } = await crearMontado();
    expect(registro.marcadores).toHaveLength(2);
    const [primero, segundo] = registro.marcadores;
    expect(primero.opciones.alt).toBe('Farmacia Central · Sede Centro');
    expect(primero.opciones.icon.html.textContent).toBe('A');
    expect(primero.opciones.icon.html.className).toContain('mapa__pin--success');
    expect(segundo.opciones.icon.html.className).toContain('mapa__pin--warning');
    // El camino por teclado es la lista: el pin no entra al orden de tabulación.
    expect(primero.opciones.keyboard).toBe(false);
  });

  it('pide los mosaicos a OpenStreetMap, sin clave y sin marca de agua', async () => {
    const { registro } = await crearMontado();

    expect(registro.tiles).toEqual(['https://tile.openstreetmap.org/{z}/{x}/{y}.png']);
    // CARTO estampa «API KEY REQUIRED» sobre cada mosaico desde el 19/09/2026:
    // llegan con 200 y el mapa se ve roto sin que la consola diga nada.
    expect(registro.tiles.join(' ')).not.toContain('cartocdn');
  });

  it('con varios pines encuadra con fitBounds sobre todas las coordenadas', async () => {
    const { registro } = await crearMontado();
    expect(registro.encuadres).toHaveLength(1);
    expect(registro.encuadres[0]).toEqual([
      [-17.7833, -63.1821],
      [-17.8, -63.2],
    ]);
  });

  it('con un solo pin centra en él en vez de encuadrar', async () => {
    const { registro } = await crearMontado([PINES[0]]);
    expect(registro.encuadres).toHaveLength(0);
    const ultimaVista = registro.vistas.at(-1);
    expect(ultimaVista).toEqual([[-17.7833, -63.1821], 15]);
  });

  it('el centro impuesto le gana al encuadre de los pines', async () => {
    const registro = new RegistroLeaflet();
    TestBed.configureTestingModule({
      imports: [AppMap],
      providers: [
        {
          provide: CARGADOR_DE_LEAFLET,
          useValue: (() => Promise.resolve(leafletFalso(registro))) as CargadorDeLeaflet,
        },
      ],
    });
    const fixture = TestBed.createComponent(AppMap);
    fixture.componentRef.setInput('pines', PINES);
    fixture.componentRef.setInput('etiqueta', 'Mapa');
    fixture.componentRef.setInput('centro', { lat: -16.5, lng: -68.15 });
    fixture.componentRef.setInput('zoom', 13);
    await fixture.whenStable();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();
    expect(registro.encuadres).toHaveLength(0);
    expect(registro.vistas.at(-1)).toEqual([[-16.5, -68.15], 13]);
  });

  it('tocar un pin publica la selección en `seleccionado`', async () => {
    const { fixture, registro } = await crearMontado();
    registro.marcadores[1].simular('click');
    expect(fixture.componentInstance.seleccionado()).toBe('B');
  });

  it('la selección externa resalta el pin sin recentrar el mapa', async () => {
    const { fixture, registro } = await crearMontado();
    const vistasAntes = registro.vistas.length;
    const encuadresAntes = registro.encuadres.length;

    fixture.componentRef.setInput('seleccionado', 'A');
    fixture.detectChanges();

    const caras = registro.marcadores.map(
      (marcador) => marcador.getElement().querySelector('.mapa__pin'),
    );
    expect(caras[0]?.classList.contains('mapa__pin--activo')).toBe(true);
    expect(caras[1]?.classList.contains('mapa__pin--activo')).toBe(false);
    expect(registro.vistas.length).toBe(vistasAntes);
    expect(registro.encuadres.length).toBe(encuadresAntes);
  });

  it('cambiar los pines redibuja: la capa vieja se quita y nacen marcadores nuevos', async () => {
    const { fixture, registro } = await crearMontado();
    fixture.componentRef.setInput('pines', [PINES[1]]);
    fixture.detectChanges();
    expect(registro.gruposQuitados).toBe(1);
    expect(registro.marcadores).toHaveLength(3);
  });

  it('al destruirse le devuelve el lienzo a Leaflet con `remove()`', async () => {
    const { fixture, registro } = await crearMontado();
    fixture.destroy();
    expect(registro.mapasQuitados).toBe(1);
  });
});

describe('construirPopup', () => {
  const pin = PINES[0];

  it('arma título, estado y detalle como texto, nunca como HTML', () => {
    const contenido = construirPopup(document, { ...pin, titulo: '<img src=x>' }, () => undefined);
    expect(contenido.querySelector('img')).toBeNull();
    expect(contenido.querySelector('.mapa__popup-titulo')?.textContent).toBe('<img src=x>');
    expect(contenido.querySelector('.mapa__popup-estado')?.textContent).toBe('Tiene todo');
    expect(contenido.querySelector('.mapa__popup-detalle')?.textContent).toBe(
      '1,2 km en línea recta',
    );
  });

  it('el CTA dispara el callback al activarse', () => {
    let elegido = false;
    const contenido = construirPopup(document, pin, () => {
      elegido = true;
    });
    const cta = contenido.querySelector<HTMLButtonElement>('.mapa__popup-cta');
    expect(cta?.textContent).toBe('Ver en la lista');
    cta?.click();
    expect(elegido).toBe(true);
  });

  it('sin `ctaEtiqueta` no hay botón, y sin estado ni subtítulo tampoco sus piezas', () => {
    const contenido = construirPopup(
      document,
      { id: 'x', lat: 0, lng: 0, titulo: 'Solo título' },
      () => undefined,
    );
    expect(contenido.querySelector('.mapa__popup-cta')).toBeNull();
    expect(contenido.querySelector('.mapa__popup-estado')).toBeNull();
    expect(contenido.querySelector('.mapa__popup-detalle')).toBeNull();
  });
});
