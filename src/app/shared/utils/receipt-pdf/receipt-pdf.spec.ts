import type { PedidoFarmacia } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { receiptFromOrder } from './from-order';
import { bloquesDeComprobante, receiptPdfOptions } from './receipt-pdf';
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
    const papel = receiptFromOrder(pedido());

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
    const papel = receiptFromOrder(
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
    const papel = receiptFromOrder(pedido({ totalEstimado: '24.00' }));
    expect(papel?.total).toBe('111.00');
  });

  it('sin pago registrado no hay comprobante', () => {
    expect(receiptFromOrder(pedido({ pago: null }))).toBeNull();
    expect(
      receiptFromOrder(
        pedido({
          pago: { estado: 'PENDIENTE', origen: null, pagadoEl: null, total: null, moneda: null },
        }),
      ),
    ).toBeNull();
  });

  it('un renglón sin precio publicado no inventa importe — el vacío tampoco', () => {
    const papel = receiptFromOrder(
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

  /** Los datos de cada tarjeta de partes, como «Título › Etiqueta» → valor. */
  const partes = (comprobante: DocumentoDeComprobante): Record<string, string> => {
    const bloque = bloquesDeComprobante(comprobante).find((b) => b.kind === 'panels');
    return Object.fromEntries(
      (bloque?.panels ?? []).flatMap((panel) =>
        panel.fields.map((campo) => [`${panel.title} › ${campo.label}`, campo.value]),
      ),
    );
  };

  it('abre diciendo qué es y qué no es: un aviso con título, antes que cualquier dato', () => {
    const [aviso] = bloquesDeComprobante(papel);

    expect(aviso?.kind).toBe('note');
    expect(aviso?.tone).toBe('brand');
    expect(aviso?.title).toBe('No es una factura');
    expect(aviso?.text).toBe(
      'Comprobante interno de AloVida que acredita el pago del pedido. La factura la emite la farmacia.',
    );
  });

  it('«no es una factura» se dice una sola vez en el cuerpo: el pie lo repite en cada hoja', () => {
    const todo = bloquesDeComprobante(papel)
      .map((bloque) => [bloque.title ?? '', bloque.text].join('\n'))
      .join('\n');
    expect(todo.match(/no es una factura/gi)).toHaveLength(1);
  });

  it('el papel dice quién, cuándo y con qué medio, en tarjetas lado a lado', () => {
    const tarjetas = bloquesDeComprobante(papel).find((b) => b.kind === 'panels');
    expect(tarjetas?.panels?.map((panel) => panel.title)).toEqual(['Farmacia', 'Paciente', 'Pago']);

    expect(partes(papel)).toEqual({
      'Farmacia › Nombre': 'Farmacia Andina',
      'Farmacia › Sede': 'Sucursal Centro',
      'Paciente › Nombre': 'Ana Pérez',
      // La fecha del pago —no la de generación—, en `dd/mm/aaaa, hh:mm` de 24 h.
      'Pago › Pagado el': '21/08/2026, 18:30',
      'Pago › Canal de pago': 'Pagado en mostrador',
    });
  });

  it('sin paciente no hay tarjeta del paciente; un dato vacío se dice, no queda un hueco', () => {
    const sinPaciente = { ...papel, paciente: null, sede: '  ' };
    const tarjetas = bloquesDeComprobante(sinPaciente).find((b) => b.kind === 'panels');

    expect(tarjetas?.panels?.map((panel) => panel.title)).toEqual(['Farmacia', 'Pago']);
    expect(partes(sinPaciente)['Farmacia › Sede']).toBe('No registrado');
    expect(partes({ ...papel, paciente: '   ' })['Paciente › Nombre']).toBeUndefined();
  });

  it('cada línea cobrada es una fila con su importe en formato boliviano, y el precio ausente se dice', () => {
    const bloques = bloquesDeComprobante(papel);
    const cabecera = bloques.find((bloque) => bloque.kind === 'row' && bloque.header === true);
    expect(cabecera?.cells).toEqual(['Producto', 'Cantidad', 'Importe']);

    // La fila de encabezado también es `row` —la dibuja el mismo maquetador de
    // tablas—, así que se descarta: lo que se cuenta acá son los renglones
    // cobrados, y una cabecera de más no es un cobro de más.
    const filas = bloques.filter((bloque) => bloque.kind === 'row' && bloque.header !== true);
    expect(filas).toHaveLength(2);
    // La cantidad va sola —es un número y se alinea a la derecha—, y el
    // importe lleva la moneda visible.
    expect(filas[0]?.cells).toEqual(['Amoxicilina · 500 mg', '1', '60,00 Bs']);
    expect(filas[0]?.text).toBe('Amoxicilina · 500 mg\t1\t60,00 Bs');
    // Sin precio, una raya en la columna —para no desalinear los importes—
    // y la explicación en letra chica debajo de la tabla.
    expect(filas[1]?.cells).toEqual(['Ibuprofeno', '2', '—']);
    const nota = bloques.find((bloque) => bloque.kind === 'caption');
    expect(nota?.text).toBe(
      '— Precio no publicado por la farmacia: el producto no tiene importe propio en el detalle.',
    );
    expect(bloques.indexOf(nota!)).toBeGreaterThan(bloques.indexOf(filas[1]!));
  });

  it('con todos los precios publicados no hay nota de precio ausente', () => {
    const completo = {
      ...papel,
      lineas: [{ descripcion: 'Amoxicilina · 500 mg', cantidad: 1, importe: '60.00' }],
    };
    expect(bloquesDeComprobante(completo).some((bloque) => bloque.kind === 'caption')).toBe(false);
  });

  it('el total pagado va en la caja de totales, resaltado y pegado a la última fila', () => {
    const bloques = bloquesDeComprobante(papel);
    const caja = bloques.find((bloque) => bloque.kind === 'totals');
    // Inmediatamente después de la última fila: así el motor los pasa de hoja juntos.
    const ultimaFila = bloques.filter((bloque) => bloque.kind === 'row').at(-1);
    expect(bloques.indexOf(caja!)).toBe(bloques.indexOf(ultimaFila!) + 1);

    expect(caja?.totals).toEqual([{ label: 'Total pagado', value: '111,00 Bs', emphasis: true }]);
    expect(caja?.text).toBe('Total pagado: 111,00 Bs');
    // Separador de miles con punto y decimales con coma.
    expect(bloquesDeComprobante({ ...papel, total: '6348.00' }).find((b) => b.kind === 'totals')?.totals?.[0]?.value).toBe(
      '6.348,00 Bs',
    );
    // Una moneda que no es el boliviano se muestra con su código, no como «Bs».
    expect(bloquesDeComprobante({ ...papel, moneda: 'USD' }).find((b) => b.kind === 'totals')?.totals?.[0]?.value).toBe(
      '111,00 USD',
    );
    // Con todos los precios, la caja cierra el papel.
    const completo = bloquesDeComprobante({ ...papel, lineas: [papel.lineas[0]!] });
    expect(completo.at(-1)?.kind).toBe('totals');
  });

  it('sin total, el vacío honesto — jamás un número a medias', () => {
    const bloques = bloquesDeComprobante({ ...papel, total: null });
    const aviso = bloques.find((bloque) => bloque.text === 'Total no disponible: falta algún precio publicado.');

    expect(aviso?.kind).toBe('note');
    expect(aviso?.tone).toBe('warning');
    expect(bloques.some((bloque) => bloque.kind === 'totals' || bloque.kind === 'total')).toBe(false);
  });

  it('un uuid no se imprime en ninguna parte del papel', () => {
    const todo = bloquesDeComprobante(papel)
      .map((bloque) => bloque.text)
      .join('\n');
    expect(todo).not.toContain(papel.id);
    expect(JSON.stringify(receiptPdfOptions(papel))).not.toContain(papel.id);
  });
});

describe('receiptPdfOptions', () => {
  const papel: DocumentoDeComprobante = {
    id: 'f0e1d2c3-0000-4000-8000-00000000abcd',
    farmacia: 'Farmacia Andina',
    sede: 'Sucursal Centro',
    paciente: 'Ana Pérez',
    pagadoEl: PAGADO_EL,
    medioDePago: 'Pagado en mostrador',
    lineas: [],
    total: '111.00',
    moneda: 'BOB',
  };

  it('la portada dice la clase, el título y de qué farmacia es', () => {
    const opciones = receiptPdfOptions(papel);
    expect(opciones.kind).toBe('Comprobante interno');
    expect(opciones.title).toBe('Comprobante de pago');
    expect(opciones.subtitle).toBe('Pedido de farmacia · Farmacia Andina');
  });

  it('no firma un médico, y el pie repite en cada hoja que no es una factura', () => {
    const opciones = receiptPdfOptions(papel);
    expect(opciones.firma).toBeNull();
    expect(opciones.footerNote).toContain('No válido como factura');
  });

  it('no imprime un folio que el dato no trae: ni el uuid ni el código de retiro', () => {
    expect(receiptPdfOptions(papel).reference).toBeUndefined();
  });

  it('no presenta la fecha del pago como fecha de emisión: la portada rotula la de generación', () => {
    // El comprobante no tiene fecha de emisión propia: sin `issuedAt`, el
    // motor dice «Fecha de generación». La del pago va en la tarjeta del pago.
    expect(receiptPdfOptions(papel).issuedAt).toBeUndefined();
  });
});
