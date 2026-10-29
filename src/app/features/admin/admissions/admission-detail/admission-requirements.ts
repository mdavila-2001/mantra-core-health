import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type {
  AdmissionDocument,
  AdmissionRequirement,
  RequirementDecision,
} from '@core/data-access/admissions/admissions.types';
import {
  formatBytes,
  missingMandatory,
  mimeLabel,
  progressText,
  requirementStatusLabel,
  reasonCodeLabel,
  requirementStatusVariant,
  sourceTypeLabel,
} from '@shared/admissions/admission-presentation';
import { AppButton } from '@shared/components/atoms/button/button';
import { Badge } from '@shared/components/atoms/badge/badge';
import { NavIcon } from '@shared/components/atoms/nav-icon/nav-icon';
import { EmptyState } from '@shared/components/molecules/empty-state/empty-state';

/** Cuántos documentos se listan por requisito antes de «Ver todos». */
export const DOCUMENTS_VISIBLE = 4;

export interface RequirementReviewRequest {
  readonly requirementId: string;
  readonly decision: RequirementDecision;
}

/**
 * La lista de requisitos de la admisión: lo principal de la revisión.
 *
 * Cada requisito dice qué es, si es obligatorio, qué datos y documentos subió
 * el médico, en qué estado está y quién lo revisó con qué fuente. Las tres
 * decisiones —«Verificar», «Rechazar», «Pedir información»— se piden acá y las
 * resuelve el anfitrión (formulario con fuente o motivo, petición, recarga).
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
  readonly canReview = input(false);
  readonly busy = input(false);
  /** Requisito resaltado (llegó desde el formulario o el carrusel). */
  readonly highlight = input<string | null>(null);

  readonly review = output<RequirementReviewRequest>();
  readonly viewDocument = output<string>();
  readonly viewField = output<string>();

  private readonly expanded = signal<ReadonlySet<string>>(new Set());

  protected readonly progress = computed(() => {
    const todos = this.requirements();
    const summary = {
      total: todos.length,
      verified: todos.filter((r) => r.status === 'VERIFIED').length,
      rejected: todos.filter((r) => r.status === 'REJECTED').length,
      pending: todos.filter((r) => r.status === 'PENDING' || r.status === 'INFO_REQUIRED').length,
    };
    return { ...summary, text: progressText(summary), ratio: summary.total === 0 ? 0 : summary.verified / summary.total };
  });
  protected readonly missing = computed(() => missingMandatory(this.requirements()));

  protected documentsOf(code: string): readonly AdmissionDocument[] {
    return this.documents().filter((d) => d.requirementCode === code);
  }

  protected visibleDocuments(requirement: AdmissionRequirement): readonly AdmissionDocument[] {
    const todos = this.documentsOf(requirement.code);
    return this.expanded().has(requirement.id) ? todos : todos.slice(0, DOCUMENTS_VISIBLE);
  }

  protected hiddenCount(requirement: AdmissionRequirement): number {
    return this.expanded().has(requirement.id)
      ? 0
      : Math.max(0, this.documentsOf(requirement.code).length - DOCUMENTS_VISIBLE);
  }

  protected toggle(requirement: AdmissionRequirement): void {
    this.expanded.update((actual) => {
      const next = new Set(actual);
      if (next.has(requirement.id)) next.delete(requirement.id);
      else next.add(requirement.id);
      return next;
    });
  }

  protected isExpanded(requirement: AdmissionRequirement): boolean {
    return this.expanded().has(requirement.id);
  }

  protected statusText(requirement: AdmissionRequirement): string {
    return requirementStatusLabel(requirement.status);
  }

  protected variant(requirement: AdmissionRequirement) {
    return requirementStatusVariant(requirement.status);
  }

  protected docMeta(doc: AdmissionDocument): string {
    return `${mimeLabel(doc.mimeType)} · ${formatBytes(doc.sizeBytes)}`;
  }

  protected isLink(value: string | null): boolean {
    return value !== null && /^https?:\/\//i.test(value);
  }

  protected sourceTypeText(code: string): string {
    return sourceTypeLabel(code);
  }

  protected reasonText(code: string | null): string {
    return reasonCodeLabel(code);
  }

  protected decide(requirement: AdmissionRequirement, decision: RequirementDecision): void {
    if (!this.busy()) this.review.emit({ requirementId: requirement.id, decision });
  }
}
