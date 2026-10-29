import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type {
  AdmissionDocument,
  AdmissionRequirement,
  RequirementDecision,
  SubmittedFormField,
  SubmittedFormSection,
} from '@core/data-access/admissions/admissions.types';
import { requirementStatusLabel, requirementStatusVariant } from '@shared/admissions/admission-presentation';
import { AppButton } from '@shared/components/atoms/button/button';
import { Badge } from '@shared/components/atoms/badge/badge';
import { Alert } from '@shared/components/molecules/alert/alert';
import { EmptyState } from '@shared/components/molecules/empty-state/empty-state';

interface LinkedRequirement {
  readonly requirement: AdmissionRequirement;
  readonly documents: number;
}

interface SectionView {
  readonly section: SubmittedFormSection;
  readonly linked: readonly LinkedRequirement[];
}

/**
 * Lo que el médico envió, como el formulario de registro ya rellenado: solo
 * lectura, por secciones. Es la única pantalla que muestra el documento y los
 * contactos completos (la bandeja los enmascara).
 *
 * Cada campo dice si falta cuando es obligatorio —no se inventa ningún dato— y
 * cada requisito ligado a la sección enlaza a su evidencia y se puede
 * verificar o rechazar desde ahí, con la misma lógica que la lista de
 * requisitos.
 */
@Component({
  selector: 'app-admission-submitted-form',
  imports: [Alert, AppButton, Badge, EmptyState],
  templateUrl: './admission-submitted-form.html',
  styleUrl: './admission-submitted-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdmissionSubmittedForm {
  readonly sections = input.required<readonly SubmittedFormSection[]>();
  readonly requirements = input.required<readonly AdmissionRequirement[]>();
  readonly documents = input.required<readonly AdmissionDocument[]>();
  readonly canReview = input(false);
  readonly busy = input(false);
  /** Código de requisito al que se llegó desde el carrusel o la lista. */
  readonly highlight = input<string | null>(null);

  readonly review = output<{ requirementId: string; decision: RequirementDecision }>();
  readonly viewEvidence = output<string>();

  protected readonly views = computed<readonly SectionView[]>(() => {
    const porCodigo = new Map(this.requirements().map((r) => [r.code, r] as const));
    return this.sections().map((section) => {
      const codigos = [...new Set(section.fields.map((f) => f.requirementCode).filter((c): c is string => c !== null))];
      return {
        section,
        linked: codigos.flatMap((codigo) => {
          const requirement = porCodigo.get(codigo);
          return requirement === undefined
            ? []
            : [{ requirement, documents: this.documents().filter((d) => d.requirementCode === codigo).length }];
        }),
      };
    });
  });

  protected readonly missingRequired = computed(() =>
    this.sections().flatMap((s) => s.fields.filter((f) => f.required && this.isEmpty(f)).map((f) => f.label)),
  );

  protected isEmpty(field: SubmittedFormField): boolean {
    return field.value === null || field.value.trim() === '';
  }

  protected requirementOf(field: SubmittedFormField): AdmissionRequirement | null {
    return field.requirementCode === null
      ? null
      : (this.requirements().find((r) => r.code === field.requirementCode) ?? null);
  }

  protected statusLabel(r: AdmissionRequirement): string {
    return requirementStatusLabel(r.status);
  }

  protected variant(r: AdmissionRequirement) {
    return requirementStatusVariant(r.status);
  }

  protected mapUrl(value: string | null): string | null {
    if (value === null) return null;
    const [lat, lng] = value.split(',').map((n) => Number(n.trim()));
    if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
  }

  protected decide(requirement: AdmissionRequirement, decision: RequirementDecision): void {
    if (!this.busy()) this.review.emit({ requirementId: requirement.id, decision });
  }
}
