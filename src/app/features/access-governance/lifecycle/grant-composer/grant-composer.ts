import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import {
  ATOM_CATEGORY_CODES,
  ATOM_CATEGORY_LABELS,
  ATOM_SENSITIVITY_LABELS,
  atomsOfCategory,
  type AtomCategoryCode,
  type PermissionAtomMeta,
} from '../../../../core/data-access/support-access/support-atoms';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import { Accordion } from '../../../../shared/components/molecules/accordion/accordion';
import { AccordionPanel } from '../../../../shared/components/molecules/accordion/accordion-panel/accordion-panel';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import type { GrantDraft, TargetOption } from '../grant-draft/grant-draft';

interface CategoryView {
  readonly code: AtomCategoryCode;
  readonly label: string;
  readonly atoms: readonly AtomRow[];
  readonly marked: number;
}

interface AtomRow {
  readonly meta: PermissionAtomMeta;
  readonly checked: boolean;
  /** Por qué no se puede marcar, en lenguaje simple; `null` si se puede. */
  readonly blockedReason: string | null;
  readonly label: string;
  readonly traits: string;
}

/**
 * **Un permiso en edición** (CONTRATO-GOBIERNO §9.4, versión compacta para el cambio de rol y la administración delegada):
 * el objetivo, hasta cuándo vale y los permisos atómicos por categoría. Lo que está fuera del techo de quien edita
 * aparece **deshabilitado con su explicación** en palabras («Solo el administrador de seguridad puede dar esto»), nunca
 * oculto. No decide nada: la API vuelve a validar al simular y al guardar.
 */
@Component({
  selector: 'app-grant-composer',
  imports: [Accordion, AccordionPanel, AppButton, Checkbox, FormField, Input, Select],
  templateUrl: './grant-composer.html',
  styleUrl: './grant-composer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrantComposer {
  readonly draft = input.required<GrantDraft>();
  readonly options = input.required<readonly TargetOption[]>();
  /** Razón por la que un átomo no se puede dar; `null` si se puede. */
  readonly blocked = input<(atom: string) => string | null>(() => null);
  readonly lockTarget = input(false);
  /** Último día que se puede elegir (`YYYY-MM-DD`), p. ej. el tope de vigencia del administrador delegado. */
  readonly maxValidTo = input('');
  readonly idPrefix = input('grant');
  readonly removable = input(false);

  readonly draftChange = output<GrantDraft>();
  readonly removed = output<void>();

  private readonly openCategories = signal<ReadonlySet<AtomCategoryCode>>(new Set());

  protected readonly targetOptions = computed<readonly SelectOption<string>[]>(() =>
    this.options().map((o) => ({ value: o.key, label: o.label })),
  );
  protected readonly targetLabel = computed(
    () => this.options().find((o) => o.key === this.draft().targetKey)?.label ?? 'Sin elegir',
  );

  protected readonly dateError = computed(() => {
    const max = this.maxValidTo();
    const day = this.draft().validTo;
    return max !== '' && day !== '' && day > max
      ? `Como máximo hasta el ${max}: es lo que usted puede dar.`
      : '';
  });

  protected readonly categories = computed<readonly CategoryView[]>(() => {
    const marked = new Set(this.draft().atoms);
    const reasonOf = this.blocked();
    return ATOM_CATEGORY_CODES.map((code) => {
      const atoms = atomsOfCategory(code)
        .filter((meta) => meta.supportAssignable)
        .map((meta): AtomRow => {
          const blockedReason = reasonOf(meta.code);
          return {
            meta,
            checked: marked.has(meta.code),
            blockedReason,
            label: blockedReason === null ? meta.name : `${meta.name}. ${blockedReason}`,
            traits: this.traitsOf(meta),
          };
        });
      return {
        code,
        label: ATOM_CATEGORY_LABELS[code],
        atoms,
        marked: atoms.filter((a) => a.checked).length,
      };
    }).filter((c) => c.atoms.length > 0);
  });

  protected isOpen(category: CategoryView): boolean {
    return this.openCategories().has(category.code) || category.marked > 0;
  }

  protected setOpen(category: CategoryView, open: boolean): void {
    this.openCategories.update((current) => {
      const next = new Set(current);
      if (open) next.add(category.code);
      else next.delete(category.code);
      return next;
    });
  }

  protected setTarget(key: string | null): void {
    if (key === null) return;
    this.draftChange.emit({ ...this.draft(), targetKey: key });
  }

  protected setValidTo(value: string | number | null): void {
    this.draftChange.emit({ ...this.draft(), validTo: typeof value === 'string' ? value : '' });
  }

  protected toggle(row: AtomRow, checked: boolean): void {
    if (row.blockedReason !== null) return;
    const current = this.draft().atoms;
    const atoms = checked
      ? [...new Set([...current, row.meta.code])]
      : current.filter((a) => a !== row.meta.code);
    this.draftChange.emit({ ...this.draft(), atoms });
  }

  private traitsOf(meta: PermissionAtomMeta): string {
    const parts = [
      `Sensibilidad ${ATOM_SENSITIVITY_LABELS[meta.sensitivity].toLocaleLowerCase('es')}`,
    ];
    if (meta.requiresReason) parts.push('pide motivo');
    if (meta.requiresStepUp) parts.push('pide segundo paso');
    if (meta.approvalMode !== null) parts.push('pide aprobación');
    return parts.join(' · ');
  }
}
