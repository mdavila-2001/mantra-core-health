import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject,
  input, LOCALE_ID, output, signal, untracked,
} from '@angular/core';

import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { PharmacyIntegrationClient } from '../../../../core/data-access/pharmacy/pharmacy-integration.client';
import type {
  ExternalSystemFormat, ExternalSystemProbe, IntegrationConnection,
} from '../../../../core/data-access/pharmacy/pharmacy-integration.types';
import { IntegrationSystemRequests } from './integration-system-requests';
import { systemConfigurationKey, systemFacts, systemLastCheck, validSystemUrl } from './integration-system-state';
import {
  FORMAT_HINT, FORMAT_LABEL, NO_SYSTEM_TEXT, PROBE_OK_TEXT, REMOVED_TEXT,
  SAVE_UNAVAILABLE_TEXT, SAVED_TEXT, SERVER_SYSTEM_TEXT, TOAST_KEY,
} from './integration-system.texts';

/** Un único configurador por farmacia y conexión; la API prueba antes de guardar. */
@Component({
  selector: 'app-integration-system',
  imports: [Alert, AppButton, FactList, FormField, Input, Select, ViewStateHost],
  templateUrl: './integration-system.html',
  styleUrl: './integration-system.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationSystem {
  readonly pharmacyId = input.required<string>();
  readonly connection = input.required<IntegrationConnection>();
  readonly changed = output<void>();
  readonly checked = output<ExternalSystemProbe | null>();
  private readonly integration = inject(PharmacyIntegrationClient);
  private readonly dialogs = inject(DialogService);
  private readonly toasts = inject(ToastService);
  private readonly locale = inject(LOCALE_ID);

  protected readonly formatOptions: readonly SelectOption<ExternalSystemFormat>[] = (
    Object.keys(FORMAT_LABEL) as ExternalSystemFormat[]
  ).map((value) => ({ value, label: FORMAT_LABEL[value] }));
  protected readonly editing = signal(false);
  protected readonly format = signal<ExternalSystemFormat>('ALOVIDA_STANDARD');
  protected readonly baseUrl = signal('');
  protected readonly pharmacyCode = signal('');
  protected readonly apiKey = signal('');
  protected readonly submitted = signal(false);
  protected readonly probeOk = signal<string | null>(null);
  private readonly requests = new IntegrationSystemRequests(() => this.apiKey.set(''), () => this.scopeKey());
  protected readonly error = this.requests.error;
  protected readonly accessState = this.requests.accessState;
  protected readonly saving = computed(() => this.requests.activity() === 'save');
  protected readonly probing = computed(() => this.requests.activity() === 'probe');
  protected readonly removing = computed(() => this.requests.activity() === 'remove');
  protected readonly busy = computed(() => this.requests.activity() !== null);
  protected readonly system = computed(() => this.connection().system ?? null);
  protected readonly showForm = computed(() => this.system() === null || this.editing());
  protected readonly formatHint = computed(() => FORMAT_HINT[this.format()]);
  protected readonly serverText = computed(() => this.connection().providerConfigured ? SERVER_SYSTEM_TEXT : NO_SYSTEM_TEXT);
  protected readonly missing = computed(() => ({
    baseUrl: this.baseUrl().trim() === '',
    pharmacyCode: this.pharmacyCode().trim() === '',
    apiKey: this.apiKey() === '',
  }));
  protected readonly invalidUrl = computed(() => !this.missing().baseUrl && !validSystemUrl(this.baseUrl()));
  protected readonly facts = computed(() => systemFacts(this.system(), this.locale));
  protected readonly lastCheckText = computed(() => systemLastCheck(this.system(), this.locale));

  constructor() {
    const scope = computed(() => this.scopeKey());
    effect(() => {
      scope();
      untracked(() => {
        // Cortar una mutación no la deshace en la API: pedir relectura del ámbito vigente.
        const wasMutating = this.saving() || this.removing();
        this.requests.cancel();
        this.editing.set(false);
        this.resetForm();
        this.probeOk.set(null);
        if (wasMutating) this.changed.emit();
      });
    });
    inject(DestroyRef).onDestroy(() => this.requests.cancel());
  }

  protected textOf(value: string | number | null): string {
    return value === null ? '' : String(value);
  }

  protected chooseFormat(value: ExternalSystemFormat | null): void {
    if (value !== null) this.format.set(value);
  }

  protected startEdit(): void {
    if (this.busy()) return;
    const system = this.system();
    this.resetForm();
    if (system !== null) {
      this.format.set(system.format);
      this.baseUrl.set(system.baseUrl);
      this.pharmacyCode.set(system.externalPharmacyCode);
    }
    this.error.set(null);
    this.probeOk.set(null);
    this.editing.set(true);
  }

  protected cancelEdit(): void {
    if (this.busy()) return;
    this.editing.set(false);
    this.resetForm();
    this.error.set(null);
  }

  protected save(): void {
    if (this.busy()) return;
    this.submitted.set(true);
    const missing = this.missing();
    if (missing.baseUrl || missing.pharmacyCode || missing.apiKey || this.invalidUrl()) return;
    this.probeOk.set(null);
    this.requests.run('save', this.integration.saveSystem(this.pharmacyId(), this.connection().id, {
      format: this.format(), baseUrl: this.baseUrl(),
      externalPharmacyCode: this.pharmacyCode(), apiKey: this.apiKey(),
    }), () => {
      this.editing.set(false);
      this.resetForm();
      this.toasts.show({ type: 'success', message: SAVED_TEXT, key: TOAST_KEY });
      this.changed.emit();
    }, {
      fallback: 'No se pudo guardar el sistema de la farmacia.',
      overrides: { PHARMACY_INTEGRATION_UNAVAILABLE: SAVE_UNAVAILABLE_TEXT },
    });
  }

  protected probe(): void {
    if (this.busy() || this.system() === null) return;
    this.probeOk.set(null);
    this.requests.run('probe', this.integration.probeSystem(this.pharmacyId(), this.connection().id), (result) => {
      this.probeOk.set(result.source === 'PHARMACY' ? PROBE_OK_TEXT : 'Respondió el sistema del servidor.');
      this.checked.emit(result);
    }, {
      fallback: 'No se pudo probar el sistema de la farmacia.',
      onError: () => this.checked.emit(null),
    });
  }

  protected async remove(): Promise<void> {
    if (this.busy() || this.system() === null) return;
    const version = this.requests.generation;
    const scope = this.scopeKey();
    const confirmed = await this.dialogs.confirm({
      title: 'Quitar el sistema de la farmacia',
      message: 'La conexión deja de sincronizar con este sistema y la clave guardada se borra. Los vínculos y las existencias que ya se sincronizaron se conservan.',
      confirmLabel: 'Quitar', destructive: true,
    });
    if (!confirmed || version !== this.requests.generation || scope !== this.scopeKey() || this.busy()) return;
    this.probeOk.set(null);
    this.requests.run('remove', this.integration.removeSystem(this.pharmacyId(), this.connection().id), () => {
      this.toasts.show({ type: 'success', message: REMOVED_TEXT, key: TOAST_KEY });
      this.changed.emit();
    }, { fallback: 'No se pudo quitar el sistema de la farmacia.' });
  }

  private scopeKey(): string {
    return `${this.pharmacyId()}|${this.connection().id}|${systemConfigurationKey(this.system())}`;
  }

  private resetForm(): void {
    this.format.set('ALOVIDA_STANDARD');
    this.baseUrl.set('');
    this.pharmacyCode.set('');
    this.apiKey.set('');
    this.submitted.set(false);
  }
}
