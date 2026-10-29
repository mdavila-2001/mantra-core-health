import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';

import { InfrastructureOpsClient } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.client';
import { opsErrorToViewState } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.errors';
import { AXIS_LABEL, labelOf, SOURCE_LABEL, V2_LABEL } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.logic';
import type { AxisCode, StatusEvent } from '../../../core/data-access/infrastructure-ops/infrastructure-ops.types';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../shared/components/molecules/segmented-control/segmented-control.types';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';

const FILTERS: readonly SegmentedOption<string>[] = [
  { value: '', label: 'Todos' },
  { value: 'AXIS_AVAILABILITY', label: 'Disponibilidad' },
  { value: 'AXIS_HYGIENE', label: 'Higiene' },
  { value: 'AXIS_ISOLATION', label: 'Aislamiento' },
  { value: 'AXIS_OCCUPANCY', label: 'Ocupación' },
];

const DATE_TIME = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/La_Paz',
});

/**
 * **Historial de estados** de un espacio (F2.3 `GET /care-spaces/:id/status-events`):
 * una fila por cambio de cualquiera de los cuatro ejes —el A20 de HL7—, con
 * quién, cuándo, el motivo, de dónde vino el cambio y el código de petición.
 *
 * Es un registro append-only: la pantalla solo lo lee. El filtro por eje y la
 * paginación («Ver más») viajan a la API; la lista nunca se recompone sola con
 * lo que quedó en memoria.
 */
@Component({
  selector: 'app-status-history',
  imports: [AppButton, Badge, SegmentedControl, ViewStateHost],
  templateUrl: './status-history.html',
  styleUrl: './status-history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusHistory {
  readonly spaceId = input.required<string>();
  /** Cambia cada vez que el espacio cambió: vuelve a pedir la primera página. */
  readonly version = input(0);

  private readonly client = inject(InfrastructureOpsClient);

  protected readonly filters = FILTERS;
  protected readonly axis = signal('');
  protected readonly state = signal<ViewState<readonly StatusEvent[]>>(loading());
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loadingMore = signal(false);
  protected readonly items = computed(() => {
    const s = this.state();
    return s.status === 'ready' || s.status === 'stale' ? s.data : [];
  });

  protected readonly axisLabel = AXIS_LABEL;
  protected readonly sourceLabel = SOURCE_LABEL as Readonly<Record<string, string>>;
  protected readonly labelOf = labelOf;
  protected readonly v2Label = V2_LABEL;

  constructor() {
    effect(() => {
      const id = this.spaceId();
      const axis = this.axis();
      this.version();
      untracked(() => this.load(id, axis, null));
    });
  }

  protected when(iso: string): string {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : DATE_TIME.format(d);
  }

  protected reload(): void {
    this.load(this.spaceId(), this.axis(), null);
  }

  protected more(): void {
    const cursor = this.nextCursor();
    if (cursor !== null) this.load(this.spaceId(), this.axis(), cursor);
  }

  private load(id: string, axis: string, cursor: string | null): void {
    if (cursor === null) this.state.set(loading());
    else this.loadingMore.set(true);
    this.client
      .listStatusEvents(id, {
        ...(axis === '' ? {} : { axis: axis as AxisCode }),
        ...(cursor === null ? {} : { cursor }),
      })
      .subscribe({
        next: (page) => {
          this.loadingMore.set(false);
          this.nextCursor.set(page.nextCursor);
          const all = cursor === null ? page.items : [...this.items(), ...page.items];
          this.state.set(
            all.length === 0
              ? empty({ label: 'Cambie el filtro o espere el primer cambio de estado' }, 'Este espacio todavía no registra cambios de estado con ese filtro.')
              : ready(all),
          );
        },
        error: (error: unknown) => {
          this.loadingMore.set(false);
          this.state.set(opsErrorToViewState<readonly StatusEvent[]>(error));
        },
      });
  }
}
