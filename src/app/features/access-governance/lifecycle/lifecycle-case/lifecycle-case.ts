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
  LifecycleCaseDetail,
  LifecycleCaseExport,
} from '../../../../core/data-access/access-governance/access-governance.types';
import { SupportAccessClient } from '../../../../core/data-access/support-access/support-access.client';
import type { SupportEngagementStatus } from '../../../../core/data-access/support-access/support-access.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, notFound, ready, stale } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { releaseObjectUrlLater } from '../../../../shared/utils/file-download/release-object-url';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  engagementStatusText,
  formatDateTime,
  formatDay,
} from '../../../support-access/support-labels';
import {
  caseKindLabel,
  caseKindTone,
  caseStatusLabel,
  caseStatusTone,
  checklistHelp,
  checklistLabel,
  dueText,
  handoverKindText,
  handoverStatusLabel,
  handoverStatusTone,
  IDENTITY_METHOD_OPTIONS,
  isHandoverPending,
} from '../lifecycle.labels';
import {
  nameOfUser,
  peopleOfEngagements,
  recipientOptions,
  type Person,
} from '../lifecycle.people';

interface CaseView {
  readonly detail: LifecycleCaseDetail;
  readonly person: string;
  readonly engagementStatus: SupportEngagementStatus;
  readonly people: readonly Person[];
}

interface ChecklistRow {
  readonly code: string;
  readonly label: string;
  readonly help: string;
  readonly required: boolean;
  readonly done: boolean;
  readonly automatic: boolean;
  readonly completedAt?: string;
}

interface HandoverRow {
  readonly id: string;
  readonly what: string;
  readonly from: string;
  readonly to: string;
  readonly status: string;
  readonly when: string;
}

const FALLBACK_FAILURE = 'No pudimos completar la operación. Vuelva a intentarlo.';

/**
 * **Un caso de ciclo de vida** (CONTRATO-GOBIERNO §6.1, §9.3 fila 9): la lista de verificación con lo que falta y cómo se
 * completa cada paso, el traspaso (de quién a quién, y lo que sigue pendiente) y el registro de transferencia exportable.
 *
 * Una sola tarjeta con pestañas. Cada acción pide a la API y **recarga el caso**: lo que se ve es lo que quedó guardado.
 * Los pasos automáticos no tienen botón (los completa el sistema) y el compromiso de confidencialidad lo acepta la propia
 * persona, no la administración.
 */
@Component({
  selector: 'app-lifecycle-case',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    Card,
    FormField,
    PageHeader,
    RouterLink,
    Select,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './lifecycle-case.html',
  styleUrl: './lifecycle-case.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifecycleCase implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly lifecycle = inject(AccessLifecycleClient);
  private readonly support = inject(SupportAccessClient);
  private readonly session = inject(SessionStore);

  protected readonly state = signal<ViewState<CaseView>>(loading());
  protected readonly tab = signal(0);
  protected readonly busy = signal<string | null>(null);
  protected readonly notice = signal('');
  protected readonly failure = signal('');
  protected readonly identityMethod = signal<string | null>('IN_PERSON');
  protected readonly owner = signal<string | null>(null);
  protected readonly recipient = signal<string | null>(null);
  protected readonly exported = signal<LifecycleCaseExport | null>(null);

  protected readonly identityOptions: readonly SelectOption<string>[] = IDENTITY_METHOD_OPTIONS;

  private lastGood: CaseView | null = null;
  private lastAt = new Date();

  private readonly caseId = this.route.snapshot.paramMap.get('caseId') ?? '';

  private readonly me = computed<Person | null>(() => {
    const userId = this.session.userId();
    return userId === null ? null : { userId, name: this.session.displayName() ?? 'usted' };
  });

  protected readonly view = computed<CaseView | null>(() => {
    const current = this.state();
    return current.status === 'ready' || current.status === 'stale' ? current.data : null;
  });

  protected readonly title = computed(() => {
    const v = this.view();
    return v === null ? 'Caso de ciclo de vida' : `${caseKindLabel(v.detail.kind)} de ${v.person}`;
  });

  protected readonly breadcrumbs = computed(() => [
    {
      label: 'Ciclo de vida del equipo',
      routerLink: '/administration/access-governance/lifecycle',
    },
    { label: this.title() },
  ]);

  protected readonly checklist = computed<readonly ChecklistRow[]>(() =>
    (this.view()?.detail.checklist ?? []).map((item) => ({
      code: item.code,
      label: checklistLabel(item.code, item.label),
      help: checklistHelp(item.code),
      required: item.required,
      done: item.status === 'DONE',
      automatic: item.completion === 'AUTOMATIC',
      ...(item.completedAt === undefined ? {} : { completedAt: item.completedAt }),
    })),
  );

  protected readonly progress = computed(() => {
    const required = this.checklist().filter((i) => i.required);
    const done = required.filter((i) => i.done).length;
    return {
      done,
      total: required.length,
      text:
        required.length === 0
          ? 'Este caso no tiene pasos por completar.'
          : `${done} de ${required.length} pasos obligatorios completos.`,
    };
  });

  protected readonly handoverRows = computed<readonly HandoverRow[]>(() => {
    const v = this.view();
    if (v === null) return [];
    return v.detail.handover.map((h) => ({
      id: h.id,
      what: handoverKindText(h.kind, 1),
      from: nameOfUser(v.people, h.fromUserId, this.me() ?? undefined),
      to:
        h.toUserId === undefined
          ? isHandoverPending(h.status)
            ? 'Sin asignar'
            : 'Bandeja común'
          : nameOfUser(v.people, h.toUserId, this.me() ?? undefined),
      status: h.status,
      when: h.reassignedAt === undefined ? '—' : formatDateTime(h.reassignedAt),
    }));
  });

  protected readonly canAssignHandover = computed(() => {
    const v = this.view();
    return v !== null && v.detail.kind === 'LEAVER' && v.detail.status === 'OPEN';
  });

  protected readonly recipientOptions = computed<readonly SelectOption<string>[]>(() => {
    const v = this.view();
    return v === null ? [] : recipientOptions(v.people, v.detail.subjectUserId, this.me());
  });

  protected readonly engagementOpen = computed(() => {
    const v = this.view();
    return v !== null && v.engagementStatus !== 'ENDED';
  });

  protected readonly kindLabel = caseKindLabel;
  protected readonly kindTone = caseKindTone;
  protected readonly statusLabel = caseStatusLabel;
  protected readonly statusTone = caseStatusTone;
  protected readonly handoverStatusLabel = handoverStatusLabel;
  protected readonly handoverStatusTone = handoverStatusTone;
  protected readonly day = formatDay;
  protected readonly dateTime = formatDateTime;
  protected readonly due = (dueAt: string | undefined) => dueText(dueAt);
  protected readonly engagementStatusText = engagementStatusText;

  ngOnInit(): void {
    this.load();
  }

  protected load(silent = false): void {
    if (!silent) this.state.set(loading());
    forkJoin({
      detail: this.lifecycle.getCase(this.caseId),
      engagements: this.support.listEngagements().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ detail, engagements }) => {
        const people = engagements === null ? [] : peopleOfEngagements(engagements.items);
        const engagement = engagements?.items.find((e) => e.id === detail.engagementId);
        const view: CaseView = {
          detail,
          people,
          person: engagement?.personName ?? nameOfUser(people, detail.subjectUserId),
          engagementStatus: engagement?.status ?? 'ACTIVE',
        };
        this.lastGood = view;
        this.lastAt = new Date();
        this.state.set(ready(view));
      },
      error: (error: unknown) => {
        const mapped = errorToViewState<CaseView>(error);
        this.state.set(
          mapped.status === 'not-found'
            ? notFound({
                label: 'Volver a los casos',
                route: '/administration/access-governance/lifecycle',
              })
            : this.lastGood === null
              ? mapped
              : stale(this.lastGood, this.lastAt),
        );
      },
    });
  }

  /* ---- acciones ----------------------------------------------------------------------------------------------- */

  private run(key: string, done: string, call: () => import('rxjs').Observable<unknown>): void {
    if (this.busy() !== null) return;
    this.busy.set(key);
    this.failure.set('');
    this.notice.set('');
    call().subscribe({
      next: () => {
        this.busy.set(null);
        this.notice.set(done);
        this.load(true);
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.failure.set(accessFailureOf(error)?.message ?? FALLBACK_FAILURE);
      },
    });
  }

  protected markDone(row: ChecklistRow): void {
    this.run(`done-${row.code}`, `Listo: «${row.label}» quedó marcado como hecho.`, () =>
      this.lifecycle.completeChecklistItem(this.caseId, row.code),
    );
  }

  protected registerIdentity(): void {
    const v = this.view();
    const method = this.identityMethod();
    if (v === null || method === null) return;
    this.run('identity', 'Listo: la verificación de identidad quedó registrada.', () =>
      this.lifecycle.verifyIdentity(v.detail.engagementId, {
        method: method as 'IN_PERSON' | 'DOCUMENT_UPLOAD',
      }),
    );
  }

  protected assignOwner(): void {
    const v = this.view();
    const owner = this.owner();
    if (v === null) return;
    if (owner === null) {
      this.failure.set('Elija quién será responsable de la cuenta.');
      return;
    }
    this.run(
      'owner',
      `Listo: ${nameOfUser(v.people, owner, this.me() ?? undefined)} es ahora responsable de la cuenta de ${v.person}.`,
      () => this.lifecycle.putOwner(v.detail.engagementId, { supervisorUserId: owner }),
    );
  }

  protected assignHandover(): void {
    const recipient = this.recipient();
    if (recipient === null) {
      this.failure.set('Elija quién recibe el trabajo pendiente.');
      return;
    }
    this.run('handover', 'Listo: el trabajo pendiente quedó reasignado.', () =>
      this.lifecycle.assignHandover(this.caseId, { defaultToUserId: recipient }),
    );
  }

  protected exportCase(): void {
    if (this.busy() !== null) return;
    this.busy.set('export');
    this.failure.set('');
    this.lifecycle.exportCase(this.caseId).subscribe({
      next: (file) => {
        this.busy.set(null);
        this.exported.set(file);
        this.notice.set('El registro de transferencia está listo.');
        this.download(file);
      },
      error: (error: unknown) => {
        this.busy.set(null);
        this.failure.set(accessFailureOf(error)?.message ?? FALLBACK_FAILURE);
      },
    });
  }

  private download(file: LifecycleCaseExport): void {
    try {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }),
      );
      const link = document.createElement('a');
      link.href = url;
      link.download = `registro-de-transferencia-${this.caseId}.json`;
      link.click();
      releaseObjectUrlLater(url);
    } catch {
      /* sin descarga automática: el resumen con la huella queda a la vista */
    }
  }
}
