import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type {
  LabOrder,
  LabOrderAction,
  LabOrderStatus,
} from '../../../core/data-access/lab-portal/lab-portal.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ResultUploadQueue, type UploadItem } from '../results/result-upload-queue';
import { LaboratoryOrders } from './laboratory-orders';

/**
 * «Órdenes» del laboratorio. Lo que estas pruebas fijan:
 *
 * 1. Una tarjeta con una pestaña por estado y su conteo.
 * 2. Cada acción pide **un** paso a la API y después relee la lista: lo que se
 *    ve es lo que el servidor tiene.
 * 3. Un 409 se muestra con el mensaje del servidor y no deja la fila vieja.
 * 4. Mientras una acción está en vuelo no se manda otra (doble envío).
 * 5. El estado vacío de una pestaña dice por qué y qué hacer.
 */
function order(id: string, status: LabOrderStatus, extra: Partial<LabOrder> = {}): LabOrder {
  return {
    orderId: id,
    studyName: 'Hemograma completo',
    patientName: `Paciente ${id}`,
    requesterName: 'Dra. Rojas',
    requestedAt: '2026-10-30T10:00:00Z',
    status,
    reason: null,
    files: [],
    ...extra,
  };
}

const ORDERS: readonly LabOrder[] = [
  order('a', 'DRAFT'),
  order('b', 'RECEIVED'),
  order('c', 'PROCESSED'),
  order('d', 'UPLOADED', { files: [{ id: 'f-1', fileName: 'hemograma.pdf', sizeBytes: 20 }] }),
  order('e', 'CANCELLED', { reason: 'La anuló quien la pidió.' }),
];

interface Internal {
  run: (code: string, order: LabOrder) => void;
  selected: () => number;
  select: (index: number) => void;
  busyOrderId: () => string | null;
  actionError: () => string | null;
  counts: () => readonly number[];
  table: () => { status: string; message?: string; data?: readonly LabOrder[] };
}

describe('LaboratoryOrders', () => {
  let fixture: ComponentFixture<LaboratoryOrders>;
  let listOrders: ReturnType<typeof vi.fn>;
  let transitionOrder: ReturnType<typeof vi.fn>;
  const success = vi.fn();

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function create(): void {
    fixture = TestBed.createComponent(LaboratoryOrders);
    fixture.detectChanges();
  }

  beforeEach(() => {
    success.mockReset();
    listOrders = vi.fn(() => of({ items: ORDERS, count: ORDERS.length }));
    transitionOrder = vi.fn((_id: string, _action: LabOrderAction) => of(ORDERS[0]));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: LabPortalClient, useValue: { listOrders, transitionOrder } },
        { provide: ToastService, useValue: { success } },
      ],
    });
  });

  it('dibuja una pestaña por estado, con su conteo', () => {
    create();

    const tabs = Array.from(host().querySelectorAll('[role="tab"]')).map((t) =>
      t.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(tabs).toEqual([
      'Todas (5)',
      'Borrador (1)',
      'Recibidas (1)',
      'Procesadas (1)',
      'Subidos (1)',
      'Canceladas y rechazadas (1)',
    ]);
    expect(internal().counts()).toEqual([5, 1, 1, 1, 1, 1]);
  });

  it('«Todas» lista las órdenes, cada una con su insignia y un menú de acciones con nombre', () => {
    create();

    expect(host().querySelectorAll('tbody tr').length).toBe(5);
    const statuses = Array.from(host().querySelectorAll('[data-testid="lab-order-status"]')).map(
      (b) => b.textContent?.trim(),
    );
    expect(statuses).toEqual(['Borrador', 'Recibida', 'Procesada', 'Subidos', 'Cancelada']);
    // La cancelada no tiene acciones: 4 filas con menú.
    expect(host().querySelectorAll('app-row-actions').length).toBe(4);
    expect(
      host().querySelector('[aria-label*="Acciones de la orden de Paciente a"]'),
    ).not.toBeNull();
  });

  it('el motivo de una orden cancelada se ve en su fila', () => {
    create();
    expect(host().textContent).toContain('La anuló quien la pidió.');
  });

  it('recibir pide el paso RECEIVE, avisa y relee la lista', () => {
    create();
    listOrders.mockClear();

    internal().run('receive', ORDERS[0]!);

    expect(transitionOrder).toHaveBeenCalledExactlyOnceWith('a', 'RECEIVE');
    expect(success).toHaveBeenCalledWith('Orden recibida.');
    expect(listOrders).toHaveBeenCalledTimes(1);
  });

  it('marcar como procesada pide el paso PROCESS', () => {
    create();
    internal().run('process', ORDERS[1]!);
    expect(transitionOrder).toHaveBeenCalledExactlyOnceWith('b', 'PROCESS');
    expect(success).toHaveBeenCalledWith('Orden marcada como procesada.');
  });

  it('un 409 muestra el mensaje del servidor y relee la lista', () => {
    transitionOrder.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: {
              statusCode: 409,
              code: 'CONFLICT',
              message: 'La orden no está en un estado que admita ese paso.',
              timestamp: '2026-10-31T00:00:00Z',
              path: '/diagnostics/lab/orders/a/transitions',
            },
          }),
      ),
    );
    create();
    listOrders.mockClear();

    internal().run('receive', ORDERS[0]!);
    fixture.detectChanges();

    expect(internal().actionError()).toBe('La orden no está en un estado que admita ese paso.');
    expect(host().querySelector('[data-testid="lab-orders-error"]')).not.toBeNull();
    expect(success).not.toHaveBeenCalled();
    expect(listOrders).toHaveBeenCalledTimes(1);
    expect(internal().busyOrderId()).toBeNull();
  });

  it('no manda una segunda acción mientras la primera está en vuelo', () => {
    let finish: (() => void) | undefined;
    transitionOrder.mockReturnValue({
      subscribe: (observer: { next: () => void }) => {
        finish = () => observer.next();
        return { unsubscribe: () => undefined };
      },
    });
    create();

    internal().run('receive', ORDERS[0]!);
    internal().run('process', ORDERS[1]!);

    expect(transitionOrder).toHaveBeenCalledTimes(1);
    expect(internal().busyOrderId()).toBe('a');
    finish?.();
    expect(internal().busyOrderId()).toBeNull();
  });

  it('una pestaña vacía dice por qué y qué hacer', () => {
    listOrders.mockReturnValue(of({ items: [order('a', 'DRAFT')], count: 1 }));
    create();

    internal().select(4);
    fixture.detectChanges();

    expect(internal().table().status).toBe('empty');
    expect(internal().table().message).toBe('No hay órdenes en «Subidos».');
  });

  it('sin ninguna orden, el vacío lo dice', () => {
    listOrders.mockReturnValue(of({ items: [], count: 0 }));
    create();
    expect(internal().table().message).toBe('Todavía no le derivaron ninguna orden.');
  });

  it('si la lista falla, la tabla muestra el error con su reintento', () => {
    listOrders.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'boom' } })),
    );
    create();
    expect(internal().table().status).not.toBe('ready');
    expect(internal().table().status).not.toBe('loading');
  });
  it('mientras se sube, el panel dice a qué orden va y muestra el avance; al terminar cambia el título', () => {
    const items = signal<readonly UploadItem[]>([
      {
        localId: 'u-1',
        file: new File([new Uint8Array(200)], 'hemograma.pdf'),
        displayName: 'hemograma.pdf',
        target: { orderId: 'c', note: null, notify: true },
        status: 'uploading',
        sentBytes: 50,
        bytesPerSecond: null,
        error: null,
        result: null,
      },
    ]);
    const active = signal(true);
    TestBed.overrideComponent(LaboratoryOrders, {
      set: {
        providers: [
          {
            provide: ResultUploadQueue,
            useValue: {
              items,
              active,
              finishedCount: signal(0),
              totals: () => ({
                files: 1,
                done: active() ? 0 : 1,
                totalBytes: 200,
                sentBytes: 50,
                percent: 25,
              }),
              cancel: vi.fn(),
              resume: vi.fn(),
              clearFinished: vi.fn(),
            },
          },
        ],
      },
    });
    create();

    const panel = host().querySelector('[data-testid="lab-orders-uploads"]')!;
    expect(panel.textContent).toContain('Subiendo resultados · 0 de 1');
    expect(panel.textContent).toContain('Paciente c · Hemograma completo');
    const bar = panel.querySelector('progress')!;
    expect(bar.value).toBe(25);
    expect(bar.getAttribute('aria-label')).toBe('Avance de hemograma.pdf');

    active.set(false);
    items.set([{ ...items()[0]!, status: 'done', sentBytes: 200 }]);
    fixture.detectChanges();
    expect(panel.textContent).toContain('Resultados subidos · 1 de 1');
    expect(panel.querySelector('progress')).toBeNull();
  });
});
