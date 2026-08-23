import type { PedidoFarmacia } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { comprobanteDesdePedido } from './from-pedido';
import { bloquesDeComprobante } from './receipt-pdf';
import type { DocumentoDeComprobante } from './receipt-pdf.types';

/**
 * Lo que se fija: el comprobante refleja EXACTAMENTE lo que el puerto
 * registró (medio, fecha, líneas cobradas, total), dice qué es y qué no es
 * («no es una factura»), y un pedido sin pago no tiene comprobante. El motor
 * de render (jsPDF) no aparece: sus pruebas viven en `pdf-export.spec.ts`.
 */

const PAGADO_EL = new Date('2026-08-21T18:30:00');

const pedido = (extra: Partial<PedidoFarmacia> = {}): PedidoFarmacia => ({
  id: 'f0e1d2c3-0000-4000-8000-00000000abcd',
  estado: 'RETIRADO',
  creadoEl: new Date('2026-08-21T10:00:00'),
  venceEl: null,
  farmacia: 'Farmacia Andina',
  sede: 'Sucursal Centro',
  direccion: null,
  modalidad: 'RETIRO',
  direccionDeEntrega: null,
  paciente: 'Ana Pérez',
  prescriptor: null,
  lineas: [
    {
      productId: 'prod-1',
      medicamento: 'Amoxicilina',
      presentacion: '500 mg · Caja x 21',
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
    {
      productId: null,
      medicamento: 'Loratadina',
      presentacion: null,
      cantidad: 1,
      precio: '15.00',
      moneda: 'BOB',
      disponible: false,
    },
  ],
  totalEstimado: '111.00',
  moneda: 'BOB',
  codigoDeRetiro: 'ACDEFH',
  motivoDeRechazo: null,
  sustituciones: [],
  envio: null,
  entregas: [],
  pago: {
    estado: 'PAGADO',
    origen: 'MOSTRADOR',
    pagadoEl: PAGADO_EL,
    total: '111.00',
    moneda: 'BOB',
  },
  requestId: 'rx-1',
  siteId: 'site-1',
  pharmacyId: 'pharmacy-1',
  ...extra,
});

describe('comprobanteDesdePedido', () => {
  it('proyecta el pago del mostrador con las líneas cobradas y el total', () => {
    const papel = comprobanteDesdePedido(pedido());

    expect(papel).not.toBeNull();
    expect(papel?.medioDePago).toBe('Pagado en mostrador');
    expect(papel?.pagadoEl).toBe(PAGADO_EL);
    // La loratadina no estaba disponible: no se preparó ni se cobró.
    expect(papel?.lineas).toHaveLength(2);
    expect(papel?.lineas[0]).toEqual({
      descripcion: 'Amoxicilina · 500 mg · Caja x 21',
      cantidad: 1,
      importe: '60.00',
    });
    // 25.50 × 2: el importe del renglón es precio por cantidad.
    expect(papel?.lineas[1]?.importe).toBe('51.00');
    expect(papel?.total).toBe('111.00');
  });

  it('el pago del QR de la demo se dice sin vueltas', () => {
    const papel = comprobanteDesdePedido(
      pedido({
        pago: {
          estado: 'PAGADO',
          origen: 'QR_DEMO',
          pagadoEl: PAGADO_EL,
          total: '111.00',
          moneda: 'BOB',
        },
      }),
    );
    expect(papel?.medioDePago).toBe('Pago demo — sin valor real');
  });

  it('el papel imprime el total CONGELADO al pagar, no el total vivo del pedido', () => {
    // La farmacia propuso un genérico DESPUÉS del pago y el total vivo bajó:
    // lo cobrado fue 111.00 y eso es lo único que el papel puede decir.
    const papel = comprobanteDesdePedido(pedido({ totalEstimado: '24.00' }));
    expect(papel?.total).toBe('111.00');
  });

  it('sin pago registrado no hay comprobante', () => {
    expect(comprobanteDesdePedido(pedido({ pago: null }))).toBeNull();
    expect(
      comprobanteDesdePedido(
        pedido({
          pago: { estado: 'PENDIENTE', origen: null, pagadoEl: null, total: null, moneda: null },
        }),
      ),
    ).toBeNull();
  });

  it('un renglón sin precio publicado no inventa importe — el vacío tampoco', () => {
    const papel = comprobanteDesdePedido(
      pedido({
        lineas: [
          {
            productId: null,
            medicamento: 'Amoxicilina',
            presentacion: null,
            cantidad: 3,
            precio: null,
            moneda: null,
            disponible: true,
          },
          {
            productId: null,
            medicamento: 'Ibuprofeno',
            presentacion: null,
            cantidad: 2,
            // `Number('  ')` es 0: sin este guard el papel facturaría «0.00».
            precio: '  ',
            moneda: null,
            disponible: true,
          },
        ],
        totalEstimado: null,
        pago: {
          estado: 'PAGADO',
          origen: 'MOSTRADOR',
          pagadoEl: PAGADO_EL,
          total: null,
          moneda: null,
        },
      }),
    );
    expect(papel?.lineas[0]?.importe).toBeNull();
    expect(papel?.lineas[1]?.importe).toBeNull();
    expect(papel?.total).toBeNull();
  });
});

describe('bloquesDeComprobante', () => {
  const papel: DocumentoDeComprobante = {
    id: 'f0e1d2c3-0000-4000-8000-00000000abcd',
    farmacia: 'Farmacia Andina',
    sede: 'Sucursal Centro',
    paciente: 'Ana Pérez',
    pagadoEl: PAGADO_EL,
    medioDePago: 'Pagado en mostrador',
    lineas: [
      { descripcion: 'Amoxicilina · 500 mg', cantidad: 1, importe: '60.00' },
      { descripcion: 'Ibuprofeno', cantidad: 2, importe: null },
    ],
    total: '111.00',
    moneda: 'BOB',
  };

  it('el papel dice qué es, quién, cuándo, con qué medio y cuánto', () => {
    const textos = bloquesDeComprobante(papel).map((bloque) => bloque.text);

    expect(textos[0]).toBe('Comprobante interno de AloVida. No es una factura.');
    expect(textos).toContain('Farmacia: Farmacia Andina — Sucursal Centro');
    expect(textos).toContain('Paciente: Ana Pérez');
    expect(textos).toContain('Medio: Pagado en mostrador');
    expect(textos).toContain('Total: 111.00 BOB');
    // La fecha del pago, en palabras locales — no la de generación.
    expect(textos.some((texto) => texto.startsWith('Pagado el: '))).toBe(true);
  });

  it('cada línea cobrada es una fila, y el precio ausente se dice', () => {
    const filas = bloquesDeComprobante(papel).filter((bloque) => bloque.kind === 'row');
    expect(filas).toHaveLength(2);
    expect(filas[0]?.text).toBe('Amoxicilina · 500 mg\tx1\t60.00');
    expect(filas[1]?.text).toBe('Ibuprofeno\tx2\tPrecio no publicado');
  });

  it('sin total, el vacío honesto — jamás un número a medias', () => {
    const textos = bloquesDeComprobante({ ...papel, total: null }).map((bloque) => bloque.text);
    expect(textos).toContain('Total no disponible: falta algún precio publicado.');
  });

  it('un uuid no se imprime en ninguna parte del papel', () => {
    const todo = bloquesDeComprobante(papel)
      .map((bloque) => bloque.text)
      .join('\n');
    expect(todo).not.toContain(papel.id);
  });
});
