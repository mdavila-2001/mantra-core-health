import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { SessionStore } from '../../../../core/auth/session.store';
import { orderQrCode } from '../../../../core/data-access/lab-portal/lab-order-qr';
import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { QrReader } from '../../../../shared/utils/qr/qr-reader';
import { ImageToOrder } from './image-to-order';

const ID = '3f2a9c1e-5b7d-4e8a-9c0f-1a2b3c4d5e6f';
const ORDER = { orderId: ID, patientName: 'Ana Pérez', status: 'DRAFT' };
const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('ImageToOrder («Usar para una orden» en el chat)', () => {
  let readImage: ReturnType<typeof vi.fn>;
  let createOrderFromQr: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  const toasts = { success: vi.fn(), error: vi.fn() };
  let tenantType: string | null;

  beforeEach(() => {
    readImage = vi.fn();
    createOrderFromQr = vi.fn(() => of({ order: ORDER, created: true }));
    navigate = vi.fn().mockResolvedValue(true);
    toasts.success.mockReset();
    toasts.error.mockReset();
    tenantType = 'DIAGNOSTIC_CENTER';
    TestBed.configureTestingModule({
      providers: [
        { provide: SessionStore, useValue: { activeTenantType: () => tenantType } },
        { provide: LabPortalClient, useValue: { createOrderFromQr } },
        { provide: QrReader, useValue: { readImage } },
        { provide: ToastService, useValue: toasts },
        { provide: Router, useValue: { navigate } },
      ],
    });
  });

  const service = () => TestBed.inject(ImageToOrder);

  it('sólo se ofrece a una cuenta de laboratorio', () => {
    expect(service().available()).toBe(true);
  });

  it('una cuenta de paciente o de farmacia no la ve', () => {
    tenantType = 'PHARMACY';
    expect(service().available()).toBe(false);
  });

  it('lee el QR de la imagen, crea la orden, avisa y va a «Borrador»', async () => {
    readImage.mockResolvedValue(orderQrCode(ID));

    await service().use(PNG);

    expect(createOrderFromQr).toHaveBeenCalledExactlyOnceWith(orderQrCode(ID));
    expect(toasts.success).toHaveBeenCalledWith('Orden creada para Ana Pérez.');
    expect(navigate).toHaveBeenCalledWith(['/administration/laboratory-orders'], {
      queryParams: { estado: 'draft' },
    });
    expect(service().busy()).toBe(false);
  });

  it('una imagen sin QR, o con un QR ajeno, no llega a la API', async () => {
    readImage.mockResolvedValueOnce(null);
    await service().use(PNG);
    expect(toasts.error).toHaveBeenLastCalledWith('No encontramos un QR en esa imagen.');

    readImage.mockResolvedValueOnce('https://otra-cosa.com');
    await service().use(PNG);
    expect(toasts.error).toHaveBeenLastCalledWith('Ese QR no es el de una orden de AloVida.');
    expect(createOrderFromQr).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('si la API rechaza (409), muestra su mensaje y no navega', async () => {
    readImage.mockResolvedValue(orderQrCode(ID));
    createOrderFromQr.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { statusCode: 409, code: 'CONFLICT', message: 'Esa orden ya está dirigida a otro centro.' },
          }),
      ),
    );

    await service().use(PNG);

    expect(toasts.error).toHaveBeenCalledWith('Esa orden ya está dirigida a otro centro.');
    expect(navigate).not.toHaveBeenCalled();
    expect(service().busy()).toBe(false);
  });
});
