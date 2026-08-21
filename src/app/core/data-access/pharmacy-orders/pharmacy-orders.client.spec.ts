import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { SessionStore } from '../../auth/session.store';
import {
  esEstadoTerminal,
  esPedidoDelCanal,
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

/**
 * El lado del mostrador del cliente de pedidos (FAR-I3). Lo que se fija: la
 * recepción por apertura, la confirmación con ajustes por línea y su total,
 * el rechazo con motivo obligatorio, el retiro parcial con historia y el
 * delivery artesanal. El lado paciente ya está fijado por los specs de las
 * pantallas de FAR-I2.
 */

const CODIGO_DE_RETIRO = /^[ACDEFHJKLMNPRTUVWXY34679]{6}$/;

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
      productId: 'f0e1d2c3-0000-4000-8000-000000000003',
      medicamento: 'Ibuprofeno',
      presentacion: '400 mg · Caja x 10 comprimidos',
      cantidad: 2,
      precio: '25.50',
      moneda: 'BOB',
      disponible: true,
    },
  ],
  totalEstimado: '111.00',
  moneda: 'BOB',
};

describe('PharmacyOrdersClient — el lado del mostrador', () => {
  let client: PharmacyOrdersClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        // Sólo lo que el cliente estampa: el nombre de quien envía.
        { provide: SessionStore, useValue: { displayName: () => 'Ana Pérez' } },
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

  async function pedidoActual(id: string): Promise<PedidoFarmacia> {
    const pedido = await firstValueFrom(client.pedido(id));
    if (pedido === null) {
      throw new Error('el pedido tendría que existir');
    }
    return pedido;
  }

  it('el envío estampa quién pidió, desde la sesión y en palabras', async () => {
    const pedido = await enviado();
    expect(pedido.paciente).toBe('Ana Pérez');
    // El prescriptor llega con el DTO de FAR-E2: sin nombre no se inventa.
    expect(pedido.prescriptor).toBeNull();
  });

  it('abrir un pedido nuevo es recepcionarlo: pasa a revisión una sola vez', async () => {
    const pedido = await enviado();
    const abierto = await firstValueFrom(client.abrirRevision(pedido.id));
    expect(abierto?.estado).toBe('EN_REVISION');
    // Reabrir no retrocede nada: la transición sale sólo desde ENVIADO.
    const reabierto = await firstValueFrom(client.abrirRevision(pedido.id));
    expect(reabierto?.estado).toBe('EN_REVISION');
  });

  it('confirmar sin propuestas deja el pedido confirmado y recalcula el total', async () => {
    const pedido = await enviado();
    const confirmado = await firstValueFrom(
      client.confirmarPedido(pedido.id, [
        { indice: 0, decision: 'TAL_CUAL' },
        { indice: 1, decision: 'NO_DISPONIBLE' },
      ]),
    );
    expect(confirmado?.estado).toBe('CONFIRMADO');
    expect(confirmado?.lineas[1]?.disponible).toBe(false);
    // Queda sólo la amoxicilina: 60.00, no los 111.00 del envío.
    expect(confirmado?.totalEstimado).toBe('60.00');
  });

  it('confirmar con un genérico deja la decisión en manos del paciente', async () => {
    const pedido = await enviado();
    const confirmado = await firstValueFrom(
      client.confirmarPedido(pedido.id, [
        {
          indice: 0,
          decision: 'PROPONER_GENERICO',
          propuesta: { nombre: 'Amoxicilina genérica', precio: '24.00' },
        },
        { indice: 1, decision: 'TAL_CUAL' },
      ]),
    );
    expect(confirmado?.estado).toBe('ACEPTACION_PENDIENTE');
    expect(confirmado?.sustituciones).toHaveLength(1);
    expect(confirmado?.sustituciones[0]?.original.nombre).toBe('Amoxicilina');
    expect(confirmado?.sustituciones[0]?.propuesta).toEqual({
      nombre: 'Amoxicilina genérica',
      precio: '24.00',
    });
    // El total no aplica la propuesta: la persona todavía no la aceptó.
    expect(confirmado?.totalEstimado).toBe('111.00');
  });

  it('el rechazo exige motivo, y no alcanza a un pedido ya listo', async () => {
    const pedido = await enviado();
    const sinMotivo = await firstValueFrom(client.rechazarPedido(pedido.id, '   '));
    expect(sinMotivo?.estado).toBe('ENVIADO');

    const rechazado = await firstValueFrom(
      client.rechazarPedido(pedido.id, 'No trabajamos con esa presentación.'),
    );
    expect(rechazado?.estado).toBe('RECHAZADO');
    expect(rechazado?.motivoDeRechazo).toBe('No trabajamos con esa presentación.');

    const listo = await enviado();
    await firstValueFrom(client.confirmarPedido(listo.id, []));
    await firstValueFrom(client.marcarListo(listo.id));
    const intacto = await firstValueFrom(client.rechazarPedido(listo.id, 'tarde'));
    expect(intacto?.estado).toBe('LISTO_PARA_RETIRO');
  });

  it('marcar listo genera el código legible y las 48 horas de reserva', async () => {
    const pedido = await enviado();
    await firstValueFrom(client.confirmarPedido(pedido.id, []));
    const listo = await firstValueFrom(client.marcarListo(pedido.id));
    expect(listo?.estado).toBe('LISTO_PARA_RETIRO');
    expect(listo?.codigoDeRetiro).toMatch(CODIGO_DE_RETIRO);
    expect(listo?.venceEl).not.toBeNull();
  });

  it('con envío no hay mostrador: marcar listo no aplica', async () => {
    const pedido = await enviado('DOMICILIO');
    await firstValueFrom(client.confirmarPedido(pedido.id, []));
    const intacto = await firstValueFrom(client.marcarListo(pedido.id));
    expect(intacto?.estado).toBe('CONFIRMADO');
    expect(intacto?.codigoDeRetiro).toBeNull();
  });

  it('un código que no coincide se dice sin tocar nada', async () => {
    const pedido = await enviado();
    await firstValueFrom(client.confirmarPedido(pedido.id, []));
    await firstValueFrom(client.marcarListo(pedido.id));
    const resultado = await firstValueFrom(
      client.dispensar(pedido.id, { codigo: 'NOPE99', indices: [0, 1] }),
    );
    expect(resultado.codigoValido).toBe(false);
    expect(resultado.pedido?.estado).toBe('LISTO_PARA_RETIRO');
    expect(resultado.pedido?.entregas).toHaveLength(0);
  });

  it('el retiro parcial deja historia, y el completo cierra el pedido', async () => {
    const pedido = await enviado();
    await firstValueFrom(client.confirmarPedido(pedido.id, []));
    await firstValueFrom(client.marcarListo(pedido.id));
    const codigo = (await pedidoActual(pedido.id)).codigoDeRetiro ?? '';

    // Se lleva sólo el primer renglón — en minúsculas: el mostrador no
    // debería fallar por cómo se tipeó el código.
    const parcial = await firstValueFrom(
      client.dispensar(pedido.id, { codigo: codigo.toLowerCase(), indices: [0] }),
    );
    expect(parcial.codigoValido).toBe(true);
    expect(parcial.pedido?.estado).toBe('LISTO_PARA_RETIRO');
    expect(parcial.pedido?.entregas).toHaveLength(1);
    expect(parcial.pedido?.entregas[0]?.indices).toEqual([0]);

    // Vuelve por el resto: ahora sí, retirado, con las dos entregas.
    const completo = await firstValueFrom(
      client.dispensar(pedido.id, { codigo, indices: [0, 1] }),
    );
    expect(completo.pedido?.estado).toBe('RETIRADO');
    expect(completo.pedido?.entregas).toHaveLength(2);
    expect(completo.pedido?.entregas[1]?.indices).toEqual([1]);
  });

  it('el delivery artesanal: en camino primero, entregado cierra', async () => {
    const pedido = await enviado('DOMICILIO');
    await firstValueFrom(client.confirmarPedido(pedido.id, []));

    // Entregar sin haber salido no cierra nada.
    const anticipado = await firstValueFrom(client.marcarEnvio(pedido.id, 'ENTREGADO'));
    expect(anticipado?.estado).toBe('CONFIRMADO');

    const enCamino = await firstValueFrom(client.marcarEnvio(pedido.id, 'EN_CAMINO'));
    expect(enCamino?.envio).toBe('EN_CAMINO');
    expect(enCamino?.estado).toBe('CONFIRMADO');

    const entregado = await firstValueFrom(client.marcarEnvio(pedido.id, 'ENTREGADO'));
    expect(entregado?.envio).toBe('ENTREGADO');
    expect(entregado?.estado).toBe('RETIRADO');
    expect(entregado?.entregas).toHaveLength(1);
  });

  it('en un retiro no hay hitos de envío que marcar', async () => {
    const pedido = await enviado();
    await firstValueFrom(client.confirmarPedido(pedido.id, []));
    const intacto = await firstValueFrom(client.marcarEnvio(pedido.id, 'EN_CAMINO'));
    expect(intacto?.envio).toBeNull();
  });

  it('registrar la entrega no resucita un pedido cancelado en el camino', async () => {
    const pedido = await enviado('DOMICILIO');
    await firstValueFrom(client.confirmarPedido(pedido.id, []));
    await firstValueFrom(client.marcarEnvio(pedido.id, 'EN_CAMINO'));
    // El paciente puede cancelar mientras el envío está en la calle: el
    // pedido no terminó. La entrega posterior no puede deshacer un terminal.
    await firstValueFrom(client.cancelar(pedido.id));

    const intacto = await firstValueFrom(client.marcarEnvio(pedido.id, 'ENTREGADO'));
    expect(intacto?.estado).toBe('CANCELADO');
    expect(intacto?.entregas).toHaveLength(0);
  });

  it('aceptar la propuesta aplica el genérico: el mostrador prepara lo acordado', async () => {
    const pedido = await enviado();
    await firstValueFrom(
      client.confirmarPedido(pedido.id, [
        {
          indice: 0,
          decision: 'PROPONER_GENERICO',
          propuesta: { nombre: 'Amoxicilina genérica', precio: '24.00' },
        },
        { indice: 1, decision: 'TAL_CUAL' },
      ]),
    );

    const aceptado = await firstValueFrom(client.aceptarSustituciones(pedido.id));
    expect(aceptado?.estado).toBe('ACEPTADO');
    // El renglón pasa a ser lo acordado: lo que se prepara y se retira.
    expect(aceptado?.lineas[0]?.medicamento).toBe('Amoxicilina genérica');
    expect(aceptado?.lineas[0]?.precio).toBe('24.00');
    // 24.00 + 2 × 25.50: el total ya refleja la aceptación.
    expect(aceptado?.totalEstimado).toBe('75.00');
    // La propuesta queda como historia, no se borra.
    expect(aceptado?.sustituciones).toHaveLength(1);
  });

  describe('el canal de la demo', () => {
    it('un mensaje malformado no pasa el guard: el store no se envenena', async () => {
      expect(esPedidoDelCanal(null)).toBe(false);
      expect(esPedidoDelCanal(undefined)).toBe(false);
      expect(esPedidoDelCanal('pedido')).toBe(false);
      expect(esPedidoDelCanal({ id: 'x' })).toBe(false);
      const pedido = await enviado();
      expect(esPedidoDelCanal({ ...pedido, estado: 'INVENTADO' })).toBe(false);
      expect(esPedidoDelCanal({ ...pedido, lineas: 'no-es-lista' })).toBe(false);
    });

    it('un pedido con la forma del contrato pasa', async () => {
      expect(esPedidoDelCanal(await enviado())).toBe(true);
    });
  });
});
