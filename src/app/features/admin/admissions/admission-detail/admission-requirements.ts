import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type {
  AdmissionDocument,
  AdmissionRequirement,
  AdmissionReviewItem,
  RequirementDecision,
  RequirementsSummary,
} from '@core/data-access/admissions/admissions.types';
import {
  formatBytes,
  missingMandatory,
  mimeLabel,
  progressText,
  reasonCodeLabel,
  requirementStatusLabel,
  requirementStatusVariant,
} from '@shared/admissions/admission-presentation';
import { AppButton } from '@shared/components/atoms/button/button';
import { Badge } from '@shared/components/atoms/badge/badge';
import { NavIcon } from '@shared/components/atoms/nav-icon/nav-icon';
import { EmptyState } from '@shared/components/molecules/empty-state/empty-state';

/** Cuántas fichas se listan por requisito antes de «Ver todas». */
export const ITEMS_VISIBLE = 4;

/** Qué pidió quien revisa: una decisión sobre UNA ficha de un requisito. */
export interface RequirementReviewRequest {
  /** La ficha (matrícula, título…): se vuelve a buscar en la ficha vigente al abrir el formulario. */
  readonly itemId: string;
  readonly requirementCode: string;
  readonly decision: RequirementDecision;
}

/**
 * La lista de requisitos de la admisión: lo principal de la revisión.
 *
 * Cada requisito dice qué es, si es obligatorio y en qué estado está; debajo,
 * una fila por ficha que el médico declaró (cada matrícula, cada título), con
 * su documento, la fuente que declaró quien la verificó y sus tres decisiones:
 * «Verificar», «Rechazar» y «Pedir información». Cada ficha se revisa por
 * separado: un título verificado no verifica al siguiente. Las decisiones se
 * piden acá y las resuelve el anfitrión (formulario con fuente o motivo,
 * petición, recarga).
 */
@Component({
  selector: 'app-admission-requirements',
  imports: [AppButton, Badge, DatePipe, EmptyState, NavIcon],
  templateUrl: './admission-requirements.html',
  styleUrl: './admission-requirements.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdmissionRequirements {
  readonly requirements = input.required<readonly AdmissionRequirement[]>();
  readonly documents = input.required<readonly AdmissionDocument[]>();
  /** El avance que calculó la API, a nivel de requisito. */
  readonly summary = input.required<RequirementsSummary>();
  readonly canReview = input(false);
  readonly busy = input(false);
  /** Requisito resaltado (llegó desde el formulario o el carrusel). */
  readonly highlight = input<string | null>(null);

  readonly review = output<RequirementReviewRequest>();
  readonly viewDocument = output<string>();
  readonly viewField = output<string>();

  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected readonly progress = computed(() => {
    const resumen = this.summary();
    return {
      ...resumen,
      text: progressText(resumen),
      ratio: resumen.total === 0 ? 0 : resumen.verified / resumen.total,
    };
  });
  protected readonly missing = computed(() => missingMandatory(this.requirements()));

  protected documentOf(item: AdmissionReviewItem): AdmissionDocument | null {
    return item.fileId === null ? null : (this.documents().find((d) => d.fileId === item.fileId) ?? null);
  }

  protected visibleItems(requirement: AdmissionRequirement): readonly AdmissionReviewItem[] {
    return this.expanded().has(requirement.code) ? requirement.items : requirement.items.slice(0, ITEMS_VISIBLE);
  }

  protected toggle(requirement: AdmissionRequirement): void {
    this.expanded.update((actual) => {
      const next = new Set(actual);
      if (next.has(requirement.code)) next.delete(requirement.code);
      else next.add(requirement.code);
      return next;
    });
  }

  protected isExpanded(requirement: AdmissionRequirement): boolean {
    return this.expanded().has(requirement.code);
  }

  protected statusText(state: string): string {
    return requirementStatusLabel(state);
  }

  protected variant(state: string) {
    return requirementStatusVariant(state);
  }

  protected docMeta(doc: AdmissionDocument): string {
    return `${mimeLabel(doc.mimeType)} · ${formatBytes(doc.sizeBytes)}`;
  }

  protected isLink(value: string | null): boolean {
    return value !== null && /^https?:\/\//i.test(value);
  }

  protected reasonText(code: string | null): string {
    return reasonCodeLabel(code);
  }

  /** Una ficha se puede revisar cuando la admisión se tomó y la ficha ya tiene su revisión. */
  protected reviewable(item: AdmissionReviewItem): boolean {
    return this.canReview() && item.id !== null && item.rowVersion !== null;
  }

  protected decide(requirement: AdmissionRequirement, item: AdmissionReviewItem, decision: RequirementDecision): void {
    if (!this.busy() && this.reviewable(item)) {
      this.review.emit({ itemId: item.itemId, requirementCode: requirement.code, decision });
    }
  }
}
