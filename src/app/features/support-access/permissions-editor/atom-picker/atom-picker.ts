import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import type {
  PermissionAtomView,
  PermissionCatalog,
} from '../../../../core/data-access/access-governance/access-explain.types';
import {
  ATOM_SENSITIVITY_LABELS,
  type AtomSensitivity,
  type SupportAtom,
} from '../../../../core/data-access/support-access/support-atoms';
import { Input } from '../../../../shared/components/atoms/input/input';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';
import { Checkbox } from '../../../../shared/components/atoms/checkbox/checkbox';
import { Accordion } from '../../../../shared/components/molecules/accordion/accordion';
import { AccordionPanel } from '../../../../shared/components/molecules/accordion/accordion-panel/accordion-panel';

/** Un permiso preciso, tal como lo pinta la lista: con su sensibilidad y lo que pide, dicho con palabras. */
interface AtomRow {
  readonly atom: PermissionAtomView;
  readonly checked: boolean;
  readonly blockedReason: string | null;
  readonly tags: readonly string[];
  readonly issues: readonly string[];
}

interface CategoryGroup {
  readonly code: string;
  readonly name: string;
  readonly rows: readonly AtomRow[];
  readonly selected: number;
  readonly total: number;
}

const SENSITIVITY_GLYPH: Readonly<Record<AtomSensitivity, string>> = {
  LOW: '○',
  MEDIUM: '◐',
  HIGH: '▲',
  CRITICAL: '■',
};
const SENSITIVITY_TONE: Readonly<Record<AtomSensitivity, BadgeVariant>> = {
  LOW: 'success',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'error',
};

const NOT_ASSIGNABLE = 'Solo el administrador de seguridad puede dar esto.';

/**
 * Los permisos precisos (73), agrupados por las 7 categorías, para el modo **Avanzado**.
 *
 * Cada uno muestra su **sensibilidad** (texto, ícono y color: nunca solo color) y lo que pide al usarse (motivo,
 * segundo paso, aprobación). Es un campo de formulario: recibe lo marcado y avisa cada cambio; no decide qué se
 * puede dar —eso lo decide la API—. Reutilizable: «Mi equipo» lo usa con `disabledReasons` para los permisos que
 * quedan fuera del techo de quien administra.
 */
@Component({
  selector: 'app-atom-picker',
  imports: [Accordion, AccordionPanel, AppButton, Badge, Checkbox, Input],
  templateUrl: './atom-picker.html',
  styleUrl: './atom-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AtomPicker {
  readonly catalog = input.required<PermissionCatalog>();
  /** Los átomos que el permiso da (con los alias ya expandidos). */
  readonly selected = input<readonly string[]>([]);
  /** Por átomo, el motivo por el que no se puede marcar (techo de quien administra, regla de la organización). */
  readonly disabledReasons = input<Readonly<Record<string, string>>>({});
  /** Por átomo, los errores del servidor (techo, barandilla, conflicto de funciones…). */
  readonly issues = input<Readonly<Record<string, readonly string[]>>>({});
  readonly disabled = input(false);

  readonly toggled = output<{ readonly atom: SupportAtom; readonly on: boolean }>();

  protected readonly query = signal<string | number | null>('');
  private readonly opened = signal<ReadonlySet<string>>(new Set());
  private readonly touched = signal(false);

  protected readonly groups = computed<readonly CategoryGroup[]>(() => {
    const needle = String(this.query() ?? '')
      .trim()
      .toLocaleLowerCase('es');
    const selected = new Set(this.selected());
    const reasons = this.disabledReasons();
    const issues = this.issues();
    return this.catalog().categories.map((category) => {
      const all = this.catalog().atoms.filter((a) => a.category === category.code);
      const shown = all.filter(
        (a) =>
          needle === '' ||
          a.name.toLocaleLowerCase('es').includes(needle) ||
          a.code.includes(needle),
      );
      return {
        code: category.code,
        name: category.name,
        selected: all.filter((a) => selected.has(a.code)).length,
        total: all.length,
        rows: shown.map((atom): AtomRow => ({
          atom,
          checked: selected.has(atom.code),
          blockedReason: reasons[atom.code] ?? (atom.supportAssignable ? null : NOT_ASSIGNABLE),
          tags: this.tagsOf(atom),
          issues: issues[atom.code] ?? [],
        })),
      };
    });
  });

  /** Una categoría empieza abierta si ya tiene algo marcado o algún error; el resto, plegada. */
  protected isOpen(group: CategoryGroup): boolean {
    if (this.touched()) return this.opened().has(group.code);
    return (
      group.selected > 0 ||
      group.rows.some((r) => r.issues.length > 0) ||
      String(this.query() ?? '').trim() !== ''
    );
  }

  protected setOpen(group: CategoryGroup, open: boolean): void {
    this.snapshotOpen();
    this.opened.update((current) => {
      const next = new Set(current);
      if (open) next.add(group.code);
      else next.delete(group.code);
      return next;
    });
  }

  protected expandAll(open: boolean): void {
    this.touched.set(true);
    this.opened.set(open ? new Set(this.groups().map((g) => g.code)) : new Set());
  }

  /** Al primer toque manual se fija lo que estaba abierto por omisión. */
  private snapshotOpen(): void {
    if (this.touched()) return;
    this.opened.set(
      new Set(
        this.groups()
          .filter((g) => this.isOpen(g))
          .map((g) => g.code),
      ),
    );
    this.touched.set(true);
  }

  protected allOpen = computed(() => this.groups().every((g) => this.isOpen(g)));

  protected label(sensitivity: AtomSensitivity): string {
    return ATOM_SENSITIVITY_LABELS[sensitivity];
  }
  protected glyph(sensitivity: AtomSensitivity): string {
    return SENSITIVITY_GLYPH[sensitivity];
  }
  protected tone(sensitivity: AtomSensitivity): BadgeVariant {
    return SENSITIVITY_TONE[sensitivity];
  }

  private tagsOf(atom: PermissionAtomView): readonly string[] {
    const tags: string[] = [];
    if (atom.requiresReason) tags.push('Pide motivo');
    if (atom.requiresStepUp) tags.push('Pide verificación en dos pasos');
    if (atom.approvalMode === 'DOCTOR') tags.push('Pide aprobación del doctor');
    else if (atom.approvalMode === 'SECOND_APPROVER') tags.push('Pide aprobación de otra persona');
    return tags;
  }

  protected onToggle(row: AtomRow, on: boolean): void {
    this.toggled.emit({ atom: row.atom.code as SupportAtom, on });
  }

  protected onSearch(value: string | number | null): void {
    this.query.set(value);
  }
}
