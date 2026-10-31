import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { DatePipe } from '@angular/common';

import type {
  ExplainAccessResponse,
  ExplainAssume,
} from '../../../../core/data-access/access-governance/access-explain.types';
import { atomMeta } from '../../../../core/data-access/support-access/support-atoms';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Switch } from '../../../../shared/components/atoms/switch/switch';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../shared/components/molecules/segmented-control/segmented-control.types';
import {
  ASSUME_FLAGS,
  assumeOf,
  assumeSummary,
  fieldLabel,
  maskLabel,
  missingKindLabel,
  NO_ASSUMPTIONS,
  obligationLines,
  stepViews,
  verdictOf,
  type AssumeChoice,
  type AssumeChoices,
  type AssumeKey,
} from '../explain-text';

/** Quién lee la explicación: cambia lo que se ofrece (administración ve `adminFixes`; la persona y el doctor, `askAdmin`). */
export type ExplainAudience = 'admin' | 'self' | 'doctor';

const CHOICES: readonly SegmentedOption<AssumeChoice>[] = [
  { value: 'REAL', label: 'Como está hoy' },
  { value: 'YES', label: 'Sí' },
  { value: 'NO', label: 'No' },
];

/**
 * **La explicación de una decisión**, paso a paso y en lenguaje simple (CONTRATO-GOBIERNO §5.2, §9.1 punto 3).
 *
 * Es solo presentación: todo lo que dice (veredicto, razones, qué falta) lo calculó la API con el mismo motor que decide;
 * acá no se replica ninguna condición. El estado se dice con texto y símbolo además del color, y la región es
 * `aria-live="polite"` para que un cambio de supuesto (`assume`) se anuncie sin quitar el foco.
 */
@Component({
  selector: 'app-explain-result',
  imports: [Badge, DatePipe, SegmentedControl, Switch],
  templateUrl: './explain-result.html',
  styleUrl: './explain-result.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExplainResult {
  readonly result = input.required<ExplainAccessResponse>();
  readonly audience = input<ExplainAudience>('admin');
  /** Muestra «¿Y si…?» (los interruptores `assume`). */
  readonly canAssume = input(true);
  /** Hay un cálculo en curso (el resultado de abajo es el anterior). */
  readonly busy = input(false);
  /** Lo que se pisó con «¿Y si…?», para recordar con qué supuestos se calculó. */
  readonly assumed = input<ExplainAssume | undefined>(undefined);

  readonly choices = model<AssumeChoices>(NO_ASSUMPTIONS);
  readonly forceFull = model(false);
  /** El nuevo conjunto de supuestos: la pantalla vuelve a preguntar con él. */
  readonly assumeChanged = output<ExplainAssume | undefined>();

  protected readonly flags = ASSUME_FLAGS;
  protected readonly options = CHOICES;
  protected readonly verdict = computed(() => verdictOf(this.result().decision));
  protected readonly steps = computed(() =>
    stepViews(this.result().reasons, this.result().decidedBy.step),
  );
  protected readonly obligations = computed(() => obligationLines(this.result().obligations));
  protected readonly assumedText = computed(() => assumeSummary(this.assumed()));
  protected readonly atomName = computed(() => {
    const atom = this.result().decision.atom;
    return atom === undefined ? undefined : atomMeta(atom)?.name;
  });
  protected readonly fields = computed(() =>
    Object.entries(this.result().visibleFields).map(([code, mask]) => ({
      code,
      label: fieldLabel(code),
      mask: maskLabel(mask),
    })),
  );
  protected readonly hasUnmetStep = computed(() => this.steps().some((s) => !s.passed));

  protected readonly maskLabel = maskLabel;
  protected readonly missingKind = missingKindLabel;

  protected choiceOf(key: AssumeKey): AssumeChoice {
    return this.choices()[key];
  }

  protected choose(key: AssumeKey, value: AssumeChoice): void {
    this.choices.update((actual) => ({ ...actual, [key]: value }));
    this.assumeChanged.emit(assumeOf(this.choices(), this.forceFull()));
  }

  protected toggleForceFull(value: boolean): void {
    this.forceFull.set(value);
    this.assumeChanged.emit(assumeOf(this.choices(), value));
  }

  protected reset(): void {
    this.choices.set(NO_ASSUMPTIONS);
    this.assumeChanged.emit(assumeOf(NO_ASSUMPTIONS, this.forceFull()));
  }
}
