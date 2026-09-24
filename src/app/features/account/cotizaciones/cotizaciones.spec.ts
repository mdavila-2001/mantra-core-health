import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError, type Observable } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../../core/auth/auth.service';
import { DiagnosticsClient } from '../../../core/data-access/diagnostics/diagnostics.client';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import type { SearchOrigin } from '../../nearby-places/search-origin-picker/search-origin-picker.types';
import { Cotizaciones } from './cotizaciones';
import { CotizacionesFuentes, type BusquedaDeCotizaciones } from './cotizaciones.fuentes';
import type { CotizacionResultado, VerticalCotizacion } from './cotizaciones.logic';

/**
 * «Cotizaciones» del paciente — H3.S2.
 *
 * La fuente es un doble ({@link CotizacionesFuentes} tiene su propio spec con
 * las peticiones HTTP): acá se fijan la pantalla y sus estados.
 */
describe('Cotizaciones', () => {
  let fixture: ComponentFixture<Cotizaciones>;
  let buscar: ReturnType<
    typeof vi.fn<
      (
        t: string,
        v: VerticalCotizacion,
        o: SearchOrigin | null,
      ) => Observable<BusquedaDeCotizaciones>
    >
  >;
  const getOwnOrders = vi.fn();

  const FARMACIA: CotizacionResultado = {
    id: 'farmacia:1',
    vertical: 'MEDICAMENTOS',
    que: 'Paracetamol 500 mg',
    donde: 'Farmacia Central',
    price: {
      amount: 12.5,
      currency: 'BOB',
      source: 'Lista PUBLICO de Farmacia Central',
    },
    distanceKm: 2.4,
    accion: { etiqueta: 'Directorio de farmacias', ruta: '/pharmacies-directory' },
  };
  const SIN_PRECIO: CotizacionResultado = {
    id: 'estudio:1',
    vertical: 'IMAGENOLOGIA',
    que: 'Tomografía de cráneo',
    donde: 'Centro Imagen',
    price: null,
    distanceKm: null,
    sinPrecio: 'El centro no publicó el precio de este estudio',
    sinDistancia: 'El centro no publica su ubicación en el directorio',
  };
  const ARANCEL: CotizacionResultado = {
    id: 'arancel:1',
    vertical: 'SERVICIOS_MEDICOS',
    que: 'Consulta médica',
    donde: 'Medicina general',
    price: {
      amount: 5,
      currency: 'UMA',
      source: 'Referencia del Colegio Médico de Santa Cruz 2025, en UMA (sin conversión)',
    },
    distanceKm: null,
    sinDistancia: 'No aplica: es un arancel de referencia, no una sede',
  };

  function respuesta(
    resultados: readonly CotizacionResultado[],
    fuentesCaidas: BusquedaDeCotizaciones['fuentesCaidas'] = [],
  ) {
    return of({ resultados, fuentesCaidas });
  }

  async function montar(): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CotizacionesFuentes, useValue: { buscar } },
        { provide: AuthService, useValue: { patientProfileId: signal<string | null>(null) } },
        { provide: ProfilesClient, useValue: {} },
        { provide: DiagnosticsClient, useValue: { getOwnOrders } },
      ],
    });
    fixture = TestBed.createComponent(Cotizaciones);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function asentar(): Promise<void> {
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(): string {
    return raiz().textContent ?? '';
  }

  /** Lo que la persona hace desde los controles, sin esperar el debounce del campo. */
  function componente(): Cotizaciones & {
    buscar(t: string): void;
    cambiarOrden(o: 'PRECIO' | 'CERCANIA' | null): void;
    cambiarVertical(v: VerticalCotizacion | null): void;
    origen: { set(o: SearchOrigin | null): void };
  } {
    return fixture.componentInstance as unknown as ReturnType<typeof componente>;
  }

  beforeEach(() => {
    buscar = vi.fn();
    getOwnOrders.mockClear();
  });

  it('sin término pide qué cotizar y no consulta ninguna fuente', async () => {
    buscar.mockReturnValue(respuesta([]));
    await montar();

    expect(raiz().querySelector('[data-testid="cotizaciones-sin-termino"]')).not.toBeNull();
    expect(buscar).not.toHaveBeenCalled();
  });

  it('busca en las cuatro verticales y muestra precio con su procedencia', async () => {
    buscar.mockReturnValue(respuesta([FARMACIA, SIN_PRECIO, ARANCEL]));
    await montar();
    componente().buscar('para');
    await asentar();

    expect(buscar).toHaveBeenCalledWith('para', 'TODAS', null);
    expect(texto()).toContain('12,50 BOB');
    expect(texto()).toContain('Lista PUBLICO de Farmacia Central');
    expect(texto()).toContain('2,4 km');
  });

  it('el precio no publicado se dice, con la procedencia en el title', async () => {
    buscar.mockReturnValue(respuesta([SIN_PRECIO]));
    await montar();
    componente().buscar('tomo');
    await asentar();

    const precio = raiz().querySelector('.cotizaciones__precio--no-publicado');
    expect(precio?.textContent?.trim()).toBe('Precio no publicado');
    expect(precio?.getAttribute('title')).toBe('El centro no publicó el precio de este estudio');
    expect(texto()).toContain('El centro no publica su ubicación en el directorio');
  });

  /** Q-16: UMA rotulado como referencia y nunca convertido a bolivianos. */
  it('el arancel se muestra en UMA, rotulado y sin conversión', async () => {
    buscar.mockReturnValue(respuesta([ARANCEL]));
    await montar();
    componente().buscar('consulta');
    await asentar();

    expect(texto()).toContain('5 UMA');
    expect(texto()).toContain('Referencia del Colegio Médico de Santa Cruz 2025');
    expect(texto()).not.toMatch(/Bs\.? ?\d/u);
  });

  it('ordenar por precio deja los no publicados al final', async () => {
    buscar.mockReturnValue(respuesta([SIN_PRECIO, FARMACIA]));
    await montar();
    componente().buscar('x y');
    await asentar();

    const filas = Array.from(raiz().querySelectorAll('app-data-table .cotizaciones__que')).map(
      (f) => f.textContent,
    );
    expect(filas).toEqual(['Paracetamol 500 mg', 'Tomografía de cráneo']);
  });

  it('cercanía sin origen es su propio estado, y ofrece ordenar por precio', async () => {
    buscar.mockReturnValue(respuesta([FARMACIA]));
    await montar();
    componente().buscar('para');
    componente().cambiarOrden('CERCANIA');
    await asentar();

    const aviso = raiz().querySelector('[data-testid="cotizaciones-sin-ubicacion"]');
    expect(aviso).not.toBeNull();
    const boton = Array.from(aviso!.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Ordenar por precio'),
    ) as HTMLButtonElement;
    expect(boton.querySelector('svg')).not.toBeNull();
    boton.click();
    await asentar();

    expect(raiz().querySelector('[data-testid="cotizaciones-sin-ubicacion"]')).toBeNull();
    expect(texto()).toContain('Paracetamol 500 mg');
  });

  /** H3.S2.M2: la distancia la calcula la fuente desde el origen: cambiarlo recalcula. */
  it('elegir un origen vuelve a consultar con ese punto', async () => {
    buscar.mockReturnValue(respuesta([FARMACIA]));
    await montar();
    componente().buscar('para');
    await asentar();
    const origen: SearchOrigin = { source: 'home', lat: -17.78, lng: -63.18 };
    componente().origen.set(origen);
    await asentar();

    expect(buscar).toHaveBeenLastCalledWith('para', 'TODAS', origen);
  });

  it('sin origen, la distancia de las farmacias pide elegir desde dónde medir', async () => {
    buscar.mockReturnValue(respuesta([{ ...FARMACIA, distanceKm: null }]));
    await montar();
    componente().buscar('para');
    await asentar();

    expect(texto()).toContain('Elegí desde dónde medir');
  });

  it('cambiar la vertical consulta sólo esa', async () => {
    buscar.mockReturnValue(respuesta([FARMACIA]));
    await montar();
    componente().buscar('para');
    componente().cambiarVertical('MEDICAMENTOS');
    await asentar();

    expect(buscar).toHaveBeenLastCalledWith('para', 'MEDICAMENTOS', null);
  });

  it('mientras busca lo anuncia', async () => {
    buscar.mockReturnValue(new Subject<BusquedaDeCotizaciones>());
    await montar();
    componente().buscar('para');
    await asentar();

    expect(raiz().querySelector('[aria-busy="true"], [role="status"]')).not.toBeNull();
    expect(texto()).not.toContain('No encontramos cotizaciones');
  });

  it('sin resultados lo dice y sugiere otra búsqueda', async () => {
    buscar.mockReturnValue(respuesta([]));
    await montar();
    componente().buscar('zzzz');
    await asentar();

    expect(texto()).toContain('No encontramos cotizaciones');
  });

  it('un error ofrece reintentar y reintentar vuelve a consultar', async () => {
    buscar.mockReturnValue(throwError(() => new Error('caída')));
    await montar();
    componente().buscar('para');
    await asentar();
    const llamadas = buscar.mock.calls.length;

    const reintentar = Array.from(raiz().querySelectorAll('button')).find((b) =>
      /Reintentar|Volver a intentar/u.test(b.textContent ?? ''),
    ) as HTMLButtonElement | undefined;
    expect(reintentar).toBeDefined();
    buscar.mockReturnValue(respuesta([FARMACIA]));
    reintentar!.click();
    await asentar();

    expect(buscar.mock.calls.length).toBe(llamadas + 1);
    expect(texto()).toContain('Paracetamol 500 mg');
  });

  it('si una fuente no respondió, avisa cuál y muestra el resto', async () => {
    buscar.mockReturnValue(respuesta([FARMACIA], ['ANALISIS']));
    await montar();
    componente().buscar('para');
    await asentar();

    expect(
      raiz().querySelector('[data-testid="cotizaciones-fuente-caida"]')?.textContent,
    ).toContain('Análisis');
    expect(texto()).toContain('Paracetamol 500 mg');
  });

  it('con filas, también las pinta como tarjetas para pantalla angosta', async () => {
    buscar.mockReturnValue(respuesta([FARMACIA, ARANCEL]));
    await montar();
    componente().buscar('para');
    await asentar();

    const tarjetas = raiz().querySelectorAll('[data-testid="cotizaciones-tarjeta"]');
    expect(tarjetas).toHaveLength(2);
    expect(tarjetas[0]!.textContent).toContain('Farmacia Central');
    expect(raiz().querySelector('app-data-table')?.classList).toContain(
      'cotizaciones__tabla--con-filas',
    );
  });

  it('cada fila lleva a una pantalla existente con ícono + texto', async () => {
    buscar.mockReturnValue(respuesta([FARMACIA]));
    await montar();
    componente().buscar('para');
    await asentar();

    const accion = raiz().querySelector('a.cotizaciones__accion');
    expect(accion?.textContent).toContain('Directorio de farmacias');
    expect(accion?.querySelector('svg')).not.toBeNull();
    expect(accion?.getAttribute('href')).toBe('/pharmacies-directory');
  });

  it('no carga estudios personales dentro del comparador', async () => {
    buscar.mockReturnValue(respuesta([]));
    await montar();

    expect(getOwnOrders).not.toHaveBeenCalled();
    expect(texto()).not.toContain('Estudios en tus documentos actuales');
  });
});
