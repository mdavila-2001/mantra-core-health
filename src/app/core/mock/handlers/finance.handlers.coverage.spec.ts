import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';

describe('contabilidad demo: saldos y transiciones', () => {
  const keys = [
    'mock.finance.asientos', 'mock.finance.cotizaciones', 'mock.finance.activos',
    'mock.finance.pasivos', 'mock.finance.periodos', 'mock.finance.partidasAbiertas',
    'mock.finance.devengos',
  ];
  const previous = new Map<string, string | null>();
  const router = new MockRouter();
  const user = buscarUsuario('medica')!;

  beforeAll(async () => {
    for (const key of keys) {
      previous.set(key, sessionStorage.getItem(key));
      sessionStorage.removeItem(key);
    }
    vi.resetModules();
    const { registrarFinanzas } = await import('./finance.handlers');
    registrarFinanzas(router);
  });

  afterAll(() => {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === null || value === undefined) sessionStorage.removeItem(key);
      else sessionStorage.setItem(key, value);
    }
    vi.resetModules();
  });

  function request(method: MockMethod, path: string, body: unknown = {}, query = new URLSearchParams()) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method, path, params: match.params, body, query, headers: new HttpHeaders(), user,
    } satisfies MockRequest);
  }

  const status = (response: unknown) => isMockReply(response) ? response.status : 200;
  const data = <T>(response: unknown) => (isMockReply(response) ? response.body : response) as T;

  it('no incorpora un borrador al balance hasta postearlo y revierte con documento espejo', () => {
    const accounts = data<{ items: { id: string; code: string }[] }>(request('GET', '/accounting/accounts'));
    const debitAccount = accounts.items.find((account) => account.code === '1.1')!.id;
    const creditAccount = accounts.items.find((account) => account.code === '4.1')!.id;
    const balance = () => data<{ items: { balance: string }[]; totalDebit: string; totalCredit: string; balanced: boolean }>(request('GET', '/accounting/trial-balance'));
    const before = balance();
    expect(before.balanced).toBe(true);
    const journal = {
      transactionDate: '2026-10-01', description: 'Consulta sintética',
      lines: [
        { accountId: debitAccount, direction: 'DEBIT', amount: '12.34' },
        { accountId: creditAccount, direction: 'CREDIT', amount: '12.34' },
      ],
    };
    const unbalanced = { ...journal, lines: [journal.lines[0], { ...journal.lines[1], amount: '12.33' }] };
    expect(status(request('POST', '/accounting/journal-transactions', unbalanced))).toBe(422);
    expect(balance()).toEqual(before);

    const draft = data<{ id: string; status: string; totalAmount: string }>(
      request('POST', '/accounting/journal-transactions/drafts', journal),
    );
    expect(draft).toMatchObject({ status: 'DRAFT', totalAmount: '12.34' });
    const path = `/accounting/journal-transactions/${draft.id}`;
    expect(status(request('POST', `${path}/post`))).toBe(422);
    expect(balance()).toEqual(before);
    for (const [action, expected] of [
      ['classify', 'AUTO_CLASSIFIED'], ['submit-review', 'PENDING_REVIEW'],
      ['approve', 'APPROVED'], ['post', 'POSTED'],
    ]) {
      expect(data<{ status: string }>(request('POST', `${path}/${action}`)).status).toBe(expected);
    }
    const posted = balance();
    expect(Number(posted.totalDebit) - Number(before.totalDebit)).toBeCloseTo(12.34, 2);
    expect(Number(posted.totalCredit) - Number(before.totalCredit)).toBeCloseTo(12.34, 2);
    expect(posted.balanced).toBe(true);
    expect(status(request('POST', `${path}/post`))).toBe(422);

    const reversal = data<{ id: string; reversalOf: string }>(request('POST', `${path}/reverse`));
    expect(reversal.reversalOf).toBe(draft.id);
    expect(status(request('POST', `${path}/reverse`))).toBe(422);
    expect(data<{ items: { role: string; id: string }[] }>(request('GET', `${path}/document-flow`)).items)
      .toEqual(expect.arrayContaining([expect.objectContaining({ role: 'REVERSION', id: reversal.id })]));
    expect(data<{ items: { role: string }[] }>(request('GET', `/accounting/journal-transactions/${reversal.id}/document-flow`)).items)
      .toEqual(expect.arrayContaining([expect.objectContaining({ role: 'ORIGEN' })]));
    const reversed = balance();
    expect(reversed.balanced).toBe(true);
    expect(reversed.items.map((item) => item.balance)).toEqual(before.items.map((item) => item.balance));
    expect(Number(reversed.totalDebit) - Number(before.totalDebit)).toBeCloseTo(24.68, 2);
    expect(Number(reversed.totalCredit) - Number(before.totalCredit)).toBeCloseTo(24.68, 2);
  });

  it('compensa partidas abiertas sin volver a cobrarlas y controla cierre del periodo', () => {
    const open = data<{ items: { id: string; side: string; openAmount: string }[]; totalReceivable: string }>(
      request('GET', '/accounting/open-items'),
    );
    const receivable = open.items.find((item) => item.side === 'RECEIVABLE')!;
    expect(Number(receivable.openAmount)).toBeGreaterThan(0);
    const compensar = (items: { openItemId: string; clearedAmount: string }[]) =>
      request('POST', '/accounting/clearing-documents', {
        practiceId: 'p',
        bankAccountId: 'banco',
        clearingDate: '2026-10-09',
        items,
      });
    expect(status(compensar([{ openItemId: 'inexistente', clearedAmount: '1.00' }]))).toBe(404);
    expect(status(compensar([]))).toBe(422);
    // Más de lo pendiente es 422, igual que `SubledgerService.clearOpenItems`.
    expect(
      status(compensar([{ openItemId: receivable.id, clearedAmount: String(Number(receivable.openAmount) + 1) }])),
    ).toBe(422);
    const cleared = data<{ id: string; clearingNumber: string; clearedItems: number }>(
      compensar([{ openItemId: receivable.id, clearedAmount: receivable.openAmount }]),
    );
    expect(cleared.clearedItems).toBe(1);
    expect(cleared.clearingNumber).toMatch(/^CLR-/);
    const after = data<{ items: { id: string }[]; totalReceivable: string }>(request('GET', '/accounting/open-items'));
    expect(after.items.some((item) => item.id === receivable.id)).toBe(false);
    expect(Number(open.totalReceivable) - Number(after.totalReceivable)).toBeCloseTo(Number(receivable.openAmount), 2);
    expect(data<{ items: { side: string }[] }>(request('GET', '/accounting/open-items', {}, new URLSearchParams({ side: 'PAYABLE' }))).items)
      .toEqual(expect.arrayContaining([expect.objectContaining({ side: 'PAYABLE' })]));

    const years = data<{ periods: { id: string; status: string }[] }>(request('GET', '/accounting/fiscal-years'));
    const closed = years.periods.find((period) => period.status === 'CLOSED')!;
    const opened = years.periods.find((period) => period.status === 'OPEN')!;
    expect(status(request('POST', '/accounting/fiscal-periods/missing/lock'))).toBe(404);
    expect(status(request('POST', `/accounting/fiscal-periods/${closed.id}/lock`))).toBe(422);
    expect(status(request('POST', `/accounting/fiscal-periods/${opened.id}/lock`))).toBe(422);
    expect(data<{ items: { code: string }[] }>(request('GET', '/accounting/dimensions')).items)
      .toEqual(expect.arrayContaining([expect.objectContaining({ code: 'PC-10' })]));
  });

  it('preserva centavos en cotizaciones y no permite pagar un pasivo saldado', () => {
    const listed = data<{ id: string }[]>(request('GET', '/quotations'));
    const sample = data<{ serviceCatalogId: string; patientProfileId: string }>(
      request('GET', `/quotations/${listed[0]!.id}`),
    );
    const quote = {
      serviceCatalogId: sample.serviceCatalogId, patientProfileId: sample.patientProfileId,
      appointmentId: 'appointment-synthetic',
      attentionDate: '2026-10-01', offeredPrice: 100.01, downPaymentAmount: 0,
      installments: [
        { installmentNumber: 1, dueDate: '2026-11-01', amount: 50.01 },
        { installmentNumber: 2, dueDate: '2026-12-01', amount: 50.00 },
      ],
    };
    expect(status(request('POST', '/quotations', { ...quote, installments: [{ ...quote.installments[0], amount: 50.00 }, quote.installments[1]] }))).toBe(400);
    expect(status(request('POST', '/quotations', { ...quote, serviceCatalogId: 'missing' }))).toBe(404);
    const created = data<{ id: string; appointmentId?: string; installments: { amount: number }[]; offeredPrice: number }>(
      request('POST', '/quotations', quote),
    );
    expect(created.appointmentId).toBe('appointment-synthetic');
    expect(created.installments.reduce((sum, item) => sum + Math.round(item.amount * 100), 0)).toBe(10001);
    expect(data<{ offeredPrice: number }>(request('GET', `/quotations/${created.id}`)).offeredPrice).toBe(100.01);
    expect(data<{ id: string }[]>(request('GET', '/quotations', {}, new URLSearchParams({ patientProfileId: sample.patientProfileId }))))
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: created.id })]));
    const flexible = data<{ installments: { installmentNumber: number; amount: number }[] }>(request('POST', '/quotations', {
      serviceCatalogId: sample.serviceCatalogId, patientProfileId: 'unknown-patient', offeredPrice: 100,
      downPaymentAmount: 10, paymentPlanInstallmentCount: 3, attentionDate: '2026-10-01',
    }));
    expect(flexible.installments.map((row) => row.amount)).toEqual([30, 30, 30]);
    expect(flexible.installments.map((row) => row.installmentNumber)).toEqual([1, 2, 3]);
    expect(data<{ patientName: string | null }[]>(request('GET', '/quotations', {}, new URLSearchParams({ patientProfileId: 'unknown-patient' })))
      .find((item) => item.patientName === null)).toBeDefined();
    const defaulted = data<{ patientProfileId: string; attentionDate: string; paymentPlanInstallmentCount: number; installments: { amount: number }[] }>(
      request('POST', '/quotations', { serviceCatalogId: sample.serviceCatalogId }),
    );
    expect(defaulted.patientProfileId).toBe('');
    expect(defaulted.attentionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(defaulted.paymentPlanInstallmentCount).toBe(1);
    expect(defaulted.installments).toHaveLength(1);

    const liability = data<{ id: string; schedule: { principalDue: string }[] }>(
      request('POST', '/accounting/practitioner/liabilities', {
        code: 'PR-TEST', name: 'Pasivo sintético', principalAmount: '10.00',
        installments: 2, interestRate: '0', startDate: '2026-10-01',
      }),
    );
    expect(liability.schedule.map((row) => row.principalDue)).toEqual(['5.00', '5.00']);
    const liabilityPath = `/accounting/practitioner/liabilities/${liability.id}`;
    expect(data<{ installmentNumber: number; amount: string }>(request('POST', `${liabilityPath}/progress`)))
      .toMatchObject({ installmentNumber: 1, amount: '5.00' });
    expect(data<{ installmentNumber: number; amount: string }>(request('POST', `${liabilityPath}/progress`)))
      .toMatchObject({ installmentNumber: 2, amount: '5.00' });
    expect(status(request('POST', `${liabilityPath}/progress`))).toBe(422);
    expect(data<{ id: string; outstandingAmount: string }[]>(request('GET', '/accounting/practitioner/liabilities'))
      .find((item) => item.id === liability.id)?.outstandingAmount).toBe('0.00');
    expect(status(request('POST', '/accounting/practitioner/liabilities/missing/progress'))).toBe(404);
    const interestBearing = data<{ schedule: { interestDue: string; dueDate: string }[] }>(
      request('POST', '/accounting/practitioner/liabilities', {
        code: 'PR-INTEREST', name: 'Pasivo con interés', principalAmount: '120.00', installments: 2,
        interestRate: '12.00', startDate: '2026-10-01',
      }),
    );
    expect(Number(interestBearing.schedule[0]!.interestDue)).toBeGreaterThan(0);
    expect(interestBearing.schedule[1]!.dueDate.localeCompare(interestBearing.schedule[0]!.dueDate)).toBeGreaterThan(0);
  });

  it('calcula amortización, devengos, mayor y reportes desde movimientos posteados', () => {
    const filtered = data<{ items: unknown[] }>(request('GET', '/accounting/assets', {}, new URLSearchParams({ practiceId: 'missing' })));
    expect(filtered.items).toHaveLength(0);
    const before = data<{ items: { code: string; netBookValue: string; depreciable: boolean }[]; monthlyCharge: string }>(request('GET', '/accounting/assets'));
    expect(before.items.some((asset) => asset.code.startsWith('EQ') && asset.depreciable)).toBe(true);
    expect(Number(before.monthlyCharge)).toBeGreaterThan(0);
    const depreciation = data<{ depreciatedAssets: number; transactionIds: string[] }>(
      request('POST', '/accounting/depreciation/run', {
        depreciationExpenseAccountId: 'gasto',
        accumulatedDepreciationAccountId: 'acumulada',
      }),
    );
    expect(depreciation.depreciatedAssets).toBeGreaterThan(0);
    // Un asiento por activo, como la corrida real.
    expect(depreciation.transactionIds).toHaveLength(depreciation.depreciatedAssets);
    const after = data<{ items: { code: string; netBookValue: string }[] }>(request('GET', '/accounting/assets'));
    expect(Number(after.items.find((asset) => asset.code === 'EQ-001')!.netBookValue))
      .toBeLessThan(Number(before.items.find((asset) => asset.code === 'EQ-001')!.netBookValue));

    const accruals = data<{ items: { id: string; completed: boolean; pendingAmount: string; remainingPeriods: number }[]; pendingTotal: string }>(request('GET', '/accounting/accrual-objects'));
    const pending = accruals.items.find((item) => !item.completed && Number(item.pendingAmount) > 0)!;
    expect(pending).toBeDefined();
    // Un objeto por llamada (informe B, C11).
    const devengar = (accrualObjectId: string) => request('POST', '/accounting/accruals/run', { accrualObjectId });
    expect(status(devengar('inexistente'))).toBe(404);
    const run = data<{ postedLines: number; transactionIds: string[] }>(devengar(pending.id));
    expect(run).toMatchObject({ postedLines: 1, transactionIds: [expect.any(String)] });
    for (let period = 1; period < pending.remainingPeriods; period += 1) {
      expect(status(devengar(pending.id))).toBe(201);
    }
    expect(status(devengar(pending.id))).toBe(422);
    expect(data<{ totalRevenue: string; totalExpense: string; netIncome: string }>(
      request('GET', '/accounting/income-statement', {}, new URLSearchParams({ from: '2026-10-01' })),
    ).netIncome).toBeDefined();
    expect(data<{ balanced: boolean }>(request('GET', '/accounting/balance-sheet')).balanced).toBe(true);
    const accounts = data<{ items: { id: string; code: string }[] }>(request('GET', '/accounting/accounts', {}, new URLSearchParams({ limit: '0' })));
    const account = accounts.items.find((row) => row.code === '1.1')!;
    expect(status(request('GET', '/accounting/general-ledger', {}, new URLSearchParams({ accountId: 'missing' })))).toBe(404);
    const ledger = data<{ openingBalance: string; items: unknown[] }>(
      request('GET', '/accounting/general-ledger', {}, new URLSearchParams({ accountId: account.id, from: '2026-10-01', to: '2026-10-31' })),
    );
    expect(ledger.openingBalance).toBeDefined();
    expect(ledger.items.length).toBeGreaterThan(0);
    expect(data<{ items: unknown[] }>(request('GET', '/accounting/journal-transactions', {}, new URLSearchParams({ statusConceptId: 'missing', limit: '0' }))).items)
      .toHaveLength(0);
    expect(data<{ items: unknown[] }>(request('GET', '/accounting/journal-transactions', {}, new URLSearchParams({ from: '2026-10-01', to: '2026-10-31', limit: '5' }))).items.length)
      .toBeLessThanOrEqual(5);
    expect(status(request('GET', '/accounting/journal-transactions/missing'))).toBe(404);
    expect(status(request('GET', '/accounting/journal-transactions/missing/document-flow'))).toBe(404);
  });

  it('actualiza activos y automatización de activos y pasivos del profesional', () => {
    const noAssets = data<unknown[]>(request('GET', '/accounting/practitioner/assets', {}, new URLSearchParams({ practiceId: 'missing' })));
    expect(noAssets).toHaveLength(0);
    const noLiabilities = data<unknown[]>(request('GET', '/accounting/practitioner/liabilities', {}, new URLSearchParams({ practiceId: 'missing' })));
    expect(noLiabilities).toHaveLength(0);
    const asset = data<{ id: string }>(request('POST', '/accounting/practitioner/assets', { code: 'EQ-TEST', name: 'Activo sintético', acquisitionCost: '60.00' }));
    const assetPath = `/accounting/practitioner/assets/${asset.id}`;
    expect(status(request('PATCH', `${assetPath}/automation`, { automated: false }))).toBe(200);
    expect(data<{ amount: string }>(request('POST', `${assetPath}/progress`)).amount).toBe('1.00');
    expect(status(request('POST', '/accounting/practitioner/assets/missing/progress'))).toBe(404);
    const listedAssets = data<{ id: string; automated: boolean }[]>(request('GET', '/accounting/practitioner/assets'));
    expect(listedAssets.find((item) => item.id === asset.id)?.automated).toBe(false);

    const liability = data<{ id: string }>(request('POST', '/accounting/practitioner/liabilities', {
      code: 'PR-AUTOMATION', name: 'Pasivo sintético', principalAmount: '9.00', installments: 3, startDate: '2026-10-01',
    }));
    expect(status(request('PATCH', `/accounting/practitioner/liabilities/${liability.id}/automation`, { automated: false }))).toBe(200);
    const listedLiabilities = data<{ id: string; automated: boolean }[]>(request('GET', '/accounting/practitioner/liabilities'));
    expect(listedLiabilities.find((item) => item.id === liability.id)?.automated).toBe(false);
    expect(data<{ count: number }>(request('GET', '/accounting/practitioner/paid-consultations')).count).toBeGreaterThan(0);
    expect(status(request('POST', '/accounting/practitioner/consultation-income', { invoiceId: 'invoice-synthetic' }))).toBe(201);
    expect(status(request('POST', '/accounting/practitioner/entries', { kind: 'EXPENSE', amount: '4.25', description: 'Gasto sintético' }))).toBe(201);
  });
});
