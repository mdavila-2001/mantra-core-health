import { ChangeDetectionStrategy, Component, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { concatMap, from, tap } from 'rxjs';

import { HealthcareServicesClient } from '../../../../../core/data-access/healthcare-services/healthcare-services.client';
import type {
  HealthcareServiceOffer,
  PracticeSiteOption,
} from '../../../../../core/data-access/healthcare-services/healthcare-services.types';
import { PracticeSitesClient } from '../../../../../core/data-access/practice-sites/practice-sites.client';
import { ServicesCatalogClient } from '../../../../../core/data-access/services-catalog/services-catalog.client';
import type { Practice } from '../../../../../core/data-access/services-catalog/services-catalog.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Checkbox } from '../../../../../shared/components/atoms/checkbox/checkbox';
import { Select } from '../../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../../shared/components/molecules/form-field/form-field';
import { LoadingState } from '../../../../../shared/components/molecules/loading-state/loading-state';

/**
 * **Pedir afiliarme a un centro** con los procedimientos que haría en una sede
 * (CM-07, HU-M2). Lo usan «Invitaciones y solicitudes» y «Procedimientos que
 * hago» (agregar uno nuevo es otra solicitud pendiente, A-7).
 *
 * El contrato admite **un** procedimiento por `self-request`: para varios, se
 * hace una llamada por cada uno, en orden, y cada una devuelve su propia fila
 * pendiente del centro. Si una falla, las anteriores quedan hechas y se avisa
 * cuáles faltan.
 */
@Component({
  selector: 'app-affiliation-request-form',
  imports: [Alert, AppButton, Checkbox, FormField, Select, LoadingState],
  templateUrl: './affiliation-request-form.html',
  styleUrl: './affiliation-request-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AffiliationRequestForm {
  private readonly catalog = inject(ServicesCatalogClient);
  private readonly practiceSites = inject(PracticeSitesClient);
  private readonly services = inject(HealthcareServicesClient);

  /** Se enviaron todas las solicitudes; dice cuántas. */
  readonly requested = output<number>();
  /** Al menos una solicitud quedó hecha aunque otra falló: la lista de afuera debe recargarse. */
  readonly changed = output<void>();
  readonly cancelled = output<void>();

  protected readonly practices = signal<readonly Practice[]>([]);
  protected readonly practiceId = signal<string | null>(null);
  protected readonly sites = signal<readonly PracticeSiteOption[]>([]);
  protected readonly siteId = signal<string | null>(null);
  protected readonly procedures = signal<readonly HealthcareServiceOffer[]>([]);
  protected readonly proceduresLoading = signal(false);
  protected readonly checked = signal<ReadonlySet<string>>(new Set());
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly practiceOptions = computed<readonly SelectOption<string>[]>(() =>
    this.practices().map((practice) => ({ value: practice.id, label: practice.name })),
  );
  protected readonly siteOptions = computed<readonly SelectOption<string>[]>(() =>
    this.sites().map((site) => ({ value: site.id, label: site.name })),
  );
  protected readonly canSubmit = computed(
    () => this.practiceId() !== null && this.siteId() !== null && this.checked().size > 0 && !this.saving(),
  );

  constructor() {
    this.catalog.listPractices().subscribe({
      next: (list) => this.practices.set(list),
      error: () => this.error.set('No pudimos cargar la lista de centros.'),
    });
    effect(() => {
      const practiceId = this.practiceId();
      untracked(() => this.loadSites(practiceId));
    });
    effect(() => {
      const practiceId = this.practiceId();
      const siteId = this.siteId();
      untracked(() => this.loadProcedures(practiceId, siteId));
    });
  }

  protected isChecked(id: string): boolean {
    return this.checked().has(id);
  }

  protected toggle(id: string, on: boolean): void {
    this.checked.update((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  protected submit(): void {
    const practiceId = this.practiceId();
    const siteId = this.siteId();
    if (practiceId === null || siteId === null || !this.canSubmit()) return;
    const ids = [...this.checked()];
    let sent = 0;
    this.saving.set(true);
    this.error.set(null);
    // De a una y en orden: si una falla, las anteriores ya quedaron hechas.
    from(ids)
      .pipe(
        concatMap((healthcareServiceId) =>
          this.practiceSites
            .selfRequestAffiliation(practiceId, { practiceSiteId: siteId, healthcareServiceId })
            .pipe(tap(() => sent++)),
        ),
      )
      .subscribe({
        complete: () => {
          this.saving.set(false);
          this.requested.emit(sent);
        },
        error: (failure: unknown) => {
          this.saving.set(false);
          const state = errorToViewState<unknown>(failure);
          const reason = 'message' in state && typeof state.message === 'string' && state.message !== '' ? state.message : 'No pudimos enviar la solicitud.';
          this.error.set(sent > 0 ? `Se enviaron ${sent} de ${ids.length} solicitudes. ${reason}` : reason);
          if (sent > 0) this.changed.emit();
        },
      });
  }

  private loadSites(practiceId: string | null): void {
    this.sites.set([]);
    this.siteId.set(null);
    if (practiceId === null) return;
    this.services.listSites(practiceId).subscribe({
      next: (list) => this.sites.set(list),
      error: () => this.error.set('No pudimos cargar las sedes del centro.'),
    });
  }

  private loadProcedures(practiceId: string | null, siteId: string | null): void {
    this.procedures.set([]);
    this.checked.set(new Set());
    if (practiceId === null || siteId === null) return;
    this.proceduresLoading.set(true);
    this.services.listOffers(practiceId, siteId).subscribe({
      next: (list) => {
        this.procedures.set(list.filter((offer) => offer.active));
        this.proceduresLoading.set(false);
      },
      error: () => {
        this.proceduresLoading.set(false);
        this.error.set('No pudimos cargar los procedimientos de la sede.');
      },
    });
  }
}
