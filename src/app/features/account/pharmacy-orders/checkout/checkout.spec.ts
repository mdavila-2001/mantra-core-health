import { Location } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Provider } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NEVER, of, throwError } from 'rxjs';

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
import { DIRECCIONES_REGISTRADAS } from './checkout.fixtures';

/**
 * El checkout (T-E3 · pantalla G). Lo que se fija:
 *
 * - sin borrador hay salida honesta y ningún pedido;
 * - los pasos: recojo recorre tres, delivery cuatro, y no se saltea ninguno;
 * - el resumen dice sus líneas, con y sin seguro;
 * - **el pedido se crea una sola vez, en la confirmación final**, con el
 *   borrador vivo y las cantidades del traspaso, nunca con las alternativas;
 * - delivery se recorre pero no se confirma (no se disfraza de retiro);
 * - la orden médica (E) lleva de verdad hasta acá.
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

const TRASPASO_CON_SEGURO: TraspasoDeLaReceta = {
  conSeguro: true,
  renglones: [
    { indice: 0, cantidad: 2, alternativa: null, aprobadoPorSeguro: true },
    {
      indice: 1,
      cantidad: 1,
      alternativa: {
        id: 'ejemplo-1-0',
        nombre: 'Losartán · Genérico',
        presentacion: 'Caja x 30',
        precio: '34.00',
        ahorro: '6.00',
      },
      aprobadoPorSeguro: false,
    },
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

  function elegirRadio(grupo: string, posicion: number): void {
    clic(uno(grupo)?.querySelectorAll<HTMLInputElement>('input[type="radio"]')[posicion]);
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

  /* ── Entrada: borrador, traspaso y salida honesta (AC-T-E3-09) ─────────── */

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

    it('sin traspaso funciona con el borrador tal cual', () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();

      expect(uno('checkout')).not.toBeNull();
      expect(raiz().textContent).toContain('Farmacia Andina · Sucursal Centro');
    });

    it('un traspaso con forma ajena se ignora entero', () => {
      expect(traspasoValido({ conSeguro: 'sí', renglones: [] }, BORRADOR)).toBeNull();
      expect(
        traspasoValido(
          { conSeguro: false, renglones: [{ indice: 9, cantidad: 1, aprobadoPorSeguro: false }] },
          BORRADOR,
        ),
      ).toBeNull();
      expect(
        traspasoValido(
          { conSeguro: false, renglones: [{ indice: 0, cantidad: 0, aprobadoPorSeguro: false }] },
          BORRADOR,
        ),
      ).toBeNull();
      expect(
        traspasoValido(
          {
            conSeguro: false,
            renglones: [
              { indice: 0, cantidad: 1, aprobadoPorSeguro: false, alternativa: { nombre: 'X', precio: 12 } },
            ],
          },
          BORRADOR,
        ),
      ).toBeNull();
      expect(traspasoValido(TRASPASO_CON_SEGURO, null)).toBeNull();
      expect(traspasoValido(TRASPASO_CON_SEGURO, BORRADOR)).toBe(TRASPASO_CON_SEGURO);
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

  /* ── Estados (AC-T-E3-07, AC-COMUN-01) ─────────────────────────────────── */

  describe('estados', () => {
    it('mientras cargan las direcciones muestra el esqueleto', () => {
      configurar([{ provide: DIRECCIONES_REGISTRADAS, useValue: () => NEVER }]);
      client.prepararBorrador(BORRADOR);
      montar();

      expect(uno('checkout-cargando')).not.toBeNull();
      expect(uno('checkout')).toBeNull();
    });

    it('si la carga falla, ofrece reintentar y se recupera', () => {
      let fallar = true;
      configurar([
        {
          provide: DIRECCIONES_REGISTRADAS,
          useValue: () => (fallar ? throwError(() => new Error('caída')) : of([])),
        },
      ]);
      client.prepararBorrador(BORRADOR);
      montar();
      expect(uno('checkout')).toBeNull();

      fallar = false;
      const reintentar = Array.from(raiz().querySelectorAll<HTMLElement>('button')).find((b) =>
        /reintentar/i.test(b.textContent ?? ''),
      );
      expect(reintentar).toBeDefined();
      clic(reintentar);

      expect(uno('checkout')).not.toBeNull();
    });

    it('con delivery y sin direcciones dice «sin dirección registrada» y no deja seguir', () => {
      configurar([{ provide: DIRECCIONES_REGISTRADAS, useValue: () => of([]) }]);
      client.prepararBorrador(BORRADOR);
      montar();

      elegirRadio('checkout-entrega', 1);
      clic(uno('checkout-siguiente'));

      expect(uno('checkout-sin-direccion')).not.toBeNull();
      expect(uno('checkout-siguiente')?.getAttribute('aria-disabled')).toBe('true');
    });
  });

  /* ── Los pasos (AC-T-E3-01…04, AC-T-E3-08) ─────────────────────────────── */

  describe('pasos', () => {
    it('con recojo son tres pasos y se avanza y retrocede en orden', () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();

      expect(pasos()).toEqual(['Entrega', 'Medio de pago', 'Resumen']);
      expect(tituloDelPaso()).toBe('Cómo lo recibís');

      clic(uno('checkout-siguiente'));
      expect(tituloDelPaso()).toBe('Medio de pago');
      clic(uno('checkout-siguiente'));
      expect(tituloDelPaso()).toBe('Revisá y confirmá');
      clic(uno('checkout-anterior'));
      expect(tituloDelPaso()).toBe('Medio de pago');
    });

    it('al cambiar de paso el foco va al título del paso nuevo, no al body', async () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();

      clic(uno('checkout-siguiente'));
      await fixture.whenStable();

      const titulo = raiz().querySelector('#checkout-paso-titulo');
      expect(titulo?.textContent?.trim()).toBe('Medio de pago');
      expect(document.activeElement).toBe(titulo);
    });

    it('con delivery aparece el paso de dirección y exige elegir una', () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();

      elegirRadio('checkout-entrega', 1);
      expect(pasos()).toEqual(['Entrega', 'Dirección', 'Medio de pago', 'Resumen']);
      expect(uno('checkout-entrega-delivery')?.textContent).toContain('Sucursal Centro');

      clic(uno('checkout-siguiente'));
      expect(tituloDelPaso()).toBe('Dirección de entrega');
      expect(todos('checkout-direccion')).toHaveLength(2);
      expect(uno('checkout-siguiente')?.getAttribute('aria-disabled')).toBe('true');
      expect(uno('checkout-agregar-direccion')?.getAttribute('aria-disabled')).toBe('true');

      clic(todos('checkout-usar-direccion')[1]);
      expect(uno('checkout-direccion-elegida')).not.toBeNull();
      clic(uno('checkout-siguiente'));
      expect(tituloDelPaso()).toBe('Medio de pago');
    });

    it('el stepper deja volver a un paso hecho pero no saltar hacia adelante', () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();

      clic(uno('stepper-paso-2'));
      expect(tituloDelPaso()).toBe('Cómo lo recibís');

      clic(uno('checkout-siguiente'));
      clic(uno('checkout-siguiente'));
      clic(uno('stepper-paso-0'));
      expect(tituloDelPaso()).toBe('Cómo lo recibís');
    });

    it('el medio de pago ofrece QR de demostración y tarjeta como maqueta deshabilitada', () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();
      clic(uno('checkout-siguiente'));

      expect(uno('checkout-pago-qr')).not.toBeNull();
      expect(texto('checkout-pago-chip-demo')).toContain('DEMO');

      elegirRadio('checkout-medio-de-pago', 1);
      const tarjeta = uno('checkout-pago-tarjeta');
      expect(tarjeta).not.toBeNull();
      const campos = Array.from(tarjeta!.querySelectorAll<HTMLInputElement>('input'));
      expect(campos.length).toBeGreaterThan(0);
      expect(campos.every((campo) => campo.disabled)).toBe(true);
      expect(texto('checkout-pago-nota')).toContain('no se procesa ningún pago');
    });
  });

  /* ── El resumen (AC-T-E3-05) ───────────────────────────────────────────── */

  describe('resumen', () => {
    function irAlResumen(): void {
      clic(uno('checkout-siguiente'));
      clic(uno('checkout-siguiente'));
    }

    it('sin seguro: subtotal, descuento de red, total y puntos; sin coaseguro ni envío', () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();
      irAlResumen();

      expect(texto('resumen-subtotal')).toContain('108.00 BOB');
      expect(texto('resumen-descuento')).toContain('Descuento red AloVida');
      expect(texto('resumen-descuento')).toContain('−10.80 BOB');
      expect(uno('resumen-coaseguro')).toBeNull();
      expect(uno('resumen-envio')).toBeNull();
      expect(texto('resumen-total')).toContain('97.20 BOB');
      expect(texto('resumen-puntos')).toContain('9');
      expect(texto('resumen-puntos')).toContain('valor de ejemplo');
    });

    it('con delivery suma la línea de envío', () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();
      elegirRadio('checkout-entrega', 1);
      clic(uno('checkout-siguiente'));
      clic(todos('checkout-usar-direccion')[0]);
      irAlResumen();

      expect(texto('resumen-envio')).toContain('15.00 BOB');
      expect(texto('resumen-total')).toContain('112.20 BOB');
    });

    it('con seguro: dos bloques diferenciados, coaseguro y un solo total', () => {
      configurar();
      conTraspaso(TRASPASO_CON_SEGURO);
      client.prepararBorrador(BORRADOR);
      montar();
      irAlResumen();

      expect(texto('resumen-bloque-aprobados')).toContain('2 × Amoxicilina 500 mg');
      expect(texto('resumen-bloque-no-aprobados')).toContain('1 × Losartán · Genérico');
      expect(texto('resumen-coaseguro')).toContain('Coaseguro');
      expect(todos('resumen-total')).toHaveLength(1);
      // Aprobados 136.00 → coaseguro 27.20; no aprobados 34.00 → descuento 3.40.
      expect(texto('resumen-coaseguro')).toContain('27.20 BOB');
      expect(texto('resumen-total')).toContain('57.80 BOB');
      expect(uno('checkout-nota-alternativas')).not.toBeNull();
    });
  });

  /* ── La confirmación final (AC-T-E3-06, AC-T-E3-07, AC-T-E3-08) ────────── */

  describe('confirmación final', () => {
    function irAlResumen(): void {
      clic(uno('checkout-siguiente'));
      clic(uno('checkout-siguiente'));
    }

    it('antes de confirmar no se llama a la API en ningún paso', () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();
      elegirRadio('checkout-entrega', 1);
      clic(uno('checkout-siguiente'));
      clic(todos('checkout-usar-direccion')[0]);
      clic(uno('checkout-siguiente'));
      elegirRadio('checkout-medio-de-pago', 1);
      clic(uno('checkout-siguiente'));

      http.expectNone('/pharmacy/orders');
    });

    it('con recojo crea el pedido una sola vez con el borrador vivo y navega a su detalle', async () => {
      configurar();
      conTraspaso(TRASPASO_CON_SEGURO);
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
      // Las cantidades del traspaso sí; la alternativa de demostración no.
      expect(request.request.body.lines).toEqual([
        { productId: 'f0e1d2c3-0000-4000-8000-000000000002', quantity: 2 },
        { productId: 'f0e1d2c3-0000-4000-8000-000000000003', quantity: 1 },
      ]);
      expect(JSON.stringify(request.request.body)).not.toMatch(/ejemplo/);
      request.flush(pharmacyOrderDtoFixture());
      await fixture.whenStable();

      expect(navegar).toHaveBeenCalledWith([MIS_PEDIDOS_ROUTE, pharmacyOrderDtoFixture().id]);
      expect(client.borradorPreparado()).toBeNull();
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

    it('con delivery la confirmación no se ejecuta y lo explica', () => {
      configurar();
      client.prepararBorrador(BORRADOR);
      montar();
      elegirRadio('checkout-entrega', 1);
      clic(uno('checkout-siguiente'));
      clic(todos('checkout-usar-direccion')[0]);
      irAlResumen();

      expect(uno('checkout-delivery-no-disponible')).not.toBeNull();
      const confirmar = uno('checkout-confirmar');
      expect(confirmar?.getAttribute('aria-disabled')).toBe('true');
      clic(confirmar);

      http.expectNone('/pharmacy/orders');
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

  /* ── La ruta y el traspaso desde E (AC-T-E3-01, AC-T-E3-09) ────────────── */

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

    it('E → checkout: «Continuar» llega con el borrador y el traspaso, sin crear el pedido', async () => {
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
      const renglones = pantalla.querySelectorAll<HTMLElement>('[data-testid="pedido-linea"]');
      renglones[0]?.querySelector<HTMLElement>('[data-testid="pedido-cantidad-mas"]')?.click();
      harness.detectChanges();
      pantalla.querySelector<HTMLElement>('[data-testid="pedido-continuar"]')?.click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(TestBed.inject(Location).path()).toBe('/my-account/pharmacy-orders/checkout');
      expect(pantalla.querySelector('[data-testid="checkout"]')).not.toBeNull();
      http.expectNone('/pharmacy/orders');

      // El traspaso llegó: la cantidad elegida en E se ve en el resumen.
      const siguiente = () =>
        pantalla.querySelector<HTMLElement>('[data-testid="checkout-siguiente"]')?.click();
      siguiente();
      harness.detectChanges();
      siguiente();
      harness.detectChanges();
      expect(pantalla.querySelector('[data-testid="resumen"]')?.textContent).toContain(
        '2 × Amoxicilina 500 mg',
      );
    });
  });
});
