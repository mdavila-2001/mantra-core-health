import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { BlockCancellations } from './block-cancellations';
import { intervalosDelPedido } from './block-intervals';
import { DialogService } from '../../shared/components/molecules/dialog/dialog-service';
import type { BloqueoPedido } from './my-agenda/block-form/block-form';

/**
 * Bug fixed 2026-11-06: /schedule/blocks sent «the afternoons from the 10th to
 * the 12th» as ONE exception (10th 14:00 → 12th 18:00), closing the nights and
 * mornings in between. Both screens now go through `createBlock`.
 */
function pedido(extra: Partial<BloqueoPedido>): BloqueoPedido {
  return {
    desde: new Date(2026, 10, 10, 14, 0),
    hasta: new Date(2026, 10, 12, 18, 0),
    exceptionType: 'ABSENCE',
    motivo: '',
    dias: 3,
    franjaHoraria: true,
    ...extra,
  };
}

const URL = '/scheduling/resources/res-1/exceptions';
const PATCH = '/scheduling/exceptions/exc-1';

describe('intervalosDelPedido', () => {
  it('a time range is one exception per day, each within its own day', () => {
    const intervalos = intervalosDelPedido(pedido({}));
    expect(intervalos).toHaveLength(3);
    for (const i of intervalos) {
      expect(i.startAt.getHours()).toBe(14);
      expect(i.endAt.getHours()).toBe(18);
      expect(i.startAt.getDate()).toBe(i.endAt.getDate());
    }
  });

  it('whole days stay a single exception', () => {
    const p = pedido({ franjaHoraria: false, desde: new Date(2026, 10, 10), hasta: new Date(2026, 10, 13) });
    expect(intervalosDelPedido(p)).toEqual([{ startAt: p.desde, endAt: p.hasta }]);
  });
});

describe('BlockCancellations', () => {
  let http: HttpTestingController;
  let service: BlockCancellations;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(true) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(BlockCancellations);
  });

  afterEach(() => http.verify());

  it('createBlock sends a time range day by day, in order', async () => {
    const hecho = firstValueFrom(service.createBlock('res-1', pedido({ motivo: '  ' })));

    for (const dia of [10, 11, 12]) {
      const req = http.expectOne((r) => r.url.endsWith(URL));
      const body = req.request.body as { startAt: string; endAt: string; reason?: string };
      expect(new Date(body.startAt).getDate()).toBe(dia);
      expect(new Date(body.endAt).getDate()).toBe(dia);
      // A blank description is not sent.
      expect(body.reason).toBeUndefined();
      req.flush({ id: `exc-${dia}`, blockedSlots: 2, cancelledBookings: 0 });
    }

    expect(await hecho).toHaveLength(3);
  });

  it('updateBlock moves the block to the first day and creates the others', async () => {
    const hecho = firstValueFrom(service.updateBlock('exc-1', 'res-1', pedido({})));

    const patch = http.expectOne((r) => r.url.endsWith(PATCH));
    const body = patch.request.body as { startAt: string; endAt: string };
    expect(new Date(body.startAt).getDate()).toBe(10);
    expect(new Date(body.endAt).getDate()).toBe(10);
    patch.flush({ id: 'exc-1', blockedSlots: 1 });

    for (const dia of [11, 12]) {
      const req = http.expectOne((r) => r.url.endsWith(URL));
      expect(new Date((req.request.body as { startAt: string }).startAt).getDate()).toBe(dia);
      req.flush({ id: `exc-${dia}`, blockedSlots: 1, cancelledBookings: 0 });
    }

    expect((await hecho).nuevos).toBe(2);
  });

  it('updateBlock on a single day only patches', async () => {
    const hecho = firstValueFrom(
      service.updateBlock('exc-1', 'res-1', pedido({ hasta: new Date(2026, 10, 10, 18, 0) })),
    );
    http.expectOne((r) => r.url.endsWith(PATCH)).flush({ id: 'exc-1', blockedSlots: 0 });
    expect((await hecho).nuevos).toBe(0);
  });
});
