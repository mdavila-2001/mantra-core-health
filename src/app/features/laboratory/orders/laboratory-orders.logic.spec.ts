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
  it('ofrece las cuatro del camino y, sólo si la API lo permite, Rechazar al final', () => {
    expect(actionsOf(order('DRAFT')).map((a) => a.code)).toEqual(['receive', 'process', 'upload', 'download']);
    expect(actionsOf(order('DRAFT')).map((a) => a.label)).toEqual([
      'Recibir',
      'Marcar como procesada',
      'Subir resultados',
      'Descargar',
    ]);
    expect(actionsOf({ ...order('RECEIVED'), canReject: true }).map((a) => a.code)).toEqual([
      'receive',
      'process',
      'upload',
      'download',
      'reject',
    ]);
  });

  it('en cada estado sólo está habilitado el paso que le toca, y el rechazo donde la API lo admite', () => {
    expect(habilitadas(order('DRAFT'))).toEqual(['receive']);
    expect(habilitadas(order('RECEIVED'))).toEqual(['process']);
    expect(habilitadas({ ...order('RECEIVED'), canReject: true })).toEqual(['process', 'reject']);
    expect(habilitadas(order('PROCESSED'))).toEqual(['upload']);
    expect(habilitadas(order('UPLOADED', 2))).toEqual(['upload', 'download']);
  });

  it('descargar exige archivos aunque el estado sea «Subidos»', () => {
    expect(habilitadas(order('UPLOADED', 0))).toEqual(['upload']);
  });

  it('en la orden de un médico nunca se ofrece anular ni corregir, y imagenología, sin muestra, tampoco ofrece Rechazar', () => {
    const imaging = (status: LabOrderStatus, canReject?: boolean) => ({
      ...order(status, 1),
      studyName: 'Ecografía abdominal',
      ...(canReject === undefined ? {} : { canReject }),
    });
    for (const status of ['DRAFT', 'RECEIVED', 'PROCESSED', 'UPLOADED'] as const) {
      for (const canReject of [undefined, false, true]) {
        expect(actionsOf(imaging(status, canReject)).some((a) => a.code === 'cancel')).toBe(false);
        expect(actionsOf(imaging(status, canReject)).some((a) => a.code === 'edit')).toBe(false);
      }
      expect(actionsOf(imaging(status)).some((a) => a.code === 'reject')).toBe(false);
      expect(actionsOf(imaging(status, false)).some((a) => a.code === 'reject')).toBe(false);
    }
  });

  it('en la orden de un médico, Rechazar es una acción destructiva con su paso REJECT y su motivo mínimo, y es la única salida', () => {
    const recibida = { ...order('RECEIVED'), canReject: true };
    const exits = actionsOf(recibida).filter((a) => a.code === 'reject');
    expect(exits).toHaveLength(1);
    expect(exits.every((a) => a.destructive === true)).toBe(true);
    expect(Object.keys(REASON_STEPS)).toEqual(['reject', 'cancel']);
    expect(REASON_STEPS.reject.action).toBe('REJECT');
    expect(REASON_FIELD.minLength).toBeGreaterThanOrEqual(3);
    expect(REASON_STEPS.reject.dialog(order('RECEIVED')).message).toContain('Hemograma completo');
  });

  it('Rechazar aparece sólo cuando la API dice canReject (orden recibida con su muestra)', () => {
    const recibida = { ...order('RECEIVED'), canReject: true };
    expect(habilitadas(recibida)).toEqual(['process', 'reject']);
    const rechazar = actionsOf(recibida).find((a) => a.code === 'reject');
    expect(rechazar).toMatchObject({ label: 'Rechazar', destructive: true });
    expect(actionsOf(order('RECEIVED')).some((a) => a.code === 'reject')).toBe(false);
  });

  it('en la orden que cargó el centro: Corregir sólo con canEdit y Anular (CANCEL, con motivo) mientras siga viva', () => {
    const own = (status: LabOrderStatus, canEdit: boolean) => ({
      ...order(status),
      registeredByPerformer: true,
      canEdit,
    });
    expect(habilitadas(own('DRAFT', true))).toEqual(['receive', 'edit', 'cancel']);
    expect(habilitadas(own('RECEIVED', false))).toEqual(['process', 'cancel']);
    const anular = actionsOf(own('DRAFT', true)).find((a) => a.code === 'cancel');
    expect(anular).toMatchObject({ label: 'Anular', destructive: true });
    expect(REASON_STEPS.cancel.action).toBe('CANCEL');
    expect(REASON_STEPS.cancel.dialog(own('DRAFT', true)).message).toContain('Hemograma completo');
    expect(actionsOf(own('CANCELLED', false))).toEqual([]);
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
