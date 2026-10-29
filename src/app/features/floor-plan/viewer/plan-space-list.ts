import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, viewChild, type TemplateRef } from '@angular/core';

import type { SpaceState } from '../../../core/data-access/floor-plan/floor-plan.types';
import type { SpaceView } from '../../../core/floor-plan/plan-view';
import { stateVisual, type StateVisual } from '../../../core/floor-plan/state-visuals';
import { ready } from '../../../core/view-state/view-state';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { PlanGlyphIcon } from '../../../shared/components/atoms/plan-glyph/plan-glyph-icon';
import { DataTable } from '../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../shared/components/organisms/data-table/data-table.types';

interface Row {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kind: string;
  readonly unit: string;
  readonly occupancy: StateVisual | null;
  readonly availability: StateVisual | null;
  readonly hygiene: StateVisual | null;
  readonly isolation: StateVisual | null;
}

type Cell = TemplateRef<{ $implicit: Row }>;

/**
 * Alternativa en lista (CONTRATO-PLANO §5.2 y §5.7): los mismos espacios y las
 * mismas columnas que la tarjeta, ordenables y navegables con teclado. Es la vía
 * accesible **completa**, no un parche del plano: seleccionar, abrir la ficha y
 * leer cada estado se hace desde acá.
 */
@Component({
  selector: 'app-plan-space-list',
  imports: [AppButton, DataTable, NgTemplateOutlet, PlanGlyphIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: block; }
    .cell-state { display: inline-flex; align-items: center; gap: var(--sp-1); }
    .code-btn { background: none; border: 0; padding: 0; font: inherit; color: var(--text-link); text-decoration: underline; cursor: pointer; }
    .code-btn:focus-visible { outline: 3px solid var(--focus-ring); outline-offset: 2px; }
  `,
  template: `
    <app-data-table
      [state]="tableState()"
      [columns]="columns()"
      [trackBy]="trackBy"
      caption="Espacios del plano"
      heading="Espacios"
      maxHeight="62vh"
      data-testid="plan-list"
    />
    <ng-template #codeCell let-row>
      <button type="button" class="code-btn" [attr.aria-pressed]="row.id === selectedId()" (click)="pick.emit(row.id)">{{ row.code }}</button>
    </ng-template>
    <ng-template #occupancyCell let-row><ng-container *ngTemplateOutlet="visualCell; context: { v: row.occupancy }" /></ng-template>
    <ng-template #availabilityCell let-row><ng-container *ngTemplateOutlet="visualCell; context: { v: row.availability }" /></ng-template>
    <ng-template #hygieneCell let-row><ng-container *ngTemplateOutlet="visualCell; context: { v: row.hygiene }" /></ng-template>
    <ng-template #isolationCell let-row><ng-container *ngTemplateOutlet="visualCell; context: { v: row.isolation }" /></ng-template>
    <ng-template #visualCell let-v="v">
      @if (v) {
        <span class="cell-state">
          @if (v.glyph) { <app-plan-glyph [name]="v.glyph" /> }
          @if (v.mark) { <strong>{{ v.mark }}</strong> }
          {{ v.label }}
        </span>
      } @else { — }
    </ng-template>
    <ng-template #openCell let-row>
      <button app-button size="sm" variant="outline" type="button" (clicked)="open.emit(row.id)">Ficha</button>
    </ng-template>
  `,
})
export class PlanSpaceList {
  readonly spaces = input.required<readonly SpaceView[]>();
  readonly states = input<Readonly<Record<string, SpaceState>>>({});
  readonly canSeeState = input(true);
  readonly selectedId = input<string | null>(null);

  readonly pick = output<string>();
  readonly open = output<string>();

  private readonly codeCell = viewChild<Cell>('codeCell');
  private readonly occupancyCell = viewChild<Cell>('occupancyCell');
  private readonly availabilityCell = viewChild<Cell>('availabilityCell');
  private readonly hygieneCell = viewChild<Cell>('hygieneCell');
  private readonly isolationCell = viewChild<Cell>('isolationCell');
  private readonly openCell = viewChild<Cell>('openCell');

  protected readonly trackBy = (row: Row): string => row.id;

  protected readonly rows = computed<Row[]>(() => {
    const states = this.states();
    const withState = this.canSeeState();
    return this.spaces()
      .filter((s) => s.inScope && s.band !== 'zone')
      .map((space) => {
        const state = withState ? states[space.id] : undefined;
        return {
          id: space.id,
          code: space.code,
          name: space.name,
          kind: space.card?.functionDisplay ?? '',
          unit: space.card?.ownerUnit?.name ?? '',
          occupancy: state ? stateVisual('occupancy', state) : null,
          availability: state ? stateVisual('availability', state) : null,
          hygiene: state ? stateVisual('hygiene', state) : null,
          isolation: state ? stateVisual('isolation', state) : null,
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true }));
  });

  protected readonly tableState = computed(() => ready(this.rows()));

  protected readonly columns = computed<ColumnDef<Row>[]>(() => {
    const base: ColumnDef<Row>[] = [
      { key: 'code', header: 'Código', priority: 1, cell: this.codeCell() },
      { key: 'name', header: 'Nombre', priority: 1 },
      { key: 'kind', header: 'Función', priority: 2 },
      { key: 'unit', header: 'Unidad', priority: 2 },
    ];
    if (this.canSeeState()) {
      base.push(
        { key: 'occupancy', header: 'Ocupación', priority: 1, cell: this.occupancyCell() },
        { key: 'availability', header: 'Disponibilidad', priority: 2, cell: this.availabilityCell() },
        { key: 'hygiene', header: 'Higiene', priority: 3, cell: this.hygieneCell() },
        { key: 'isolation', header: 'Aislamiento', priority: 3, cell: this.isolationCell() },
      );
    }
    base.push({ key: 'open', header: 'Ficha', priority: 1, accion: true, cell: this.openCell() });
    return base;
  });
}
