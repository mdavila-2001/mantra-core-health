import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type {
  BorradorDePedido,
  PedidoFarmacia,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { aPrecio, InboxOrder } from './inbox-order';

/**
 * El pedido del lado del mostrador (FAR-I3). Lo que se fija: abrirlo ES
 * recepcionarlo, la confirmación con ajustes por línea y su total en vivo,
 * el rechazo que pregunta con motivo, el retiro parcial con historia, el
 * código que no coincide dicho en palabras, y el delivery artesanal.
 */

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
      precio: '60.00',
      moneda: 'BOB',
      disponible: true,
    },
    {
      productId: null,
      medicamento: 'Ibuprofeno',
      presentacion: null,
      cantidad: 2,
      precio: '25.50',
      moneda: 'BOB',
      disponible: true,
    },
  ],
  totalEstimado: '111.00',
  moneda: 'BOB',
};

describe('InboxOrder', () => {
  let harness: RouterTestingHarness;
  let client: PharmacyOrdersClient;
  let confirmar: ReturnType<typeof vi.fn>;
  let confirmarConMotivo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    confirmar = vi.fn().mockResolvedValue(true);
    confirmarConMotivo = vi.fn().mockResolvedValue('No trabajamos con esa presentación.');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'administration/pharmacy-orders/:orderId', component: InboxOrder },
        ]),
        { provide: SessionStore, useValue: { displayName: () => 'Ana Pérez' } },
        // El diálogo real vive en el `<body>`: acá se fija que se PREGUNTA.
        {
          provide: DialogService,
          useValue: { confirm: confirmar, confirmWithReason: confirmarConMotivo },
        },
      ],
    });
    client = TestBed.inject(PharmacyOrdersClient);
  });

  async function enviado(modalidad: 'RETIRO' | 'DOMICILIO' = 'RETIRO'): Promise<PedidoFarmacia> {
    return firstValueFrom(
      client.enviar({
        borrador: BORRADOR,
        modalidad,
        direccionDeEntrega: modalidad === 'RETIRO' ? null : 'Av. Ejemplo 123',
      }),
    );
  }

  async function montar(orderId: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/administration/pharmacy-orders/${orderId}`, InboxOrder);
    harness.detectChanges();
  }

  function texto(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  function elemento<T extends HTMLElement>(selector: string): T | null {
    return harness.routeNativeElement?.querySelector<T>(selector) ?? null;
  }

  function click(testid: string): void {
    elemento<HTMLButtonElement>(`[data-testid="${testid}"]`)?.click();
    harness.detectChanges();
  }

  async function asentar(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  function escribir(selector: string, valor: string): void {
    const campo = elemento<HTMLInputElement>(selector);
    if (campo === null) {
      throw new Error(`no está el campo ${selector}`);
    }
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    harness.detectChanges();
  }

  it('un pedido que no está ofrece volver a la bandeja', async () => {
    await montar('no-existe');
    expect(texto()).toContain('No encontramos lo que buscás');
    expect(texto()).toContain('Volver a la bandeja');
  });

  it('abrirlo ES recepcionarlo: el pedido queda en revisión, con sus ajustes', async () => {
    const pedido = await enviado();
    await montar(pedido.id);

    expect((await firstValueFrom(client.pedido(pedido.id)))?.estado).toBe('EN_REVISION');
    expect(texto()).toContain('Ana Pérez');
    expect(texto()).toContain('En revisión');
    expect(texto()).toContain('Receta electrónica');
    expect(elemento('[data-testid="mostrador-decision-0"]')).not.toBeNull();
    expect(texto()).toContain('Total:');
    expect(texto()).toContain('111.00');
    expect(texto()).not.toMatch(UUID);
  });

  it('confirmar tal cual deja el pedido en preparación', async () => {
    const pedido = await enviado();
    await montar(pedido.id);

    click('mostrador-confirmar');
    await asentar();

    expect(texto()).toContain('En preparación');
    expect(elemento('[data-testid="mostrador-listo"]')).not.toBeNull();
  });

  it('proponer un genérico recalcula el total en vivo y deja decidir al paciente', async () => {
    const pedido = await enviado();
    await montar(pedido.id);

    const radios = harness.routeNativeElement?.querySelectorAll<HTMLInputElement>(
      '[data-testid="mostrador-decision-0"] input[type="radio"]',
    );
    radios?.[1]?.click();
    harness.detectChanges();

    // El nombre viene prefijado; el precio lo tipea el mostrador.
    escribir('[data-testid="mostrador-generico-precio-0"]', '24');
    expect(texto()).toContain('Total si acepta las propuestas:');
    expect(texto()).toContain('75.00');

    click('mostrador-confirmar');
    await asentar();

    expect(texto()).toContain('Esperando al paciente');
    expect(texto()).toContain('La decisión es del paciente');
    const abierto = await firstValueFrom(client.pedido(pedido.id));
    expect(abierto?.sustituciones[0]?.propuesta).toEqual({
      nombre: 'Genérico equivalente de Amoxicilina',
      precio: '24.00',
    });
  });

  it('rechazar pregunta con motivo obligatorio, y el motivo queda a la vista', async () => {
    const pedido = await enviado();
    await montar(pedido.id);

    click('mostrador-rechazar');
    await asentar();

    expect(confirmarConMotivo).toHaveBeenCalledTimes(1);
    expect(texto()).toContain('Rechazado');
    expect(texto()).toContain('No trabajamos con esa presentación.');
  });

  it('el retiro parcial deja historia y el completo cierra; el código manda', async () => {
    const pedido = await enviado();
    await montar(pedido.id);
    click('mostrador-confirmar');
    await asentar();
    click('mostrador-listo');
    await asentar();

    const codigo = (await firstValueFrom(client.pedido(pedido.id)))?.codigoDeRetiro ?? '';
    expect(texto()).toContain('Registrar retiro');

    // Primero con un código que no coincide: se dice, no se entrega.
    escribir('[data-testid="mostrador-codigo"]', 'NOPE99');
    click('mostrador-retirar');
    await asentar();
    expect(texto()).toContain('El código no coincide');

    // Ahora el bueno, pero se lleva un solo renglón. El click va al input
    // real: el testid vive en el host de `app-checkbox`.
    escribir('[data-testid="mostrador-codigo"]', codigo);
    elemento<HTMLInputElement>(
      '[data-testid="mostrador-renglon-1"] input[type="checkbox"]',
    )?.click();
    harness.detectChanges();
    click('mostrador-retirar');
    await asentar();

    expect(texto()).toContain('Esperando el retiro');
    expect(texto()).toContain('Entregas registradas');
    expect(texto()).toContain('Amoxicilina');

    // Vuelve por el resto: cerrado.
    escribir('[data-testid="mostrador-codigo"]', codigo);
    click('mostrador-retirar');
    await asentar();
    expect(texto()).toContain('Entregado');
    expect((await firstValueFrom(client.pedido(pedido.id)))?.estado).toBe('RETIRADO');
  });

  it('el delivery artesanal: en camino, y la entrega se confirma antes de cerrar', async () => {
    const pedido = await enviado('DOMICILIO');
    await montar(pedido.id);
    click('mostrador-confirmar');
    await asentar();

    // Con envío no hay mostrador: no existe «marcar listo».
    expect(elemento('[data-testid="mostrador-listo"]')).toBeNull();
    expect(texto()).toContain('Av. Ejemplo 123');

    click('mostrador-encamino');
    await asentar();
    expect(texto()).toContain('En camino');

    click('mostrador-entregar');
    await asentar();
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(texto()).toContain('Entregado');
  });

  it('un pedido cancelado en el camino no ofrece registrar la entrega', async () => {
    const pedido = await enviado('DOMICILIO');
    await montar(pedido.id);
    click('mostrador-confirmar');
    await asentar();
    click('mostrador-encamino');
    await asentar();

    // El paciente cancela desde su pantalla; la ficha se refleja en vivo.
    await firstValueFrom(client.cancelar(pedido.id));
    await asentar();

    expect(texto()).toContain('Cancelado');
    // Ni el botón de entrega ni el bloque de envío: el pedido terminó.
    expect(elemento('[data-testid="mostrador-entregar"]')).toBeNull();
    expect(texto()).not.toContain('Entrega a domicilio');
  });
});

/**
 * El lector del precio tipeado: lo que se muestra en el total en vivo y lo
 * que viaja en la propuesta salen del mismo lugar, así que basta fijarlo acá.
 */
describe('aPrecio', () => {
  it('acepta la coma decimal: «24,50» es un precio, no basura', () => {
    expect(aPrecio('24,50')).toBe('24.50');
    expect(aPrecio(' 24.5 ')).toBe('24.50');
  });

  it('vacío, ilegible o negativo = sin precio, nunca un descarte mudo', () => {
    expect(aPrecio('')).toBeNull();
    expect(aPrecio('gratis')).toBeNull();
    expect(aPrecio('-3')).toBeNull();
  });
});
