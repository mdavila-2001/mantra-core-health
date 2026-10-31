import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { accessFailureOf } from '../../../../core/data-access/access-governance/access-errors';
import { AccessLifecycleClient } from '../../../../core/data-access/access-governance/access-lifecycle.client';
import type {
  HandoverPreview,
  OffboardResult,
  SuspensionReasonCode,
  SuspensionResult,
} from '../../../../core/data-access/access-governance/access-lifecycle.types';
import { SupportAccessClient } from '../../../../core/data-access/support-access/support-access.client';
import type { SupportEngagement } from '../../../../core/data-access/support-access/support-access.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { engagementStatusText, formatDateTime } from '../../../support-access/support-labels';
import { AccessChallengeService } from '../../access-challenge/access-challenge.service';
import {
  countsOf,
  EMPTY_HANDOVER_DRAFT,
  handoverIssues,
  toHandover,
  type HandoverDraft,
} from '../handover-form/handover-draft';
import { HandoverForm } from '../handover-form/handover-form';
import { handoverKindHelp, handoverKindText, SUSPENSION_REASON_OPTIONS } from '../lifecycle.labels';
import {
  peopleOfEngagements,
  recipientOptions,
  type Person,
  type PersonOption,
} from '../lifecycle.people';

interface OffboardData {
  readonly engagement: SupportEngagement;
  readonly preview: HandoverPreview | null;
  readonly people: readonly Person[];
}

type Step = 1 | 2 | 3;
const MIN_REASON = 5;

/**
 * **Dar de baja con traspaso, suspender y reactivar** (CONTRATO-GOBIERNO §6.1, §9.5).
 *
 * - **Baja** en tres pasos: *qué tiene en las manos* → *¿a quién se lo pasa?* → *confirmar*. El acceso termina **ahora**:
 *   primero se revoca y recién después se reasigna; si el traspaso falla, la baja ya es firme y el caso queda abierto. Las
 *   citas se mantienen. «Solo dar de baja ahora» corta primero y deja el traspaso para el caso.
 * - **Suspender** es inmediato y sin aprobación (reduce acceso); los permisos quedan guardados.
 * - **Reactivar** pide cuatro ojos: queda pendiente hasta que otra persona lo apruebe.
 *
 * La pantalla pide; el efecto lo decide la API.
 */
@Component({
  selector: 'app-offboard-engagement',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Card,
    FormField,
    HandoverForm,
    PageHeader,
    RouterLink,
    Select,
    Tab,
    Tabs,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './offboard-dialog.html',
  styleUrl: './offboard-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffboardEngagement implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly lifecycle = inject(AccessLifecycleClient);
  private readonly support = inject(SupportAccessClient);
  private readonly challenges = inject(AccessChallengeService);
  private readonly session = inject(SessionStore);

  private readonly engagementId = this.route.snapshot.paramMap.get('engagementId') ?? '';

  protected readonly state = signal<ViewState<OffboardData>>(loading());
  protected readonly tab = signal(0);
  protected readonly step = signal<Step>(1);
  protected readonly draft = signal<HandoverDraft>(EMPTY_HANDOVER_DRAFT);
  protected readonly attempted = signal(false);
  protected readonly reason = signal('');
  protected readonly busy = signal<string | null>(null);
  protected readonly failure = signal('');
  protected readonly offboarded = signal<OffboardResult | null>(null);

  protected readonly suspendCode = signal<string | null>('MANUAL');
  protected readonly suspendNote = signal('');
  protected readonly reactivateReason = signal('');
  protected readonly suspendDone = signal<SuspensionResult | null>(null);
  protected readonly reactivateDone = signal<SuspensionResult | null>(null);
  protected readonly lifeFailure = signal('');
  protected readonly lifeAttempted = signal(false);

  protected readonly suspensionOptions: readonly SelectOption<string>[] =
    SUSPENSION_REASON_OPTIONS.map((o) => ({
      value: o.value,
      label: o.label,
      description: o.description,
    }));

  private readonly me = computed<Person | null>(() => {
    const userId = this.session.userId();
    return userId === null ? null : { userId, name: this.session.displayName() ?? 'usted' };
  });

  protected readonly data = computed<OffboardData | null>(() => {
    const current = this.state();
    return current.status === 'ready' ? current.data : null;
  });

  protected readonly title = computed(
    () => `Baja y suspensión: ${this.data()?.engagement.personName ?? 'persona del equipo'}`,
  );
  protected readonly breadcrumbs = computed(() => [
    { label: 'Equipo de apoyo', routerLink: '/administration/support-team' },
    { label: this.data()?.engagement.personName ?? 'Persona' },
    { label: 'Baja y suspensión' },
  ]);

  protected readonly options = computed<readonly PersonOption[]>(() => {
    const d = this.data();
    return d === null ? [] : recipientOptions(d.people, d.engagement.userId, this.me());
  });

  protected readonly summary = computed(() => {
    const d = this.data();
    return d?.preview === null || d === null
      ? []
      : countsOf(d.preview).map(({ kind, count }) => ({
          kind,
          text: `${count} ${handoverKindText(kind, count)}`,
          help: handoverKindHelp(kind),
        }));
  });

  protected readonly issues = computed(() => {
    const d = this.data();
    return d?.preview === null || d === null ? [] : handoverIssues(this.draft(), d.preview);
  });

  protected readonly reasonError = computed(() =>
    this.attempted() && this.reason().trim().length < MIN_REASON
      ? `Escriba al menos ${MIN_REASON} caracteres: queda en el registro.`
      : '',
  );
  protected readonly reactivateError = computed(() =>
    this.lifeAttempted() && this.reactivateReason().trim().length < MIN_REASON
      ? `Escriba al menos ${MIN_REASON} caracteres.`
      : '',
  );
  protected readonly isEnded = computed(() => this.data()?.engagement.status === 'ENDED');
  protected readonly isSuspended = computed(() => this.data()?.engagement.status === 'SUSPENDED');
  protected readonly statusText = engagementStatusText;
  protected readonly dateTime = formatDateTime;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.state.set(loading());
    this.support.listEngagements().subscribe({
      next: ({ items }) => {
        const engagement = items.find((e) => e.id === this.engagementId);
        if (engagement === undefined) {
          this.state.set(
            notFound({ label: 'Volver al equipo de apoyo', route: '/administration/support-team' }),
          );
          return;
        }
        if (engagement.status === 'ENDED' && this.offboarded() === null) {
          this.state.set(
            empty(
              { label: 'Volver al equipo de apoyo', route: '/administration/support-team' },
              'Esta persona ya está dada de baja: no hay nada más que hacer con su acceso.',
            ),
          );
          return;
        }
        forkJoin({
          preview:
            engagement.status === 'ENDED'
              ? of(null)
              : this.lifecycle.handoverPreview(engagement.id).pipe(catchError(() => of(null))),
        }).subscribe(({ preview }) => {
          this.state.set(ready({ engagement, preview, people: peopleOfEngagements(items) }));
        });
      },
      error: (error: unknown) => this.state.set(errorToViewState<OffboardData>(error)),
    });
  }

  /* ---- baja ---------------------------------------------------------------------------------------------------- */

  protected next(): void {
    if (this.step() === 2) {
      this.attempted.set(true);
      if (this.issues().length > 0) return;
      this.attempted.set(false);
    }
    this.step.update((s) => (s === 3 ? 3 : ((s + 1) as Step)));
  }

  protected back(): void {
    this.step.update((s) => (s === 1 ? 1 : ((s - 1) as Step)));
  }

  protected offboard(withHandover: boolean): void {
    const d = this.data();
    this.attempted.set(true);
    if (d === null || this.busy() !== null || this.reason().trim().length < MIN_REASON) return;
    if (withHandover && this.issues().length > 0) {
      this.step.set(2);
      return;
    }
    const request = {
      reason: this.reason().trim(),
      handover: withHandover && d.preview !== null ? toHandover(this.draft(), d.preview) : null,
    };
    this.busy.set('offboard');
    this.failure.set('');
    this.challenges
      .run(() => this.lifecycle.offboard(d.engagement.id, request), {
        actionLabel: `Dar de baja a ${d.engagement.personName}`,
      })
      .subscribe({
        next: (outcome) => {
          this.busy.set(null);
          this.offboarded.set(outcome);
          this.load();
        },
        error: (error: unknown) => {
          this.busy.set(null);
          const known = accessFailureOf(error);
          if (known?.reason === 'HANDOVER_SUPERVISOR_REQUIRED') this.step.set(2);
          this.failure.set(known?.message ?? 'No pudimos dar de baja. Vuelva a intentarlo.');
        },
      });
  }

  /* ---- suspender y reactivar ------------------------------------------------------------------------------------- */

  protected suspend(): void {
    const d = this.data();
    const code = this.suspendCode();
    if (d === null || code === null || this.busy() !== null) return;
    this.busy.set('suspend');
    this.lifeFailure.set('');
    const request = {
      reasonCode: code as SuspensionReasonCode,
      ...(this.suspendNote().trim() === '' ? {} : { note: this.suspendNote().trim() }),
    };
    this.challenges
      .run(() => this.lifecycle.suspend(d.engagement.id, request), {
        actionLabel: `Suspender a ${d.engagement.personName}`,
      })
      .subscribe({
        next: (outcome) => {
          this.busy.set(null);
          this.suspendDone.set(outcome);
          this.reactivateDone.set(null);
          this.suspendNote.set('');
          this.load();
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.lifeFailure.set(
            accessFailureOf(error)?.message ?? 'No pudimos suspender. Vuelva a intentarlo.',
          );
        },
      });
  }

  protected reactivate(): void {
    const d = this.data();
    this.lifeAttempted.set(true);
    if (d === null || this.busy() !== null || this.reactivateReason().trim().length < MIN_REASON)
      return;
    this.busy.set('reactivate');
    this.lifeFailure.set('');
    const request = { reason: this.reactivateReason().trim() };
    this.challenges
      .run(() => this.lifecycle.reactivate(d.engagement.id, request), {
        actionLabel: `Reactivar a ${d.engagement.personName}`,
      })
      .subscribe({
        next: (outcome) => {
          this.busy.set(null);
          this.reactivateDone.set(outcome);
          this.suspendDone.set(null);
          this.reactivateReason.set('');
          this.lifeAttempted.set(false);
          this.load();
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.lifeFailure.set(
            accessFailureOf(error)?.message ??
              'No pudimos pedir la reactivación. Vuelva a intentarlo.',
          );
        },
      });
  }
}
