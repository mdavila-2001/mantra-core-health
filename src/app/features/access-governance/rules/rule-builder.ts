import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';

import { accessFailureOf } from '../../../core/data-access/access-governance/access-errors';
import { AccessGovernanceClient } from '../../../core/data-access/access-governance/access-governance.client';
import type {
  ApproverKind,
  SupportCondition,
} from '../../../core/data-access/access-governance/conditions.types';
import { CONDITION_SCHEMA_VERSION } from '../../../core/data-access/access-governance/conditions.types';
import type { PersonMatrix } from '../../../core/data-access/access-governance/governance-reports.types';
import {
  GOVERNANCE_RULE_KINDS,
  type FieldFloorVisibility,
  type GovernanceRuleKind,
  type NewGovernanceRule,
} from '../../../core/data-access/access-governance/governance-rules.types';
import {
  SUPPORT_ROLE_TEMPLATE_CODES,
  SUPPORT_ROLE_TEMPLATE_LABELS,
} from '../../../core/data-access/support-access/support-access.types';
import { SUPPORT_ATOMS } from '../../../core/data-access/support-access/support-atoms';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import {
  CATEGORY_PATTERNS,
  describeRule,
  kindText,
  ruleImpact,
  VISIBILITY_OPTIONS,
  type RuleImpact,
} from './rule-labels';

const DESCRIPCION_DEL_TIPO: Readonly<Record<GovernanceRuleKind, string>> = {
  DENY_PERMISSION: 'Nadie puede tener un permiso (o solo ciertos roles).',
  CEILING: 'Lo máximo que un rol puede tener en su organización.',
  REQUIRE_CONDITION: 'Un permiso solo se puede usar si se cumple algo.',
  FIELD_FLOOR: 'Un dato nunca se ve completo.',
};

const APROBADORES: readonly { readonly value: ApproverKind; readonly label: string }[] = [
  { value: 'DOCTOR', label: 'El doctor' },
  { value: 'SECOND_APPROVER', label: 'Un segundo administrador' },
  { value: 'SERVICE_HEAD', label: 'La jefatura del servicio' },
];

/**
 * **Constructor guiado de una barandilla** (CONTRATO-GOBIERNO §4.3, §9.3 fila 7): se arma una oración —«Nadie con el rol
 * Recepción puede cobrar»— y antes de guardar se ve **cuántas personas alcanza hoy**. La regla solo restringe: si afloja una
 * barandilla de la plataforma, la API responde `GUARDRAIL_RULE_LOOSENS_PLATFORM`. Guardar lo hace el contenedor (paso extra).
 */
@Component({
  selector: 'app-rule-builder',
  imports: [Alert, AppButton, Checkbox, FormField, Input, Select, Textarea],
  templateUrl: './rule-builder.html',
  styleUrl: './rule-builder.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RuleBuilder implements OnInit {
  private readonly client = inject(AccessGovernanceClient);

  /** El tipo con el que se abre (por ejemplo, «Techo por rol» desde su pestaña). */
  readonly initialKind = input<GovernanceRuleKind>('DENY_PERMISSION');
  readonly busy = input(false);
  readonly failure = input<string | null>(null);
  readonly submitted = output<NewGovernanceRule>();
  readonly cancelled = output<void>();

  protected readonly kind = signal<GovernanceRuleKind>('DENY_PERMISSION');
  protected readonly permiso = signal<string | null>(null);
  protected readonly rol = signal<string>('');
  protected readonly mensaje = signal('');
  protected readonly visibilidad = signal<FieldFloorVisibility>('PARTIAL');
  protected readonly enRed = signal(false);
  protected readonly conMotivo = signal(false);
  protected readonly minimoDelMotivo = signal('10');
  protected readonly conPasoExtra = signal(false);
  protected readonly conAprobacion = signal(false);
  protected readonly aprobador = signal<ApproverKind>('SECOND_APPROVER');
  protected readonly equipoDeConfianza = signal(false);
  protected readonly intento = signal(false);

  protected readonly tipos = GOVERNANCE_RULE_KINDS.map((value) => ({
    value,
    label: kindText(value),
    description: DESCRIPCION_DEL_TIPO[value],
  }));
  protected readonly aprobadores = APROBADORES;
  protected readonly visibilidades = VISIBILITY_OPTIONS;
  protected readonly roles = [
    { value: '', label: 'Todos los roles' },
    ...SUPPORT_ROLE_TEMPLATE_CODES.map((value) => ({
      value,
      label: SUPPORT_ROLE_TEMPLATE_LABELS[value],
    })),
  ];

  /** Una regla de campo solo habla de un dato; las demás, de cualquier permiso o de una categoría entera. */
  protected readonly opcionesDePermiso = computed(() => {
    const atomos = SUPPORT_ATOMS.filter((a) => this.kind() !== 'FIELD_FLOOR' || a.isFieldLevel).map(
      (a) => ({ value: a.code as string, label: a.name }),
    );
    return this.kind() === 'FIELD_FLOOR' ? atomos : [...CATEGORY_PATTERNS, ...atomos];
  });

  protected readonly condicion = computed<SupportCondition | undefined>(() => {
    if (this.kind() !== 'REQUIRE_CONDITION') return undefined;
    const minimo = Math.max(1, Math.floor(Number(this.minimoDelMotivo()) || 10));
    const obligations = {
      ...(this.conMotivo() ? { requireReason: { minLength: minimo } } : {}),
      ...(this.conPasoExtra() ? { stepUp: { maxAgeMinutes: 10 } } : {}),
      ...(this.conAprobacion() ? { approval: { by: this.aprobador() } } : {}),
    };
    const partes: Omit<SupportCondition, 'schemaVersion'> = {
      ...(this.enRed() ? { network: { require: 'ORG_RULES' as const } } : {}),
      ...(this.equipoDeConfianza() ? { device: { knownOnly: true } } : {}),
      ...(Object.keys(obligations).length > 0 ? { obligations } : {}),
    };
    return Object.keys(partes).length === 0
      ? undefined
      : { schemaVersion: CONDITION_SCHEMA_VERSION, ...partes };
  });

  protected readonly problemas = computed(() => {
    const lista: { readonly campo: string; readonly texto: string }[] = [];
    if (this.permiso() === null)
      lista.push({ campo: 'permiso', texto: 'Elija el permiso al que se refiere la regla.' });
    if (this.kind() === 'CEILING' && this.rol() === '')
      lista.push({ campo: 'rol', texto: 'Un techo es de un rol: elija cuál.' });
    if (this.kind() === 'REQUIRE_CONDITION' && this.condicion() === undefined)
      lista.push({
        campo: 'condicion',
        texto: 'Marque al menos una condición que se debe cumplir.',
      });
    return lista;
  });

  /** La regla tal como quedaría. */
  protected readonly regla = computed<NewGovernanceRule | null>(() => {
    const permiso = this.permiso();
    if (permiso === null) return null;
    const mensaje = this.mensaje().trim();
    return {
      kind: this.kind(),
      permissionPattern: permiso,
      ...(this.rol() === '' ? {} : { roleTemplateCode: this.rol() }),
      ...(mensaje === '' ? {} : { message: mensaje }),
      ...(this.condicion() === undefined ? {} : { condition: this.condicion()! }),
      ...(this.kind() === 'FIELD_FLOOR' ? { maxVisibility: this.visibilidad() } : {}),
    };
  });

  protected readonly oracion = computed(() => {
    const r = this.regla();
    return r === null ? '' : describeRule({ ...r, status: 'ACTIVE' } as never);
  });

  /* ---- impacto ---- */
  protected readonly calculando = signal(false);
  protected readonly impacto = signal<RuleImpact | null>(null);
  protected readonly falloDelImpacto = signal<string | null>(null);

  ngOnInit(): void {
    // El tipo con el que se abre; luego la persona lo cambia.
    this.kind.set(this.initialKind());
  }

  protected readonly nombresDelImpacto = computed(() => {
    const i = this.impacto();
    return i === null
      ? ''
      : i.people
          .slice(0, 6)
          .map((p) => p.name)
          .join(', ');
  });

  protected errorDe(campo: string): string {
    return this.intento() ? (this.problemas().find((p) => p.campo === campo)?.texto ?? '') : '';
  }

  protected cambiarTipo(tipo: GovernanceRuleKind | null): void {
    if (tipo === null) return;
    this.kind.set(tipo);
    this.impacto.set(null);
    // El permiso elegido puede no servir para el tipo nuevo (un dato de campo vs. cualquier permiso).
    if (!this.opcionesDePermiso().some((o) => o.value === this.permiso())) this.permiso.set(null);
  }

  protected verImpacto(): void {
    const r = this.regla();
    if (r === null || this.calculando()) return;
    this.calculando.set(true);
    this.falloDelImpacto.set(null);
    this.client.getAccessMatrix({ by: 'person', group: 'atom' }).subscribe({
      next: (matriz) => {
        this.calculando.set(false);
        this.impacto.set(
          ruleImpact(matriz as PersonMatrix, r.permissionPattern, r.roleTemplateCode),
        );
      },
      error: (failure: unknown) => {
        this.calculando.set(false);
        this.impacto.set(null);
        this.falloDelImpacto.set(
          accessFailureOf(failure)?.message ?? 'No pudimos calcular el impacto. Intente de nuevo.',
        );
      },
    });
  }

  protected enviar(): void {
    this.intento.set(true);
    const r = this.regla();
    if (r === null || this.problemas().length > 0 || this.busy()) return;
    this.submitted.emit(r);
  }

  protected rolDelSelect(valor: string | null): void {
    this.rol.set(valor ?? '');
    this.impacto.set(null);
  }

  protected permisoDelSelect(valor: string | null): void {
    this.permiso.set(valor);
    this.impacto.set(null);
  }
}
