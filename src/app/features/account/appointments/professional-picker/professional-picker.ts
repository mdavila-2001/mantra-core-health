import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { Subscription } from 'rxjs';

import {
  BookableResourcesClient,
  type BookableResource,
} from '../../../../core/data-access/scheduling/bookable-resources.client';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ReferenceCombobox } from '../../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';

export const PROFESSIONAL_PAGE_SIZE = 20;

/** Stable key of an entry: the same person in two organizations is two choices. */
export function claveDeProfesional(r: BookableResource): string {
  return `${r.tenantId}|${r.resourceRefType}:${r.resourceRefId}`;
}

/**
 * «¿Con quién se quiere atender?» across every organization, paged and searched
 * on the server. The patient picks a person; the organization comes with it.
 */
@Component({
  selector: 'app-professional-picker',
  imports: [Alert, AppButton, FormField, ReferenceCombobox],
  templateUrl: './professional-picker.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfessionalPicker {
  private readonly client = inject(BookableResourcesClient);

  readonly resourceType = input.required<'PRACTITIONER' | 'ROOM'>();
  /** The chosen entry, or `null` when the choice is cleared. */
  readonly picked = output<BookableResource | null>();

  protected readonly items = signal<readonly BookableResource[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly selected = signal<ReferenceOption | null>(null);
  private readonly query = signal('');
  private request: Subscription | null = null;

  protected readonly esLaboratorio = computed(() => this.resourceType() === 'ROOM');
  protected readonly options = computed<readonly ReferenceOption[]>(() =>
    this.items().map((r) => ({ value: claveDeProfesional(r), label: `${r.name} · ${r.organizationName}` })),
  );
  protected readonly hayMas = computed(() => !this.loading() && this.items().length < this.total());
  /** Nobody to book with at all, not merely no match for what was typed. */
  protected readonly nadie = computed(
    () => !this.loading() && !this.failed() && this.query() === '' && this.total() === 0,
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.request?.unsubscribe());
    // A new type is a new list: practitioners and laboratories never mix.
    effect(() => {
      this.resourceType();
      untracked(() => {
        this.selected.set(null);
        this.query.set('');
        this.load(0);
      });
    });
  }

  protected buscar(q: string): void {
    this.query.set(q);
    this.load(0);
  }

  protected verMas(): void {
    this.load(this.items().length);
  }

  protected elegir(opcion: ReferenceOption | null): void {
    this.selected.set(opcion);
    const elegido = this.items().find((r) => claveDeProfesional(r) === opcion?.value) ?? null;
    this.picked.emit(elegido);
  }

  /** Offset 0 replaces the list; any other offset appends the next page. */
  private load(offset: number): void {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.failed.set(false);
    this.request = this.client
      .list({ resourceType: this.resourceType(), q: this.query(), limit: PROFESSIONAL_PAGE_SIZE, offset })
      .subscribe({
        next: (page) => {
          this.items.update((previos) => (offset === 0 ? page.items : [...previos, ...page.items]));
          this.total.set(page.total);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.failed.set(true);
        },
      });
  }
}
