import { afterEach, beforeEach, test, vi } from 'vitest';

import { buildReceiptPdf } from '../../src/app/shared/utils/receipt-pdf/receipt-pdf';
import type { DocumentoDeComprobante } from '../../src/app/shared/utils/receipt-pdf/receipt-pdf.types';
import { loadBrandFonts, SAMPLE_DATE, savePdf, useSampleSignature } from './sample-setup';

/**
 * Las muestras del comprobante interno de pago de un pedido de farmacia: uno
 * corto, de una hoja, y uno largo, con tantos renglones que la tabla cruza de
 * hoja y un renglón sin precio publicado. Todos los datos son ficticios.
 *
 * La firma de muestra se carga a propósito: el comprobante la tiene que
 * rechazar (`firma: null`), y la muestra deja ver que no aparece.
 */

const SHORT: DocumentoDeComprobante = {
  id: '00000000-0000-4000-8000-000000000101',
  farmacia: 'Farmacia Ficticia Illimani',
  sede: 'Sucursal Sopocachi',
  paciente: 'María Fernanda Quispe Mamani',
  pagadoEl: new Date(2026, 9, 22, 18, 30),
  medioDePago: 'Pagado en mostrador',
  lineas: [
    { descripcion: 'Amoxicilina · 500 mg · Caja x 21', cantidad: 1, importe: '60.00' },
    { descripcion: 'Ibuprofeno · 400 mg · Caja x 10', cantidad: 2, importe: '51.00' },
    { descripcion: 'Suero oral · Sobre x 27,9 g', cantidad: 3, importe: '22.50' },
  ],
  total: '133.50',
  moneda: 'BOB',
};

const PRODUCTS = [
  'Paracetamol · 500 mg · Caja x 20',
  'Losartán potásico · 50 mg · Caja x 30',
  'Metformina clorhidrato · 850 mg · Caja x 60 comprimidos recubiertos',
  'Omeprazol · 20 mg · Caja x 14 cápsulas',
  'Salbutamol · Inhalador 100 mcg/dosis · 200 dosis',
  'Vitamina D3 · 1000 UI · Frasco x 60 cápsulas blandas',
  'Atorvastatina · 20 mg · Caja x 30',
  'Clorfenamina · Jarabe 2 mg/5 ml · Frasco x 120 ml',
];

const LONG_LINES = Array.from({ length: 38 }, (_, i) => {
  const unit = 12 + ((i * 29) % 140);
  const qty = 1 + (i % 4);
  return {
    descripcion: PRODUCTS[i % PRODUCTS.length],
    cantidad: qty,
    importe: i === 17 ? null : (unit * qty).toFixed(2),
  };
});

const LONG: DocumentoDeComprobante = {
  id: '00000000-0000-4000-8000-000000000202',
  farmacia: 'Farmacia Ficticia del Valle Central de Cochabamba',
  sede: 'Sucursal Avenida América Oeste, frente a la plaza principal',
  paciente: 'Juan Carlos Mamani Choque de la Fuente',
  pagadoEl: SAMPLE_DATE,
  medioDePago: 'Pago demo — sin valor real',
  lineas: LONG_LINES,
  // Lo congelado al pagar: el renglón sin precio no entra en la suma.
  total: LONG_LINES.reduce((sum, line) => sum + Number(line.importe ?? 0), 0).toFixed(2),
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

test('muestra del comprobante corto', () => {
  loadBrandFonts();
  useSampleSignature();
  console.log(savePdf(buildReceiptPdf(SHORT), 'receipt-short-sample.pdf'));
});

test('muestra del comprobante largo', () => {
  loadBrandFonts();
  useSampleSignature();
  console.log(savePdf(buildReceiptPdf(LONG), 'receipt-long-sample.pdf'));
});

test('muestra del comprobante sin paciente ni total', () => {
  loadBrandFonts();
  console.log(
    savePdf(
      buildReceiptPdf({
        ...SHORT,
        paciente: null,
        total: null,
        lineas: [...SHORT.lineas, { descripcion: 'Alcohol en gel · 250 ml', cantidad: 1, importe: null }],
      }),
      'receipt-no-total-sample.pdf',
    ),
  );
});
