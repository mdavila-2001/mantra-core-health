import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Provider } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { routes } from '../../../../app.routes';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import { pharmacyOrderDtoFixture } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.spec-fixtures';
import type { BorradorDePedido } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { seccionRolesGuard } from '../../../../core/navigation/section-roles.guard';
import { NewOrder } from '../new-order/new-order';
import {
  CLAVE_DEL_TRASPASO,
  RUTA_DEL_CHECKOUT,
  type TraspasoDeLaReceta,
} from '../new-order/new-order.handoff';
import { MIS_PEDIDOS_ROUTE } from '../pharmacy-orders.routes';
import { Checkout, traspasoValido } from './checkout';

/**
 * El checkout real (R-T-E3). Lo que se fija:
 *
 * - sin borrador hay salida honesta y ningún pedido;
 * - **no se ofrece nada que el backend no acepte**: ni envío a domicilio, ni
 *   dirección, ni medio de pago (B-REAL-4/5/6);
 * - el resumen sólo muestra precios publicados: sin descuento de red, sin
 *   coaseguro, sin envío y sin puntos (AC-R3-04);
 * - el pedido se crea una sola vez, con `RETIRO` y sin valores de ejemplo en el
 *   cuerpo (AC-R3-01);
 * - la orden médica lleva de verdad hasta acá, con el borrador que arma ella
 *   (FAR-REAL-T-E1, `D-R1-1 = A`: un envase por renglón, sin editor de cantidad).
 */

const BORRADOR: BorradorDePedido = {
  requestId: 'rx-1',
  siteId: 'f0e1d2c3-0000-4000-8000-000000000001',
  pharmacyId: 'a1b2c3d4-0000-4000-8000-000000000001',
  farmacia: 'Farmacia Andina',
  sede: 'Sucursal Centro',
  direccion: 'Calle Libertad 245',
  lineas: [
    {
      productId: 'f0e1d2c3-0000-4000-8000-000000000002',
      medicamento: 'Amoxicilina 500 mg',
      presentacion: 'Caja x 21 cápsulas',
      cantidad: 1,
      precio: '68.00',
      moneda: 'BOB',
      disponible: true,
    },
    {
      productId: 'f0e1d2c3-0000-4000-8000-000000000003',
      medicamento: 'Losartán 50 mg',
      presentacion: 'Caja x 30',
      cantidad: 1,
      precio: '40.00',
      moneda: 'BOB',
      disponible: true,
    },
  ],
  totalEstimado: '108.00',
  moneda: 'BOB',
};

/** El estado que deja la orden médica hoy: la cantidad del borrador y nada más. */
const TRASPASO: TraspasoDeLaReceta = {
  conSeguro: false,
  renglones: [
    { indice: 0, cantidad: 1, alternativa: null, aprobadoPorSeguro: false },
    { indice: 1, cantidad: 1, alternativa: null, aprobadoPorSeguro: false },
  ],
};

describe('Checkout', () => {
  let fixture: ComponentFixture<Checkout>;
  let client: PharmacyOrdersClient;
  let http: HttpTestingController;

  function configurar(extra: Provider[] = []): void {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), ...extra],
    });
    client = TestBed.inject(PharmacyOrdersClient);
    http = TestBed.inject(HttpTestingController);
  }

  function montar(): void {
    fixture = TestBed.createComponent(Checkout);
    fixture.detectChanges();
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(testId: string): string {
    return (uno(testId)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  function uno(testId: string, dentro: ParentNode = raiz()): HTMLElement | null {
    return dentro.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  }

  function todos(testId: string): HTMLElement[] {
    return Array.from(raiz().querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  }

  function clic(elemento: HTMLElement | null | undefined): void {
    elemento?.click();
    fixture.detectChanges();
  }

  function pasos(): string[] {
    return Array.from(
      raiz().querySelectorAll<HTMLElement>('[data-testid="checkout-stepper"] .stepper__label'),
    ).map((paso) => paso.textContent?.trim() ?? '');
  }

  function tituloDelPaso(): string {
    return raiz().querySelector('#checkout-paso-titulo')?.textContent?.trim() ?? '';
  }

  function conTraspaso(traspaso: unknown): void {
    window.history.replaceState({ [CLAVE_DEL_TRASPASO]: traspaso }, '');
  }

  afterEach(() => {
    window.history.replaceState(null, '');
  });

  /* ── Entrada y salida honesta ──────────────────────────────────────────── */

  describe('entrada', () => {
    it('sin borrador sale honesto hacia la historia y no crea ningún pedido', () => {
      configurar();
      montar();

      expect(uno('checkout')).toBeNull();
      expect(raiz().textContent).toContain('Ir a mi historia clínica');
      http.expectNone('/pharmacy/orders');
    });

    it('con un borrador vacío ofrece volver a mis pedidos', () => {
      configurar();
      client.prepararBorrador({ ...BORRADOR, lineas: [] });
      montar();

      expect(uno('checkout')).toBeNull();
      expect(raiz().textContent).toContain('Este pedido no tiene medicamentos para confirmar.');
    });

    it('un traspaso con forma ajena se ignora entero', () => {
      expect(traspasoValido({ conSeguro: 'sí', renglones: [] }, BORRADOR)).toBeNull();
      expect(
        traspasoValido({ conSeguro: false, renglones: [{ indice: 9, cantidad: 1 }] }, BORRADOR),
      ).toBeNull();
      expect(
        traspasoValido({ conSeguro: false, renglones: [{ indice: 0, cantidad: 0 }] }, BORRADOR),
      ).toBeNull();
      expect(traspasoValido(TRASPASO, null)).toBeNull();
      expect(traspasoValido(TRASPASO, BORRADOR)).toBe(TRASPASO);
    });

    it('salir sin confirmar descarta el borrador; volver a la orden lo conserva', async () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();
      fixture.destroy();
      expect(client.borradorPreparado()).toBeNull();

      client.prepararBorrador(BORRADOR);
      montar();
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      clic(uno('checkout-volver-a-la-orden'));
      await fixture.whenStable();
      fixture.destroy();
      expect(client.borradorPreparado()).toBe(BORRADOR);
    });
  });

  /* ── Nada que el backend no acepte (AC-R3-06) ──────────────────────────── */

  describe('no ofrece lo que el backend no tiene', () => {
    it('sólo hay dos pasos: entrega y resumen', () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();

      expect(pasos()).toEqual(['Entrega', 'Resumen']);
      expect(tituloDelPaso()).toBe('Cómo lo recibís');
      clic(uno('checkout-siguiente'));
      expect(tituloDelPaso()).toBe('Revisá y confirmá');
      clic(uno('checkout-anterior'));
      expect(tituloDelPaso()).toBe('Cómo lo recibís');
    });

    it('la entrega es retiro y el envío se dice no disponible, sin ofrecerlo', () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();

      expect(texto('checkout-entrega')).toBe('Retiro en la farmacia');
      expect(raiz().textContent).toContain('Farmacia Andina · Sucursal Centro');
      expect(texto('checkout-envio-no-disponible')).toContain('todavía no está disponible');
      // Ni radios de modalidad ni paso de dirección.
      expect(raiz().querySelectorAll('input[type="radio"]')).toHaveLength(0);
      expect(raiz().textContent).not.toMatch(/Delivery|Agregar otra/i);
    });

    it('no hay medio de pago ni QR ni tarjeta en ningún paso', () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();
      clic(uno('checkout-siguiente'));

      expect(raiz().querySelector('canvas')).toBeNull();
      expect(raiz().querySelectorAll('input')).toHaveLength(0);
      expect(raiz().textContent).not.toMatch(/QR|tarjeta|DEMO|maqueta/i);
      expect(texto('checkout-pago-nota')).toContain('Acá no se cobra nada');
    });
  });

  /* ── El resumen sólo con datos publicados (AC-R3-04) ───────────────────── */

  describe('resumen', () => {
    it('muestra renglones y total, sin descuento, coaseguro, envío ni puntos', () => {
      configurar();
      conTraspaso(TRASPASO);
      client.prepararBorrador(BORRADOR);
      montar();
      clic(uno('checkout-siguiente'));

      const resumen = texto('resumen');
      expect(todos('resumen-renglon')).toHaveLength(2);
      expect(resumen).toContain('1 × Amoxicilina 500 mg');
      expect(resumen).toContain('1 × Losartán 50 mg');
      expect(texto('resumen-total')).toContain('108.00 BOB');
      expect(resumen).not.toMatch(/descuento|coaseguro|env[ií]o|puntos|alovida/i);
      expect(resumen).not.toMatch(/%|aprobado por el seguro/i);
    });

    it('sin precio publicado no inventa el total', () => {
      configurar();
      client.prepararBorrador({
        ...BORRADOR,
        lineas: [{ ...BORRADOR.lineas[0]!, precio: null }, BORRADOR.lineas[1]!],
      });
      montar();
      clic(uno('checkout-siguiente'));

      expect(texto('resumen-total')).toContain('No disponible');
    });
  });

  /* ── La confirmación final (AC-R3-01) ──────────────────────────────────── */

  describe('confirmación final', () => {
    function irAlResumen(): void {
      clic(uno('checkout-siguiente'));
    }

    it('crea el pedido una sola vez, con RETIRO y sin valores de ejemplo, y navega al detalle', async () => {
      configurar();
      conTraspaso(TRASPASO);
      client.prepararBorrador(BORRADOR);
      montar();
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      irAlResumen();

      const confirmar = uno('checkout-confirmar');
      clic(confirmar);
      clic(confirmar);

      const request = http.expectOne('/pharmacy/orders');
      expect(request.request.method).toBe('POST');
      expect(request.request.body.deliveryMode).toBe('RETIRO');
      expect(request.request.body.lines).toEqual([
        { productId: 'f0e1d2c3-0000-4000-8000-000000000002', quantity: 1 },
        { productId: 'f0e1d2c3-0000-4000-8000-000000000003', quantity: 1 },
      ]);
      // Ni dirección ni pago ni nada de ejemplo viaja en el cuerpo.
      expect(Object.keys(request.request.body).sort()).toEqual([
        'deliveryMode',
        'idempotencyKey',
        'lines',
        'medicationRequestId',
        'siteId',
      ]);
      request.flush(pharmacyOrderDtoFixture());
      await fixture.whenStable();

      expect(navegar).toHaveBeenCalledWith([MIS_PEDIDOS_ROUTE, pharmacyOrderDtoFixture().id]);
      expect(client.borradorPreparado()).toBeNull();
    });

    /**
     * El handoff sigue declarando `cantidad` (`lines[].quantity`) aunque hoy la
     * orden médica mande siempre la del borrador (un envase por renglón). Esto
     * fija el contrato del checkout, no un editor de cantidad en E.
     */
    it('respeta la cantidad que declare el traspaso', () => {
      configurar();
      conTraspaso({
        conSeguro: false,
        renglones: [
          { indice: 0, cantidad: 3, alternativa: null, aprobadoPorSeguro: false },
          { indice: 1, cantidad: 1, alternativa: null, aprobadoPorSeguro: false },
        ],
      });
      client.prepararBorrador(BORRADOR);
      montar();
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      irAlResumen();
      clic(uno('checkout-confirmar'));

      const request = http.expectOne('/pharmacy/orders');
      expect(request.request.body.lines[0].quantity).toBe(3);
      request.flush(pharmacyOrderDtoFixture());
    });

    it('si la creación falla, avisa y el reintento reutiliza la misma clave: no duplica', () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      irAlResumen();

      clic(uno('checkout-confirmar'));
      const primero = http.expectOne('/pharmacy/orders');
      primero.flush({ message: 'caída' }, { status: 503, statusText: 'Service Unavailable' });
      fixture.detectChanges();

      expect(uno('checkout-error-al-confirmar')).not.toBeNull();
      expect(texto('checkout-confirmar')).toBe('Reintentar');

      clic(uno('checkout-confirmar'));
      const segundo = http.expectOne('/pharmacy/orders');
      expect(segundo.request.body.idempotencyKey).toBe(primero.request.body.idempotencyKey);
      segundo.flush(pharmacyOrderDtoFixture());
    });

    it('un renglón sin producto publicado bloquea la confirmación', () => {
      configurar();
      client.prepararBorrador({
        ...BORRADOR,
        lineas: [{ ...BORRADOR.lineas[0]!, productId: null }],
      });
      montar();
      irAlResumen();

      clic(uno('checkout-confirmar'));

      expect(uno('checkout-confirmar')?.getAttribute('aria-disabled')).toBe('true');
      http.expectNone('/pharmacy/orders');
    });
  });

  /* ── La ruta y el traspaso desde la orden médica ───────────────────────── */

  describe('ruta', () => {
    // Las pantallas hijas cuelgan del armazón: el que tiene el detalle del pedido.
    const hijas =
      routes.find((r) =>
        (r.children ?? []).some((h) => h.path === 'my-account/pharmacy-orders/:orderId'),
      )?.children ?? [];

    it('va sin :orderId, con el guard de la sección y antes del paramétrico', () => {
      const indice = hijas.findIndex((r) => r.path === 'my-account/pharmacy-orders/checkout');
      const parametrico = hijas.findIndex((r) => r.path === 'my-account/pharmacy-orders/:orderId');

      expect(indice).toBeGreaterThan(-1);
      expect(indice).toBeLessThan(parametrico);
      expect(hijas[indice]?.canActivate).toContain(seccionRolesGuard);
    });

    it('la orden médica apunta a esa misma ruta', () => {
      configurar();
      expect(TestBed.inject(RUTA_DEL_CHECKOUT)).toBe('/my-account/pharmacy-orders/checkout');
    });

    it('orden médica → checkout: llega con el borrador, sin crear el pedido', async () => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([
            { path: 'my-account/pharmacy-orders/new', component: NewOrder },
            { path: 'my-account/pharmacy-orders/checkout', component: Checkout },
          ]),
        ],
      });
      client = TestBed.inject(PharmacyOrdersClient);
      http = TestBed.inject(HttpTestingController);
      client.prepararBorrador(BORRADOR);

      const harness = await RouterTestingHarness.create('/my-account/pharmacy-orders/new');
      const pantalla = harness.fixture.nativeElement as HTMLElement;
      pantalla.querySelector<HTMLElement>('[data-testid="pedido-continuar"]')?.click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(TestBed.inject(Location).path()).toBe('/my-account/pharmacy-orders/checkout');
      expect(pantalla.querySelector('[data-testid="checkout"]')).not.toBeNull();
      http.expectNone('/pharmacy/orders');

      // El traspaso llegó: la cantidad del borrador se ve en el resumen. Ya no
      // se elige cantidad en E (FAR-REAL-T-E1, D-R1-1 = A): el borrador trae un
      // envase por renglón y así viaja.
      pantalla.querySelector<HTMLElement>('[data-testid="checkout-siguiente"]')?.click();
      harness.detectChanges();
      expect(pantalla.querySelector('[data-testid="resumen"]')?.textContent).toContain(
        '1 × Amoxicilina 500 mg',
      );
    });
  });
});
