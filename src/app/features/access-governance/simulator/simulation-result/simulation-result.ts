import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import type { SimulateAccessResponse } from '../../../../core/data-access/access-governance/access-explain.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import { actionName, changeInfo, decisionWords, SOD_ACTION_LABELS } from '../explain-text';

type Filter = 'ALL' | 'CHANGES';

const FILTERS: readonly SegmentedOption<Filter>[] = [
  { value: 'ALL', label: 'Todos los casos' },
  { value: 'CHANGES', label: 'Solo lo que cambia' },
];

const PAGE = 25;

/**
 * **El resultado de simular un borrador**: validación, resumen en lenguaje simple, impacto y la comparación caso por caso
 * (CONTRATO-GOBIERNO §5.3). Antes y después vienen de la API, calculados con el mismo motor; acá solo se ordenan y se dicen.
 *
 * Cada cambio se marca con símbolo y palabras (`＋ Ahora sí puede`, `－ Ya no puede`, `= Sin cambio`): nunca solo con color.
 */
@Component({
  selector: 'app-simulation-result',
  imports: [AppButton, Badge, DatePipe, SegmentedControl],
  templateUrl: './simulation-result.html',
  styleUrl: './simulation-result.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimulationResult {
  readonly result = input.required<SimulateAccessResponse>();
  /** Cuántos de los primeros casos los escribió quien simula (para ofrecerles «¿Por qué?»). */
  readonly ownScenarios = input(0);
  readonly explainScenario = output<number>();

  protected readonly filters = FILTERS;
  protected readonly filter = signal<Filter>('ALL');
  protected readonly shown = signal(PAGE);

  protected readonly rows = computed(() =>
    this.result()
      .scenarios.map((s, index) => ({
        index,
        label: s.label ?? 'Caso de prueba',
        change: changeInfo(s.change),
        before: decisionWords(s.before),
        after: decisionWords(s.after),
      }))
      .filter((r) => this.filter() === 'ALL' || r.change.changes),
  );
  protected readonly visibleRows = computed(() => this.rows().slice(0, this.shown()));
  protected readonly score = computed(() => this.result().governance.privilegeScore);
  protected readonly added = computed(() =>
    this.result().impact.effectiveAtoms.added.map((a) => actionName(a, null)),
  );
  protected readonly removed = computed(() =>
    this.result().impact.effectiveAtoms.removed.map((a) => actionName(a, null)),
  );
  protected readonly sodLabels = SOD_ACTION_LABELS;

  protected setFilter(value: Filter): void {
    this.filter.set(value);
    this.shown.set(PAGE);
  }

  protected more(): void {
    this.shown.update((n) => n + PAGE);
  }

  protected deltaText(delta: number): string {
    return delta > 0 ? `sube ${delta}` : delta < 0 ? `baja ${-delta}` : 'no cambia';
  }
}
