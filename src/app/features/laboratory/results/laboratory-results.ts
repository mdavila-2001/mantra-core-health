import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { DomSanitizer, type SafeResourceUrl } from '@angular/platform-browser';

import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Progress } from '../../../shared/components/atoms/progress/progress';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../shared/components/atoms/switch/switch';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Card } from '../../../shared/components/molecules/card/card';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SearchField } from '../../../shared/components/molecules/search-field/search-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type {
  LabResultFile,
  LabResultFilePage,
  LabResultKind,
  LabResultTarget,
} from '../../../core/data-access/lab-portal/lab-portal.types';
import { unavailableMessageOf } from '../../../core/data-access/simulator-only';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

import { formatBytes } from '../file-size';
import { filesFromDrop, filesFromInput } from './picked-files';
import { ResultUploadQueue, type UploadItem } from './result-upload-queue';

type ViewMode = 'grid' | 'list';
type KindFilter = LabResultKind | 'ALL';

/** Lo que el visor tiene listo para mostrar de un archivo. */
interface ViewerContent {
  readonly url: string;
  readonly safeUrl: SafeResourceUrl | null;
  readonly text: string | null;
  /** El texto se cortó: el archivo era más largo de lo que se muestra. */
  readonly truncated: boolean;
}

const KIND_LABELS: Readonly<Record<LabResultKind, string>> = {
  PDF: 'PDF',
  IMAGE: 'Imagen',
  VIDEO: 'Video',
  AUDIO: 'Audio',
  TEXT: 'Texto o datos',
  DICOM: 'DICOM',
  OTHER: 'Otro formato',
};

const KIND_OPTIONS: readonly SelectOption<KindFilter>[] = [
  { value: 'ALL', label: 'Todos los formatos' },
  { value: 'PDF', label: 'PDF' },
  { value: 'IMAGE', label: 'Imágenes' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'AUDIO', label: 'Audio' },
  { value: 'TEXT', label: 'Texto y datos (CSV, HL7, JSON…)' },
  { value: 'DICOM', label: 'DICOM' },
  { value: 'OTHER', label: 'Otros formatos' },
];

const VIEW_OPTIONS: readonly SegmentedOption<ViewMode>[] = [
  { value: 'grid', label: 'Grilla', description: 'Ver como grilla de miniaturas' },
  { value: 'list', label: 'Lista', description: 'Ver como lista detallada' },
];

const NO_ORDER = '__none__';
const VIEW_KEY = 'alovida.lab-results.view';
/** Lo más que el visor lee de un archivo de texto: el resto se descarga. */
const TEXT_PREVIEW_BYTES = 2 * 1024 * 1024;
/** Miniaturas: sólo de imágenes y hasta este tamaño, para no traer gigas a una grilla. */
const THUMBNAIL_MAX_BYTES = 15 * 1024 * 1024;

/**
 * **Resultados** del laboratorio: subir y ver.
 *
 * Arriba, la subida: cualquier formato —PDF, imágenes, DICOM, video, planillas,
 * lo que el equipo exporte— y **sin límite de tamaño**, porque cada archivo
 * viaja en partes (ver {@link ResultUploadQueue}). Se pueden soltar carpetas
 * enteras. Cada archivo se puede atar a una orden de la bandeja, y entonces se
 * avisa al médico que la pidió y al paciente (registro de procesos §2.1.9).
 *
 * Abajo, **todo lo subido**: en grilla con miniaturas o en lista, con filtros,
 * y un visor que muestra en el navegador lo que el navegador sabe mostrar
 * (PDF, imágenes, video, audio, texto) y ofrece descargar el resto.
 */
@Component({
  selector: 'app-laboratory-results',
  imports: [
    AppButton,
    Badge,
    Card,
    Checkbox,
    ContentDialog,
    DatePipe,
    FormField,
    PageHeader,
    Progress,
    SearchField,
    SegmentedControl,
    Select,
    Switch,
    Textarea,
    ViewStateHost,
  ],
  providers: [ResultUploadQueue],
  templateUrl: './laboratory-results.html',
  styleUrl: './laboratory-results.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:beforeunload)': 'warnBeforeLeaving($event)',
    '(document:keydown)': 'onViewerKey($event)',
  },
})
export class LaboratoryResults {
  private readonly lab = inject(LabPortalClient);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  protected readonly queue = inject(ResultUploadQueue);

  protected readonly formatBytes = formatBytes;
  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly viewOptions = VIEW_OPTIONS;
  protected readonly noOrder = NO_ORDER;

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  private readonly folderInput = viewChild<ElementRef<HTMLInputElement>>('folderInput');

  /* ---- subida ----------------------------------------------------------- */

  protected readonly targets = signal<ViewState<readonly LabResultTarget[]>>(loading());
  protected readonly uploadOrder = signal<string>(NO_ORDER);
  protected readonly uploadNote = signal('');
  protected readonly uploadNotify = signal(true);
  protected readonly dragging = signal(false);

  protected readonly targetOptions = computed<readonly SelectOption<string>[]>(() => [
    { value: NO_ORDER, label: 'Sin orden: archivo suelto' },
    ...(dataOf(this.targets()) ?? []).map((t) => ({
      value: t.orderId,
      label: `${t.studyName} · ${t.patientName} · ${t.requesterName}${t.fileCount > 0 ? ` (ya tiene ${t.fileCount})` : ''}`,
    })),
  ]);

  protected readonly hasOrder = computed(() => this.uploadOrder() !== NO_ORDER);

  /* ---- todo lo subido --------------------------------------------------- */

  protected readonly files = signal<ViewState<LabResultFilePage>>(loading());
  protected readonly query = signal('');
  protected readonly kind = signal<KindFilter>('ALL');
  protected readonly orderFilter = signal<string>('');
  protected readonly includeWithdrawn = signal(false);
  protected readonly view = signal<ViewMode>(readView());

  protected readonly page = computed(() => dataOf(this.files()));
  protected readonly items = computed(() => this.page()?.items ?? []);

  protected readonly orderFilterOptions = computed<readonly SelectOption<string>[]>(() => [
    { value: '', label: 'Todas las órdenes' },
    ...(dataOf(this.targets()) ?? []).map((t) => ({
      value: t.orderId,
      label: `${t.studyName} · ${t.patientName}`,
    })),
  ]);

  private readonly thumbnails = signal<ReadonlyMap<string, string>>(new Map());

  /* ---- visor ------------------------------------------------------------ */

  protected readonly viewerId = signal<string | null>(null);
  /**
   * El archivo tal como se abrió. Hace falta además del id: uno recién subido
   * desde la cola puede no estar en la lista filtrada, y el visor igual lo muestra.
   */
  private readonly viewerSnapshot = signal<LabResultFile | null>(null);
  protected readonly viewer = signal<ViewState<ViewerContent>>(loading());
  protected readonly viewerData = computed(() => dataOf(this.viewer()));
  protected readonly viewerFile = computed(
    () => this.items().find((file) => file.id === this.viewerId()) ?? this.viewerSnapshot(),
  );
  protected readonly viewerIndex = computed(() =>
    this.items().findIndex((file) => file.id === this.viewerId()),
  );

  /** Las URL de objeto vivas, para liberarlas al salir. */
  private readonly objectUrls = new Set<string>();

  constructor() {
    this.loadTargets();

    effect(() => {
      // Relee cuando cambia un filtro o termina una subida.
      this.query();
      this.kind();
      this.orderFilter();
      this.includeWithdrawn();
      this.queue.finishedCount();
      untracked(() => this.loadFiles());
    });

    effect(() => {
      if (this.queue.finishedCount() > 0) {
        untracked(() => this.loadTargets());
      }
    });

    effect(() => {
      const items = this.items();
      untracked(() => this.loadThumbnails(items));
    });

    inject(DestroyRef).onDestroy(() => {
      for (const url of this.objectUrls) {
        URL.revokeObjectURL(url);
      }
    });
  }

  /* ---- subida ----------------------------------------------------------- */

  protected chooseFiles(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected chooseFolder(): void {
    this.folderInput()?.nativeElement.click();
  }

  protected onPicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.enqueue(filesFromInput(input));
    input.value = '';
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = 'copy';
    }
    this.dragging.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    const zone = event.currentTarget as HTMLElement;
    if (!zone.contains(event.relatedTarget as Node | null)) {
      this.dragging.set(false);
    }
  }

  protected async onDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    this.dragging.set(false);
    if (event.dataTransfer === null) {
      return;
    }
    this.enqueue(await filesFromDrop(event.dataTransfer));
  }

  private enqueue(picked: ReturnType<typeof filesFromInput>): void {
    if (picked.length === 0) {
      return;
    }
    const orderId = this.hasOrder() ? this.uploadOrder() : null;
    const note = this.uploadNote().trim();
    this.queue.add(picked, {
      orderId,
      note: note === '' ? null : note,
      notify: orderId !== null && this.uploadNotify(),
    });
  }

  protected statusLabel(item: UploadItem): string {
    switch (item.status) {
      case 'queued':
        return 'En espera';
      case 'uploading':
        return item.bytesPerSecond === null
          ? 'Subiendo…'
          : `Subiendo · ${formatBytes(item.bytesPerSecond)}/s`;
      case 'paused':
        return 'En pausa';
      case 'done':
        return item.result?.notified === true ? 'Subido · se avisó al médico y al paciente' : 'Subido';
      case 'error':
        return item.error ?? 'No se pudo subir';
      case 'canceled':
        return 'Cancelado';
    }
  }

  protected percentOf(item: UploadItem): number {
    return item.file.size === 0
      ? item.status === 'done'
        ? 100
        : 0
      : Math.floor((item.sentBytes / item.file.size) * 100);
  }

  protected warnBeforeLeaving(event: BeforeUnloadEvent): void {
    if (this.queue.active()) {
      event.preventDefault();
    }
  }

  /* ---- todo lo subido --------------------------------------------------- */

  protected loadFiles(): void {
    this.files.set(loading());
    const kind = this.kind();
    this.lab
      .listResultFiles({
        q: this.query().trim() || undefined,
        kind: kind === 'ALL' ? undefined : kind,
        orderId: this.orderFilter() || undefined,
        includeWithdrawn: this.includeWithdrawn() || undefined,
      })
      .subscribe({
        next: (page) =>
          this.files.set(
            page.count === 0
              ? this.hasFilters()
                ? empty(
                    { label: 'Pruebe con otros filtros o active «Mostrar retirados»' },
                    'Ningún archivo coincide con los filtros.',
                  )
                : empty(
                    { label: 'Suelte el primer archivo en «Subir resultados», arriba' },
                    'Todavía no subió resultados.',
                  )
              : ready(page),
          ),
        error: (error: unknown) => this.files.set(errorToViewState<LabResultFilePage>(error)),
      });
  }

  protected loadTargets(): void {
    this.lab.listResultTargets().subscribe({
      next: (page) => this.targets.set(ready(page.items)),
      error: (error: unknown) => this.targets.set(errorToViewState<readonly LabResultTarget[]>(error)),
    });
  }

  private hasFilters(): boolean {
    return (
      this.query().trim() !== '' ||
      this.kind() !== 'ALL' ||
      this.orderFilter() !== '' ||
      this.includeWithdrawn()
    );
  }

  protected setView(view: ViewMode): void {
    this.view.set(view);
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Sin almacenamiento (ventana privada, bloqueado): se recuerda sólo acá.
    }
  }

  protected kindLabel(kind: LabResultKind): string {
    return KIND_LABELS[kind];
  }

  protected extensionOf(file: LabResultFile): string {
    const parts = file.fileName.split('.');
    return parts.length > 1 ? parts.pop()!.toUpperCase().slice(0, 5) : KIND_LABELS[file.kind];
  }

  protected thumbnailOf(file: LabResultFile): string | null {
    return this.thumbnails().get(file.id) ?? null;
  }

  private loadThumbnails(items: readonly LabResultFile[]): void {
    if (!this.isBrowser) {
      return;
    }
    for (const file of items) {
      if (
        file.kind !== 'IMAGE' ||
        file.status !== 'AVAILABLE' ||
        file.sizeBytes > THUMBNAIL_MAX_BYTES ||
        this.thumbnails().has(file.id)
      ) {
        continue;
      }
      this.lab.resultContent(file.id).subscribe({
        next: (blob) => {
          const url = this.track(URL.createObjectURL(blob));
          this.thumbnails.update((map) => new Map(map).set(file.id, url));
        },
        // Sin miniatura se ve el ícono del formato: no es un error que mostrar.
        error: () => undefined,
      });
    }
  }

  protected async withdraw(file: LabResultFile): Promise<void> {
    const reason = await this.dialogs.confirmWithReason(
      {
        title: 'Retirar el archivo',
        message: `«${file.fileName}» deja de estar disponible. Queda en el historial con el motivo, y se puede ver activando «Mostrar retirados».`,
        confirmLabel: 'Retirar',
        destructive: true,
      },
      { label: 'Motivo', placeholder: 'Por ejemplo: era de otro paciente', minLength: 5, maxLength: 300 },
    );
    if (reason === null) {
      return;
    }
    this.lab.withdrawResult(file.id, reason).subscribe({
      next: () => {
        this.toast.success(`Retiró ${file.fileName}.`);
        if (this.viewerId() === file.id) {
          this.closeViewer();
        }
        this.loadFiles();
        this.loadTargets();
      },
      error: (error: unknown) =>
        this.toast.error(unavailableMessageOf(error) ?? 'No se pudo retirar el archivo. Pruebe de nuevo.'),
    });
  }

  protected download(file: LabResultFile): void {
    this.lab.resultContent(file.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = this.document.createElement('a');
        link.href = url;
        link.download = file.fileName;
        link.rel = 'noopener';
        this.document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (error: unknown) =>
        this.toast.error(unavailableMessageOf(error) ?? `No se pudo descargar ${file.fileName}.`),
    });
  }

  /* ---- visor ------------------------------------------------------------ */

  protected open(file: LabResultFile): void {
    this.viewerId.set(file.id);
    this.viewerSnapshot.set(file);
    this.loadViewer(file);
  }

  protected closeViewer(): void {
    this.viewerId.set(null);
    this.viewerSnapshot.set(null);
    this.viewer.set(loading());
  }

  protected step(delta: number): void {
    const items = this.items();
    const next = items[this.viewerIndex() + delta];
    if (next !== undefined) {
      this.open(next);
    }
  }

  /** Con el visor abierto, las flechas pasan al archivo anterior o al siguiente. */
  protected onViewerKey(event: KeyboardEvent): void {
    if (this.viewerId() === null) {
      return;
    }
    // En el video o el audio las flechas mueven la reproducción.
    if ((event.target as HTMLElement | null)?.closest('video, audio')) {
      return;
    }
    if (event.key === 'ArrowRight') {
      this.step(1);
    } else if (event.key === 'ArrowLeft') {
      this.step(-1);
    }
  }

  private loadViewer(file: LabResultFile): void {
    this.viewer.set(loading());
    if (file.kind === 'DICOM' || file.kind === 'OTHER') {
      // Nada que dibujar: el visor muestra los datos y el botón de descarga.
      this.viewer.set(ready({ url: '', safeUrl: null, text: null, truncated: false }));
      return;
    }
    this.lab.resultContent(file.id).subscribe({
      next: async (blob) => {
        if (this.viewerId() !== file.id) {
          return;
        }
        if (file.kind === 'TEXT') {
          const text = await blob.slice(0, TEXT_PREVIEW_BYTES).text();
          this.viewer.set(
            ready({ url: '', safeUrl: null, text, truncated: blob.size > TEXT_PREVIEW_BYTES }),
          );
          return;
        }
        const typed =
          file.kind === 'PDF' && blob.type !== 'application/pdf'
            ? new Blob([blob], { type: 'application/pdf' })
            : blob;
        const url = this.track(URL.createObjectURL(typed));
        this.viewer.set(
          ready({
            url,
            // El `<iframe>` pide una URL de recurso confiable; la que se le da
            // es una URL de objeto que armó esta misma pantalla.
            safeUrl: file.kind === 'PDF' ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null,
            text: null,
            truncated: false,
          }),
        );
      },
      error: (error: unknown) => this.viewer.set(errorToViewState<ViewerContent>(error)),
    });
  }

  private track(url: string): string {
    this.objectUrls.add(url);
    return url;
  }
}

function readView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}
