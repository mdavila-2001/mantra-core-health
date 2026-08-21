import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { PharmacyOrdersClient } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type { BorradorDePedido } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { AlarmaDePedidos } from './alarma-de-pedidos';
import { PharmacyInbox } from './pharmacy-inbox';

/**
 * La bandeja del mostrador (FAR-I3). Lo que se fija: las cuatro colas de la
 * tarjeta con cada pedido en la suya, la línea de base que NO suena, la
 * alarma que SÍ suena cuando un pedido llega después, y las reglas de la
 * casa: cero uuid, el interruptor de sonido a la vista y el vacío honesto.
 *
 * Las pruebas corren con `environment.development` → `demoPresets` encendido;
 * la rama sin demo («Próximamente») vive en `aplicar()` y se verifica en
 * runtime, no acá.
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

describe('PharmacyInbox', () => {
  let client: PharmacyOrdersClient;
  let alarma: {
    sonidoActivo: ReturnType<typeof signal<boolean>>;
    alternarSonido: ReturnType<typeof vi.fn>;
    notificar: ReturnType<typeof vi.fn>;
    descartar: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    alarma = {
      sonidoActivo: signal(true),
      alternarSonido: vi.fn(),
      notificar: vi.fn(),
      descartar: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionStore, useValue: { displayName: () => 'Ana Pérez' } },
      ],
    });
    // La alarma real toca audio y título: acá se fija QUÉ la dispara.
    TestBed.overrideComponent(PharmacyInbox, {
      set: { providers: [{ provide: AlarmaDePedidos, useValue: alarma }] },
    });
    client = TestBed.inject(PharmacyOrdersClient);
  });

  async function enviar(): Promise<string> {
    const pedido = await firstValueFrom(
      client.enviar({ borrador: BORRADOR, modalidad: 'RETIRO', direccionDeEntrega: null }),
    );
    return pedido.id;
  }

  async function montar(): Promise<ComponentFixture<PharmacyInbox>> {
    const fixture = TestBed.createComponent(PharmacyInbox);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  function texto(fixture: ComponentFixture<PharmacyInbox>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('sin pedidos, el vacío dice qué va a pasar acá — y el interruptor está', async () => {
    const fixture = await montar();
    expect(texto(fixture)).toContain('Todavía no llegó ningún pedido');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="bandeja-sonido"]'),
    ).not.toBeNull();
    expect(texto(fixture)).toContain('Sonido de alarma');
  });

  it('cada pedido cae en su cola, en palabras y sin uuid', async () => {
    const enviado = await enviar();
    const listo = await enviar();
    await firstValueFrom(client.confirmarPedido(listo, []));
    await firstValueFrom(client.marcarListo(listo));

    const fixture = await montar();
    const raiz = fixture.nativeElement as HTMLElement;

    const colas = [...raiz.querySelectorAll('.bandeja__cola')].map(
      (cola) => cola.getAttribute('aria-label') ?? '',
    );
    expect(colas).toEqual(['Nuevos', 'En revisión', 'Esperando al paciente', 'Listos para retiro']);

    const nuevos = raiz.querySelector('[aria-label="Nuevos"]');
    expect(nuevos?.textContent).toContain('Ana Pérez');
    expect(nuevos?.textContent).toContain('Amoxicilina y 1 más');
    expect(nuevos?.textContent).toContain('111.00 BOB');

    const listos = raiz.querySelector('[aria-label="Listos para retiro"]');
    expect(listos?.textContent).toContain('Esperando el retiro');
    expect(listos?.textContent).toContain('Vence en');

    expect(texto(fixture)).not.toMatch(UUID);
    expect(enviado).toMatch(UUID);
  });

  it('encontrar la bandeja llena al abrirla no es «llegó un pedido»', async () => {
    await enviar();
    await montar();
    expect(alarma.notificar).not.toHaveBeenCalled();
  });

  it('un pedido que llega con la bandeja abierta suena y entra destacado', async () => {
    const fixture = await montar();
    await enviar();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(alarma.notificar).toHaveBeenCalledWith(1);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.bandeja__tarjeta--nueva'),
    ).not.toBeNull();
    // El cuarto canal: la región viva que el lector de pantalla anuncia.
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="bandeja-aviso"]')
        ?.textContent,
    ).toContain('Llegó un pedido nuevo');
  });

  it('los terminales quedan en el pliegue, con su conteo', async () => {
    const id = await enviar();
    await firstValueFrom(client.rechazarPedido(id, 'Sin stock en la sucursal.'));

    const fixture = await montar();
    expect(texto(fixture)).toContain('Cerrados (1)');
    expect(texto(fixture)).toContain('En preparación (0)');
  });
});
