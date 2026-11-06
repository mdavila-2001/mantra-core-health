import { HttpErrorResponse } from '@angular/common/http';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';

import { orderQrCode } from '../../../../core/data-access/lab-portal/lab-order-qr';
import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import type { LabOrder } from '../../../../core/data-access/lab-portal/lab-portal.types';
import { QrReader } from '../../../../shared/utils/qr/read-qr';

import { NewLaboratoryOrder, type NewOrderResult } from './new-laboratory-order';

const ID = '3f2a9c1e-5b7d-4e8a-9c0f-1a2b3c4d5e6f';
const ORDER: LabOrder = {
  orderId: ID,
  studyName: 'Hemograma completo',
  patientName: 'Ana Pérez',
  requesterName: 'Dra. Rojas',
  requestedAt: '2026-11-06T10:00:00Z',
  status: 'DRAFT',
  origin: 'PATIENT_QR',
  reason: null,
  files: [],
};

interface Internal {
  tab: () => number;
  selectTab: (i: number) => void;
  manualCode: { set: (v: string) => void };
  submitManualCode: () => void;
  onFileChosen: (e: Event) => Promise<void>;
  onPaste: (e: ClipboardEvent) => void;
  patient: { set: (v: { value: string; label: string } | null) => void };
  studyName: { set: (v: string) => void };
  note: { set: (v: string) => void };
  searchPatient: (q: string) => void;
  submitOwn: () => void;
  error: () => string | null;
  busy: () => boolean;
  fieldErrors: () => { patient?: string; study?: string };
  patientOptions: () => readonly { value: string; label: string }[];
}

describe('NewLaboratoryOrder', () => {
  const readQrFromImage = vi.fn();
  let fixture: ComponentFixture<NewLaboratoryOrder>;
  let createOrderFromQr: ReturnType<typeof vi.fn>;
  let createOrder: ReturnType<typeof vi.fn>;
  let searchPatients: ReturnType<typeof vi.fn>;
  const results: NewOrderResult[] = [];

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    results.length = 0;
    readQrFromImage.mockReset();
    createOrderFromQr = vi.fn(() => of({ order: ORDER, created: true }));
    createOrder = vi.fn(() => of({ ...ORDER, origin: 'LAB_OWN' }));
    searchPatients = vi.fn(() =>
      of({ items: [{ patientProfileId: 'p1', displayName: 'Ana Pérez', patientCode: 'PAC-1' }], count: 1 }),
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: LabPortalClient, useValue: { createOrderFromQr, createOrder, searchPatients } },
        {
          provide: QrReader,
          useValue: { canRead: () => true, readImage: readQrFromImage, startCamera: vi.fn() },
        },
      ],
    });
    fixture = TestBed.createComponent(NewLaboratoryOrder);
    fixture.componentInstance.created.subscribe((r) => results.push(r));
    fixture.detectChanges();
  });

  it('una tarjeta con dos pestañas y el aviso de las derivadas por un médico', () => {
    expect(host().querySelectorAll('[role="tab"]').length).toBe(2);
    expect(host().querySelector('[data-testid="lab-new-order-derivadas"]')?.textContent).toContain(
      'cuando el paciente las acepta',
    );
  });

  describe('QR del paciente', () => {
    it('un código escrito a mano crea la orden y avisa que era nueva', () => {
      internal().manualCode.set(orderQrCode(ID));
      internal().submitManualCode();

      expect(createOrderFromQr).toHaveBeenCalledExactlyOnceWith(orderQrCode(ID));
      expect(results).toEqual([{ order: ORDER, created: true }]);
    });

    it('un código ya cargado vuelve con created=false', () => {
      createOrderFromQr.mockReturnValue(of({ order: ORDER, created: false }));
      internal().manualCode.set(orderQrCode(ID));
      internal().submitManualCode();
      expect(results[0]?.created).toBe(false);
    });

    it('un texto que no es de AloVida no llega a la API y dice por qué', () => {
      internal().manualCode.set('https://otra-cosa.com');
      internal().submitManualCode();

      expect(createOrderFromQr).not.toHaveBeenCalled();
      expect(internal().error()).toBe('Ese código no es el de una orden de AloVida.');
    });

    it('una imagen con QR se lee y crea la orden', async () => {
      readQrFromImage.mockResolvedValue(orderQrCode(ID));
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', { value: [new File(['x'], 'qr.png', { type: 'image/png' })] });

      await internal().onFileChosen({ target: input } as unknown as Event);

      expect(createOrderFromQr).toHaveBeenCalledExactlyOnceWith(orderQrCode(ID));
      expect(results.length).toBe(1);
    });

    it('una imagen sin QR no crea nada y lo dice', async () => {
      readQrFromImage.mockResolvedValue(null);
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', { value: [new File(['x'], 'foto.png', { type: 'image/png' })] });

      await internal().onFileChosen({ target: input } as unknown as Event);

      expect(createOrderFromQr).not.toHaveBeenCalled();
      expect(internal().error()).toContain('No encontramos un QR');
    });

    it('Ctrl+V con texto usa el código; con imagen la lee; dentro de un campo de texto no interviene', async () => {
      const evento = (data: Partial<DataTransfer>, target: EventTarget = document.body) =>
        ({ clipboardData: data, target, preventDefault: vi.fn() }) as unknown as ClipboardEvent;

      internal().onPaste(
        evento({ files: [] as unknown as FileList, getData: () => orderQrCode(ID) }),
      );
      expect(createOrderFromQr).toHaveBeenCalledTimes(1);

      createOrderFromQr.mockClear();
      const campo = document.createElement('input');
      internal().onPaste(
        evento({ files: [] as unknown as FileList, getData: () => orderQrCode(ID) }, campo),
      );
      expect(createOrderFromQr).not.toHaveBeenCalled();

      readQrFromImage.mockResolvedValue(orderQrCode(ID));
      internal().onPaste(
        evento({
          files: [new File(['x'], 'qr.png', { type: 'image/png' })] as unknown as FileList,
          getData: () => '',
        }),
      );
      await Promise.resolve();
      await Promise.resolve();
      expect(readQrFromImage).toHaveBeenCalledTimes(1);
    });

    it('un 404 de la API se muestra con su mensaje y no pierde el código escrito', () => {
      createOrderFromQr.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              error: { statusCode: 404, code: 'NOT_FOUND', message: 'No encontramos la orden de ese código.' },
            }),
        ),
      );
      internal().manualCode.set(orderQrCode(ID));
      internal().submitManualCode();

      expect(internal().error()).toBe('No encontramos la orden de ese código.');
      expect(results).toEqual([]);
      expect(internal().busy()).toBe(false);
    });

    it('mientras la orden se crea no se manda otra (doble envío)', () => {
      const pendiente = new Subject<{ order: LabOrder; created: boolean }>();
      createOrderFromQr.mockReturnValue(pendiente);
      internal().manualCode.set(orderQrCode(ID));
      internal().submitManualCode();
      internal().submitManualCode();

      expect(createOrderFromQr).toHaveBeenCalledTimes(1);
      expect(internal().busy()).toBe(true);
      pendiente.next({ order: ORDER, created: true });
      expect(internal().busy()).toBe(false);
    });
  });

  describe('orden propia', () => {
    beforeEach(() => {
      internal().selectTab(1);
      fixture.detectChanges();
    });

    it('sin paciente ni estudio marca los dos campos y no manda nada', () => {
      internal().submitOwn();

      expect(createOrder).not.toHaveBeenCalled();
      expect(internal().fieldErrors()).toEqual({
        patient: 'Elija un paciente de la lista.',
        study: 'Escriba el estudio que se pide.',
      });
    });

    it('con paciente y estudio crea la orden y no manda la nota vacía', () => {
      internal().patient.set({ value: 'p1', label: 'Ana Pérez' });
      internal().studyName.set('  Hemograma  ');
      internal().submitOwn();

      expect(createOrder).toHaveBeenCalledExactlyOnceWith({ patientProfileId: 'p1', studyName: 'Hemograma' });
      expect(results.length).toBe(1);
    });

    it('con nota la manda recortada', () => {
      internal().patient.set({ value: 'p1', label: 'Ana Pérez' });
      internal().studyName.set('Hemograma');
      internal().note.set(' en ayunas ');
      internal().submitOwn();
      expect(createOrder).toHaveBeenCalledWith({
        patientProfileId: 'p1',
        studyName: 'Hemograma',
        note: 'en ayunas',
      });
    });

    it('si la API rechaza, muestra el motivo y conserva lo escrito', () => {
      createOrder.mockReturnValue(
        throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { statusCode: 400, code: 'VALIDATION_FAILED', message: 'Indique el estudio (hasta 120 letras).' },
            }),
        ),
      );
      internal().patient.set({ value: 'p1', label: 'Ana Pérez' });
      internal().studyName.set('Hemograma');
      internal().submitOwn();

      expect(internal().error()).toBe('Indique el estudio (hasta 120 letras).');
      expect(internal().studyName).toBeDefined();
      expect(internal().busy()).toBe(false);
      expect(results).toEqual([]);
    });

    it('busca pacientes desde dos letras y no antes', () => {
      internal().searchPatient('a');
      expect(searchPatients).not.toHaveBeenCalled();
      internal().searchPatient('An');
      expect(searchPatients).toHaveBeenCalledExactlyOnceWith('An');
      expect(internal().patientOptions()).toEqual([
        { value: 'p1', label: 'Ana Pérez', hint: 'PAC-1' },
      ]);
    });
  });
});
