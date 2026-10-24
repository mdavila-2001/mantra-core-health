import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  ElementRef,
  inject,
  input,
  linkedSignal,
  model,
  output,
  PLATFORM_ID,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Tooltip } from '../../../../../shared/components/atoms/tooltip/tooltip';
import { inertBackground, trapTabKey } from '../../../../../shared/a11y/modal-focus';
import { formatearTamano } from '../../../../../core/data-access/files/upload-policy';
import { typeName as mimeTypeName } from '../../../../../core/messaging/attachment-metadata';
import {
  type AttachmentDraft,
  attachmentKind,
  createDraft,
  isEditableImage,
  MAX_DRAFTS,
  partitionFiles,
  rejectionReason,
} from '../attachment-draft';
import { type EditorTool, ImageEditor } from '../image-editor/image-editor';
import { PDF_PAGE_COUNTER } from './pdf-page-count';

/**
 * La vista previa de lo que se va a mandar, como la de WhatsApp Web: tapa el
 * hilo entero, muestra el archivo grande sobre un fondo neutro y abajo deja
 * escribir el pie de foto, cambiar de archivo, sumar más y enviar.
 *
 * ## Qué es del composer y qué es de acá
 *
 * La lista de borradores es del composer (`[(drafts)]`): él sabe cuándo se
 * abre, cuándo se manda y qué pasa con el texto que ya había escrito. Acá se
 * edita esa lista —pie de foto, archivo editado, uno que se quita o se suma—
 * y se avisa `send` o `discard`. El envío no pasa por este componente.
 *
 * ## Por qué es una capa del hilo y no un `<dialog>` nativo
 *
 * Por lo mismo que la hoja de contacto: `showModal()` la sacaría a la capa
 * superior y taparía la bandeja. Se apoya en el hilo (`position: absolute`
 * contra el host del hilo) y hace a mano lo que haría el modal: lo de atrás
 * queda inerte, `Tab` da la vuelta adentro y el foco vuelve de donde vino.
 */
@Component({
  selector: 'app-attachment-preview',
  imports: [AppButton, ImageEditor, Tooltip],
  templateUrl: './attachment-preview.html',
  styleUrl: './attachment-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': 'vista-previa-titulo',
    'data-testid': 'composer-vista-previa',
    '(keydown)': 'handleKeydown($event)',
    '(dragover)': 'dragOver($event)',
    '(drop)': 'drop($event)',
  },
})
export class AttachmentPreview {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly countPages = inject(PDF_PAGE_COUNTER);

  /** Los archivos esperando salir. Nunca vacía mientras la vista está abierta. */
  readonly drafts = model.required<readonly AttachmentDraft[]>();
  /** Lo que quedó afuera al elegir, si algo; se muestra al abrir. */
  readonly notice = input('');

  readonly send = output<void>();
  readonly discard = output<void>();

  private readonly caption = viewChild<ElementRef<HTMLTextAreaElement>>('caption');
  private readonly picker = viewChild<ElementRef<HTMLInputElement>>('picker');

  protected readonly maxDrafts = MAX_DRAFTS;
  private readonly selectedId = signal<string | null>(null);
  protected readonly editing = signal<EditorTool | null>(null);
  protected readonly error = linkedSignal(() => this.notice());
  protected readonly pages = signal<Readonly<Record<string, number>>>({});

  /** El que se ve en grande. Si se quitó el elegido, el primero que quede. */
  protected readonly selected = computed<AttachmentDraft | null>(() => {
    const drafts = this.drafts();
    return drafts.find((draft) => draft.id === this.selectedId()) ?? drafts.at(0) ?? null;
  });

  protected readonly selectedIndex = computed(() => {
    const selected = this.selected();
    return selected === null ? -1 : this.drafts().indexOf(selected);
  });

  protected readonly canEdit = computed(() => {
    const selected = this.selected();
    return selected !== null && isEditableImage(selected.file);
  });

  protected readonly selectedName = computed(() => this.selected()?.file.name ?? '');
  protected readonly selectedCaption = computed(() => this.selected()?.caption ?? '');
  protected readonly canUndoEdit = computed(() => (this.selected()?.history.length ?? 0) > 0);

  /** Fotos y videos se suman con fotos y videos; documentos, con documentos. */
  protected readonly acceptMore = computed(() =>
    this.drafts().some((draft) => attachmentKind(draft.file) === 'document') ? '*/*' : 'image/*,video/*',
  );

  protected readonly sendLabel = computed(() => {
    const count = this.drafts().length;
    return count > 1 ? `Enviar ${count} archivos` : 'Enviar';
  });

  /**
   * Las URL `blob:` de las miniaturas, una por archivo. Se revocan cuando el
   * archivo deja la lista —se quitó o lo reemplazó una edición— y al cerrar.
   */
  private readonly urls = new Map<File, string>();

  /** Los PDF que ya se mandaron a contar: escribir el pie no los vuelve a abrir. */
  private readonly counting = new Set<string>();

  protected readonly kind = attachmentKind;

  constructor() {
    const document = inject(DOCUMENT);
    const returnFocusTo = document.activeElement;
    let restoreBackground: (() => void) | null = null;
    afterNextRender(() => {
      restoreBackground = inertBackground(this.host.nativeElement);
      this.caption()?.nativeElement.focus();
    });
    inject(DestroyRef).onDestroy(() => {
      // Primero se devuelve el fondo: el foco no puede volver a algo inerte.
      restoreBackground?.();
      for (const url of this.urls.values()) URL.revokeObjectURL(url);
      this.urls.clear();
      if (returnFocusTo instanceof HTMLElement && returnFocusTo.isConnected) {
        returnFocusTo.focus();
      }
    });

    effect(() => {
      const drafts = this.drafts();
      untracked(() => {
        this.releaseUnused(drafts);
        this.countMissingPages(drafts);
      });
    });
  }

  /* --- Lo que se ve -------------------------------------------------------- */

  protected urlFor(file: File): string {
    if (!this.isBrowser || typeof URL.createObjectURL !== 'function') return '';
    let url = this.urls.get(file);
    if (url === undefined) {
      url = URL.createObjectURL(file);
      this.urls.set(file, url);
    }
    return url;
  }

  /** «12 páginas · PDF · 1.3 MB», con lo que se sepa. */
  protected documentDetail(draft: AttachmentDraft): string {
    const parts: string[] = [];
    const pages = this.pages()[draft.id];
    if (pages !== undefined) parts.push(pages === 1 ? '1 página' : `${pages} páginas`);
    parts.push(this.typeName(draft.file));
    parts.push(formatearTamano(draft.file.size));
    return parts.join(' · ');
  }

  /** La sigla de la tarjeta del documento: PDF, MP3, la extensión. */
  protected documentBadge(file: File): string {
    if (file.type === 'application/pdf') return 'PDF';
    const extension = /\.([a-z0-9]{1,5})$/i.exec(file.name)?.[1];
    return (extension ?? file.type.split('/')[1] ?? 'DOC').toUpperCase().slice(0, 4);
  }

  protected documentTone(file: File): 'pdf' | 'audio' | 'otro' {
    if (file.type === 'application/pdf') return 'pdf';
    return file.type.startsWith('audio/') ? 'audio' : 'otro';
  }

  protected thumbnailLabel(draft: AttachmentDraft, index: number): string {
    return `Archivo ${index + 1} de ${this.drafts().length}: ${draft.file.name}`;
  }

  /* --- Acciones ------------------------------------------------------------ */

  protected select(draft: AttachmentDraft): void {
    this.selectedId.set(draft.id);
    this.editing.set(null);
  }

  protected updateCaption(caption: string): void {
    const selected = this.selected();
    if (selected === null) return;
    this.drafts.update((drafts) => drafts.map((draft) => (draft.id === selected.id ? { ...draft, caption } : draft)));
  }

  protected remove(draft: AttachmentDraft): void {
    const remaining = this.drafts().filter((item) => item.id !== draft.id);
    if (remaining.length === 0) {
      this.discard.emit();
      return;
    }
    this.drafts.set(remaining);
    this.caption()?.nativeElement.focus();
  }

  protected edit(tool: EditorTool): void {
    if (this.canEdit()) this.editing.set(tool);
  }

  /** La edición vuelve como un archivo nuevo, que reemplaza al que había. */
  protected applyEdit(file: File): void {
    const selected = this.selected();
    this.editing.set(null);
    this.focusCaptionSoon();
    if (selected === null) return;
    // La misma puerta que al elegir: una foto exportada a PNG puede pasar el
    // tope, y eso se dice acá y no cuando la subida ya falló.
    const reason = rejectionReason(file);
    if (reason !== null) {
      this.error.set(`No se pudo usar la edición: ${reason}`);
      return;
    }
    this.error.set('');
    this.drafts.update((drafts) =>
      drafts.map((draft) =>
        draft.id === selected.id ? { ...draft, file, history: [...draft.history, draft.file] } : draft,
      ),
    );
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.focusCaptionSoon();
  }

  /** Vuelve a la versión de antes de la última edición aplicada. */
  protected undoEdit(): void {
    const selected = this.selected();
    const previous = selected?.history.at(-1);
    if (selected === null || previous === undefined) return;
    this.drafts.update((drafts) =>
      drafts.map((draft) =>
        draft.id === selected.id ? { ...draft, file: previous, history: draft.history.slice(0, -1) } : draft,
      ),
    );
    // Sin más historia el botón se apaga con el foco encima: se lo lleva al pie.
    if (selected.history.length === 1) this.focusCaptionSoon();
  }

  protected openPicker(): void {
    const picker = this.picker()?.nativeElement;
    if (picker === undefined) return;
    picker.accept = this.acceptMore();
    picker.click();
  }

  protected picked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.add(files);
  }

  protected submit(): void {
    if (this.editing() === null && this.drafts().length > 0) this.send.emit();
  }

  /* --- Teclado y arrastre -------------------------------------------------- */

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.discard.emit();
      return;
    }
    trapTabKey(event, this.host.nativeElement);
  }

  protected captionKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submit();
    }
  }

  protected dragOver(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
  }

  protected drop(event: DragEvent): void {
    event.preventDefault();
    this.add(Array.from(event.dataTransfer?.files ?? []));
  }

  /* --- Internos ------------------------------------------------------------ */

  private add(files: readonly File[]): void {
    // Soltar archivos mientras se edita cambiaría la imagen bajo el editor y
    // la edición en curso se perdería sin aviso.
    if (files.length === 0 || this.editing() !== null) return;
    const { accepted, rejection } = partitionFiles(files, MAX_DRAFTS - this.drafts().length);
    this.error.set(rejection ?? '');
    if (accepted.length === 0) return;
    const added = accepted.map((file) => createDraft(file));
    this.drafts.update((drafts) => [...drafts, ...added]);
    this.selectedId.set(added[0].id);
  }

  /** Una vuelta después: el pie de foto reaparece cuando el editor ya se fue. */
  private focusCaptionSoon(): void {
    setTimeout(() => this.caption()?.nativeElement.focus(), 0);
  }

  private releaseUnused(drafts: readonly AttachmentDraft[]): void {
    const alive = new Set(drafts.map((draft) => draft.file));
    for (const [file, url] of this.urls) {
      if (!alive.has(file)) {
        URL.revokeObjectURL(url);
        this.urls.delete(file);
      }
    }
  }

  private countMissingPages(drafts: readonly AttachmentDraft[]): void {
    if (!this.isBrowser) return;
    for (const draft of drafts) {
      if (draft.file.type !== 'application/pdf' || this.counting.has(draft.id)) continue;
      this.counting.add(draft.id);
      void this.countPages(draft.file).then((count) => {
        if (count !== null) this.pages.update((pages) => ({ ...pages, [draft.id]: count }));
      });
    }
  }

  /** «PDF», «Audio»… Nunca el tipo MIME crudo: eso no lo lee nadie. */
  private typeName(file: File): string {
    const name = file.type === '' ? '' : mimeTypeName(file.type);
    if (name !== '' && name !== file.type) return name;
    if (file.type.startsWith('audio/')) return 'Audio';
    if (file.type.startsWith('video/')) return 'Video';
    return 'Documento';
  }
}

