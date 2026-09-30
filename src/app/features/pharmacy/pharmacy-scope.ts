import { computed, inject, Injectable, signal } from '@angular/core';

import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { PharmacyClient } from '../../core/data-access/pharmacy/pharmacy.client';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';

/**
 * **De qué farmacia habla el portal.**
 *
 * El front no conoce el mapeo tenant → farmacia, así que la lista sale de
 * `GET /pharmacy/pharmacies` (que el servidor acota a la organización activa)
 * y, con una sola, queda elegida sola. Es lo que hacían por su cuenta el
 * catálogo y las promociones; las pantallas del portal de la farmacia lo
 * comparten en vez de repetirlo.
 *
 * No es `providedIn: 'root'`: cada pantalla lo provee y muere con ella, así que
 * cambiar de pantalla no arrastra una elección vieja ni una lista cacheada.
 */
@Injectable()
export class PharmacyScope {
  private readonly pharmacy = inject(PharmacyClient);

  /** Las farmacias entre las que se puede elegir, con el estado de la carga. */
  readonly options = signal<ViewState<readonly SelectOption<string>[]>>(loading());

  /** La farmacia elegida, o `null` mientras no hay ninguna. */
  readonly pharmacyId = signal<string | null>(null);

  /** Las farmacias listas para un `app-select`; vacío mientras no se cargaron. */
  readonly selectOptions = computed<readonly SelectOption<string>[]>(
    () => dataOf(this.options()) ?? [],
  );

  readonly hasSeveral = computed(() => this.selectOptions().length > 1);

  readonly name = computed(() => {
    const id = this.pharmacyId();
    return this.selectOptions().find((option) => option.value === id)?.label ?? '';
  });

  constructor() {
    this.load();
  }

  choose(id: string | null): void {
    this.pharmacyId.set(id);
  }

  retry(): void {
    this.options.set(loading());
    this.load();
  }

  private load(): void {
    this.pharmacy.listPharmacies().subscribe({
      next: (page) => {
        const options = page.items.map((item) => ({ value: item.id, label: item.name }));
        this.options.set(
          options.length === 0
            ? empty(
                { label: 'Ir a la ficha de la farmacia', route: '/administration/pharmacy-profile' },
                'Tu organización todavía no tiene una farmacia publicada.',
              )
            : ready(options),
        );
        if (options.length === 1) {
          this.pharmacyId.set(options[0]!.value);
        }
      },
      error: (error: unknown) =>
        this.options.set(errorToViewState<readonly SelectOption<string>[]>(error)),
    });
  }
}
