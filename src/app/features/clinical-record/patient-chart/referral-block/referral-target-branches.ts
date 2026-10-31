import { computed, inject, signal } from '@angular/core';
import { of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../../../core/auth/auth.service';
import { DirectoryClient } from '../../../../core/data-access/directory/directory.client';
import type { BranchListItem } from '../../../../core/data-access/directory/directory.types';
import type { ReferralTarget } from '../../../../core/data-access/referrals/referrals.types';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';

/**
 * Las sedes de la organización elegida en «Derivar», y la que se eligió.
 *
 * `GET /tenants/:id/branches` es sólo para quien pertenece a la organización
 * (la API responde 403 a los demás). A una ajena no se le piden: se deriva a
 * «cualquier sede», que la organización asigna. Si no se pueden leer, igual.
 *
 * Se crea en el contexto de inyección del bloque (un campo).
 */
export class ReferralTargetBranches {
  private readonly directory = inject(DirectoryClient);
  private readonly auth = inject(AuthService);

  private readonly items = signal<readonly BranchListItem[]>([]);
  readonly selected = signal<string | null>(null);
  readonly options = computed<readonly SelectOption<string | null>[]>(() => [
    { value: null, label: 'Cualquier sede (la organización decide)' },
    ...this.items().map((b) => ({ value: b.id, label: b.name })),
  ]);
  readonly any = computed(() => this.items().length > 0);

  /** @param currentTarget - El destino elegido ahora en el bloque. */
  constructor(private readonly currentTarget: () => ReferralTarget | null) {}

  load(target: ReferralTarget): void {
    this.reset();
    if (target.kind !== 'ORGANIZATION' || !this.auth.tenants().includes(target.id)) return;
    this.directory
      .listBranches(target.id)
      .pipe(catchError(() => of({ items: [] as readonly BranchListItem[], count: 0 })))
      .subscribe((list) => {
        if (this.currentTarget()?.id === target.id) this.items.set(list.items);
      });
  }

  reset(): void {
    this.selected.set(null);
    this.items.set([]);
  }
}
