import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import type {
  LabOrder,
  LabOrderStatus,
} from '../../../core/data-access/lab-portal/lab-portal.types';
import {
  actionsOf,
  apiMessageOf,
  disabledAll,
  ORDER_STATUS_BADGE,
  ORDER_TABS,
  REASON_FIELD,
  REASON_STEPS,
  orderTabIndexOf,
  orderTabKeyOf,
  ordersOfTab,
} from './laboratory-orders.logic';

function order(status: LabOrderStatus, files = 0): LabOrder {
  return {
    orderId: `o-${status}`,
    studyName: 'Hemograma completo',
    patientName: 'Ana Pérez',
    requesterName: 'Dra. Rojas',
    requestedAt: '2026-10-30T10:00:00Z',
    status,
    reason: null,
    files: Array.from({ length: files }, (_, i) => ({
      id: `f-${i}`,
      fileName: `r-${i}.pdf`,
      sizeBytes: 10,
    })),
  };
}

const habilitadas = (o: LabOrder) =>
  actionsOf(o)
    .filter((a) => a.disabled !== true)
    .map((a) => a.code);

describe('órdenes del laboratorio: acciones por estado', () => {
  it('ofrece las cuatro del camino y, al final, Cancelar y Rechazar', () => {
    expect(actionsOf(order('DRAFT')).map((a) => a.code)).toEqual([
      'receive',
      'process',
      'upload',
      'download',
      'cancel',
      'reject',
    ]);
    expect(actionsOf(order('DRAFT')).map((a) => a.label)).toEqual([
      'Recibir',
      'Marcar como procesada',
      'Subir resultados',
      'Descargar',
      'Cancelar',
      'Rechazar',
    ]);
  });

  it('en cada estado sólo está habilitado el paso que le toca, y las salidas donde la API las admite', () => {
    expect(habilitadas(order('DRAFT'))).toEqual(['receive', 'cancel']);
    expect(habilitadas(order('RECEIVED'))).toEqual(['process', 'cancel', 'reject']);
    expect(habilitadas(order('PROCESSED'))).toEqual(['upload']);
    expect(habilitadas(order('UPLOADED', 2))).toEqual(['upload', 'download']);
  });

  it('descargar exige archivos aunque el estado sea «Subidos»', () => {
    expect(habilitadas(order('UPLOADED', 0))).toEqual(['upload']);
  });

  it('laboratorio e imagenología tienen el mismo menú: Cancelar y Rechazar valen para las dos', () => {
    const imaging = (status: LabOrderStatus) => ({ ...order(status, 1), studyName: 'Ecografía abdominal' });
    for (const status of ['DRAFT', 'RECEIVED', 'PROCESSED', 'UPLOADED'] as const) {
      expect(actionsOf(imaging(status))).toEqual(actionsOf(order(status, 1)));
    }
    expect(habilitadas(imaging('RECEIVED'))).toEqual(['process', 'cancel', 'reject']);
  });

  it('Cancelar y Rechazar son acciones que anulan y llevan su paso y su motivo mínimo', () => {
    const exits = actionsOf(order('RECEIVED')).filter((a) => a.code === 'cancel' || a.code === 'reject');
    expect(exits.every((a) => a.destructive === true)).toBe(true);
    expect(REASON_STEPS.cancel.action).toBe('CANCEL');
    expect(REASON_STEPS.reject.action).toBe('REJECT');
    expect(REASON_FIELD.minLength).toBeGreaterThanOrEqual(3);
    expect(REASON_STEPS.reject.dialog(order('RECEIVED')).message).toContain('Hemograma completo');
  });

  it('una orden cancelada o rechazada no tiene acciones', () => {
    expect(actionsOf(order('CANCELLED'))).toEqual([]);
    expect(actionsOf(order('REJECTED'))).toEqual([]);
  });

  it('todas las acciones llevan ícono y texto (ADR-0012)', () => {
    for (const action of actionsOf(order('DRAFT'))) {
      expect(action.label).not.toBe('');
      expect(action.icon).toBeTruthy();
    }
  });

  it('disabledAll las deja todas sin poder usarse', () => {
    expect(disabledAll(actionsOf(order('DRAFT'))).every((a) => a.disabled === true)).toBe(true);
  });
});

describe('órdenes del laboratorio: pestañas', () => {
  const todas = (
    ['DRAFT', 'RECEIVED', 'PROCESSED', 'UPLOADED', 'CANCELLED', 'REJECTED'] as const
  ).map((s) => order(s, s === 'UPLOADED' ? 1 : 0));

  it('cada pestaña filtra por su estado y «Todas» no filtra', () => {
    const por = (tab: (typeof ORDER_TABS)[number]) => ordersOfTab(todas, tab).map((o) => o.status);
    expect(por('all')).toHaveLength(6);
    expect(por('draft')).toEqual(['DRAFT']);
    expect(por('received')).toEqual(['RECEIVED']);
    expect(por('processed')).toEqual(['PROCESSED']);
    expect(por('uploaded')).toEqual(['UPLOADED']);
    expect(por('closed')).toEqual(['CANCELLED', 'REJECTED']);
  });

  it('el estado de la URL abre su pestaña; uno desconocido abre «Todas»', () => {
    expect(orderTabIndexOf('processed')).toBe(ORDER_TABS.indexOf('processed'));
    expect(orderTabIndexOf('inventado')).toBe(0);
    expect(orderTabIndexOf(null)).toBe(0);
    expect(orderTabKeyOf(99)).toBe('all');
  });

  it('todos los estados tienen su insignia con texto', () => {
    for (const status of [
      'DRAFT',
      'RECEIVED',
      'PROCESSED',
      'UPLOADED',
      'CANCELLED',
      'REJECTED',
    ] as const) {
      expect(ORDER_STATUS_BADGE[status].label).not.toBe('');
    }
  });
});

describe('órdenes del laboratorio: mensaje de la API', () => {
  const failure = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

  it('un 422 lleva el mensaje legible de la API, no el genérico', () => {
    const error = failure(422, {
      statusCode: 422,
      code: 'VALIDATION_FAILED',
      message: 'La orden no admite ese paso.',
    });
    expect(apiMessageOf(error, 'No pudimos cambiar el estado de la orden.')).toBe(
      'La orden no admite ese paso.',
    );
  });

  it('sin cuerpo de la API, o con un mensaje vacío, queda el de reserva', () => {
    expect(apiMessageOf(failure(502, '<html>Bad gateway</html>'), 'reserva')).toBe('reserva');
    expect(apiMessageOf(failure(422, { code: 'VALIDATION_FAILED', message: '' }), 'reserva')).toBe('reserva');
    expect(apiMessageOf(new Error('x'), 'reserva')).toBe('reserva');
  });
});
