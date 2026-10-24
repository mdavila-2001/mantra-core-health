import { test } from 'vitest';

import type {
  SimulatedInvoice,
  SimulatedIssuer,
  SiatRow,
} from '../../src/app/core/data-access/billing-simulated/billing-simulated.types';
import {
  construirRepresentacionGrafica,
  invoiceQrBlock,
} from '../../src/app/features/billing/representacion-grafica';
import { loadBrandFonts, savePdf, useSampleSignature } from './sample-setup';

/**
 * Las muestras de la representación gráfica de la factura SIMULADA: una corta
 * (dos renglones, una hoja) y una larga (cuarenta renglones), para ver que el
 * QR queda entero al final y que la marca de agua y el pie están en cada hoja.
 *
 * Todo es ficticio: NIT 0000000000, CI 0000000, CUF de relleno, nombres
 * inventados. La firma de muestra se carga a propósito: la factura tiene que
 * salir **sin** ella.
 */

const EMISOR: SimulatedIssuer = {
  id: 'emisor-muestra',
  kind: 'PRACTICE',
  nit: '0000000000',
  legalName: 'Consultorio Médico Illimani S.R.L.',
  municipality: 'La Paz',
  address: 'Av. 6 de Agosto N.º 0000, Sopocachi',
  phone: '2 000 0000',
  branchCode: 0,
  pointOfSaleCode: 0,
  documentSector: 1,
  simulated: true,
};

const SERVICIOS = [
  ['CONSULTA-MEDICA', 'Consulta médica ambulatoria de medicina general', '150.00'],
  ['ECG-12D', 'Electrocardiograma de reposo de 12 derivaciones con informe', '180.00'],
  ['LAB-HEMO', 'Hemograma completo', '70.00'],
  ['LAB-GLU', 'Glucosa en ayunas', '35.00'],
  ['LAB-LIP', 'Perfil lipídico (colesterol total, HDL, LDL, triglicéridos)', '120.00'],
  ['CUR-SIMPLE', 'Curación simple', '60.00'],
  ['INY-IM', 'Aplicación de inyectable intramuscular', '25.00'],
  ['CTRL-PA', 'Control de presión arterial y frecuencia cardíaca', '30.00'],
] as const;

function factura(numero: number, renglones: number, descuentoAdicional: number, giftCard: number): SimulatedInvoice {
  const detalle: SiatRow[] = Array.from({ length: renglones }, (_, i) => {
    const [codigo, descripcion, precio] = SERVICIOS[i % SERVICIOS.length]!;
    const cantidad = 1 + (i % 3);
    const descuento = i % 5 === 4 ? 10 : 0;
    return {
      actividadEconomica: '862010',
      codigoProductoSin: 0,
      codigoProducto: codigo,
      descripcion,
      cantidad: String(cantidad),
      unidadMedida: 58,
      precioUnitario: precio,
      montoDescuento: descuento === 0 ? null : descuento.toFixed(2),
      subTotal: (Number(precio) * cantidad - descuento).toFixed(2),
    };
  });
  const subtotal = detalle.reduce((suma, d) => suma + Number(d['subTotal']), 0);
  const total = subtotal - descuentoAdicional - giftCard;
  const cuf = '0000000000000000000000000000000000000000000000000000MUESTRA';
  return {
    id: `factura-muestra-${numero}`,
    chargeId: `cobro-muestra-${numero}`,
    issuer: EMISOR,
    documentSector: 1,
    modality: 2,
    invoiceNumber: numero,
    cuf,
    cufd: 'CUFD-DE-MUESTRA',
    issuedAt: '2026-10-24T10:32:15.000',
    cabecera: {
      nitEmisor: EMISOR.nit,
      razonSocialEmisor: EMISOR.legalName,
      municipio: EMISOR.municipality,
      telefono: EMISOR.phone,
      numeroFactura: numero,
      cuf,
      codigoSucursal: 0,
      direccion: EMISOR.address,
      codigoPuntoVenta: 0,
      fechaEmision: '2026-10-24T10:32:15.000',
      nombreRazonSocial: 'María Fernanda Quispe Mamani',
      codigoTipoDocumentoIdentidad: 1,
      numeroDocumento: '0000000',
      complemento: null,
      codigoCliente: 'PAC-000123',
      codigoMetodoPago: 1,
      montoTotal: total.toFixed(2),
      montoTotalSujetoIva: total.toFixed(2),
      montoGiftCard: giftCard === 0 ? null : giftCard.toFixed(2),
      descuentoAdicional: descuentoAdicional.toFixed(2),
      codigoMoneda: 1,
      tipoCambio: 1,
      montoTotalMoneda: total.toFixed(2),
      leyenda:
        'Ley N° 453: Tienes derecho a recibir información sobre las características y contenidos de los servicios que utilices.',
      usuario: 'muestra',
      codigoDocumentoSector: 1,
    },
    detalle,
    xml: '<facturaComputarizadaCompraVenta/>',
    hashArchivo: '0'.repeat(64),
    compressedBytes: 0,
    status: 'VALIDATED',
    siatResponse: {
      transaccion: true,
      codigoEstado: 908,
      codigoDescripcion: 'VALIDADA',
      codigoRecepcion: 'RECEPCION-DE-MUESTRA',
      mensajesList: [],
      simulated: true,
    },
    events: [],
    simulated: true,
  };
}

test('factura simulada corta', async () => {
  loadBrandFonts();
  useSampleSignature();
  const f = factura(12, 2, 0, 0);
  console.log(savePdf(construirRepresentacionGrafica(f, await invoiceQrBlock(f)), 'simulated-invoice-short.pdf'));
});

test('factura simulada larga, con descuento y gift card', async () => {
  loadBrandFonts();
  useSampleSignature();
  const f = factura(1043, 40, 50, 100);
  console.log(savePdf(construirRepresentacionGrafica(f, await invoiceQrBlock(f)), 'simulated-invoice-long.pdf'));
});
