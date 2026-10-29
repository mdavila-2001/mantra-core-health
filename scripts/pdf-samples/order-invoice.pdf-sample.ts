import { afterEach, beforeEach, test, vi } from 'vitest';

import { buildInvoicePdf } from '../../src/app/features/account/pharmacy-orders/order-invoice/order-invoice.pdf';
import type {
  DocumentoDeFactura,
  LineaDeFactura,
} from '../../src/app/features/account/pharmacy-orders/order-invoice/order-invoice.types';
import { loadBrandFonts, SAMPLE_DATE, savePdf, useSampleSignature } from './sample-setup';

/**
 * Las muestras de la factura de ejemplo de un pedido de farmacia: una corta,
 * de una hoja, y una larga, con muchos renglones que cruzan de hoja, una razón
 * social distinta del nombre comercial y coaseguro. Todos los datos son
 * ficticios.
 *
 * La firma de muestra se carga a propósito: la factura la tiene que rechazar
 * (`firma: null`), y la muestra deja ver que no aparece.
 */

/** Centavos enteros a texto exacto, como lo arma `order-invoice.fixtures.ts`. */
const money = (cents: number): string => (cents / 100).toFixed(2);

const SHORT_LINES: readonly LineaDeFactura[] = [
  { descripcion: 'Amoxicilina · 500 mg · Caja x 21', cantidad: 1, importe: '68.00' },
  { descripcion: 'Paracetamol · 500 mg · Caja x 20', cantidad: 2, importe: '24.00' },
];

const SHORT: DocumentoDeFactura = {
  id: '00000000-0000-4000-8000-000000000301',
  numero: '00000123',
  emitidaEl: new Date(2026, 9, 23, 16, 5),
  estado: 'Enviada al paciente',
  emisor: {
    nombre: 'Farmacia Ficticia Illimani',
    detalle: 'Sucursal Sopocachi',
    razonSocial: 'Farmacia Ficticia Illimani',
    nit: '0000000000',
  },
  comprador: { nombre: 'María Fernanda Quispe Mamani', documento: 'CI 0000000 LP' },
  lineas: SHORT_LINES,
  subtotal: '92.00',
  descuentoDeRed: '9.20',
  coaseguro: null,
  total: '82.80',
  moneda: 'BOB',
};

const PRODUCTS = [
  'Losartán potásico · 50 mg · Caja x 30',
  'Metformina clorhidrato · 850 mg · Caja x 60 comprimidos recubiertos',
  'Omeprazol · 20 mg · Caja x 14 cápsulas',
  'Salbutamol · Inhalador 100 mcg/dosis · 200 dosis',
  'Vitamina D3 · 1000 UI · Frasco x 60 cápsulas blandas',
  'Atorvastatina · 20 mg · Caja x 30',
  'Insulina glargina · 100 UI/ml · Lapicera prellenada x 3 ml',
];

const LONG_CENTS = Array.from({ length: 33 }, (_, i) => (1800 + ((i * 2900) % 14000)) * (1 + (i % 3)));
const LONG_SUBTOTAL = LONG_CENTS.reduce((sum, cents) => sum + cents, 0);
const LONG_DISCOUNT = Math.round((LONG_SUBTOTAL * 10) / 100);

const LONG: DocumentoDeFactura = {
  id: '00000000-0000-4000-8000-000000000302',
  numero: '00004812',
  emitidaEl: SAMPLE_DATE,
  estado: 'Enviada al paciente',
  emisor: {
    nombre: 'Farmacia Ficticia del Valle',
    detalle: 'Sucursal Avenida América Oeste, Cochabamba',
    razonSocial: 'Distribuidora Farmacéutica Ficticia del Valle S.R.L.',
    nit: '0000000000',
  },
  comprador: { nombre: 'Juan Carlos Mamani Choque de la Fuente', documento: 'CI 0000000 CB' },
  lineas: LONG_CENTS.map((cents, i) => ({
    descripcion: PRODUCTS[i % PRODUCTS.length],
    cantidad: 1 + (i % 3),
    importe: money(cents),
  })),
  subtotal: money(LONG_SUBTOTAL),
  descuentoDeRed: money(LONG_DISCOUNT),
  coaseguro: { aseguradora: 'Aseguradora Ficticia Andina', importe: '412.60', moneda: 'BOB' },
  total: money(LONG_SUBTOTAL - LONG_DISCOUNT),
  moneda: 'BOB',
};

/** Un reloj fijo, posterior a todos los eventos de las muestras: la portada y el pie salen iguales en cada corrida. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 24, 18, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

test('muestra de la factura corta', () => {
  loadBrandFonts();
  useSampleSignature();
  console.log(savePdf(buildInvoicePdf(SHORT), 'order-invoice-short-sample.pdf'));
});

test('muestra de la factura larga', () => {
  loadBrandFonts();
  useSampleSignature();
  console.log(savePdf(buildInvoicePdf(LONG), 'order-invoice-long-sample.pdf'));
});

test('muestra de la factura sin total', () => {
  loadBrandFonts();
  console.log(
    savePdf(
      buildInvoicePdf({
        ...SHORT,
        lineas: [...SHORT_LINES, { descripcion: 'Alcohol en gel · 250 ml', cantidad: 1, importe: null }],
        subtotal: null,
        descuentoDeRed: null,
        total: null,
      }),
      'order-invoice-no-total-sample.pdf',
    ),
  );
});
