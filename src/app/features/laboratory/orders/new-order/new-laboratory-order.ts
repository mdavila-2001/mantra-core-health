import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, of, switchMap, tap } from 'rxjs';

import { orderIdFromQrCode } from '../../../../core/data-access/lab-portal/lab-order-qr';
import { LabPortalClient } from '../../../../core/data-access/lab-portal/lab-portal.client';
import type {
  LabOrder,
  LabPatient,
} from '../../../../core/data-access/lab-portal/lab-portal.types';
import { readApiError } from '../../../../core/http/api-error';
import {
  QrReader,
  QrReaderUnavailableError,
  type QrCameraSession,
} from '../../../../shared/utils/qr/read-qr';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';

/** Lo que entrega la pantalla al crear una orden: la orden y si era nueva. */
export interface NewOrderResult {
  readonly order: LabOrder;
  /** `false` si el código del paciente ya se había cargado. */
  readonly created: boolean;
}

/**
 * **Nueva orden** del laboratorio y del centro de imagenología (06/11/2026).
 *
 * Una orden nace por tres vías y esta pantalla cubre las dos que inicia el
 * centro; la tercera llega sola:
 *
 * 1. **El QR que manda el paciente** — por cámara, subiendo la imagen,
 *    pegándola del portapapeles, desde la mensajería (la acción «Usar para una
 *    orden» del visor de fotos del chat) o escribiendo el código.
 * 2. **La derivación del médico** — no se crea acá: aparece en «Borrador»
 *    cuando el paciente la acepta en «Mis órdenes».
 * 3. **La orden propia** — el personal elige al paciente y escribe el estudio.
 *
 * Una tarjeta con pestañas, a lo ancho (`composition-rules.md` §5). La pantalla
 * no autoriza ni valida por la API: manda y muestra lo que ella responde.
 */
@Component({
  selector: 'app-new-laboratory-order',
  imports: [AppButton, Alert, Card, FormField, Input, NavIcon, ReferenceCombobox, Tab, Tabs, Textarea],
  templateUrl: './new-laboratory-order.html',
  styleUrl: './new-laboratory-order.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:paste)': 'onPaste($event)' },
})
export class NewLaboratoryOrder {
  private readonly lab = inject(LabPortalClient);
  private readonly qr = inject(QrReader);
  private readonly destroyRef = inject(DestroyRef);

  readonly created = output<NewOrderResult>();
  readonly cancelled = output<void>();

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private camera: QrCameraSession | null = null;

  protected readonly tab = signal(0);
  protected readonly qrSupported = this.qr.canRead();

  /** Una operación de alta en vuelo: nada se manda dos veces. */
  protected readonly busy = signal(false);
  protected readonly cameraOn = signal(false);
  /** Una imagen se está arrastrando sobre la zona de entrega. */
  protected readonly dragging = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly manualCode = signal('');

  /* ---- orden propia ---- */
  protected readonly patient = signal<ReferenceOption | null>(null);
  protected readonly patientOptions = signal<readonly ReferenceOption[]>([]);
  protected readonly searchingPatient = signal(false);
  protected readonly studyName = signal('');
  protected readonly note = signal('');
  protected readonly fieldErrors = signal<{ patient?: string; study?: string }>({});
  private readonly patientQuery$ = new Subject<string>();

  constructor() {
    this.destroyRef.onDestroy(() => this.stopCamera());
    this.patientQuery$
      .pipe(
        tap((q) => this.searchingPatient.set(q.trim().length >= 2)),
        switchMap((q) => (q.trim().length >= 2 ? this.lab.searchPatients(q.trim()) : of(null))),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (page) => {
          this.searchingPatient.set(false);
          this.patientOptions.set(page === null ? [] : page.items.map(toOption));
        },
        error: () => {
          this.searchingPatient.set(false);
          this.patientOptions.set([]);
        },
      });
  }

  protected selectTab(index: number): void {
    if (index !== 0) this.stopCamera();
    this.tab.set(index);
    this.error.set(null);
  }

  /* ---- vía 1: el QR del paciente ---------------------------------------- */

  protected async openCamera(): Promise<void> {
    this.error.set(null);
    this.cameraOn.set(true);
    // El `<video>` existe recién después del próximo ciclo de detección.
    await Promise.resolve();
    const element = this.video()?.nativeElement;
    if (element === undefined) return;
    try {
      this.camera = await this.qr.startCamera(element, (text) => this.useText(text, 'camera'));
    } catch (error: unknown) {
      this.cameraOn.set(false);
      this.error.set(cameraMessage(error));
    }
  }

  protected stopCamera(): void {
    this.camera?.stop();
    this.camera = null;
    this.cameraOn.set(false);
  }

  protected async onFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file !== undefined) await this.useImage(file);
  }

  /** El botón «Pegar»: lee el portapapeles (imagen o texto) cuando el navegador lo deja. */
  protected async pasteFromClipboard(): Promise<void> {
    this.error.set(null);
    try {
      for (const item of await navigator.clipboard.read()) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType !== undefined) return await this.useImage(await item.getType(imageType));
        if (item.types.includes('text/plain')) {
          return this.useText(await (await item.getType('text/plain')).text(), 'paste');
        }
      }
      this.error.set('El portapapeles no tiene ni una imagen ni un código.');
    } catch {
      this.error.set(
        'El navegador no dejó leer el portapapeles. Pegue con Ctrl+V o escriba el código.',
      );
    }
  }

  /** Ctrl+V en cualquier parte de la pestaña del QR. */
  protected onPaste(event: ClipboardEvent): void {
    if (this.tab() !== 0 || this.busy()) return;
    const target = event.target as HTMLElement | null;
    // Dentro de un campo de texto, pegar es escribir: no se interpreta.
    if (target?.closest('input, textarea') != null) return;
    const data = event.clipboardData;
    if (data === null) return;
    const image = Array.from(data.files).find((f) => f.type.startsWith('image/'));
    if (image !== undefined) {
      event.preventDefault();
      void this.useImage(image);
      return;
    }
    const text = data.getData('text/plain');
    if (text.trim() !== '') {
      event.preventDefault();
      this.useText(text, 'paste');
    }
  }

  protected onDragOver(event: DragEvent): void {
    if (this.busy() || event.dataTransfer === null) return;
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const image = Array.from(event.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'));
    if (image === undefined) {
      this.error.set('Suelte una imagen con el QR.');
      return;
    }
    void this.useImage(image);
  }

  protected submitManualCode(): void {
    this.useText(this.manualCode(), 'manual');
  }

  private async useImage(image: Blob): Promise<void> {
    if (this.busy()) return;
    this.error.set(null);
    this.busy.set(true);
    try {
      const text = await this.qr.readImage(image);
      this.busy.set(false);
      if (text === null) {
        this.error.set('No encontramos un QR en esa imagen. Pruebe con otra o escriba el código.');
        return;
      }
      this.useText(text, 'image');
    } catch (error: unknown) {
      this.busy.set(false);
      this.error.set(
        error instanceof QrReaderUnavailableError
          ? 'Este navegador no puede leer el QR de una imagen. Escriba el código que lo acompaña.'
          : 'No pudimos leer esa imagen.',
      );
    }
  }

  private useText(text: string, _via: 'camera' | 'image' | 'paste' | 'manual'): void {
    if (this.busy()) return;
    this.error.set(null);
    if (orderIdFromQrCode(text) === null) {
      // Un código ajeno no apaga la cámara: se sigue buscando el correcto.
      this.error.set('Ese código no es el de una orden de AloVida.');
      return;
    }
    this.stopCamera();
    this.busy.set(true);
    this.lab.createOrderFromQr(text).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.created.emit(result);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.error.set(messageOf(error, 'No pudimos crear la orden con ese código.'));
      },
    });
  }

  /* ---- vía 3: la orden propia ------------------------------------------- */

  protected searchPatient(q: string): void {
    this.patientQuery$.next(q);
  }

  protected submitOwn(): void {
    if (this.busy()) return;
    const errors: { patient?: string; study?: string } = {};
    const patient = this.patient();
    if (patient === null) errors.patient = 'Elija un paciente de la lista.';
    const study = this.studyName().trim();
    if (study === '') errors.study = 'Escriba el estudio que se pide.';
    this.fieldErrors.set(errors);
    this.error.set(null);
    if (patient === null || study === '') return;
    this.busy.set(true);
    const note = this.note().trim();
    this.lab
      .createOrder({
        patientProfileId: patient.value,
        studyName: study,
        ...(note === '' ? {} : { note }),
      })
      .subscribe({
        next: (order) => {
          this.busy.set(false);
          this.created.emit({ order, created: true });
        },
        error: (error: unknown) => {
          // Lo escrito se conserva: sólo se muestra por qué no se pudo.
          this.busy.set(false);
          this.error.set(messageOf(error, 'No pudimos crear la orden.'));
        },
      });
  }
}

function toOption(patient: LabPatient): ReferenceOption {
  return {
    value: patient.patientProfileId,
    label: patient.displayName,
    ...(patient.patientCode === null ? {} : { hint: patient.patientCode }),
  };
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const message = readApiError(error)?.message;
    if (message !== undefined && message !== '') return message;
  }
  return fallback;
}

function cameraMessage(error: unknown): string {
  if (error instanceof QrReaderUnavailableError) {
    return 'Este navegador no puede leer QR con la cámara. Suba una imagen o escriba el código.';
  }
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') {
    return 'No dio permiso para usar la cámara. Actívelo en el navegador o suba una imagen.';
  }
  if (name === 'NotFoundError') return 'Este equipo no tiene cámara. Suba una imagen del QR.';
  return 'No pudimos abrir la cámara.';
}
