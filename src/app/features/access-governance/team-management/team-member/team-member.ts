import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  type OnInit,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { catchError, forkJoin, of, type Observable } from 'rxjs';

import { SessionStore } from '../../../../core/auth/session.store';
import { AccessExplainClient } from '../../../../core/data-access/access-governance/access-explain.client';
import type { SimulateAccessResponse } from '../../../../core/data-access/access-governance/access-explain.types';
import type {
  TeamGrant,
  TeamMember as TeamMemberView,
} from '../../../../core/data-access/access-governance/access-governance.types';
import { TeamAdminClient } from '../../../../core/data-access/access-governance/team-admin.client';
import { pendingApprovalExplanation } from '../../../../core/data-access/support-access/grant-change-reasons';
import { atomMeta } from '../../../../core/data-access/support-access/support-atoms';
import {
  isGrantChangePending,
  type AtomGrantChange,
  type NewAtomGrant,
  type SupportActionInput,
} from '../../../../core/data-access/support-access/support-atom-grants.types';
import { SupportAccessClient } from '../../../../core/data-access/support-access/support-access.client';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import {
  SUPPORT_ROLE_TEMPLATE_LABELS,
  type SupportCatalog,
  type SupportEngagementStatus,
  type SupportRoleTemplateCode,
  type SupportScopeTarget,
  type SupportTargetKind,
} from '../../../../core/data-access/support-access/support-access.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, notFound, ready, stale } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  engagementStatusText,
  engagementStatusTone,
  formatDay,
} from '../../../support-access/support-labels';
import { AccessChallengeService } from '../../access-challenge/access-challenge.service';
import { GrantComposer } from '../../lifecycle/grant-composer/grant-composer';
import {
  emptyDraft,
  labelOfTarget,
  optionsFromCatalog,
  targetKeyOf,
  toMoveGrant,
  toSimulationGrant,
  type GrantDraft,
  type TargetOption,
} from '../../lifecycle/grant-draft/grant-draft';
import { peopleOfMembers, type Person } from '../../lifecycle/lifecycle.people';
import { SimulationPreview } from '../../lifecycle/simulation-preview/simulation-preview';
import {
  atomBlockReason,
  canDo,
  ceilingFor,
  maxValidDayFor,
  parseCapabilities,
  type TeamAbilities,
} from '../team-ceiling';
import { explainTeamFailure, type TeamFailure } from '../team-failure';
import { MemberAccount } from './member-account/member-account';

interface MemberData {
  readonly member: TeamMemberView;
  readonly abilities: TeamAbilities;
  readonly catalog: SupportCatalog | null;
  readonly options: readonly TargetOption[];
  readonly people: readonly Person[];
}

interface GrantRow {
  readonly grant: TeamGrant;
  readonly label: string;
  readonly atoms: string;
  readonly until: string;
}

interface Editing {
  readonly mode: 'new' | 'edit';
  readonly draft: GrantDraft;
}

/**
 * **Una persona de mi equipo** (CONTRATO-GOBIERNO §6.4, §9.3 fila 12): el jefe de servicio le da, cambia o quita permisos
 * **dentro de su techo y su alcance**, la recertifica, la suspende, la da de baja o pide su reactivación.
 *
 * Una sola tarjeta con pestañas. Lo que queda fuera del techo aparece **deshabilitado con su explicación** en palabras
 * («Solo el administrador de seguridad puede dar esto»); si igual llega a la API, el 403 `ADMIN_CEILING_EXCEEDED` o
 * `ADMIN_SCOPE_EXCEEDED` se explica y se dice qué sí puede hacer. Antes de guardar se ve **qué cambia** (simulación) y
 * el paso extra lo pide el diálogo de desafío. Las otras funciones de la persona (fuera de su alcance) solo se cuentan.
 */
@Component({
  selector: 'app-team-member',
  imports: [
    Alert,
    AppButton,
    Badge,
    Card,
    GrantComposer,
    MemberAccount,
    PageHeader,
    SimulationPreview,
    Tab,
    Tabs,
    ViewStateHost,
  ],
  templateUrl: './team-member.html',
  styleUrl: './team-member.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamMember implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly team = inject(TeamAdminClient);
  private readonly support = inject(SupportAccessClient);
  private readonly explain = inject(AccessExplainClient);
  private readonly challenges = inject(AccessChallengeService);
  private readonly session = inject(SessionStore);

  private readonly engagementId = this.route.snapshot.paramMap.get('memberId') ?? '';

  protected readonly state = signal<ViewState<MemberData>>(loading());
  protected readonly tab = signal(0);
  protected readonly editing = signal<Editing | null>(null);
  protected readonly preview = signal<SimulateAccessResponse | null>(null);
  protected readonly previewOutdated = signal(false);
  protected readonly simulating = signal(false);
  protected readonly previewFailure = signal('');
  protected readonly saving = signal(false);
  protected readonly removing = signal<string | null>(null);
  protected readonly confirmRemove = signal<string | null>(null);
  protected readonly failure = signal<TeamFailure | null>(null);
  protected readonly notice = signal('');

  private lastGood: MemberData | null = null;
  private lastAt = new Date();

  protected readonly data = computed<MemberData | null>(() => {
    const current = this.state();
    return current.status === 'ready' || current.status === 'stale' ? current.data : null;
  });

  protected readonly title = computed(
    () => this.data()?.member.personName ?? 'Persona de mi equipo',
  );
  protected readonly breadcrumbs = computed(() => [
    { label: 'Mi equipo', routerLink: '/administration/team-management' },
    { label: this.title() },
  ]);

  protected readonly rows = computed<readonly GrantRow[]>(() => {
    const d = this.data();
    if (d === null) return [];
    return d.member.grants.map((grant) => ({
      grant,
      label: labelOfTarget(grant as unknown as SupportScopeTarget, d.catalog),
      atoms:
        grant.atoms.length === 0
          ? 'sin permisos'
          : grant.atoms.map((a) => atomMeta(a)?.name ?? a).join(', '),
      until: grant.validTo === undefined ? 'No vence' : `Vale hasta el ${formatDay(grant.validTo)}`,
    }));
  });

  protected readonly canAssign = computed(() => {
    const d = this.data();
    return d !== null && canDo(d.abilities, 'team.grants.assign');
  });
  protected readonly canRevoke = computed(() => {
    const d = this.data();
    return (
      d !== null &&
      (canDo(d.abilities, 'team.grants.revoke') || canDo(d.abilities, 'team.grants.assign'))
    );
  });

  /** Lo que cada permiso del editor puede darse según el techo del lugar elegido. */
  protected readonly blocked = computed<(atom: string) => string | null>(() => {
    const d = this.data();
    const e = this.editing();
    if (d === null || e === null) return () => null;
    const ceiling = ceilingFor(d.abilities, e.draft.targetKey);
    return (atom) => atomBlockReason(atom, ceiling, d.abilities.mode);
  });

  protected readonly maxValidTo = computed(() => {
    const d = this.data();
    const e = this.editing();
    return d === null || e === null || d.abilities.mode === 'FULL'
      ? ''
      : maxValidDayFor(ceilingFor(d.abilities, e.draft.targetKey));
  });

  protected readonly statusText = (value: string): string =>
    engagementStatusText(value as SupportEngagementStatus);
  protected readonly statusTone = (value: string): BadgeVariant =>
    engagementStatusTone(value as SupportEngagementStatus);
  protected readonly templateText = (code: string | undefined): string =>
    code === undefined
      ? 'Sin rol'
      : (SUPPORT_ROLE_TEMPLATE_LABELS[code as SupportRoleTemplateCode] ?? code);

  ngOnInit(): void {
    this.load();
  }

  /** Tras una suspensión o una recertificación se vuelve a leer; tras una baja, la persona ya no está en su alcance. */
  protected afterAccountChange(outcome: 'updated' | 'offboarded'): void {
    if (outcome === 'updated') this.load(true);
  }

  protected load(silent = false): void {
    if (!silent) this.state.set(loading());
    const tenantId = this.session.activeTenantId();
    const catalog$ =
      this.session.isOrganizationAccount() || tenantId === null
        ? this.support.getCatalog()
        : this.support.getMyCatalog(tenantId);
    forkJoin({
      member: this.team.getMember(this.engagementId),
      capabilities: this.team.getCapabilities(),
      catalog: catalog$.pipe(catchError(() => of(null))),
      members: this.team.listMembers().pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ member, capabilities, catalog, members }) => {
        const abilities = parseCapabilities(capabilities, catalog);
        const options =
          abilities.mode === 'FULL'
            ? optionsFromCatalog(catalog)
            : abilities.scopes.map((s) => s.option);
        const data: MemberData = {
          member,
          abilities,
          catalog,
          options,
          people: members === null ? [] : peopleOfMembers(members.items),
        };
        this.lastGood = data;
        this.lastAt = new Date();
        this.state.set(ready(data));
      },
      error: (error: unknown) => {
        const mapped = errorToViewState<MemberData>(error);
        const back = { label: 'Volver a mi equipo', route: '/administration/team-management' };
        if (mapped.status === 'not-found') {
          // Si la persona se veía y ya no, es porque dejó de tener permisos dentro de su alcance (lo quitó usted): se dice.
          // La primera vez no se explica nada: no se confirma si existe ni a quién pertenece.
          this.state.set(
            this.lastGood === null
              ? notFound(back)
              : empty(
                  back,
                  'Ya no tiene permisos dentro de lo que usted administra, así que esta persona salió de su equipo.',
                ),
          );
          return;
        }
        this.state.set(this.lastGood === null ? mapped : stale(this.lastGood, this.lastAt));
      },
    });
  }

  /* ---- el editor de un permiso --------------------------------------------------------------------------------------- */

  protected startNew(): void {
    const first = this.data()?.options[0];
    if (first === undefined) return;
    this.openEditor({ mode: 'new', draft: emptyDraft(first.key) });
  }

  protected startEdit(row: GrantRow): void {
    const key = targetKeyOf(row.grant as unknown as SupportScopeTarget);
    this.openEditor({
      mode: 'edit',
      draft: {
        ...emptyDraft(key),
        atoms: row.grant.atoms,
        validTo: row.grant.validTo?.slice(0, 10) ?? '',
        grantId: row.grant.id,
      },
    });
  }

  private openEditor(next: Editing): void {
    this.editing.set(next);
    this.preview.set(null);
    this.previewOutdated.set(false);
    this.previewFailure.set('');
    this.failure.set(null);
    this.notice.set('');
  }

  protected closeEditor(): void {
    this.editing.set(null);
    this.preview.set(null);
    this.previewOutdated.set(false);
  }

  protected updateDraft(draft: GrantDraft): void {
    const e = this.editing();
    if (e === null) return;
    this.editing.set({ ...e, draft });
    if (this.preview() !== null) this.previewOutdated.set(true);
    this.failure.set(null);
  }

  private optionFor(draft: GrantDraft): TargetOption | undefined {
    const d = this.data();
    return (
      d?.options.find((o) => o.key === draft.targetKey) ??
      (d === null
        ? undefined
        : {
            key: draft.targetKey,
            label: draft.targetKey,
            target: this.targetOfKey(draft.targetKey),
          })
    );
  }

  private targetOfKey(key: string): SupportScopeTarget {
    const [kind, doctor, service, space, site] = key.split('|');
    return {
      targetKind: (kind ?? 'ALL') as SupportTargetKind,
      ...(doctor ? { practitionerRoleAssignmentId: doctor } : {}),
      ...(service ? { healthcareServiceId: service } : {}),
      ...(space ? { careSpaceId: space } : {}),
      ...(site ? { practiceSiteId: site } : {}),
    };
  }

  protected readonly canPreview = computed(() => {
    const e = this.editing();
    return e !== null && e.draft.atoms.length > 0;
  });

  protected simulate(): void {
    const e = this.editing();
    const option = e === null ? undefined : this.optionFor(e.draft);
    if (e === null || option === undefined || this.simulating()) return;
    if (e.draft.atoms.length === 0) {
      this.previewFailure.set('Marque al menos una cosa que la persona pueda hacer.');
      return;
    }
    this.previewFailure.set('');
    this.simulating.set(true);
    const grant = {
      ...toSimulationGrant(e.draft, option),
      ...(e.draft.grantId === undefined ? {} : { id: e.draft.grantId }),
    };
    this.explain
      .simulate({ engagementId: this.engagementId, draft: { mode: 'PATCH', grants: [grant] } })
      .subscribe({
        next: (response) => {
          this.simulating.set(false);
          this.preview.set(response);
          this.previewOutdated.set(false);
        },
        error: (error: unknown) => {
          this.simulating.set(false);
          this.previewFailure.set(explainTeamFailure(error).message);
        },
      });
  }

  protected save(): void {
    const e = this.editing();
    const p = this.preview();
    const option = e === null ? undefined : this.optionFor(e.draft);
    if (
      e === null ||
      p === null ||
      option === undefined ||
      this.saving() ||
      this.previewOutdated() ||
      !p.valid
    )
      return;
    this.saving.set(true);
    this.failure.set(null);
    const token = p.simulationToken === undefined ? {} : { simulationToken: p.simulationToken };
    const label = `${e.mode === 'new' ? 'Dar un permiso a' : 'Cambiar un permiso de'} ${this.title()}`;
    const call = (): Observable<unknown> => {
      if (e.mode === 'new') {
        const grant: NewAtomGrant = {
          ...toMoveGrant(e.draft, option),
          expansionMode: 'DYNAMIC',
          ...token,
        };
        return this.team.createGrant(this.engagementId, grant);
      }
      // La API no borra una vigencia con un campo vacío: solo se manda si hay una fecha.
      const validTo = toMoveGrant(e.draft, option).validTo;
      const change: AtomGrantChange = {
        grantId: e.draft.grantId!,
        actions: e.draft.atoms as readonly SupportActionInput[],
        ...(validTo === undefined ? {} : { validTo }),
        ...token,
      };
      return this.team.changeGrant(this.engagementId, change);
    };
    this.challenges.run(call, { actionLabel: label }).subscribe({
      next: (resultado) => {
        this.saving.set(false);
        // Un átomo crítico no se escribe: la API contesta 202 y queda esperando a otra persona (cuatro ojos).
        if (isGrantChangePending(resultado)) {
          this.notice.set(
            `Quedó pendiente de aprobación: el cambio en ${this.title()}. ${pendingApprovalExplanation([resultado])}`,
          );
          this.closeEditor();
          this.load(true);
          return;
        }
        this.notice.set(
          e.mode === 'new'
            ? `Listo: ${this.title()} tiene un permiso nuevo.`
            : `Listo: el permiso de ${this.title()} quedó cambiado.`,
        );
        this.closeEditor();
        this.load(true);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.failure.set(explainTeamFailure(error));
      },
    });
  }

  /* ---- quitar -------------------------------------------------------------------------------------------------------- */

  protected askRemove(row: GrantRow): void {
    this.confirmRemove.set(row.grant.id);
    this.failure.set(null);
    this.notice.set('');
  }

  protected cancelRemove(): void {
    this.confirmRemove.set(null);
  }

  protected remove(row: GrantRow): void {
    if (this.removing() !== null) return;
    this.removing.set(row.grant.id);
    this.failure.set(null);
    this.challenges
      .run(
        () => this.team.changeGrant(this.engagementId, { grantId: row.grant.id, revoke: true }),
        { actionLabel: `Quitar un permiso de ${this.title()}` },
      )
      .subscribe({
        next: () => {
          this.removing.set(null);
          this.confirmRemove.set(null);
          this.notice.set(
            `Listo: «${row.label}» ya no está entre los permisos de ${this.title()}.`,
          );
          this.load(true);
        },
        error: (error: unknown) => {
          this.removing.set(null);
          this.confirmRemove.set(null);
          this.failure.set(explainTeamFailure(error));
        },
      });
  }
}
