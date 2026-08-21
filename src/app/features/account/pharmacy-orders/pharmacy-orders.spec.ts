import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { PharmacyOrdersClient } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type { BorradorDePedido } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { PharmacyOrders } from './pharmacy-orders';

/**
 * «Mis pedidos» (FAR-I2). Lo que se fija: la pantalla se guarda por perfil de
 * paciente, el vacío ofrece su salida hacia la historia, y cada fila dice el
 * estado **en palabras** — ni un código ni un uuid a la vista.
 */

/** base64url **sobre UTF-8**, como el token real. */
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

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const BORRADOR: BorradorDePedido = {
  requestId: 'rx-1',
  siteId: 'f0e1d2c3-0000-4000-8000-000000000001',
  farmacia: 'Farmacia Andina',
  sede: 'Sucursal Centro',
  direccion: 'Calle Libertad 245',
  lineas: [
    {
      productId: 'f0e1d2c3-0000-4000-8000-000000000002',
      medicamento: 'Amoxicilina',
      presentacion: '500 mg · Caja x 21 cápsulas',
      cantidad: 1,
      precio: '68.00',
      moneda: 'BOB',
      disponible: true,
    },
  ],
  totalEstimado: '68.00',
  moneda: 'BOB',
};

describe('PharmacyOrders', () => {
  let fixture: ComponentFixture<PharmacyOrders>;
  let client: PharmacyOrdersClient;

  function abrirSesion(claims: Record<string, unknown>): void {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], ...claims }),
      refreshToken: 'r-1',
    });
  }

  function montar(): void {
    fixture = TestBed.createComponent(PharmacyOrders);
    fixture.detectChanges();
  }

  function texto(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    client = TestBed.inject(PharmacyOrdersClient);
  });

  it('sin perfil de paciente lo dice, sin cargar nada', () => {
    abrirSesion({});
    montar();

    expect(texto()).toContain('Esta sección es para pacientes');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="pedidos-lista"]'),
    ).toBeNull();
  });

  it('sin pedidos ofrece la salida hacia la historia clínica', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();

    expect(texto()).toContain('Todavía no enviaste ningún pedido');
    expect(texto()).toContain('Ir a mi historia clínica');
  });

  it('cada fila dice farmacia, fecha, modalidad y el estado en palabras', async () => {
    abrirSesion({ pid: 'pp-1' });
    await firstValueFrom(
      client.enviar({ borrador: BORRADOR, modalidad: 'RETIRO', direccionDeEntrega: null }),
    );
    montar();

    expect(texto()).toContain('Farmacia Andina · Sucursal Centro');
    expect(texto()).toContain('Retiro en la farmacia');
    expect(texto()).toContain('Enviado');
    expect(texto()).toContain('68.00 BOB');
  });

  it('el estado avanza en palabras del sistema, jamás en códigos ni uuid', async () => {
    abrirSesion({ pid: 'pp-1' });
    const pedido = await firstValueFrom(
      client.enviar({ borrador: BORRADOR, modalidad: 'RETIRO', direccionDeEntrega: null }),
    );
    await firstValueFrom(client.simular(pedido.id, 'CONFIRMAR'));
    await firstValueFrom(client.simular(pedido.id, 'MARCAR_LISTO'));
    montar();

    expect(texto()).toContain('Listo para retirar');
    expect(texto()).not.toContain('LISTO_PARA_RETIRO');
    expect(texto()).not.toMatch(UUID);
  });
});
