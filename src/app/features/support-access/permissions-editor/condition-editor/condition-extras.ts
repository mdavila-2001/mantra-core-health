import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type { SupportCondition } from '../../../../core/data-access/access-governance/conditions.types';
import {
  SUPPORT_ROLE_TEMPLATE_CODES,
  SUPPORT_ROLE_TEMPLATE_LABELS,
} from '../../../../core/data-access/support-access/support-access.types';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { getPath, orNothing, setPath } from './condition-form';

const ON_EXCEED: readonly SelectOption<string>[] = [
  { value: 'DENY', label: 'no dejar' },
  { value: 'REQUIRE_APPROVAL', label: 'pedir aprobación' },
];
const APPROVERS: readonly SelectOption<string>[] = [
  { value: 'DOCTOR', label: 'el doctor' },
  { value: 'SECOND_APPROVER', label: 'una segunda persona' },
  { value: 'SERVICE_HEAD', label: 'la jefatura del servicio' },
];
const DELEGABLE_AREAS = [
  { value: 'agenda.*', label: 'agenda' },
  { value: 'patients.*', label: 'pacientes' },
  { value: 'messages.*', label: 'mensajes' },
  { value: 'billing.*', label: 'facturación y caja' },
  { value: 'reports.*', label: 'reportes' },
] as const;

/**
 * Las tres secciones del editor de condiciones que se usan menos: **montos** (caja), **controles** (motivo, verificación
 * en dos pasos y aprobación) y **techo de delegación** (qué puede dar quien administra a su gente). Aparte de
 * `ConditionEditor` para no pasar del tope de líneas; cada una sigue siendo frases con huecos y nadie escribe JSON.
 */
@Component({
  selector: 'app-condition-extras',
  imports: [Checkbox, Input, Select, Switch],
  templateUrl: './condition-extras.html',
  styleUrl: './condition-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConditionExtras {
  readonly section = input.required<'amount' | 'controls' | 'ceiling'>();
  readonly condition = input<SupportCondition | undefined>(undefined);
  readonly conditionChange = output<SupportCondition | undefined>();

  protected readonly onExceed = ON_EXCEED;
  protected readonly approvers = APPROVERS;
  protected readonly areas = DELEGABLE_AREAS;
  protected readonly templates = SUPPORT_ROLE_TEMPLATE_CODES.map((code) => ({
    value: code,
    label: SUPPORT_ROLE_TEMPLATE_LABELS[code],
  }));

  private emit(next: SupportCondition): void {
    this.conditionChange.emit(orNothing(next));
  }
  protected set(path: readonly string[], value: unknown): void {
    this.emit(setPath(this.condition(), path, value));
  }
  protected has(path: readonly string[]): boolean {
    return getPath(this.condition(), path) !== undefined;
  }
  protected str(path: readonly string[]): string | undefined {
    return getPath<string>(this.condition(), path);
  }
  protected numberAt(path: readonly string[]): number | string {
    return getPath<number>(this.condition(), path) ?? '';
  }
  protected setNumber(path: readonly string[], value: string | number | null): void {
    const n = value === null || value === '' ? undefined : Math.trunc(Number(value));
    this.set(path, n !== undefined && Number.isFinite(n) ? n : undefined);
  }

  protected toggleAmount(on: boolean): void {
    this.set(
      ['amount'],
      on ? { currency: 'BOB', perTransactionMax: 500, onExceed: 'DENY' } : undefined,
    );
  }
  protected toggleObligation(key: 'requireReason' | 'stepUp' | 'approval', on: boolean): void {
    const initial = {
      requireReason: { minLength: 10 },
      stepUp: { maxAgeMinutes: 10 },
      approval: { by: 'DOCTOR', ttlMinutes: 60 },
    }[key];
    this.set(['obligations', key], on ? initial : undefined);
  }

  protected hasIn(key: 'allowAtoms' | 'forbidAtoms' | 'templates', value: string): boolean {
    return (
      getPath<readonly string[]>(this.condition(), ['delegationCeiling', key])?.includes(value) ??
      false
    );
  }
  protected toggleIn(
    key: 'allowAtoms' | 'forbidAtoms' | 'templates',
    value: string,
    on: boolean,
  ): void {
    const current = getPath<readonly string[]>(this.condition(), ['delegationCeiling', key]) ?? [];
    this.set(
      ['delegationCeiling', key],
      on ? [...new Set([...current, value])] : current.filter((v) => v !== value),
    );
  }
}
