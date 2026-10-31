import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type {
  SimulateAccessResponse,
  SodFindingPreview,
} from '../../../../core/data-access/access-governance/access-explain.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { PlacedIssue } from '../issue-placement';

/** Lo que la vista previa tiene para mostrar ahora. */
export type PreviewView =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly response: SimulateAccessResponse };

const SOD_ACTION_LABELS: Readonly<Record<SodFindingPreview['action'], string>> = {
  BLOCK: 'Bloqueado: no se puede guardar así',
  REQUIRE_APPROVAL: 'Pide aprobación de otra persona',
  WARN: 'Aviso: conviene revisarlo',
};

/**
 * **Vista previa** del borrador (CONTRATO-GOBIERNO §9.4): el resumen en lenguaje simple, qué cambia, el impacto,
 * los errores y avisos (con un botón que lleva al campo), los conflictos de funciones y el puntaje de privilegios.
 * Es solo presentación: la calcula `simulate` y esta pantalla no vuelve a interpretar las reglas.
 * La región es `aria-live="polite"` para que el lector de pantalla anuncie cada recálculo.
 */
@Component({
  selector: 'app-change-preview',
  imports: [Alert, AppButton],
  templateUrl: './change-preview.html',
  styleUrl: './change-preview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChangePreview {
  readonly view = input.required<PreviewView>();
  /** Errores y avisos ya ubicados (los mismos que se marcan junto a los campos). */
  readonly issues = input<readonly PlacedIssue[]>([]);
  /** Nombre en lenguaje simple de cada permiso preciso. */
  readonly atomNames = input<Readonly<Record<string, string>>>({});

  readonly retry = output<void>();
  readonly goTo = output<PlacedIssue>();

  protected readonly response = computed(() => {
    const v = this.view();
    return v.kind === 'ready' ? v.response : null;
  });
  protected readonly errors = computed(() => this.issues().filter((i) => i.severity === 'error'));
  protected readonly warnings = computed(() =>
    this.issues().filter((i) => i.severity === 'warning'),
  );

  protected readonly errorMessage = computed(() => {
    const v = this.view();
    return v.kind === 'error' ? v.message : '';
  });

  protected names(codes: readonly string[]): string {
    return codes.map((code) => this.atomNames()[code] ?? code).join(', ');
  }
  protected sodLabel(action: SodFindingPreview['action']): string {
    return SOD_ACTION_LABELS[action];
  }
  protected signed(value: number): string {
    return value > 0 ? `+${value}` : String(value);
  }
  protected arrow(pair: { readonly before: number; readonly after: number }): string {
    return pair.before === pair.after
      ? `${pair.after} (sin cambio)`
      : `${pair.before} → ${pair.after}`;
  }
}
