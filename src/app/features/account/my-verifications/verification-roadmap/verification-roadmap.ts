import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import type { VerificationStatus } from '../../../../shared/components/atoms/verification-badge/verification-badge.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';
import type { RoadmapStep } from '../my-verifications.model';
import { SealPreview } from '../seal-preview/seal-preview';

/** A step plus its position in the full roadmap (for the screen-reader label). */
interface NumberedStep {
  readonly step: RoadmapStep;
  readonly n: number;
}

/**
 * «Hoja de ruta» tab of «Mis verificaciones» (presentational).
 *
 * Built around one question: what is the single next thing to do? A progress
 * ring, one primary call to action for the next pending step, the required
 * steps apart from the optional ones, and a preview of the seal patients see.
 * It decides no state: every step comes from `buildRoadmap` (API-driven).
 */
@Component({
  selector: 'app-verification-roadmap',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    NavIcon,
    NgTemplateOutlet,
    RouterLink,
    SealPreview,
    StatusSeal,
  ],
  templateUrl: './verification-roadmap.html',
  styleUrl: './verification-roadmap.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationRoadmap {
  readonly steps = input.required<readonly RoadmapStep[]>();
  /** Requests still waiting for an answer (institutions + insurers). */
  readonly pending = input(0);
  /** Status labels could not be read: steps say «Sin dato». */
  readonly labelsFailed = input(false);

  readonly retry = output<void>();
  readonly openRequests = output<void>();

  private readonly numbered = computed<readonly NumberedStep[]>(() =>
    this.steps().map((step, i) => ({ step, n: i + 1 })),
  );
  protected readonly required = computed(() => this.numbered().filter((s) => !s.step.optional));
  protected readonly optional = computed(() => this.numbered().filter((s) => s.step.optional));

  protected readonly approved = computed(
    () => this.steps().filter((s) => s.state === 'approved').length,
  );
  protected readonly requiredApproved = computed(
    () => this.required().filter((s) => s.step.state === 'approved').length,
  );
  protected readonly percent = computed(() =>
    Math.round((this.approved() / (this.steps().length || 1)) * 100),
  );
  protected readonly requiredDone = computed(
    () => this.required().length > 0 && this.requiredApproved() === this.required().length,
  );

  /** The first step the person can act on: required ones first. */
  protected readonly next = computed<RoadmapStep | null>(() => {
    const actionable = (s: NumberedStep) => s.step.state !== 'approved' && !!s.step.action;
    return (this.required().find(actionable) ?? this.optional().find(actionable))?.step ?? null;
  });

  /** Seal preview: what the public profile shows today for the profile step. */
  protected readonly badgeStatus = computed<VerificationStatus>(() => {
    const profile = this.steps().find((s) => s.key === 'profile')?.state;
    if (profile === 'approved') return 'VERIFIED';
    if (profile === 'expired') return 'EXPIRED';
    return profile === 'pending' || profile === 'in-review' ? 'IN_REVIEW' : 'UNVERIFIED';
  });
}
