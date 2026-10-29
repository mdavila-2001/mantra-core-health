import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { RULE_LABELS } from '../../../../core/data-access/adt/adt.catalog';
import { blockingOf, overridableOf } from '../../../../core/data-access/adt/adt.logic';
import type { BedCompatibility, CompatibilityViolation } from '../../../../core/data-access/adt/adt.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';

/**
 * El resultado de `bed-compatibility`, como la persona lo necesita para decidir:
 *
 * - **Bloqueantes** (ciclo de vida, disponibilidad, ocupación, higiene,
 *   aislamiento aéreo): `Alert` de error, **sin** opción de forzar. Nunca se
 *   fuerzan.
 * - **Forzables** (sexo, edad, cohorte, nivel de cuidado): `Alert` de
 *   advertencia con «Forzar con justificación». Solo la supervisión de
 *   enfermería puede; a quien no puede, se le dice quién (la API decide igual).
 * - Sin violaciones: aviso de que es compatible.
 *
 * No decide nada ni guarda el texto: avisa `forceRequested` y quien lo monta
 * abre `confirmWithReason` (mínimo 20 caracteres, genera un incidente).
 */
@Component({
  selector: 'app-compat-panel',
  imports: [Alert, AppButton],
  templateUrl: './compat-panel.html',
  styleUrl: './compat-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompatPanel {
  /** `null` mientras se consulta o si todavía no se eligió cama. */
  readonly result = input<BedCompatibility | null>(null);
  readonly checking = input(false);
  /** La API no ofrece la vista previa (DESVÍO F3-A): se decide al confirmar. */
  readonly previewUnavailable = input(false);
  /** Lo que la API declara en `viewer.canOverride`. Solo refleja. */
  readonly canOverride = input(false);
  /** Ya se tomó la decisión de forzar: se muestra y se puede deshacer. */
  readonly forced = input(false);
  readonly forceRequested = output<void>();
  readonly forceCleared = output<void>();

  protected readonly bloqueantes = computed(() => blockingOf(this.result()?.violations ?? []));
  protected readonly forzables = computed(() => overridableOf(this.result()?.violations ?? []));
  protected readonly regla = (v: CompatibilityViolation): string => RULE_LABELS[v.rule];
}
