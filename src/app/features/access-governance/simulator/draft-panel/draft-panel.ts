import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import type {
  PermissionCatalog,
  SimulateAccessResponse,
  SimulationDraftGrant,
  SimulationScenario,
} from '../../../../core/data-access/access-governance/access-explain.types';
import { AccessExplainClient } from '../../../../core/data-access/access-governance/access-explain.client';
import { SupportAccessClient } from '../../../../core/data-access/support-access/support-access.client';
import type { GrantEffect } from '../../../../core/data-access/support-access/support-decision.types';
import {
  SUPPORT_ROLE_TEMPLATE_LABELS,
  type SupportCatalog,
  type SupportEngagement,
  type SupportGrant,
} from '../../../../core/data-access/support-access/support-access.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { grantLabel, templateLabel } from '../../../support-access/support-labels';
import { ExplainQuestion, type QuestionValue } from '../explain-question/explain-question';
import type { ExplainPrefill } from '../explain-panel/explain-panel';
import { SimulationResult } from '../simulation-result/simulation-result';
import { actionName, actionOptions, sensitivityLabel } from '../explain-text';
import { atomMeta } from '../../../../core/data-access/support-access/support-atoms';

type Mode = 'PATCH' | 'REPLACE';

const MODES: readonly SegmentedOption<Mode>[] = [
  { value: 'PATCH', label: 'Cambiar lo que tiene hoy' },
  { value: 'REPLACE', label: 'Reemplazar todo' },
];
const EFFECTS: readonly SegmentedOption<'ALLOW' | 'DENY'>[] = [
  { value: 'ALLOW', label: 'Permitir' },
  { value: 'DENY', label: 'Denegar' },
];
const NO_TEMPLATE = '';
const TEMPLATE_OPTIONS: readonly SelectOption<string>[] = [
  { value: NO_TEMPLATE, label: 'No cambia de rol' },
  ...Object.entries(SUPPORT_ROLE_TEMPLATE_LABELS).map(([value, label]) => ({ value, label })),
];

/** Un permiso del borrador, ya armado para mostrar y para enviar. */
interface DraftItem {
  readonly effect: GrantEffect;
  readonly atoms: readonly string[];
  readonly officeHours: { readonly from: string; readonly to: string } | null;
}

interface OwnScenario {
  readonly label: string;
  readonly question: QuestionValue;
}

/**
 * **«¿Qué pasa si cambio permisos?»** — la pestaña de simular del simulador (CONTRATO-GOBIERNO §5.3, §9.3 fila 10).
 *
 * Se arma un borrador (permisos a sumar, a denegar o a quitar, y opcionalmente otro rol), se agregan casos de prueba propios
 * y la API devuelve la comparación antes/después. `simulate` no escribe nada, no consume contadores y no crea aprobaciones:
 * guardar de verdad se hace en el editor de permisos.
 */
@Component({
  selector: 'app-draft-panel',
  imports: [
    Alert,
    AppButton,
    Badge,
    Checkbox,
    ExplainQuestion,
    FormField,
    Input,
    Select,
    SegmentedControl,
    SimulationResult,
    Switch,
    ViewStateHost,
  ],
  templateUrl: './draft-panel.html',
  styleUrl: './draft-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DraftPanel {
  private readonly explain = inject(AccessExplainClient);
  private readonly support = inject(SupportAccessClient);

  readonly engagements = input.required<readonly SupportEngagement[]>();
  readonly catalog = input<SupportCatalog | null>(null);
  readonly permissionCatalog = input<PermissionCatalog | null>(null);
  /** Una persona elegida desde fuera (por ejemplo, desde un enlace). */
  readonly initialEngagementId = input<string | null>(null);
  /** «¿Por qué?» de un caso propio: la pantalla lleva a la pestaña de explicar con el caso listo. */
  readonly explainRequested = output<ExplainPrefill>();

  protected readonly modes = MODES;
  protected readonly effects = EFFECTS;
  protected readonly templateOptions = TEMPLATE_OPTIONS;

  protected readonly engagementId = signal<string | null>(null);
  protected readonly grants = signal<ViewState<readonly SupportGrant[]> | null>(null);
  protected readonly mode = signal<Mode>('PATCH');
  protected readonly template = signal<string | null>(NO_TEMPLATE);
  protected readonly removed = signal<readonly string[]>([]);
  protected readonly items = signal<readonly DraftItem[]>([]);
  protected readonly newEffect = signal<'ALLOW' | 'DENY'>('ALLOW');
  protected readonly newAtoms = signal<readonly string[]>([]);
  protected readonly atomPick = signal<string | null>(null);
  protected readonly officeHours = signal(false);
  protected readonly hoursFrom = signal('08:00');
  protected readonly hoursTo = signal('18:00');
  protected readonly scenarios = signal<readonly OwnScenario[]>([]);
  protected readonly auto = signal(true);
  protected readonly tried = signal(false);
  protected readonly state = signal<ViewState<SimulateAccessResponse> | null>(null);
  protected readonly busy = signal(false);

  protected readonly personOptions = computed<readonly SelectOption<string>[]>(() =>
    this.engagements()
      .filter((e) => e.status !== 'ENDED')
      .map((e) => ({
        value: e.id,
        label: `${e.personName} · ${templateLabel(e.roleTemplate)}`,
        description: e.organizationName,
      })),
  );
  protected readonly actions = computed(() => actionOptions(this.permissionCatalog()));
  protected readonly doctors = computed<readonly SelectOption<string>[]>(() =>
    (this.catalog()?.doctors ?? []).map((d) => ({
      value: d.id,
      label: `${d.name} · ${d.specialty}`,
    })),
  );
  protected readonly currentGrants = computed(() => {
    const s = this.grants();
    return s !== null && s.status === 'ready' ? s.data : [];
  });
  protected readonly result = computed(() => {
    const s = this.state();
    return s !== null && s.status === 'ready' ? s.data : null;
  });
  protected readonly personError = computed(() =>
    this.tried() && this.engagementId() === null ? 'Elija a la persona.' : '',
  );
  protected readonly emptyDraft = computed(
    () =>
      this.tried() &&
      this.items().length === 0 &&
      this.removed().length === 0 &&
      (this.template() ?? NO_TEMPLATE) === NO_TEMPLATE,
  );
  protected readonly canAddItem = computed(() => this.newAtoms().length > 0);

  constructor() {
    effect(() => {
      const id = this.initialEngagementId();
      if (id !== null) untracked(() => this.pickPerson(id));
    });
  }

  protected pickPerson(id: string | null): void {
    this.engagementId.set(id);
    this.removed.set([]);
    this.state.set(null);
    this.grants.set(null);
    if (id === null) return;
    this.grants.set(loading());
    this.support.listGrants(id).subscribe({
      next: (list) => this.grants.set(ready(list.filter((g) => g.status === 'ACTIVE'))),
      error: (failure: unknown) =>
        this.grants.set(errorToViewState<readonly SupportGrant[]>(failure)),
    });
  }

  protected isRemoved(id: string): boolean {
    return this.removed().includes(id);
  }

  protected toggleRemoved(id: string, checked: boolean): void {
    this.removed.update((actual) =>
      checked ? [...actual.filter((x) => x !== id), id] : actual.filter((x) => x !== id),
    );
  }

  protected grantTitle(g: SupportGrant): string {
    return grantLabel(g);
  }

  protected grantAtomsText(g: SupportGrant): string {
    const atoms = g.atoms ?? [];
    const names = atoms.slice(0, 3).map((a) => actionName(a, this.permissionCatalog()));
    return atoms.length === 0
      ? 'Sin permisos'
      : `${names.join(', ')}${atoms.length > 3 ? ` y ${atoms.length - 3} más` : ''}`;
  }

  /* ---- el borrador ---------------------------------------------------------------- */

  protected pickAtom(code: string | null): void {
    if (code === null) return;
    this.newAtoms.update((actual) => (actual.includes(code) ? actual : [...actual, code]));
    this.atomPick.set(null);
  }

  protected dropAtom(code: string): void {
    this.newAtoms.update((actual) => actual.filter((a) => a !== code));
  }

  protected atomLabel(code: string): string {
    return actionName(code, this.permissionCatalog());
  }

  protected atomSensitivity(code: string): string {
    const meta = atomMeta(code);
    return meta === undefined ? '' : sensitivityLabel(meta.sensitivity);
  }

  protected addItem(): void {
    if (!this.canAddItem()) return;
    this.items.update((actual) => [
      ...actual,
      {
        effect: this.newEffect(),
        atoms: this.newAtoms(),
        officeHours:
          this.officeHours() && this.newEffect() === 'ALLOW'
            ? { from: this.hoursFrom(), to: this.hoursTo() }
            : null,
      },
    ]);
    this.newAtoms.set([]);
    this.officeHours.set(false);
  }

  protected dropItem(index: number): void {
    this.items.update((actual) => actual.filter((_, i) => i !== index));
  }

  protected itemText(item: DraftItem): string {
    const names = item.atoms.map((a) => this.atomLabel(a)).join(', ');
    const hours =
      item.officeHours === null
        ? ''
        : `, de lunes a viernes de ${item.officeHours.from} a ${item.officeHours.to}`;
    return `${item.effect === 'ALLOW' ? 'Permitir' : 'Denegar'}: ${names}${hours}`;
  }

  /* ---- casos de prueba propios ------------------------------------------------------ */

  protected addScenario(question: QuestionValue): void {
    const doctor = this.doctors()
      .find((d) => d.value === question.practitionerRoleAssignmentId)
      ?.label.split(' · ')[0];
    const label = `${this.atomLabel(question.action)}${doctor === undefined ? '' : ` · ${doctor}`}`;
    this.scenarios.update((actual) => [...actual, { label, question }]);
  }

  protected dropScenario(index: number): void {
    this.scenarios.update((actual) => actual.filter((_, i) => i !== index));
  }

  /* ---- simular ---------------------------------------------------------------------- */

  private draftGrants(): readonly SimulationDraftGrant[] {
    return this.items().map((item) => ({
      effect: item.effect,
      actions: item.atoms as never,
      ...(item.officeHours === null
        ? {}
        : {
            condition: {
              schemaVersion: 1 as const,
              time: {
                windows: [
                  { days: [1, 2, 3, 4, 5], from: item.officeHours.from, to: item.officeHours.to },
                ],
              },
            },
          }),
    }));
  }

  private requestScenarios(): readonly SimulationScenario[] {
    return this.scenarios().map(({ label, question }) => ({
      label,
      action: question.action as never,
      ...(question.practitionerRoleAssignmentId === undefined
        ? {}
        : { practitionerRoleAssignmentId: question.practitionerRoleAssignmentId }),
      ...(question.healthcareServiceId === undefined
        ? {}
        : { healthcareServiceId: question.healthcareServiceId }),
      ...(question.careSpaceId === undefined ? {} : { careSpaceId: question.careSpaceId }),
      ...(question.patientProfileId === undefined
        ? {}
        : { patientProfileId: question.patientProfileId }),
      ...(question.appointmentStartAt === undefined
        ? {}
        : { appointmentStartAt: question.appointmentStartAt }),
      ...(question.at === undefined ? {} : { at: question.at }),
    }));
  }

  protected simulate(): void {
    this.tried.set(true);
    const engagementId = this.engagementId();
    if (engagementId === null || this.emptyDraft() || this.busy()) return;
    const template = this.template();
    this.busy.set(true);
    if (this.result() === null) this.state.set(loading());
    this.explain
      .simulate({
        engagementId,
        draft: {
          mode: this.mode(),
          ...(template === null || template === NO_TEMPLATE ? {} : { templateCode: template }),
          grants: this.draftGrants(),
          removeGrantIds: this.removed(),
        },
        ...(this.scenarios().length === 0 ? {} : { scenarios: this.requestScenarios() }),
        autoScenarios: this.auto(),
      })
      .subscribe({
        next: (response) => {
          this.busy.set(false);
          this.state.set(ready(response));
        },
        error: (failure: unknown) => {
          this.busy.set(false);
          this.state.set(errorToViewState<SimulateAccessResponse>(failure));
        },
      });
  }

  protected explainOwn(index: number): void {
    const engagementId = this.engagementId();
    const own = this.scenarios()[index];
    if (engagementId === null || own === undefined) return;
    this.explainRequested.emit({ engagementId, question: own.question, ask: true });
  }
}
