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
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import type {
  TeamCapabilities,
  TeamMember,
  TeamRequest,
} from '../../../core/data-access/access-governance/access-governance.types';
import { TeamAdminClient } from '../../../core/data-access/access-governance/team-admin.client';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import {
  SUPPORT_ROLE_TEMPLATE_LABELS,
  type AffiliationInvitation,
  type SupportActionCode,
  type SupportCatalog,
  type SupportEngagementStatus,
  type SupportRequestItem,
  type SupportRoleTemplateCode,
} from '../../../core/data-access/support-access/support-access.types';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import {
  empty,
  loading,
  ready,
  routeAuthPending,
  stale,
} from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { Card } from '../../../shared/components/molecules/card/card';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { SupportActionPicker } from '../../support-access/support-action-picker/support-action-picker';
import {
  approveAll,
  buildDecision,
  initialDrafts,
  type ItemDraft,
  type RequestDrafts,
} from '../../support-access/support-requests/request-decision';
import {
  engagementStatusText,
  engagementStatusTone,
  expiryText,
  formatDay,
  grantLabel,
  templateLabel,
} from '../../support-access/support-labels';
import {
  describeCeiling,
  canDo,
  inviteTemplates,
  parseCapabilities,
  scopeSentence,
  type TeamAbilities,
} from './team-ceiling';
import { explainTeamFailure, type TeamFailure } from './team-failure';

interface TeamData {
  readonly abilities: TeamAbilities;
  readonly catalog: SupportCatalog | null;
  readonly members: readonly TeamMember[];
  readonly requests: readonly TeamRequest[];
}

interface MemberRow {
  readonly engagementId: string;
  readonly name: string;
  readonly role: string;
  readonly status: TeamMember['status'];
  readonly grants: number;
  readonly other: number;
}

type DecisionOption = 'APPROVED' | 'ADJUSTED' | 'REJECTED' | '';

const DECISIONS: readonly SegmentedOption<DecisionOption>[] = [
  { value: 'APPROVED', label: 'Aprobar' },
  { value: 'ADJUSTED', label: 'Ajustar' },
  { value: 'REJECTED', label: 'Rechazar' },
];

/**
 * **Mi equipo (administración delegada)** (CONTRATO-GOBIERNO §6.4, §9.3 fila 12): el jefe de servicio o de piso ve **su**
 * población y lo que puede hacer **dentro de su techo**.
 *
 * - El banner dice qué administra y qué puede dar, con las palabras de su techo (viene de `GET /org/team/capabilities`).
 * - *Personas*: solo las de su alcance; de cada una, «otras funciones» fuera de su alcance sin detalle.
 * - *Solicitudes*: decide **por ítem** lo que cae dentro de su alcance; lo demás queda pendiente para el administrador de
 *   seguridad (decisión parcial: la respuesta trae `pendingItemIds`).
 * - *Invitar*: solo los roles de su techo.
 *
 * La autoridad es la API: ocultar o deshabilitar no es seguridad. Lo que pasa del techo vuelve como 403 y se explica.
 */
@Component({
  selector: 'app-team-management',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    Card,
    DataTable,
    FormField,
    Input,
    PageHeader,
    RouterLink,
    SegmentedControl,
    Select,
    SupportActionPicker,
    Tab,
    Tabs,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './team-management.html',
  styleUrl: './team-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamManagement implements OnInit {
  private readonly team = inject(TeamAdminClient);
  private readonly support = inject(SupportAccessClient);
  private readonly session = inject(SessionStore);
  private readonly route = inject(ActivatedRoute);

  protected readonly state = signal<ViewState<TeamData>>(routeAuthPending());
  protected readonly tab = signal(0);
  protected readonly decisions = DECISIONS;

  protected readonly drafts = signal<Readonly<Record<string, RequestDrafts>>>({});
  protected readonly notes = signal<Readonly<Record<string, string>>>({});
  protected readonly attempted = signal<ReadonlySet<string>>(new Set());
  protected readonly saving = signal<string | null>(null);
  protected readonly decisionFailure = signal<TeamFailure | null>(null);
  protected readonly decisionNotice = signal('');

  protected readonly inviteTemplate = signal<string | null>(null);
  protected readonly inviteUses = signal<string | number | null>(1);
  protected readonly inviteDays = signal<string | number | null>(7);
  protected readonly inviting = signal(false);
  protected readonly inviteFailure = signal<TeamFailure | null>(null);
  protected readonly invitation = signal<AffiliationInvitation | null>(null);

  private lastGood: TeamData | null = null;
  private lastAt = new Date();

  private readonly personCell =
    viewChild.required<TemplateRef<{ $implicit: MemberRow }>>('personCell');
  private readonly statusCell =
    viewChild.required<TemplateRef<{ $implicit: MemberRow }>>('statusCell');
  private readonly scopeCell =
    viewChild.required<TemplateRef<{ $implicit: MemberRow }>>('scopeCell');
  private readonly actionsCell =
    viewChild.required<TemplateRef<{ $implicit: MemberRow }>>('actionsCell');

  protected readonly columns = computed<readonly ColumnDef<MemberRow>[]>(() => [
    { key: 'person', header: 'Persona y rol', priority: 1, cell: this.personCell() },
    { key: 'status', header: 'Estado', priority: 2, cell: this.statusCell() },
    { key: 'scope', header: 'Qué administra usted', priority: 3, cell: this.scopeCell() },
    { key: 'actions', header: 'Acciones', priority: 1, accion: true, cell: this.actionsCell() },
  ]);
  protected readonly rowId = (row: MemberRow): string => row.engagementId;
  protected readonly rowLabel = (row: MemberRow): string => `${row.name}, ${row.role}`;

  protected readonly data = computed<TeamData | null>(() => {
    const current = this.state();
    return current.status === 'ready' || current.status === 'stale' ? current.data : null;
  });

  protected readonly rowsState = computed<ViewState<readonly MemberRow[]>>(() => {
    const current = this.state();
    if (current.status !== 'ready' && current.status !== 'stale')
      return current as ViewState<readonly MemberRow[]>;
    const rows = current.data.members.map((m): MemberRow => ({
      engagementId: m.engagementId,
      name: m.personName ?? 'Una persona',
      role:
        m.roleTemplateCode === undefined
          ? 'Sin rol'
          : (SUPPORT_ROLE_TEMPLATE_LABELS[m.roleTemplateCode as SupportRoleTemplateCode] ??
            m.roleTemplateCode),
      status: m.status,
      grants: m.grants.length,
      other: m.otherFunctions,
    }));
    if (rows.length === 0)
      return empty(
        {
          label: 'Invitar a alguien',
          route: '/administration/team-management',
          queryParams: { tab: 'invite' },
        },
        'Todavía no hay personas en lo que usted administra.',
      );
    return ready(rows);
  });

  protected readonly sentence = computed(() => {
    const d = this.data();
    return d === null ? '' : scopeSentence(d.abilities);
  });
  protected readonly ceilingLines = computed(() => {
    const d = this.data();
    if (d === null || d.abilities.mode === 'FULL') return [];
    return [...new Set(d.abilities.scopes.flatMap((s) => describeCeiling(s.ceiling)))];
  });
  protected readonly canDecide = computed(() => {
    const d = this.data();
    return d !== null && canDo(d.abilities, 'team.requests.decide');
  });
  protected readonly canInvite = computed(() => {
    const d = this.data();
    return d !== null && canDo(d.abilities, 'team.invitations.create');
  });
  protected readonly templateOptions = computed<readonly SelectOption<string>[]>(() => {
    const d = this.data();
    return d === null
      ? []
      : inviteTemplates(d.abilities).map((code) => ({ value: code, label: templateLabel(code) }));
  });

  protected readonly status = (value: string): string =>
    engagementStatusText(value as SupportEngagementStatus);
  protected readonly statusTone = (value: string): BadgeVariant =>
    engagementStatusTone(value as SupportEngagementStatus);
  protected readonly day = formatDay;
  protected readonly itemLabel = (item: SupportRequestItem): string => grantLabel(item);

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    // S1: primero se comprueba qué puede hacer la persona; recién después se piden los datos.
    this.state.set(routeAuthPending());
    this.team.getCapabilities().subscribe({
      next: (capabilities) => this.loadData(capabilities),
      error: (error: unknown) =>
        this.state.set(
          this.lastGood === null
            ? errorToViewState<TeamData>(error)
            : stale(this.lastGood, this.lastAt),
        ),
    });
  }

  private loadData(capabilities: TeamCapabilities, silent = false): void {
    if (!silent) this.state.set(loading());
    const tenantId = this.session.activeTenantId();
    const catalog$ =
      this.session.isOrganizationAccount() || tenantId === null
        ? this.support.getCatalog()
        : this.support.getMyCatalog(tenantId);
    forkJoin({
      members: this.team.listMembers(),
      requests: this.team
        .listRequests()
        .pipe(catchError(() => of({ items: [] as readonly TeamRequest[], count: 0 }))),
      catalog: catalog$.pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ members, requests, catalog }) => {
        const abilities = parseCapabilities(capabilities, catalog);
        const nextDrafts = { ...this.drafts() };
        for (const request of requests.items) nextDrafts[request.id] ??= initialDrafts(request);
        this.drafts.set(nextDrafts);
        if (this.inviteTemplate() === null)
          this.inviteTemplate.set(inviteTemplates(abilities)[0] ?? null);
        const data: TeamData = {
          abilities,
          catalog,
          members: members.items,
          requests: requests.items,
        };
        this.lastGood = data;
        this.lastAt = new Date();
        this.state.set(ready(data));
        if (
          !silent &&
          this.route.snapshot.queryParamMap.get('tab') === 'invite' &&
          canDo(abilities, 'team.invitations.create')
        ) {
          this.tab.set(1 + (canDo(abilities, 'team.requests.decide') ? 1 : 0));
        }
      },
      error: (error: unknown) =>
        this.state.set(
          this.lastGood === null
            ? errorToViewState<TeamData>(error)
            : stale(this.lastGood, this.lastAt),
        ),
    });
  }

  /* ---- solicitudes: decisión por ítem ------------------------------------------------------------------------------ */

  protected draftOf(request: TeamRequest, item: SupportRequestItem): ItemDraft {
    return this.drafts()[request.id]?.[item.id] ?? { actions: item.proposedActions, comment: '' };
  }

  protected decisionOf(request: TeamRequest, item: SupportRequestItem): DecisionOption {
    return this.draftOf(request, item).decision ?? '';
  }

  private patch(request: TeamRequest, item: SupportRequestItem, changes: Partial<ItemDraft>): void {
    this.drafts.update((all) => {
      const current = all[request.id] ?? initialDrafts(request);
      return {
        ...all,
        [request.id]: {
          ...current,
          [item.id]: {
            ...(current[item.id] ?? { actions: item.proposedActions, comment: '' }),
            ...changes,
          },
        },
      };
    });
  }

  protected decide(request: TeamRequest, item: SupportRequestItem, decision: DecisionOption): void {
    if (decision !== '') this.patch(request, item, { decision });
  }

  protected adjust(
    request: TeamRequest,
    item: SupportRequestItem,
    actions: readonly SupportActionCode[],
  ): void {
    this.patch(request, item, { actions });
  }

  protected comment(request: TeamRequest, item: SupportRequestItem, comment: string): void {
    this.patch(request, item, { comment });
  }

  protected approveAllIn(request: TeamRequest): void {
    this.drafts.update((all) => ({
      ...all,
      [request.id]: approveAll(request, all[request.id] ?? initialDrafts(request)),
    }));
  }

  protected note(request: TeamRequest): string {
    return this.notes()[request.id] ?? '';
  }

  protected setNote(request: TeamRequest, value: string): void {
    this.notes.update((all) => ({ ...all, [request.id]: value }));
  }

  private check(request: TeamRequest) {
    return buildDecision(
      request,
      this.drafts()[request.id] ?? initialDrafts(request),
      (itemId) => {
        const item = request.items.find((x) => x.id === itemId);
        return item === undefined ? 'un ítem' : this.itemLabel(item);
      },
      this.note(request),
    );
  }

  protected problems(request: TeamRequest): readonly string[] {
    return this.check(request).problems;
  }

  protected showProblems(request: TeamRequest): boolean {
    return this.attempted().has(request.id);
  }

  protected save(request: TeamRequest): void {
    if (this.saving() !== null) return;
    this.attempted.update((s) => new Set([...s, request.id]));
    const { decision } = this.check(request);
    if (decision === null) return;
    this.saving.set(request.id);
    this.decisionFailure.set(null);
    this.decisionNotice.set('');
    this.team.decideRequest(request.id, decision).subscribe({
      next: (result) => {
        this.saving.set(null);
        const pending = result.pendingItemIds?.length ?? 0;
        const decided = decision.items.length;
        this.decisionNotice.set(
          `Decidió ${decided} ${decided === 1 ? 'ítem' : 'ítems'} de la solicitud de ${request.requesterName}.` +
            (pending > 0
              ? ` Quedan ${pending} pendientes para el administrador de seguridad: usted no los puede decidir.`
              : ' La solicitud quedó completa.'),
        );
        this.refresh();
      },
      error: (error: unknown) => {
        this.saving.set(null);
        this.decisionFailure.set(explainTeamFailure(error));
      },
    });
  }

  /** Vuelve a leer todo sin pasar por S1/S2: lo que se ve es lo que quedó guardado. */
  private refresh(): void {
    this.team.getCapabilities().subscribe({
      next: (capabilities) => this.loadData(capabilities, true),
      error: (error: unknown) =>
        this.state.set(
          this.lastGood === null
            ? errorToViewState<TeamData>(error)
            : stale(this.lastGood, this.lastAt),
        ),
    });
  }

  /* ---- invitar -------------------------------------------------------------------------------------------------------- */

  protected invite(): void {
    const role = this.inviteTemplate();
    if (role === null || this.inviting()) return;
    this.inviting.set(true);
    this.inviteFailure.set(null);
    this.invitation.set(null);
    this.team
      .invite({
        kind: 'SUPPORT_STAFF',
        maxUses: Number(this.inviteUses() ?? 1),
        expiresInDays: Number(this.inviteDays() ?? 7),
        roleTemplate: role as SupportRoleTemplateCode,
      })
      .subscribe({
        next: (created) => {
          this.inviting.set(false);
          this.invitation.set(created);
        },
        error: (error: unknown) => {
          this.inviting.set(false);
          this.inviteFailure.set(explainTeamFailure(error));
        },
      });
  }

  protected expires(value: { readonly expiresAt: string }): string {
    return expiryText(value.expiresAt);
  }
}
