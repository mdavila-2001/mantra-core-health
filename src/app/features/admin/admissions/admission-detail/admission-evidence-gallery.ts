import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  model,
  output,
  untracked,
  viewChildren,
} from '@angular/core';

import type {
  AdmissionDocument,
  AdmissionRequirement,
  AdmissionReviewItem,
  RequirementDecision,
} from '@core/data-access/admissions/admissions.types';
import {
  formatBytes,
  mimeLabel,
  shortHash,
  requirementStatusLabel,
} from '@shared/admissions/admission-presentation';
import { AppButton } from '@shared/components/atoms/button/button';
import { NavIcon } from '@shared/components/atoms/nav-icon/nav-icon';
import { EmptyState } from '@shared/components/molecules/empty-state/empty-state';
import { AdmissionDocumentViewer } from './admission-document-viewer';

/** Lo que el carrusel pide hacer sobre la ficha del documento en pantalla. */
export interface GalleryReviewRequest {
  readonly itemId: string;
  readonly requirementCode: string;
  readonly decision: RequirementDecision;
}

interface GalleryItem {
  readonly document: AdmissionDocument;
  readonly requirement: AdmissionRequirement | null;
  /** La ficha a la que pertenece el archivo: es lo que se revisa. */
  readonly item: AdmissionReviewItem | null;
  readonly position: number;
}

const PENDING_STATES = ['PENDING', 'INFO_REQUIRED'];

/**
 * El carrusel de evidencia: todo lo que el médico subió, en una sola galería.
 *
 * Vista grande al centro, tira de miniaturas, flechas, teclado (←/→, Inicio,
 * Fin, Esc), deslizar con el dedo, contador «3 de 12» y filtro por requisito
 * y por estado. Sobre cada documento, el requisito al que pertenece y su
 * estado —con punto y texto, no solo color— y las tres decisiones de la
 * revisión, con la misma lógica que la lista de requisitos.
 *
 * No decide nada por sí mismo: emite `review` y quien lo aloja abre el
 * formulario, manda la petición y recarga. Al terminar, incrementa
 * `advanceToken` y el carrusel salta al siguiente documento por revisar.
 *
 * El estado de selección y de filtros es del anfitrión (`model`), para que el
 * mismo carrusel pueda verse en la pestaña o ampliado en un diálogo sin
 * perder el lugar.
 */
@Component({
  selector: 'app-admission-evidence-gallery',
  imports: [AdmissionDocumentViewer, AppButton, DatePipe, EmptyState, NavIcon],
  templateUrl: './admission-evidence-gallery.html',
  styleUrl: './admission-evidence-gallery.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdmissionEvidenceGallery {
  /** La admisión a la que pertenecen los documentos (el acceso queda auditado a su nombre). */
  readonly admissionId = input.required<string>();
  readonly documents = input.required<readonly AdmissionDocument[]>();
  readonly requirements = input.required<readonly AdmissionRequirement[]>();
  /** Si la admisión está en revisión y la persona puede actuar. */
  readonly canReview = input(false);
  readonly busy = input(false);
  readonly expanded = input(false);
  /** Sube cada vez que una decisión terminó: el carrusel avanza al siguiente pendiente. */
  readonly advanceToken = input(0);

  readonly selectedId = model<string | null>(null);
  readonly requirementFilter = model('');
  readonly stateFilter = model('');

  readonly review = output<GalleryReviewRequest>();
  readonly showField = output<string>();
  readonly expand = output<void>();
  readonly closeExpanded = output<void>();

  private readonly thumbs = viewChildren<ElementRef<HTMLElement>>('thumb');

  protected readonly items = computed<readonly GalleryItem[]>(() => {
    const reqs = new Map(this.requirements().map((r) => [r.code, r] as const));
    const porRequisito = this.requirementFilter();
    const porEstado = this.stateFilter();
    return this.documents()
      .filter((d) => porRequisito === '' || d.requirementCode === porRequisito)
      .filter((d) => {
        const estado = this.itemOf(reqs.get(d.requirementCode), d)?.state ?? d.reviewState;
        return porEstado === '' || estado === porEstado;
      })
      .map((document, index) => {
        const requirement = reqs.get(document.requirementCode) ?? null;
        return { document, requirement, item: this.itemOf(requirement ?? undefined, document), position: index + 1 };
      });
  });

  private itemOf(requirement: AdmissionRequirement | undefined, doc: AdmissionDocument): AdmissionReviewItem | null {
    return requirement?.items.find((i) => i.fileId === doc.fileId) ?? null;
  }

  protected readonly index = computed(() => {
    const id = this.selectedId();
    const found = this.items().findIndex((i) => i.document.id === id);
    return found >= 0 ? found : 0;
  });
  protected readonly current = computed<GalleryItem | null>(() => this.items()[this.index()] ?? null);
  protected readonly total = computed(() => this.items().length);
  protected readonly filtered = computed(
    () => this.requirementFilter() !== '' || this.stateFilter() !== '',
  );

  protected readonly requirementOptions = computed(() => {
    const cuenta = new Map<string, number>();
    for (const d of this.documents()) cuenta.set(d.requirementCode, (cuenta.get(d.requirementCode) ?? 0) + 1);
    return this.requirements()
      .filter((r) => cuenta.has(r.code))
      .map((r) => ({ code: r.code, label: `${r.label} (${cuenta.get(r.code)})` }));
  });

  protected readonly stateOptions = [
    { code: 'PENDING', label: 'Pendientes' },
    { code: 'VERIFIED', label: 'Verificados' },
    { code: 'REJECTED', label: 'Rechazados' },
    { code: 'INFO_REQUIRED', label: 'Con información requerida' },
  ] as const;

  private lastAdvance = 0;

  constructor() {
    // Si el documento elegido ya no está (otro filtro, otra versión de la
    // ficha), la selección cae en el primero en vez de quedar apuntando a nada.
    effect(() => {
      const items = this.items();
      const id = this.selectedId();
      if (items.length > 0 && !items.some((i) => i.document.id === id)) {
        untracked(() => this.selectedId.set(items[0]!.document.id));
      }
    });
    effect(() => {
      const token = this.advanceToken();
      if (token === this.lastAdvance) return;
      this.lastAdvance = token;
      untracked(() => this.goToNextPending());
    });
    // La miniatura elegida se trae a la vista dentro de la tira, sin mover la página.
    effect(() => {
      const i = this.index();
      const el = this.thumbs()[i]?.nativeElement;
      if (el !== undefined && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ block: 'nearest', inline: 'center' });
      }
    });
  }

  protected statusLabel(item: GalleryItem): string {
    return requirementStatusLabel(item.item?.state ?? item.document.reviewState);
  }

  protected statusKey(item: GalleryItem): string {
    return (item.item?.state ?? item.document.reviewState ?? 'PENDING').toLowerCase();
  }

  protected typeLabel(doc: AdmissionDocument): string {
    return mimeLabel(doc.mimeType);
  }

  protected hash(doc: AdmissionDocument): string {
    return shortHash(doc.evidenceSha256);
  }

  protected sizeLabel(doc: AdmissionDocument): string {
    return formatBytes(doc.sizeBytes);
  }

  protected shortType(doc: AdmissionDocument): string {
    return doc.mimeType === 'application/pdf' ? 'PDF' : 'IMG';
  }

  protected select(id: string): void {
    this.selectedId.set(id);
  }

  protected move(delta: number): void {
    const items = this.items();
    if (items.length === 0) return;
    const next = Math.min(items.length - 1, Math.max(0, this.index() + delta));
    this.selectedId.set(items[next]!.document.id);
  }

  protected moveTo(position: 'first' | 'last'): void {
    const items = this.items();
    if (items.length === 0) return;
    this.selectedId.set(items[position === 'first' ? 0 : items.length - 1]!.document.id);
  }

  /** El siguiente documento que todavía espera una decisión, dando la vuelta al final. */
  goToNextPending(): void {
    const items = this.items();
    if (items.length === 0) return;
    const start = this.index();
    for (let step = 1; step <= items.length; step++) {
      const candidate = items[(start + step) % items.length]!;
      const state = candidate.item?.state ?? candidate.document.reviewState ?? 'PENDING';
      if (PENDING_STATES.includes(state)) {
        this.selectedId.set(candidate.document.id);
        return;
      }
    }
  }

  protected clearFilters(): void {
    this.requirementFilter.set('');
    this.stateFilter.set('');
  }

  protected onRequirementFilter(event: Event): void {
    this.requirementFilter.set((event.target as HTMLSelectElement).value);
  }

  protected onStateFilter(event: Event): void {
    this.stateFilter.set((event.target as HTMLSelectElement).value);
  }

  /** La ficha ya tiene su revisión (la admisión se tomó): sin ella no hay a qué mandar la decisión. */
  protected reviewable(item: AdmissionReviewItem | null): boolean {
    return this.canReview() && item !== null && item.id !== null && item.rowVersion !== null;
  }

  protected decide(decision: RequirementDecision): void {
    const actual = this.current();
    if (actual?.requirement && actual.item && this.reviewable(actual.item) && !this.busy()) {
      this.review.emit({ itemId: actual.item.itemId, requirementCode: actual.requirement.code, decision });
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    // En un campo de texto o un selector las flechas son suyas.
    if (target !== null && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    switch (event.key) {
      case 'ArrowLeft':
        this.move(-1);
        break;
      case 'ArrowRight':
        this.move(1);
        break;
      case 'Home':
        this.moveTo('first');
        break;
      case 'End':
        this.moveTo('last');
        break;
      case 'Escape':
        if (this.expanded()) this.closeExpanded.emit();
        return;
      default:
        return;
    }
    event.preventDefault();
  }

  /* ---- deslizar con el dedo ------------------------------------------------ */

  private touchStartX: number | null = null;

  protected touchStart(event: TouchEvent): void {
    this.touchStartX = event.touches.length === 1 ? event.touches[0]!.clientX : null;
  }

  protected touchEnd(event: TouchEvent): void {
    const inicio = this.touchStartX;
    this.touchStartX = null;
    if (inicio === null || event.changedTouches.length === 0) return;
    // Si la imagen está ampliada y se desplaza de lado, el gesto es del
    // desplazamiento, no del carrusel.
    const escenario = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('.visor__escenario');
    if (escenario !== null && escenario.scrollWidth > escenario.clientWidth + 1) return;
    const delta = event.changedTouches[0]!.clientX - inicio;
    if (Math.abs(delta) >= 60) this.move(delta < 0 ? 1 : -1);
  }
}
