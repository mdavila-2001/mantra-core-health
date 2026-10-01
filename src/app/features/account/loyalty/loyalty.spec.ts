import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import type { Provider } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError, type Observable } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import {
  LoyaltyClient,
  SaldoInsuficienteError,
} from '../../../core/data-access/loyalty/loyalty.client';
import type {
  Membresia,
  MovimientoDePuntos,
  PaginaDeMovimientos,
} from '../../../core/data-access/loyalty/loyalty.types';
import { Loyalty } from './loyalty';

/**
 * «Mis puntos» contra el contrato real (R-T-E6B2).
 *
 * Los datos de estos casos vienen de un doble de `LoyaltyClient`, que es donde
 * vive el HTTP: acá se prueba qué hace la pantalla con lo que el backend
 * responde. Lo que se fija es que no reaparezca nada fabricado, que
 * `enrolled: false` sea un vacío y no un error, y que el canje muestre lo que
 * devolvió la API.
 */

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const MEMBRESIA: Membresia = {
  id: 'm-1',
  programa: 'Puntos AloVida',
  unidad: 'puntos',
  saldo: '440',
  puntosDePorVida: '720',
  nivel: {
    codigo: 'FRECUENTE',
    nombre: 'Frecuente',
    multiplicador: '1.25',
    puntosMinimos: '500',
  },
  inscritaEl: new Date('2026-05-01T10:00:00'),
  activa: true,
};

function movimiento(extra: Partial<MovimientoDePuntos> = {}): MovimientoDePuntos {
  return {
    id: 'mv-1',
    direccion: 'POINTS_EARN',
    puntos: '70',
    motivo: 'REASON_EVENT',
    saldoDespues: '440',
    detalle: null,
    ocurrioEl: new Date('2026-09-14T10:00:00'),
    venceEl: null,
    ...extra,
  };
}

/** Doble del cliente: sólo lo que la pantalla consume. */
function clienteDoble(over: Record<string, unknown> = {}): Provider {
  return {
    provide: LoyaltyClient,
    useValue: {
      miMembresia: () => of(null),
      misMovimientos: () => of({ movimientos: [], nextCursor: null }),
      canjear: () => of({}),
      comprobanteDe: () => ({
        canje: { id: 'e-1', puntos: '100', saldoDespues: '340', puntosDePorVida: '720', duplicado: false },
        codigo: 'HJ4KMP73',
        generadoEl: new Date('2026-09-18T10:00:00'),
        venceEl: new Date('2026-09-18T10:15:00'),
      }),
      ...over,
    },
  };
}

describe('Loyalty', () => {
  let fixture: ComponentFixture<Loyalty>;

  function montar(claims: Record<string, unknown>, providers: Provider[] = []): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), ...providers],
    });
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], ...claims }),
      refreshToken: 'r-1',
    });
    fixture = TestBed.createComponent(Loyalty);
    fixture.detectChanges();
  }

  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const porTestId = (id: string): HTMLElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="${id}"]`);

  it('sin perfil de paciente lo dice, sin llamar a la API', () => {
    montar({}, [clienteDoble()]);

    expect(texto()).toContain('Esta sección es para pacientes');
    expect(porTestId('puntos-saldo')).toBeNull();
  });

  /**
   * N-03: la billetera vive también como pestaña de «Mi perfil». Ahí la
   * tarjeta ya tiene cabecera, así que `embebido` apaga la propia — y nada más:
   * lo que se ve del programa es lo mismo en los dos lugares.
   */
  describe('cabecera propia o embebida', () => {
    const cabecera = (): Element | null =>
      (fixture.nativeElement as HTMLElement).querySelector('app-page-header');

    it('en su ruta lleva cabecera y migas, como siempre', () => {
      montar({ pid: 'pp-1' }, [clienteDoble()]);

      expect(cabecera()).not.toBeNull();
      expect(texto()).toContain('Todavía no hay un programa');
    });

    it('embebida en la ficha, sin cabecera: la tarjeta ya tiene una', () => {
      montar({ pid: 'pp-1' }, [clienteDoble()]);
      fixture.componentRef.setInput('embebido', true);
      fixture.detectChanges();

      expect(cabecera()).toBeNull();
      expect(texto()).not.toContain('Lo que sumaste con tus compras');
      // El cuerpo sigue entero: lo que se apaga es sólo el título repetido.
      expect(texto()).toContain('Todavía no hay un programa');
    });
  });

  it('mientras la lectura no responde muestra el estado de carga', () => {
    const pendiente = new Subject<Membresia | null>();
    montar({ pid: 'pp-1' }, [clienteDoble({ miMembresia: () => pendiente })]);

    expect(porTestId('puntos-saldo')).toBeNull();
    expect(texto()).not.toContain('Todavía no hay un programa');
  });

  it('enrolled:false se pinta como vacío del producto, no como error', () => {
    montar({ pid: 'pp-1' }, [clienteDoble()]);

    expect(texto()).toContain('Todavía no hay un programa de Puntos AloVida activo');
    expect(texto()).toContain('Ver mis pedidos');
    expect(porTestId('puntos-disponibles')).toBeNull();
  });

  it('un fallo real de la API se muestra como error, no como vacío', () => {
    montar({ pid: 'pp-1' }, [
      clienteDoble({ miMembresia: () => throwError(() => new Error('boom')) }),
    ]);

    expect(texto()).not.toContain('Todavía no hay un programa');
    expect(porTestId('puntos-disponibles')).toBeNull();
  });

  describe('con membresía real', () => {
    /** Prepara la pantalla con lo que devolvería el backend. */
    function conDatos(over: Record<string, unknown> = {}): void {
      montar({ pid: 'pp-1' }, [
        clienteDoble({
          miMembresia: () => of(MEMBRESIA),
          misMovimientos: () => of({ movimientos: [movimiento()], nextCursor: null }),
          ...over,
        }),
      ]);
    }

    it('muestra saldo, nivel y acumulado tal como vinieron', () => {
      conDatos();

      expect(porTestId('puntos-disponibles')?.textContent?.trim()).toBe('440');
      expect(porTestId('puntos-nivel')?.textContent).toContain('Frecuente');
      expect(porTestId('puntos-de-por-vida')?.textContent?.trim()).toBe('720');
    });

    it('lista los movimientos reales, con su etiqueta y su signo', () => {
      conDatos();

      const fila = fixture.nativeElement.querySelector('.movimientos__fila');
      expect(fila?.textContent).toContain('Actividad en la app');
      expect(fila?.textContent).toContain('+70');
      expect(texto()).toContain('Sumaste');
    });

    it('«Ver más» sigue por el cursor que emitió el backend', () => {
      const paginas = mockCursor();
      conDatos({ misMovimientos: paginas.fn });

      porTestId('movimientos-ver-mas')?.click();
      fixture.detectChanges();

      expect(paginas.cursores).toEqual([null, 'cursor-opaco']);
      expect(fixture.nativeElement.querySelectorAll('.movimientos__fila')).toHaveLength(2);
    });

    it('no reaparece ninguna demostración', () => {
      conDatos();

      expect(porTestId('puntos-simular-compra')).toBeNull();
      expect(porTestId('puntos-promocion')).toBeNull();
      expect(porTestId('movimiento-multiplicador')).toBeNull();
      expect(texto()).not.toContain('Simular compra');
    });

    it('canjear muestra el comprobante con lo que devolvió la API', () => {
      conDatos({
        canjear: () =>
          of({
            id: 'e-1',
            puntos: '100',
            saldoDespues: '340',
            puntosDePorVida: '720',
            duplicado: false,
          }),
      });

      porTestId('puntos-canjear')?.click();
      fixture.detectChanges();
      escribir('100');
      porTestId('canjear-confirmar')?.click();
      fixture.detectChanges();

      expect(porTestId('canje-comprobante')).not.toBeNull();
      expect(porTestId('canje-saldo')?.textContent).toContain('340');
      expect(porTestId('canje-caja')?.textContent).toContain(
        'Mostrá este código en la caja del supermercado',
      );
    });

    it('el saldo insuficiente del backend se dice con su mensaje, no con uno genérico', () => {
      // El pedido cabe en el saldo que la pantalla conoce, pero el backend —que
      // es el que manda— responde que no alcanza: otro canje llegó antes.
      conDatos({
        canjear: () => throwError(() => new SaldoInsuficienteError('50', '100')),
      });

      porTestId('puntos-canjear')?.click();
      fixture.detectChanges();
      escribir('100');
      porTestId('canjear-confirmar')?.click();
      fixture.detectChanges();

      expect(texto()).toContain('no alcanza para canjear');
      expect(texto()).not.toContain('Probá de nuevo en un momento');
    });

    it('cualquier otro fallo del canje no se disfraza de saldo', () => {
      conDatos({ canjear: () => throwError(() => new Error('boom')) });

      porTestId('puntos-canjear')?.click();
      fixture.detectChanges();
      escribir('10');
      porTestId('canjear-confirmar')?.click();
      fixture.detectChanges();

      expect(texto()).toContain('No pudimos registrar el canje');
    });
  });

  /** Escribe en el campo de puntos, que es un átomo con `type="number"`. */
  function escribir(valor: string): void {
    const campo = porTestId('canjear-puntos') as HTMLInputElement | null;
    if (campo === null) {
      throw new Error('El campo de puntos no está en pantalla.');
    }
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** Doble de `misMovimientos` que recuerda con qué cursor lo llamaron. */
  function mockCursor(): {
    fn: (cursor?: string | null) => Observable<PaginaDeMovimientos>;
    cursores: (string | null)[];
  } {
    const cursores: (string | null)[] = [];
    return {
      cursores,
      fn: (cursor: string | null = null) => {
        cursores.push(cursor);
        return cursor === null
          ? of({ movimientos: [movimiento()], nextCursor: 'cursor-opaco' })
          : of({ movimientos: [movimiento({ id: 'mv-2' })], nextCursor: null });
      },
    };
  }
});
