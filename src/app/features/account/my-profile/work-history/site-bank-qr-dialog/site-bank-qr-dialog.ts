import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';

import { FilesClient } from '../../../../../core/data-access/files/files.client';
import { UPLOAD_MAX_BYTES } from '../../../../../core/data-access/files/upload-policy';
import { PracticeSitesClient } from '../../../../../core/data-access/practice-sites/practice-sites.client';
import type { PracticeSite } from '../../../../../core/data-access/practice-sites/practice-sites.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Spinner } from '../../../../../shared/components/atoms/spinner/spinner';
import { Tooltip } from '../../../../../shared/components/atoms/tooltip/tooltip';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FileInput, type RejectedFile } from '../../../../../shared/components/molecules/file-input/file-input';
import { ToastService } from '../../../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../../../shared/components/organisms/content-dialog/content-dialog';

/**
 * Los formatos que se admiten para un QR.
 *
 * Un subconjunto de `UPLOAD_ACCEPT`, que además incluye PDF: un QR dentro de un
 * PDF no se puede mostrar en este modal ni escanear desde la pantalla, así que
 * ofrecerlo sería aceptar una carga que después no sirve para lo único que esto
 * hace. GIF queda fuera por lo mismo que el PDF, al revés: nada que se anime es
 * un QR fotografiado.
 */
export const BANK_QR_ACCEPT = 'image/jpeg,image/png,image/webp';

/** Lo que se dice cuando el archivo soltado no pasa. */
const RECHAZO = `La imagen tiene que ser JPG, PNG o WEBP y pesar menos de ${Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)} MB.`;

/**
 * El **QR bancario de una sede**: verlo, cargarlo la primera vez y cambiarlo.
 *
 * ## Por qué es por sede y no del profesional
 *
 * Porque no se cobra igual en todos lados. Un médico que atiende en su
 * consultorio y además en una clínica no recauda por la misma cuenta en los
 * dos: en el consultorio cobra él, y en la clínica puede cobrar la clínica.
 * Un QR único de perfil lo obligaría a corregirlo cada vez que cambia de
 * establecimiento, que es exactamente el error que se corrige tarde y mal.
 *
 * ## Un modal y no un campo más del formulario del consultorio
 *
 * El formulario de «Dónde atiendo» corrige **el consultorio propio**: nombre,
 * dirección, municipio y punto. El QR se configura también en el hospital donde
 * el profesional atiende sin ser dueño de la sede, donde ese formulario no
 * existe — lo que se guarda ahí no es la sede, es con qué cobra él en ella.
 *
 * ## Los dos estados, y por qué el vacío no se disfraza
 *
 * Sin QR, el modal **es** la zona de soltar: no hay nada que mirar y esconder
 * la carga detrás de un botón agregaría un clic a la única acción posible. Con
 * QR cargado se muestra la imagen y el lápiz de la esquina abre la misma zona
 * para reemplazarla; volver atrás no borra nada, porque cambiarlo es subir uno
 * nuevo y no «vaciar y después cargar».
 *
 * ## La imagen se baja autenticada
 *
 * `GET /common/files/:id/content` exige `Authorization` y un `<img src>` no
 * manda cabeceras, así que la imagen llega como `data:` URL por
 * `FilesClient.imageDataUrl` — el mismo camino que la foto de perfil, y por el
 * mismo motivo: la URL firmada del backend no es una URL de navegador.
 */
@Component({
  selector: 'app-site-bank-qr-dialog',
  imports: [Alert, AppButton, ContentDialog, FileInput, Spinner, Tooltip],
  templateUrl: './site-bank-qr-dialog.html',
  styleUrl: './site-bank-qr-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteBankQrDialog implements OnInit {
  private readonly files = inject(FilesClient);
  private readonly sites = inject(PracticeSitesClient);
  private readonly toasts = inject(ToastService);

  /** La sede cuyo QR se está mirando. */
  readonly site = input.required<PracticeSite>();

  /** Se cerró el modal. */
  readonly closed = output<void>();

  /** Se guardó un QR nuevo; viaja su `fileId` para que la lista se actualice. */
  readonly saved = output<string>();

  protected readonly accept = BANK_QR_ACCEPT;
  protected readonly maxSizeBytes = UPLOAD_MAX_BYTES;

  /** El QR vigente, o `null` si la sede todavía no tiene ninguno. */
  protected readonly fileId = signal<string | null>(null);

  /** La imagen del QR vigente, lista para un `src`. */
  protected readonly imagen = signal<string | null>(null);
  protected readonly bajandoImagen = signal(false);

  /**
   * Si se está pidiendo una imagen nueva aunque ya haya una.
   *
   * Arranca en `true` sin QR: ahí el modal **es** la zona de soltar.
   */
  protected readonly reemplazando = signal(false);

  protected readonly subiendo = signal(false);
  protected readonly error = signal<string | null>(null);

  /** `app-file-input` lleva su propio arreglo de lo elegido. */
  protected readonly elegidos = signal<readonly File[]>([]);

  /** Si toca dibujar la zona de soltar en vez de la imagen. */
  protected readonly pidiendoImagen = computed(
    () => this.fileId() === null || this.reemplazando(),
  );

  protected readonly titulo = computed(() => `QR bancario · ${this.site().name}`);

  ngOnInit(): void {
    const inicial = this.site().bankQrFileId ?? null;
    this.fileId.set(inicial);
    if (inicial !== null) {
      this.bajarImagen(inicial);
    }
  }

  /** Pide una imagen nueva sin descartar la que ya está guardada. */
  protected reemplazar(): void {
    this.error.set(null);
    this.reemplazando.set(true);
  }

  /** Vuelve a mirar el QR guardado, descartando el reemplazo a medias. */
  protected cancelarReemplazo(): void {
    this.elegidos.set([]);
    this.error.set(null);
    this.reemplazando.set(false);
  }

  /**
   * Sube lo elegido y lo deja como QR de la sede.
   *
   * Dos pasos porque el backend son dos: el archivo entra al sistema y recién
   * después se le dice a la sede cuál es el suyo. Si el segundo falla, el
   * archivo queda subido y sin dueño — preferible a dejar a la sede apuntando
   * a un id que no existe.
   */
  protected subir(archivos: readonly File[]): void {
    const archivo = archivos[0];
    if (archivo === undefined || this.subiendo()) {
      return;
    }
    this.subiendo.set(true);
    this.error.set(null);

    this.files.upload(archivo, 'IMAGE', 'NORMAL').subscribe({
      next: ({ id }) => this.asociar(id),
      error: (causa: unknown) => this.fallar(causa),
    });
  }

  /** El archivo no pasó `accept` o el tope de tamaño. */
  protected rechazar(descartados: readonly RejectedFile[]): void {
    if (descartados.length === 0) {
      return;
    }
    this.error.set(RECHAZO);
  }

  protected cerrar(): void {
    this.closed.emit();
  }

  private asociar(fileId: string): void {
    this.sites.setSiteBankQr(this.site().id, fileId).subscribe({
      next: () => {
        this.subiendo.set(false);
        this.elegidos.set([]);
        this.reemplazando.set(false);
        this.fileId.set(fileId);
        this.bajarImagen(fileId);
        this.toasts.success(
          `Tus pacientes de ${this.site().name} van a pagar con este QR.`,
          'QR guardado',
        );
        this.saved.emit(fileId);
      },
      error: (causa: unknown) => this.fallar(causa),
    });
  }

  private fallar(causa: unknown): void {
    this.subiendo.set(false);
    const estado = errorToViewState<null>(causa);
    this.error.set(
      estado.status === 'validation'
        ? estado.issues.map((issue) => issue.message).join(' ')
        : 'No pudimos guardar el QR. Probá de nuevo.',
    );
  }

  /**
   * Baja la imagen del QR.
   *
   * Un fallo acá no es un error del modal: el QR **está** configurado, lo que
   * no se pudo es dibujarlo. Se deja `imagen` en `null` y la plantilla ofrece
   * cargar otro, que es lo único accionable desde acá.
   */
  private bajarImagen(fileId: string): void {
    this.bajandoImagen.set(true);
    this.imagen.set(null);
    this.files.imageDataUrl(fileId).subscribe({
      next: (dataUrl) => {
        this.bajandoImagen.set(false);
        this.imagen.set(dataUrl);
      },
      error: () => this.bajandoImagen.set(false),
    });
  }
}
