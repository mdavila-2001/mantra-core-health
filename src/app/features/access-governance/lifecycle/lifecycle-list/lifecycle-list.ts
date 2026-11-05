import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
  type OnInit,
  type TemplateRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { accessFailureOf } from '../../../../core/data-access/access-governance/access-errors';
import { AccessGovernanceClient } from '../../../../core/data-access/access-governance/access-governance.client';
import { AccessLifecycleClient } from '../../../../core/data-access/access-governance/access-lifecycle.client';
import type {
  LifecycleCaseKind,
  LifecycleCaseQuery,
  LifecycleCaseStatus,
} from '../../../../core/data-access/access-governance/access-governance.types';
import { SupportAccessClient } from '../../../../core/data-access/support-access/support-access.client';
import {
  SUPPORT_ROLE_TEMPLATE_LABELS,
  type SupportRoleTemplateCode,
} from '../../../../core/data-access/support-access/support-access.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready, stale } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { formatDay } from '../../../support-access/support-labels';
import {
  caseKindLabel,
  caseKindTone,
  caseStatusLabel,
  caseStatusTone,
  dueText,
  ownerlessReasonText,
} from '../lifecycle.labels';
import {
  nameOfUser,
  peopleOfEngagements,
  recipientOptions,
  type Person,
} from '../lifecycle.people';

type StatusFilter = LifecycleCaseStatus | '';
type KindFilter = LifecycleCaseKind | '';

export interface CaseRow {
  readonly id: string;
  readonly engagementId: string;
  readonly person: string;
  readonly kind: string;
  readonly status: string;
  readonly openedAt: string;
  readonly dueAt?: string;
}

interface OwnerlessView {
  readonly engagementId: string;
  readonly userId: string;
  readonly name: string;
  readonly role: string;
  readonly reason: string;
}

const STATUS_OPTIONS: readonly SegmentedOption<StatusFilter>[] = [
  { value: 'OPEN', label: 'Abiertos' },
  { value: 'COMPLETED', label: 'Completados' },
  { value: '', label: 'Todos' },
];

const KIND_OPTIONS: readonly SelectOption<KindFilter>[] = [
  { value: '', label: 'Todos los tipos' },
  { value: 'JOINER', label: 'Ingreso' },
  { value: 'MOVER', label: 'Cambio de rol o alcance' },
  { value: 'LEAVER', label: 'Baja' },
  { value: 'SUSPENSION', label: 'Suspensión' },
  { value: 'REACTIVATION', label: 'Reactivación' },
];

/**
 * **Ciclo de vida del equipo** (CONTRATO-GOBIERNO §6.1, §9.3 fila 9): los casos de ingreso, cambio, baja, suspensión y
 * reactivación con su plazo, y las **cuentas sin dueño** con la acción «Asignar dueño».
 *
 * Esta pantalla solo lee y pide; lo que pasa lo decide la API. Si una recarga falla con datos ya a la vista, se muestran
 * como atrasados (S7) con su antigüedad.
 */
@Component({
  selector: 'app-lifecycle-list',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    Card,
    DataTable,
    PageHeader,
    RouterLink,
    SegmentedControl,
    Select,
    ViewStateHost,
  ],
  templateUrl: './lifecycle-list.html',
  styleUrl: './lifecycle-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LifecycleList implements OnInit {
  private readonly lifecycle = inject(AccessLifecycleClient);
  private readonly governance = inject(AccessGovernanceClient);
  private readonly support = inject(SupportAccessClient);
  private readonly session = inject(SessionStore);

  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly kindOptions = KIND_OPTIONS;
  protected readonly status = signal<StatusFilter>('OPEN');
  protected readonly kind = signal<KindFilter>('');
  protected readonly state = signal<ViewState<readonly CaseRow[]>>(loading());
  protected readonly ownerless = signal<ViewState<readonly OwnerlessView[]>>(loading());
  protected readonly ownerlessRows = computed<readonly OwnerlessView[]>(() => {
    const current = this.ownerless();
    return current.status === 'ready' || current.status === 'stale' ? current.data : [];
  });
  protected readonly owners = signal<Readonly<Record<string, string>>>({});
  protected readonly ownerErrors = signal<Readonly<Record<string, string>>>({});
  protected readonly assigning = signal<string | null>(null);
  protected readonly notice = signal('');
  protected readonly people = signal<readonly Person[]>([]);

  private lastGood: readonly CaseRow[] | null = null;
  private lastAt = new Date();

  private readonly caseCell = viewChild.required<TemplateRef<{ $implicit: CaseRow }>>('caseCell');
  private readonly kindCell = viewChild.required<TemplateRef<{ $implicit: CaseRow }>>('kindCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: CaseRow }>>('statusCell');
  private readonly dueCell = viewChild.required<TemplateRef<{ $implicit: CaseRow }>>('dueCell');
  private readonly actionsCell =
    viewChild.required<TemplateRef<{ $implicit: CaseRow }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<CaseRow>[]>(() => [
    { key: 'person', header: 'Persona', priority: 1, cell: this.caseCell() },
    { key: 'kind', header: 'Tipo', priority: 1, cell: this.kindCell() },
    { key: 'status', header: 'Estado', priority: 2, cell: this.statusCell() },
    { key: 'due', header: 'Plazo', priority: 3, cell: this.dueCell() },
    { key: 'actions', header: 'Acciones', priority: 1, accion: true, cell: this.actionsCell() },
  ]);

  protected readonly rowId = (row: CaseRow): string => row.id;
  protected readonly rowLabel = (row: CaseRow): string =>
    `${caseKindLabel(row.kind)} de ${row.person}`;

  private readonly me = computed<Person | null>(() => {
    const userId = this.session.userId();
    return userId === null ? null : { userId, name: this.session.displayName() ?? 'usted' };
  });

  protected readonly kindLabel = caseKindLabel;
  protected readonly kindTone = caseKindTone;
  protected readonly statusLabel = caseStatusLabel;
  protected readonly statusTone = caseStatusTone;
  protected readonly day = formatDay;
  protected due = (row: CaseRow) =>
    row.status === 'OPEN' ? dueText(row.dueAt) : { text: '—', overdue: false };

  ngOnInit(): void {
    this.load();
    this.loadOwnerless();
  }

  protected setStatus(value: StatusFilter): void {
    this.status.set(value);
    this.load();
  }

  protected setKind(value: KindFilter | null): void {
    this.kind.set(value ?? '');
    this.load();
  }

  protected load(): void {
    const query: LifecycleCaseQuery = {
      ...(this.kind() === '' ? {} : { kind: this.kind() as LifecycleCaseKind }),
      ...(this.status() === '' ? {} : { status: this.status() as LifecycleCaseStatus }),
    };
    this.state.set(loading());
    forkJoin({
      cases: this.lifecycle.listCases(query),
      engagements: this.support.listEngagements().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ cases, engagements }) => {
        if (engagements !== null) this.people.set(peopleOfEngagements(engagements.items));
        const names = new Map((engagements?.items ?? []).map((e) => [e.id, e.personName]));
        const rows = cases.items.map((c): CaseRow => ({
          id: c.id,
          engagementId: c.engagementId,
          person: names.get(c.engagementId) ?? nameOfUser(this.people(), c.subjectUserId),
          kind: c.kind,
          status: c.status,
          openedAt: c.openedAt,
          ...(c.dueAt === undefined ? {} : { dueAt: c.dueAt }),
        }));
        this.lastGood = rows;
        this.lastAt = new Date();
        this.state.set(
          rows.length === 0
            ? empty(
                { label: 'Ver el equipo de apoyo', route: '/administration/support-team' },
                this.status() === 'OPEN' && this.kind() === ''
                  ? 'No hay casos abiertos. Se abren solos cuando alguien ingresa, cambia de rol, se va o se suspende.'
                  : 'Ningún caso coincide con lo que eligió.',
              )
            : ready(rows),
        );
      },
      error: (failure: unknown) =>
        this.state.set(
          this.lastGood === null
            ? errorToViewState<readonly CaseRow[]>(failure)
            : stale(this.lastGood, this.lastAt),
        ),
    });
  }

  protected loadOwnerless(): void {
    this.ownerless.set(loading());
    this.governance.getOwnerless().subscribe({
      next: (report) => {
        const people = this.people();
        const rows = report.items.map((item): OwnerlessView => ({
          engagementId: item.engagementId,
          userId: item.userId,
          name: nameOfUser(people, item.userId),
          role:
            item.templateCode === undefined
              ? ''
              : (SUPPORT_ROLE_TEMPLATE_LABELS[item.templateCode as SupportRoleTemplateCode] ?? ''),
          reason: ownerlessReasonText(item.reasons),
        }));
        this.ownerless.set(
          rows.length === 0
            ? empty(
                { label: 'Ver el tablero de gobierno', route: '/administration/access-governance' },
                'Todas las cuentas tienen responsable.',
              )
            : ready(rows),
        );
      },
      error: (failure: unknown) =>
        this.ownerless.set(errorToViewState<readonly OwnerlessView[]>(failure)),
    });
  }

  protected ownerOptionsFor(row: OwnerlessView): readonly SelectOption<string>[] {
    return recipientOptions(this.people(), row.userId, this.me());
  }

  protected ownerOf(row: OwnerlessView): string | null {
    return this.owners()[row.engagementId] ?? null;
  }

  protected chooseOwner(row: OwnerlessView, userId: string | null): void {
    this.owners.update((current) => ({ ...current, [row.engagementId]: userId ?? '' }));
  }

  protected assignOwner(row: OwnerlessView): void {
    const owner = this.ownerOf(row);
    if (owner === null || owner === '' || this.assigning() !== null) {
      this.ownerErrors.update((current) => ({
        ...current,
        [row.engagementId]: 'Elija quién será responsable de la cuenta.',
      }));
      return;
    }
    this.assigning.set(row.engagementId);
    this.ownerErrors.update((current) => ({ ...current, [row.engagementId]: '' }));
    this.lifecycle.putOwner(row.engagementId, { supervisorUserId: owner }).subscribe({
      next: () => {
        this.assigning.set(null);
        this.notice.set(
          `Listo: ${nameOfUser(this.people(), owner, this.me() ?? undefined)} es ahora responsable de la cuenta de ${row.name}.`,
        );
        this.loadOwnerless();
        this.load();
      },
      error: (failure: unknown) => {
        this.assigning.set(null);
        this.ownerErrors.update((current) => ({
          ...current,
          [row.engagementId]:
            accessFailureOf(failure)?.message ??
            'No pudimos asignar al dueño. Vuelva a intentarlo.',
        }));
      },
    });
  }
}
