import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { pharmacyOrderDtoFixture } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.spec-fixtures';
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

describe('PharmacyOrders', () => {
  let fixture: ComponentFixture<PharmacyOrders>;
  let http: HttpTestingController;

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
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

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
    http.expectOne('/pharmacy/orders/me').flush({ items: [], count: 0 });
    fixture.detectChanges();

    expect(texto()).toContain('Todavía no enviaste ningún pedido');
    expect(texto()).toContain('Ir a mi historia clínica');
  });

  it('cada fila dice farmacia, fecha, modalidad y el estado en palabras', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    http.expectOne('/pharmacy/orders/me').flush({ items: [pharmacyOrderDtoFixture()], count: 1 });
    fixture.detectChanges();

    expect(texto()).toContain('Farmacia Andina · Sucursal Centro');
    expect(texto()).toContain('Retiro en la farmacia');
    expect(texto()).toContain('Enviado');
    expect(texto()).toContain('68.00 BOB');
  });

  it('el estado llega mapeado a palabras del sistema, jamás como código ni uuid', () => {
    abrirSesion({ pid: 'pp-1' });
    montar();
    http.expectOne('/pharmacy/orders/me').flush({
      items: [
        pharmacyOrderDtoFixture({
          status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' },
          pickupCode: 'ABC234',
        }),
      ],
      count: 1,
    });
    fixture.detectChanges();

    expect(texto()).toContain('Listo para retirar');
    expect(texto()).not.toContain('LISTO_PARA_RETIRO');
    expect(texto()).not.toMatch(UUID);
  });
});
