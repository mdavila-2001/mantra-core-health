import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import {
  pharmacyOrderDtoFixture,
  PHARMACY_ORDER_TEST_IDS,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.spec-fixtures';
import { RecentOrders } from './recent-orders';

/** base64url sobre UTF-8, como el token real (mismo helper que `where-to-buy.spec`). */
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

/**
 * Un pedido del contrato, sobre el fixture que ya usan el cliente y «Mis
 * pedidos»: si el DTO de FAR-E2 cambia, esto es lo primero que deja de
 * compilar, que es justamente para lo que existe ese archivo.
 */
function pedidoDto(id: string, creadoEl: string) {
  return pharmacyOrderDtoFixture({
    id: `${PHARMACY_ORDER_TEST_IDS.order.slice(0, -1)}${id}`,
    createdAt: creadoEl,
  });
}

describe('RecentOrders', () => {
  let fixture: ComponentFixture<RecentOrders>;
  let http: HttpTestingController;

  function configurar(): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  }

  function entrarComoPaciente(): void {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], pid: 'pp-1' }),
      refreshToken: 'r-1',
    });
  }

  function montar(): void {
    fixture = TestBed.createComponent(RecentOrders);
    fixture.detectChanges();
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  it('muestra como mucho tres pedidos, del más reciente al más viejo', () => {
    configurar();
    entrarComoPaciente();
    montar();

    http.expectOne((r) => r.url === '/pharmacy/orders/me').flush({
      items: [
        pedidoDto('1', '2026-09-01T10:00:00.000Z'),
        pedidoDto('2', '2026-09-05T10:00:00.000Z'),
        pedidoDto('3', '2026-09-03T10:00:00.000Z'),
        pedidoDto('4', '2026-09-10T10:00:00.000Z'),
      ],
    });
    fixture.detectChanges();

    const filas = raiz().querySelectorAll('.pedido');
    expect(filas).toHaveLength(3);
    // El más reciente arriba: o-4 (10/09), o-2 (05/09), o-3 (03/09).
    expect(raiz().textContent).not.toContain('1 sept');
  });

  it('dice el estado en palabras, nunca el código del contrato', () => {
    configurar();
    entrarComoPaciente();
    montar();

    http
      .expectOne((r) => r.url === '/pharmacy/orders/me')
      .flush({ items: [pedidoDto('1', '2026-09-01T10:00:00.000Z')] });
    fixture.detectChanges();

    const texto = raiz().textContent ?? '';
    expect(texto).toContain('Enviado');
    // El código del contrato jamás llega a la pantalla.
    expect(texto).not.toContain('PINV_ORDER_ENVIADO');
  });

  it('sin pedidos, una línea que orienta y lleva a la tienda', () => {
    configurar();
    entrarComoPaciente();
    montar();

    http.expectOne((r) => r.url === '/pharmacy/orders/me').flush({ items: [] });
    fixture.detectChanges();

    expect(raiz().textContent).toContain('Todavía no pediste nada');
    const enlace = raiz().querySelector<HTMLAnchorElement>('.pedidos__vacio a');
    expect(enlace?.getAttribute('href')).toBe('/my-account/pharmacy');
  });

  it('sin perfil de paciente no consulta nada y lo dice', () => {
    configurar();
    montar();

    http.expectNone(() => true);
    expect(raiz().textContent).toContain('cuenta de paciente');
  });

  it('un error de la lectura queda como error recuperable, no como ausencia', () => {
    configurar();
    entrarComoPaciente();
    montar();

    http
      .expectOne((r) => r.url === '/pharmacy/orders/me')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(raiz().textContent).not.toContain('Todavía no pediste nada');
    expect(raiz().querySelector('.pedidos__lista')).toBeNull();
  });
});
