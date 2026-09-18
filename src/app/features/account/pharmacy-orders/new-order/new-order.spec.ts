import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Provider } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { PharmacyCampaignsClient } from '../../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.client';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import { pharmacyOrderDtoFixture } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.spec-fixtures';
import type { BorradorDePedido } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { NewOrder } from './new-order';
import {
  CLAVE_DEL_TRASPASO,
  RUTA_DEL_CHECKOUT,
  type TraspasoDeLaReceta,
} from './new-order.handoff';

/**
 * «Confirmá tu pedido» (FAR-I2) extendida como la orden médica como pedido
 * (T-E1). Lo que se fija: sin borrador hay salida y no error; el resumen dice
 * claro lo que la farmacia no tiene; retiro es la única modalidad habilitada;
 * y una línea sin `productId` se conserva y bloquea el paso siguiente.
 *
 * T-E1 suma: cabecera de receta, cantidad dentro de lo recetado, alternativas
 * que reemplazan el renglón, la variante con seguro, los estados de la
 * pantalla y «Continuar». **Desde esta pantalla no se crea ningún pedido**
 * (D-FARMOCK-T-E1-01): el pedido real se crea en la confirmación final del
 * checkout, con `PharmacyOrdersClient.enviar()`, que sigue intacto.
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
      medicamento: 'Amoxicilina',
      presentacion: '500 mg · Caja x 21 cápsulas',
      cantidad: 1,
      precio: '68.00',
      moneda: 'BOB',
      disponible: true,
    },
    {
      productId: null,
      medicamento: 'Paracetamol',
      presentacion: null,
      cantidad: 1,
      precio: null,
      moneda: null,
      disponible: false,
    },
  ],
  totalEstimado: '68.00',
  moneda: 'BOB',
};

/** Dos renglones publicables: el primero aprobado por el seguro, el segundo no. */
const BORRADOR_COMPLETO: BorradorDePedido = {
  ...BORRADOR,
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
};

const RUTA_DE_PRUEBA = '/checkout-de-prueba';

describe('NewOrder', () => {
  let fixture: ComponentFixture<NewOrder>;
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
    fixture = TestBed.createComponent(NewOrder);
    fixture.detectChanges();
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(): string {
    return raiz().textContent ?? '';
  }

  function todos(testId: string, dentro: ParentNode = raiz()): HTMLElement[] {
    return Array.from(dentro.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  }

  function uno(testId: string, dentro: ParentNode = raiz()): HTMLElement | null {
    return dentro.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  }

  function clic(elemento: HTMLElement | null | undefined): void {
    elemento?.click();
    fixture.detectChanges();
  }

  function renglon(indice: number): HTMLElement {
    const encontrado = todos('pedido-linea')[indice];
    if (encontrado === undefined) {
      throw new Error(`No hay renglón ${indice}`);
    }
    return encontrado;
  }

  /**
   * Toca cada botón de la pantalla. Los enlaces quedan afuera: navegan y no
   * pueden crear nada.
   */
  async function tocarTodo(): Promise<number> {
    let tocados = 0;
    for (let i = 0; i < 80; i += 1) {
      const botones = Array.from(
        raiz().querySelectorAll<HTMLButtonElement>('[data-testid="pedido-confirmacion"] button'),
      );
      const boton = botones[i];
      if (boton === undefined) {
        break;
      }
      clic(boton);
      await fixture.whenStable();
      tocados += 1;
    }
    return tocados;
  }

  it('sin borrador ofrece la salida hacia la historia, no un error', () => {
    configurar();
    montar();

    // El copy fijo de S6 más la salida: quien entra por URL directa no queda preso.
    expect(texto()).toContain('No encontramos lo que buscás');
    expect(texto()).toContain('Ir a mi historia clínica');
    expect(uno('pedido-confirmacion')).toBeNull();
  });

  it('el resumen marca claro lo que la farmacia no tiene y que todavía no se envía nada', () => {
    configurar();
    client.prepararBorrador(BORRADOR);
    montar();

    expect(texto()).toContain('Farmacia Andina · Sucursal Centro');
    expect(texto()).toContain('Amoxicilina');
    expect(texto()).toContain('500 mg · Caja x 21 cápsulas');
    expect(texto()).toContain('68.00 BOB');
    expect(texto()).toContain('La farmacia no la tiene');
    expect(texto()).toContain('Sin precio publicado');
    expect(uno('pedido-nota-sin-envio')?.textContent).toContain(
      'Todavía no se envía nada a la farmacia',
    );
  });

  it('el retiro es el default y los envíos fuera de alcance quedan deshabilitados', () => {
    configurar();
    client.prepararBorrador(BORRADOR);
    montar();

    const radios = raiz().querySelectorAll<HTMLInputElement>(
      '[data-testid="pedido-modalidad"] input[type="radio"]',
    );
    expect(radios).toHaveLength(3);
    expect(radios[0].checked).toBe(true);
    expect(radios[1].disabled).toBe(true);
    expect(radios[2].disabled).toBe(true);
    expect(texto()).toContain('todavía no están disponibles');
  });

  it('salir sin continuar descarta el borrador: no reaparece después por URL directa', () => {
    configurar();
    client.prepararBorrador(BORRADOR);
    montar();

    fixture.destroy();

    expect(client.borradorPreparado()).toBeNull();
  });

  it('bloquea de forma visible las líneas sin productId y no llama a la API', () => {
    configurar([{ provide: RUTA_DEL_CHECKOUT, useValue: RUTA_DE_PRUEBA }]);
    client.prepararBorrador(BORRADOR);
    montar();

    // Aun con checkout disponible, un pedido que no se podría crear no avanza.
    expect(uno('pedido-continuar')?.getAttribute('aria-disabled')).toBe('true');
    expect(texto()).toContain('No hay un producto publicado para: Paracetamol');
    expect(texto()).toContain('no se quitará ningún medicamento');
    http.expectNone('/pharmacy/orders');
  });

  /* ── Desde E no se crea ningún pedido (D-FARMOCK-T-E1-01) ──────────────── */

  describe('ninguna acción de la pantalla crea el pedido', () => {
    it('no existe el envío directo: sin «Enviar pedido» y sin ruta, tocar todo no hace POST', async () => {
      // La ruta va explícita en `null`: el token la trae real desde que T-E3 la
      // publicó, y esta prueba es la del caso «sin checkout todavía».
      configurar([{ provide: RUTA_DEL_CHECKOUT, useValue: null }]);
      client.prepararBorrador(BORRADOR_COMPLETO);
      montar();
      const enviar = vi.spyOn(client, 'enviar');
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate');

      expect(uno('pedido-enviar')).toBeNull();
      expect(texto()).not.toContain('Enviar pedido');

      const tocados = await tocarTodo();

      // La barrida es más chica desde que se fueron los controles de la
      // maqueta (cantidad y alternativas); lo que importa es que recorra todo
      // lo que hay y que nada de eso cree un pedido.
      expect(tocados).toBeGreaterThan(0);
      http.expectNone('/pharmacy/orders');
      expect(enviar).not.toHaveBeenCalled();
      expect(navegar).not.toHaveBeenCalled();
      // El borrador sigue siendo el mismo objeto: nada lo consumió ni lo reescribió.
      expect(client.borradorPreparado()).toBe(BORRADOR_COMPLETO);
    });

    it('con ruta de checkout, tocar todo (incluido «Continuar») tampoco hace POST', async () => {
      configurar([{ provide: RUTA_DEL_CHECKOUT, useValue: RUTA_DE_PRUEBA }]);
      client.prepararBorrador(BORRADOR_COMPLETO);
      montar();
      const enviar = vi.spyOn(client, 'enviar');
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      await tocarTodo();
      // Los paneles cambian la lista de botones mientras se recorre: «Continuar»
      // se toca además explícitamente, al final.
      clic(uno('pedido-continuar'));
      await fixture.whenStable();

      expect(navegar).toHaveBeenCalled();
      http.expectNone('/pharmacy/orders');
      expect(enviar).not.toHaveBeenCalled();
      fixture.destroy();
      expect(client.borradorPreparado()).toBe(BORRADOR_COMPLETO);
    });
  });

  /* ── Las promociones del pedido (FAR-I7) ───────────────────────────────── */

  it('pone los dos precios con el mismo formato y dice en voz alta cuál es cuál', () => {
    configurar();
    // `GET /pharmacy-inventory/availability` devuelve el numeric crudo: el
    // precio de este renglón llega como "22.5". Junto al promocional, que sale
    // de la aritmética en centavos, «antes 22.5 · ahora 14.62» se lee como un
    // descuido sobre el número que la paciente va a pagar.
    const conPrecioCrudo: BorradorDePedido = {
      ...BORRADOR,
      lineas: [{ ...BORRADOR.lineas[0], precio: '22.5' }],
      totalEstimado: '22.5',
    };
    TestBed.inject(PharmacyCampaignsClient).sembrarPara(BORRADOR.pharmacyId, BORRADOR.farmacia, [
      {
        productId: 'f0e1d2c3-0000-4000-8000-000000000002',
        nombre: 'Ibuprofeno 400 mg',
        presentacion: null,
        precio: '22.5',
        moneda: 'BOB',
      },
    ]);
    client.prepararBorrador(conPrecioCrudo);
    montar();

    expect(uno('pedido-banner-promo')).not.toBeNull();
    const precio = raiz().querySelector('[data-testid="pedido-lineas"] .confirmacion__linea-precio');
    // Los dos con dos decimales, y no uno crudo y el otro formateado.
    expect(precio?.textContent).toContain('22.50 BOB');
    expect(precio?.textContent).toContain('14.62 BOB');
    // El tachado no se escucha: sin estas etiquetas, un lector de pantalla
    // anuncia dos precios seguidos y quien escucha no sabe cuál va a pagar.
    expect(precio?.querySelector('s .sr-only')?.textContent).toContain('Antes');
    expect(precio?.querySelector('strong .sr-only')?.textContent).toContain('campaña');

    expect(uno('pedido-total-promo')?.textContent).toContain('14.62');
    expect(raiz().querySelector('.confirmacion__total s .sr-only')?.textContent).toContain('Antes');
  });

  /* ── T-E1 · la receta como pedido ──────────────────────────────────────── */

  describe('sólo se dibuja lo que el contrato demuestra (FAR-REAL-T-E1 · D-R1-1 = A)', () => {
    it('no hay cabecera de receta inventada: el borrador no trae quién la emitió ni cuándo', () => {
      configurar();
      client.prepararBorrador(BORRADOR_COMPLETO);
      montar();

      expect(uno('pedido-receta')).toBeNull();
      expect(texto()).not.toContain('Emitida por');
      // El rótulo de maqueta sobra cuando no queda nada de maqueta que rotular.
      expect(texto()).not.toContain('Datos de ejemplo');
    });

    it('la cantidad es la del borrador y no se puede subir: no hay techo demostrable', () => {
      configurar();
      client.prepararBorrador(BORRADOR_COMPLETO);
      montar();

      expect(uno('pedido-linea-cantidad', renglon(0))?.textContent?.trim()).toBe('1');
      // Los controles de la maqueta ya no existen: el techo de 3 viajaba al
      // POST real como `quantity` (DEV_CONTAMINATION_1).
      expect(uno('pedido-cantidad-mas', renglon(0))).toBeNull();
      expect(uno('pedido-cantidad-menos', renglon(0))).toBeNull();
      expect(texto()).not.toContain('Recetado: hasta');
    });

    it('sin contrato no hay alternativas ni variante con seguro', () => {
      configurar();
      client.prepararBorrador(BORRADOR_COMPLETO);
      montar();

      expect(uno('pedido-ver-alternativas', renglon(0))).toBeNull();
      expect(uno('pedido-variante-seguro')).toBeNull();
      expect(uno('pedido-seguro')).toBeNull();
      for (const rotulo of [
        'Ver alternativas',
        'Alternativa elegida',
        'Aprobado por el seguro',
        'No aprobado',
        'Demostración',
      ]) {
        expect(texto()).not.toContain(rotulo);
      }
    });

    it('el total es el del borrador: nada se recalcula con cambios de demostración', () => {
      configurar();
      client.prepararBorrador(BORRADOR_COMPLETO);
      montar();

      expect(uno('pedido-total')?.textContent).toContain(BORRADOR_COMPLETO.totalEstimado ?? '');
      expect(uno('pedido-total-con-cambios')).toBeNull();
      expect(texto()).not.toContain('Recalculado con tus cambios');
    });

    it('un borrador sin renglones es un vacío con la vuelta a las sucursales', () => {
      configurar();
      client.prepararBorrador({ ...BORRADOR_COMPLETO, lineas: [], totalEstimado: null });
      montar();

      expect(texto()).toContain('Este pedido no tiene medicamentos para confirmar.');
      expect(texto()).toContain('Volver a las sucursales');
      expect(uno('pedido-confirmacion')).toBeNull();
    });
  });

  describe('«Continuar» hacia el checkout', () => {
    it('sin ruta de checkout se ofrece deshabilitado y no navega ni llama a la API', () => {
      configurar([{ provide: RUTA_DEL_CHECKOUT, useValue: null }]);
      client.prepararBorrador(BORRADOR_COMPLETO);
      montar();
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate');

      const continuar = uno('pedido-continuar');
      expect(continuar?.getAttribute('aria-disabled')).toBe('true');
      expect(uno('pedido-continuar-pendiente')).not.toBeNull();
      clic(continuar);

      expect(navegar).not.toHaveBeenCalled();
      http.expectNone('/pharmacy/orders');
    });

    it('con ruta, lleva la cantidad del borrador sin orderId, sin POST y sin perder el borrador', async () => {
      configurar([{ provide: RUTA_DEL_CHECKOUT, useValue: RUTA_DE_PRUEBA }]);
      client.prepararBorrador(BORRADOR_COMPLETO);
      montar();
      const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

      clic(uno('pedido-continuar'));
      await fixture.whenStable();

      http.expectNone('/pharmacy/orders');
      expect(navegar).toHaveBeenCalledTimes(1);
      const [comandos, extras] = navegar.mock.calls[0]!;
      expect(comandos).toEqual([RUTA_DE_PRUEBA]);
      const traspaso = (extras?.state as Record<string, unknown>)[
        CLAVE_DEL_TRASPASO
      ] as TraspasoDeLaReceta;
      expect(traspaso.conSeguro).toBe(false);
      // La cantidad es la del borrador y los dos campos de demostración van vacíos.
      expect(traspaso.renglones[0]).toMatchObject({
        indice: 0,
        cantidad: 1,
        alternativa: null,
        aprobadoPorSeguro: false,
      });
      expect(traspaso.renglones[1]).toMatchObject({ cantidad: 1, alternativa: null });
      // Ningún identificador de pedido ni de producto viaja en el traspaso.
      expect(JSON.stringify(traspaso)).not.toMatch(/orderId|productId/);

      // Dejar la pantalla tras continuar no descarta el borrador: el checkout lo lee.
      fixture.destroy();
      expect(client.borradorPreparado()).toBe(BORRADOR_COMPLETO);
    });

    it('si la navegación no ocurre, salir vuelve a descartar el borrador', async () => {
      configurar([{ provide: RUTA_DEL_CHECKOUT, useValue: RUTA_DE_PRUEBA }]);
      client.prepararBorrador(BORRADOR_COMPLETO);
      montar();
      vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(false);

      clic(uno('pedido-continuar'));
      await fixture.whenStable();
      fixture.destroy();

      expect(client.borradorPreparado()).toBeNull();
    });
  });

  /* ── La capacidad real queda intacta para el checkout (AC-COMUN-08) ────── */

  it('PharmacyOrdersClient.enviar() sigue creando el pedido real con el borrador (lo usará el checkout)', () => {
    configurar();
    let creado: string | null = null;

    client
      .enviar({ borrador: BORRADOR_COMPLETO, modalidad: 'RETIRO', direccionDeEntrega: null })
      .subscribe((pedido) => (creado = pedido.id));

    const request = http.expectOne('/pharmacy/orders');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.lines).toEqual([
      { productId: 'f0e1d2c3-0000-4000-8000-000000000002', quantity: 1 },
      { productId: 'f0e1d2c3-0000-4000-8000-000000000003', quantity: 1 },
    ]);
    request.flush(pharmacyOrderDtoFixture());
    expect(creado).toBe(pharmacyOrderDtoFixture().id);
  });
});
