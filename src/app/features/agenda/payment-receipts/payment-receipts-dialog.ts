import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of, switchMap } from 'rxjs';

import { FilesClient } from '../../../core/data-access/files/files.client';
import {
  MAX_RECEIPT_TEXT_LENGTH,
  MIN_RECEIPT_REJECTION_LENGTH,
  PAYMENT_RECEIPT_ACCEPT,
  PAYMENT_RECEIPT_ACCEPT_LABEL,
  PAYMENT_RECEIPT_MAX_BYTES,
  RECEIPT_AMOUNT_PATTERN,
} from '../../../core/data-access/scheduling/payment-receipt-policy';
import type {
  PaymentReceipt,
  PaymentReceiptStatus,
} from '../../../core/data-access/scheduling/payment-receipt.types';
import { PaymentReceiptsClient } from '../../../core/data-access/scheduling/payment-receipts.client';
import type { PaymentStateInfo } from '../../../core/data-access/scheduling/scheduling.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input } from '../../../shared/components/atoms/input/input';
import { Spinner } from '../../../shared/components/atoms/spinner/spinner';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FileInput } from '../../../shared/components/molecules/file-input/file-input';
import { FilePreview } from '../../../shared/components/molecules/file-preview/file-preview';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

/**
 * Quién mira el modal, y por eso qué puede hacer en él.
 *
 * - `paciente`: sube el comprobante de su cita y ve en qué quedó.
 * - `revisor`: el prestador (o el mostrador) lo mira y lo confirma o lo rechaza.
 *
 * Es una pregunta de **qué se ofrece**, no de permisos: quién puede cada cosa lo
 * decide la API, que responde 404 a quien no es de la cita.
 */
export type PaymentReceiptsMode = 'paciente' | 'revisor';

/** Cómo se dice cada estado y con qué tono. */
const PRESENTACION: Readonly<Record<PaymentReceiptStatus, { label: string; tono: BadgeVariant }>> = {
  PENDING: { label: 'Esperando revisión', tono: 'warning' },
  CONFIRMED: { label: 'Confirmado', tono: 'success' },
  REJECTED: { label: 'Rechazado', tono: 'error' },
};

const RECHAZO_DE_ARCHIVO = `El comprobante tiene que ser ${PAYMENT_RECEIPT_ACCEPT_LABEL} y pesar hasta ${Math.round(PAYMENT_RECEIPT_MAX_BYTES / 1024 / 1024)} MB.`;

/** La vista previa de un comprobante abierto: se baja recién al pedirla. */
type VistaPrevia =
  | { readonly estado: 'carga' }
  | { readonly estado: 'lista'; readonly archivo: File }
  | { readonly estado: 'error' };

/**
 * Los **comprobantes de pago** de una cita (v4.2.64).
 *
 * ## Un modal para los dos lados del mostrador
 *
 * El paciente y el prestador miran **la misma lista**: qué se subió, cuándo, en
 * qué quedó y por qué se rechazó. Cambia sólo lo que cada uno puede hacer con
 * ella, así que es un componente con dos modos y no dos pantallas que repitan la
 * lista y diverjan el día que se corrija una sola.
 *
 * ## Subir son dos pasos, como en el backend
 *
 * Primero el archivo entra a `common/files` (lo sube el propio paciente: la API
 * rechaza un archivo ajeno) y después se adjunta a la cita con lo que el
 * paciente declara. Si el segundo falla, el archivo queda subido y sin dueño —
 * preferible a una cita apuntando a un archivo que no existe.
 *
 * ## El archivo se baja al pedirlo
 *
 * Por la ruta de la cita (`…/content`), no por `common/files`: ésa sólo se lo da
 * a quien lo subió, y quien tiene que mirarlo es el médico. Y recién cuando se
 * pide: abrir el modal no baja cinco imágenes que nadie miró.
 *
 * ## Confirmar paga la cita
 *
 * La API deja la cita pagada en la misma transacción. Por eso el modal avisa
 * con {@link changed} y quien lo abrió relee: la insignia de pago de la fila es
 * del servidor, no de este modal.
 */
@Component({
  selector: 'app-payment-receipts-dialog',
  imports: [
    Alert,
    AppButton,
    Badge,
    ContentDialog,
    DatePipe,
    FileInput,
    FilePreview,
    FormField,
    Input,
    Spinner,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './payment-receipts-dialog.html',
  styleUrl: './payment-receipts-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentReceiptsDialog implements OnInit {
  private readonly receipts = inject(PaymentReceiptsClient);
  private readonly files = inject(FilesClient);
  private readonly toasts = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** La cita cuyos comprobantes se miran. */
  readonly bookingId = input.required<string>();

  /** La cita en palabras, para el encabezado: «la cita del lunes 3 a las 09:30». */
  readonly cita = input.required<string>();

  readonly mode = input.required<PaymentReceiptsMode>();

  /**
   * Si la cita admite un comprobante nuevo: no cancelada y sin pagar.
   *
   * Lo sabe quien abre el modal, que tiene la cita. Es cortesía: la API responde
   * 422 o 409 igual si la pantalla se equivoca.
   */
  readonly canUpload = input(true);

  /** Se cerró el modal. */
  readonly closed = output<void>();

  /**
   * Cambió algo de la cita: se subió, confirmó o rechazó un comprobante.
   *
   * Viaja el pago nuevo cuando se confirmó, para quien quiera usarlo; quien abrió
   * el modal igual debería releer, que es lo que hace la agenda.
   */
  readonly changed = output<PaymentStateInfo | null>();

  protected readonly accept = PAYMENT_RECEIPT_ACCEPT;
  protected readonly maxSizeBytes = PAYMENT_RECEIPT_MAX_BYTES;
  protected readonly maxText = MAX_RECEIPT_TEXT_LENGTH;
  protected readonly minRechazo = MIN_RECEIPT_REJECTION_LENGTH;

  protected readonly comprobantes = signal<ViewState<readonly PaymentReceipt[]>>(loading());

  /* -- subir --------------------------------------------------------------- */

  protected readonly elegidos = signal<readonly File[]>([]);
  protected readonly monto = signal<string | number | null>('');
  protected readonly nota = signal('');
  protected readonly subiendo = signal(false);
  protected readonly errorDeSubida = signal<string | null>(null);

  /* -- revisar ------------------------------------------------------------- */

  /** El comprobante sobre el que hay una acción en curso. */
  protected readonly operando = signal<string | null>(null);
  /** El comprobante cuyo rechazo se está escribiendo. */
  protected readonly rechazando = signal<string | null>(null);
  protected readonly motivo = signal('');
  protected readonly errorDeRevision = signal<string | null>(null);

  /**
   * Hay una escritura en vuelo: subir, confirmar o rechazar.
   *
   * Mientras dure, el modal no se deja cerrar. Cerrarlo en medio dejaba la
   * respuesta sin nadie que la recibiera: la API ya había pagado la cita y la
   * agenda seguía diciendo «Sin registrar», que invita a marcarla otra vez.
   */
  protected readonly ocupado = computed(() => this.subiendo() || this.operando() !== null);

  /** Cada lectura lleva un número: sólo vale la respuesta de la última. */
  private lectura = 0;

  /** Las vistas previas abiertas, por comprobante. */
  protected readonly vistas = signal<ReadonlyMap<string, VistaPrevia>>(new Map());

  protected readonly titulo = computed(() =>
    this.mode() === 'paciente' ? 'Comprobante de pago' : 'Comprobantes de pago',
  );

  protected readonly descripcion = computed(() =>
    this.mode() === 'paciente'
      ? `Lo que pagó por ${this.cita()}. Su profesional revisa cada comprobante y le avisa.`
      : `Lo que subió el paciente por ${this.cita()}. Confirmar uno deja la cita pagada.`,
  );

  protected readonly lista = computed<readonly PaymentReceipt[]>(() => {
    const estado = this.comprobantes();
    return estado.status === 'ready' ? estado.data : [];
  });

  protected readonly sinComprobantes = computed(
    () => this.comprobantes().status === 'ready' && this.lista().length === 0,
  );

  /** Uno esperando revisión: subir otro encima sólo duplicaría el trabajo del médico. */
  protected readonly hayPendiente = computed(() =>
    this.lista().some((c) => c.status === 'PENDING'),
  );

  protected readonly hayConfirmado = computed(() =>
    this.lista().some((c) => c.status === 'CONFIRMED'),
  );

  /**
   * Si se ofrece el formulario de subida.
   *
   * Manda el pago de la cita (`canUpload`), no la historia: un comprobante
   * confirmado y un pago que después se volvió atrás admiten otro, como la API.
   */
  protected readonly ofreceSubir = computed(
    () =>
      this.mode() === 'paciente' &&
      this.canUpload() &&
      this.comprobantes().status === 'ready' &&
      !this.hayPendiente(),
  );

  /** El monto escrito, o `''`. El `app-input` puede devolverlo como número. */
  private readonly montoEscrito = computed(() => String(this.monto() ?? '').trim().replace(',', '.'));

  protected readonly montoInvalido = computed(() => {
    const valor = this.montoEscrito();
    return valor !== '' && !RECEIPT_AMOUNT_PATTERN.test(valor);
  });

  protected readonly puedeEnviar = computed(
    () => this.elegidos().length === 1 && !this.montoInvalido() && !this.subiendo(),
  );

  protected readonly motivoValido = computed(
    () => this.motivo().trim().length >= MIN_RECEIPT_REJECTION_LENGTH,
  );

  ngOnInit(): void {
    this.cargar();
  }

  /**
   * Lee la lista. Al releer tras una acción **no pasa por «cargando»**: borrar
   * la lista desmontaba el botón que tenía el foco y lo tiraba al `body`. Y una
   * respuesta que llega después de otra más nueva se descarta.
   */
  protected cargar(): void {
    const esta = ++this.lectura;
    if (this.comprobantes().status !== 'ready') {
      this.comprobantes.set(loading());
    }
    this.receipts
      .list(this.bookingId())
      .pipe(
        map((items) => ready(items) as ViewState<readonly PaymentReceipt[]>),
        catchError((error: unknown) => of(errorToViewState<readonly PaymentReceipt[]>(error))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((estado) => {
        if (esta === this.lectura) {
          this.comprobantes.set(estado);
        }
      });
  }

  protected presentacion(status: PaymentReceiptStatus): { label: string; tono: BadgeVariant } {
    return PRESENTACION[status];
  }

  protected cerrar(): void {
    this.closed.emit();
  }

  /* -- subir --------------------------------------------------------------- */

  protected elegir(archivos: readonly File[]): void {
    this.errorDeSubida.set(null);
    this.elegidos.set(archivos.slice(0, 1));
  }

  protected rechazarArchivo(): void {
    this.errorDeSubida.set(RECHAZO_DE_ARCHIVO);
  }

  protected enviar(): void {
    const archivo = this.elegidos()[0];
    if (archivo === undefined || !this.puedeEnviar()) {
      return;
    }
    this.subiendo.set(true);
    this.errorDeSubida.set(null);

    const monto = this.montoEscrito();
    const nota = this.nota().trim();
    const categoria = archivo.type === 'application/pdf' ? 'DOCUMENT' : 'IMAGE';

    // PHI: el comprobante dice quién pagó qué atención. Es cómo se guarda, no
    // una etiqueta, y la API lo acepta igual.
    this.files
      .upload(archivo, categoria, 'PHI')
      .pipe(
        switchMap(({ id }) =>
          this.receipts.upload(this.bookingId(), {
            fileId: id,
            ...(monto === '' ? {} : { amount: monto }),
            ...(nota === '' ? {} : { note: nota }),
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.subiendo.set(false);
          this.elegidos.set([]);
          this.monto.set('');
          this.nota.set('');
          this.toasts.success('Su profesional lo va a revisar y le avisa.', 'Comprobante enviado');
          this.changed.emit(null);
          this.cargar();
        },
        error: (causa: unknown) => {
          this.subiendo.set(false);
          this.errorDeSubida.set(
            this.mensajeDeFallo(causa, 'No pudimos enviar el comprobante. Pruebe de nuevo.'),
          );
          // Un 409 (ya pagada) o un 422 por la cita: el mundo cambió con el
          // modal abierto, y la lista y la fila tienen que ponerse al día.
          this.changed.emit(null);
          this.cargar();
        },
      });
  }

  /* -- revisar ------------------------------------------------------------- */

  protected verComprobante(comprobante: PaymentReceipt): void {
    const abiertas = new Map(this.vistas());
    if (abiertas.has(comprobante.id)) {
      abiertas.delete(comprobante.id);
      this.vistas.set(abiertas);
      return;
    }
    abiertas.set(comprobante.id, { estado: 'carga' });
    this.vistas.set(abiertas);

    this.receipts.content(this.bookingId(), comprobante.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (bytes) => {
        const archivo = new File([bytes], comprobante.originalName ?? 'Comprobante de pago', {
          type: bytes.type || comprobante.mimeType,
        });
        this.ponerVista(comprobante.id, { estado: 'lista', archivo });
      },
      error: () => this.ponerVista(comprobante.id, { estado: 'error' }),
    });
  }

  protected confirmar(comprobante: PaymentReceipt): void {
    if (this.operando() !== null) {
      return;
    }
    this.operando.set(comprobante.id);
    this.errorDeRevision.set(null);

    this.receipts.confirm(this.bookingId(), comprobante.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ paymentState }) => {
        this.operando.set(null);
        this.toasts.success('La cita quedó pagada.', 'Comprobante confirmado');
        this.changed.emit(paymentState);
        this.cargar();
      },
      error: (causa: unknown) => this.fallarRevision(causa, 'No pudimos confirmar el comprobante.'),
    });
  }

  protected empezarRechazo(comprobante: PaymentReceipt): void {
    this.errorDeRevision.set(null);
    this.motivo.set('');
    this.rechazando.set(comprobante.id);
  }

  protected cancelarRechazo(): void {
    this.rechazando.set(null);
    this.motivo.set('');
  }

  protected rechazar(comprobante: PaymentReceipt): void {
    if (this.operando() !== null || !this.motivoValido()) {
      return;
    }
    this.operando.set(comprobante.id);
    this.errorDeRevision.set(null);

    this.receipts
      .reject(this.bookingId(), comprobante.id, this.motivo().trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.operando.set(null);
          this.rechazando.set(null);
          this.motivo.set('');
          this.toasts.success('El paciente va a ver el motivo y puede subir otro.', 'Comprobante rechazado');
          this.changed.emit(null);
          this.cargar();
        },
        error: (causa: unknown) => this.fallarRevision(causa, 'No pudimos rechazar el comprobante.'),
      });
  }

  private fallarRevision(causa: unknown, generico: string): void {
    this.operando.set(null);
    this.errorDeRevision.set(this.mensajeDeFallo(causa, generico));
    // 409: otro lo revisó con el modal abierto. Se relee para mostrar en qué quedó.
    this.changed.emit(null);
    this.cargar();
  }

  /**
   * Qué decir cuando una escritura falla, según lo que pasó de verdad (M34).
   *
   * - 409/422/400: el mensaje del servidor, que explica algo que la persona
   *   entiende («la cita ya está pagada»).
   * - Sin conexión, sin permiso o cita que ya no existe: dicho así, porque
   *   «pruebe de nuevo» sería falso.
   * - Cualquier otro: el genérico **con el ID de la petición** (S9), que es lo
   *   que soporte necesita para encontrarla.
   */
  private mensajeDeFallo(causa: unknown, generico: string): string {
    const estado = errorToViewState<null>(causa);
    switch (estado.status) {
      case 'validation': {
        const mensajes = estado.issues.map((issue) => issue.message).filter((m) => m.trim() !== '');
        return mensajes.length === 0 ? generico : mensajes.join(' ');
      }
      case 'offline':
        return 'No hay conexión. Cuando vuelva, pruebe de nuevo.';
      case 'forbidden':
        return estado.message ?? 'No tiene permiso para hacer esto en esta cita.';
      case 'not-found':
        return 'La cita o el comprobante ya no existen.';
      case 'error':
        return `${generico} Si se repite, avise a soporte con este código: ${estado.requestId}.`;
      default:
        return generico;
    }
  }

  private ponerVista(id: string, vista: VistaPrevia): void {
    // Si se cerró mientras bajaba, no se vuelve a abrir sola.
    if (!this.vistas().has(id)) {
      return;
    }
    const abiertas = new Map(this.vistas());
    abiertas.set(id, vista);
    this.vistas.set(abiertas);
  }
}
