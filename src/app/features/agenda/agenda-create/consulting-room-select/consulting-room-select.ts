import { ChangeDetectionStrategy, Component, computed, inject, model, signal } from '@angular/core';
import { catchError, of, switchMap, filter, take } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';

import { InfrastructureClient } from '../../../../core/data-access/infrastructure/infrastructure.client';
import type { CareSpaceNode } from '../../../../core/data-access/infrastructure/infrastructure.types';
import { SiteContextStore } from '../../../../core/data-access/operating-rooms/site-context.store';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';

/** Las funciones que se agendan con consultorio (perfil `schedulable`, sin superposición). */
const ROOM_FUNCTIONS = new Set(['SPACE_FN_CONSULTING_ROOM', 'SPACE_FN_PROCEDURE_ROOM', 'SPACE_FN_IMAGING_ROOM']);

/**
 * **Consultorio de la agenda** (F5d, `CONTRATO-F2-F5.md` §F5d).
 *
 * Opcional y **a pedido**: la lista de espacios se lee recién cuando se toca
 * «Elegir consultorio», así quien no tiene consultorio en la organización no
 * paga ni una lectura. Ofrece los espacios activos de la sede con función
 * consultorio, sala de procedimientos o de imagen (`GET /sites/:siteId/structure`
 * de F1), nunca un id escrito. La API valida función, sede y que otra agenda
 * no ocupe el mismo consultorio a la misma hora (422).
 */
@Component({
  selector: 'app-consulting-room-select',
  imports: [AppButton, FormField, Select],
  template: `
    @if (!open()) {
      <button app-button variant="outline" size="sm" type="button" data-testid="agenda-create-room-open" (clicked)="start()">Elegir consultorio</button>
    } @else if (loading()) {
      <p class="consulting-room__note" role="status">Buscando los consultorios de la sede…</p>
    } @else if (options().length === 0) {
      <p class="consulting-room__note" data-testid="agenda-create-room-none">Su organización no tiene consultorios registrados en su infraestructura.</p>
    } @else {
      <app-form-field label="Consultorio" hint="Las citas de esta agenda se dan en este espacio. Dos agendas no lo pueden ocupar a la vez.">
        <app-select [options]="options()" [value]="careSpaceId()" placeholder="Sin consultorio" ariaLabel="Consultorio" data-testid="agenda-create-room" (valueChange)="careSpaceId.set($event || null)" />
      </app-form-field>
    }
  `,
  styles: [
    `
      .consulting-room__note {
        margin: 0;
        color: var(--text-muted);
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultingRoomSelect {
  private readonly infrastructure = inject(InfrastructureClient);
  private readonly siteContext = inject(SiteContextStore);

  /** El consultorio elegido; `null` = sin consultorio. */
  readonly careSpaceId = model<string | null>(null);

  protected readonly open = signal(false);
  protected readonly loading = signal(false);
  private readonly rooms = signal<readonly CareSpaceNode[]>([]);
  private readonly state$ = toObservable(this.siteContext.state);

  protected readonly options = computed<readonly SelectOption<string>[]>(() =>
    this.rooms().length === 0
      ? []
      : [{ value: '', label: 'Sin consultorio' }, ...this.rooms().map((r) => ({ value: r.id, label: `${r.code} · ${r.name}`, description: r.function.display }))],
  );

  protected start(): void {
    this.open.set(true);
    this.loading.set(true);
    this.siteContext.ensure();
    this.state$
      .pipe(
        filter((s) => s.status !== 'loading'),
        take(1),
        switchMap((s) => {
          const site = s.status === 'ready' || s.status === 'stale' ? s.data.sites[0] : undefined;
          return site === undefined ? of(null) : this.infrastructure.getStructure(site.id).pipe(catchError(() => of(null)));
        }),
      )
      .subscribe((structure) => {
        this.loading.set(false);
        this.rooms.set(
          (structure?.spaces ?? []).filter((e) => e.status.code === 'SPACE_ACTIVE' && ROOM_FUNCTIONS.has(e.function.code)).sort((a, b) => a.code.localeCompare(b.code)),
        );
      });
  }
}
