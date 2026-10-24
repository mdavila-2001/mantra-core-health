import { afterEach, beforeEach, test, vi } from 'vitest';

import { buildQuotationPdf, type QuotationPdfData } from '../../src/app/shared/utils/quotation-pdf/quotation-pdf';
import { loadBrandFonts, savePdf, useSampleSignature } from './sample-setup';

/**
 * Las muestras de la cotización: una corta, de contado con anticipo, y una
 * larga, con un plan semanal de muchas cuotas que cruza de hoja. Todos los
 * datos son ficticios.
 *
 * La firma de muestra se carga a propósito: la cotización la tiene que
 * rechazar (`firma: null`), y la muestra deja ver que no aparece.
 */

const SHORT: QuotationPdfData = {
  patientName: 'María Fernanda Quispe Mamani',
  serviceName: 'Limpieza dental profunda con fluorización',
  offeredPrice: 450,
  downPaymentAmount: 450,
  paymentFrequency: 'MONTHLY',
  attentionDate: '2026-11-03',
  validUntil: '2026-11-23',
  installments: [],
};

/** Fechas ISO a partir de un día, cada `step` días. */
function dueDate(start: Date, index: number, step: number): string {
  const date = new Date(start.getTime());
  date.setDate(date.getDate() + index * step);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join(
    '-',
  );
}

const LONG_COUNT = 32;
const LONG: QuotationPdfData = {
  patientName: 'Juan Carlos Mamani Choque de la Fuente',
  serviceName: 'Tratamiento integral de ortodoncia con brackets autoligables, controles y retenedores',
  offeredPrice: 12_600,
  downPaymentAmount: 2_600,
  paymentFrequency: 'WEEKLY',
  attentionDate: '2026-11-09',
  validUntil: '2026-11-30',
  installments: Array.from({ length: LONG_COUNT }, (_, i) => ({
    installmentNumber: i + 1,
    dueDate: dueDate(new Date(2026, 10, 16), i, 7),
    // 32 cuotas de 312,50: el saldo exacto de 10 000 tras el anticipo.
    amount: 312.5,
  })),
};

/** Un reloj fijo, posterior a todos los eventos de las muestras: la portada y el pie salen iguales en cada corrida. */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 24, 18, 0));
});

afterEach(() => {
  vi.useRealTimers();
});

test('muestra de la cotización corta', () => {
  loadBrandFonts();
  useSampleSignature();
  console.log(savePdf(buildQuotationPdf(SHORT), 'quotation-short-sample.pdf'));
});

test('muestra de la cotización larga', () => {
  loadBrandFonts();
  useSampleSignature();
  console.log(savePdf(buildQuotationPdf(LONG), 'quotation-long-sample.pdf'));
});

test('muestra de la cotización sin vigencia ni anticipo', () => {
  loadBrandFonts();
  console.log(
    savePdf(
      buildQuotationPdf({
        ...LONG,
        patientName: 'Rosa Elena Condori Vargas',
        serviceName: 'Implante dental unitario',
        installments: Array.from({ length: 4 }, (_, i) => ({
          installmentNumber: i + 1,
          dueDate: dueDate(new Date(2026, 10, 16), i, 30),
          amount: 250,
        })),
        paymentFrequency: 'MONTHLY',
        downPaymentAmount: 0,
        offeredPrice: 1000,
        validUntil: '',
      }),
      'quotation-no-validity-sample.pdf',
    ),
  );
});
