import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import type {
  PermissionAtomView,
  PermissionCatalog,
} from '../../../../core/data-access/access-governance/access-explain.types';
import type { SupportCondition } from '../../../../core/data-access/access-governance/conditions.types';
import {
  SUPPORT_ACTION_LABELS,
  type SupportActionCode,
} from '../../../../core/data-access/support-access/support-access.types';
import {
  expandSupportAction,
  type SupportAtom,
} from '../../../../core/data-access/support-access/support-atoms';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { AtomPicker } from '../atom-picker/atom-picker';
import { ConditionEditor } from '../condition-editor/condition-editor';
import {
  conditionOf,
  expandAliases,
  rowAliases,
  rowAtoms,
  rowConditionCount,
  setCondition,
  setEffect,
  setValidTo,
  toggleAtom,
  type ConditionScope,
  type EditorGrant,
} from '../editor-grant';
import type { PlacedIssue } from '../issue-placement';

/**
 * El modo **Avanzado** del editor: sobre **un** permiso a la vez, sus permisos precisos (73, en 7 categorías),
 * si **permite o deniega**, hasta cuándo vale y sus **condiciones** en frases completables.
 *
 * Trabaja sobre las filas del editor y avisa con `rowsChange`; no guarda nada ni habla con la API. Los errores del
 * servidor llegan ya ubicados (`issues`) y se muestran junto al campo que corresponde.
 */
@Component({
  selector: 'app-advanced-panel',
  imports: [Alert, AppButton, AtomPicker, ConditionEditor, Input, Select, Switch],
  templateUrl: './advanced-panel.html',
  styleUrl: './advanced-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdvancedPanel {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly rows = input.required<readonly EditorGrant[]>();
  readonly catalog = input.required<PermissionCatalog>();
  /** El nombre corto de cada permiso («Dr. Andrés Pérez», «Servicio · Ecografía»). */
  readonly rowLabel = input.required<(row: EditorGrant) => string>();
  readonly issues = input<readonly PlacedIssue[]>([]);
  /** La fila del editor de cada cambio, en el mismo orden que `grants[i]` de la simulación. */
  readonly writeKeys = input<readonly string[]>([]);

  readonly rowsChange = output<readonly EditorGrant[]>();

  protected readonly selectedKey = signal<string | null>(null);
  private readonly scope = signal<ConditionScope>('ALL');

  protected readonly row = computed<EditorGrant | null>(
    () => this.rows().find((r) => r.key === this.selectedKey()) ?? this.rows()[0] ?? null,
  );
  protected readonly atomViews = computed<readonly PermissionAtomView[]>(() => {
    const row = this.row();
    if (row === null) return [];
    const wanted = new Set<string>(rowAtoms(row));
    return this.catalog().atoms.filter((a) => wanted.has(a.code));
  });
  protected readonly selectedAtoms = computed<readonly string[]>(() =>
    this.atomViews().map((a) => a.code),
  );
  protected readonly aliasLabels = computed(() => {
    const row = this.row();
    return row === null ? [] : rowAliases(row).map((code) => SUPPORT_ACTION_LABELS[code]);
  });
  protected readonly isDeny = computed(() => this.row()?.effect === 'DENY');
  protected readonly activeScope = computed<ConditionScope>(() => {
    const scope = this.scope();
    return scope === 'ALL' || this.selectedAtoms().includes(scope) ? scope : 'ALL';
  });
  protected readonly scopeOptions = computed<readonly SelectOption<string>[]>(() => [
    { value: 'ALL', label: 'Todo el permiso' },
    ...this.atomViews().map((a) => ({ value: a.code, label: `Solo: ${a.name}` })),
  ]);
  protected readonly scopeAtoms = computed<readonly PermissionAtomView[]>(() => {
    const scope = this.activeScope();
    return scope === 'ALL' ? this.atomViews() : this.atomViews().filter((a) => a.code === scope);
  });
  protected readonly scopeCondition = computed<SupportCondition | undefined>(() => {
    const row = this.row();
    return row === null ? undefined : conditionOf(row, this.activeScope());
  });
  protected readonly conditionCount = computed(() => {
    const row = this.row();
    return row === null ? 0 : rowConditionCount(row);
  });
  /** Cambia al borrar la fecha, para que el campo se dibuje de nuevo con la que haya quedado. */
  protected readonly vigenciaVersion = signal(0);
  protected readonly validToDate = computed(() => this.row()?.validTo?.slice(0, 10) ?? '');

  /** Los errores del servidor sobre el permiso que se edita. */
  private readonly rowIssues = computed(() => {
    const key = this.row()?.key;
    return this.issues().filter(
      (i) => i.writeIndex !== null && this.writeKeys()[i.writeIndex] === key,
    );
  });
  /** Errores de un permiso preciso (techo, barandilla…): van junto a su casilla. */
  protected readonly atomIssues = computed<Readonly<Record<string, readonly string[]>>>(() => {
    const row = this.row();
    const result: Record<string, string[]> = {};
    if (row === null) return result;
    for (const issue of this.rowIssues()) {
      const code = issue.actionIndex === undefined ? undefined : row.actions[issue.actionIndex];
      if (
        code !== undefined &&
        expandSupportAction(code).length === 1 &&
        expandSupportAction(code)[0] === code
      )
        (result[code] ??= []).push(issue.message);
    }
    return result;
  });
  /** Errores de un alias antiguo: van junto al aviso de alias. */
  protected readonly aliasIssues = computed(() => {
    const row = this.row();
    if (row === null) return [];
    return this.rowIssues().filter(
      (i) =>
        i.actionIndex !== undefined &&
        rowAliases(row).includes(row.actions[i.actionIndex] as SupportActionCode),
    );
  });
  protected readonly conditionIssues = computed(() => {
    const scope = this.activeScope();
    return this.rowIssues().filter((i) =>
      scope === 'ALL' ? i.wholePermission === true : i.atom === scope,
    );
  });
  /** Lo que no es de una casilla ni de una condición (conflicto de funciones, vigencia…). */
  protected readonly generalIssues = computed(() =>
    this.rowIssues().filter(
      (i) => i.actionIndex === undefined && i.atom === undefined && i.wholePermission !== true,
    ),
  );

  /* ---- cambios ------------------------------------------------------------------------------- */

  private apply(next: readonly EditorGrant[]): void {
    this.rowsChange.emit(next);
  }
  protected pick(key: string): void {
    this.selectedKey.set(key);
    this.scope.set('ALL');
  }
  protected onToggle(event: { readonly atom: SupportAtom; readonly on: boolean }): void {
    const row = this.row();
    if (row !== null) this.apply(toggleAtom(this.rows(), row.key, event.atom, event.on));
  }
  protected onEffect(deny: boolean): void {
    const row = this.row();
    if (row !== null) this.apply(setEffect(this.rows(), row.key, deny ? 'DENY' : 'ALLOW'));
  }
  protected onExpandAliases(): void {
    const row = this.row();
    if (row !== null) this.apply(expandAliases(this.rows(), row.key));
  }
  protected onValidTo(value: string | number | null): void {
    const row = this.row();
    if (row === null || typeof value !== 'string') return;
    // Borrar la fecha: el editor puede volver a ponerla (la API no sabe quitar un vencimiento ya guardado). El campo del
    // navegador no se entera solo, así que se vuelve a dibujar con lo que quede en el borrador.
    if (value === '') this.vigenciaVersion.update((n) => n + 1);
    // Fin del día en la zona del navegador: la fecha elegida vale hasta la noche.
    this.apply(
      setValidTo(
        this.rows(),
        row.key,
        value === '' ? undefined : new Date(`${value}T23:59:00`).toISOString(),
      ),
    );
  }
  protected onScope(value: string | null): void {
    this.scope.set((value ?? 'ALL') as ConditionScope);
  }
  protected onCondition(condition: SupportCondition | undefined): void {
    const row = this.row();
    if (row !== null) this.apply(setCondition(this.rows(), row.key, this.activeScope(), condition));
  }

  /** Lleva al control del error: elige el permiso, el alcance y enfoca la casilla o la sección. */
  focusIssue(issue: PlacedIssue): void {
    const key = issue.writeIndex === null ? undefined : this.writeKeys()[issue.writeIndex];
    if (key !== undefined) this.selectedKey.set(key);
    this.scope.set(issue.atom !== undefined ? (issue.atom as ConditionScope) : 'ALL');
    const row = this.rows().find((r) => r.key === key) ?? this.row();
    const code = issue.actionIndex === undefined ? undefined : row?.actions[issue.actionIndex];
    const selector =
      issue.section !== undefined
        ? `[data-testid="cond-toggle-${issue.section}"]`
        : code !== undefined && expandSupportAction(code)[0] === code
          ? `[data-testid="atom-check-${code}"] input`
          : '[data-testid="advanced-heading"]';
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
