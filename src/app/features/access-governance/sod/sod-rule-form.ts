import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';

import {
  SOD_ACTION_LABELS,
  SOD_SCOPE_LABELS,
  type NewSodRule,
  type SodAction,
  type SodRule,
  type SodRuleChange,
  type SodScope,
} from '../../../core/data-access/access-governance/governance-rules.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../shared/components/atoms/checkbox/checkbox';
import { Input } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { Textarea } from '../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { AtomPicker } from '../atom-picker/atom-picker';

/** Lo que el formulario entrega: una regla nueva o los cambios de una propia. */
export type SodRuleSubmission =
  | { readonly mode: 'create'; readonly rule: NewSodRule }
  | { readonly mode: 'edit'; readonly ruleId: string; readonly change: SodRuleChange };

const CODIGO = /^[A-Z][A-Z0-9]*(-[A-Z0-9]+){1,3}$/;

const ACCIONES = (Object.keys(SOD_ACTION_LABELS) as SodAction[]).map((value) => ({
  value,
  label: SOD_ACTION_LABELS[value],
}));
const ALCANCES = (Object.keys(SOD_SCOPE_LABELS) as SodScope[]).map((value) => ({
  value,
  label: SOD_SCOPE_LABELS[value],
}));

/**
 * Formulario de una regla de separación de funciones **de la organización**. Una regla propia solo puede endurecer la de la
 * plataforma en que se apoya: si afloja, la API responde `SOD_RULE_LOOSENS_BASE` y la pantalla lo dice.
 */
@Component({
  selector: 'app-sod-rule-form',
  imports: [Alert, AppButton, AtomPicker, Checkbox, FormField, Input, Select, Textarea],
  templateUrl: './sod-rule-form.html',
  styleUrl: './sod-rule-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SodRuleForm implements OnInit {
  /** Si viene, se edita esa regla; si no, se crea una nueva. */
  readonly rule = input<SodRule | null>(null);
  /** Las reglas de plataforma, para apoyarse en una (`baseRuleCode`). */
  readonly platformRules = input<readonly SodRule[]>([]);
  readonly busy = input(false);
  /** Lo que la API contestó al último intento, para decirlo junto al formulario. */
  readonly failure = input<string | null>(null);

  readonly submitted = output<SodRuleSubmission>();
  readonly cancelled = output<void>();

  protected readonly acciones = ACCIONES;
  protected readonly alcances = ALCANCES;
  protected readonly codigo = signal('');
  protected readonly nombre = signal('');
  protected readonly base = signal<string | null>(null);
  protected readonly lado1 = signal<readonly string[]>([]);
  protected readonly lado2 = signal<readonly string[]>([]);
  protected readonly alcance = signal<SodScope>('PERSON');
  protected readonly accion = signal<SodAction>('REQUIRE_APPROVAL');
  protected readonly dura = signal(false);
  protected readonly diasMaximos = signal('90');
  protected readonly motivo = signal('');
  protected readonly intento = signal(false);

  protected readonly editando = computed(() => this.rule() !== null);
  protected readonly opcionesDeBase = computed(() => [
    { value: '', label: 'Ninguna: es una regla propia' },
    ...this.platformRules().map((r) => ({ value: r.code, label: `${r.name} (${r.code})` })),
  ]);

  protected readonly problemas = computed(() => {
    const lista: { readonly campo: string; readonly texto: string }[] = [];
    if (!this.editando() && !CODIGO.test(this.codigo().trim()))
      lista.push({ campo: 'codigo', texto: 'Escriba un código como SOD-ORG-01.' });
    if (this.nombre().trim().length < 3)
      lista.push({ campo: 'nombre', texto: 'Póngale un nombre que se entienda.' });
    if (this.lado1().length === 0)
      lista.push({ campo: 'lado1', texto: 'Elija al menos un permiso del primer grupo.' });
    if (this.lado2().length === 0)
      lista.push({ campo: 'lado2', texto: 'Elija al menos un permiso del segundo grupo.' });
    if (!this.dura() && this.diasMaximos().trim() !== '' && !(Number(this.diasMaximos()) >= 1))
      lista.push({ campo: 'dias', texto: 'Los días de una excepción son un número desde 1.' });
    return lista;
  });

  protected errorDe(campo: string): string {
    return this.intento() ? (this.problemas().find((p) => p.campo === campo)?.texto ?? '') : '';
  }

  ngOnInit(): void {
    const r = this.rule();
    if (r === null) return;
    this.codigo.set(r.code);
    this.nombre.set(r.name);
    this.base.set(r.baseRuleCode ?? null);
    this.lado1.set(r.atomsA);
    this.lado2.set(r.atomsB);
    this.alcance.set(r.scope);
    this.accion.set(r.action);
    this.dura.set(r.isHard);
    this.diasMaximos.set(
      r.maxExceptionDays === null || r.maxExceptionDays === undefined
        ? ''
        : String(r.maxExceptionDays),
    );
    this.motivo.set(r.rationale ?? '');
  }

  protected enviar(): void {
    this.intento.set(true);
    if (this.problemas().length > 0 || this.busy()) return;
    const dias =
      this.dura() || this.diasMaximos().trim() === '' ? undefined : Number(this.diasMaximos());
    const razon = this.motivo().trim();
    const r = this.rule();
    if (r !== null && r.id !== undefined) {
      this.submitted.emit({
        mode: 'edit',
        ruleId: r.id,
        change: {
          expectedRowVersion: r.rowVersion ?? 1,
          name: this.nombre().trim(),
          atomsA: this.lado1(),
          atomsB: this.lado2(),
          scope: this.alcance(),
          action: this.accion(),
          isHard: this.dura(),
          ...(dias === undefined ? {} : { maxExceptionDays: dias }),
          ...(razon === '' ? {} : { rationale: razon }),
        },
      });
      return;
    }
    const base = this.base();
    this.submitted.emit({
      mode: 'create',
      rule: {
        code: this.codigo().trim(),
        name: this.nombre().trim(),
        atomsA: this.lado1(),
        atomsB: this.lado2(),
        scope: this.alcance(),
        action: this.accion(),
        isHard: this.dura(),
        ...(base === null || base === '' ? {} : { baseRuleCode: base }),
        ...(dias === undefined ? {} : { maxExceptionDays: dias }),
        ...(razon === '' ? {} : { rationale: razon }),
      },
    });
  }
}
