import { describe, expect, it } from 'vitest';

import type {
  LabOrder,
  LabOrderStatus,
} from '../../../core/data-access/lab-portal/lab-portal.types';
import {
  actionsOf,
  disabledAll,
  ORDER_STATUS_BADGE,
  ORDER_TABS,
  orderTabIndexOf,
  orderTabKeyOf,
  originChip,
  originLabel,
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
    origin: 'CLINIC',
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
  it('ofrece sólo las cuatro acciones, en el orden del camino', () => {
    expect(actionsOf(order('DRAFT')).map((a) => a.code)).toEqual([
      'receive',
      'process',
      'upload',
      'download',
    ]);
    expect(actionsOf(order('DRAFT')).map((a) => a.label)).toEqual([
      'Recibir',
      'Marcar como procesada',
      'Subir resultados',
      'Descargar',
    ]);
  });

  it('en cada estado sólo está habilitado el paso que le toca', () => {
    expect(habilitadas(order('DRAFT'))).toEqual(['receive']);
    expect(habilitadas(order('RECEIVED'))).toEqual(['process']);
    expect(habilitadas(order('PROCESSED'))).toEqual(['upload']);
    expect(habilitadas(order('UPLOADED', 2))).toEqual(['upload', 'download']);
  });

  it('descargar exige archivos aunque el estado sea «Subidos»', () => {
    expect(habilitadas(order('UPLOADED', 0))).toEqual(['upload']);
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

describe('originLabel: cómo llegó la orden', () => {
  const base = order('DRAFT');
  it.each([
    ['CLINIC', 'Pidió Dra. Rojas'],
    ['PATIENT_QR', 'Por el QR del paciente · pidió Dra. Rojas'],
    ['DOCTOR_REFERRAL', 'Derivada por Dra. Rojas, aceptada por el paciente'],
    ['LAB_OWN', 'Creada por el centro'],
  ] as const)('%s → «%s»', (origin, esperado) => {
    expect(originLabel({ ...base, origin })).toBe(esperado);
  });
});

describe('originChip', () => {
  it.each([
    ['CLINIC', null],
    ['PATIENT_QR', 'QR del paciente'],
    ['DOCTOR_REFERRAL', 'Derivada por médico'],
    ['LAB_OWN', 'Creada por el centro'],
  ] as const)('%s → %s', (origin, esperado) => {
    expect(originChip({ ...order('DRAFT'), origin })).toBe(esperado);
  });
});
