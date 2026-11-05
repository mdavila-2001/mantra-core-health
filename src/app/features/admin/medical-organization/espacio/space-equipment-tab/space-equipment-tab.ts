import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';

import { EquipmentLocationClient } from '../../../../../core/data-access/diagnostic-units/equipment-location.client';
import type { LocatedEquipment } from '../../../../../core/data-access/diagnostic-units/equipment-location.types';
import type { CareSpaceDetail } from '../../../../../core/data-access/infrastructure/infrastructure.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';

/**
 * Pestaña **Equipos** de la ficha de espacio (F5a): qué equipos están en esta
 * sala, con su AE Title, y ubicar uno de la misma sede acá. La API valida
 * sede, perfil de función y tenant; un rechazo se muestra tal cual.
 */
@Component({
  selector: 'app-space-equipment-tab',
  imports: [AppButton, Badge, FormField, RouterLink, Select, ViewStateHost],
  templateUrl: './space-equipment-tab.html',
  styleUrl: '../space-tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpaceEquipmentTab {
  private readonly client = inject(EquipmentLocationClient);

  readonly space = input.required<CareSpaceDetail>();
  readonly canWrite = input(false);

  protected readonly state = signal<ViewState<readonly LocatedEquipment[]>>(loading());
  protected readonly candidates = signal<readonly LocatedEquipment[]>([]);
  protected readonly choice = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly failure = signal<ViewState<never> | null>(null);

  protected readonly options = computed<readonly SelectOption<string>[]>(() =>
    this.candidates().map((e) => ({ value: e.id, label: `${e.type.display} · ${e.model ?? ''}`.trim(), description: e.careSpace === null ? 'Sin sala' : `Hoy en ${e.careSpace.code}` })),
  );

  constructor() {
    effect(() => {
      const space = this.space();
      untracked(() => this.load(space));
    });
  }

  protected locateHere(): void {
    const id = this.choice();
    if (id === null || this.saving()) return;
    this.saving.set(true);
    this.failure.set(null);
    this.client.update(id, { careSpaceId: this.space().id }).subscribe({
      next: () => {
        this.saving.set(false);
        this.choice.set(null);
        this.load(this.space());
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.failure.set(errorToViewState<never>(error));
      },
    });
  }

  private load(space: CareSpaceDetail): void {
    this.state.set(loading());
    this.client.listBySpace(space.id).subscribe({
      next: (list) =>
        this.state.set(
          list.length === 0
            ? empty({ label: this.canWrite() ? 'Ubique un equipo con el selector de arriba' : 'Volver a la ficha' }, 'No hay equipos ubicados en este espacio.')
            : ready(list),
        ),
      error: (error: unknown) => this.state.set(errorToViewState<readonly LocatedEquipment[]>(error)),
    });
    this.client
      .listBySite(space.siteId)
      .pipe(catchError(() => of([] as readonly LocatedEquipment[])))
      .subscribe((all) => this.candidates.set(all.filter((e) => e.careSpace?.id !== space.id)));
  }
}
