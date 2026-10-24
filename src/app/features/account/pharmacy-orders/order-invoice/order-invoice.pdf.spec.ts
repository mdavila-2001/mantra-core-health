import { bloquesDeFactura, invoicePdfOptions } from './order-invoice.pdf';
import { facturaDePrueba } from './order-invoice.spec-fixtures';
import type { DocumentoDeFactura } from './order-invoice.types';

describe('order-invoice pdf', () => {
  const textos = (factura = facturaDePrueba()) => bloquesDeFactura(factura).map((b) => b.text);
  const caja = (factura = facturaDePrueba()) => bloquesDeFactura(factura).find((b) => b.kind === 'totals');

  /** Los datos de cada tarjeta, como «Título › Etiqueta» → valor. */
  const partes = (factura: DocumentoDeFactura = facturaDePrueba()): Record<string, string> =>
    Object.fromEntries(
      (bloquesDeFactura(factura).find((b) => b.kind === 'panels')?.panels ?? []).flatMap((panel) =>
        panel.fields.map((campo) => [`${panel.title} › ${campo.label}`, campo.value]),
      ),
    );

  it('dice que es una factura de ejemplo sin validez fiscal, no un comprobante interno', () => {
    const [aviso] = bloquesDeFactura(facturaDePrueba());
    expect(aviso?.kind).toBe('note');
    expect(aviso?.tone).toBe('alert');
    expect(aviso?.title).toBe('Sin validez fiscal');
    expect(aviso?.text).toContain('Factura de ejemplo');
    expect(aviso?.text).toContain('No reemplaza la factura que emite el comercio.');
    expect(textos().join('\n')).not.toContain('Comprobante interno');
  });

  it('emisor y comprador van en tarjetas lado a lado, con los datos de la factura', () => {
    const tarjetas = bloquesDeFactura(facturaDePrueba()).find((b) => b.kind === 'panels');
    expect(tarjetas?.panels?.map((panel) => panel.title)).toEqual(['Emisor', 'Comprador']);
    expect(partes()).toEqual({
      'Emisor › Razón social': 'Farmacia Andina',
      'Emisor › NIT': '1028394027',
      'Emisor › Comercio': 'Farmacia Andina — Sucursal Centro',
      'Comprador › Nombre': 'Ana Paciente',
      'Comprador › Documento': 'CI 4832915 SC',
    });
    expect(partes(facturaDePrueba({ emisor: { ...facturaDePrueba().emisor, detalle: null } }))['Emisor › Comercio']).toBe(
      'Farmacia Andina',
    );
  });

  it('cada renglón es una fila con cantidad e importe en moneda; el precio ausente se dice', () => {
    const bloques = bloquesDeFactura(facturaDePrueba());
    expect(bloques.find((b) => b.kind === 'row' && b.header === true)?.cells).toEqual([
      'Producto',
      'Cantidad',
      'Importe',
    ]);
    const filas = bloques.filter((b) => b.kind === 'row' && b.header !== true);
    expect(filas.map((fila) => fila.text)).toEqual(['Amoxicilina · 500 mg\t1\t68.00 Bs']);
    expect(bloques.some((b) => b.kind === 'caption')).toBe(false);

    const sinPrecio = bloquesDeFactura(
      facturaDePrueba({ lineas: [{ descripcion: 'Ibuprofeno', cantidad: 2, importe: null }] }),
    );
    expect(sinPrecio.filter((b) => b.kind === 'row' && b.header !== true)[0]?.cells).toEqual(['Ibuprofeno', '2', '—']);
    expect(sinPrecio.find((b) => b.kind === 'caption')?.text).toContain('Precio no publicado');
    expect(sinPrecio.some((b) => b.kind === 'note' && b.tone === 'warning')).toBe(false);
  });

  it('subtotal, descuento con signo menos y total facturado resaltado al final de la caja', () => {
    expect(caja()?.totals).toEqual([
      { label: 'Subtotal', value: '68.00 Bs' },
      // El signo menos tipográfico (U+2212), no el guion.
      { label: 'Descuento red AloVida', value: '\u22126.80 Bs' },
      { label: 'Total facturado', value: '61.20 Bs', emphasis: true },
    ]);
    const todo = textos().join('\n');
    expect(todo).toContain('Descuento red AloVida: \u22126.80 Bs');
    expect(todo).not.toContain('-6.80');
    expect(todo).toContain('Total facturado: 61.20 Bs');
  });

  it('el coaseguro sólo aparece si aplica, en su tarjeta: no suma ni resta en la caja', () => {
    expect(textos().join('\n')).not.toContain('Coaseguro');
    const conSeguro = facturaDePrueba({
      coaseguro: { aseguradora: 'Seguros Bolívar', importe: '13.60', moneda: 'BOB' },
    });
    const tarjetas = bloquesDeFactura(conSeguro).find((b) => b.kind === 'panels');
    expect(tarjetas?.panels?.map((panel) => panel.title)).toEqual(['Emisor', 'Comprador', 'Seguro']);
    expect(partes(conSeguro)).toMatchObject({
      'Seguro › Aseguradora': 'Seguros Bolívar',
      'Seguro › Coaseguro': '13.60 Bs',
    });
    expect(caja(conSeguro)?.totals?.map((fila) => fila.label)).not.toContain('Coaseguro');
    // El total facturado no cambia por el coaseguro.
    expect(caja(conSeguro)?.totals?.at(-1)?.value).toBe('61.20 Bs');
  });

  it('sin total dice el vacío honesto y no imprime el identificador técnico', () => {
    const sinTotal = facturaDePrueba({ subtotal: null, descuentoDeRed: null, total: null });
    const todo = textos(sinTotal).join('\n');
    expect(todo).toContain('Total facturado: No disponible');
    expect(todo).not.toContain('Descuento red AloVida');
    expect(todo).not.toContain('00000000-0000-4000-8000-000000000001');
    // Una sola fila «No disponible», resaltada: sin subtotal, su fila no se imprime.
    expect(caja(sinTotal)?.totals).toEqual([{ label: 'Total facturado', value: 'No disponible', emphasis: true }]);
    const aviso = bloquesDeFactura(sinTotal).find((b) => b.kind === 'note' && b.tone === 'warning');
    expect(aviso?.text).toBe('Falta algún precio publicado: el total no se puede calcular.');
    expect(bloquesDeFactura(facturaDePrueba()).some((b) => b.tone === 'warning')).toBe(false);

    // Si la causa es un renglón sin precio, el aviso lo dice y reemplaza la nota de la tabla.
    const porRenglon = bloquesDeFactura({
      ...sinTotal,
      lineas: [{ descripcion: 'Ibuprofeno', cantidad: 2, importe: null }],
    });
    expect(porRenglon.find((b) => b.kind === 'note' && b.tone === 'warning')?.text).toContain(
      'Precio no publicado por el comercio. Sin ese precio, el total no se puede calcular.',
    );
    expect(porRenglon.some((b) => b.kind === 'caption')).toBe(false);
  });

  it('el número, la fecha y el estado van en la portada y el cuerpo no los repite', () => {
    const factura = facturaDePrueba();
    const opciones = invoicePdfOptions(factura);
    expect(opciones.kind).toBe('Factura de ejemplo');
    expect(opciones.title).toBe('Factura');
    expect(opciones.reference).toBe('N.º 04213377');
    // La fecha de la factura como fecha de emisión, no la de descarga.
    expect(opciones.issuedAt).toBe(factura.emitidaEl);
    // El rótulo del resumen del mostrador (AC-T-E4-07).
    expect(opciones.meta).toEqual([{ label: 'Estado', value: 'Enviada al paciente' }]);
    expect(opciones.subtitle).toBe('Farmacia Andina');

    const todo = textos(factura).join('\n');
    expect(todo).not.toContain('04213377');
    expect(todo).not.toContain('Enviada al paciente');
  });

  it('el emisor del pie es el comercio con sus datos fiscales; sin firma y con marca de agua', () => {
    const opciones = invoicePdfOptions(facturaDePrueba());
    expect(opciones.issuer).toEqual({ name: 'Farmacia Andina', details: ['NIT 1028394027', 'Sucursal Centro'] });
    expect(opciones.firma).toBeNull();
    expect(opciones.watermark).toBe('Sin validez fiscal');
    expect(opciones.footerNote).toContain('Sin validez fiscal');

    const otroNombre = invoicePdfOptions(
      facturaDePrueba({
        emisor: { nombre: 'Farmacia Andina', detalle: null, razonSocial: 'Andina Salud S.R.L.', nit: '1028394027' },
      }),
    );
    expect(otroNombre.issuer).toEqual({ name: 'Andina Salud S.R.L.', details: ['NIT 1028394027', 'Farmacia Andina'] });
    expect(JSON.stringify(otroNombre)).not.toContain('00000000-0000-4000-8000-000000000001');
  });
});
