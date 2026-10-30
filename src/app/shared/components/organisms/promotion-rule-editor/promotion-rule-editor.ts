import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { describeDraftFailure } from '../../../../core/promotions-engine/describe-failure';
import { exampleFor } from '../../../../core/promotions-engine/describe-example';
import { describeMechanic, isDescribable } from '../../../../core/promotions-engine/describe-mechanic';
import {
  MECHANIC_FAMILIES,
  infoOf,
  mechanicsOf,
} from '../../../../core/promotions-engine/mechanic-catalog';
import { sumLines } from '../../../../core/promotions-engine/promotion-money';
import type {
  DraftFailure,
  MechanicFamily,
  MechanicKind,
  PromotableItem,
} from '../../../../core/promotions-engine/promotion-mechanics.types';
import {
  allowsAllItems,
  ruleFromFields,
  textOf,
  withFamily,
  withKind,
} from '../../../../core/promotions-engine/rule-fields';
import type { RuleFields, TierFields } from '../../../../core/promotions-engine/rule-fields';
import { AppButton } from '../../atoms/button/button';
import { Badge } from '../../atoms/badge/badge';
import { Input } from '../../atoms/input/input';
import { Select } from '../../atoms/select/select';
import type { SelectOption } from '../../atoms/select/select.types';
import { Switch } from '../../atoms/switch/switch';
import { Accordion } from '../../molecules/accordion/accordion';
import { AccordionPanel } from '../../molecules/accordion/accordion-panel/accordion-panel';
import { CheckboxGroup } from '../../molecules/checkbox-group/checkbox-group';
import type { OpcionDeCasilla } from '../../molecules/checkbox-group/checkbox-group';
import { FormField } from '../../molecules/form-field/form-field';
import { Radio } from '../../molecules/radio/radio';
import { RadioGroup } from '../../molecules/radio-group/radio-group';
import { SegmentedControl } from '../../molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../molecules/segmented-control/segmented-control.types';

/** Cuántos tramos admite una mecánica escalonada: más es ilegible en una ficha. */
const MAX_TIERS = 6;

/** Cuántos tramos deja siempre: una escalera sin escalones no es una mecánica. */
const MIN_TIERS = 1;

/** Las dos listas de tramos que el formulario sabe editar. */
type TierList = 'quantityTiers' | 'spendTiers';

/** Lunes primero: así se lee la semana en el mostrador. */
const WEEKDAYS: readonly OpcionDeCasilla[] = [
  { value: '1', label: 'Lunes' },
  { value: '2', label: 'Martes' },
  { value: '3', label: 'Miércoles' },
  { value: '4', label: 'Jueves' },
  { value: '5', label: 'Viernes' },
  { value: '6', label: 'Sábado' },
  { value: '0', label: 'Domingo' },
];

/** Qué campos señala cada fallo, para pintar el error donde está el problema. */
const FAILURES_OF_FIELD = {
  percent: ['PERCENT_OUT_OF_RANGE'],
  amount: ['AMOUNT_INVALID', 'AMOUNT_EXCEEDS_PRICE'],
  minSpend: ['MIN_SPEND_INVALID'],
  quantities: ['BUY_QUANTITIES_INVALID'],
  nth: ['NTH_INVALID'],
  multiplier: ['MULTIPLIER_INVALID'],
  bundle: ['BUNDLE_NEEDS_TWO_ITEMS', 'BUNDLE_PRICE_NOT_A_DISCOUNT'],
  pair: ['TRIGGER_REWARD_MISSING', 'TRIGGER_EQUALS_REWARD'],
  tiers: ['TIERS_EMPTY', 'TIERS_NOT_INCREASING'],
  cap: ['CAP_INVALID'],
  limit: ['LIMIT_INVALID'],
  coupon: ['COUPON_INVALID'],
  time: ['TIME_WINDOW_INVALID'],
} as const satisfies Record<string, readonly DraftFailure[]>;

type FieldWithFailure = keyof typeof FAILURES_OF_FIELD;

/**
 * **Editor de la regla de una campaña**: qué descuenta, sobre qué y con qué
 * condiciones. Presentacional: recibe los campos como texto y emite los
 * siguientes; no guarda estado ni sabe de farmacias.
 *
 * Es el mismo editor para cualquier organización que promocione algo —un
 * servicio, un estudio, un plan—: lo único que cambia es el `items` que recibe.
 *
 * El texto de cada mecánica, de su vista previa y de sus errores sale del
 * motor (`describeMechanic`, `exampleFor`, `describeDraftFailure`): acá no se
 * escribe prosa de promociones, para que se lea igual en todos lados.
 */
@Component({
  selector: 'app-promotion-rule-editor',
  imports: [
    Accordion,
    AccordionPanel,
    AppButton,
    Badge,
    CheckboxGroup,
    FormField,
    Input,
    NgTemplateOutlet,
    Radio,
    RadioGroup,
    SegmentedControl,
    Select,
    Switch,
  ],
  templateUrl: './promotion-rule-editor.html',
  styleUrl: './promotion-rule-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PromotionRuleEditor {
  readonly fields = input.required<RuleFields>();
  /** Los productos (o servicios, o estudios) elegidos, con su precio de lista. */
  readonly items = input<readonly PromotableItem[]>([]);
  /** «Bs», «USD»… tal como se pinta. */
  readonly currency = input('Bs');
  /** Lo que el validador encontró mal, para marcarlo en su campo. */
  readonly failures = input<readonly DraftFailure[]>([]);

  /** Los campos con el cambio ya aplicado. Quien los guarda es el padre. */
  readonly fieldsChange = output<RuleFields>();

  protected readonly weekdays = WEEKDAYS;
  protected readonly maxTiers = MAX_TIERS;
  protected readonly minTiers = MIN_TIERS;

  protected readonly familyOptions: readonly SegmentedOption<MechanicFamily>[] = MECHANIC_FAMILIES.map(
    (family) => ({ value: family.family, label: family.short }),
  );

  /** Las mismas familias, con el nombre completo, para el desplegable de pantalla angosta. */
  protected readonly familySelectOptions: readonly SelectOption<MechanicFamily>[] = MECHANIC_FAMILIES.map(
    (family) => ({ value: family.family, label: family.label }),
  );

  protected readonly kindsOfFamily = computed(() => mechanicsOf(this.fields().family));
  protected readonly info = computed(() => infoOf(this.fields().kind));
  protected readonly rule = computed(() => ruleFromFields(this.fields()));

  protected readonly canApplyToAllItems = computed(() => allowsAllItems(this.fields().kind));

  /** Los ítems como opciones de un selector, para el producto que se compra y el que se bonifica. */
  protected readonly itemOptions = computed<readonly SelectOption<string>[]>(() =>
    this.items().map((item) => ({
      value: item.itemId,
      label: item.detail === null ? item.label : `${item.label} · ${item.detail}`,
    })),
  );

  /** La suma de los precios de lista de los productos del combo. */
  protected readonly bundleListTotal = computed(() =>
    sumLines(this.items().map((item) => ({ price: item.unitPrice, quantity: 1 }))),
  );

  /** La vista previa: cómo lo lee quien compra, con un caso calculado. */
  protected readonly preview = computed(() => {
    const { mechanic, conditions, allItems } = this.rule();
    // Con un campo a medias la vista previa calla y pide lo que falta: decir
    // «NaN % menos» o «Combo a Bs : …» es peor que no decir nada.
    if (!isDescribable(mechanic)) {
      return null;
    }
    const items = this.items();
    const currency = this.currency();
    const labelOf = (itemId: string): string | null =>
      items.find((item) => item.itemId === itemId)?.label ?? null;
    return {
      ...describeMechanic(mechanic, { labelOf, currency }),
      example: exampleFor(mechanic, items, conditions, currency, allItems),
    };
  });

  /* ─── Cambios ─────────────────────────────────────────────────────────── */

  protected patch(changes: Partial<RuleFields>): void {
    this.fieldsChange.emit({ ...this.fields(), ...changes });
  }

  protected chooseFamily(family: MechanicFamily): void {
    this.fieldsChange.emit(withFamily(this.fields(), family));
  }

  /** El desplegable puede quedar sin valor; sin familia no hay mecánicas que ofrecer. */
  protected chooseFamilyFromSelect(family: MechanicFamily | null): void {
    if (family !== null) {
      this.chooseFamily(family);
    }
  }

  /** El grupo de radios puede devolver `null`; sin mecánica no hay con qué calcular. */
  protected chooseKind(kind: MechanicKind | null): void {
    if (kind !== null) {
      this.fieldsChange.emit(withKind(this.fields(), kind));
    }
  }

  /** Un campo numérico a texto, sin el `$any()` que apagaría la comprobación. */
  protected text(value: string | number | null): string {
    return textOf(value);
  }

  protected tiersOf(list: TierList): readonly TierFields[] {
    return this.fields()[list];
  }

  protected patchTier(list: TierList, index: number, changes: Partial<TierFields>): void {
    this.patch({
      [list]: this.fields()[list].map((tier, position) =>
        position === index ? { ...tier, ...changes } : tier,
      ),
    });
  }

  protected addTier(list: TierList): void {
    if (this.fields()[list].length < MAX_TIERS) {
      this.patch({ [list]: [...this.fields()[list], { threshold: '', percent: '' }] });
    }
  }

  protected removeTier(list: TierList, index: number): void {
    if (this.fields()[list].length > MIN_TIERS) {
      this.patch({ [list]: this.fields()[list].filter((_, position) => position !== index) });
    }
  }

  /* ─── Errores en el campo ─────────────────────────────────────────────── */

  /** El primer error del campo, o vacío. Es lo que `app-form-field` pinta. */
  protected errorOf(field: FieldWithFailure): string {
    const codes: readonly DraftFailure[] = FAILURES_OF_FIELD[field];
    const found = this.failures().find((failure) => codes.includes(failure));
    return found === undefined ? '' : describeDraftFailure(found);
  }

  protected hasErrorIn(field: FieldWithFailure): boolean {
    return this.errorOf(field) !== '';
  }
}
