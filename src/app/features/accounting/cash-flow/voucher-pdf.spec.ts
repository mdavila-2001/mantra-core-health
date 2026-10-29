import type {
  JournalTransactionDetail,
  LedgerAccount,
} from '../../../core/data-access/accounting/accounting.types';
import { bloquesDelComprobante } from './voucher-pdf';

const CUENTAS: readonly LedgerAccount[] = [
  {
    id: 'c-caja',
    code: '1.1',
    name: 'Caja',
    accountTypeConceptId: 't',
    normalBalanceConceptId: 'd',
  },
  {
    id: 'c-cons',
    code: '4.1',
    name: 'Consultas',
    accountTypeConceptId: 't',
    normalBalanceConceptId: 'a',
  },
];

const COMPROBANTE: JournalTransactionDetail = {
  id: 'j-1',
  practiceId: 'p-1',
  transactionNumber: 'AS-2026-01025',
  transactionDate: new Date(2026, 9, 17),
  statusConceptId: 'st',
  status: 'POSTED',
  totalAmount: '1450.00',
  description: 'Consultas del día (efectivo)',
  lines: [
    {
      id: 'l-2',
      lineNo: 2,
      accountId: 'c-cons',
      directionConceptId: 'haber',
      amountBase: '1450.00',
    },
    {
      id: 'l-1',
      lineNo: 1,
      accountId: 'c-caja',
      directionConceptId: 'debe',
      amountBase: '1450.00',
    },
  ],
};

describe('bloquesDelComprobante', () => {
  const textos = () => bloquesDelComprobante(COMPROBANTE, CUENTAS).map((b) => b.text);

  it('dice número, concepto, estado y total', () => {
    const todo = textos().join('\n');
    expect(todo).toContain('AS-2026-01025');
    expect(todo).toContain('Consultas del día (efectivo)');
    expect(todo).toContain('Registrado');
    expect(todo).toContain('Total: Bs 1 450,00');
  });

  it('pone la línea 1 en el debe y la otra en el haber, con el nombre de la cuenta', () => {
    const filas = bloquesDelComprobante(COMPROBANTE, CUENTAS).filter(
      (b) => b.kind === 'row' && !b.header,
    );
    expect(filas.map((f) => f.cells)).toEqual([
      ['1.1 · Caja', 'Bs 1 450,00', ''],
      ['4.1 · Consultas', '', 'Bs 1 450,00'],
    ]);
  });

  it('sin concepto lo dice, en vez de dejar el renglón vacío', () => {
    const sinConcepto = bloquesDelComprobante({ ...COMPROBANTE, description: undefined }, CUENTAS);
    expect(sinConcepto.map((b) => b.text).join('\n')).toContain('Sin concepto');
  });
});
