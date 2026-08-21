import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import {
  esEstadoTerminal,
  PharmacyOrdersClient,
  puedeCancelarse,
} from './pharmacy-orders.client';
import type {
  BorradorDePedido,
  PedidoFarmacia,
  SimulacionDeFarmacia,
} from './pharmacy-orders.types';

/**
 * Lo que estas pruebas fijan es el **contrato que las pantallas consumen**:
 * el ciclo de estados del README de la tanda, la coherencia de la simulación
 * (un paso imposible no hace nada) y que el código de retiro y la propuesta
 * de sustitución nazcan bien formados. Cuando FAR-E1 conecte los endpoints,
 * estas mismas firmas tienen que seguir cumpliendo esto.
 */
describe('PharmacyOrdersClient', () => {
  let client: PharmacyOrdersClient;

  const borrador = (extra: Partial<BorradorDePedido> = {}): BorradorDePedido => ({
    requestId: 'rx-1',
    siteId: 'site-1',
    farmacia: 'Farmacia del Sur',
    sede: 'Sucursal Equipetrol',
    direccion: 'Av. San Martín 456',
    lineas: [
      {
        productId: 'prod-1',
        medicamento: 'Paracetamol',
        presentacion: '500 mg · caja x 20',
        cantidad: 1,
        precio: '60.00',
        moneda: 'BOB',
        disponible: true,
      },
      {
        productId: null,
        medicamento: 'Ibuprofeno',
        presentacion: null,
        cantidad: 1,
        precio: null,
        moneda: null,
        disponible: false,
      },
    ],
    totalEstimado: '60.00',
    moneda: 'BOB',
    ...extra,
  });

  async function enviado(extra: Partial<BorradorDePedido> = {}): Promise<PedidoFarmacia> {
    return firstValueFrom(
      client.enviar({ borrador: borrador(extra), modalidad: 'RETIRO', direccionDeEntrega: null }),
    );
  }

  async function llevarA(id: string, pasos: readonly SimulacionDeFarmacia[]): Promise<void> {
    for (const paso of pasos) {
      await firstValueFrom(client.simular(id, paso));
    }
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    client = TestBed.inject(PharmacyOrdersClient);
  });

  describe('el borrador', () => {
    it('nace vacío, se prepara y se descarta', () => {
      expect(client.borradorPreparado()).toBeNull();

      client.prepararBorrador(borrador());
      expect(client.borradorPreparado()?.farmacia).toBe('Farmacia del Sur');

      client.descartarBorrador();
      expect(client.borradorPreparado()).toBeNull();
    });

    it('enviar lo consume: no queda un pedido a medias esperando', async () => {
      client.prepararBorrador(borrador());
      await enviado();

      expect(client.borradorPreparado()).toBeNull();
    });
  });

  describe('enviar y leer', () => {
    it('crea el pedido ENVIADO con las líneas y la sede del borrador', async () => {
      const pedido = await enviado();

      expect(pedido.estado).toBe('ENVIADO');
      expect(pedido.lineas.length).toBe(2);
      expect(pedido.codigoDeRetiro).toBeNull();
      expect(pedido.venceEl).toBeNull();
      expect(pedido.sustituciones).toEqual([]);
    });

    it('lista los pedidos con el más nuevo primero', async () => {
      const primero = await enviado();
      const segundo = await enviado({ farmacia: 'Farmacia Central' });

      const lista = await firstValueFrom(client.misPedidos());
      expect(lista.map((pedido) => pedido.id)).toEqual([segundo.id, primero.id]);
    });

    it('un pedido inexistente es null, no un error', async () => {
      expect(await firstValueFrom(client.pedido('no-existe'))).toBeNull();
    });
  });

  describe('la simulación de la farmacia', () => {
    it('recorre el camino feliz completo hasta RETIRADO', async () => {
      const pedido = await enviado();
      await llevarA(pedido.id, ['REVISAR', 'CONFIRMAR', 'MARCAR_LISTO', 'DISPENSAR']);

      expect((await firstValueFrom(client.pedido(pedido.id)))?.estado).toBe('RETIRADO');
    });

    it('un paso que el estado no permite no hace nada', async () => {
      const pedido = await enviado();

      const igual = await firstValueFrom(client.simular(pedido.id, 'DISPENSAR'));
      expect(igual?.estado).toBe('ENVIADO');
    });

    it('MARCAR_LISTO acuña el código de retiro y el vencimiento a 48 horas', async () => {
      const pedido = await enviado();
      const antes = Date.now();
      await llevarA(pedido.id, ['CONFIRMAR', 'MARCAR_LISTO']);

      const listo = await firstValueFrom(client.pedido(pedido.id));
      // Legible en mostrador: seis caracteres, sin O/0, I/1 ni B/8.
      expect(listo?.codigoDeRetiro).toMatch(/^[ACDEFHJKLMNPRTUVWXY34679]{6}$/);
      const horas = ((listo?.venceEl?.getTime() ?? 0) - antes) / 3_600_000;
      expect(horas).toBeGreaterThan(47.9);
      expect(horas).toBeLessThan(48.1);
    });

    it('RECHAZAR deja el motivo en palabras', async () => {
      const pedido = await enviado();
      const rechazado = await firstValueFrom(client.simular(pedido.id, 'RECHAZAR'));

      expect(rechazado?.estado).toBe('RECHAZADO');
      expect(rechazado?.motivoDeRechazo).toContain('stock');
    });

    it('la propuesta compara el renglón disponible con un genérico más barato', async () => {
      const pedido = await enviado();
      await llevarA(pedido.id, ['REVISAR', 'PROPONER_SUSTITUCION']);

      const pendiente = await firstValueFrom(client.pedido(pedido.id));
      expect(pendiente?.estado).toBe('ACEPTACION_PENDIENTE');
      const propuesta = pendiente?.sustituciones[0];
      expect(propuesta?.original).toEqual({ nombre: 'Paracetamol', precio: '60.00' });
      expect(propuesta?.propuesta.precio).toBe('24.00');
    });

    it('sin precio publicado la propuesta no inventa uno', async () => {
      const pedido = await enviado({
        lineas: [
          {
            productId: 'prod-2',
            medicamento: 'Amoxicilina',
            presentacion: null,
            cantidad: 1,
            precio: null,
            moneda: null,
            disponible: true,
          },
        ],
        totalEstimado: null,
        moneda: null,
      });
      await llevarA(pedido.id, ['REVISAR', 'PROPONER_SUSTITUCION']);

      const propuesta = (await firstValueFrom(client.pedido(pedido.id)))?.sustituciones[0];
      expect(propuesta?.original.precio).toBeNull();
      expect(propuesta?.propuesta.precio).toBeNull();
    });
  });

  describe('las decisiones de la persona', () => {
    it('aceptar la propuesta lleva a ACEPTADO; preferir el original vuelve a CONFIRMADO', async () => {
      const uno = await enviado();
      await llevarA(uno.id, ['REVISAR', 'PROPONER_SUSTITUCION']);
      expect((await firstValueFrom(client.aceptarSustituciones(uno.id)))?.estado).toBe('ACEPTADO');

      const dos = await enviado();
      await llevarA(dos.id, ['REVISAR', 'PROPONER_SUSTITUCION']);
      const confirmado = await firstValueFrom(client.preferirOriginal(dos.id));
      expect(confirmado?.estado).toBe('CONFIRMADO');
      // La propuesta queda como historia: se decidió, no se borró.
      expect(confirmado?.sustituciones.length).toBe(1);
    });

    it('decidir sólo vale mientras la decisión está pendiente', async () => {
      const pedido = await enviado();
      expect((await firstValueFrom(client.aceptarSustituciones(pedido.id)))?.estado).toBe(
        'ENVIADO',
      );
    });

    it('cancelar vale hasta que el pedido termina, y después ya no', async () => {
      const abierto = await enviado();
      expect((await firstValueFrom(client.cancelar(abierto.id)))?.estado).toBe('CANCELADO');

      const retirado = await enviado();
      await llevarA(retirado.id, ['CONFIRMAR', 'MARCAR_LISTO', 'DISPENSAR']);
      expect((await firstValueFrom(client.cancelar(retirado.id)))?.estado).toBe('RETIRADO');
    });

    it('re-pedir un VENCIDO crea un pedido nuevo con las mismas líneas', async () => {
      const viejo = await enviado();
      await llevarA(viejo.id, ['CONFIRMAR', 'MARCAR_LISTO', 'VENCER']);

      const nuevo = await firstValueFrom(client.reintentar(viejo.id));
      expect(nuevo?.id).not.toBe(viejo.id);
      expect(nuevo?.estado).toBe('ENVIADO');
      expect(nuevo?.lineas).toEqual(viejo.lineas);
      // El vencido queda en la lista: es historia, no un error a esconder.
      expect((await firstValueFrom(client.misPedidos())).length).toBe(2);
    });

    it('re-pedir sólo aplica a un pedido vencido', async () => {
      const pedido = await enviado();
      expect(await firstValueFrom(client.reintentar(pedido.id))).toBeNull();
    });
  });

  describe('los predicados del contrato', () => {
    it('terminal es lo que ya no se mueve, y eso es lo que no se puede cancelar', () => {
      expect(esEstadoTerminal('RETIRADO')).toBe(true);
      expect(esEstadoTerminal('RECHAZADO')).toBe(true);
      expect(esEstadoTerminal('VENCIDO')).toBe(true);
      expect(esEstadoTerminal('CANCELADO')).toBe(true);
      expect(esEstadoTerminal('LISTO_PARA_RETIRO')).toBe(false);

      expect(puedeCancelarse('ENVIADO')).toBe(true);
      expect(puedeCancelarse('LISTO_PARA_RETIRO')).toBe(true);
      expect(puedeCancelarse('RETIRADO')).toBe(false);
    });

    it('la barra de demo sólo ofrece pasos coherentes con el estado', () => {
      expect(client.simulacionesPara('ENVIADO')).toEqual(['REVISAR', 'CONFIRMAR', 'RECHAZAR']);
      expect(client.simulacionesPara('LISTO_PARA_RETIRO')).toEqual(['DISPENSAR', 'VENCER']);
      expect(client.simulacionesPara('RETIRADO')).toEqual([]);
      expect(client.simulacionesPara('CANCELADO')).toEqual([]);
    });
  });
});
